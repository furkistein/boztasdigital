/* Kına davetiyesi: TEK veri nesnesi. Müşteri için yalnız bu dosya değişir.
   (Tarih/saat Europe/Istanbul ofsetli ISO; telefon numarası ülke kodlu, + işaretsiz.) */
window.DAVETIYE = {
  tur: "kina",
  tema: "mum",
  ornek: true, // true iken RSVP düğmeleri Boztaş Digital'e gider (satış adayı). Gerçek davetiyede false.
  isimler: { a: "Elif Nur" },
  etiket: "Kına Gecesi",
  mesaj: "Kına gecemizde sizi aramızda görmek isteriz.",
  davet: [
    "Bir mum yakıyoruz, bir dilek tutuyoruz.",
    "Bu gecenin ışığını sizinle çoğaltmak isteriz."
  ],
  aileler: null,
  tarih: {
    baslangic: "2027-06-11T20:00:00+03:00",
    bitis: "2027-06-12T00:00:00+03:00"
  },
  program: [
    { saat: "20.00", baslik: "Karşılama ve mumlar", not: "Mumlar yakılır, gelin salona alınır." },
    { saat: "21.00", baslik: "Kına yakma", not: "Türküler eşliğinde kına yakılır." },
    { saat: "22.00", baslik: "Sofra ve eğlence", not: "Yemek, müzik ve halay." }
  ],
  mekan: {
    ad: "Örnek Konak Salonu",
    adres: "Örnek Mah. Kına Sk. No: 7, Merkezefendi / Denizli",
    enlem: 37.7765,
    boylam: 29.0864,
    harita_url: "",
    yol_notu: "Salonun önünde ücretsiz otopark vardır."
  },
  // Gerçek davetiyede: ev sahibinin numarası. {ad} ve {n} yer tutucudur.
  whatsapp: {
    numara: "90XXXXXXXXXX",
    katilim: "Merhaba, ben {ad}. {n} kişi olarak kına gecesine geliyorum.",
    red: "Merhaba, ben {ad}. Maalesef kına gecesine gelemeyeceğim."
  },
  // ornek: true iken kullanılır (Boztaş Digital WhatsApp hattı: sitelerdeki mevcut iletişim numarası).
  ornek_whatsapp: {
    numara: "",
    mesaj: "Merhaba, kına davetiyesi örneğini inceledim, bilgi almak istiyorum.",
    kendi: "Merhaba, kına davetiyesi örneğini beğendim, kendi kınam için yaptırmak istiyorum."
  },
  rsvp: { son_tarih: "2027-06-01", kisi_siniri: 6 },
  not: "Kırmızı bir şeyler giyerseniz çok seviniriz.",
  album: { url: null, etiket: "Anı albümü" }
};
