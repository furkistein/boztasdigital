<?php
/**
 * Demo / test ayarları: ayarlar.example.php'yi alır, kaynakları ornek-veri/ klasörüne,
 * veritabanını SQLite dosyasına yönlendirir. Ortam değişkenleri:
 *   FT_DB     SQLite dosya yolu
 *   FT_VERI   ilk | guncel  (hangi örnek tedarikçi listeleri okunacak)
 *   FT_HATALI virgülle tedarikçi kodları: bunların adresi erişilemez yapılır (hata senaryosu)
 *   FT_RAPOR  rapor dosyası (.json ya da .js)
 */
$a = require dirname(__DIR__) . '/ayarlar.example.php';
$veri = 'ornek-veri/' . (getenv('FT_VERI') ?: 'guncel');
$tmp = sys_get_temp_dir();

$a['db'] = ['dsn' => 'sqlite:' . (getenv('FT_DB') ?: $tmp . '/ft-demo.sqlite'), 'kullanici' => null, 'sifre' => null];
$a['tedarikciler']['anadolu']['adres'] = "{$veri}/anadolu-sayfa{sayfa}.json";
$a['tedarikciler']['anadolu']['sayfa_boyutu'] = 12;
$a['tedarikciler']['ege']['adres'] = "{$veri}/ege.xml";
$a['tedarikciler']['marmara']['adres'] = "{$veri}/marmara.csv";
$a['tedarikciler']['global']['adres'] = "{$veri}/global.json";
foreach (array_filter(explode(',', (string) getenv('FT_HATALI'))) as $kod) {
    // 127.0.0.1:9 (discard portu) — bağlantı reddedilir: gerçek bir erişim hatası
    $a['tedarikciler'][$kod]['adres'] = 'http://127.0.0.1:9/bayi-fiyat.csv';
    $a['tedarikciler'][$kod]['zaman_asimi'] = 5;
}
$a['doviz']['kaynak'] = "{$veri}/tcmb-today.xml";
$a['doviz']['onbellek'] = '';
$a['kilit_dosyasi'] = $tmp . '/ft-demo.lock';
$a['gunluk_dosyasi'] = null;
$a['rapor_dosyasi'] = getenv('FT_RAPOR') ?: $tmp . '/ft-demo-rapor.json';
$a['onay_anahtari'] = 'demo-anahtar-yalnizca-test-icin-1234';
return $a;
