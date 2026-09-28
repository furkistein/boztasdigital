<?php
/**
 * Fiyat / stok takip — ayar dosyası örneği.
 * Kopyalayın: ayarlar.example.php -> ayarlar.php, sonra kendi değerlerinizi girin.
 * ayarlar.php şifre içerir: public_html DIŞINDA tutun ya da .htaccess ile erişimi kapatın.
 */
return [

    // ------------------------------------------------------------ veritabanı
    'db' => [
        'dsn'       => 'mysql:host=localhost;dbname=VERITABANI_ADI;charset=utf8mb4',
        'kullanici' => 'VERITABANI_KULLANICISI',
        'sifre'     => 'VERITABANI_SIFRESI',
    ],

    // ---------------------------------------------- sitenin mevcut ürün tablosu
    // Sistem yalnızca buradaki alanlara yazar. Kullanmadığınız alanı null bırakın.
    'site' => [
        'tablo'   => 'urunler',
        'alanlar' => [
            'anahtar'  => 'stok_kodu',   // benzersiz ürün kodu (SKU) — eşlemenin temeli
            'barkod'   => 'barkod',      // varsa barkod ile eşleme önceliklidir
            'ad'       => 'urun_adi',    // yalnız raporlarda görünür
            'fiyat'    => 'fiyat',       // satış fiyatı (KDV dahil)
            'stok'     => 'stok',
            'durum'    => 'aktif',       // aktif/pasif alanı
            'gorsel'   => 'resim',       // ana görsel URL'si
            'kategori' => 'kategori',    // kategori bazlı kâr kuralı için (yoksa tedarikçinin kategorisi)
            'alis'     => null,          // alış fiyatını da yazmak isterseniz alan adı (TL)
        ],
        'aktif_degeri' => 1,
        'pasif_degeri' => 0,
        'ek_kosul'     => '',            // ör. "silindi = 0" — sadece bu ürünler işlenir
    ],

    // ---------------------------------------------------------- tedarikçiler
    // tip: json | xml | csv. Yeni tedarikçi = yeni blok (README > Yeni tedarikçi ekleme).
    // oncelik: aynı fiyatta hangisi seçilsin (küçük = önce).
    'tedarikciler' => [
        'anadolu' => [
            'ad'           => 'Anadolu Toptan',
            'tip'          => 'json',
            'adres'        => 'https://api.tedarikci-a.example/v1/products?page={sayfa}&limit=200',
            'basliklar'    => ['Authorization' => 'Bearer API_ANAHTARI'],
            'liste_yolu'   => 'data.items',
            'sayfa_boyutu' => 200,
            'sku_onek_sil' => 'AT-',
            'alanlar'      => [
                'sku' => 'stockCode', 'barkod' => 'barcode', 'ad' => 'name', 'alis_fiyati' => 'price',
                'stok' => 'quantity', 'gorsel_url' => 'image', 'para_birimi' => 'currency', 'kategori' => 'category',
            ],
            'oncelik' => 1,
        ],
        'ege' => [
            'ad'           => 'Ege Dağıtım',
            'tip'          => 'xml',
            'adres'        => 'https://tedarikci-b.example/bayi/xml/urunler.xml?anahtar=BAYI_ANAHTARI',
            'urun_etiketi' => 'Urun',
            'sku_onek_sil' => 'EGE',
            'alanlar'      => [
                'sku' => '@kod', 'barkod' => 'Barkod', 'ad' => 'UrunAdi', 'alis_fiyati' => 'AlisFiyati',
                'stok' => 'StokAdedi', 'gorsel_url' => 'Resim', 'para_birimi' => 'ParaBirimi', 'kategori' => 'Kategori',
            ],
            'oncelik' => 2,
        ],
        'marmara' => [
            'ad'       => 'Marmara Elektronik',
            'tip'      => 'csv',
            'adres'    => 'https://tedarikci-c.example/export/bayi-fiyat.csv',
            'ayirici'  => ';',
            'kodlama'  => 'Windows-1254',
            'alanlar'  => [
                'sku' => 'KOD', 'barkod' => 'BARKOD', 'ad' => 'ADI', 'alis_fiyati' => 'FIYAT',
                'para_birimi' => 'DOVIZ', 'stok' => 'MIKTAR', 'gorsel_url' => 'RESIM', 'kategori' => 'GRUP',
            ],
            'oncelik' => 3,
        ],
        'global' => [
            'ad'           => 'Global Import',
            'tip'          => 'json',
            'adres'        => 'https://feed.tedarikci-d.example/products.json',
            'basliklar'    => ['X-Api-Key' => 'API_ANAHTARI'],
            'liste_yolu'   => 'products',
            'para_birimi'  => 'USD',        // kaynakta para birimi alanı yok: hepsi USD
            'sku_onek_sil' => 'GI',
            'stok_var_degeri' => 5,         // stok "Var" yazıyorsa kaç sayılsın
            'alanlar'      => [
                'sku' => 'sku', 'barkod' => 'ean', 'ad' => 'title', 'alis_fiyati' => 'price_usd',
                'stok' => 'stock', 'gorsel_url' => 'images.0', 'kategori' => 'cat',
            ],
            'oncelik' => 4,
        ],
    ],

    // ------------------------------------------------------------ kâr kuralı
    // satış = yuvarla( max(alış×(1+yüzde)+sabit, alış×(1+min_marj)) × (1+kdv) )
    // Öncelik: tedarikci_kategori > kategori > tedarikci > varsayilan
    'kar' => [
        'varsayilan' => ['yuzde' => 30, 'sabit' => 20],
        'tedarikci'  => [
            'global' => ['yuzde' => 35, 'sabit' => 25],     // ithal ürün: kur riski payı
        ],
        'kategori'   => [
            'Telefon Aksesuar' => ['yuzde' => 55, 'sabit' => 15],
            'Bilgisayar'       => ['yuzde' => 22, 'sabit' => 30],
        ],
        'tedarikci_kategori' => [
            // 'ege' => ['Kişisel Bakım' => ['yuzde' => 28, 'sabit' => 20]],
        ],
        'min_marj' => 12,    // %: kural ne derse desin satış (KDV hariç) alışın en az %12 üstünde
        'kdv'      => 20,    // alış fiyatları KDV hariçse 20; KDV dahilse 0 yazın
        'yuvarlama' => [     // fiyat aralığına göre yukarı yuvarlama
            ['alt' => 0,   'adim' => 1,  'son' => 0.90],   // 87,20 -> 87,90
            ['alt' => 100, 'adim' => 10, 'son' => 9.90],   // 1.243,17 -> 1.249,90
        ],
    ],

    // ----------------------------------------------------- iş kuralları / eşikler
    'kurallar' => [
        'buyuk_zam_esigi'     => 25,    // % bu kadar ve üstü zam otomatik yazılmaz, onaya düşer
        'buyuk_indirim_esigi' => 40,    // % bu kadar ve üstü düşüş de onaya düşer (tedarikçi veri hatasına karşı)
        'min_stok'            => 1,     // tedarikçide bundan az stok = yok sayılır
        'stok_modu'           => 'secilen', // secilen: seçili tedarikçinin stoku | toplam: tüm tedarikçiler
        'stoku_bitince_pasif' => true,
        'geri_gelince_aktif'  => true,  // yalnızca BU SİSTEMİN pasife aldığı ürünler
        'gorsel_guncelle'     => true,  // görsel boşsa ya da tedarikçi görseli değiştiyse
        'eski_veri_saat'      => 6,     // tedarikçi hata verirse bu kadar saatlik son veriyle devam
        'min_urun_orani'      => 0.5,   // liste bir anda yarıdan aza düşerse "eksik liste" say, uygulama
    ],

    // ------------------------------------------------------------------ döviz
    'doviz' => [
        'kaynak'      => 'https://www.tcmb.gov.tr/kurlar/today.xml',
        'kur_turu'    => 'ForexSelling',   // ForexBuying | ForexSelling | BanknoteSelling
        'onbellek'    => __DIR__ . '/veri/kur.json',
        'en_eski_gun' => 4,                // TCMB'ye ulaşılamazsa en çok bu kadar günlük kur kullanılır
        // 'sabit_kurlar' => ['USD' => 46.50],  // elle kur (TCMB yerine)
    ],

    // ------------------------------------------------------------- bildirim
    // Büyük zam/indirim onaya düşünce ve tedarikçi hata verince tek özet mesaj gider.
    'bildirim' => [
        'eposta' => [
            'acik'   => false,
            'kime'   => '',     // bildirim adresi
            'kimden' => '',     // sunucunuzdaki gönderici adresi
        ],
        'telegram' => [
            'acik'         => false,
            'bot_anahtari' => '',   // @BotFather'dan alınan anahtar
            'sohbet_id'    => '',
        ],
    ],

    // ------------------------------------------------------------- dosyalar
    'kilit_dosyasi'  => __DIR__ . '/veri/senkron.lock',
    'gunluk_dosyasi' => __DIR__ . '/veri/senkron.log',
    'rapor_dosyasi'  => __DIR__ . '/veri/son-rapor.json',   // panel için son çalışma özeti

    // onay.php'yi tarayıcıdan açmak için gizli anahtar (uzun ve rastgele olsun)
    'onay_anahtari' => 'BURAYA-UZUN-RASTGELE-BIR-DEGER',
];
