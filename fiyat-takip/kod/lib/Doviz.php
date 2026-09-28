<?php
declare(strict_types=1);

/**
 * TCMB döviz kurları (https://www.tcmb.gov.tr/kurlar/today.xml).
 * Günde bir kez çekilir, dosyaya önbelleklenir. TCMB'ye ulaşılamazsa son önbellek
 * (en çok 'en_eski_gun' gün eski) kullanılır; o da yoksa döviz fiyatlı ürünler atlanır.
 */
final class Doviz
{
    private ?array $kurlar = null;
    private ?string $tarih = null;
    private ?string $hata = null;

    public function __construct(private array $ayar)
    {
    }

    /** 1 birim döviz = kaç TL. TRY için 1. */
    public function kur(string $pb): float
    {
        if ($pb === 'TRY') {
            return 1.0;
        }
        $this->yukle();
        $sabit = $this->ayar['sabit_kurlar'][$pb] ?? null; // test/elle kur
        if ($sabit !== null) {
            return (float) $sabit;
        }
        if (!isset($this->kurlar[$pb])) {
            throw new RuntimeException("{$pb} kuru alınamadı" . ($this->hata ? " ({$this->hata})" : ''));
        }
        return $this->kurlar[$pb];
    }

    public function ozet(): array
    {
        $this->yukle();
        return ['tarih' => $this->tarih, 'kurlar' => $this->kurlar ?? [], 'tur' => $this->tur(), 'uyari' => $this->hata];
    }

    private function tur(): string
    {
        return (string) ($this->ayar['kur_turu'] ?? 'ForexSelling');
    }

    private function yukle(): void
    {
        if ($this->kurlar !== null) {
            return;
        }
        $onbellek = (string) ($this->ayar['onbellek'] ?? '');
        $eski = null;
        if ($onbellek !== '' && is_file($onbellek)) {
            $eski = json_decode((string) file_get_contents($onbellek), true);
            // Bugün çekilmişse tekrar çekme.
            if (is_array($eski) && ($eski['cekildi'] ?? '') === date('Y-m-d') && !empty($eski['kurlar'])) {
                $this->kurlar = $eski['kurlar'];
                $this->tarih = $eski['tarih'] ?? null;
                return;
            }
        }
        try {
            [$this->kurlar, $this->tarih] = $this->tcmb_cek();
            if ($onbellek !== '') {
                @file_put_contents($onbellek, json_encode(['cekildi' => date('Y-m-d'), 'tarih' => $this->tarih, 'kurlar' => $this->kurlar]), LOCK_EX);
            }
        } catch (Throwable $e) {
            $this->hata = $e->getMessage();
            $enEski = (int) ($this->ayar['en_eski_gun'] ?? 4);
            if (is_array($eski) && !empty($eski['kurlar']) && strtotime((string) $eski['cekildi']) >= strtotime("-{$enEski} days")) {
                $this->kurlar = $eski['kurlar'];
                $this->tarih = $eski['tarih'] ?? null;
                $this->hata .= ' — önbellekteki kur kullanıldı';
            } else {
                $this->kurlar = [];
            }
            Gunluk::yaz('Kur uyarısı: ' . $this->hata, 'UYARI');
        }
    }

    /** @return array{0: array<string,float>, 1: ?string} */
    private function tcmb_cek(): array
    {
        $kaynak = (string) ($this->ayar['kaynak'] ?? 'https://www.tcmb.gov.tr/kurlar/today.xml');
        if (preg_match('#^https?://#i', $kaynak)) {
            $baglam = stream_context_create(['http' => ['timeout' => 15, 'user_agent' => 'FiyatTakip/1.0']]);
            $govde = @file_get_contents($kaynak, false, $baglam);
        } else {
            $yol = preg_match('#^([A-Za-z]:[\\\\/]|/)#', $kaynak) ? $kaynak : dirname(__DIR__) . '/' . $kaynak;
            $govde = @file_get_contents($yol);
        }
        if ($govde === false || $govde === '') {
            throw new RuntimeException('TCMB kurlarına ulaşılamadı');
        }
        $onceki = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($govde, SimpleXMLElement::class, LIBXML_NONET);
        libxml_use_internal_errors($onceki);
        if ($xml === false) {
            throw new RuntimeException('TCMB XML çözülemedi');
        }
        $tur = $this->tur();
        $kurlar = [];
        foreach ($xml->Currency as $c) {
            $kod = (string) $c['Kod'];
            $birim = max(1, (int) $c->Unit);
            $deger = ft_sayi((string) $c->{$tur});
            if ($kod !== '' && $deger) {
                $kurlar[$kod] = round($deger / $birim, 6);
            }
        }
        if (!$kurlar) {
            throw new RuntimeException('TCMB XML içinde kur bulunamadı');
        }
        return [$kurlar, (string) ($xml['Tarih'] ?? '')];
    }
}
