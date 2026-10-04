(function () {
  "use strict";
  var KEY = "lv_masa_takip_v1";
  var TURLER = { bilardo: "Bilardo", okey: "Okey", tenis: "Masa tenisi" };
  var VARSAYILAN = {
    masalar: [
      { id: "b1", ad: "Bilardo 1", tur: "bilardo" }, { id: "b2", ad: "Bilardo 2", tur: "bilardo" },
      { id: "b3", ad: "Bilardo 3", tur: "bilardo" }, { id: "b4", ad: "Bilardo 4", tur: "bilardo" },
      { id: "o1", ad: "Okey 1", tur: "okey" }, { id: "o2", ad: "Okey 2", tur: "okey" },
      { id: "t1", ad: "Tenis 1", tur: "tenis" }, { id: "t2", ad: "Tenis 2", tur: "tenis" }
    ],
    tarife: { bilardo: 180, okey: 0, tenis: 80 },
    minDk: 15,
    urunler: [
      { id: "u1", ad: "Çay", fiyat: 20 }, { id: "u2", ad: "Türk kahvesi", fiyat: 60 },
      { id: "u3", ad: "Kola", fiyat: 50 }, { id: "u4", ad: "Soğuk çay", fiyat: 50 },
      { id: "u5", ad: "Su", fiyat: 15 }, { id: "u6", ad: "Tost", fiyat: 90 },
      { id: "u7", ad: "Cips", fiyat: 40 }
    ]
  };

  var S;
  function yukle() {
    var ham = null;
    try { ham = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    S = ham && ham.masalar ? ham : { masalar: VARSAYILAN.masalar, tarife: VARSAYILAN.tarife, minDk: VARSAYILAN.minDk, urunler: VARSAYILAN.urunler, acik: {}, gecmis: [] };
    S.acik = S.acik || {}; S.gecmis = S.gecmis || [];
  }
  function kaydet() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var TL = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  function tl(n) { return TL.format(n) + " TL"; }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function sureYaz(sn) { sn = Math.max(0, Math.floor(sn)); var s = sn % 60, d = Math.floor(sn / 60) % 60, h = Math.floor(sn / 3600); return (h ? h + ":" + p2(d) : p2(d)) + ":" + p2(s); }
  function bugun() { var d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function saat(ts) { var d = new Date(ts); return p2(d.getHours()) + ":" + p2(d.getMinutes()); }
  function urunBul(id) { for (var i = 0; i < S.urunler.length; i++) if (S.urunler[i].id === id) return S.urunler[i]; return null; }

  function masaUcret(m, sn) {
    var rate = S.tarife[m.tur] || 0;
    if (!rate) return 0;
    var dk = Math.max(Math.ceil(sn / 60), S.minDk);
    return Math.ceil(rate * dk / 60 / 5) * 5;
  }
  function kalemToplam(k) {
    var t = 0;
    Object.keys(k || {}).forEach(function (id) { var u = urunBul(id); if (u) t += u.fiyat * k[id]; });
    return t;
  }
  function kalemYazi(k) {
    var p = [];
    Object.keys(k || {}).forEach(function (id) { var u = urunBul(id); if (u && k[id] > 0) p.push(k[id] + " " + u.ad); });
    return p.join(", ");
  }
  function sureSn(a) { return (Date.now() - a.baslangic) / 1000; }

  /* ---------- masa kartları ---------- */
  var kartlar = {};
  function topIcon(tur) {
    var s = "http://www.w3.org/2000/svg", v = document.createElementNS(s, "svg");
    v.setAttribute("viewBox", "0 0 32 32"); v.setAttribute("width", "28"); v.setAttribute("height", "28"); v.setAttribute("aria-hidden", "true");
    var g = function (n, a) { var e = document.createElementNS(s, n); for (var k in a) e.setAttribute(k, a[k]); v.appendChild(e); };
    if (tur === "bilardo") { g("circle", { cx: 16, cy: 16, r: 12, fill: "none", stroke: "#D8AE4E", "stroke-width": 2 }); g("circle", { cx: 16, cy: 16, r: 5.5, fill: "#D8AE4E" }); }
    else if (tur === "okey") { g("rect", { x: 7, y: 8, width: 18, height: 16, rx: 3, fill: "none", stroke: "#D8AE4E", "stroke-width": 2 }); g("path", { d: "M12 20 L12 13 L16 18 L20 13 L20 20", fill: "none", stroke: "#D8AE4E", "stroke-width": 2, "stroke-linejoin": "round" }); }
    else { g("circle", { cx: 14, cy: 14, r: 8.5, fill: "none", stroke: "#D8AE4E", "stroke-width": 2 }); g("path", { d: "M20 20 L27 27", stroke: "#D8AE4E", "stroke-width": 3, "stroke-linecap": "round" }); }
    return v;
  }
  function izgaraCiz() {
    var iz = $("izgara"); iz.textContent = ""; kartlar = {};
    S.masalar.forEach(function (m) {
      var k = el("article", "kart bos");
      var ust = el("div", "kart-ust");
      var sol = el("div");
      sol.appendChild(el("h3", null, m.ad)); sol.appendChild(el("div", "tur", TURLER[m.tur]));
      var sag = el("div"); sag.style.display = "flex"; sag.style.gap = "8px"; sag.style.alignItems = "center";
      sag.appendChild(topIcon(m.tur));
      var rozet = el("span", "rozet", "Boş"); sag.appendChild(rozet);
      ust.appendChild(sol); ust.appendChild(sag);
      var sure = el("div", "sure", "00:00");
      var tutar = el("div", "tutar");
      var btn = el("button", "btn btn-ana", "Başlat"); btn.type = "button";
      btn.addEventListener("click", function () { if (S.acik[m.id]) sayfaAc(m.id); else baslat(m.id); });
      k.appendChild(ust); k.appendChild(sure); k.appendChild(tutar); k.appendChild(btn);
      iz.appendChild(k);
      kartlar[m.id] = { kart: k, rozet: rozet, sure: sure, tutar: tutar, btn: btn };
    });
    guncelle();
  }
  function guncelle() {
    var dolu = 0;
    S.masalar.forEach(function (m) {
      var c = kartlar[m.id]; if (!c) return;
      var a = S.acik[m.id];
      if (a) {
        dolu++;
        var sn = sureSn(a), u = masaUcret(m, sn), kt = kalemToplam(a.kalemler);
        c.kart.className = "kart dolu"; c.rozet.textContent = "Oyunda"; c.sure.textContent = sureYaz(sn);
        c.tutar.textContent = ""; var b = el("b", null, tl(u + kt)); c.tutar.appendChild(b);
        c.tutar.appendChild(document.createTextNode(kt ? "  (içecek/yiyecek " + tl(kt) + ")" : ""));
        c.btn.className = "btn btn-ince"; c.btn.textContent = "Hesap / ürün ekle";
      } else {
        c.kart.className = "kart bos"; c.rozet.textContent = "Boş"; c.sure.textContent = "00:00";
        c.tutar.textContent = (S.tarife[m.tur] ? tl(S.tarife[m.tur]) + " / saat" : "Masa ücreti yok, yalnız adisyon");
        c.btn.className = "btn btn-ana"; c.btn.textContent = "Başlat";
      }
    });
    var h = bugunKayitlar(), ciro = 0; h.forEach(function (r) { ciro += r.toplam; });
    var sy = $("sayim"); sy.textContent = "";
    [["Oyunda", dolu], ["Boş", S.masalar.length - dolu], ["Bugünkü ciro", tl(ciro)]].forEach(function (x) {
      var s = el("span"); s.appendChild(el("b", null, String(x[1]))); s.appendChild(document.createTextNode(" " + x[0].toLowerCase())); sy.appendChild(s);
    });
    var acikSayfa = sayfaMasa;
    if (acikSayfa && S.acik[acikSayfa]) sayfaSayilari(acikSayfa);
  }
  function baslat(id) { S.acik[id] = { baslangic: Date.now(), kalemler: {} }; kaydet(); guncelle(); }

  /* ---------- alt sayfa: hesap ---------- */
  var sayfaMasa = null;
  function masaBul(id) { for (var i = 0; i < S.masalar.length; i++) if (S.masalar[i].id === id) return S.masalar[i]; return null; }
  function sayfaAc(id) {
    sayfaMasa = id; var m = masaBul(id), a = S.acik[id];
    var ic = $("sayfaIc"); ic.textContent = "";
    var bas = el("div", "sayfa-bas"), hb = el("h3", null, m.ad); hb.id = "sayfaBaslik";
    var kp = el("button", "kapat", "×"); kp.type = "button"; kp.setAttribute("aria-label", "Kapat"); kp.addEventListener("click", sayfaKapat);
    bas.appendChild(hb); bas.appendChild(kp); ic.appendChild(bas);
    ic.appendChild(el("div", "tur", TURLER[m.tur] + " · başlangıç " + saat(a.baslangic)));
    var bs = el("div", "buyuk-sure", "00:00"); bs.id = "bSure"; ic.appendChild(bs);
    var sat = el("div", "satirlar"); sat.id = "satirlar"; ic.appendChild(sat);
    var ms = el("div", "alt-satir"); ms.id = "mUcret"; ic.appendChild(ms);
    var ks = el("div", "alt-satir"); ks.id = "kToplam"; ic.appendChild(ks);
    var tp = el("div", "toplam"); tp.id = "gToplam"; ic.appendChild(tp);
    var is = el("div", "islem");
    var kapa = el("button", "btn btn-ana", "Hesabı kapat ve kaydet"); kapa.type = "button"; kapa.addEventListener("click", function () { hesapKapat(id); });
    var iptal = el("button", "btn btn-tehlike", "Oyunu iptal et (kayıt tutma)"); iptal.type = "button";
    iptal.addEventListener("click", function () { iptal.textContent = "Emin misiniz? Bir daha dokunun"; iptal.onclick = function () { delete S.acik[id]; kaydet(); sayfaKapat(); guncelle(); }; });
    is.appendChild(kapa); is.appendChild(iptal); ic.appendChild(is);
    satirlariCiz(id);
    $("ortu").hidden = false; $("sayfa").hidden = false; sayfaSayilari(id);
    $("ortu").onclick = sayfaKapat;
    kp.focus();
  }
  function satirlariCiz(id) {
    var a = S.acik[id], sat = $("satirlar"); sat.textContent = "";
    S.urunler.forEach(function (u) {
      var r = el("div", "satir"), ad = el("div", "ad", u.ad); ad.appendChild(el("small", null, tl(u.fiyat)));
      var ad2 = el("div", "adet");
      var eks = el("button", null, "−"); eks.type = "button"; eks.setAttribute("aria-label", u.ad + " azalt");
      var sayi = el("span", null, String(a.kalemler[u.id] || 0));
      var art = el("button", null, "+"); art.type = "button"; art.setAttribute("aria-label", u.ad + " ekle");
      eks.addEventListener("click", function () { var n = (a.kalemler[u.id] || 0) - 1; if (n <= 0) delete a.kalemler[u.id]; else a.kalemler[u.id] = n; sayi.textContent = String(a.kalemler[u.id] || 0); kaydet(); sayfaSayilari(id); guncelle(); });
      art.addEventListener("click", function () { a.kalemler[u.id] = (a.kalemler[u.id] || 0) + 1; sayi.textContent = String(a.kalemler[u.id]); kaydet(); sayfaSayilari(id); guncelle(); });
      ad2.appendChild(eks); ad2.appendChild(sayi); ad2.appendChild(art);
      r.appendChild(ad); r.appendChild(ad2); sat.appendChild(r);
    });
  }
  function sayfaSayilari(id) {
    var a = S.acik[id]; if (!a || !$("bSure")) return;
    var m = masaBul(id), sn = sureSn(a), u = masaUcret(m, sn), kt = kalemToplam(a.kalemler);
    $("bSure").textContent = sureYaz(sn);
    $("mUcret").textContent = "";
    $("mUcret").appendChild(el("span", null, S.tarife[m.tur] ? "Masa ücreti (" + Math.max(Math.ceil(sn / 60), S.minDk) + " dk)" : "Masa ücreti yok"));
    $("mUcret").appendChild(el("span", null, tl(u)));
    $("kToplam").textContent = "";
    $("kToplam").appendChild(el("span", null, "İçecek / yiyecek")); $("kToplam").appendChild(el("span", null, tl(kt)));
    $("gToplam").textContent = ""; $("gToplam").appendChild(el("span", null, "Toplam")); $("gToplam").appendChild(el("b", null, tl(u + kt)));
  }
  function sayfaKapat() { sayfaMasa = null; $("sayfa").hidden = true; $("ortu").hidden = true; $("sayfaIc").textContent = ""; }

  function fisMetni(r) {
    var s = "LAS VEGAS BİLARDO (örnek fiş)\n" + r.masa + "  " + saat(r.baslangic) + " - " + saat(r.bitis) + "\n";
    s += "Süre: " + Math.floor(r.sureSn / 60) + " dk\nMasa ücreti: " + tl(r.masaUcret) + "\n";
    var ky = kalemYazi(r.kalemler); if (ky) s += "Ürünler: " + ky + " = " + tl(r.kalemTop) + "\n";
    return s + "TOPLAM: " + tl(r.toplam);
  }
  function hesapKapat(id) {
    var m = masaBul(id), a = S.acik[id], sn = sureSn(a), u = masaUcret(m, sn), kt = kalemToplam(a.kalemler);
    var r = { tarih: bugun(), masa: m.ad, tur: m.tur, baslangic: a.baslangic, bitis: Date.now(), sureSn: sn, masaUcret: u, kalemler: a.kalemler, kalemTop: kt, toplam: u + kt };
    S.gecmis.push(r); delete S.acik[id]; kaydet(); guncelle();
    var ic = $("sayfaIc"); ic.textContent = ""; sayfaMasa = null;
    var bas = el("div", "sayfa-bas"), hb = el("h3", null, "Hesap kapandı"); hb.id = "sayfaBaslik";
    var kp = el("button", "kapat", "×"); kp.type = "button"; kp.setAttribute("aria-label", "Kapat"); kp.addEventListener("click", sayfaKapat);
    bas.appendChild(hb); bas.appendChild(kp); ic.appendChild(bas);
    ic.appendChild(el("div", "fis", fisMetni(r)));
    var is = el("div", "islem sira");
    var wa = el("a", "btn btn-ince", "Fişi WhatsApp'a gönder"); wa.href = "https://wa.me/?text=" + encodeURIComponent(fisMetni(r)); wa.target = "_blank"; wa.rel = "noopener";
    var tm = el("button", "btn btn-ana", "Tamam"); tm.type = "button"; tm.addEventListener("click", sayfaKapat);
    is.appendChild(wa); is.appendChild(tm); ic.appendChild(is); tm.focus();
  }

  /* ---------- gün özeti ---------- */
  function bugunKayitlar() { var g = bugun(); return S.gecmis.filter(function (r) { return r.tarih === g; }); }
  function ozetCiz() {
    var h = bugunKayitlar(), ciro = 0, masaT = 0, kalemT = 0, sn = 0;
    h.forEach(function (r) { ciro += r.toplam; masaT += r.masaUcret; kalemT += r.kalemTop; sn += r.sureSn; });
    var kt = $("ozetKutular"); kt.textContent = "";
    [["Toplam ciro", tl(ciro)], ["Masa ücreti", tl(masaT)], ["İçecek / yiyecek", tl(kalemT)], ["Oyun sayısı", String(h.length)]].forEach(function (x) {
      var k = el("div", "kutu"); k.appendChild(el("span", null, x[0])); k.appendChild(el("b", null, x[1])); kt.appendChild(k);
    });
    var tb = $("ozetMasa"); tb.textContent = "";
    var bas = el("div", "tr bas"); ["Masa", "Oyun", "Süre", "Tutar"].forEach(function (x) { bas.appendChild(el("span", null, x)); }); tb.appendChild(bas);
    var by = {};
    h.forEach(function (r) { var b = by[r.masa] || (by[r.masa] = { n: 0, sn: 0, t: 0 }); b.n++; b.sn += r.sureSn; b.t += r.toplam; });
    var adlar = Object.keys(by);
    if (!adlar.length) tb.appendChild(el("div", "bos-yazi", "Bugün kapanan hesap yok. Masalar sekmesinden bir oyun başlatıp kapatın ya da Ayarlar'dan örnek gün yükleyin."));
    adlar.forEach(function (ad) {
      var b = by[ad], r = el("div", "tr");
      r.appendChild(el("span", null, ad)); r.appendChild(el("span", null, String(b.n))); r.appendChild(el("span", null, Math.round(b.sn / 60) + " dk")); r.appendChild(el("span", null, tl(b.t))); tb.appendChild(r);
    });
    var ls = $("ozetListe"); ls.textContent = "";
    if (!h.length) ls.appendChild(el("div", "bos-yazi", "Henüz kayıt yok."));
    h.slice().reverse().forEach(function (r) {
      var l = el("div", "l-satir"), sol = el("div");
      sol.appendChild(document.createTextNode(r.masa + " · " + Math.round(r.sureSn / 60) + " dk"));
      var ky = kalemYazi(r.kalemler); sol.appendChild(el("small", null, saat(r.baslangic) + "-" + saat(r.bitis) + (ky ? " · " + ky : "")));
      l.appendChild(sol); l.appendChild(el("b", null, tl(r.toplam))); ls.appendChild(l);
    });
  }
  function ozetMetni() {
    var h = bugunKayitlar(), ciro = 0, masaT = 0, kalemT = 0;
    h.forEach(function (r) { ciro += r.toplam; masaT += r.masaUcret; kalemT += r.kalemTop; });
    return "Las Vegas Bilardo gün sonu (örnek)\n" + bugun() + "\nOyun: " + h.length + "\nMasa ücreti: " + tl(masaT) + "\nİçecek/yiyecek: " + tl(kalemT) + "\nTOPLAM CİRO: " + tl(ciro);
  }

  /* ---------- ayarlar ---------- */
  function ayarCiz() {
    var tf = $("tarifeForm"); tf.textContent = "";
    Object.keys(TURLER).forEach(function (t) {
      var a = el("div", "alan"), lb = el("label", null, TURLER[t] + " (saat başı)"); lb.setAttribute("for", "tf-" + t);
      var i = el("input"); i.id = "tf-" + t; i.type = "number"; i.min = "0"; i.step = "5"; i.inputMode = "numeric"; i.value = S.tarife[t];
      i.addEventListener("input", function () { S.tarife[t] = Math.max(0, +i.value || 0); kaydet(); guncelle(); });
      a.appendChild(lb); a.appendChild(i); tf.appendChild(a);
    });
    var a2 = el("div", "alan"), l2 = el("label", null, "En az (dk)"); l2.setAttribute("for", "tf-min");
    var i2 = el("input"); i2.id = "tf-min"; i2.type = "number"; i2.min = "0"; i2.step = "5"; i2.inputMode = "numeric"; i2.value = S.minDk;
    i2.addEventListener("input", function () { S.minDk = Math.max(0, +i2.value || 0); kaydet(); guncelle(); });
    a2.appendChild(l2); a2.appendChild(i2); tf.appendChild(a2);
    var uf = $("urunForm"); uf.textContent = "";
    S.urunler.forEach(function (u, idx) {
      var a = el("div", "alan"), g = el("div", "grup");
      var ad = el("input", "metin"); ad.type = "text"; ad.value = u.ad; ad.setAttribute("aria-label", "Ürün adı"); ad.addEventListener("input", function () { u.ad = ad.value; kaydet(); });
      var fy = el("input"); fy.type = "number"; fy.min = "0"; fy.step = "5"; fy.inputMode = "numeric"; fy.value = u.fiyat; fy.setAttribute("aria-label", u.ad + " fiyatı"); fy.addEventListener("input", function () { u.fiyat = Math.max(0, +fy.value || 0); kaydet(); guncelle(); });
      var sl = el("button", "sil", "×"); sl.type = "button"; sl.setAttribute("aria-label", "Ürünü sil");
      sl.addEventListener("click", function () { S.urunler.splice(idx, 1); kaydet(); ayarCiz(); });
      g.appendChild(ad); a.appendChild(g); var g2 = el("div", "grup"); g2.appendChild(fy); g2.appendChild(sl); a.appendChild(g2); uf.appendChild(a);
    });
  }

  function ornekGun() {
    var ben = Date.now();
    var O = [
      ["Bilardo 1", "bilardo", 12, 75, { u1: 3, u3: 1 }], ["Bilardo 2", "bilardo", 25, 130, { u2: 2, u6: 1 }],
      ["Bilardo 3", "bilardo", 41, 60, { u1: 2 }], ["Tenis 1", "tenis", 58, 40, { u5: 2 }],
      ["Okey 1", "okey", 80, 150, { u1: 8, u6: 2, u7: 2 }], ["Bilardo 1", "bilardo", 105, 95, { u3: 2, u7: 1 }],
      ["Bilardo 4", "bilardo", 140, 50, { u1: 2 }], ["Tenis 2", "tenis", 175, 30, {}], ["Bilardo 2", "bilardo", 210, 120, { u4: 2, u6: 2 }]
    ];
    S.gecmis = S.gecmis.filter(function (r) { return !r.ornek; });
    O.forEach(function (o) {
      var bit = ben - o[2] * 60000, b = bit - o[3] * 60000;
      var m = { tur: o[1] }, sn = o[3] * 60, u = masaUcret(m, sn), kt = kalemToplam(o[4]);
      S.gecmis.push({ tarih: bugun(), masa: o[0], tur: o[1], baslangic: b, bitis: bit, sureSn: sn, masaUcret: u, kalemler: o[4], kalemTop: kt, toplam: u + kt, ornek: true });
    });
    ["b1", "o1"].forEach(function (id, i) { if (!S.acik[id]) S.acik[id] = { baslangic: ben - (i ? 38 : 22) * 60000 - 17000, kalemler: i ? { u1: 4, u7: 1 } : { u1: 1, u3: 1 } }; });
    kaydet(); guncelle(); ozetCiz(); sekmeAc("masalar");
  }

  /* ---------- sekmeler ve başlangıç ---------- */
  function sekmeAc(ad) {
    ["masalar", "ozet", "ayar"].forEach(function (s) {
      $("s-" + s).hidden = s !== ad; $("t-" + s).setAttribute("aria-selected", s === ad ? "true" : "false");
    });
    if (ad === "ozet") ozetCiz();
    if (ad === "ayar") ayarCiz();
    if (ad === "masalar") guncelle();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("sayfa").hidden) sayfaKapat(); });

  yukle();
  var gl = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"], dn = new Date();
  $("gunEtiket").textContent = dn.getDate() + "." + p2(dn.getMonth() + 1) + "." + dn.getFullYear() + " · " + gl[dn.getDay()];
  Array.prototype.forEach.call(document.querySelectorAll(".sekmeler button"), function (b) { b.addEventListener("click", function () { sekmeAc(b.getAttribute("data-sekme")); }); });
  $("waOzet").addEventListener("click", function () { window.open("https://wa.me/?text=" + encodeURIComponent(ozetMetni()), "_blank", "noopener"); });
  $("urunEkle").addEventListener("click", function () { S.urunler.push({ id: "u" + Date.now(), ad: "Yeni ürün", fiyat: 0 }); kaydet(); ayarCiz(); });
  $("ornekGun").addEventListener("click", ornekGun);
  var sf = $("gunSifirla");
  sf.addEventListener("click", function () {
    if (sf.getAttribute("data-onay") !== "1") { sf.setAttribute("data-onay", "1"); sf.textContent = "Emin misiniz? Bir daha dokunun"; return; }
    var g = bugun(); S.gecmis = S.gecmis.filter(function (r) { return r.tarih !== g; }); S.acik = {}; kaydet();
    sf.removeAttribute("data-onay"); sf.textContent = "Günü sıfırla"; guncelle();
  });
  izgaraCiz();
  setInterval(guncelle, 1000);
})();
