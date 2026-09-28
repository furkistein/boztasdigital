# Tedarikçi fiyat / stok takip sistemi (PHP 8, cron)

Mevcut PHP e-ticaret sitenizin ürün tablosunu, tedarikçilerin API / XML / CSV listelerine göre
otomatik günceller: **alış fiyatı, zam, döviz, stok, görsel**. Framework gerekmez; saf PHP 8 + PDO (MySQL/MariaDB).

## Ne yapar?

| Özellik | Açıklama |
|---|---|
| 4+ tedarikçi | JSON API (sayfalı dahil), XML feed, CSV/Excel listesi. Hepsi ortak arayüz: `urunleri_getir()` |
| Eşleme | Önce elle eşleme tablosu (`ft_eslesme`), sonra barkod, sonra SKU (öneksiz, büyük/küçük harf ve tire duyarsız) |
| En uygun tedarikçi | Aynı ürün birden çok tedarikçide ise **stoku olanlar arasından en ucuzu** seçilir; tedarikçi değişimi günlüğe yazılır |
| Kâr kuralı | Varsayılan / tedarikçi / kategori / tedarikçi+kategori bazında `% + sabit TL`, KDV, kademeli yuvarlama (ör. 1.243 → 1.249,90) |
| Minimum marj | Kural ne derse desin satış, alışın en az `min_marj` % üstünde kalır |
| Döviz | USD/EUR fiyatlar TCMB kuru (today.xml) ile TL'ye çevrilir; günde bir çekilir, TCMB'ye ulaşılamazsa son kur kullanılır |
| Stok | Stok biterse ürün pasife alınır, stok gelince **yalnızca sistemin kapattığı** ürünler tekrar açılır (sizin elle kapattıklarınıza dokunulmaz) |
| Görsel | Görsel boşsa ya da tedarikçi görseli değiştiyse güncellenir (kendi yüklediğiniz görsel ezilmez) |
| Büyük zam koruması | `%25` (ayarlanabilir) üstü zam ve `%40` üstü düşüş siteye yazılmaz, **onaya düşer**; e-posta/Telegram bildirimi gider |
| Değişiklik günlüğü | Her fiyat/stok/durum/görsel değişikliği: eski, yeni, % değişim, hangi tedarikçi, hangi kural |
| Hata dayanıklılığı | Bir tedarikçi çökerse atlanır, diğerleri çalışır; son başarılı verisi (6 saat) yedek olarak kullanılır. Veri eskiyse o ürünlerde stok sıfırlama yapılmaz. Liste bir anda yarıdan aza düşerse "eksik liste" sayılır, uygulanmaz |
| Çakışma önleme | Kilit dosyası: bir önceki çalışma bitmeden yenisi başlamaz |
| Kuru çalışma | `--kuru` ile hiçbir şey yazmadan ne değişeceğini görürsünüz |

## Dosyalar

```
senkron.php            cron'un çalıştırdığı betik
onay.php               onay bekleyen büyük zamlar (komut satırı + tarayıcı sayfası)
ayarlar.example.php    tüm ayarlar (kopyalayıp ayarlar.php yapın)
sema.sql               ft_ önekli yardımcı tablolar (sitenizin tablolarına dokunmaz)
lib/                   Senkron motoru, Fiyatlama, Doviz (TCMB), Bildirim
tedarikci/             Tedarikci arayüzü + JsonApi / XmlFeed / Csv adaptörleri
ornek-veri/            4 tedarikçinin örnek listeleri + TCMB örneği + örnek mağaza
test/                  uçtan uca demo ve testler (SQLite ile, sunucu gerekmez)
```

## Kurulum (cPanel)

1. **Dosyaları yükleyin**: `kod/` klasörünü `public_html` **dışına** koyun, ör. `/home/KULLANICI/fiyat-takip/`.
   (Yalnızca `onay.php`'yi tarayıcıdan kullanacaksanız onu `public_html` içine taşıyıp içindeki
   `require` yollarını düzeltin ya da o klasöre bir alt alan adı bağlayın.)
2. **Tabloları oluşturun**: cPanel > phpMyAdmin > sitenin veritabanı > *İçe Aktar* > `sema.sql`.
3. **Ayarları girin**: `ayarlar.example.php` → `ayarlar.php` olarak kopyalayın; veritabanı bilgisi,
   ürün tablonuzun adı ve alan adları, tedarikçi adresleri / API anahtarları, kâr kuralları.
