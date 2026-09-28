<?php
declare(strict_types=1);

/**
 * Senkron motoru: tedarikçileri çeker, ürünleri eşler, en uygun tedarikçiyi seçer,
 * kâr kuralıyla satış fiyatını hesaplar ve sitenin ürün tablosunu günceller.
 *
 * Güvenlik ilkeleri:
 *  - Bir tedarikçi hata verirse atlanır; son başarılı verisi 'eski_veri_saat' içindeyse o kullanılır.
 *  - Emin olunamayan üründe (tedarikçisi hatalı ve verisi eski) stok sıfırlanmaz / pasife alınmaz.
 *  - Büyük zam/indirim otomatik yazılmaz, onaya düşer.
 *  - Mağaza sahibinin elle pasife aldığı ürün, stok gelince otomatik aktif edilmez
 *    (yalnızca bu sistemin pasife aldıkları geri açılır).
 */
final class Senkron
{
    private Fiyatlama $fiyatlama;
    private Doviz $doviz;
    private Bildirim $bildirim;
    private int $calismaId = 0;
    private array $site = [];          // anahtar => satır
    private array $barkodIndeks = [];  // barkod => anahtar
    private array $skuIndeks = [];     // ft_sku(anahtar) => anahtar
    private array $degisiklikler = [];
    private array $urunRapor = [];
    private array $sayac = [];
    private array $tedarikciRapor = [];

    public function __construct(private PDO $db, private array $ayar, private bool $kuru = false)
    {
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->fiyatlama = new Fiyatlama($ayar['kar'] ?? []);
        $this->doviz = new Doviz($ayar['doviz'] ?? []);
        $this->bildirim = new Bildirim($ayar['bildirim'] ?? []);
    }

    public function calistir(): array
    {
        $t0 = microtime(true);
        $baslangic = ft_simdi();
        $this->sayac = array_fill_keys([
            'islenen_urun', 'fiyat_degisen', 'zam', 'indirim', 'stok_degisen', 'stok_biten', 'stok_gelen',
            'pasife_alinan', 'aktife_alinan', 'onaya_dusen', 'gorsel_guncellenen', 'tedarikci_degisen',
            'marj_korundu', 'eslesmeyen_tedarikci_urunu', 'tedarikcisiz_site_urunu', 'belirsiz_atlanan',
        ], 0);

        if (!$this->kuru) {
            $this->db->prepare('INSERT INTO ft_calisma (baslangic, durum) VALUES (?, ?)')->execute([$baslangic, 'calisiyor']);
            $this->calismaId = (int) $this->db->lastInsertId();
        }
        Gunluk::yaz('Senkron başladı' . ($this->kuru ? ' (KURU ÇALIŞMA: hiçbir şey yazılmayacak)' : " #{$this->calismaId}"));

        $this->site_yukle();
        $tedVeri = $this->tedarikcileri_cek();
        $adaylar = $this->eslestir($tedVeri);

        $kural = $this->ayar['kurallar'] ?? [];
        $durumlar = $this->tablo_haritasi('SELECT * FROM ft_urun_durum', 'urun_anahtar');
        $onaylar = $this->tablo_haritasi("SELECT * FROM ft_onay WHERE durum IN ('bekliyor','reddedildi') ORDER BY id", 'urun_anahtar');

        if (!$this->kuru) {
            $this->db->beginTransaction();
        }
        try {
            foreach ($adaylar as $anahtar => $liste) {
                $this->urun_isle((string) $anahtar, $liste, $tedVeri, $durumlar[$anahtar] ?? null, $onaylar[$anahtar] ?? null, $kural);
            }
            if (!$this->kuru) {
                $this->db->commit();
            }
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->calisma_bitir($t0, 'hata', $e->getMessage());
            throw $e;
        }
        $this->sayac['tedarikcisiz_site_urunu'] = count($this->site) - count($adaylar);

        $hataliTed = array_filter($this->tedarikciRapor, fn($t) => $t['durum'] !== 'ok');
        foreach ($hataliTed as $t) {
            $this->bildirim->ekle("Tedarikçi hatası: {$t['ad']} — {$t['hata']}");
        }
        $gonderim = [];
        if (!$this->kuru && !$this->bildirim->bos_mu()) {
            $gonderim = $this->bildirim->gonder('Fiyat takip: ' . $this->sayac['onaya_dusen'] . ' onay bekleyen değişiklik, ' . count($hataliTed) . ' tedarikçi hatası');
        }

        $rapor = $this->calisma_bitir($t0, $hataliTed ? 'kismi' : 'tamam', null, $baslangic);
        $rapor['bildirim'] = $gonderim;
        Gunluk::yaz(sprintf(
            'Bitti: %d ürün işlendi, %d fiyat değişti, %d stok değişti, %d pasife alındı, %d onaya düştü, %d tedarikçi hatalı (%.1f sn)',
            $this->sayac['islenen_urun'], $this->sayac['fiyat_degisen'], $this->sayac['stok_degisen'],
            $this->sayac['pasife_alinan'], $this->sayac['onaya_dusen'], count($hataliTed), microtime(true) - $t0
        ));
        return $rapor;
    }

