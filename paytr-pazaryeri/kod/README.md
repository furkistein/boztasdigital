# Rezervasyon uygulaması için PayTR Pazaryeri entegrasyonu (örnek kod)

Müşteri rezervasyonu **platformda** öder (PayTR iFrame). Ödeme PayTR'den gelen **bildirimle (callback)** doğrulanınca
rezervasyon onaylanır. Tutarın işletmeye düşen kısmı **PayTR Platform Transfer** ile işletmenin IBAN'ına gönderilir,
**platform komisyonu** sizde kalır. İptal olursa **İade API** kullanılır.

```
Müşteri ──ödeme──▶ PayTR iFrame ──callback (hash)──▶ /paytr/bildirim ──▶ rezervasyon ONAY
                                                           │
                                   komisyon bölüşümü (kuruş, tamsayı)
                                                           ▼
             ertesi iş günü ──▶ /yonetim/transferleri-gonder ──▶ PayTR platform/transfer ──▶ işletme IBAN
                                                           ▼
                                   /paytr/transfer-sonuc (hash) ──▶ transfer TAMAMLANDI
```

## Dosyalar

| Dosya | Görev |
|---|---|
| `paytr.js` | Bağımlılıksız modül: token üretimi, callback doğrulama, platform transfer, transfer sonucu doğrulama, iade, kuruş/komisyon/IBAN yardımcıları |
| `server.js` | Express örneği: rezervasyon → ödeme → callback → onay → transfer → iade |
| `test/paytr.test.js` | Hash'lerin üç bağımsız yoldan (Node crypto, Web Crypto, Python ile önceden hesaplanmış vektör) eşitliği, sahte callback reddi, kuruş/komisyon doğruluğu |
| `test/akis.test.js` | Sunucunun uçtan uca akış testi (simülasyon modunda, PayTR'ye istek atmaz) |
| `.env.example` | Gereken ayarlar (anahtarlar boş) |

## Kurulum (Replit)

1. Dosyaları projenize kopyalayın (`paytr.js` tek başına da kullanılabilir; Express şart değil).
2. Shell: `npm install` (yalnızca `express`).
3. **Anahtarlar:** Replit'te sol menüden **Secrets** (kilit simgesi) → her biri için "New secret":
   `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT`, `PAYTR_TEST_MODE=1`, `SITE_URL`
   (ör. `https://projeniz.replit.app`), `PLATFORM_KOMISYON_YUZDE`, `YONETIM_ANAHTARI` (uzun rastgele metin).
   Secrets, kodda `process.env.X` olarak okunur. Anahtarı **asla** koda, `.replit` dosyasına ya da depoya yazmayın.
   Replit AI'a kod yazdırırken de anahtarı sohbete yapıştırmayın.
4. PayTR Mağaza Paneli → Destek & Kurulum / Ayarlar:
   - **Bildirim URL**: `https://projeniz.replit.app/paytr/bildirim`
   - **Platform Transfer Sonuç Bildirim URL**: `https://projeniz.replit.app/paytr/transfer-sonuc`
   Bildirim URL'nin dışarıdan erişilebilir ve HTTPS olması gerekir; Replit'in geliştirme önizleme adresi uyuyunca
   bildirim kaçar, **Deploy** edilmiş adresi kullanın.
5. `npm start`. `PAYTR_MERCHANT_ID` boşsa uygulama **simülasyon** modunda açılır: PayTR'ye istek atmaz, sahte ödeme
   ekranı gösterir ve callback'i örnek anahtarla kendisi imzalar. Anahtarları girince gerçek PayTR (test modu) devreye girer.
6. Transferler için günlük zamanlanmış görev (Replit Scheduled Deployment ya da harici cron), sabah **10:00'dan önce**:
   `POST /yonetim/transferleri-gonder` başlığında `x-yonetim-anahtari: <YONETIM_ANAHTARI>`.

## Test modu

- `PAYTR_TEST_MODE=1` → get-token'a `test_mode=1` gider; mağaza canlıdayken bile test işlemi yapılır, para çekilmez.
  PayTR'nin test kartları mağaza panelinde / belgede listelenir.
- `PAYTR_DEBUG=1` → eksik/yanlış alanda PayTR açıklayıcı hata döner (yalnız geliştirmede açın).
- Kodun kendi testleri: `npm test` (PayTR hesabı gerekmez).

## Önemli kurallar (belgeden)

- **Onay yalnızca bildirimle verilir.** `merchant_ok_url` sayfasına gelinmesi ödemenin alındığını göstermez.
- Callback hash'i doğrulanmadan hiçbir şey değiştirilmez; doğrulanınca yanıt **yalnızca düz metin `OK`** olmalıdır
  (başarısız ödemede de). Aynı sipariş için birden fazla bildirim gelebilir; kod zaten işlenmiş siparişe yalnız `OK` döner.
- Tüm tutarlar **kuruş** (TL × 100, tamsayı): `payment_amount`, callback `total_amount`, transfer `submerchant_amount` /
  `total_amount`. İstisna: iade `return_amount` **TL, nokta ayraçlı** (`"149.90"`).
- `total_amount` (callback), müşteri vade farklı taksit seçerse `payment_amount`'tan büyük olabilir.
- Transfer talebi **ödemenin yapıldığı gün verilemez**, en erken ertesi gün; istenen gün **saat 10:00'a kadar** gönderilmeli.
- `merchant_oid` benzersiz, alfanümerik, en çok 64 karakter; `trans_id` en çok 60 karakter.

## İmza (hash) özetleri

Hepsi `base64( HMAC-SHA256( anahtar = merchant_key, mesaj ) )`:

| İşlem | Uç nokta | mesaj |
|---|---|---|
| iFrame token | `POST https://www.paytr.com/odeme/api/get-token` | `merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode + merchant_salt` |
| Bildirim doğrulama | (sizin Bildirim URL'niz) | `merchant_oid + merchant_salt + status + total_amount` |
| Platform transfer | `POST https://www.paytr.com/odeme/platform/transfer` | `merchant_id + merchant_oid + trans_id + submerchant_amount + total_amount + transfer_name + transfer_iban + merchant_salt` |
| Transfer sonucu | (sizin Transfer Sonuç URL'niz) | `trans_ids + merchant_salt` |
| İade | `POST https://www.paytr.com/odeme/iade` | `merchant_id + merchant_oid + return_amount + merchant_salt` |

iFrame: `https://www.paytr.com/odeme/guvenli/<token>` + `https://www.paytr.com/js/iframeResizer.min.js`.

## Python / Flask kullanıyorsanız (eşdeğer)

```python
import base64, hashlib, hmac, json, os
from flask import Flask, request

KEY  = os.environ["PAYTR_MERCHANT_KEY"].encode()
SALT = os.environ["PAYTR_MERCHANT_SALT"]
MID  = os.environ["PAYTR_MERCHANT_ID"]

def imza(mesaj: str) -> str:
    return base64.b64encode(hmac.new(KEY, mesaj.encode("utf-8"), hashlib.sha256).digest()).decode()

def sepet(kalemler):  # [["Ürün", "18.00", 1]]
    return base64.b64encode(json.dumps(kalemler, ensure_ascii=False, separators=(",", ":")).encode()).decode()

def token_hash(user_ip, oid, email, kurus, basket, no_inst="0", max_inst="0", cur="TL", test="1"):
    return imza(f"{MID}{user_ip}{oid}{email}{kurus}{basket}{no_inst}{max_inst}{cur}{test}{SALT}")

def transfer_hash(oid, trans_id, isletme_kurus, toplam_kurus, ad, iban):
    return imza(f"{MID}{oid}{trans_id}{isletme_kurus}{toplam_kurus}{ad}{iban}{SALT}")

def iade_hash(oid, return_amount_tl):  # "149.90"
    return imza(f"{MID}{oid}{return_amount_tl}{SALT}")

def komisyon_bol(toplam_kurus: int, bps: int):  # %12,5 -> bps=1250 ; tamsayı, kuruş kaybı yok
    platform = (toplam_kurus * bps + 5000) // 10000
    return platform, toplam_kurus - platform

app = Flask(__name__)

@app.post("/paytr/bildirim")
def bildirim():
    p = request.form
    beklenen = imza(p["merchant_oid"] + SALT + p["status"] + p["total_amount"])
    if not hmac.compare_digest(beklenen, p.get("hash", "")):
        return "PAYTR notification failed: bad hash", 400
    # ... siparişi bul; zaten işlendiyse yalnız OK dön; status == "success" ise onayla ...
    return "OK", 200, {"Content-Type": "text/plain"}
```

`json.dumps` çıktısı Node `JSON.stringify` ile aynı olsun diye `ensure_ascii=False, separators=(",", ":")` kullanılır;
aksi halde `user_basket` farklı olur ve token reddedilir.

## Belgeden teyit edilecekler (bu örnekte varsayım yapılan yerler)

- **Transfer `total_amount`**: belgede "siparişin toplam ödeme tutarı (×100)". Kod, get-token'daki `payment_amount`'u
  gönderir. Müşteri vade farklı taksit seçtiğinde callback'teki `total_amount` farklı olabilir; hangisinin beklendiği
  PayTR destek/belgeden teyit edilmeli (örnekte taksit kapalı: `no_installment=1`).
- **Transfer sonuç bildirimi `trans_ids` biçimi**: belgede "trans_id değerlerini içeren JSON metni". Dizinin tam biçimi
  (düz dizi mi, nesne mi) canlı test bildirimiyle doğrulanmalı; hash doğrulaması biçimden bağımsız çalışır.
- **PayTR hizmet bedelinin hangi paydan düşüldüğü**: sözleşmeye bağlıdır, belgede sabit değer yok. Transfer cevabı
  `merchant_amount` ve `submerchant_amount` alanlarını döner; `merchant_amount`'un tam anlamı (platforma kalan net mi)
  belgeden/PayTR destekten teyit edilmeli.
- **Pazaryeri hesabının açılması**: Platform Transfer, PayTR'de pazaryeri çözümü tanımlı mağazada çalışır; mağaza
  panelinde etkin olduğunu PayTR ile teyit edin. Geri dönen (başarısız) transferler için ayrı "geri dönen ödemeler"
  servisleri vardır, bu örneğe dahil değildir.
- **Kısmi iade sonrası transfer**: kod, işletme payını iade sonrası tutardan yeniden hesaplar; PayTR'nin kısmi iadeli
  siparişte transfer üst sınırını nasıl uyguladığı canlı testle doğrulanmalı.
- İade API'sinin isteğe bağlı alanları (ör. referans numarası) bu örnekte kullanılmadı.

Bu depoda gerçek anahtar yoktur. `.env.example` yalnız alan adlarını gösterir.
