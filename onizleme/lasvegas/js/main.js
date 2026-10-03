/* Las Vegas Bilardo Salonu - örnek önizleme. Kütüphanesiz, yerel. */
(function () {
  "use strict";

  /* ===== TEK YERDEN DEĞİŞEN AYAR =====
     Gerçek WhatsApp numarası geldiğinde yalnızca bu satırı doldur:
     ülke kodlu, artı ve boşluksuz (ör. "905xxxxxxxxx"). Boşsa numarasız wa.me bağlantısı üretilir. */
  var WA_NUMARA = "";
  var SALON_ADI = "Las Vegas Bilardo Salonu";

  var azHareket = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----- kaydırmayla belirme + imza anlar ----- */
  function vurusBaslat(banda) {
    if (azHareket) return;
    var beyaz = banda.querySelectorAll(".beyaz");
    var sekiz = banda.querySelectorAll(".sekiz");
    var son = banda.querySelectorAll(".sekiz-son");
    function calis(liste) { liste.forEach(function (a) { try { a.beginElement(); } catch (e) {} }); }
    calis(beyaz);
    setTimeout(function () { calis(sekiz); }, 2600);
    setTimeout(function () { calis(son); }, 3300);
  }

  var hedefler = document.querySelectorAll("[data-belir], .banda, .dizi, .bracket, .bina");
  if (!("IntersectionObserver" in window) || azHareket) {
    hedefler.forEach(function (e) { e.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (kayitlar) {
      kayitlar.forEach(function (k) {
        if (!k.isIntersecting) return;
        var e = k.target;
        e.classList.add("in");
        if (e.classList.contains("banda")) vurusBaslat(e);
        io.unobserve(e);
      });
    }, { threshold: 0.25, rootMargin: "0px 0px -6% 0px" });
    hedefler.forEach(function (e) { io.observe(e); });
  }

  /* ----- masa ayırtma: WhatsApp mesajı üretici ----- */
  var form = document.getElementById("ayirt-form");
  if (!form) return;
  var kutuMesaj = document.getElementById("mesaj");
  var kutuDurum = document.getElementById("durum");
  var dugme = document.getElementById("wa-gonder");
  var fTarih = document.getElementById("f-tarih");
  var fSaat = document.getElementById("f-saat");
  var fKisi = document.getElementById("f-kisi");
  var fAd = document.getElementById("f-ad");

  function bugun() {
    var d = new Date();
    var ay = String(d.getMonth() + 1).padStart(2, "0");
    var gun = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + ay + "-" + gun;
  }
  fTarih.min = bugun();

  function tarihMetni(v) {
    if (!v) return "";
    var p = v.split("-").map(Number);
    if (p.length !== 3 || !p[0]) return "";
    var d = new Date(p[0], p[1] - 1, p[2]);
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
  }

  function degerler() {
    var secili = form.querySelector('input[name="oyun"]:checked');
    var kisi = parseInt(fKisi.value, 10);
    if (!(kisi >= 1)) kisi = 0;
    return {
      oyun: secili ? secili.value : "",
      tarih: tarihMetni(fTarih.value),
      saat: fSaat.value,
      kisi: kisi,
      ad: fAd.value.trim()
    };
  }

  function mesajUret(v) {
    var satirlar = [
      "Merhaba, " + SALON_ADI + "'nda masa ayırtmak istiyorum.",
      "Oyun: " + (v.oyun || "..."),
      "Tarih: " + (v.tarih || "..."),
      "Saat: " + (v.saat || "..."),
      "Kişi sayısı: " + (v.kisi || "...")
    ];
    if (v.ad) satirlar.push("Adım: " + v.ad);
    satirlar.push("Uygunsa onaylar mısınız? Teşekkürler.");
    return satirlar.join("\n");
  }

  function guncelle() {
    var v = degerler();
    var eksik = [];
    if (!v.oyun) eksik.push("oyunu");
    if (!v.tarih) eksik.push("günü");
    if (!v.saat) eksik.push("saati");
    if (!v.kisi) eksik.push("kişi sayısını");
    var mesaj = mesajUret(v);
    kutuMesaj.textContent = mesaj;
    var url = "https://wa.me/" + WA_NUMARA + "?text=" + encodeURIComponent(mesaj);
    dugme.href = url;
    if (eksik.length) {
      dugme.setAttribute("aria-disabled", "true");
      kutuDurum.textContent = "Göndermeden önce " + eksik.join(", ").replace(/, ([^,]*)$/, " ve $1") + " seç.";
    } else {
      dugme.setAttribute("aria-disabled", "false");
      kutuDurum.textContent = "Mesaj hazır. Gönder'e basınca WhatsApp açılır.";
    }
  }

  form.addEventListener("input", guncelle);
  form.addEventListener("change", guncelle);
  form.addEventListener("submit", function (e) { e.preventDefault(); });
  document.getElementById("kisi-az").addEventListener("click", function () {
    fKisi.value = Math.max(1, (parseInt(fKisi.value, 10) || 2) - 1); guncelle();
  });
  document.getElementById("kisi-art").addEventListener("click", function () {
    fKisi.value = Math.min(30, (parseInt(fKisi.value, 10) || 0) + 1); guncelle();
  });
  dugme.addEventListener("click", function (e) {
    if (dugme.getAttribute("aria-disabled") === "true") {
      e.preventDefault();
      form.scrollIntoView({ block: "center", behavior: azHareket ? "auto" : "smooth" });
    }
  });

  /* oyun kartlarından gelen kısayol: oyunu seçili getirir */
  document.querySelectorAll("[data-oyun]").forEach(function (a) {
    a.addEventListener("click", function () {
      var ad = a.getAttribute("data-oyun");
      form.querySelectorAll('input[name="oyun"]').forEach(function (r) { r.checked = r.value === ad; });
      guncelle();
    });
  });

  guncelle();
})();
