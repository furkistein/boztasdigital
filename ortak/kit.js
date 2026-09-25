/* Boztaş Digital — ortak hareket kiti (GSAP + ScrollTrigger + Lenis)
   Sayfa önce gsap, ScrollTrigger ve lenis'i yükler, sonra bu dosyayı. Hepsi isteğe bağlı: yüklenmezse içerik statik görünür.
   Kullanım (HTML öznitelikleri):
     data-r              → kaydırınca yukarı kayarak belirir      data-r="sol|sag|olcek" farklı yönler
     data-rg             → çocukları sırayla belirir
     data-p="0.2"        → paralaks (pozitif: yavaş, negatif: ters)
     data-bol            → başlık kelime kelime maskeli yükselir
     data-say="230"      → görününce 0'dan sayar (data-son-ek="°")
     data-sekmeler       → içindeki [data-sekme] düğmeleri aynı kaptaki [data-panel]'leri açar
     data-acik           → window.SAAT = {1:[9,19],...} ile "şu an açık/kapalı" yazar
     form.demo-form      → örnek sitede gönderim yerine bilgi mesajı gösterir
   Sayfaya özel sahne:  window.SAHNE = function(gsap, ScrollTrigger){ return timeline }  (test kancası ?test=0.5 ile o ana gider)
   URL: ?statik → animasyonsuz görünüm (hareket azaltma tercihiyle aynı) */
