window.FT_RAPOR = {
    "surum": 1,
    "calisma": {
        "id": 2,
        "baslangic": "2026-09-28 13:33:03",
        "bitis": "2026-09-28 13:33:05",
        "sure_sn": 2.09,
        "durum": "kismi",
        "kuru": false,
        "hata": null
    },
    "ozet": {
        "islenen_urun": 46,
        "fiyat_degisen": 24,
        "zam": 21,
        "indirim": 3,
        "stok_degisen": 9,
        "stok_biten": 3,
        "stok_gelen": 1,
        "pasife_alinan": 3,
        "aktife_alinan": 1,
        "onaya_dusen": 3,
        "gorsel_guncellenen": 1,
        "tedarikci_degisen": 5,
        "marj_korundu": 0,
        "eslesmeyen_tedarikci_urunu": 1,
        "tedarikcisiz_site_urunu": 0,
        "belirsiz_atlanan": 0,
        "tedarikci_sayisi": 4,
        "tedarikci_hatali": 1,
        "onay_bekleyen": 3
    },
    "kur": {
        "tarih": "28.09.2026",
        "kurlar": {
            "USD": 46.4218,
            "EUR": 54.1507
        },
        "tur": "ForexSelling",
        "uyari": null
    },
    "kar": {
        "varsayilan": {
            "yuzde": 30,
            "sabit": 20
        },
        "tedarikci": {
            "global": {
                "yuzde": 35,
                "sabit": 25
            }
        },
        "kategori": {
            "Telefon Aksesuar": {
                "yuzde": 55,
                "sabit": 15
            },
            "Bilgisayar": {
                "yuzde": 22,
                "sabit": 30
            }
        },
        "tedarikci_kategori": [],
        "min_marj": 12,
        "kdv": 20,
        "yuvarlama": [
            {
                "alt": 0,
                "adim": 1,
                "son": 0.9
            },
            {
                "alt": 100,
                "adim": 10,
                "son": 9.9
            }
        ]
    },
    "esikler": {
        "zam": 25.0,
        "indirim": 40.0
    },
    "tedarikciler": [
        {
            "kod": "anadolu",
            "ad": "Anadolu Toptan",
            "tip": "json",
            "durum": "ok",
            "hata": null,
            "uyarilar": [],
            "urun_sayisi": 21,
            "eslesen": 20,
            "son_deneme": "2026-09-28 13:33:03",
            "son_basari": "2026-09-28 13:33:03",
            "sure_ms": 7,
            "para_birimleri": [
                "TRY"
            ]
        },
        {
            "kod": "ege",
            "ad": "Ege Dağıtım",
            "tip": "xml",
            "durum": "ok",
            "hata": null,
            "uyarilar": [],
            "urun_sayisi": 17,
            "eslesen": 17,
            "son_deneme": "2026-09-28 13:33:03",
            "son_basari": "2026-09-28 13:33:03",
            "sure_ms": 6,
            "para_birimleri": [
                "TRY"
            ]
        },
        {
            "kod": "marmara",
            "ad": "Marmara Elektronik",
            "tip": "csv",
            "durum": "onbellek",
            "hata": "Bağlantı hatası: Failed to connect to 127.0.0.1:9 after 2020 ms: Could not connect to server",
            "uyarilar": [],
            "urun_sayisi": 19,
            "eslesen": 19,
            "son_deneme": "2026-09-28 13:33:03",
            "son_basari": "2026-09-28 13:18:03",
            "sure_ms": 2023,
            "para_birimleri": [
                "EUR",
                "TRY"
            ]
        },
        {
            "kod": "global",
            "ad": "Global Import",
            "tip": "json",
            "durum": "ok",
            "hata": null,
            "uyarilar": [
                "2 kayıt atlandı (kod ya da fiyat eksik\/geçersiz)"
            ],
            "urun_sayisi": 13,
            "eslesen": 13,
            "son_deneme": "2026-09-28 13:33:05",
            "son_basari": "2026-09-28 13:33:05",
            "sure_ms": 5,
            "para_birimleri": [
                "USD"
            ]
        }
    ],
    "degisiklikler": [
        {
            "urun": "EV-1001",
            "ad": "Tost Makinesi 1800W Granit Plaka",
            "tedarikci": "anadolu",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "1399.9",
            "yeni": "1469.9",
            "yuzde": 5.0,
            "not": "alış 920,75 TRY → kural varsayilan"
        },
        {
            "urun": "EV-1001",
            "ad": "Tost Makinesi 1800W Granit Plaka",
            "tedarikci": "anadolu",
            "alan": "gorsel",
            "tur": "gorsel",
            "eski": "https:\/\/cdn.anadolutoptan.example\/urun\/ev-1001.jpg",
            "yeni": "https:\/\/cdn.anadolutoptan.example\/urun\/ev-1001-v2.jpg",
            "yuzde": null,
            "not": "Tedarikçi görseli yeniledi"
        },
        {
            "urun": "EV-1002",
            "ad": "Cam Kettle 1.7 L LED Işıklı",
            "tedarikci": "anadolu",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "879.9",
            "yeni": "919.9",
            "yuzde": 4.55,
            "not": "alış 569,94 TRY → kural varsayilan"
        },
        {
            "urun": "EV-1003",
            "ad": "Smoothie Blender 600W",
            "tedarikci": "anadolu",
            "alan": "durum",
            "tur": "pasif",
            "eski": "1",
            "yeni": "0",
            "yuzde": null,
            "not": "Tüm tedarikçilerde stok bitti, ürün pasife alındı"
        },
        {
            "urun": "EV-1003",
            "ad": "Smoothie Blender 600W",
            "tedarikci": "anadolu",
            "alan": "stok",
            "tur": "stok_bitti",
            "eski": "4",
            "yeni": "0",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "EV-1004",
            "ad": "Filtre Kahve Makinesi 1.25 L",
            "tedarikci": "anadolu",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "1529.9",
            "yeni": "1589.9",
            "yuzde": 3.92,
            "not": "alış 1.003,62 TRY → kural varsayilan"
        },
        {
            "urun": "EV-1005",
            "ad": "Airfryer 4.5 L Dijital",
            "tedarikci": "ege",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "3379.9",
            "yeni": "3519.9",
            "yuzde": 4.14,
            "not": "alış 2.236,64 TRY → kural varsayilan"
        },
        {
            "urun": "EV-1005",
            "ad": "Airfryer 4.5 L Dijital",
            "tedarikci": "ege",
            "alan": "tedarikci",
            "tur": "tedarikci",
            "eski": "anadolu",
            "yeni": "ege",
            "yuzde": null,
            "not": "Anadolu Toptan → Ege Dağıtım (en uygun stoklu kaynak)"
        },
        {
            "urun": "EV-1005",
            "ad": "Airfryer 4.5 L Dijital",
            "tedarikci": "ege",
            "alan": "stok",
            "tur": "stok",
            "eski": "30",
            "yeni": "37",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "EV-1006",
            "ad": "Buharlı Ütü 2400W Seramik Taban",
            "tedarikci": "ege",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "1809.9",
            "yeni": "1879.9",
            "yuzde": 3.87,
            "not": "alış 1.188,21 TRY → kural varsayilan"
        },
        {
            "urun": "EV-1006",
            "ad": "Buharlı Ütü 2400W Seramik Taban",
            "tedarikci": "ege",
            "alan": "tedarikci",
            "tur": "tedarikci",
            "eski": "anadolu",
            "yeni": "ege",
            "yuzde": null,
            "not": "Anadolu Toptan → Ege Dağıtım (en uygun stoklu kaynak)"
        },
        {
            "urun": "EV-1006",
            "ad": "Buharlı Ütü 2400W Seramik Taban",
            "tedarikci": "ege",
            "alan": "stok",
            "tur": "stok",
            "eski": "43",
            "yeni": "50",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "EV-1007",
            "ad": "Dikey Şarjlı Süpürge 22.2V",
            "tedarikci": "ege",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "5139.9",
            "yeni": "5349.9",
            "yuzde": 4.09,
            "not": "alış 3.411,77 TRY → kural varsayilan"
        },
        {
            "urun": "EV-1007",
            "ad": "Dikey Şarjlı Süpürge 22.2V",
            "tedarikci": "ege",
            "alan": "tedarikci",
            "tur": "tedarikci",
            "eski": "anadolu",
            "yeni": "ege",
            "yuzde": null,
            "not": "Anadolu Toptan → Ege Dağıtım (en uygun stoklu kaynak)"
        },
        {
            "urun": "EV-1007",
            "ad": "Dikey Şarjlı Süpürge 22.2V",
            "tedarikci": "ege",
            "alan": "stok",
            "tur": "stok",
            "eski": "56",
            "yeni": "3",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "EV-1008",
            "ad": "El Mikseri 5 Kademe",
            "tedarikci": "anadolu",
            "alan": "durum",
            "tur": "pasif",
            "eski": "1",
            "yeni": "0",
            "yuzde": null,
            "not": "Tüm tedarikçilerde stok bitti, ürün pasife alındı"
        },
        {
            "urun": "EV-1008",
            "ad": "El Mikseri 5 Kademe",
            "tedarikci": "anadolu",
            "alan": "stok",
            "tur": "stok_bitti",
            "eski": "9",
            "yeni": "0",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "EV-1009",
            "ad": "Doğrayıcı 500 ml Cam Hazneli",
            "tedarikci": "ege",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "769.9",
            "yeni": "799.9",
            "yuzde": 3.9,
            "not": "alış 493,78 TRY → kural varsayilan"
        },
        {
            "urun": "EV-1009",
            "ad": "Doğrayıcı 500 ml Cam Hazneli",
            "tedarikci": "ege",
            "alan": "tedarikci",
            "tur": "tedarikci",
            "eski": "anadolu",
            "yeni": "ege",
            "yuzde": null,
            "not": "Anadolu Toptan → Ege Dağıtım (en uygun stoklu kaynak)"
        },
        {
            "urun": "EV-1009",
            "ad": "Doğrayıcı 500 ml Cam Hazneli",
            "tedarikci": "ege",
            "alan": "stok",
            "tur": "stok",
            "eski": "22",
            "yeni": "29",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "EV-1011",
            "ad": "Mini Fırın 36 L Turbo",
            "tedarikci": "anadolu",
            "alan": "fiyat",
            "tur": "onay",
            "eski": "4289.9",
            "yeni": "5999.9",
            "yuzde": 39.86,
            "not": "Büyük zam (%39,86) — fiyat yazılmadı, onay bekliyor"
        },
        {
            "urun": "EV-1012",
            "ad": "Waffle Makinesi Çift",
            "tedarikci": "anadolu",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "1149.9",
            "yeni": "1199.9",
            "yuzde": 4.35,
            "not": "alış 752,40 TRY → kural varsayilan"
        },
        {
            "urun": "BL-3002",
            "ad": "Mekanik Klavye TR Q RGB",
            "tedarikci": "marmara",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "1419.9",
            "yeni": "1429.9",
            "yuzde": 0.7,
            "not": "alış 17,50 EUR → kural kategori:Bilgisayar"
        },
        {
            "urun": "BL-3003",
            "ad": "USB 3.2 Flash Bellek 64 GB",
            "tedarikci": "marmara",
            "alan": "tedarikci",
            "tur": "tedarikci",
            "eski": "anadolu",
            "yeni": "marmara",
            "yuzde": null,
            "not": "Anadolu Toptan → Marmara Elektronik (en uygun stoklu kaynak)"
        },
        {
            "urun": "BL-3003",
            "ad": "USB 3.2 Flash Bellek 64 GB",
            "tedarikci": "marmara",
            "alan": "stok",
            "tur": "stok",
            "eski": "50",
            "yeni": "4",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "YS-5001",
            "ad": "LED Masa Lambası Dokunmatik",
            "tedarikci": "anadolu",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "479.9",
            "yeni": "499.9",
            "yuzde": 4.17,
            "not": "alış 302,11 TRY → kural varsayilan"
        },
        {
            "urun": "YS-5002",
            "ad": "Akıllı Priz Wi-Fi Enerji Ölçer",
            "tedarikci": "anadolu",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "399.9",
            "yeni": "419.9",
            "yuzde": 5.0,
            "not": "alış 250,80 TRY → kural varsayilan"
        },
        {
            "urun": "KB-4002",
            "ad": "Islak Kuru Tıraş Makinesi",
            "tedarikci": "ege",
            "alan": "fiyat",
            "tur": "indirim",
            "eski": "1929.9",
            "yeni": "1779.9",
            "yuzde": -7.77,
            "not": "alış 1.122,43 TRY → kural varsayilan"
        },
        {
            "urun": "KB-4004",
            "ad": "Dijital Banyo Tartısı",
            "tedarikci": "global",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "429.9",
            "yeni": "439.9",
            "yuzde": 2.33,
            "not": "alış 5,35 USD → kural tedarikci:global"
        },
        {
            "urun": "KB-4005",
            "ad": "Saç Kesme Makinesi Şarjlı",
            "tedarikci": "ege",
            "alan": "fiyat",
            "tur": "onay",
            "eski": "1209.9",
            "yeni": "1609.9",
            "yuzde": 33.06,
            "not": "Büyük zam (%33,06) — fiyat yazılmadı, onay bekliyor"
        },
        {
            "urun": "YS-5003",
            "ad": "Akım Korumalı Uzatma 5'li",
            "tedarikci": "ege",
            "alan": "fiyat",
            "tur": "indirim",
            "eski": "379.9",
            "yeni": "349.9",
            "yuzde": -7.9,
            "not": "alış 204,97 TRY → kural varsayilan"
        },
        {
            "urun": "YS-5004",
            "ad": "Çelik Termos 500 ml",
            "tedarikci": "ege",
            "alan": "fiyat",
            "tur": "indirim",
            "eski": "325.9",
            "yeni": "299.9",
            "yuzde": -7.98,
            "not": "alış 176,65 TRY → kural varsayilan"
        },
        {
            "urun": "YS-5004",
            "ad": "Çelik Termos 500 ml",
            "tedarikci": "ege",
            "alan": "durum",
            "tur": "aktif",
            "eski": "0",
            "yeni": "1",
            "yuzde": null,
            "not": "Stok geldi, ürün yeniden yayında"
        },
        {
            "urun": "YS-5004",
            "ad": "Çelik Termos 500 ml",
            "tedarikci": "ege",
            "alan": "stok",
            "tur": "stok_geldi",
            "eski": "0",
            "yeni": "38",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "YS-5006",
            "ad": "Hareket Sensörlü Dolap Işığı 3'lü",
            "tedarikci": "global",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "249.9",
            "yeni": "259.9",
            "yuzde": 4.0,
            "not": "alış 2,94 USD → kural tedarikci:global"
        },
        {
            "urun": "YS-5007",
            "ad": "Dijital Mutfak Tartısı",
            "tedarikci": "ege",
            "alan": "durum",
            "tur": "pasif",
            "eski": "1",
            "yeni": "0",
            "yuzde": null,
            "not": "Tüm tedarikçilerde stok bitti, ürün pasife alındı"
        },
        {
            "urun": "YS-5007",
            "ad": "Dijital Mutfak Tartısı",
            "tedarikci": "ege",
            "alan": "stok",
            "tur": "stok_bitti",
            "eski": "17",
            "yeni": "0",
            "yuzde": null,
            "not": null
        },
        {
            "urun": "BL-3004",
            "ad": "NVMe SSD 512 GB",
            "tedarikci": "global",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "1849.9",
            "yeni": "1859.9",
            "yuzde": 0.54,
            "not": "alış 26,80 USD → kural kategori:Bilgisayar"
        },
        {
            "urun": "BL-3005",
            "ad": "Webcam 1080p Mikrofonlu",
            "tedarikci": "global",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "889.9",
            "yeni": "899.9",
            "yuzde": 1.12,
            "not": "alış 12,65 USD → kural kategori:Bilgisayar"
        },
        {
            "urun": "BL-3007",
            "ad": "Mousepad XL 90x40",
            "tedarikci": "marmara",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "239.9",
            "yeni": "249.9",
            "yuzde": 4.17,
            "not": "alış 2,58 EUR → kural kategori:Bilgisayar"
        },
        {
            "urun": "BL-3010",
            "ad": "Oyuncu Kulaklığı 7.1",
            "tedarikci": "marmara",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "1289.9",
            "yeni": "1299.9",
            "yuzde": 0.78,
            "not": "alış 15,85 EUR → kural kategori:Bilgisayar"
        },
        {
            "urun": "TA-2004",
            "ad": "Kablosuz Kulak İçi Kulaklık ANC",
            "tedarikci": "global",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "1179.9",
            "yeni": "1189.9",
            "yuzde": 0.85,
            "not": "alış 13,50 USD → kural kategori:Telefon Aksesuar"
        },
        {
            "urun": "TA-2006",
            "ad": "Kablosuz Şarj Pedi 15W",
            "tedarikci": "global",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "429.9",
            "yeni": "439.9",
            "yuzde": 2.33,
            "not": "alış 4,79 USD → kural kategori:Telefon Aksesuar"
        },
        {
            "urun": "TA-2008",
            "ad": "Bluetooth Hoparlör 10W Suya Dayanıklı",
            "tedarikci": "global",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "899.9",
            "yeni": "909.9",
            "yuzde": 1.11,
            "not": "alış 10,28 USD → kural kategori:Telefon Aksesuar"
        },
        {
            "urun": "BL-3008",
            "ad": "USB-C Hub 7'si 1 Arada",
            "tedarikci": "global",
            "alan": "fiyat",
            "tur": "zam",
            "eski": "779.9",
            "yeni": "789.9",
            "yuzde": 1.28,
            "not": "alış 10,96 USD → kural kategori:Bilgisayar"
        }
    ],
    "onaylar": [
        {
            "id": 2,
            "urun": "EV-1011",
            "ad": "Mini Fırın 36 L Turbo",
            "tedarikci": "anadolu",
            "eski": 4289.9,
            "yeni": 5999.9,
            "yuzde": 39.86,
            "alis_tl": 3828.7,
            "tarih": "2026-09-28 13:33:05"
        },
        {
            "id": 3,
            "urun": "KB-4005",
            "ad": "Saç Kesme Makinesi Şarjlı",
            "tedarikci": "ege",
            "eski": 1209.9,
            "yeni": 1609.9,
            "yuzde": 33.06,
            "alis_tl": 1013.62,
            "tarih": "2026-09-28 13:33:05"
        },
        {
            "id": 1,
            "urun": "TA-2007",
            "ad": "Temperli Ekran Koruyucu 2'li",
            "tedarikci": "marmara",
            "eski": 70.9,
            "yeni": 88.9,
            "yuzde": 25.39,
            "alis_tl": 37.98,
            "tarih": "2026-09-28 13:18:03"
        }
    ],
    "urunler": [
        {
            "anahtar": "EV-1001",
            "ad": "Tost Makinesi 1800W Granit Plaka",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "anadolu",
            "pb": "TRY",
            "alis": 920.75,
            "alis_tl": 920.75,
            "eski_fiyat": 1399.9,
            "fiyat": 1469.9,
            "hesaplanan": 1469.9,
            "kural": "varsayilan",
            "stok": 38,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 920.75,
                    "stok": 38
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1002",
            "ad": "Cam Kettle 1.7 L LED Işıklı",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "anadolu",
            "pb": "TRY",
            "alis": 569.94,
            "alis_tl": 569.94,
            "eski_fiyat": 879.9,
            "fiyat": 919.9,
            "hesaplanan": 919.9,
            "kural": "varsayilan",
            "stok": 51,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 569.94,
                    "stok": 51
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1003",
            "ad": "Smoothie Blender 600W",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": null,
            "pb": null,
            "alis": null,
            "alis_tl": null,
            "eski_fiyat": 1249.9,
            "fiyat": 1249.9,
            "hesaplanan": null,
            "kural": null,
            "stok": 0,
            "aktif": false,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 818.03,
                    "stok": 0
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1004",
            "ad": "Filtre Kahve Makinesi 1.25 L",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "anadolu",
            "pb": "TRY",
            "alis": 1003.62,
            "alis_tl": 1003.62,
            "eski_fiyat": 1529.9,
            "fiyat": 1589.9,
            "hesaplanan": 1589.9,
            "kural": "varsayilan",
            "stok": 17,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 1003.62,
                    "stok": 17
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1005",
            "ad": "Airfryer 4.5 L Dijital",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 2236.64,
            "alis_tl": 2236.64,
            "eski_fiyat": 3379.9,
            "fiyat": 3519.9,
            "hesaplanan": 3519.9,
            "kural": "varsayilan",
            "stok": 37,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 2246.75,
                    "stok": 30
                },
                {
                    "t": "ege",
                    "tl": 2236.64,
                    "stok": 37
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1006",
            "ad": "Buharlı Ütü 2400W Seramik Taban",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 1188.21,
            "alis_tl": 1188.21,
            "eski_fiyat": 1809.9,
            "fiyat": 1879.9,
            "hesaplanan": 1879.9,
            "kural": "varsayilan",
            "stok": 50,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 1193.81,
                    "stok": 0
                },
                {
                    "t": "ege",
                    "tl": 1188.21,
                    "stok": 50
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1007",
            "ad": "Dikey Şarjlı Süpürge 22.2V",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 3411.77,
            "alis_tl": 3411.77,
            "eski_fiyat": 5139.9,
            "fiyat": 5349.9,
            "hesaplanan": 5349.9,
            "kural": "varsayilan",
            "stok": 3,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 3426.14,
                    "stok": 56
                },
                {
                    "t": "ege",
                    "tl": 3411.77,
                    "stok": 3
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1008",
            "ad": "El Mikseri 5 Kademe",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": null,
            "pb": null,
            "alis": null,
            "alis_tl": null,
            "eski_fiyat": 969.9,
            "fiyat": 969.9,
            "hesaplanan": null,
            "kural": null,
            "stok": 0,
            "aktif": false,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 631.08,
                    "stok": 0
                },
                {
                    "t": "ege",
                    "tl": 628.3,
                    "stok": 0
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1009",
            "ad": "Doğrayıcı 500 ml Cam Hazneli",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 493.78,
            "alis_tl": 493.78,
            "eski_fiyat": 769.9,
            "fiyat": 799.9,
            "hesaplanan": 799.9,
            "kural": "varsayilan",
            "stok": 29,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 496.06,
                    "stok": 22
                },
                {
                    "t": "ege",
                    "tl": 493.78,
                    "stok": 29
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1010",
            "ad": "Türk Kahvesi Makinesi Köpük Sensörlü",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 1338.79,
            "alis_tl": 1338.79,
            "eski_fiyat": 2119.9,
            "fiyat": 2119.9,
            "hesaplanan": 2119.9,
            "kural": "varsayilan",
            "stok": 42,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 1442.31,
                    "stok": 35
                },
                {
                    "t": "ege",
                    "tl": 1338.79,
                    "stok": 42
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1011",
            "ad": "Mini Fırın 36 L Turbo",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "anadolu",
            "pb": "TRY",
            "alis": 3828.7,
            "alis_tl": 3828.7,
            "eski_fiyat": 4289.9,
            "fiyat": 4289.9,
            "hesaplanan": 5999.9,
            "kural": "varsayilan",
            "stok": 48,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 3828.7,
                    "stok": 48
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "EV-1012",
            "ad": "Waffle Makinesi Çift",
            "kategori": "Küçük Ev Aletleri",
            "tedarikci": "anadolu",
            "pb": "TRY",
            "alis": 752.4,
            "alis_tl": 752.4,
            "eski_fiyat": 1149.9,
            "fiyat": 1199.9,
            "hesaplanan": 1199.9,
            "kural": "varsayilan",
            "stok": 61,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 752.4,
                    "stok": 61
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2001",
            "ad": "Hızlı Şarj Adaptörü 20W USB-C",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 2.87,
            "alis_tl": 133.23,
            "eski_fiyat": 269.9,
            "fiyat": 269.9,
            "hesaplanan": 269.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 35,
            "aktif": true,
            "aday_sayisi": 3,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 154.56,
                    "stok": 14
                },
                {
                    "t": "marmara",
                    "tl": 137.84,
                    "stok": 28
                },
                {
                    "t": "global",
                    "tl": 133.23,
                    "stok": 35
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2002",
            "ad": "USB-C Örgülü Kablo 1 m",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 1.25,
            "alis_tl": 58.03,
            "eski_fiyat": 129.9,
            "fiyat": 129.9,
            "hesaplanan": 129.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 48,
            "aktif": true,
            "aday_sayisi": 3,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 62.85,
                    "stok": 27
                },
                {
                    "t": "marmara",
                    "tl": 60.15,
                    "stok": 41
                },
                {
                    "t": "global",
                    "tl": 58.03,
                    "stok": 48
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2003",
            "ad": "Powerbank 10.000 mAh PD",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "marmara",
            "pb": "TRY",
            "alis": 405.82,
            "alis_tl": 405.82,
            "eski_fiyat": 779.9,
            "fiyat": 779.9,
            "hesaplanan": 779.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 54,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 424.17,
                    "stok": 40
                },
                {
                    "t": "marmara",
                    "tl": 405.82,
                    "stok": 54
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3001",
            "ad": "Kablosuz Sessiz Mouse",
            "kategori": "Bilgisayar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 3.62,
            "alis_tl": 168.05,
            "eski_fiyat": 289.9,
            "fiyat": 289.9,
            "hesaplanan": 289.9,
            "kural": "kategori:Bilgisayar",
            "stok": 45,
            "aktif": true,
            "aday_sayisi": 3,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 195.26,
                    "stok": 24
                },
                {
                    "t": "marmara",
                    "tl": 187.9,
                    "stok": 38
                },
                {
                    "t": "global",
                    "tl": 168.05,
                    "stok": 45
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3002",
            "ad": "Mekanik Klavye TR Q RGB",
            "kategori": "Bilgisayar",
            "tedarikci": "marmara",
            "pb": "EUR",
            "alis": 17.5,
            "alis_tl": 947.64,
            "eski_fiyat": 1419.9,
            "fiyat": 1429.9,
            "hesaplanan": 1429.9,
            "kural": "kategori:Bilgisayar",
            "stok": 51,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 1487.3,
                    "stok": 37
                },
                {
                    "t": "marmara",
                    "tl": 947.64,
                    "stok": 51
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3003",
            "ad": "USB 3.2 Flash Bellek 64 GB",
            "kategori": "Bilgisayar",
            "tedarikci": "marmara",
            "pb": "EUR",
            "alis": 2.28,
            "alis_tl": 123.46,
            "eski_fiyat": 219.9,
            "fiyat": 219.9,
            "hesaplanan": 219.9,
            "kural": "kategori:Bilgisayar",
            "stok": 4,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 128.01,
                    "stok": 50
                },
                {
                    "t": "marmara",
                    "tl": 123.46,
                    "stok": 4
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "YS-5001",
            "ad": "LED Masa Lambası Dokunmatik",
            "kategori": "Ev & Yaşam",
            "tedarikci": "anadolu",
            "pb": "TRY",
            "alis": 302.11,
            "alis_tl": 302.11,
            "eski_fiyat": 479.9,
            "fiyat": 499.9,
            "hesaplanan": 499.9,
            "kural": "varsayilan",
            "stok": 52,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 302.11,
                    "stok": 52
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "YS-5002",
            "ad": "Akıllı Priz Wi-Fi Enerji Ölçer",
            "kategori": "Ev & Yaşam",
            "tedarikci": "anadolu",
            "pb": "TRY",
            "alis": 250.8,
            "alis_tl": 250.8,
            "eski_fiyat": 399.9,
            "fiyat": 419.9,
            "hesaplanan": 419.9,
            "kural": "varsayilan",
            "stok": 5,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "anadolu",
                    "tl": 250.8,
                    "stok": 5
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "KB-4001",
            "ad": "Seramik Saç Düzleştirici",
            "kategori": "Kişisel Bakım",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 717.81,
            "alis_tl": 717.81,
            "eski_fiyat": 1149.9,
            "fiyat": 1149.9,
            "hesaplanan": 1149.9,
            "kural": "varsayilan",
            "stok": 41,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 717.81,
                    "stok": 41
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "KB-4002",
            "ad": "Islak Kuru Tıraş Makinesi",
            "kategori": "Kişisel Bakım",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 1122.43,
            "alis_tl": 1122.43,
            "eski_fiyat": 1929.9,
            "fiyat": 1779.9,
            "hesaplanan": 1779.9,
            "kural": "varsayilan",
            "stok": 54,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 1122.43,
                    "stok": 54
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "KB-4003",
            "ad": "Şarjlı Diş Fırçası 2 Başlıklı",
            "kategori": "Kişisel Bakım",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 545.08,
            "alis_tl": 545.08,
            "eski_fiyat": 879.9,
            "fiyat": 879.9,
            "hesaplanan": 879.9,
            "kural": "varsayilan",
            "stok": 7,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 545.08,
                    "stok": 7
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "KB-4004",
            "ad": "Dijital Banyo Tartısı",
            "kategori": "Kişisel Bakım",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 5.35,
            "alis_tl": 248.36,
            "eski_fiyat": 429.9,
            "fiyat": 439.9,
            "hesaplanan": 439.9,
            "kural": "tedarikci:global",
            "stok": 34,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 283.87,
                    "stok": 20
                },
                {
                    "t": "global",
                    "tl": 248.36,
                    "stok": 34
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "KB-4005",
            "ad": "Saç Kesme Makinesi Şarjlı",
            "kategori": "Kişisel Bakım",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 1013.62,
            "alis_tl": 1013.62,
            "eski_fiyat": 1209.9,
            "fiyat": 1209.9,
            "hesaplanan": 1609.9,
            "kural": "varsayilan",
            "stok": 33,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 1013.62,
                    "stok": 33
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "KB-4006",
            "ad": "Saç Kurutma Makinesi 2200W İyonik",
            "kategori": "Kişisel Bakım",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 829.25,
            "alis_tl": 829.25,
            "eski_fiyat": 1319.9,
            "fiyat": 1319.9,
            "hesaplanan": 1319.9,
            "kural": "varsayilan",
            "stok": 46,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 829.25,
                    "stok": 46
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "YS-5003",
            "ad": "Akım Korumalı Uzatma 5'li",
            "kategori": "Ev & Yaşam",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 204.97,
            "alis_tl": 204.97,
            "eski_fiyat": 379.9,
            "fiyat": 349.9,
            "hesaplanan": 349.9,
            "kural": "varsayilan",
            "stok": 25,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 204.97,
                    "stok": 25
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "YS-5004",
            "ad": "Çelik Termos 500 ml",
            "kategori": "Ev & Yaşam",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 176.65,
            "alis_tl": 176.65,
            "eski_fiyat": 325.9,
            "fiyat": 299.9,
            "hesaplanan": 299.9,
            "kural": "varsayilan",
            "stok": 38,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 176.65,
                    "stok": 38
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "YS-5005",
            "ad": "Hava Nemlendirici Ultrasonik",
            "kategori": "Ev & Yaşam",
            "tedarikci": "ege",
            "pb": "TRY",
            "alis": 628.3,
            "alis_tl": 628.3,
            "eski_fiyat": 1009.9,
            "fiyat": 1009.9,
            "hesaplanan": 1009.9,
            "kural": "varsayilan",
            "stok": 51,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 628.3,
                    "stok": 51
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "YS-5006",
            "ad": "Hareket Sensörlü Dolap Işığı 3'lü",
            "kategori": "Ev & Yaşam",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 2.94,
            "alis_tl": 136.48,
            "eski_fiyat": 249.9,
            "fiyat": 259.9,
            "hesaplanan": 259.9,
            "kural": "tedarikci:global",
            "stok": 18,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 157.59,
                    "stok": 4
                },
                {
                    "t": "global",
                    "tl": 136.48,
                    "stok": 18
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "YS-5007",
            "ad": "Dijital Mutfak Tartısı",
            "kategori": "Ev & Yaşam",
            "tedarikci": null,
            "pb": null,
            "alis": null,
            "alis_tl": null,
            "eski_fiyat": 289.9,
            "fiyat": 289.9,
            "hesaplanan": null,
            "kural": null,
            "stok": 0,
            "aktif": false,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "ege",
                    "tl": 164.85,
                    "stok": 0
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3004",
            "ad": "NVMe SSD 512 GB",
            "kategori": "Bilgisayar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 26.8,
            "alis_tl": 1244.1,
            "eski_fiyat": 1849.9,
            "fiyat": 1859.9,
            "hesaplanan": 1859.9,
            "kural": "kategori:Bilgisayar",
            "stok": 24,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 1298.53,
                    "stok": 17
                },
                {
                    "t": "global",
                    "tl": 1244.1,
                    "stok": 24
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3005",
            "ad": "Webcam 1080p Mikrofonlu",
            "kategori": "Bilgisayar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 12.65,
            "alis_tl": 587.24,
            "eski_fiyat": 889.9,
            "fiyat": 899.9,
            "hesaplanan": 899.9,
            "kural": "kategori:Bilgisayar",
            "stok": 37,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 612.44,
                    "stok": 30
                },
                {
                    "t": "global",
                    "tl": 587.24,
                    "stok": 37
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3006",
            "ad": "Alüminyum Laptop Standı",
            "kategori": "Bilgisayar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 6.66,
            "alis_tl": 309.17,
            "eski_fiyat": 489.9,
            "fiyat": 489.9,
            "hesaplanan": 489.9,
            "kural": "kategori:Bilgisayar",
            "stok": 50,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 322.2,
                    "stok": 43
                },
                {
                    "t": "global",
                    "tl": 309.17,
                    "stok": 50
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3007",
            "ad": "Mousepad XL 90x40",
            "kategori": "Bilgisayar",
            "tedarikci": "marmara",
            "pb": "EUR",
            "alis": 2.58,
            "alis_tl": 139.71,
            "eski_fiyat": 239.9,
            "fiyat": 249.9,
            "hesaplanan": 249.9,
            "kural": "kategori:Bilgisayar",
            "stok": 56,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 139.71,
                    "stok": 56
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3009",
            "ad": "Harici Disk Kutusu 2.5 inç",
            "kategori": "Bilgisayar",
            "tedarikci": "marmara",
            "pb": "EUR",
            "alis": 3.75,
            "alis_tl": 203.07,
            "eski_fiyat": 339.9,
            "fiyat": 339.9,
            "hesaplanan": 339.9,
            "kural": "kategori:Bilgisayar",
            "stok": 22,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 203.07,
                    "stok": 22
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3010",
            "ad": "Oyuncu Kulaklığı 7.1",
            "kategori": "Bilgisayar",
            "tedarikci": "marmara",
            "pb": "EUR",
            "alis": 15.85,
            "alis_tl": 858.29,
            "eski_fiyat": 1289.9,
            "fiyat": 1299.9,
            "hesaplanan": 1299.9,
            "kural": "kategori:Bilgisayar",
            "stok": 35,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 858.29,
                    "stok": 35
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2004",
            "ad": "Kablosuz Kulak İçi Kulaklık ANC",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 13.5,
            "alis_tl": 626.69,
            "eski_fiyat": 1179.9,
            "fiyat": 1189.9,
            "hesaplanan": 1189.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 14,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 696.49,
                    "stok": 7
                },
                {
                    "t": "global",
                    "tl": 626.69,
                    "stok": 14
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2005",
            "ad": "Araç İçi Manyetik Telefon Tutucu",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "marmara",
            "pb": "TRY",
            "alis": 113.33,
            "alis_tl": 113.33,
            "eski_fiyat": 229.9,
            "fiyat": 229.9,
            "hesaplanan": 229.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 20,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 113.33,
                    "stok": 20
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2006",
            "ad": "Kablosuz Şarj Pedi 15W",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 4.79,
            "alis_tl": 222.36,
            "eski_fiyat": 429.9,
            "fiyat": 439.9,
            "hesaplanan": 439.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 40,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 230.3,
                    "stok": 33
                },
                {
                    "t": "global",
                    "tl": 222.36,
                    "stok": 40
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2007",
            "ad": "Temperli Ekran Koruyucu 2'li",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "marmara",
            "pb": "TRY",
            "alis": 37.98,
            "alis_tl": 37.98,
            "eski_fiyat": 70.9,
            "fiyat": 70.9,
            "hesaplanan": 88.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 46,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 37.98,
                    "stok": 46
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2008",
            "ad": "Bluetooth Hoparlör 10W Suya Dayanıklı",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 10.28,
            "alis_tl": 477.22,
            "eski_fiyat": 899.9,
            "fiyat": 909.9,
            "hesaplanan": 909.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 6,
            "aktif": true,
            "aday_sayisi": 2,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 494.31,
                    "stok": 59
                },
                {
                    "t": "global",
                    "tl": 477.22,
                    "stok": 6
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2009",
            "ad": "Akıllı Saat Silikon Kordon",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "marmara",
            "pb": "TRY",
            "alis": 53.36,
            "alis_tl": 53.36,
            "eski_fiyat": 119.9,
            "fiyat": 119.9,
            "hesaplanan": 119.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 12,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 53.36,
                    "stok": 12
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "TA-2010",
            "ad": "Çift Portlu Araç Şarjı 38W",
            "kategori": "Telefon Aksesuar",
            "tedarikci": "marmara",
            "pb": "TRY",
            "alis": 166.29,
            "alis_tl": 166.29,
            "eski_fiyat": 329.9,
            "fiyat": 329.9,
            "hesaplanan": 329.9,
            "kural": "kategori:Telefon Aksesuar",
            "stok": 25,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "marmara",
                    "tl": 166.29,
                    "stok": 25
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "BL-3008",
            "ad": "USB-C Hub 7'si 1 Arada",
            "kategori": "Bilgisayar",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 10.96,
            "alis_tl": 508.78,
            "eski_fiyat": 779.9,
            "fiyat": 789.9,
            "hesaplanan": 789.9,
            "kural": "kategori:Bilgisayar",
            "stok": 16,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "global",
                    "tl": 508.78,
                    "stok": 16
                }
            ],
            "durum": "ok"
        },
        {
            "anahtar": "YS-5008",
            "ad": "Kablosuz Kapı Zili",
            "kategori": "Ev & Yaşam",
            "tedarikci": "global",
            "pb": "USD",
            "alis": 4.69,
            "alis_tl": 217.72,
            "eski_fiyat": 389.9,
            "fiyat": 389.9,
            "hesaplanan": 389.9,
            "kural": "tedarikci:global",
            "stok": 44,
            "aktif": true,
            "aday_sayisi": 1,
            "adaylar": [
                {
                    "t": "global",
                    "tl": 217.72,
                    "stok": 44
                }
            ],
            "durum": "ok"
        }
    ]
};
