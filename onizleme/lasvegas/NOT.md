# Las Vegas Bilardo Salonu - önizleme notları (iç kullanım)

Canlı adres: https://furkistein.github.io/boztasdigital/onizleme/lasvegas/
Bu sayfa işletmenin onayı olmadan hazırlanmış örnek önizlemedir (üstte şerit, altta not, noindex,nofollow).

## Bilinen gerçekler (sayfada kullanılanlar)
- Ad: Las Vegas Bilardo Salonu (eski Cleon Adore kafe, yeni açıldı)
- Adres: Kınıklı Mah. Hüseyin Yılmaz Cad. No:68/A, Pamukkale/Denizli, Pamukkale Üniversitesi kampüsünün yanı
- 3 kat; profesyonel bilardo, okey, masa tenisi, kafe; turnuvalar yapılıyor
- Instagram: @lsvegas.gamecenter
- Logo: verilen logo dosyaları (img/amblem.png, logo-1000.png, logo-360.png; hafif webp kopyaları da var)

## Yer tutucular: gerçek bilgi gelince doldurulacak
| Ne | Nerede | Not |
|---|---|---|
| WhatsApp numarası | js/main.js, en üstte `WA_NUMARA` | Ülke kodlu, artısız, boşluksuz: "905xxxxxxxxx". Boşken düğme numarasız wa.me açar. Başka yerde numara yok. |
| Fotoğraflar (6 çerçeve) | index.html, #foto bölümü, `.kare.g1` ... `.g6` | Çerçeveyi `<img>` ile değiştir; `.kare` içinde `object-fit:cover`. Önerilen adlar aşağıda. |
| Oyun çizimleri | index.html, #oyunlar (bilardo, okey, masa tenisi SVG) | Düz çizimdir; gerçek fotoğraf gelirse `<svg>` yerine `<img>` konabilir. |
| Hero logosu | index.html, `.hero-logo` | Logo gerçek dosya. İstenirse yanına/yerine mekân fotoğrafı eklenebilir. |
| Turnuva takvimi | index.html, #turnuvalar, `.takvim` tablosundaki 4 satır (`.bos` kutuları) | Tarih, turnuva adı, oyun, kayıt bilgisi. Eşleşme ağacı (SVG) turnuva günü doldurulur. |
| Kat içerikleri | index.html, #katlar, `.kat.k1/.k2/.k3` içindeki "İçeriği sizinle doldururuz" | Hangi katta ne olduğu bilinmiyor; uydurulmadı. |
| Çalışma saatleri | Sayfada yok (bilinmiyor) | Gelince konum bölümüne eklenir. |
| Yol tarifi | index.html, #konum, `.yol-bos` | Yürüyerek/toplu taşıma adımları. |
| Harita bağlantısı | index.html, 4 yerde aynı arama bağlantısı | Salonun Google Haritalar sayfası bulunursa o bağlantıyla değiştirilebilir. |

## Önerilen fotoğraf dosya adları (img/ içine)
- foto-salon-girisi.jpg (g1, geniş, yatay)
- foto-bilardo-masalari.jpg (g2)
- foto-okey-masasi.jpg (g3)
- foto-masa-tenisi.jpg (g4)
- foto-kafe.jpg (g5)
- foto-bina-ve-katlar.jpg (g6)
Yatay 3:2 civarı, 1600 px genişlik, webp tercih edilir; hepsine anlamlı `alt` yazılmalı.

## Kurallar (bu önizleme için uygulandı)
- Üretilmiş (yapay) görsel yok; tüm çizimler elle yazılmış SVG, logo verilen dosya.
- Nargile yok, uydurma sayı/yorum/puan/saat/telefon yok.
- Dış kaynak (CDN) yok; yazı tipleri yerelde (Big Shoulders Display, Figtree; ikisi de SIL OFL, lisans dosyaları fonts/ içinde).
- Hareket azaltma tercihi (`prefers-reduced-motion`) destekli; JS kapalıyken içerik görünür.

## Teknik
- Düz HTML + CSS + JS; derleme yok. Yerelde `python -m http.server` ile açılır.
- Test: mobil_test (375/390) geçti, konsol hatası 0, yatay taşma 0, metin kontrastı 4.5:1 ve üzeri.
