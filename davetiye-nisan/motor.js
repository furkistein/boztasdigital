/* Davetiye motoru (nişan kopyası): veri bağlama, halka sahnesi, geri sayım, takvim, konum, RSVP, alt çubuk.
   Kural (web_sitesi.md): kaydırma olayında scrollIntoView/scrollTo/focus çağrılmaz. */
(function () {
  "use strict";
  var V = window.DAVETIYE;
  if (!V) return;
  var $ = function (s, k) { return (k || document).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var modu = root.classList.contains("modu");
  var TZ = "Europe/Istanbul";

  /* ---------- tarih türevleri ---------- */
  var bas = new Date(V.tarih.baslangic), son = new Date(V.tarih.bitis);
  function parcalar(d, opt) {
    var o = {};
    new Intl.DateTimeFormat("tr-TR", Object.assign({ timeZone: TZ }, opt)).formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  var pt = parcalar(bas, { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  var ayAd = parcalar(bas, { month: "long" }).month;
  var gunNo = String(parseInt(pt.day, 10));
  V.t = {
    gun: gunNo, ay: pt.month, ayAd: ayAd, yil: pt.year, gunAd: pt.weekday.charAt(0).toLocaleUpperCase("tr") + pt.weekday.slice(1),
    saat: pt.hour + "." + pt.minute, uzun: gunNo + " " + ayAd + " " + pt.year
  };
  if (V.rsvp && V.rsvp.son_tarih) {
    var sd = new Date(V.rsvp.son_tarih + "T12:00:00+03:00");
    V.rsvpSon = parseInt(parcalar(sd, { day: "2-digit" }).day, 10) + " " + parcalar(sd, { month: "long" }).month;
  }

  /* ---------- bağlama ---------- */
  function al(yol) { return yol.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, V); }
  $$("[data-b]").forEach(function (e) { var v = al(e.getAttribute("data-b")); if (v != null) e.textContent = v; });
  document.title = V.isimler.a + " & " + V.isimler.b + " · " + (V.ornek ? "Nişan davetiyesi" : "Nişan davetiyesi");
  if (V.mesaj && V.mesaj.length) {
    var mm = $("#mMetin"); mm.textContent = "";
    V.mesaj.forEach(function (s, i) {
      var a = document.createElement("span"); a.className = "m-satir";
      var b = document.createElement("span"); b.style.setProperty("--i", i); b.textContent = s;
      a.appendChild(b); mm.appendChild(a);
    });
  }
  if (V.aileler) { var ai = $("#aileler"); ai.textContent = V.aileler; ai.hidden = false; }
  var pl = $("#pListe");
  if (V.program && V.program.length) {
    pl.textContent = "";
    V.program.forEach(function (p, i) {
      var li = document.createElement("li"); li.className = "p-satir"; li.style.setProperty("--i", i);
      var b = document.createElement("b"); b.textContent = p.saat;
      var d = document.createElement("div"), s = document.createElement("span"); s.textContent = p.baslik; d.appendChild(s);
      if (p.not) { var n = document.createElement("small"); n.textContent = p.not; d.appendChild(n); }
      li.appendChild(b); li.appendChild(d); pl.appendChild(li);
    });
  }
  function sonEk(t) { /* ay adının son ünlüsüne göre ’a / ’e */
    var ay = t.split(" ")[1] || ""; var k = ay.toLocaleLowerCase("tr").replace(/[^aeıioöuü]/g, "").slice(-1);
    return "’" + ("aıou".indexOf(k) >= 0 ? "a" : "e");
  }
  if (V.rsvpSon) $("#rAlt").textContent = "Lütfen " + V.rsvpSon + sonEk(V.rsvpSon) + " kadar haber verin.";

  /* ---------- konum ---------- */
  var m = V.mekan, ll = m.enlem + "," + m.boylam;
  $$("[data-konum]").forEach(function (a) { a.href = "https://www.google.com/maps/search/?api=1&query=" + ll; });
  $$("[data-yol]").forEach(function (a) { a.href = "https://www.google.com/maps/dir/?api=1&destination=" + ll; });

  /* ---------- WhatsApp ---------- */
  function numara(n) {
    n = String(n || "").replace(/\D/g, "");
    if (/^0\d{10}$/.test(n)) n = "90" + n.slice(1);
    else if (/^5\d{9}$/.test(n)) n = "90" + n;
    return /^90\d{10}$/.test(n) ? n : "";
  }
  var W = V.whatsapp || {};
  function wa(metin) {
    var n = numara(V.ornek ? W.boztas_numara : W.numara);
    if (n) return "https://wa.me/" + n + "?text=" + encodeURIComponent(metin);
    return V.ornek ? (W.boztas_yedek || "https://instagram.com/boztasdigital") : "#";
  }
  function doldur(sablon, ad, n) { return String(sablon).replace("{ad}", ad).replace("{n}", n); }

  /* ---------- RSVP ---------- */
  var kisi = 1, kmax = (V.rsvp && V.rsvp.kisi_siniri) || 6;
  var eksi = $("#stEksi"), arti = $("#stArti"), sayi = $("#stSayi"), adAlan = $("#rAd"), hata = $("#rHata");
  var evet = $("#rEvet"), hayir = $("#rHayir");
  function linkleriGuncelle() {
    var ad = adAlan.value.trim() || (V.ornek ? "" : "…");
    if (V.ornek) {
      var ek = ad ? " (Deneme: " + ad + ", " + kisi + " kişi)" : "";
      evet.href = wa(W.ornek_katilim + ek);
      hayir.href = wa(W.ornek_katilim + ek);
    } else {
      evet.href = wa(doldur(W.katilim, ad, kisi));
      hayir.href = wa(doldur(W.red, ad, kisi));
    }
  }
  function kisiYaz() { sayi.textContent = kisi; eksi.disabled = kisi <= 1; arti.disabled = kisi >= kmax; linkleriGuncelle(); }
  eksi.addEventListener("click", function () { if (kisi > 1) { kisi--; kisiYaz(); } });
  arti.addEventListener("click", function () { if (kisi < kmax) { kisi++; kisiYaz(); } });
  adAlan.addEventListener("input", function () { hata.hidden = true; linkleriGuncelle(); });
  function gonder(e) {
    if (!V.ornek && !adAlan.value.trim()) { e.preventDefault(); hata.hidden = false; adAlan.focus(); return; }
    linkleriGuncelle();
    if (e.currentTarget.getAttribute("href") === "#") { e.preventDefault(); return; }
    setTimeout(function () { $("#rForm").hidden = true; $("#rTesekkur").hidden = false; }, 700);
  }
  evet.addEventListener("click", gonder); hayir.addEventListener("click", gonder);
  if (V.ornek) $("#rNot").hidden = false;
  kisiYaz();

  /* albüm + kapanış bağlantıları */
  var alSec = $("#album");
  if (V.album && V.album.url) { alSec.hidden = false; $("#alBag").href = V.album.url; }
  else if (V.ornek) { alSec.hidden = false; $("#alBag").href = wa(W.ornek_album); }
  if (V.album && V.album.etiket) $("#alBag").textContent = V.album.etiket;
  if (V.ornek) $("#kKendi").href = wa(W.ornek_kendi); else $("#kAlt").hidden = true;

  /* ---------- takvim ---------- */
  function utc(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function esc(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  var baslikT = V.isimler.a + " & " + V.isimler.b + " nişan";
  var yer = m.ad + ", " + m.adres, detay = "Nişan davetiyesi" + (V.ornek ? " (örnek çalışma)" : "");
  function googleUrl() {
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(baslikT) +
      "&dates=" + utc(bas) + "/" + utc(son) + "&details=" + encodeURIComponent(detay) + "&location=" + encodeURIComponent(yer) + "&ctz=" + TZ;
  }
  function icsMetin() {
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Boztas Digital//Davetiye//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT", "UID:nisan-" + bas.getTime() + "@boztasdigital", "DTSTAMP:" + utc(new Date()),
      "DTSTART:" + utc(bas), "DTEND:" + utc(son), "SUMMARY:" + esc(baslikT), "LOCATION:" + esc(yer), "DESCRIPTION:" + esc(detay),
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + esc(baslikT + " yarın"), "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n") + "\r\n";
  }
  function icsIndir() {
    var blob = new Blob([icsMetin()], { type: "text/calendar;charset=utf-8" });
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = "nisan-davetiyesi.ics"; a.style.display = "none"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 4000);
  }
  var ua = navigator.userAgent || "";
  var android = /Android/i.test(ua);
  var uygulamaIci = /Instagram|FBAN|FBAV|FB_IAB|Line\/|; wv\)|Snapchat|Twitter/i.test(ua);
  $$("[data-google]").forEach(function (a) { a.href = googleUrl(); });
  $$("[data-ics]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); icsIndir(); }); });
  $$("[data-takvim]").forEach(function (a) {
    if (android) { a.href = googleUrl(); a.target = "_blank"; a.rel = "noopener"; }
    else a.addEventListener("click", function (e) { e.preventDefault(); icsIndir(); });
  });
  if (uygulamaIci) $("#tkIpucu").hidden = false;

  /* ---------- halka sahnesi ---------- */
  var sahne = $("#sahne"), ic = $("#sahneIc"), tarih = $("#tarih"), halka = $("#halka");
  var isimBlok = $("#isimBlok"), ipucu = $("#ipucu"), monoK = $("#monoKopya"), tasJ = $("#tasJ");
  var tSatir = $$(".t-satir .t-sayi, .t-ayad"), tKur = $(".t-kurdele"), tGun = $(".t-gun");
  var olc = { top: 0, h: 0, vh: 0, cx: 0, cy: 0, rIn: 1, rMax: 1 };
  var hedef = 0, p = 0, kosuyor = false, onb = {};

  function k01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function inOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function outExpo(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  function olc_yap() {
    var r = sahne.getBoundingClientRect(), ir = ic.getBoundingClientRect(), hr = halka.getBoundingClientRect();
    olc.top = r.top + window.pageYOffset; olc.h = sahne.offsetHeight; olc.vh = ic.offsetHeight;
    olc.cx = hr.left + hr.width / 2 - ir.left; olc.cy = hr.top + hr.height / 2 - ir.top;
    olc.rIn = hr.width / 2 * 0.978;
    olc.rMax = Math.hypot(Math.max(olc.cx, ic.offsetWidth - olc.cx), Math.max(olc.cy, olc.vh - olc.cy)) + 6;
    ic.style.setProperty("--cx", olc.cx.toFixed(1) + "px");
    ic.style.setProperty("--cy", olc.cy.toFixed(1) + "px");
    onb = {}; hedefHesapla(); p = hedef; ciz();
  }
  function R(q) {
    if (q <= 0) return 0;
    var a = .14, b = .6;
    if (q < a) return olc.rIn * outCubic(q / a);
    return olc.rIn + (olc.rMax - olc.rIn) * inOut(k01((q - a) / (b - a)));
  }
  function yaz(el, ozellik, deger, anahtar) { if (onb[anahtar] !== deger) { onb[anahtar] = deger; el.style[ozellik] = deger; } }
  function ciz() {
    var r = R(p);
    yaz(tarih, "clipPath", "circle(" + r.toFixed(1) + "px at " + olc.cx.toFixed(1) + "px " + olc.cy.toFixed(1) + "px)", "clip");
    yaz(isimBlok, "opacity", String(Math.round((1 - k01((p - .03) / .17)) * 100) / 100), "isim");
    yaz(ipucu, "opacity", String(Math.round((1 - k01(p / .04)) * 100) / 100), "ipucu");
    yaz(monoK, "opacity", String(Math.round((1 - k01((p - .18) / .1)) * 100) / 100), "mono");
    yaz(tasJ, "transform", "translate3d(0," + (-(Math.max(r, olc.rIn) - olc.rIn)).toFixed(1) + "px,0)", "tas");
    var d = k01((p - .38) / .3);
    for (var i = 0; i < tSatir.length; i++) {
      var t = outExpo(k01(d * 1.9 - i * .3));
      yaz(tSatir[i], "transform", "translate3d(0," + ((1 - t) * 108).toFixed(1) + "%,0)", "t" + i);
    }
    var tk = outExpo(k01(d * 1.9 - 3 * .3 + .1));
    yaz(tKur, "transform", "scaleX(" + tk.toFixed(3) + ")", "tk"); tKur.style.transformOrigin = "left";
    yaz(tGun, "opacity", tk.toFixed(2), "tg");
  }
  function hedefHesapla() {
    var yol = olc.h - olc.vh;
    hedef = yol > 0 ? k01((window.pageYOffset - olc.top) / yol) : 0;
  }
  function dongu() {
    p += (hedef - p) * .14;
    if (Math.abs(hedef - p) < .0006) p = hedef;
    ciz();
    if (p !== hedef) requestAnimationFrame(dongu); else kosuyor = false;
  }
  function kaydi() {
    hedefHesapla();
    if (!kosuyor && p !== hedef) { kosuyor = true; requestAnimationFrame(dongu); }
  }
  if (modu) {
    olc_yap();
    window.addEventListener("scroll", kaydi, { passive: true });
    window.addEventListener("resize", olc_yap);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(olc_yap);
    window.addEventListener("load", olc_yap);
  }

  /* ---------- geri sayım (yalnız ekrandayken tik) ---------- */
  var gGun = $("#gGun"), gSaat = $("#gSaat"), gDk = $("#gDk"), gSn = $("#gSn"), gGunEt = $("#gGunEt"), gHalka = $("#gHalka");
  var yayDeger = .5;
  function ikili(n) { return (n < 10 ? "0" : "") + n; }
  function gunAnahtar(d) { var o = parcalar(d, { year: "numeric", month: "numeric", day: "numeric" }); return o.year + "-" + o.month + "-" + o.day; }
  function tik() {
    var fark = bas.getTime() - Date.now();
    if (fark <= 0) {
      var ayniGun = gunAnahtar(new Date()) === gunAnahtar(bas);
      gGun.textContent = ayniGun ? "Bugün!" : "Teşekkürler"; gGun.style.fontSize = "34px";
      gGunEt.textContent = ayniGun ? "Bugün buluşuyoruz" : "Geldiğiniz için";
      gSaat.textContent = gDk.textContent = gSn.textContent = "00";
      return;
    }
    var s = Math.floor(fark / 1000), g = Math.floor(s / 86400);
    gGun.textContent = g; gGunEt.textContent = g === 1 ? "Gün kaldı" : "Gün kaldı";
    gSaat.textContent = ikili(Math.floor(s % 86400 / 3600)); gDk.textContent = ikili(Math.floor(s % 3600 / 60)); gSn.textContent = ikili(s % 60);
  }
  function yayKur() {
    var g = Math.max(0, (bas.getTime() - Date.now()) / 86400000);
    yayDeger = Math.max(.02, Math.min(1, 1 - g / 365));
    gHalka.style.setProperty("--yay", String(1 - yayDeger));
    var a = (yayDeger * 360 - 90) * Math.PI / 180, tas = $("#gTas");
    tas.setAttribute("cx", (50 + 46 * Math.cos(a)).toFixed(2)); tas.setAttribute("cy", (50 + 46 * Math.sin(a)).toFixed(2));
  }
  yayKur(); tik();
  var sayac = 0;
  function sayacAc() { if (!sayac) { tik(); sayac = setInterval(tik, 1000); } }
  function sayacKapat() { if (sayac) { clearInterval(sayac); sayac = 0; } }

  /* ---------- gözlemciler ---------- */
  var gorunenGeri = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting && !document.hidden ? (gorunenGeri = true, sayacAc()) : (gorunenGeri = false, sayacKapat()); }); }, { threshold: 0 }).observe($("#gSatir"));
    document.addEventListener("visibilitychange", function () { if (document.hidden) sayacKapat(); else if (gorunenGeri) sayacAc(); });

    if (modu) {
      var gozle = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("gor"); gozle.unobserve(e.target); } });
      }, { threshold: .25, rootMargin: "0px 0px -6% 0px" });
      $$(".r, .m-metin, .r-bas, .p-satir").forEach(function (e) { gozle.observe(e); });
    }

    /* alt çubuk: kahraman geçilince; RSVP/kapanış görününce gizlenir */
    var bar = $("#bar"), barIc = $("#barIc"), gecti = false, gizle = {};
    function barGuncelle() {
      var ac = gecti && !gizle.rsvp && !gizle.kapanis;
      if (bar.hidden && ac) { bar.hidden = false; void bar.offsetWidth; }
      bar.classList.toggle("ac", ac);
      if (ac) barIc.removeAttribute("inert"); else barIc.setAttribute("inert", "");
    }
    barIc.setAttribute("inert", "");
    new IntersectionObserver(function (es) { es.forEach(function (e) { gecti = !e.isIntersecting && e.boundingClientRect.bottom <= 0; barGuncelle(); }); }, { threshold: 0 }).observe(sahne);
    new IntersectionObserver(function (es) { es.forEach(function (e) { gizle.rsvp = e.isIntersecting; barGuncelle(); }); }, { threshold: .3 }).observe($("#rsvp"));
    new IntersectionObserver(function (es) { es.forEach(function (e) { gizle.kapanis = e.isIntersecting; barGuncelle(); }); }, { threshold: .15 }).observe($("#kapanis"));
  } else {
    $("#bar").hidden = true;
  }
})();
