<?php
declare(strict_types=1);

/**
 * Tüm tedarikçi adaptörlerinin ortak arayüzü.
 *
 * urunleri_getir() her ürün için şu alanları döndürür:
 *   sku, barkod, ad, alis_fiyati (float), stok (int), gorsel_url, para_birimi (TRY/USD/EUR...)
 *   (+ isteğe bağlı: kategori)
 * Hata olursa istisna (Exception) fırlatmalıdır; senkron o tedarikçiyi atlar, diğerlerine devam eder.
 */
interface Tedarikci
{
    public function kod(): string;

    public function ad(): string;

    /** @return list<array{sku:string, barkod:string, ad:string, alis_fiyati:float, stok:int, gorsel_url:string, para_birimi:string, kategori:string}> */
    public function urunleri_getir(): array;

    /** Son çekimde atlanan hatalı satırlarla ilgili uyarılar. */
    public function uyarilar(): array;
}

/**
 * Ortak işler: kaynağı okuma (HTTP ya da yerel dosya), alan eşleme, doğrulama.
 *
 * Ayar anahtarları (ayarlar.php > tedarikciler > [kod]):
 *   ad, tip (json|xml|csv), adres (URL ya da dosya yolu; sayfalıda {sayfa} yer tutucusu),
 *   basliklar (HTTP başlıkları, ör. API anahtarı), zaman_asimi (sn),
 *   alanlar => [sku, barkod, ad, alis_fiyati, stok, gorsel_url, para_birimi, kategori] -> kaynaktaki alan adı/yolu
 *   para_birimi (alan yoksa varsayılan), sku_onek_sil (ör. 'AT-'), stok_var_degeri
 */
abstract class TemelTedarikci implements Tedarikci
{
    protected array $uyarilar = [];

    public function __construct(protected string $kod, protected array $ayar)
    {
    }

    public function kod(): string
    {
        return $this->kod;
    }

    public function ad(): string
    {
        return (string) ($this->ayar['ad'] ?? $this->kod);
    }

    public function uyarilar(): array
    {
        return $this->uyarilar;
    }

    public function urunleri_getir(): array
    {
        $this->uyarilar = [];
        $sonuc = [];
        $atlanan = 0;
        foreach ($this->ham_kayitlar() as $kayit) {
            $urun = $this->normalle($kayit);
            if ($urun === null) {
                $atlanan++;
                continue;
            }
            $sonuc[] = $urun;
        }
        if ($atlanan > 0) {
            $this->uyarilar[] = "{$atlanan} kayıt atlandı (kod ya da fiyat eksik/geçersiz)";
        }
        return $sonuc;
    }

    /** Kaynaktaki ham kayıtları (dizi olarak) üretir. */
    abstract protected function ham_kayitlar(): iterable;

    /** Kayıttan alan okur; alt sınıf XML gibi özel yapılar için ezebilir. */
    protected function alan(mixed $kayit, string $anahtar): mixed
    {
        $yol = $this->ayar['alanlar'][$anahtar] ?? null;
        if ($yol === null || $yol === '') {
            return null;
        }
        return ft_yol($kayit, (string) $yol);
    }

    protected function normalle(mixed $kayit): ?array
    {
        $sku = trim((string) ($this->alan($kayit, 'sku') ?? ''));
        $onek = (string) ($this->ayar['sku_onek_sil'] ?? '');
        if ($onek !== '' && str_starts_with(mb_strtoupper($sku), mb_strtoupper($onek))) {
            $sku = substr($sku, strlen($onek));
        }
        $fiyat = ft_sayi($this->alan($kayit, 'alis_fiyati'));
        if ($sku === '' || $fiyat === null || $fiyat <= 0) {
            return null;
        }
        return [
            'sku'         => $sku,
            'barkod'      => ft_barkod($this->alan($kayit, 'barkod')),
            'ad'          => trim((string) ($this->alan($kayit, 'ad') ?? '')),
            'alis_fiyati' => round($fiyat, 4),
            'stok'        => ft_stok($this->alan($kayit, 'stok'), (int) ($this->ayar['stok_var_degeri'] ?? 5)),
            'gorsel_url'  => trim((string) ($this->alan($kayit, 'gorsel_url') ?? '')),
            'para_birimi' => ft_para_birimi((string) ($this->alan($kayit, 'para_birimi') ?? ''), ft_para_birimi($this->ayar['para_birimi'] ?? 'TRY')),
            'kategori'    => trim((string) ($this->alan($kayit, 'kategori') ?? '')),
        ];
    }

    /** URL ise HTTP ile, değilse yerel dosyadan okur. Başarısızsa istisna. */
    protected function oku(string $adres): string
    {
        if (!preg_match('#^https?://#i', $adres)) {
            $yol = $this->yerel_yol($adres);
            if (!is_file($yol)) {
                throw new RuntimeException("Kaynak dosyası bulunamadı: {$adres}");
            }
            return (string) file_get_contents($yol);
        }
        $zaman = (int) ($this->ayar['zaman_asimi'] ?? 30);
        $basliklar = [];
        foreach (($this->ayar['basliklar'] ?? []) as $k => $v) {
            $basliklar[] = "{$k}: {$v}";
        }
        if (function_exists('curl_init')) {
            $ch = curl_init($adres);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_CONNECTTIMEOUT => min(10, $zaman),
                CURLOPT_TIMEOUT        => $zaman,
                CURLOPT_HTTPHEADER     => $basliklar,
                CURLOPT_USERAGENT      => 'FiyatTakip/1.0',
                CURLOPT_ENCODING       => '',
            ]);
            $govde = curl_exec($ch);
            $kod = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $hata = curl_error($ch);
            curl_close($ch);
            if ($govde === false) {
                throw new RuntimeException("Bağlantı hatası: {$hata}");
            }
            if ($kod >= 400) {
                throw new RuntimeException("HTTP {$kod} döndü");
            }
            return (string) $govde;
        }
        $baglam = stream_context_create(['http' => ['timeout' => $zaman, 'header' => implode("\r\n", $basliklar), 'ignore_errors' => false]]);
        $govde = @file_get_contents($adres, false, $baglam);
        if ($govde === false) {
            throw new RuntimeException('Bağlantı hatası: ' . (error_get_last()['message'] ?? 'bilinmiyor'));
        }
        return $govde;
    }

    /** Göreli yolları kod/ klasörüne göre çözer. */
    protected function yerel_yol(string $yol): string
    {
        if (preg_match('#^([A-Za-z]:[\\\\/]|/)#', $yol)) {
            return $yol;
        }
        return dirname(__DIR__) . DIRECTORY_SEPARATOR . $yol;
    }
}
