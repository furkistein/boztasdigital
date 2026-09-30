// Boztaş Digital · SSS asistanı (yapay zekâsız). Yalnız işletmenin ONAYLADIĞI cevapları gösterir.
// Anahtar yok, ağ isteği yok, çerez/kayıt yok: her şey bu dosyada + sayfadaki SSS listesinde.
// Kullanım: SssAsistan.baslat({ ad, renk, yazi, zemin, whatsapp, telefon, sss:[{s,k:[..],c,eylem?}], saglik?, ornekNot?, alt? })
(function () {
  "use strict";

  var TR = { "ı": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c", "â": "a", "î": "i", "û": "u" };
  function duz(s) {
    return String(s).toLocaleLowerCase("tr").replace(/[ışğüöçâîû]/g, function (h) { return TR[h]; })
      .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  var DURAK = { mi: 1, mu: 1, bir: 1, ve: 1, da: 1, de: 1, ne: 1, var: 1, yok: 1, icin: 1, ile: 1, nasil: 1, nerede: 1, bu: 1, su: 1, o: 1, ben: 1, biz: 1, siz: 1, misiniz: 1, musunuz: 1, midir: 1 };
  var TIBBI = /\b(agri|ilac|tedavi|teshis|hamile|enfeksiyon|kanama|ates|recete|doz|hastalik|belirti|yan etki|tansiyon|seker hastal|kanser)/;

  function guvenliHref(h) {
    return typeof h === "string" && /^(https:\/\/|tel:|#|\.\.?\/)/.test(h) ? h : "#";
  }

  function eslestir(sorgu, sss) {
    var q = duz(sorgu), t = q.split(" ").filter(function (x) { return x.length > 1; });
    var en = null, enP = 0;
    sss.forEach(function (e) {
      var p = 0;
      (e.k || []).forEach(function (kw) {
        var k = duz(kw);
        if (!k) return;
        if (k.indexOf(" ") > -1) { if (q.indexOf(k) > -1) p += 3; }
        else if (t.some(function (w) { return w.indexOf(k) === 0 || (w.length > 4 && k.indexOf(w) === 0 && k.length - w.length < 3); })) p += 3;
      });
      var st = duz(e.s).split(" ");
      t.forEach(function (w) { if (w.length > 3 && !DURAK[w] && st.some(function (x) { return x.indexOf(w.slice(0, 5)) === 0; })) p += 1; });
      if (p > enP) { enP = p; en = e; }
    });
    return enP >= 3 ? en : null;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function baslat(a) {
    var sss = a.sss || [];
    var renk = a.renk || "#2F4A3A", zemin = a.zemin || "#F1EADC", yazi = a.yazi || "#16201A";
    var css = "\
.as-ac{position:fixed;right:16px;bottom:var(--as-alt," + (a.alt || "20px") + ");z-index:55;display:inline-flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:13px 20px;background:" + renk + ";color:#fff;font-family:inherit;font-weight:600;font-size:14.5px;line-height:1;box-shadow:0 12px 32px -8px rgba(0,0,0,.45);cursor:pointer;transition:transform .25s,opacity .25s}\
.as-ac:hover{transform:translateY(-2px)}.as-ac:focus-visible,.as-x:focus-visible,.as-chip:focus-visible,.as-btn:focus-visible,.as-form input:focus-visible,.as-form button:focus-visible{outline:2px solid " + renk + ";outline-offset:2px}\
.as-ac svg{width:18px;height:18px;flex:none}\
.as-kutu{position:fixed;right:14px;bottom:14px;z-index:56;width:min(390px,100vw - 28px);height:min(600px,100svh - 100px);display:flex;flex-direction:column;background:" + zemin + ";color:" + yazi + ";border-radius:16px;box-shadow:0 30px 80px -20px rgba(0,0,0,.55);overflow:hidden;font-family:inherit;font-size:15px;line-height:1.5}\
.as-kutu[hidden]{display:none}\
.as-ust{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px 13px;background:" + renk + ";color:#fff}\
.as-ust b{display:block;font-size:15.5px;font-weight:600}.as-ust small{display:block;font-size:12px;opacity:.82;margin-top:1px}\
.as-x{flex:none;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:20px;line-height:1;cursor:pointer}\
.as-x:hover{background:rgba(255,255,255,.28)}\
.as-akis{flex:1;overflow-y:auto;padding:16px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}\
.as-m{max-width:88%;padding:10px 13px;border-radius:14px;white-space:pre-line;overflow-wrap:anywhere}\
.as-m.bot{align-self:flex-start;background:#fff;border:1px solid rgba(22,32,26,.1);border-bottom-left-radius:4px}\
.as-m.ben{align-self:flex-end;background:" + renk + ";color:#fff;border-bottom-right-radius:4px}\
.as-eylem,.as-chips{display:flex;flex-wrap:wrap;gap:7px;align-self:flex-start;max-width:96%}\
.as-btn,.as-chip{font:inherit;font-size:13.5px;font-weight:600;text-decoration:none;border-radius:999px;padding:8px 14px;cursor:pointer;line-height:1.2}\
.as-btn{background:" + renk + ";color:#fff;border:1px solid " + renk + "}\
.as-btn.hat{background:transparent;color:" + yazi + ";border-color:rgba(22,32,26,.3)}\
.as-chip{background:transparent;color:" + yazi + ";border:1px solid rgba(22,32,26,.28);font-weight:500;text-align:left}\
.as-chip:hover,.as-btn.hat:hover{background:rgba(22,32,26,.07)}.as-btn:hover{filter:brightness(1.12)}\
.as-form{display:flex;gap:8px;padding:10px 12px 8px;border-top:1px solid rgba(22,32,26,.12);background:" + zemin + "}\
.as-form input{flex:1;min-width:0;font:inherit;font-size:16px;padding:11px 14px;border-radius:999px;border:1px solid rgba(22,32,26,.28);background:#fff;color:" + yazi + "}\
.as-form button{flex:none;border:0;border-radius:999px;padding:0 18px;background:" + renk + ";color:#fff;font-family:inherit;font-weight:600;font-size:14px;cursor:pointer}\
.as-not{padding:0 14px 11px;font-size:11.5px;color:rgba(22,32,26,.62);line-height:1.4}\
@media (max-width:600px){.as-kutu{left:8px;right:8px;bottom:8px;width:auto;height:min(78svh,640px);border-radius:14px}.as-ac{padding:12px 17px}}\
@media (prefers-reduced-motion:reduce){.as-ac{transition:none}.as-akis{scroll-behavior:auto}}";
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);

    var ac = el("button", "as-ac");
    ac.type = "button";
    ac.setAttribute("aria-haspopup", "dialog");
    ac.setAttribute("aria-expanded", "false");
    ac.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
    ac.appendChild(el("span", null, "Soru sor"));

    var kutu = el("div", "as-kutu");
    kutu.hidden = true;
    kutu.setAttribute("role", "dialog");
    kutu.setAttribute("aria-label", (a.ad || "İşletme") + " sık sorulanlar asistanı");

    var ust = el("div", "as-ust");
    var baslik = el("div");
    baslik.appendChild(el("b", null, (a.ad || "İşletme") + " asistanı"));
    baslik.appendChild(el("small", null, "Sık sorulan sorulara hazır cevaplar"));
    var x = el("button", "as-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Sohbeti kapat");
    ust.appendChild(baslik);
    ust.appendChild(x);

    var akis = el("div", "as-akis");
    akis.setAttribute("aria-live", "polite");

    var form = el("form", "as-form");
    var giris = el("input");
    giris.type = "text";
    giris.maxLength = 200;
    giris.placeholder = "Sorunuzu yazın…";
    giris.setAttribute("aria-label", "Sorunuz");
    giris.autocomplete = "off";
    var gonder = el("button", null, "Sor");
    gonder.type = "submit";
    form.appendChild(giris);
    form.appendChild(gonder);

    var not = el("div", "as-not", a.ornekNot || "Bu bir yapay zekâ değildir; yalnız işletmenin onayladığı cevapları gösterir. Bilmediği soruda sizi işletmeye yönlendirir.");

    kutu.appendChild(ust);
    kutu.appendChild(akis);
    kutu.appendChild(form);
    kutu.appendChild(not);
    document.body.appendChild(ac);
    document.body.appendChild(kutu);

    function asagi() { akis.scrollTop = akis.scrollHeight; }
    function mesaj(metin, kim) { var m = el("div", "as-m " + kim, metin); akis.appendChild(m); asagi(); return m; }
    function dugme(ad, href, hat, hedef) {
      var b = el("a", "as-btn" + (hat ? " hat" : ""), ad);
      b.href = guvenliHref(href);
      if (/^https:/.test(b.href) && hedef !== false) { b.target = "_blank"; b.rel = "noopener noreferrer"; }
      return b;
    }
    function eylemler(liste) {
      if (!liste || !liste.length) return;
      var k = el("div", "as-eylem");
      liste.forEach(function (e, i) { k.appendChild(dugme(e.ad, e.href, i > 0)); });
      akis.appendChild(k);
      asagi();
    }
    function whatsappLink(soru) {
      var n = String(a.whatsapp || "").replace(/\D/g, "");
      var m = soru ? "Merhaba, sitedeki asistana şunu sordum, cevap bulamadı: " + soru.slice(0, 300) : "Merhaba, bir sorum var.";
      return "https://wa.me/" + n + "?text=" + encodeURIComponent(m);
    }
    function oneriler(haric) {
      var k = el("div", "as-chips");
      sss.filter(function (e) { return e !== haric; }).slice(0, 5).forEach(function (e) {
        var c = el("button", "as-chip", e.s);
        c.type = "button";
        c.addEventListener("click", function () { sor(e.s, e); });
        k.appendChild(c);
      });
      akis.appendChild(k);
      asagi();
    }
    function sor(soru, hazir) {
      soru = String(soru).trim().slice(0, 200);
      if (!soru) return;
      mesaj(soru, "ben");
      var e = hazir || null;
      if (!e && a.saglik && TIBBI.test(duz(soru))) {
        mesaj("Tıbbi konularda bilgi veremem; bu tür sorular için lütfen hekiminize danışın. Randevu ve genel bilgi için işletmeye yazabilirsiniz.", "bot");
        eylemler([{ ad: "WhatsApp'tan yazın", href: whatsappLink(soru) }].concat(a.telefon ? [{ ad: "Ara", href: "tel:" + a.telefon }] : []));
        return;
      }
      e = e || eslestir(soru, sss);
      if (e) {
        mesaj(e.c, "bot");
        eylemler(e.eylem);
        oneriler(e);
      } else {
        mesaj("Bu konuda işletmenin onayladığı bir cevabım yok; yanlış bilgi vermek istemem. Sorunuzu doğrudan işletmeye iletebilirsiniz.", "bot");
        eylemler([{ ad: "WhatsApp'tan sorun", href: whatsappLink(soru) }].concat(a.telefon ? [{ ad: "Ara", href: "tel:" + a.telefon }] : []));
      }
    }

    var acildi = false;
    function ilk() {
      acildi = true;
      mesaj("Merhaba! Ben " + (a.ad || "işletme") + " için hazırlanmış sık sorulanlar asistanıyım. Aşağıdan seçebilir ya da sorunuzu yazabilirsiniz.", "bot");
      var k = el("div", "as-chips");
      sss.slice(0, 6).forEach(function (e) {
        var c = el("button", "as-chip", e.s);
        c.type = "button";
        c.addEventListener("click", function () { sor(e.s, e); });
        k.appendChild(c);
      });
      akis.appendChild(k);
    }
    function ac_() {
      kutu.hidden = false; ac.hidden = true; ac.setAttribute("aria-expanded", "true");
      if (!acildi) ilk();
      giris.focus({ preventScroll: true });
    }
    function kapat() {
      kutu.hidden = true; ac.hidden = false; ac.setAttribute("aria-expanded", "false");
      ac.focus({ preventScroll: true });
    }
    ac.addEventListener("click", ac_);
    x.addEventListener("click", kapat);
    kutu.addEventListener("keydown", function (ev) { if (ev.key === "Escape") kapat(); });
    form.addEventListener("submit", function (ev) { ev.preventDefault(); var v = giris.value; giris.value = ""; sor(v); });
  }

  window.SssAsistan = { baslat: baslat, _eslestir: eslestir, _duz: duz };
})();