    // ------------------------------------------------------------------ site

    private function alan(string $ad): ?string
    {
        $a = $this->ayar['site']['alanlar'][$ad] ?? null;
        return $a ? (string) $a : null;
    }

    private function site_yukle(): void
    {
        $tablo = ft_ad((string) $this->ayar['site']['tablo']);
        $secim = [];
        foreach (['anahtar', 'barkod', 'ad', 'fiyat', 'stok', 'durum', 'gorsel', 'kategori'] as $k) {
            if ($a = $this->alan($k)) {
                $secim[] = ft_ad($a) . ' AS ' . ft_ad('ft_' . $k);
            }
        }
        $sql = 'SELECT ' . implode(', ', $secim) . " FROM {$tablo}";
        if (!empty($this->ayar['site']['ek_kosul'])) {
            $sql .= ' WHERE ' . $this->ayar['site']['ek_kosul']; // ayarlardan, yönetici yazar
        }
        foreach ($this->db->query($sql) as $r) {
            $anahtar = (string) $r['ft_anahtar'];
            if ($anahtar === '') {
                continue;
            }
            $this->site[$anahtar] = $r;
            if (($b = ft_barkod($r['ft_barkod'] ?? null)) !== '') {
                $this->barkodIndeks[$b] = $anahtar;
            }
            $this->skuIndeks[ft_sku($anahtar)] = $anahtar;
        }
        Gunluk::yaz(count($this->site) . ' site ürünü okundu');
    }

    private function site_guncelle(string $anahtar, array $degerler): void
    {
        if (!$degerler) {
            return;
        }
        $set = [];
        $param = [];
        foreach ($degerler as $k => $v) {
            $set[] = ft_ad((string) $this->alan($k)) . ' = ?';
            $param[] = $v;
        }
        $param[] = $anahtar;
        $this->yaz('UPDATE ' . ft_ad((string) $this->ayar['site']['tablo']) . ' SET ' . implode(', ', $set)
            . ' WHERE ' . ft_ad((string) $this->alan('anahtar')) . ' = ?', $param);
    }

    // ------------------------------------------------------------ tedarikçi

    private function tedarikci_olustur(string $kod, array $t): Tedarikci
    {
        $sinif = $t['sinif'] ?? match ($t['tip'] ?? '') {
            'json' => 'JsonApiTedarikci',
            'xml' => 'XmlFeedTedarikci',
            'csv' => 'CsvTedarikci',
            default => throw new RuntimeException("Bilinmeyen tedarikçi tipi: " . ($t['tip'] ?? '')),
        };
        if (!class_exists($sinif)) {
            $dosya = dirname(__DIR__) . "/tedarikci/{$sinif}.php";
            if (is_file($dosya)) {
                require_once $dosya;
            }
        }
        $nesne = new $sinif($kod, $t);
        if (!$nesne instanceof Tedarikci) {
            throw new RuntimeException("{$sinif} Tedarikci arayüzünü uygulamıyor");
        }
        return $nesne;
    }

