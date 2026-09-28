<?php
declare(strict_types=1);

/**
 * Testler: birim (sayı çözme, yuvarlama, kural önceliği, min. marj) + uçtan uca
 * (senkron.php, kuru çalışma, kilit, onay.php, tekrar çalıştırma, belirsiz veri koruması).
 *
 *   php test/testler.php
 */
require dirname(__DIR__) . '/lib/yukle.php';
require __DIR__ . '/sqlite.php';
date_default_timezone_set('Europe/Istanbul');

$gecti = 0;
$kaldi = 0;
function esit(mixed $beklenen, mixed $gercek, string $ad): void
{
    global $gecti, $kaldi;
    if ($beklenen === $gercek || (is_float($beklenen) && is_float($gercek) && abs($beklenen - $gercek) < 0.001)) {
        $gecti++;
    } else {
        $kaldi++;
        echo "KALDI: {$ad}\n  beklenen: " . var_export($beklenen, true) . "\n  gelen:    " . var_export($gercek, true) . "\n";
    }
}

// ------------------------------------------------------------ birim
esit(1234.56, ft_sayi('1.234,56'), 'TR sayı');
esit(1234.56, ft_sayi('1,234.56'), 'EN sayı');
esit(1234.56, ft_sayi('₺1234.56'), 'simge');
esit(12.5, ft_sayi('12,5'), 'virgül ondalık');
esit(1234567.0, ft_sayi('1.234.567'), 'çoklu nokta binlik');
esit(null, ft_sayi(''), 'boş');
esit(null, ft_sayi('yok'), 'metin');
esit(50, ft_stok('50+'), 'stok 50+');
esit(0, ft_stok('Yok'), 'stok yok');
esit(5, ft_stok('Var'), 'stok var');
esit(12, ft_stok('12 adet'), 'stok adet');
esit(0, ft_stok(-3), 'negatif stok');
esit('ATEV1001', ft_sku(' at-ev 1001 '), 'sku normal');
esit('', ft_barkod('123'), 'kısa barkod geçersiz');
esit('TRY', ft_para_birimi('TL'), 'TL->TRY');
esit('USD', ft_para_birimi('$'), '$->USD');

$kar = [
    'varsayilan' => ['yuzde' => 30, 'sabit' => 20],
    'tedarikci' => ['global' => ['yuzde' => 35, 'sabit' => 25]],
    'kategori' => ['Bilgisayar' => ['yuzde' => 22, 'sabit' => 30], 'Ucuz' => ['yuzde' => 2, 'sabit' => 0]],
    'tedarikci_kategori' => ['global' => ['Bilgisayar' => ['yuzde' => 18, 'sabit' => 0]]],
    'min_marj' => 12, 'kdv' => 20,
    'yuvarlama' => [['alt' => 0, 'adim' => 1, 'son' => 0.90], ['alt' => 100, 'adim' => 10, 'son' => 9.90]],
];
$f = new Fiyatlama($kar);
esit(87.9, $f->yuvarla(87.2), 'yuvarla 87,20');
esit(1249.9, $f->yuvarla(1243.17), 'yuvarla 1243,17');
esit(1249.9, $f->yuvarla(1249.9), 'yuvarla tam sınır');
esit(1259.9, $f->yuvarla(1249.91), 'yuvarla sınır üstü');
esit(5.9, $f->yuvarla(5.0), 'yuvarla küçük');
esit('tedarikci_kategori:global/Bilgisayar', $f->kural('global', 'Bilgisayar')['kaynak'], 'öncelik ted+kat');
esit('kategori:Bilgisayar', $f->kural('ege', 'Bilgisayar')['kaynak'], 'öncelik kategori');
esit('tedarikci:global', $f->kural('global', 'Ev')['kaynak'], 'öncelik tedarikçi');
esit('varsayilan', $f->kural('ege', 'Ev')['kaynak'], 'varsayılan');
// 920,75 × 1,30 + 20 = 1216,975 × 1,20 = 1460,37 -> 1469,90
esit(1469.9, $f->satis_fiyati(920.75, 'anadolu', 'Ev')['fiyat'], 'satış hesabı');
// Min. marj: kural %2 ama min %12: 100 × 1,12 × 1,2 = 134,4 -> 139,90
$h = $f->satis_fiyati(100, 'x', 'Ucuz');
esit(139.9, $h['fiyat'], 'min marj fiyat');
esit(true, $h['marj_korundu'], 'min marj bayrağı');

