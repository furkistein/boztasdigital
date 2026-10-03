/* NİŞAN davetiyesi "Halka" — kişiselleştirme TEK yerden: bu nesne.
   Müşteri teslimi: yalnız bu dosya değişir (isimler, tarih, mekân, program, numara).
   Not: <title> ve og: etiketleri crawler/WhatsApp önizlemesi için index.html'de statik durur; onları da güncelle. */
window.DAVETIYE = {
  tur: "nisan",
  tema: "halka",
  ornek: true,            // true iken RSVP/albüm düğmeleri Boztaş Digital'e yazar (satış örneği)
  isimler: { a: "Zeynep", b: "Can", kisa: "Z · C" },
  etiket: "Nişanlanıyoruz",
  mesaj: ["Söz verdik.", "Yüzükler takılıyor,", "sizi de aramızda", "görmek isteriz."],
  aileler: null,          // örn. "Yılmaz ve Demir aileleri"
  tarih: {
    baslangic: "2027-04-17T15:00:00+03:00",   // Europe/Istanbul (ofsetli ISO)
    bitis: "2027-04-17T18:00:00+03:00"
  },
  program: [
    { saat: "15.00", baslik: "Karşılama", not: "" },
    { saat: "15.30", baslik: "Yüzük takma", not: "" },
    { saat: "16.00", baslik: "Pasta ve ikram", not: "" }
  ],
  mekan: {
    ad: "Örnek Bahçe Salonu",
    adres: "Örnek Mah. Gül Sk. No: 1, Merkezefendi / Denizli",
    enlem: 37.7765,
    boylam: 29.086,
    yol_notu: "Salonun önünde ücretsiz otopark vardır."
  },
  rsvp: { son_tarih: "2027-04-01", kisi_siniri: 6 },
  whatsapp: {
    // Davetiye sahibinin numarası: yalnız rakam, ülke kodlu (90XXXXXXXXXX) ya da 05XXXXXXXXX yazılabilir.
    numara: "",
    // Örnek modunda (ornek:true) gidilecek yer: Boztaş Digital'in numarası. BOŞSA Instagram profiline gider.
    boztas_numara: "",
    boztas_yedek: "https://instagram.com/boztasdigital",
    katilim: "Merhaba, ben {ad}. {n} kişi olarak katılıyorum.",
    red: "Merhaba, ben {ad}. Maalesef katılamayacağım, çok teşekkür ederiz.",
    ornek_katilim: "Merhaba, nişan davetiyesi örneğini inceledim, bilgi almak istiyorum.",
    ornek_album: "Merhaba, nişan davetiyesindeki anı albümü özelliği hakkında bilgi almak istiyorum.",
    ornek_kendi: "Merhaba, bu nişan davetiyesini kendi nişanım için istiyorum."
  },
  album: { url: null, etiket: "Anı albümü" },
  og: { baslik: "Zeynep & Can nişanlanıyor", aciklama: "17 Nisan 2027, Cumartesi 15.00. Sizi de aramızda görmek isteriz." }
};
