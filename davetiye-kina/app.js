/* Kına davetiyesi motoru: veri.js içindeki DAVETIYE nesnesinden her şeyi kurar.
   Açılış saf CSS'tir; bu dosya yalnız veriyi yazar, mumları yakar, geri sayım/takvim/RSVP/alt çubuğu çalıştırır. */
(function () {
  "use strict";
  var D = window.DAVETIYE;
  if (!D) return;

  var TZ = "Europe/Istanbul";
  var azalt = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IO = "IntersectionObserver" in window;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var enc = encodeURIComponent;

  function al(o, yol) {
    return yol.split(".").reduce(function (a, k) { return a == null ? a : a[k]; }, o);
  }

  /* ---------- tarih / metin ---------- */
  var bas = new Date(D.tarih.baslangic);
  var bit = new Date(D.tarih.bitis);
  function bicim(d, o) {
    o.timeZone = TZ;
    return new Intl.DateTimeFormat("tr-TR", o).format(d);
  }
  var gun = bicim(bas, { day: "numeric" });
  var ay = bicim(bas, { month: "long" });
  var yil = bicim(bas, { year: "numeric" });
  var hGunu = bicim(bas, { weekday: "long" });
  var saat = bicim(bas, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(":", ".");
  var T = {
    gun: gun,
    ayyil: ay + " " + yil,
    gunsaat: hGunu + " · " + saat,
    kapanis: gun + " " + ay + " " + yil + " · " + hGunu + " · " + saat
  };
  $$("[data-t]").forEach(function (e) { var v = T[e.getAttribute("data-t")]; if (v) e.textContent = v; });
  $$("[data-v]").forEach(function (e) {
    var v = al(D, e.getAttribute("data-v"));
    if (v != null && v !== "") e.textContent = v;
  });
  document.title = D.isimler.a + " · " + D.etiket + " Davetiyesi";
  var etHero = $(".hero-et");
  if (etHero && D.etiket) etHero.textContent = D.etiket;

  /* davet metni */
  if (D.davet && D.davet.length) {
    var dv = $(".davet");
    dv.innerHTML = D.davet.map(function (s, i) {
      return '<p class="s r"' + (i ? ' style="--d:.15s"' : "") + ">" + esc(s) + "</p>";
    }).join("") + (D.aileler ? '<p class="s r" style="--d:.3s">' + esc(D.aileler) + "</p>" : "");
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* ---------- mum ---------- */
  function mumHtml(i, yanik) {
    return '<div class="mum sonuk' + (yanik ? " on" : "") + '" style="--i:' + i + '"><div class="isik"></div>' +
      '<div class="alev"><svg viewBox="0 0 40 40"><path class="a1" d="M20 2C26 14 29 22 29 29c0 7-4 11-9 11s-9-4-9-11c0-7 3-15 9-27z"/>' +
      '<path class="a2" d="M20 18c3 6 4 10 4 13 0 4-2 6-4 6s-4-2-4-6c0-3 1-7 4-13z"/></svg></div>' +
      '<svg class="govde" viewBox="0 0 40 170"><rect x="9" y="52" width="22" height="118" rx="2"/>' +
      '<rect class="golge" x="24" y="52" width="7" height="118" rx="2"/><rect class="fitil" x="19.2" y="40" width="1.6" height="13"/></svg></div>';
  }
  function mumSira(kap, yanik) {
    var h = "";
    for (var i = 0; i < 7; i++) h += mumHtml(i, yanik);
    kap.innerHTML = h;
  }
  $$(".mumlar").forEach(function (k) { mumSira(k, k.hasAttribute("data-yanik")); });

  /* program (üç perde) */
  var liste = $(".perdeler");
  if (liste && D.program && D.program.length) {
    liste.innerHTML = D.program.map(function (p, i) {
      return '<li class="perde">' + mumHtml(i + 2, false) + '<div class="metin"><p class="saat">' + esc(p.saat) +
        "</p><h3>" + esc(p.baslik) + "</h3>" + (p.not ? '<p class="not">' + esc(p.not) + "</p>" : "") + "</div></li>";
    }).join("");
  }
  /* dilek notu yoksa bölümü gizle */
  if (!D.not) $("#dilek").hidden = true;

  /* ---------- görünürlük yardımcıları ---------- */
  function gorunce(el, fn, esik) {
    if (!IO || azalt) { fn(el); return; }
    var o = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { o.disconnect(); fn(el); }
    }, { threshold: esik || 0.25, rootMargin: "0px 0px -6% 0px" });
    o.observe(el);
  }
  $$(".r").forEach(function (e) { gorunce(e, function (x) { x.classList.add("g"); }, 0.2); });

  /* alev titremesi yalnız ekrandayken */
  if (IO) {
    var canli = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("live", e.isIntersecting); });
    }, { rootMargin: "80px" });
    $$(".mum").forEach(function (m) { canli.observe(m); });
  } else {
    $$(".mum").forEach(function (m) { m.classList.add("live"); });
  }

  /* VAY ANI: yedi mum sırayla yanar, ışık tarihe yayılır */
  var mumlar = $(".tarih .mumlar");
  var tarihBol = $(".tarih");
  function yedi() {
    var ms = $$(".mum", mumlar);
    if (azalt) { ms.forEach(function (m) { m.classList.add("on"); }); tarihBol.classList.add("aydin"); return; }
    ms.forEach(function (m, i) { setTimeout(function () { m.classList.add("on"); }, i * 350); });
    setTimeout(function () { tarihBol.classList.add("aydin"); }, 6 * 350 + 450);
  }
  gorunce(mumlar, yedi, 0.6);

  /* perde mumları: perde ekrana gelince yanar, yazı aydınlanır */
  $$(".perde").forEach(function (p) {
    gorunce(p, function () {
      p.classList.add("g");
      var m = $(".mum", p); if (m) m.classList.add("on");
    }, 0.7);
  });

  /* ---------- geri sayım (yalnız ekrandayken tik) ---------- */
  var sayac = $(".sayac");
  var sayacTimer = null;
  function iki(n) { return n < 10 ? "0" + n : String(n); }
  function bugunMu() {
    var f = function (d) { return bicim(d, { year: "numeric", month: "numeric", day: "numeric" }); };
    return f(new Date()) === f(bas);
  }
  function tik() {
    var simdi = Date.now(), kalan = bas - simdi;
    if (simdi >= bit) { sayac.innerHTML = '<div class="ozel">Teşekkür ederiz.</div>'; stop(); return; }
    if (kalan <= 0) { sayac.innerHTML = '<div class="ozel">Gece başladı.</div>'; return; }
    if (kalan < 864e5 && bugunMu()) { sayac.innerHTML = '<div class="ozel">Bugün!</div>'; return; }
    var s = Math.floor(kalan / 1000);
    var v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    var et = ["Gün", "Saat", "Dk", "Sn"];
    var cells = sayac.children;
    if (cells.length !== 4 || cells[0].className === "ozel") {
      sayac.innerHTML = et.map(function (e) { return "<div><b></b><span>" + e + "</span></div>"; }).join("");
      cells = sayac.children;
    }
    for (var i = 0; i < 4; i++) {
      var t = i === 0 ? String(v[0]) : iki(v[i]);
      var b = cells[i].firstChild;
      if (b.textContent !== t) b.textContent = t;
    }
  }
  function stop() { if (sayacTimer) { clearInterval(sayacTimer); sayacTimer = null; } }
  function basla() { tik(); if (!sayacTimer) sayacTimer = setInterval(tik, 1000); }
  tik();
  var sayacGor = false;
  if (IO) {
    new IntersectionObserver(function (es) {
      sayacGor = es[0].isIntersecting;
      if (sayacGor && !document.hidden) basla(); else stop();
    }).observe(sayac);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (sayacGor) basla();
    });
  } else basla();

  /* ---------- konum ---------- */
  var M = D.mekan;
  var ll = M.enlem + "," + M.boylam;
  var yolUrl = "https://www.google.com/maps/dir/?api=1&destination=" + ll;
  var haritaUrl = M.harita_url || "https://www.google.com/maps/search/?api=1&query=" + ll;
  $("#yol").href = yolUrl;
  $("#harita").href = haritaUrl;
  $("#b-konum").href = haritaUrl;
  $("#b-konum").target = "_blank";
  $("#b-konum").rel = "noopener";
  if (!M.yol_notu) $(".yol-notu").hidden = true;

  /* ---------- takvim ---------- */
  function utc(d) { return d.toISOString().replace(/[-:]|\.\d{3}/g, ""); }
  function icsKacis(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }
  function katla(satir) {
    var o = [], k = 60;
    while (satir.length > k) { o.push(satir.slice(0, k)); satir = " " + satir.slice(k); }
    o.push(satir);
    return o.join("\r\n");
  }
  var baslikT = D.etiket + " · " + D.isimler.a;
  var detay = D.mesaj + (D.not ? "\n" + D.not : "");
  var konumT = M.ad + ", " + M.adres;
  var gUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + enc(baslikT) +
    "&dates=" + utc(bas) + "/" + utc(bit) + "&details=" + enc(detay) + "&location=" + enc(konumT);
  $("#gtakvim").href = gUrl;
  function icsIndir() {
    var satirlar = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Boztas Digital//Davetiye//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT", "UID:kina-" + utc(bas) + "@boztasdigital", "DTSTAMP:" + utc(new Date()),
      "DTSTART:" + utc(bas), "DTEND:" + utc(bit),
      "SUMMARY:" + icsKacis(baslikT), "LOCATION:" + icsKacis(konumT), "DESCRIPTION:" + icsKacis(detay),
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsKacis(baslikT) + " yarın", "TRIGGER:-P1D", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].map(katla).join("\r\n") + "\r\n";
    var blob = new Blob([satirlar], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "kina-davetiyesi.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  var ua = navigator.userAgent || "";
  var uygulamaIci = /FBAN|FBAV|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat/i.test(ua);
  var android = /Android/i.test(ua);
  function takvimEkle() {
    if (android || uygulamaIci) window.open(gUrl, "_blank", "noopener");
    else icsIndir();
  }
  $("#takvim").addEventListener("click", takvimEkle);
  $("#takvim2").addEventListener("click", takvimEkle);
  $("#b-takvim").addEventListener("click", takvimEkle);
  $("#ics").addEventListener("click", icsIndir);
  if (uygulamaIci) $("#takvim-ipucu").hidden = false;

  /* ---------- RSVP (WhatsApp) ---------- */
  function norm(n) {
    n = String(n || "").replace(/\D/g, "");
    if (/^0\d{10}$/.test(n)) n = "90" + n.slice(1);
    else if (/^5\d{9}$/.test(n)) n = "90" + n;
    return n;
  }
  var ornek = !!D.ornek;
  var numara = norm(ornek ? D.ornek_whatsapp.numara : D.whatsapp.numara);
  var numaraTamam = /^90\d{10}$/.test(numara);
  var adIn = $("#ad"), sayiEl = $("#sayi"), evet = $("#evet"), hayir = $("#hayir"), hata = $("#hata");
  var kisi = 1, sinir = (D.rsvp && D.rsvp.kisi_siniri) || 6;
  function wa(metin) { return numaraTamam ? "https://wa.me/" + numara + "?text=" + enc(metin) : "https://instagram.com/boztasdigital"; }
  function yaz() {
    var ad = adIn.value.trim();
    var m1, m2;
    if (ornek) {
      var ek = ad ? " (Deneme yanıtı: " + ad + ", " + kisi + " kişi)" : "";
      m1 = D.ornek_whatsapp.mesaj + ek;
      m2 = D.ornek_whatsapp.mesaj + " (Deneme: 'Gelemiyorum' düğmesine bastım)" + (ad ? " - " + ad : "");
    } else {
      m1 = D.whatsapp.katilim.replace("{ad}", ad).replace("{n}", kisi);
      m2 = D.whatsapp.red.replace("{ad}", ad).replace("{n}", kisi);
    }
    evet.href = wa(m1);
    hayir.href = wa(m2);
  }
  $("#eksi").addEventListener("click", function () { if (kisi > 1) { kisi--; sayiEl.textContent = kisi; yaz(); } });
  $("#arti").addEventListener("click", function () { if (kisi < sinir) { kisi++; sayiEl.textContent = kisi; yaz(); } });
  adIn.addEventListener("input", function () { hata.hidden = true; yaz(); });
  yaz();
  if (ornek) $("#ornek-not").hidden = false;
  if (D.rsvp && D.rsvp.son_tarih) {
    var sd = new Date(D.rsvp.son_tarih + "T12:00:00+03:00");
    $("#son-tarih").textContent = "Lütfen " + bicim(sd, { day: "numeric", month: "long" }) + "'a kadar haber verin.";
  }
  function yanitla(olay, geliyor) {
    if (!numaraTamam && !ornek) { olay.preventDefault(); console.warn("Geçerli WhatsApp numarası yok"); return; }
    if (!ornek && !adIn.value.trim()) {
      olay.preventDefault();
      hata.hidden = false;
      adIn.focus({ preventScroll: true });
      return;
    }
    setTimeout(function () {
      $("#form").hidden = true;
      $("#tesekkur").hidden = false;
      $("#tesekkur-baslik").textContent = geliyor ? "Teşekkürler, görüşürüz." : "Yanıtınız için teşekkürler.";
      $("#tesekkur-alt").textContent = ornek ? "Mesajınız Boztaş Digital'e iletildi (örnek davetiye)." :
        (geliyor ? "Mumlar sizin için yanacak." : "Sizi özleyeceğiz.");
      if (!geliyor) $("#takvim2").hidden = true;
    }, 500);
  }
  evet.addEventListener("click", function (e) { yanitla(e, true); });
  hayir.addEventListener("click", function (e) { yanitla(e, false); });

  /* albüm */
  if (D.album && D.album.url) {
    var alb = $("#album");
    alb.hidden = false;
    $("#al-bas").textContent = D.album.etiket || "Anı albümü";
    $("#album-link").href = D.album.url;
  }

  /* örnek: kendi davetiyen */
  if (ornek) {
    $("#kendi").href = wa(D.ornek_whatsapp.kendi);
    $("#kendi-sar").hidden = false;
  }

  /* ---------- alt çubuk: kahraman geçilince belirir ---------- */
  var bar = $("#bar");
  var hero = $(".hero");
  if (IO) {
    new IntersectionObserver(function (es) {
      bar.classList.toggle("goster", !es[0].isIntersecting);
    }, { threshold: 0.12 }).observe(hero);
  } else bar.classList.add("goster");
})();