// -------------------------------------------------------- uçtan uca
$tmp = sys_get_temp_dir();
$dbYolu = $tmp . '/ft-test.sqlite';
$db = ft_test_db($dbYolu);
$raporYolu = $tmp . '/ft-test-rapor.json';

function senkron(string $veri, string $hatali = '', string $ek = ''): array
{
    global $dbYolu, $raporYolu;
    putenv("FT_DB={$dbYolu}");
    putenv("FT_VERI={$veri}");
    putenv("FT_HATALI={$hatali}");
    putenv("FT_RAPOR={$raporYolu}");
    putenv('FT_AYAR=' . __DIR__ . '/ayarlar.demo.php');
    if (is_file($raporYolu)) {
        unlink($raporYolu);
    }
    exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(dirname(__DIR__) . '/senkron.php') . ' --sessiz --ayar=' . escapeshellarg(__DIR__ . '/ayarlar.demo.php') . " {$ek}", $cikti, $kod);
    $r = is_file($raporYolu) ? json_decode((string) file_get_contents($raporYolu), true) : null;
    return [$kod, $r];
}
function php_calistir(string $betik, string $arg): array
{
    exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($betik) . ' ' . $arg, $c, $k);
    return [$k, implode("\n", $c)];
}
function site(PDO $db, string $sku): array
{
    $s = $db->prepare('SELECT * FROM urunler WHERE stok_kodu = ?');
    $s->execute([$sku]);
    return $s->fetch();
}
function ozet_hash(PDO $db): string
{
    return md5(json_encode($db->query('SELECT stok_kodu, fiyat, stok, aktif, resim FROM urunler ORDER BY stok_kodu')->fetchAll()));
}

// 1) Kuru çalışma hiçbir şey yazmamalı
$h0 = ozet_hash($db);
[$k, $r] = senkron('ilk', '', '--kuru');
esit(0, $k, 'kuru çıkış kodu');
esit($h0, ozet_hash($db), 'kuru çalışma site tablosunu değiştirmedi');
esit(0, (int) $db->query('SELECT COUNT(*) FROM ft_degisiklik')->fetchColumn(), 'kuru: günlük boş');
esit(true, $r['ozet']['fiyat_degisen'] > 0, 'kuru: yine de değişiklik hesapladı');

// 2) İlk gerçek tur
[$k, $r] = senkron('ilk');
esit(0, $k, 'ilk tur çıkış');
esit(4, $r['ozet']['tedarikci_sayisi'], '4 tedarikçi');
esit(0, $r['ozet']['tedarikci_hatali'], 'ilk turda hata yok');
esit(1, $r['ozet']['eslesmeyen_tedarikci_urunu'], 'yoğurt makinesi eşleşmedi');
esit(['2 kayıt atlandı (kod ya da fiyat eksik/geçersiz)'], $r['tedarikciler'][3]['uyarilar'], 'hatalı satırlar atlandı');
// BL-3005 Global'de barkodsuz: SKU öneki silinip eşlendi mi?
$bl = array_values(array_filter($r['urunler'], fn($u) => $u['anahtar'] === 'BL-3005'))[0];
esit(true, in_array('global', array_column($bl['adaylar'], 't'), true), 'barkodsuz ürün SKU ile eşlendi');
// En ucuz stoklu seçildi mi?
foreach ($r['urunler'] as $u) {
    $stoklu = array_filter($u['adaylar'], fn($a) => $a['stok'] >= 1);
    if ($stoklu && $u['tedarikci'] !== null) {
        esit(min(array_column($stoklu, 'tl')), $u['alis_tl'], "en ucuz stoklu: {$u['anahtar']}");
    }
}
esit('0', (string) site($db, 'YS-5004')['aktif'], 'stok 0 -> pasif');
esit(1, (int) $db->query("SELECT bizce_pasif FROM ft_urun_durum WHERE urun_anahtar='YS-5004'")->fetchColumn(), 'bizce_pasif işaretlendi');
esit('https://cdn.anadolutoptan.example/urun/ev-1001.jpg', site($db, 'EV-1001')['resim'], 'boş görsel dolduruldu');
esit('/resimler/ev-1002.jpg', site($db, 'EV-1002')['resim'], 'mağazanın kendi görseli ezilmedi');

