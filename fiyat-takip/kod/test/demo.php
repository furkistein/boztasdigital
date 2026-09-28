<?php
declare(strict_types=1);

/**
 * Uçtan uca demo: SQLite üzerinde örnek bir mağaza kurar ve senkron.php'yi iki kez GERÇEKTEN çalıştırır.
 *   1. tur: tedarikçilerin dünkü listeleri (ornek-veri/ilk) — ilk senkron
 *   2. tur: güncel listeler (ornek-veri/guncel); Marmara'ya erişilemiyor (hata senaryosu)
 * 2. turun raporu demo sayfasına (../veri/rapor.js) yazılır.
 *
 *   php test/demo.php [rapor_yolu]
 */
require dirname(__DIR__) . '/lib/yukle.php';
require __DIR__ . '/sqlite.php';
date_default_timezone_set('Europe/Istanbul');

$dbYolu = sys_get_temp_dir() . '/ft-demo.sqlite';
$db = ft_test_db($dbYolu);
$rapor = $argv[1] ?? dirname(__DIR__, 2) . '/veri/rapor.js';
if (!is_dir(dirname($rapor))) {
    mkdir(dirname($rapor), 0775, true);
}

function tur(string $veri, string $hatali, string $rapor, string $dbYolu): int
{
    $php = escapeshellarg(PHP_BINARY);
    putenv("FT_DB={$dbYolu}");
    putenv("FT_VERI={$veri}");
    putenv("FT_HATALI={$hatali}");
    putenv("FT_RAPOR={$rapor}");
    $komut = "{$php} " . escapeshellarg(dirname(__DIR__) . '/senkron.php') . ' --ayar=' . escapeshellarg(__DIR__ . '/ayarlar.demo.php');
    echo "\n$ {$komut}\n";
    passthru($komut, $kod);
    echo "çıkış kodu: {$kod}\n";
    return $kod;
}

$k1 = tur('ilk', '', sys_get_temp_dir() . '/ft-demo-ilk.json', $dbYolu);
// 1. turu 15 dk öncesine al (cron aralığı), böylece 2. turda "son başarılı veri 15 dk önce" görünür.
foreach (['ft_tedarikci_durum' => ['son_deneme', 'son_basari'], 'ft_tedarikci_urun' => ['guncellendi'], 'ft_calisma' => ['baslangic', 'bitis'], 'ft_degisiklik' => ['tarih'], 'ft_onay' => ['olusturma']] as $t => $alanlar) {
    foreach ($alanlar as $a) {
        $db->exec("UPDATE {$t} SET {$a} = datetime({$a}, '-15 minutes') WHERE {$a} IS NOT NULL");
    }
}
$k2 = tur('guncel', 'marmara', $rapor, $dbYolu);

echo "\nVeritabanı: {$dbYolu}\nRapor: {$rapor}\n";
exit($k1 === 0 && $k2 === 0 ? 0 : 1);
