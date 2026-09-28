<?php
declare(strict_types=1);

/** sema.sql (MySQL) dosyasını SQLite'a çevirip uygular + örnek site ürün tablosunu kurar. */
function ft_test_db(string $yol): PDO
{
    if (is_file($yol)) {
        unlink($yol); // yalnızca testin kendi geçici dosyası
    }
    $db = new PDO('sqlite:' . $yol, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $sql = (string) file_get_contents(dirname(__DIR__) . '/sema.sql');
    $sql = preg_replace('/^SET NAMES.*$/m', '', $sql);
    $sql = preg_replace('/(BIG)?INT\s+UNSIGNED\s+NOT NULL\s+AUTO_INCREMENT/', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
    $sql = preg_replace('/^\s*PRIMARY KEY \(id\),?\s*$/m', '', $sql);
    $sql = preg_replace('/^\s*KEY \w+ \([^)]*\),?\s*(--.*)?$/m', '', $sql);
    $sql = preg_replace('/\)\s*ENGINE=[^;]*;/', ');', $sql);
    $sql = preg_replace('/UNSIGNED/', '', $sql);
    $sql = preg_replace('/,(\s*(--[^\n]*)?\s*)\n\s*\);/', "$1\n);", $sql);
    $db->exec($sql);

    $db->exec('CREATE TABLE urunler (id INTEGER PRIMARY KEY AUTOINCREMENT, stok_kodu TEXT UNIQUE, barkod TEXT, urun_adi TEXT, kategori TEXT, fiyat REAL, stok INTEGER, aktif INTEGER, resim TEXT)');
    $f = fopen(dirname(__DIR__) . '/ornek-veri/site-urunler.csv', 'r');
    $baslik = fgetcsv($f, 0, ';', '"', '');
    $ekle = $db->prepare('INSERT INTO urunler (' . implode(',', $baslik) . ') VALUES (' . rtrim(str_repeat('?,', count($baslik)), ',') . ')');
    while (($s = fgetcsv($f, 0, ';', '"', '')) !== false) {
        $ekle->execute($s);
    }
    fclose($f);
    return $db;
}
