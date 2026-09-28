<?php
declare(strict_types=1);

/**
 * Küçük yardımcı fonksiyonlar (sayı çözme, SKU normalleştirme, SQL tanımlayıcı, günlük).
 */

/** "1.234,56" / "1,234.56" / "1234.56" / "₺1.234" gibi metinleri float'a çevirir. Çözülemezse null. */
function ft_sayi(mixed $deger): ?float
{
    if ($deger === null || $deger === '' || is_bool($deger)) {
        return null;
    }
    if (is_int($deger) || is_float($deger)) {
        return (float) $deger;
    }
    $s = preg_replace('/[^0-9,.\-]/u', '', (string) $deger);
    if ($s === '' || $s === '-' || $s === null) {
        return null;
    }
    $virgul = strrpos($s, ',');
    $nokta  = strrpos($s, '.');
    if ($virgul !== false && $nokta !== false) {
        // Hangisi sondaysa ondalık ayırıcı odur.
        if ($virgul > $nokta) {
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
        } else {
            $s = str_replace(',', '', $s);
        }
    } elseif ($virgul !== false) {
        // Sadece virgül: "1,5" ondalık; "1,234,567" binlik.
        $s = substr_count($s, ',') > 1 ? str_replace(',', '', $s) : str_replace(',', '.', $s);
    } elseif ($nokta !== false && substr_count($s, '.') > 1) {
        $s = str_replace('.', '', $s); // "1.234.567"
    }
    return is_numeric($s) ? (float) $s : null;
}

/** Stok alanını tam sayıya çevirir: "50+", "Var", "Yok", ">10", "12 adet". */
function ft_stok(mixed $deger, int $varDegeri = 5): int
{
    if ($deger === null || $deger === '') {
        return 0;
    }
    if (is_int($deger)) {
        return max(0, $deger);
    }
    if (is_float($deger)) {
        return max(0, (int) floor($deger));
    }
    $s = mb_strtolower(trim((string) $deger), 'UTF-8');
    if (in_array($s, ['yok', 'tükendi', 'tukendi', 'hayır', 'hayir', 'false', 'no', 'out'], true)) {
        return 0;
    }
    if (in_array($s, ['var', 'mevcut', 'evet', 'true', 'yes', 'in stock', 'stokta'], true)) {
        return $varDegeri;
    }
    if (preg_match('/-?\d+/', $s, $m)) {
        return max(0, (int) $m[0]);
    }
    return 0;
}

/** SKU karşılaştırması için: büyük harf, yalnız harf/rakam. "at-ev 1001" -> "ATEV1001" */
function ft_sku(?string $sku): string
{
    if ($sku === null) {
        return '';
    }
    $s = mb_strtoupper(trim($sku), 'UTF-8');
    return (string) preg_replace('/[^A-Z0-9]/u', '', strtr($s, ['İ' => 'I', 'Ş' => 'S', 'Ğ' => 'G', 'Ü' => 'U', 'Ö' => 'O', 'Ç' => 'C']));
}

/** Barkod: yalnız rakamlar, baştaki sıfırlar korunur. Geçersizse ''. */
function ft_barkod(mixed $b): string
{
    if ($b === null) {
        return '';
    }
    $s = preg_replace('/\D/', '', (string) $b);
    return strlen((string) $s) >= 8 ? (string) $s : '';
}

/** Para birimi kodunu normalleştirir: TL, ₺, YTL -> TRY. */
function ft_para_birimi(?string $pb, string $varsayilan = 'TRY'): string
{
    $s = strtoupper(trim((string) $pb));
    if ($s === '') {
        return $varsayilan;
    }
    return match ($s) {
        'TL', 'YTL', '₺', 'TRL', 'TRY' => 'TRY',
        '$', 'USD', 'US$', 'DOLAR' => 'USD',
        '€', 'EUR', 'EURO', 'AVRO' => 'EUR',
        '£', 'GBP', 'STERLIN' => 'GBP',
        default => $s,
    };
}

/** Ayarlardan gelen tablo/alan adını doğrular ve `...` ile tırnaklar (MySQL ve SQLite ikisi de kabul eder). */
function ft_ad(string $ad): string
{
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]{0,63}$/', $ad)) {
        throw new InvalidArgumentException("Geçersiz tablo/alan adı: {$ad}");
    }
    return '`' . $ad . '`';
}

/** Nokta yoluyla dizi içinden değer alır: "data.items", "images.0". */
function ft_yol(mixed $veri, string $yol): mixed
{
    if ($yol === '') {
        return $veri;
    }
    foreach (explode('.', $yol) as $parca) {
        if (is_array($veri) && array_key_exists($parca, $veri)) {
            $veri = $veri[$parca];
        } elseif (is_array($veri) && ctype_digit($parca) && array_key_exists((int) $parca, $veri)) {
            $veri = $veri[(int) $parca];
        } else {
            return null;
        }
    }
    return $veri;
}

function ft_simdi(): string
{
    return date('Y-m-d H:i:s');
}

/** Yüzde değişim (eski 0 ise null). */
function ft_yuzde(float $eski, float $yeni): ?float
{
    if (abs($eski) < 0.00001) {
        return null;
    }
    return round(($yeni - $eski) / $eski * 100, 2);
}

/** Basit günlük: ekrana (CLI) ve isteğe bağlı dosyaya yazar. */
final class Gunluk
{
    private static ?string $dosya = null;
    private static bool $sessiz = false;

    public static function ayarla(?string $dosya, bool $sessiz = false): void
    {
        self::$dosya = $dosya;
        self::$sessiz = $sessiz;
    }

    public static function yaz(string $mesaj, string $seviye = 'BILGI'): void
    {
        $satir = '[' . ft_simdi() . "] {$seviye}: {$mesaj}";
        if (!self::$sessiz) {
            fwrite(PHP_SAPI === 'cli' ? STDOUT : fopen('php://output', 'w'), $satir . PHP_EOL);
        }
        if (self::$dosya) {
            @file_put_contents(self::$dosya, $satir . PHP_EOL, FILE_APPEND | LOCK_EX);
        }
    }
}
