/* DÜĞÜN "Tek Yol": geri sayım, takvim, WhatsApp RSVP, alt çubuk, omurga ilerlemesi.
   Veri index.html içindeki #veri (veri.mjs'den üretilir). Kaydırma olayında scrollIntoView/scrollTo/focus YOK. */
(function () {
  "use strict";
  var $ = function (s, k) { return (k || document).querySelector(s); };
  var $$ = function (s, k) { return Array.prototype.slice.call((k || document).querySelectorAll(s)); };
  var V = JSON.parse($("#veri").textContent);
  var azHareket = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IO = "IntersectionObserver" in window;

  /* ---------- görününce belirme ---------- */
  function belir() {
    var hedefler = $$(".gor,.sil,.rota,.kapanis");
    if (!IO || azHareket) { hedefler.forEach(function (e) { e.classList.add("on"); }); return; }
    var g = new IntersectionObserver(function (l) {
      l.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("on"); g.unobserve(x.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    hedefler.forEach(function (e) { g.observe(e); });
    var d = new IntersectionObserver(function (l) {
      l.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("dolu"); d.unobserve(x.target); } });
    }, { rootMargin: "0px 0px -38% 0px" });
    $$(".dugum").forEach(function (e) { d.observe(e); });
  }
  if (!IO || azHareket) $$(".dugum").forEach(function (e) { e.classList.add("dolu"); });

  /* ---------- omurga ilerlemesi (tek rAF, yalnız değişince yazar) ---------- */
  function omurga() {
    var om = $(".omurga"), gov = $(".govde");
    if (!om || !gov || azHareket) return;
    var hedef = 0, cur = 0, son = -1, kosuyor = false;
    function oku() {
      var r = gov.getBoundingClientRect();
      hedef = Math.min(1, Math.max(0, (innerHeight * 0.68 - r.top) / r.height));
    }
    function yaz() {
      if (Math.abs(cur - son) > 0.0003) { om.style.setProperty("--p", cur.toFixed(4)); son = cur; }
    }
    function don() {
      cur += (hedef - cur) * 0.12;
      if (Math.abs(hedef - cur) < 0.0005) { cur = hedef; kosuyor = false; } else requestAnimationFrame(don);
      yaz();
    }
    function kaydi() { oku(); if (!kosuyor) { kosuyor = true; requestAnimationFrame(don); } }
    oku(); cur = hedef; yaz();
    addEventListener("scroll", kaydi, { passive: true });
    addEventListener("resize", kaydi, { passive: true });
  }

  /* ---------- geri sayım ---------- */
  function sayac() {
    var kutu = $("#sayac"), not = $("#sayac-not");
    if (!kutu) return;
    var bas = Date.parse(V.tarih.baslangic), bit = Date.parse(V.tarih.bitis);
    var istDay = function (t) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(t); };
    var hucre = {}; $$("[data-s]", kutu).forEach(function (b) { hucre[b.dataset.s] = b; });
    var p2 = function (n) { return n < 10 ? "0" + n : String(n); };
    function tick() {
      var simdi = Date.now(), fark = bas - simdi;
      if (simdi >= bit || fark <= 0 || istDay(simdi) === istDay(bas)) {
        kutu.hidden = true; not.hidden = false;
        not.textContent = simdi >= bit ? "Teşekkür ederiz" : "Bugün!";
        return;
      }
      kutu.hidden = false; not.hidden = true;
      var s = Math.floor(fark / 1000);
      hucre.g.textContent = p2(Math.floor(s / 86400));
      hucre.s.textContent = p2(Math.floor(s % 86400 / 3600));
      hucre.d.textContent = p2(Math.floor(s % 3600 / 60));
      hucre.n.textContent = p2(s % 60);
    }
    tick();
    var zaman = null, gorunur = false;
    function ayarla() {
      var calis = gorunur && !document.hidden;
      if (calis && !zaman) { tick(); zaman = setInterval(tick, 1000); }
      if (!calis && zaman) { clearInterval(zaman); zaman = null; }
    }
    if (IO) new IntersectionObserver(function (l) { gorunur = l[0].isIntersecting; ayarla(); }).observe(kutu);
    else { gorunur = true; ayarla(); }
    document.addEventListener("visibilitychange", ayarla);
  }

  /* ---------- takvim ---------- */
  var iOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var uygIci = /Instagram|FBAN|FBAV|WhatsApp|Snapchat|MicroMessenger|Line\//i.test(navigator.userAgent);
  var utc = function (d) { return new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, ""); };
  function icsMetni() {
    var kac = function (s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); };
    var kat = function (satir) { // 75 oktet kuralı için basit katlama
      var out = "", enc = new TextEncoder(), cur = "", len = 0;
      for (var ch of satir) {
        var b = enc.encode(ch).length;
        if (len + b > 73) { out += cur + "\r\n "; cur = ""; len = 0; }
        cur += ch; len += b;
      }
      return out + cur;
    };
    var ad = V.isimler.a + " & " + V.isimler.b + " Düğün";
    var s = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Boztas Digital//Davetiye//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:dugun-" + utc(V.tarih.baslangic) + "@boztasdigital",
      "DTSTAMP:" + utc(Date.now()),
      "DTSTART:" + utc(V.tarih.baslangic),
      "DTEND:" + utc(V.tarih.bitis),
      "SUMMARY:" + kac(ad),
      "DESCRIPTION:" + kac(V.isimler.a + " ve " + V.isimler.b + " sizi düğünlerinde aralarında görmek istiyor."),
      "LOCATION:" + kac(V.mekan.ad + ", " + V.mekan.adres),
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + kac("Yarın: " + ad), "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ];
    return s.map(kat).join("\r\n") + "\r\n";
  }
  function icsIndir() {
    var blob = new Blob([icsMetni()], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "dugun-davetiyesi.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function takvim() {
    var alt = $("#tk-alt"), ana = $("#tk-ana"), google = ana.getAttribute("href");
    if (iOS) {
      // iOS: ana düğme .ics, yedek Google
      $$("[data-takvim]").forEach(function (a) {
        a.addEventListener("click", function (e) { e.preventDefault(); icsIndir(); });
      });
      alt.textContent = "Google Takvim ile aç"; alt.href = google; alt.target = "_blank"; alt.rel = "noopener";
    } else {
      alt.addEventListener("click", function (e) { e.preventDefault(); icsIndir(); });
    }
    if (uygIci) $("#tk-ipucu").hidden = false;
  }

  /* ---------- RSVP (WhatsApp) ---------- */
  function numara(s) {
    s = String(s || "").replace(/\D/g, "");
    if (/^0?5\d{9}$/.test(s)) s = "90" + s.replace(/^0/, "");
    return /^90\d{10}$/.test(s) ? s : null;
  }
  function rsvp() {
    var form = $("#rsvp-form"), kisi = $("#kisi"), hata = $("#hata"), ad = $("#ad-alan");
    var n = 1, max = (V.rsvp && V.rsvp.kisi_siniri) || 6;
    var dugmeler = $$(".step button", form);
    function guncelle() {
      kisi.textContent = n;
      dugmeler[0].disabled = n <= 1; dugmeler[1].disabled = n >= max;
    }
    dugmeler.forEach(function (b) {
      b.addEventListener("click", function () {
        n = Math.min(max, Math.max(1, n + Number(b.dataset.d))); guncelle();
      });
    });
    guncelle();
    $$("[data-yanit]", form).forEach(function (b) {
      b.addEventListener("click", function () {
        var evet = b.dataset.yanit === "evet", isim = ad.value.trim();
        hata.textContent = "";
        if (!V.ornek && !isim) { hata.textContent = "Lütfen adınızı yazın."; ad.focus(); return; }
        var metin, num;
        if (V.ornek) { metin = V.boztas.mesaj_rsvp; num = numara(V.boztas.numara); }
        else {
          metin = (evet ? V.whatsapp.katilim : V.whatsapp.red).replace("{ad}", isim).replace("{n}", n);
          num = numara(V.whatsapp.numara);
        }
        if (!num && V.ornek) { num = ""; }
        else if (!num) { hata.textContent = "WhatsApp numarası geçersiz, lütfen ev sahibine ulaşın."; return; }
        var a = document.createElement("a");
        a.href = num ? "https://wa.me/" + num + "?text=" + encodeURIComponent(metin) : V.boztas.instagram;
        a.target = "_blank"; a.rel = "noopener";
        document.body.appendChild(a); a.click(); a.remove();
        // Colin & Dewi dersi: yanıttan sonra döngüyü kapat
        form.hidden = true;
        var t = $("#tesekkur"); t.hidden = false;
        $("#tsk-not").textContent = V.ornek
          ? "Örnekte yanıtınız Boztaş Digital’e gitti; gerçek davetiyede ev sahibine ulaşır."
          : (evet ? "Sizi aramızda görmek için sabırsızlanıyoruz." : "Haber verdiğiniz için teşekkürler, sizi özleyeceğiz.");
        $("#tsk-takvim").hidden = !evet;
      });
    });
  }

  /* ---------- alt çubuk ---------- */
  function cubuk() {
    var bar = $("#bar");
    if (!bar || !IO) return;
    var heroDisarda = false, rsvpIci = false, sonIci = false;
    function ayarla() { bar.classList.toggle("goster", heroDisarda && !rsvpIci && !sonIci); }
    new IntersectionObserver(function (l) { heroDisarda = l[0].intersectionRatio < 0.22; ayarla(); }, { threshold: [0, 0.22, 0.5] }).observe($("#ust"));
    new IntersectionObserver(function (l) { rsvpIci = l[0].isIntersecting; ayarla(); }, { rootMargin: "-25% 0px -25% 0px" }).observe($("#rsvp"));
    new IntersectionObserver(function (l) { sonIci = l[0].isIntersecting; ayarla(); }, { rootMargin: "0px 0px -20% 0px" }).observe($(".kapanis"));
  }

  belir(); omurga(); sayac(); takvim(); rsvp(); cubuk();
})();
