<?php
declare(strict_types=1);

/**
 * Fiyat / stok senkronu — cron ile çalıştırılır.
 *
 *   php senkron.php                 normal çalışma
 *   php senkron.php --kuru          KURU ÇALIŞMA: hesaplar, raporlar, hiçbir şey yazmaz
 *   php senkron.php --ayar=/yol/ayarlar.php
 *   php senkron.php --sessiz        ekrana yazma (yalnız günlük dosyası)
 *
 * Çıkış kodu: 0 tamam/kısmi, 1 hata, 2 başka bir senkron zaten çalışıyor.
 */

require __DIR__ . '/lib/yukle.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Bu betik yalnızca komut satırından / cron ile çalışır.\n");
}

$secenek = getopt('', ['kuru', 'ayar:', 'sessiz']);
$ayarDosyasi = $secenek['ayar'] ?? __DIR__ . '/ayarlar.php';
if (!is_file($ayarDosyasi)) {
    fwrite(STDERR, "Ayar dosyası yok: {$ayarDosyasi}\nayarlar.example.php dosyasını ayarlar.php olarak kopyalayıp doldurun.\n");
    exit(1);
}
$ayar = require $ayarDosyasi;
date_default_timezone_set($ayar['saat_dilimi'] ?? 'Europe/Istanbul');
set_time_limit(0);
ini_set('memory_limit', $ayar['bellek'] ?? '512M');

foreach (['kilit_dosyasi', 'gunluk_dosyasi', 'rapor_dosyasi'] as $k) {
    if (!empty($ayar[$k]) && !is_dir(dirname((string) $ayar[$k]))) {
        @mkdir(dirname((string) $ayar[$k]), 0775, true);
    }
}
if (!empty($ayar['doviz']['onbellek']) && !is_dir(dirname((string) $ayar['doviz']['onbellek']))) {
    @mkdir(dirname((string) $ayar['doviz']['onbellek']), 0775, true);
}
Gunluk::ayarla($ayar['gunluk_dosyasi'] ?? null, isset($secenek['sessiz']));

// --- kilit: aynı anda iki senkron çalışmasın (cron üst üste binerse)
$kilitYolu = (string) ($ayar['kilit_dosyasi'] ?? sys_get_temp_dir() . '/fiyat-takip.lock');
$kilit = fopen($kilitYolu, 'c');
if ($kilit === false || !flock($kilit, LOCK_EX | LOCK_NB)) {
    Gunluk::yaz('Başka bir senkron hâlâ çalışıyor, bu tur atlandı.', 'UYARI');
    exit(2);
}
ftruncate($kilit, 0);
fwrite($kilit, (string) getmypid());

$kod = 0;
try {
    $db = new PDO($ayar['db']['dsn'], $ayar['db']['kullanici'] ?? null, $ayar['db']['sifre'] ?? null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $senkron = new Senkron($db, $ayar, isset($secenek['kuru']));
    $senkron->calistir();
} catch (Throwable $e) {
    Gunluk::yaz('Senkron durdu: ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine(), 'HATA');
    $kod = 1;
} finally {
    flock($kilit, LOCK_UN);
    fclose($kilit);
}
exit($kod);