(function () {
  var q = function (s, k) { return (k || document).querySelector(s) }, qq = function (s, k) { return [].slice.call((k || document).querySelectorAll(s)) };
  var AZ = matchMedia("(prefers-reduced-motion: reduce)").matches || /statik/.test(location.search);
  var TEST = (location.search.match(/test=([\d.]+)/) || [])[1];
  document.documentElement.classList.add(AZ ? "az" : "hareket");

  /* ---------- açık / kapalı ---------- */
  qq("[data-acik]").forEach(function (el) {
    var S = window.SAAT || {}, d = new Date(), g = d.getDay(), h = d.getHours() + d.getMinutes() / 60, a = S[g];
    var acik = !!(a && h >= a[0] && h < a[1]);
    el.classList.toggle("evet", acik);
    var bicim = function (x) { var s = Math.floor(x), dk = Math.round((x - s) * 60); return String(s).padStart(2, "0") + ":" + String(dk).padStart(2, "0") };
    // saatin okunuşuna göre Türkçe ek: 22:00'ye, 09:00'da, 18:30'a
    var son = function (x) { var H = Math.floor(x), s = H, dk = Math.round((x - H) * 60), n = dk ? dk : s;
      var bir = ["sıfır", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"], on = ["", "on", "yirmi", "otuz", "kırk", "elli"];
      return n === 0 ? "sıfır" : (n % 10 ? bir[n % 10] : on[n / 10]) };
    var ek = function (x, tur) { var w = son(x), sesli = w.match(/[aeıioöuü]/g).pop(), kalin = "aıou".indexOf(sesli) > -1, sonHarf = w.slice(-1), unluBiter = "aeıioöuü".indexOf(sonHarf) > -1;
      if (tur === "e") return "'" + (unluBiter ? "y" : "") + (kalin ? "a" : "e");
      return "'" + ("çfhkpsşt".indexOf(sonHarf) > -1 ? "t" : "d") + (kalin ? "a" : "e") };
    if (acik) el.textContent = "Şu an açık · " + bicim(a[1]) + ek(a[1], "e") + " kadar";
    else {
      for (var i = 1; i <= 7; i++) { var y = S[(g + i) % 7]; if (y) { el.textContent = "Şu an kapalı · " + (i === 1 ? "Yarın " : ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][(g + i) % 7] + " ") + bicim(y[0]) + ek(y[0], "de") + " açılıyor"; break } }
      if (a && h < a[0]) el.textContent = "Şu an kapalı · Bugün " + bicim(a[0]) + ek(a[0], "de") + " açılıyor";
    }
  });

  /* ---------- sekmeler ---------- */
  qq("[data-sekmeler]").forEach(function (g) {
    g.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sekme]"); if (!b) return;
      qq("[data-sekme]", g).forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false") });
      qq("[data-panel]", g).forEach(function (p) {
        var ac = p.dataset.panel === b.dataset.sekme; p.hidden = !ac;
        if (ac && window.gsap && !AZ) gsap.fromTo(p.children, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .04, ease: "power2.out" });
      });
    });
  });

  /* ---------- formlar ---------- */
  qq("form.demo-form").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var m = q(".form-mesaj", f), ad = q("[name=ad]", f), tel = q("[name=tel]", f);
      if ((ad && !ad.value.trim()) || (tel && tel.value.replace(/\D/g, "").length < 10)) { m.textContent = "Lütfen adınızı ve geçerli bir telefon numarası yazın."; return }
      m.textContent = f.dataset.mesaj || "Bu bir örnek sitedir, form gönderilmedi. Gerçek sitede talep işletmenin WhatsApp'ına ve e-postasına iletilir.";
    });
  });
  qq("input[type=date]").forEach(function (t) {
    var d = new Date(), iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    t.min = iso; if (!t.value) t.value = iso;
  });

  /* ---------- yükleme perdesi ---------- */
  function perdeKaldir() {
    var p = q(".perde"); if (!p) return;
    if (window.gsap && !AZ && !TEST) gsap.to(p, { yPercent: -100, duration: 1, ease: "expo.inOut", onComplete: function () { p.remove() } });
    else p.remove();
    setTimeout(function () { var x = q(".perde"); if (x) x.remove() }, 1800);
  }

  if (!window.gsap || !window.ScrollTrigger || AZ) {
    qq("[data-say]").forEach(function (el) { el.textContent = el.dataset.say + (el.dataset.sonEk || "") });
    document.documentElement.classList.add("statik");
    if (document.readyState === "complete") perdeKaldir(); else addEventListener("load", perdeKaldir);
    if (window.STATIK) window.STATIK();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- yumuşak kaydırma ---------- */
  var lenis = null;
  if (window.Lenis && !TEST) {
    lenis = new Lenis({ lerp: .085 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000) });
    gsap.ticker.lagSmoothing(0);
    qq('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) { var h = a.getAttribute("href"); if (h.length > 1 && q(h)) { e.preventDefault(); lenis.scrollTo(h, { duration: 1.4 }) } });
    });
  }
  window.KIT = { lenis: lenis, AZ: AZ };

  /* ---------- başlık bölme ---------- */
  qq("[data-bol]").forEach(function (h) {
    var parca = document.createDocumentFragment();
    (function isle(kaynak, hedef) {
      [].slice.call(kaynak.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          c.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { hedef.appendChild(document.createTextNode(" ")); return }
            var m = document.createElement("span"); m.className = "kit-maske";
            var i = document.createElement("span"); i.className = "kit-kelime"; i.textContent = w; m.appendChild(i); hedef.appendChild(m);
          });
        } else if (c.nodeName === "BR") hedef.appendChild(document.createElement("br"));
        else { var y = c.cloneNode(false); hedef.appendChild(y); isle(c, y) }
      });
    })(h, parca);
    h.innerHTML = ""; h.appendChild(parca);
    var st = h.hasAttribute("data-hemen") ? null : { trigger: h, start: "top 88%" };
    gsap.from(qq(".kit-kelime", h), { yPercent: 150, duration: 1.1, ease: "power4.out", stagger: .06, delay: h.hasAttribute("data-hemen") ? .5 : 0, scrollTrigger: st });
  });

  /* ---------- belirme ---------- */
  function belir(el, gecikme) {
    var tip = el.getAttribute("data-r"), from = { opacity: 0, y: 50 };
    if (tip === "sol") from = { opacity: 0, x: -60 }; else if (tip === "sag") from = { opacity: 0, x: 60 }; else if (tip === "olcek") from = { opacity: 0, scale: .92 };
    gsap.from(el, Object.assign(from, { duration: 1.1, ease: "power3.out", delay: gecikme || 0, scrollTrigger: { trigger: el, start: "top 90%" } }));
  }
  qq("[data-r]").forEach(function (el) { belir(el) });
  qq("[data-rg]").forEach(function (g) { [].slice.call(g.children).forEach(function (c, i) { c.setAttribute("data-r", c.getAttribute("data-r") || ""); belir(c, (i % 4) * .08) }) });

  /* ---------- paralaks ---------- */
  qq("[data-p]").forEach(function (el) {
    var h = parseFloat(el.dataset.p) || .2;
    gsap.fromTo(el, { yPercent: -h * 50 }, { yPercent: h * 50, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
  });

  /* ---------- sayaçlar ---------- */
  qq("[data-say]").forEach(function (el) {
    var son = parseFloat(el.dataset.say), ek = el.dataset.sonEk || "", o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: "top 90%", once: true, onEnter: function () {
      gsap.to(o, { v: son, duration: 1.6, ease: "power2.out", onUpdate: function () { el.textContent = (son % 1 ? o.v.toFixed(1) : Math.round(o.v)).toString().replace(".", ",") + ek } });
    } });
  });

  /* ---------- sayfaya özel sahne + test kancası ---------- */
  addEventListener("load", function () {
    var tl = window.SAHNE ? window.SAHNE(gsap, ScrollTrigger) : null;
    ScrollTrigger.refresh();
    perdeKaldir();
    if (TEST && tl) { if (tl.scrollTrigger) tl.scrollTrigger.kill(); tl.progress(+TEST) }
  });
})();