4. **Önce kuru çalıştırın** (cPanel > Terminal ya da SSH):
   ```
   php /home/KULLANICI/fiyat-takip/senkron.php --kuru
   ```
   Hiçbir şey yazmaz; kaç ürünün fiyatı/stoku değişeceğini gösterir. `veri/son-rapor.json` dosyasına bakın.
5. **Cron'u kurun**: cPanel > *Cron Jobs* > *Add New Cron Job*
   - Ortak Ayar: *Once Per Fifteen Minutes* (`*/15 * * * *`)
   - Komut:
     ```
     /usr/local/bin/php /home/KULLANICI/fiyat-takip/senkron.php --sessiz
     ```
   PHP yolu sunucuya göre değişebilir (`/usr/bin/php`, `/opt/cpanel/ea-php83/root/usr/bin/php`).
   cPanel > *MultiPHP Manager*'da sitenin PHP sürümünü görebilirsiniz; en az **PHP 8.0**.
   Cron e-postası istemiyorsanız komutun sonuna ` >/dev/null 2>&1` ekleyin (günlük zaten `veri/senkron.log`'a yazılır).
6. Gerekli PHP eklentileri: `pdo_mysql`, `mbstring`, `simplexml`, `xmlreader`, `iconv` (cPanel'de genelde açıktır), `curl` (yoksa `file_get_contents` ile devam eder).

## Onay bekleyen zamlar

```
php onay.php liste
php onay.php onayla 12
php onay.php reddet 12        # aynı fiyat bir daha sorulmaz
php onay.php onayla hepsi
```
Tarayıcıdan: `onay.php?anahtar=...` (ayarlar.php içindeki `onay_anahtari`). Bildirim açmak için
`ayarlar.php > bildirim` bölümünde e-posta ya da Telegram'ı `'acik' => true` yapın.

## Yeni tedarikçi ekleme

Çoğu tedarikçi için **kod yazmak gerekmez**; `ayarlar.php > tedarikciler` içine yeni bir blok eklenir:

```php
'yeni' => [
    'ad'      => 'Yeni Tedarikçi',
    'tip'     => 'xml',                      // json | xml | csv
    'adres'   => 'https://.../bayi.xml',     // ya da sunucudaki dosya yolu
    'urun_etiketi' => 'item',                // XML: her ürünün elemanı
    'alanlar' => [                           // bizim alan => onların alan adı
        'sku' => 'code', 'barkod' => 'barcode', 'ad' => 'title',
        'alis_fiyati' => 'price', 'stok' => 'qty', 'gorsel_url' => 'images/image',
        'para_birimi' => 'currency', 'kategori' => 'category',
    ],
    'oncelik' => 5,
],
```

- JSON'da iç içe alanlar nokta ile: `data.items`, `images.0`; sayfalı API'de adrese `{sayfa}` yazın.
- XML'de öznitelik `@kod`, iç içe eleman `Resimler/Resim`.
- CSV'de başlık satırındaki sütun adı; Türkçe Excel için `'ayirici' => ';'`, `'kodlama' => 'Windows-1254'`.
- Tedarikçinin kodları sizinkinden bir önekle ayrılıyorsa: `'sku_onek_sil' => 'XYZ-'`.
- Para birimi alanı yoksa: `'para_birimi' => 'USD'`.
- Tuhaf bir API (OAuth, SOAP, token yenileme) ise `tedarikci/` altında `TemelTedarikci`'den türeyen
  küçük bir sınıf yazılır, `'sinif' => 'SinifAdi'` ile bağlanır. Tek şart `urunleri_getir()`'in
  `[sku, barkod, ad, alis_fiyati, stok, gorsel_url, para_birimi]` listesini döndürmesidir.
- İlk çalıştırmayı `--kuru` ile yapın. Barkodu/kodu tutmayan ürünleri `ft_eslesme` tablosuna
  `(tedarikci, tedarikci_sku, urun_anahtar)` olarak ekleyin.

## Denemek (sunucu olmadan)

```
php test/demo.php       # SQLite'ta örnek mağaza kurar, senkronu iki tur çalıştırır, ../veri/rapor.js üretir
php test/testler.php    # birim + uçtan uca testler
```