    /** @return array<string, array{durum:string, urunler:array, onceki_gorsel:array, oncelik:int}> */
    private function tedarikcileri_cek(): array
    {
        $sonuc = [];
        $eskiSaat = (float) ($this->ayar['kurallar']['eski_veri_saat'] ?? 6);
        $oran = (float) ($this->ayar['kurallar']['min_urun_orani'] ?? 0.5);
        $durumlar = $this->tablo_haritasi('SELECT * FROM ft_tedarikci_durum', 'tedarikci');

        foreach (($this->ayar['tedarikciler'] ?? []) as $kod => $t) {
            if (isset($t['aktif']) && !$t['aktif']) {
                continue;
            }
            $kod = (string) $kod;
            $t1 = microtime(true);
            $onceki = $durumlar[$kod] ?? null;
            $rapor = [
                'kod' => $kod, 'ad' => (string) ($t['ad'] ?? $kod), 'tip' => (string) ($t['tip'] ?? ''),
                'durum' => 'ok', 'hata' => null, 'uyarilar' => [], 'urun_sayisi' => 0, 'eslesen' => 0,
                'son_deneme' => ft_simdi(), 'son_basari' => $onceki['son_basari'] ?? null, 'sure_ms' => 0,
                'para_birimleri' => [],
            ];
            $oncekiGorsel = [];
            foreach ($this->db->query('SELECT sku, gorsel_url FROM ft_tedarikci_urun WHERE tedarikci = ' . $this->db->quote($kod)) as $r) {
                $oncekiGorsel[$r['sku']] = (string) $r['gorsel_url'];
            }
            try {
                $nesne = $this->tedarikci_olustur($kod, $t);
                $urunler = $nesne->urunleri_getir();
                $rapor['uyarilar'] = $nesne->uyarilar();
                $oncekiSayi = (int) ($onceki['urun_sayisi'] ?? 0);
                if (count($urunler) === 0) {
                    throw new RuntimeException('Tedarikçi boş liste döndürdü');
                }
                if ($oncekiSayi >= 20 && count($urunler) < $oncekiSayi * $oran) {
                    throw new RuntimeException("Ürün sayısı şüpheli düştü ({$oncekiSayi} → " . count($urunler) . '); eksik liste olabilir, uygulanmadı');
                }
                $this->anlik_kaydet($kod, $urunler);
                $rapor['urun_sayisi'] = count($urunler);
                $rapor['son_basari'] = ft_simdi();
                $sonuc[$kod] = ['durum' => 'ok', 'urunler' => $urunler];
                Gunluk::yaz("{$rapor['ad']}: " . count($urunler) . ' ürün çekildi' . ($rapor['uyarilar'] ? ' (' . implode('; ', $rapor['uyarilar']) . ')' : ''));
            } catch (Throwable $e) {
                $rapor['hata'] = $e->getMessage();
                $eski = $this->anlik_oku($kod);
                $taze = $onceki && $onceki['son_basari'] && strtotime((string) $onceki['son_basari']) >= time() - (int) ($eskiSaat * 3600);
                $rapor['durum'] = $eski && $taze ? 'onbellek' : 'belirsiz';
                $rapor['urun_sayisi'] = count($eski);
                $sonuc[$kod] = ['durum' => $rapor['durum'], 'urunler' => $eski];
                Gunluk::yaz("{$rapor['ad']} ATLANDI: {$e->getMessage()} — " . ($rapor['durum'] === 'onbellek'
                    ? 'son başarılı veri (' . $onceki['son_basari'] . ') kullanılıyor'
                    : 'veri eski/yok; bu tedarikçinin ürünlerinde stok/pasif işlemi yapılmayacak'), 'HATA');
            }
            $sonuc[$kod]['onceki_gorsel'] = $oncekiGorsel;
            $sonuc[$kod]['oncelik'] = (int) ($t['oncelik'] ?? 100);
            $rapor['sure_ms'] = (int) round((microtime(true) - $t1) * 1000);
            $rapor['para_birimleri'] = array_values(array_unique(array_column($sonuc[$kod]['urunler'], 'para_birimi')));
            $this->tedarikci_durum_yaz($rapor, $onceki !== null);
            $this->tedarikciRapor[$kod] = $rapor;
        }
        return $sonuc;
    }

