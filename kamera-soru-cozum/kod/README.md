# Kamera Soru Çözüm

IP kameranın (RTSP/HTTP) ya da webcam'in gördüğü soruyu Gemini ile çözer, cevabı görüntünün üstüne yazar ve `cevaplar.log` dosyasına kaydeder.

## Kurulum

Python 3.9 veya üstü gerekir.

```
pip install opencv-python requests pytest
```

Gemini API anahtarınızı ortam değişkeni olarak verin (koda yazılmaz):

```
# Windows cmd
set GEMINI_API_KEY=anahtariniz
# PowerShell
$env:GEMINI_API_KEY="anahtariniz"
# Linux / macOS
export GEMINI_API_KEY=anahtariniz
```

## Çalıştırma

```
python soru_cozucu.py 0                                             # webcam
python soru_cozucu.py rtsp://kullanici:sifre@192.168.1.20/stream1   # IP kamera, 10 sn'de bir
python soru_cozucu.py http://192.168.1.21:8080/video --aralik 5     # 5 sn'de bir
python soru_cozucu.py 0 --elle                                      # yalnız boşluk tuşuyla sor
python soru_cozucu.py rtsp://... --pencere-yok                      # ekransız (sunucu)
```

Pencerede: **boşluk** = şimdi sor, **q** ya da **Esc** = çık.

| Seçenek | Anlamı |
|---|---|
| `--aralik N` | Otomatik soru aralığı, saniye (varsayılan 10) |
| `--elle` | Otomatik sorma, yalnız tuşla |
| `--esik N` | "Aynı kare" eşiği, 0-64 (varsayılan 5; küçük = daha hassas) |
| `--model` | Gemini modeli (varsayılan `gemini-2.0-flash`) |
| `--log DOSYA` | Cevap günlüğü (varsayılan `cevaplar.log`) |
| `--en-fazla-deneme N` | Yeniden bağlanma sınırı (varsayılan sınırsız) |

Aynı kare tekrar sorulmaz; bağlantı koparsa betik üstel bekleyerek yeniden bağlanır. Not: OpenCV'nin yazı tipi Türkçe harfleri çizemediği için pencere üstündeki bindirmede `ç ğ ı ö ş ü` sadeleştirilir; `cevaplar.log` dosyasında metin olduğu gibi kalır.

## Test

```
python -m pytest test_soru_cozucu.py -q
```

Testler Gemini'yi ve kamerayı taklit eder; internet ya da kamera gerekmez.