// 3) Aynı veriyle tekrar: hiçbir şey değişmemeli (idempotent)
[$k, $r] = senkron('ilk');
esit(0, $r['ozet']['fiyat_degisen'] + $r['ozet']['stok_degisen'] + $r['ozet']['gorsel_guncellenen'], 'tekrar çalıştırma: değişiklik yok');

// 4) Güncel veri + Marmara erişilemez
$elleKapali = $db->exec("UPDATE urunler SET aktif=0 WHERE stok_kodu='KB-4001'"); // mağaza sahibi elle kapattı
[$k, $r] = senkron('guncel', 'marmara');
esit(0, $k, 'hatalı tedarikçiye rağmen çıkış 0');
esit('onbellek', $r['tedarikciler'][2]['durum'], 'marmara önbellekten');
esit(true, str_contains((string) $r['tedarikciler'][2]['hata'], 'Bağlantı'), 'hata mesajı kaydedildi');
esit('1', (string) site($db, 'YS-5004')['aktif'], 'stok gelince geri aktif');
esit('0', (string) site($db, 'KB-4001')['aktif'], 'elle kapatılan ürün açılmadı');
esit('0', (string) site($db, 'EV-1003')['aktif'], 'tek tedarikçi stok bitti -> pasif');
esit('ege', $db->query("SELECT secili_tedarikci FROM ft_urun_durum WHERE urun_anahtar='EV-1006'")->fetchColumn(), 'en ucuz tükenince diğerine geçti');
esit('https://cdn.anadolutoptan.example/urun/ev-1001-v2.jpg', site($db, 'EV-1001')['resim'], 'tedarikçi görseli yenilendi');
$onay = $db->query("SELECT * FROM ft_onay WHERE urun_anahtar='EV-1011'")->fetch();
esit('bekliyor', $onay['durum'], 'büyük zam onaya düştü');
esit(true, abs((float) site($db, 'EV-1011')['fiyat'] - (float) $onay['eski_fiyat']) < 0.01, 'büyük zam yazılmadı');

// 5) onay.php: onayla / reddet
[$k, $c] = php_calistir(dirname(__DIR__) . '/onay.php', 'onayla ' . $onay['id']);
esit(0, $k, 'onay.php çıkış');
esit((float) $onay['yeni_fiyat'], (float) site($db, 'EV-1011')['fiyat'], 'onaylanan fiyat yazıldı');
$red = $db->query("SELECT id FROM ft_onay WHERE urun_anahtar='KB-4005' AND durum='bekliyor'")->fetchColumn();
php_calistir(dirname(__DIR__) . '/onay.php', "reddet {$red}");
[$k, $r] = senkron('guncel', 'marmara');
esit(0, (int) $db->query("SELECT COUNT(*) FROM ft_onay WHERE urun_anahtar='KB-4005' AND durum='bekliyor'")->fetchColumn(), 'reddedilen aynı fiyat tekrar sorulmadı');
esit(0, $r['ozet']['fiyat_degisen'], 'güncel veriyle ikinci tur: değişiklik yok');

// 6) Marmara hatalı ve verisi ESKİ: yalnız Marmara'da olan ürünler pasife alınmamalı
$db->exec("UPDATE ft_tedarikci_durum SET son_basari = datetime('now','localtime','-10 hours') WHERE tedarikci='marmara'");
$aktifOnce = site($db, 'TA-2002')['aktif'];
[$k, $r] = senkron('guncel', 'marmara');
esit('belirsiz', $r['tedarikciler'][2]['durum'], 'eski veri -> belirsiz');
esit(true, $r['ozet']['belirsiz_atlanan'] > 0, 'belirsiz ürünler atlandı');
esit($aktifOnce, site($db, 'TA-2002')['aktif'], 'belirsiz üründe durum değişmedi');

// 7) Kilit: başka senkron çalışırken çıkış kodu 2
$kilit = fopen($tmp . '/ft-demo.lock', 'c');
flock($kilit, LOCK_EX);
[$k] = senkron('guncel');
esit(2, $k, 'kilit varken ikinci senkron çalışmadı');
flock($kilit, LOCK_UN);
fclose($kilit);

echo "\n{$gecti} test geçti, {$kaldi} test kaldı.\n";
exit($kaldi ? 1 : 0);