    private function anlik_kaydet(string $kod, array $urunler): void
    {
        if ($this->kuru) {
            return;
        }
        $simdi = ft_simdi();
        $this->db->beginTransaction();
        try {
            $this->db->prepare('DELETE FROM ft_tedarikci_urun WHERE tedarikci = ?')->execute([$kod]);
            $ekle = $this->db->prepare('INSERT INTO ft_tedarikci_urun (tedarikci, sku, barkod, ad, alis_fiyati, para_birimi, stok, gorsel_url, kategori, guncellendi) VALUES (?,?,?,?,?,?,?,?,?,?)');
            $gorulen = [];
            foreach ($urunler as $u) {
                if (isset($gorulen[$u['sku']])) {
                    continue; // aynı SKU iki kez gelirse ilkini tut
                }
                $gorulen[$u['sku']] = true;
                $ekle->execute([$kod, $u['sku'], $u['barkod'], mb_substr($u['ad'], 0, 255), $u['alis_fiyati'], $u['para_birimi'], $u['stok'], $u['gorsel_url'], $u['kategori'], $simdi]);
            }
            $this->db->commit();
        } catch (Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    private function anlik_oku(string $kod): array
    {
        $st = $this->db->prepare('SELECT sku, barkod, ad, alis_fiyati, para_birimi, stok, gorsel_url, kategori FROM ft_tedarikci_urun WHERE tedarikci = ?');
        $st->execute([$kod]);
        $l = [];
        foreach ($st as $r) {
            $r['alis_fiyati'] = (float) $r['alis_fiyati'];
            $r['stok'] = (int) $r['stok'];
            $r['barkod'] = (string) $r['barkod'];
            $r['gorsel_url'] = (string) $r['gorsel_url'];
            $r['kategori'] = (string) $r['kategori'];
            $l[] = $r;
        }
        return $l;
    }

    private function tedarikci_durum_yaz(array $r, bool $var): void
    {
        $p = [$r['son_deneme'], $r['son_basari'], $r['urun_sayisi'], $r['durum'], $r['hata'], implode(' | ', $r['uyarilar']), $r['sure_ms'], $r['kod']];
        if ($var) {
            $this->yaz('UPDATE ft_tedarikci_durum SET son_deneme=?, son_basari=?, urun_sayisi=?, durum=?, hata=?, uyari=?, sure_ms=? WHERE tedarikci=?', $p);
        } else {
            $this->yaz('INSERT INTO ft_tedarikci_durum (son_deneme, son_basari, urun_sayisi, durum, hata, uyari, sure_ms, tedarikci) VALUES (?,?,?,?,?,?,?,?)', $p);
        }
    }

    // --------------------------------------------------------------- eşleme

    /** @return array<string, list<array>> site anahtarı => aday tedarikçi ürünleri */
    private function eslestir(array $tedVeri): array
    {
        $elle = [];
        foreach ($this->db->query('SELECT tedarikci, tedarikci_sku, urun_anahtar FROM ft_eslesme') as $r) {
            $elle[$r['tedarikci']][ft_sku($r['tedarikci_sku'])] = (string) $r['urun_anahtar'];
        }
        $adaylar = [];
        foreach ($tedVeri as $kod => $v) {
            $gorulen = [];
            foreach ($v['urunler'] as $u) {
                $sku = ft_sku($u['sku']);
                $anahtar = $elle[$kod][$sku]
                    ?? ($u['barkod'] !== '' ? ($this->barkodIndeks[$u['barkod']] ?? null) : null)
                    ?? $this->skuIndeks[$sku]
                    ?? null;
                if ($anahtar === null || !isset($this->site[$anahtar])) {
                    $this->sayac['eslesmeyen_tedarikci_urunu']++;
                    continue;
                }
                if (isset($gorulen[$anahtar])) {
                    continue; // aynı tedarikçide aynı ürüne iki satır: ilki
                }
                $gorulen[$anahtar] = true;
                $u['tedarikci'] = $kod;
                $u['guvenilir'] = $v['durum'] !== 'belirsiz';
                $u['oncelik'] = $v['oncelik'];
                $adaylar[$anahtar][] = $u;
                $this->tedarikciRapor[$kod]['eslesen']++;
            }
        }
        return $adaylar;
    }

    // ---------------------------------------------------------- ürün işleme

    private function urun_isle(string $anahtar, array $liste, array $tedVeri, ?array $durum, ?array $onay, array $kural): void
    {
        $s = $this->site[$anahtar];
        $this->sayac['islenen_urun']++;
        $ad = (string) ($s['ft_ad'] ?? $anahtar);
        $minStok = (int) ($kural['min_stok'] ?? 1);
        $aktifDeger = $this->ayar['site']['aktif_degeri'] ?? 1;
        $pasifDeger = $this->ayar['site']['pasif_degeri'] ?? 0;

        $belirsiz = false;
        $gecerli = [];
        foreach ($liste as $u) {
            if (!$u['guvenilir']) {
                $belirsiz = true;
                continue;
            }
            try {
                $u['kur'] = $this->doviz->kur($u['para_birimi']);
            } catch (Throwable $e) {
                $belirsiz = true;
                continue;
            }
            $u['alis_tl'] = round($u['alis_fiyati'] * $u['kur'], 4);
            $gecerli[] = $u;
        }
        $stoklu = array_values(array_filter($gecerli, fn($u) => $u['stok'] >= $minStok));
        usort($stoklu, fn($a, $b) => [$a['alis_tl'], $a['oncelik']] <=> [$b['alis_tl'], $b['oncelik']]);
        $sec = $stoklu[0] ?? null;

        $eskiFiyat = (float) ($s['ft_fiyat'] ?? 0);
        $eskiStok = (int) ($s['ft_stok'] ?? 0);
        $eskiAktif = $this->alan('durum') ? ((string) $s['ft_durum'] === (string) $aktifDeger) : true;
        $bizcePasif = (bool) ($durum['bizce_pasif'] ?? false);
        $guncelle = [];
        $hesap = null;

        if ($sec === null && $belirsiz) {
            // Stoklu kaynak yok ama bir tedarikçinin durumu bilinmiyor: dokunma.
            $this->sayac['belirsiz_atlanan']++;
            $this->urun_rapor_ekle($anahtar, $s, null, null, $gecerli, 'belirsiz');
            return;
        }

        if ($sec !== null) {
            $kategori = (string) (($s['ft_kategori'] ?? '') !== '' ? $s['ft_kategori'] : $sec['kategori']);
            $hesap = $this->fiyatlama->satis_fiyati($sec['alis_tl'], $sec['tedarikci'], $kategori);
            $hesap['kategori'] = $kategori;
            if ($hesap['marj_korundu']) {
                $this->sayac['marj_korundu']++;
            }
            $yeniFiyat = $hesap['fiyat'];
            $yeniStok = ($kural['stok_modu'] ?? 'secilen') === 'toplam' ? array_sum(array_column($stoklu, 'stok')) : $sec['stok'];

            // --- fiyat
            $fark = abs($yeniFiyat - $eskiFiyat) >= 0.01;
            $yuzde = ft_yuzde($eskiFiyat, $yeniFiyat);
            $zamEsik = (float) ($kural['buyuk_zam_esigi'] ?? 25);
            $indEsik = (float) ($kural['buyuk_indirim_esigi'] ?? 40);
            $buyuk = $fark && $yuzde !== null && ($yuzde >= $zamEsik || $yuzde <= -$indEsik);
            if ($buyuk) {
                $this->onaya_dusur($anahtar, $ad, $sec, $eskiFiyat, $yeniFiyat, $yuzde, $onay);
            } else {
                if ($fark) {
                    $guncelle['fiyat'] = $yeniFiyat;
                    $this->sayac['fiyat_degisen']++;
                    $this->sayac[$yeniFiyat > $eskiFiyat ? 'zam' : 'indirim']++;
                    $this->degisiklik($anahtar, $ad, $sec['tedarikci'], 'fiyat', $yeniFiyat > $eskiFiyat ? 'zam' : 'indirim', $eskiFiyat, $yeniFiyat, $yuzde,
                        sprintf('alış %s %s → kural %s', $this->para($sec['alis_fiyati']), $sec['para_birimi'], $hesap['kural']) . ($hesap['marj_korundu'] ? ' (min. marj uygulandı)' : ''));
                }
                if ($onay && $onay['durum'] === 'bekliyor') {
                    $this->yaz("UPDATE ft_onay SET durum='iptal', karar_tarihi=?, karar_notu=? WHERE id=?", [ft_simdi(), 'Otomatik: fiyat normal aralığa döndü', $onay['id']]);
                }
            }
            if ($this->alan('alis')) {
                $guncelle['alis'] = round($sec['alis_tl'], 2);
            }

            // --- tekrar aktif et (yalnızca bizim pasife aldıklarımız)
            if ($this->alan('durum') && !$eskiAktif && $bizcePasif && ($kural['geri_gelince_aktif'] ?? true)) {
                $guncelle['durum'] = $aktifDeger;
                $bizcePasif = false;
                $this->sayac['aktife_alinan']++;
                $this->degisiklik($anahtar, $ad, $sec['tedarikci'], 'durum', 'aktif', 0, 1, null, 'Stok geldi, ürün yeniden yayında');
            }

            // --- görsel
            if (($kural['gorsel_guncelle'] ?? true) && $this->alan('gorsel') && $sec['gorsel_url'] !== '') {
                $mevcut = (string) ($s['ft_gorsel'] ?? '');
                $onceki = $tedVeri[$sec['tedarikci']]['onceki_gorsel'][$sec['sku']] ?? null;
                $tedarikciDegistirdi = $onceki !== null && $onceki !== '' && $onceki !== $sec['gorsel_url'];
                if ($mevcut !== $sec['gorsel_url'] && ($mevcut === '' || $tedarikciDegistirdi)) {
                    $guncelle['gorsel'] = $sec['gorsel_url'];
                    $this->sayac['gorsel_guncellenen']++;
                    $this->degisiklik($anahtar, $ad, $sec['tedarikci'], 'gorsel', 'gorsel', null, null, null, $mevcut === '' ? 'Eksik görsel eklendi' : 'Tedarikçi görseli yeniledi', $mevcut, $sec['gorsel_url']);
                }
            }

            // --- tedarikçi değişimi
            if ($durum && $durum['secili_tedarikci'] && $durum['secili_tedarikci'] !== $sec['tedarikci']) {
                $this->sayac['tedarikci_degisen']++;
                $this->degisiklik($anahtar, $ad, $sec['tedarikci'], 'tedarikci', 'tedarikci', null, null, null,
                    $this->ted_ad($durum['secili_tedarikci']) . ' → ' . $this->ted_ad($sec['tedarikci']) . ' (en uygun stoklu kaynak)', $durum['secili_tedarikci'], $sec['tedarikci']);
            }
        } else {
            // Hiçbir tedarikçide stok yok (ve tüm tedarikçilerden emin veri var).
            $yeniStok = 0;
            if ($this->alan('durum') && $eskiAktif && ($kural['stoku_bitince_pasif'] ?? true)) {
                $guncelle['durum'] = $pasifDeger;
                $bizcePasif = true;
                $this->sayac['pasife_alinan']++;
                $this->degisiklik($anahtar, $ad, $liste[0]['tedarikci'], 'durum', 'pasif', 1, 0, null, 'Tüm tedarikçilerde stok bitti, ürün pasife alındı');
            }
        }

        // --- stok
        if ($this->alan('stok') && $yeniStok !== $eskiStok) {
            $guncelle['stok'] = $yeniStok;
            $this->sayac['stok_degisen']++;
            $tur = $yeniStok === 0 ? 'stok_bitti' : ($eskiStok === 0 ? 'stok_geldi' : 'stok');
            if ($tur === 'stok_bitti') {
                $this->sayac['stok_biten']++;
            } elseif ($tur === 'stok_geldi') {
                $this->sayac['stok_gelen']++;
            }
            $this->degisiklik($anahtar, $ad, $sec['tedarikci'] ?? $liste[0]['tedarikci'], 'stok', $tur, $eskiStok, $yeniStok, null, null);
        }

        $this->site_guncelle($anahtar, $guncelle);
        $this->urun_durum_yaz($anahtar, $sec, $bizcePasif, $durum !== null);
        $this->urun_rapor_ekle($anahtar, $s, $sec, $hesap, $gecerli, 'ok', $guncelle);
    }

    private function onaya_dusur(string $anahtar, string $ad, array $sec, float $eski, float $yeni, float $yuzde, ?array $onay): void
    {
        if ($onay && abs((float) $onay['yeni_fiyat'] - $yeni) < 0.01) {
            if ($onay['durum'] === 'bekliyor') {
                $this->sayac['onaya_dusen']++; // hâlâ bekliyor, tekrar bildirme
            }
            return; // reddedilmiş aynı fiyat: tekrar sorma
        }
        $this->sayac['onaya_dusen']++;
        if ($onay && $onay['durum'] === 'bekliyor') {
            $this->yaz('UPDATE ft_onay SET yeni_fiyat=?, yuzde=?, alis_tl=?, tedarikci=?, eski_fiyat=?, olusturma=? WHERE id=?',
                [$yeni, $yuzde, round($sec['alis_tl'], 2), $sec['tedarikci'], $eski, ft_simdi(), $onay['id']]);
        } else {
            $this->yaz("INSERT INTO ft_onay (urun_anahtar, urun_adi, tedarikci, eski_fiyat, yeni_fiyat, yuzde, alis_tl, durum, olusturma) VALUES (?,?,?,?,?,?,?, 'bekliyor', ?)",
                [$anahtar, $ad, $sec['tedarikci'], $eski, $yeni, $yuzde, round($sec['alis_tl'], 2), ft_simdi()]);
        }
        $tur = $yuzde > 0 ? 'zam' : 'indirim';
        $this->degisiklik($anahtar, $ad, $sec['tedarikci'], 'fiyat', 'onay', $eski, $yeni, $yuzde,
            sprintf('Büyük %s (%%%s) — fiyat yazılmadı, onay bekliyor', $tur, $this->para(abs($yuzde))));
        $this->bildirim->ekle(sprintf('ONAY: %s (%s) %s → %s TL (%+.1f%%) — %s', $ad, $anahtar, $this->para($eski), $this->para($yeni), $yuzde, $this->ted_ad($sec['tedarikci'])));
    }

    private function urun_durum_yaz(string $anahtar, ?array $sec, bool $bizcePasif, bool $var): void
    {
        $p = [$sec['tedarikci'] ?? null, $sec ? round($sec['alis_tl'], 4) : null, $bizcePasif ? 1 : 0, ft_simdi(), $anahtar];
        if ($var) {
            // Stok yoksa son seçili tedarikçi bilgisini koru.
            $this->yaz('UPDATE ft_urun_durum SET secili_tedarikci=COALESCE(?, secili_tedarikci), alis_tl=COALESCE(?, alis_tl), bizce_pasif=?, guncellendi=? WHERE urun_anahtar=?', $p);
        } else {
            $this->yaz('INSERT INTO ft_urun_durum (secili_tedarikci, alis_tl, bizce_pasif, guncellendi, urun_anahtar) VALUES (?,?,?,?,?)', $p);
        }
    }

    // ---------------------------------------------------------- yardımcılar

    private function degisiklik(string $anahtar, string $ad, string $ted, string $alan, string $tur, float|int|null $eski, float|int|null $yeni, ?float $yuzde, ?string $not, ?string $eskiMetin = null, ?string $yeniMetin = null): void
    {
        $kayit = [
            'urun' => $anahtar, 'ad' => $ad, 'tedarikci' => $ted, 'alan' => $alan, 'tur' => $tur,
            'eski' => $eskiMetin ?? ($eski === null ? null : (string) $eski),
            'yeni' => $yeniMetin ?? ($yeni === null ? null : (string) $yeni),
            'yuzde' => $yuzde, 'not' => $not,
        ];
        $this->degisiklikler[] = $kayit;
        $this->yaz('INSERT INTO ft_degisiklik (calisma_id, tarih, urun_anahtar, urun_adi, tedarikci, alan, tur, eski_deger, yeni_deger, yuzde, aciklama) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [$this->calismaId, ft_simdi(), $anahtar, mb_substr($ad, 0, 255), $ted, $alan, $tur, $kayit['eski'], $kayit['yeni'], $yuzde, $not]);
    }

    private function urun_rapor_ekle(string $anahtar, array $s, ?array $sec, ?array $hesap, array $gecerli, string $durum, array $guncelle = []): void
    {
        $aktifDeger = $this->ayar['site']['aktif_degeri'] ?? 1;
        $this->urunRapor[] = [
            'anahtar' => $anahtar,
            'ad' => (string) ($s['ft_ad'] ?? $anahtar),
            'kategori' => $hesap['kategori'] ?? (string) ($s['ft_kategori'] ?? ''),
            'tedarikci' => $sec['tedarikci'] ?? null,
            'pb' => $sec['para_birimi'] ?? null,
            'alis' => $sec['alis_fiyati'] ?? null,
            'alis_tl' => $sec ? round($sec['alis_tl'], 2) : null,
            'eski_fiyat' => (float) ($s['ft_fiyat'] ?? 0),
            'fiyat' => (float) ($guncelle['fiyat'] ?? $s['ft_fiyat'] ?? 0),
            'hesaplanan' => $hesap['fiyat'] ?? null,
            'kural' => $hesap['kural'] ?? null,
            'stok' => (int) ($guncelle['stok'] ?? $s['ft_stok'] ?? 0),
            'aktif' => (string) ($guncelle['durum'] ?? $s['ft_durum'] ?? $aktifDeger) === (string) $aktifDeger,
            'aday_sayisi' => count($gecerli),
            'adaylar' => array_map(fn($u) => ['t' => $u['tedarikci'], 'tl' => round($u['alis_tl'], 2), 'stok' => $u['stok']], $gecerli),
            'durum' => $durum,
        ];
    }

    private function calisma_bitir(float $t0, string $durum, ?string $hata, ?string $baslangic = null): array
    {
        $bitis = ft_simdi();
        $ozet = $this->sayac + [
            'tedarikci_sayisi' => count($this->tedarikciRapor),
            'tedarikci_hatali' => count(array_filter($this->tedarikciRapor, fn($t) => $t['durum'] !== 'ok')),
        ];
        $this->yaz('UPDATE ft_calisma SET bitis=?, durum=?, hata=?, ozet=? WHERE id=?',
            [$bitis, $durum, $hata, json_encode($ozet, JSON_UNESCAPED_UNICODE), $this->calismaId]);

        $bekleyen = [];
        foreach ($this->db->query("SELECT * FROM ft_onay WHERE durum='bekliyor' ORDER BY yuzde DESC") as $r) {
            $bekleyen[] = [
                'id' => (int) $r['id'], 'urun' => $r['urun_anahtar'], 'ad' => $r['urun_adi'], 'tedarikci' => $r['tedarikci'],
                'eski' => (float) $r['eski_fiyat'], 'yeni' => (float) $r['yeni_fiyat'], 'yuzde' => (float) $r['yuzde'],
                'alis_tl' => (float) $r['alis_tl'], 'tarih' => $r['olusturma'],
            ];
        }
        $ozet['onay_bekleyen'] = count($bekleyen);

        $rapor = [
            'surum' => 1,
            'calisma' => [
                'id' => $this->calismaId, 'baslangic' => $baslangic, 'bitis' => $bitis,
                'sure_sn' => round(microtime(true) - $t0, 2), 'durum' => $durum, 'kuru' => $this->kuru, 'hata' => $hata,
            ],
            'ozet' => $ozet,
            'kur' => $this->doviz->ozet(),
            'kar' => $this->ayar['kar'] ?? [],
            'esikler' => [
                'zam' => (float) ($this->ayar['kurallar']['buyuk_zam_esigi'] ?? 25),
                'indirim' => (float) ($this->ayar['kurallar']['buyuk_indirim_esigi'] ?? 40),
            ],
            'tedarikciler' => array_values($this->tedarikciRapor),
            'degisiklikler' => $this->degisiklikler,
            'onaylar' => $bekleyen,
            'urunler' => $this->urunRapor,
        ];
        $this->rapor_yaz($rapor);
        return $rapor;
    }

    private function rapor_yaz(array $rapor): void
    {
        $dosya = $this->ayar['rapor_dosyasi'] ?? null;
        if (!$dosya) {
            return;
        }
        $json = json_encode($rapor, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_PRESERVE_ZERO_FRACTION);
        $icerik = str_ends_with((string) $dosya, '.js') ? "window.FT_RAPOR = {$json};\n" : $json;
        @file_put_contents((string) $dosya, $icerik, LOCK_EX);
    }

    private function tablo_haritasi(string $sql, string $anahtar): array
    {
        $h = [];
        foreach ($this->db->query($sql) as $r) {
            $h[(string) $r[$anahtar]] = $r;
        }
        return $h;
    }

    private function yaz(string $sql, array $param): void
    {
        if ($this->kuru) {
            return;
        }
        $this->db->prepare($sql)->execute($param);
    }

    private function ted_ad(string $kod): string
    {
        return (string) ($this->ayar['tedarikciler'][$kod]['ad'] ?? $kod);
    }

    private function para(float $f): string
    {
        return number_format($f, 2, ',', '.');
    }
}
