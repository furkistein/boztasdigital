/* Tekpanel — e-ticaret entegrasyon paneli demosu.
   Tüm veriler örnektir ve tarayıcıda üretilir; gerçek sürümde kanal API'lerinden gelir. */
(function () {
  "use strict";

  // ---------- yardımcılar ----------
  const $ = (s, k) => (k || document).querySelector(s);
  const $$ = (s, k) => Array.from((k || document).querySelectorAll(s));
  const GUN = 86400000;
  const tlFmt = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
  const tl2Fmt = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sifirla = v => (Math.abs(v) < 0.005 ? 0 : v);
  const tl = v => tlFmt.format(Math.round(sifirla(v)) || 0);
  const tl2 = v => tl2Fmt.format(sifirla(v));
  const yuzde = (v, h = 1) => (isFinite(v) ? (v < 0 ? "-%" : "%") + Math.abs(v).toFixed(h).replace(".", ",") : "%0");
  const kacis = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sinif = v => (v < -0.5 ? "eksi" : "arti");

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260928);
  const sec = arr => arr[Math.floor(rnd() * arr.length)];
  const fiyat9 = p => Math.max(9, Math.round(p / 10) * 10 - 1);

  // ---------- tanımlar ----------
  const KANAL = {
    ty: { ad: "Trendyol", kisa: "Trendyol" },
    hb: { ad: "Hepsiburada", kisa: "Hepsiburada" },
    wc: { ad: "WooCommerce", kisa: "Site" }
  };
  const KANAL_RENK = { ty: "#e0692a", hb: "#7b55c9", wc: "#2c79cf" };
  const KAT = {
    nev: { ad: "Nevresim & Yatak", kdv: 10 },
    hav: { ad: "Havlu & Bornoz", kdv: 10 },
    bat: { ad: "Battaniye & Pike", kdv: 10 },
    mut: { ad: "Mutfak Tekstili", kdv: 10 },
    kea: { ad: "Küçük Ev Aletleri", kdv: 20 },
    gur: { ad: "Mutfak Gereçleri", kdv: 20 }
  };
  const KOM_VARSAYILAN = {
    nev: { ty: 19, hb: 17, wc: 3.2 },
    hav: { ty: 19, hb: 17, wc: 3.2 },
    bat: { ty: 19, hb: 17.5, wc: 3.2 },
    mut: { ty: 21, hb: 19, wc: 3.2 },
    kea: { ty: 13, hb: 12, wc: 3.2 },
    gur: { ty: 20, hb: 18, wc: 3.2 }
  };
  let KOM = JSON.parse(JSON.stringify(KOM_VARSAYILAN));

  // Kargo (satıcının ödediği, KDV dahil) — desiye göre anlaşmalı tarife
  const KARGO_TARIFE = [[2, 58], [5, 78], [10, 105], [20, 150], [Infinity, 210]];
  const kargoUcret = desi => KARGO_TARIFE.find(([ust]) => desi <= ust)[1];

  // [ad, kategori, alış maliyeti (KDV hariç), liste fiyatı (KDV dahil), desi, stok, satış ağırlığı]
  const HAM = [
    ["Ranforce Nevresim Takımı Çift Kişilik", "nev", 420, 899, 4, 46, 9],
    ["Pamuk Saten Nevresim Takımı Çift Kişilik", "nev", 690, 1449, 4, 22, 5],
    ["Tek Kişilik Nevresim Takımı", "nev", 280, 599, 3, 58, 6],
    ["Bebek Nevresim Seti", "nev", 230, 529, 2, 6, 4],
    ["Lastikli Çarşaf 160x200", "nev", 140, 329, 2, 70, 5],
    ["Yastık Kılıfı 2'li", "nev", 55, 129, 1, 120, 6],
    ["Pamuklu Havlu Seti 4'lü", "hav", 260, 599, 3, 38, 6],
    ["Kadın Bornoz", "hav", 310, 749, 3, 17, 3],
    ["El Havlusu 50x90", "hav", 38, 99, 1, 150, 6],
    ["Müslin Pike Çift Kişilik", "bat", 360, 799, 4, 29, 4],
    ["Welsoft Battaniye", "bat", 240, 549, 6, 33, 4],
    ["Microfiber Yorgan Çift Kişilik", "bat", 380, 849, 12, 4, 3],
    ["Mutfak Önlüğü", "mut", 45, 159, 1, 90, 3],
    ["Masa Örtüsü 150x220", "mut", 150, 379, 2, 41, 3],
    ["Kurulama Bezi 5'li", "mut", 40, 119, 1, 2, 5],
    ["Tost Makinesi", "kea", 850, 1699, 5, 25, 4],
    ["El Blender Seti", "kea", 620, 1299, 4, 19, 4],
    ["Çelik Kettle 1,7 L", "kea", 390, 849, 3, 8, 5],
    ["Türk Kahvesi Makinesi", "kea", 720, 1549, 3, 3, 4],
    ["Airfryer 4 L", "kea", 1650, 3299, 9, 11, 4],
    ["Saç Kurutma Makinesi", "kea", 480, 999, 2, 27, 3],
    ["Doğrayıcı Rondo", "kea", 520, 1099, 4, 5, 3],
    ["Çelik Tencere Seti 7 Parça", "gur", 1150, 2499, 10, 9, 2],
    ["Döküm Tava 28 cm", "gur", 540, 1199, 5, 2, 2],
    ["Silikon Spatula Seti", "gur", 60, 179, 1, 6, 3]
  ];
  const URUNLER = HAM.map((h, i) => ({
    id: i,
    sku: "TP-" + String(1001 + i),
    ad: h[0], kat: h[1], maliyet: h[2], desi: h[4], stok: h[5], agirlik: h[6],
    fiyat: { ty: h[3], hb: fiyat9(h[3] * 1.02), wc: fiyat9(h[3] * 0.95) }
  }));

  // ---------- sipariş üretimi ----------
  const simdi = new Date();
  const bugunBas = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
  const SEHIR = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Denizli", "Konya", "Kayseri", "Eskişehir", "Samsun", "Gaziantep", "Mersin", "Kocaeli", "Trabzon", "Aydın", "Muğla", "Manisa", "Sakarya"];
  const HARF = "ABCDEFGHİKLMNOPRSTUVYZ";
  const maskeAd = () => sec(HARF) + "*** " + sec(HARF) + "***";
  const toplamAgirlik = URUNLER.reduce((t, u) => t + u.agirlik, 0);
  function urunSec() {
    let r = rnd() * toplamAgirlik;
    for (const u of URUNLER) { r -= u.agirlik; if (r <= 0) return u; }
    return URUNLER[0];
  }
  let wcNo = 4180;
  function siparisNo(k) {
    if (k === "ty") return String(Math.floor(3100000000 + rnd() * 899999999));
    if (k === "hb") return "4" + String(Math.floor(10000000 + rnd() * 89999999));
    return "#" + (++wcNo);
  }
  function siparisYap(gunOnce, zaman) {
    const r = rnd();
    const kanal = r < 0.5 ? "ty" : r < 0.8 ? "hb" : "wc";
    const u = urunSec();
    const adet = rnd() < 0.15 ? 2 : 1;
    const ind = kanal !== "wc" && rnd() < 0.2 ? 0.1 : 0;
    let durum;
    if (gunOnce === 0) durum = rnd() < 0.7 ? "yeni" : "kargoda";
    else if (gunOnce <= 2) durum = gunOnce === 1 && rnd() < 0.25 ? "yeni" : "kargoda";
    else durum = rnd() < 0.1 ? "iade" : "teslim";
    return { no: siparisNo(kanal), kanal, urun: u.id, adet, birim: u.fiyat[kanal], ind, durum, t: zaman, musteri: maskeAd(), sehir: sec(SEHIR) };
  }
  const SIPARISLER = [];
  for (let i = 0; i < 60; i++) {
    const gunOnce = i < 3 ? 0 : Math.min(29, Math.floor(Math.pow(rnd(), 1.25) * 30));
    let t;
    if (gunOnce === 0) t = bugunBas + rnd() * Math.max(1, simdi.getTime() - bugunBas);
    else t = bugunBas - gunOnce * GUN + (8 + rnd() * 15) * 3600000;
    SIPARISLER.push(siparisYap(gunOnce, t));
  }
  // İade oranı gerçekçi olsun diye eski siparişlerden birkaçı kesin iade
  SIPARISLER.filter(o => o.t < bugunBas - 5 * GUN).slice(0, 12).forEach((o, i) => { if (i % 4 === 1) o.durum = "iade"; });
  SIPARISLER.sort((a, b) => b.t - a.t);

  // ---------- kâr hesabı ----------
  const urun = id => URUNLER[id];
  function hesap(o) {
    const u = urun(o.urun);
    const k = KAT[u.kat].kdv / 100;
    const oran = KOM[u.kat][o.kanal] / 100;
    const liste = o.birim * o.adet;
    const indirim = liste * o.ind;
    const kargoTek = kargoUcret(u.desi * o.adet);
    const r = { u, k, oran, liste, indirim, kargoTek };
    if (o.durum === "iade") {
      r.satis = 0; r.komisyon = 0; r.kargo = kargoTek * 2; r.maliyet = 0;
      r.satisKdv = 0; r.indKdv = r.kargo / 6;
    } else {
      r.satis = liste - indirim;
      r.komisyon = r.satis * oran;
      r.kargo = kargoTek;
      r.maliyet = u.maliyet * o.adet * (1 + k);
      r.satisKdv = r.satis - r.satis / (1 + k);
      r.indKdv = u.maliyet * o.adet * k + r.komisyon / 6 + r.kargo / 6;
    }
    r.kdv = r.satisKdv - r.indKdv;
    r.net = r.satis - r.komisyon - r.kargo - r.maliyet - r.kdv;
    r.marj = r.satis > 0 ? (r.net / r.satis) * 100 : 0;
    return r;
  }
  function birimKar(u, kanal) {
    const S = u.fiyat[kanal], k = KAT[u.kat].kdv / 100, oran = KOM[u.kat][kanal] / 100, g = kargoUcret(u.desi);
    const net = S / (1 + k) - (S * oran) / 1.2 - g / 1.2 - u.maliyet;
    const payda = 1 / (1 + k) - oran / 1.2;
    const basaBas = payda > 0 ? (g / 1.2 + u.maliyet) / payda : Infinity;
    return { S, net, marj: (net / S) * 100, basaBas };
  }

  // ---------- durum ----------
  let donem = 30;
  let gorunum = "ozet";
  let stokFiltre = "hepsi";
  const donemBas = () => bugunBas - (donem - 1) * GUN;
  const donemde = () => SIPARISLER.filter(o => o.t >= donemBas());
  const donemAd = () => (donem === 1 ? "Bugün" : "Son " + donem + " gün");

  const DURUM_AD = { yeni: "Yeni", kargoda: "Kargoda", teslim: "Teslim edildi", iade: "İade" };
  const rozet = k => `<span class="rozet r-${k}">${KANAL[k].kisa}</span>`;
  const durumEt = d => `<span class="durum d-${d}">${DURUM_AD[d]}</span>`;
  function tarihYaz(t) {
    const d = new Date(t);
    const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    if (t >= bugunBas) return "Bugün " + saat;
    if (t >= bugunBas - GUN) return "Dün " + saat;
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) + " " + saat;
  }

  function topla(liste) {
    const t = { siparis: 0, adet: 0, iade: 0, satis: 0, komisyon: 0, kargo: 0, maliyet: 0, kdv: 0, net: 0 };
    liste.forEach(o => {
      const h = hesap(o);
      t.siparis++; if (o.durum === "iade") t.iade++; else t.adet += o.adet;
      t.satis += h.satis; t.komisyon += h.komisyon; t.kargo += h.kargo; t.maliyet += h.maliyet; t.kdv += h.kdv; t.net += h.net;
    });
    t.marj = t.satis > 0 ? (t.net / t.satis) * 100 : 0;
    return t;
  }

  // ---------- stok analizi ----------
  function stokAnaliz() {
    const bas7 = bugunBas - 6 * GUN, bas30 = bugunBas - 29 * GUN;
    return URUNLER.map(u => {
      let s7 = 0; const kanal30 = { ty: 0, hb: 0, wc: 0 };
      SIPARISLER.forEach(o => {
        if (o.urun !== u.id || o.durum === "iade") return;
        if (o.t >= bas7) s7 += o.adet;
        if (o.t >= bas30) kanal30[o.kanal] += o.adet;
      });
      const hiz = s7 / 7;
      const gun = hiz > 0 ? u.stok / hiz : Infinity;
      let seviye = "iyi";
      if (u.stok === 0 || gun <= 10) seviye = "kritik";
      else if (gun <= 21 || u.stok <= 5) seviye = "az";
      if (hiz === 0 && u.stok > 5) seviye = "yok";
      if (hiz === 0 && u.stok <= 5) seviye = "az";
      return { u, s7, hiz, gun, kanal30, seviye };
    });
  }
  const gunEt = a => {
    if (a.hiz === 0) return `<span class="gunRozet g-${a.seviye === "az" ? "az" : "yok"}">7 günde satış yok</span>`;
    const g = Math.floor(a.gun);
    return `<span class="gunRozet g-${a.seviye}">${g > 365 ? "365+ gün" : g + " gün"}</span>`;
  };

  // ---------- çizimler ----------
  function kpiCiz() {
    const t = topla(donemde());
    const ort = t.siparis - t.iade > 0 ? t.satis / (t.siparis - t.iade) : 0;
    $("#kpiler").innerHTML = `
      <div class="kpi"><h3>Toplam ciro</h3><b class="say">${tl(t.satis)}</b><p>${donemAd()} · ort. sepet ${tl(ort)}</p></div>
      <div class="kpi vurgulu"><h3>Net kâr</h3><b class="say ${t.net < 0 ? "eksi" : ""}">${tl(t.net)}</b><p>Kâr marjı ${yuzde(t.marj)} · tüm giderler düşülmüş</p></div>
      <div class="kpi"><h3>Sipariş</h3><b class="say">${t.siparis}</b><p>${t.adet} adet ürün · 3 kanal</p></div>
      <div class="kpi"><h3>İade oranı</h3><b class="say">${yuzde(t.siparis ? (t.iade / t.siparis) * 100 : 0)}</b><p>${t.iade} iade · kargo zararı dahil</p></div>`;
  }

  const PARCALAR = [
    ["maliyet", "Ürün maliyeti", "#94a3b8"],
    ["komisyon", "Komisyon", "#f0a35e"],
    ["kargo", "Kargo", "#e3c35a"],
    ["kdv", "KDV farkı", "#b9a4e6"],
    ["net", "Net kâr", "#0f7a52"]
  ];
  function kanalGrafikCiz() {
    const liste = donemde();
    const tops = ["ty", "hb", "wc"].map(k => ({ k, t: topla(liste.filter(o => o.kanal === k)) }));
    const enBuyuk = Math.max(1, ...tops.map(x => x.t.satis));
    $("#kanalGrafik").innerHTML = tops.map(({ k, t }) => {
      let x = 0;
      const olcek = 1000 * (t.satis / enBuyuk) / Math.max(1, t.satis);
      const rects = PARCALAR.map(([a, ad, renk]) => {
        const v = Math.max(0, t[a]);
        const w = v * olcek;
        const r = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="26" fill="${renk}"><title>${ad}: ${tl(t[a])}</title></rect>`;
        x += w; return r;
      }).join("");
      const zararNot = t.net < 0 ? ` · <span class="eksi">zarar ${tl(t.net)}</span>` : "";
      return `<div class="kg-satir"><div>${rozet(k)}<div class="kucuk soluk" style="margin-top:3px">${t.siparis} sipariş</div></div>
        <svg viewBox="0 0 1000 26" preserveAspectRatio="none" aria-label="${KANAL[k].ad} gider dağılımı"><rect width="1000" height="26" fill="#f1f3f7"/>${rects}</svg>
        <div class="kg-alt">Ciro <b class="say">${tl(t.satis)}</b> → net <b class="say ${sinif(t.net)}">${tl(t.net)}</b> (${yuzde(t.marj)})${zararNot}</div></div>`;
    }).join("");
    $("#lejant").innerHTML = PARCALAR.map(([, ad, renk]) => `<span><i style="background:${renk}"></i>${ad}</span>`).join("");
  }

  function kanalTabloCiz() {
    const liste = donemde();
    const satir = (bas, t) => `<td class="sag say">${t.siparis}</td><td class="sag say">${tl(t.satis)}</td><td class="sag say">${tl(t.komisyon)}</td><td class="sag say">${tl(t.kargo)}</td><td class="sag say">${tl(t.maliyet)}</td><td class="sag say">${tl(t.kdv)}</td><td class="sag say ${sinif(t.net)}">${tl(t.net)}</td><td class="sag say ${sinif(t.net)}">${yuzde(t.marj)}</td>`;
    const govde = ["ty", "hb", "wc"].map(k => `<tr><td>${rozet(k)}</td>${satir(k, topla(liste.filter(o => o.kanal === k)))}</tr>`).join("");
    $("#kanalTablo").innerHTML = `<thead><tr><th>Kanal</th><th class="sag">Sipariş</th><th class="sag">Ciro</th><th class="sag">Komisyon</th><th class="sag">Kargo</th><th class="sag">Ürün maliyeti</th><th class="sag">KDV</th><th class="sag">Net kâr</th><th class="sag">Marj</th></tr></thead>
      <tbody>${govde}</tbody><tfoot><tr><td>Toplam</td>${satir("", topla(liste))}</tr></tfoot>`;
  }

  function trendCiz() {
    const svg = $("#trend");
    const W = Math.max(280, Math.round(svg.getBoundingClientRect().width || 600)), H = 230;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    let kovalar;
    if (donem === 1) {
      kovalar = Array.from({ length: 24 }, (_, i) => ({ bas: bugunBas + i * 3600000, bit: bugunBas + (i + 1) * 3600000, et: i % 4 === 0 ? String(i).padStart(2, "0") + ":00" : "", uzun: String(i).padStart(2, "0") + ":00" }));
      $("#trendAlt").textContent = "Bugün, saatlik";
    } else {
      kovalar = Array.from({ length: donem }, (_, i) => {
        const bas = bugunBas - (donem - 1 - i) * GUN;
        const d = new Date(bas);
        const her = donem === 7 ? 1 : 5;
        const son = i === donem - 1;
        return { bas, bit: bas + GUN, et: (donem - 1 - i) % her === 0 || son ? (son ? "Bugün" : d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })) : "", uzun: d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) };
      });
      $("#trendAlt").textContent = donemAd() + ", günlük";
    }
    kovalar.forEach(k => { const t = topla(SIPARISLER.filter(o => o.t >= k.bas && o.t < k.bit)); k.ciro = t.satis; k.net = t.net; });
    const sol = 52, sag = 8, ust = 10, alt = 26;
    const maks = Math.max(1000, ...kovalar.map(k => k.ciro));
    const min = Math.min(0, ...kovalar.map(k => k.net));
    const adim = maks > 20000 ? 10000 : maks > 8000 ? 4000 : maks > 4000 ? 2000 : 1000;
    const tepe = Math.ceil(maks / adim) * adim;
    const dip = min < 0 ? -Math.ceil(-min / adim) * adim : 0;
    const y = v => ust + (H - ust - alt) * (1 - (v - dip) / (tepe - dip));
    const gw = (W - sol - sag) / kovalar.length;
    const bw = Math.max(3, Math.min(26, gw * 0.62));
    let s = "";
    for (let v = dip; v <= tepe + 0.1; v += adim) {
      s += `<line x1="${sol}" x2="${W - sag}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#b8c1cf" : "#edf0f4"}"/>`;
      s += `<text x="${sol - 6}" y="${y(v) + 4}" text-anchor="end">${v === 0 ? "0" : (v / 1000).toLocaleString("tr-TR") + "B"}</text>`;
    }
    const noktalar = [];
    kovalar.forEach((k, i) => {
      const cx = sol + gw * i + gw / 2;
      if (k.ciro > 0) s += `<rect x="${cx - bw / 2}" y="${y(k.ciro)}" width="${bw}" height="${Math.max(0, y(0) - y(k.ciro))}" rx="2" fill="#cdd6e4"><title>${k.uzun}: ciro ${tl(k.ciro)}, net ${tl(k.net)}</title></rect>`;
      if (k.et) {
        const sonEt = i === kovalar.length - 1;
        s += `<text x="${sonEt ? W - 2 : cx}" y="${H - 8}" text-anchor="${sonEt ? "end" : "middle"}">${k.et}</text>`;
      }
      noktalar.push([cx, y(k.net), k]);
    });
    s += `<polyline fill="none" stroke="#0f7a52" stroke-width="2" stroke-linejoin="round" points="${noktalar.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}"/>`;
    noktalar.forEach(([cx, cy, k]) => {
      if (k.ciro === 0 && k.net === 0) return;
      s += `<circle cx="${cx}" cy="${cy}" r="${k.net < 0 ? 4 : 3}" fill="${k.net < 0 ? "#c0362c" : "#0f7a52"}" stroke="#fff" stroke-width="1.5"><title>${k.uzun}: net ${tl(k.net)}</title></circle>`;
    });
    svg.innerHTML = s;
  }

  function siparisSatir(o, yeni) {
    const h = hesap(o);
    const u = h.u;
    return `<tr class="tik${yeni ? " yeniSatir" : ""}" data-no="${kacis(o.no)}">
      <td data-k="tarih" class="kucuk soluk">${tarihYaz(o.t)}</td>
      <td data-k="no" class="gizM gizK kucuk say">${kacis(o.no)}</td>
      <td data-k="kanal" class="gizM">${rozet(o.kanal)}</td>
      <td data-k="urun"><div class="urunAd">${kacis(u.ad)}<small>${o.adet} adet · ${kacis(o.sehir)}</small></div></td>
      <td data-k="tutar" class="sag say">${o.durum === "iade" ? `<s class="soluk">${tl(h.liste - h.indirim)}</s>` : tl(h.satis)}</td>
      <td data-k="durum" class="gizM">${durumEt(o.durum)}</td>
      <td data-k="ust" class="gizD">${rozet(o.kanal)} ${durumEt(o.durum)} <span class="kucuk soluk say">${kacis(o.no)}</span></td>
      <td data-k="net" class="sag say ${sinif(h.net)}">${tl(h.net)}</td>
    </tr>`;
  }
  const SIPARIS_BASLIK = `<thead><tr><th>Tarih</th><th class="gizK">Sipariş no</th><th>Kanal</th><th>Ürün</th><th class="sag">Tutar</th><th>Durum</th><th class="gizD"></th><th class="sag">Net kâr</th></tr></thead>`;

  let sonEklenen = null;
  function siparisCiz() {
    const q = $("#ara").value.trim().toLocaleLowerCase("tr-TR");
    const fk = $("#fKanal").value, fd = $("#fDurum").value, fz = $("#fZarar").checked;
    const liste = donemde().filter(o => {
      if (fk && o.kanal !== fk) return false;
      if (fd && o.durum !== fd) return false;
      if (fz && hesap(o).net >= -0.5) return false;
      if (q) {
        const m = (urun(o.urun).ad + " " + o.no + " " + o.sehir + " " + urun(o.urun).sku).toLocaleLowerCase("tr-TR");
        if (!m.includes(q)) return false;
      }
      return true;
    });
    const t = topla(liste);
    $("#sonucSay").innerHTML = `${liste.length} sipariş · net <b class="${sinif(t.net)}">${tl(t.net)}</b>`;
    $("#siparisTablo").innerHTML = liste.length
      ? SIPARIS_BASLIK + "<tbody>" + liste.map(o => siparisSatir(o, o === sonEklenen)).join("") + "</tbody>"
      : `<tbody><tr><td class="bos">Bu filtreye uyan sipariş yok. ${donem !== 30 ? "Dönemi 30 güne çıkarmayı deneyin." : ""}</td></tr></tbody>`;
  }

  function sonSiparisCiz() {
    const liste = SIPARISLER.slice(0, 6);
    $("#sonSiparis").innerHTML = SIPARIS_BASLIK + "<tbody>" + liste.map(o => siparisSatir(o, o === sonEklenen)).join("") + "</tbody>";
  }

  function kanalPayi(a) {
    const top = a.kanal30.ty + a.kanal30.hb + a.kanal30.wc;
    if (!top) return `<span class="kucuk soluk">30 günde satış yok</span>`;
    const parca = ["ty", "hb", "wc"].map(k => `<span style="width:${(a.kanal30[k] / top) * 100}%;background:${KANAL_RENK[k]}" title="${KANAL[k].ad}: ${a.kanal30[k]} adet"></span>`).join("");
    return `<div class="cubuk">${parca}</div><div class="kucuk soluk say" style="margin-top:3px">TY ${a.kanal30.ty} · HB ${a.kanal30.hb} · Site ${a.kanal30.wc}</div>`;
  }
  const SIRA = { kritik: 0, az: 1, iyi: 2, yok: 3 };
  function stokCiz() {
    const analiz = stokAnaliz();
    const kritik = analiz.filter(a => a.seviye === "kritik");
    const toplamAdet = URUNLER.reduce((t, u) => t + u.stok, 0);
    const deger = URUNLER.reduce((t, u) => t + u.stok * u.maliyet, 0);
    const s7 = analiz.reduce((t, a) => t + a.s7, 0);
    $("#stokKpi").innerHTML = `
      <div class="kpi"><h3>Havuzdaki stok</h3><b class="say">${toplamAdet.toLocaleString("tr-TR")} adet</b><p>${URUNLER.length} ürün · 3 kanala açık</p></div>
      <div class="kpi"><h3>Stok değeri</h3><b class="say">${tl(deger)}</b><p>Alış maliyetiyle (KDV hariç)</p></div>
      <div class="kpi"><h3>Son 7 gün satış</h3><b class="say">${s7} adet</b><p>Günde ort. ${(s7 / 7).toFixed(1).replace(".", ",")} adet</p></div>
      <div class="kpi ${kritik.length ? "" : "vurgulu"}"><h3>Kritik ürün</h3><b class="say ${kritik.length ? "eksi" : ""}">${kritik.length}</b><p>10 gün içinde bitecek</p></div>`;
    const gos = analiz.filter(a => stokFiltre === "hepsi" || a.seviye === "kritik" || a.seviye === "az")
      .sort((a, b) => SIRA[a.seviye] - SIRA[b.seviye] || a.gun - b.gun || a.u.stok - b.u.stok);
    $("#stokTablo").innerHTML = `<thead><tr><th>Ürün</th><th>Kategori</th><th class="sag">Havuz stok</th><th>Kanallarda yayında</th><th>Kanal payı (30 gün)</th><th class="sag">Satış hızı</th><th>Kaç gün yeter</th></tr></thead><tbody>` +
      gos.map(a => `<tr>
        <td data-k="urun"><div class="urunAd">${kacis(a.u.ad)}<small>${a.u.sku}<span class="gizD"> · ${KAT[a.u.kat].ad}</span></small></div></td>
        <td data-k="kat" class="kucuk soluk">${KAT[a.u.kat].ad}</td>
        <td data-k="stok" class="sag say"><b class="${a.seviye === "kritik" ? "eksi" : ""}">${a.u.stok}</b></td>
        <td data-k="yayin"><span class="senk"><span class="nokta"></span>TY ${a.u.stok} · HB ${a.u.stok} · Site ${a.u.stok}</span></td>
        <td data-k="pay">${kanalPayi(a)}</td>
        <td data-k="hiz" class="sag say kucuk">${a.hiz ? a.hiz.toFixed(1).replace(".", ",") + " /gün" : "—"}</td>
        <td data-k="gun">${gunEt(a)}</td></tr>`).join("") + "</tbody>";
    // genel bakıştaki kısa liste
    const mini = analiz.filter(a => a.seviye === "kritik" || a.seviye === "az").sort((a, b) => SIRA[a.seviye] - SIRA[b.seviye] || a.gun - b.gun).slice(0, 6);
    $("#kritikMini").innerHTML = mini.length
      ? `<thead><tr><th>Ürün</th><th class="sag">Stok</th><th>Yeter</th></tr></thead><tbody>` + mini.map(a => `<tr><td><div class="urunAd">${kacis(a.u.ad)}<small>7 günde ${a.s7} adet satıldı</small></div></td><td class="sag say"><b class="${a.seviye === "kritik" ? "eksi" : ""}">${a.u.stok}</b></td><td>${gunEt(a)}</td></tr>`).join("") + "</tbody>"
      : `<tbody><tr><td class="bos">Kritik stok yok.</td></tr></tbody>`;
    return kritik.length;
  }

  let yalnizZarar = false;
  function karlilikCiz() {
    const satirlar = URUNLER.map(u => {
      const b = { ty: birimKar(u, "ty"), hb: birimKar(u, "hb"), wc: birimKar(u, "wc") };
      return { u, b, en: Math.min(b.ty.net, b.hb.net, b.wc.net) };
    }).sort((a, b) => a.en - b.en);
    const zararli = satirlar.filter(s => s.en < 0);
    const gos = yalnizZarar ? zararli : satirlar;
    const hucre = (x, e) => {
      const z = x.net < 0;
      return `<td class="sag hucre ${z ? "zarar" : ""}" data-e="${e}"><span class="say ${sinif(x.net)}">${tl2(x.net)}</span><small class="say">${tl(x.S)} · ${yuzde(x.marj)}${z && isFinite(x.basaBas) ? " · başa baş " + tl(Math.ceil(x.basaBas)) : ""}</small></td>`;
    };
    $("#matris").innerHTML = `<thead><tr><th>Ürün</th><th>Kategori</th><th class="sag">Alış</th><th class="sag">Desi / kargo</th><th class="sag">Trendyol</th><th class="sag">Hepsiburada</th><th class="sag">Site</th></tr></thead><tbody>` +
      (gos.length ? gos.map(s => `<tr><td data-k="urun"><div class="urunAd">${kacis(s.u.ad)}<small>${s.u.sku}<span class="gizD"> · alış ${tl(s.u.maliyet * (1 + KAT[s.u.kat].kdv / 100))} · ${s.u.desi} desi</span></small></div></td><td class="kucuk soluk gizM">${KAT[s.u.kat].ad}</td><td class="sag say gizM">${tl(s.u.maliyet * (1 + KAT[s.u.kat].kdv / 100))}</td><td class="sag say kucuk gizM">${s.u.desi} · ${tl(kargoUcret(s.u.desi))}</td>${hucre(s.b.ty, "Trendyol")}${hucre(s.b.hb, "Hepsiburada")}${hucre(s.b.wc, "Site")}</tr>`).join("")
        : `<tr><td colspan="7" class="bos">Şu anki oranlarla zarar eden ürün yok.</td></tr>`) + "</tbody>";

    const zs = donemde().filter(o => hesap(o).net < -0.5);
    const zt = zs.reduce((t, o) => t + hesap(o).net, 0);
    $("#zararAlt").textContent = `${donemAd()}: ${zs.length} sipariş, toplam ${tl(zt)}`;
    $("#zararTablo").innerHTML = zs.length ? SIPARIS_BASLIK + "<tbody>" + zs.map(o => siparisSatir(o)).join("") + "</tbody>"
      : `<tbody><tr><td class="bos">Bu dönemde zarar eden sipariş yok.</td></tr></tbody>`;
    return zararli.length;
  }

  function komTabloCiz() {
    $("#komTablo").innerHTML = `<thead><tr><th>Kategori</th><th class="sag">Trendyol</th><th class="sag">Hepsiburada</th><th class="sag">Site (POS)</th></tr></thead><tbody>` +
      Object.keys(KAT).map(kat => `<tr><td>${KAT[kat].ad}<small class="soluk" style="display:block;font-size:.72rem">KDV %${KAT[kat].kdv}</small></td>` +
        ["ty", "hb", "wc"].map(k => `<td class="sag"><span class="yuzde">%<input type="number" inputmode="decimal" min="0" max="60" step="0.5" value="${KOM[kat][k]}" data-kat="${kat}" data-kanal="${k}" aria-label="${KAT[kat].ad} ${KANAL[k].ad} komisyon"></span></td>`).join("") + "</tr>").join("") + "</tbody>";
  }

  function sayacKoy(ad, n) {
    const id = { yeni: "#sayYeni", kritik: "#sayKritik", zarar: "#sayZarar" }[ad];
    [$(id), $(`[data-sayac="${ad}"]`)].forEach(el => { el.hidden = !n; el.textContent = n; });
  }

  function hepsiniCiz() {
    kpiCiz(); kanalGrafikCiz(); kanalTabloCiz(); trendCiz(); sonSiparisCiz(); siparisCiz();
    sayacKoy("kritik", stokCiz());
    sayacKoy("zarar", karlilikCiz());
    sayacKoy("yeni", SIPARISLER.filter(o => o.durum === "yeni").length);
  }

  // ---------- sipariş dökümü ----------
  function detayAc(no) {
    const o = SIPARISLER.find(x => x.no === no);
    if (!o) return;
    const h = hesap(o), u = h.u;
    $("#cBaslik").innerHTML = `${kacis(u.ad)}<small>${KANAL[o.kanal].ad} · ${kacis(o.no)} · ${tarihYaz(o.t)}</small>`;
    const satir = (ad, v, not, ek = "") => `<div class="${ek}"><span>${ad}${not ? `<small>${not}</small>` : ""}</span><span>${v}</span></div>`;
    let d = "";
    if (o.durum === "iade") {
      d += satir("Satış tutarı", tl2(0), `İade edildi (liste ${tl2(h.liste - h.indirim)}); komisyon iade alınır, ürün stoğa döner`);
      d += satir("− Kargo (gidiş + dönüş)", "−" + tl2(h.kargo), `${u.desi * o.adet} desi, 2 × ${tl2(h.kargoTek)}`);
      d += satir("+ KDV farkı (devreden)", "+" + tl2(-h.kdv), "Kargo faturasındaki KDV indirilir (devreden KDV)");
    } else {
      if (h.indirim > 0) {
        d += satir("Liste fiyatı", tl2(h.liste), `${o.adet} × ${tl2(o.birim)}`, "alt");
        d += satir("Kampanya indirimi (%10)", "−" + tl2(h.indirim), "Satıcı tarafından karşılanan", "alt");
      }
      d += satir("Satış tutarı (KDV dahil)", tl2(h.satis), h.indirim ? "" : `${o.adet} × ${tl2(o.birim)}`);
      d += satir(`− ${o.kanal === "wc" ? "Ödeme / POS kesintisi" : "Pazaryeri komisyonu"}`, "−" + tl2(h.komisyon), `${KAT[u.kat].ad}: ${yuzde(h.oran * 100)}`);
      d += satir("− Kargo", "−" + tl2(h.kargo), `${u.desi * o.adet} desi, anlaşmalı tarife`);
      d += satir("− Ürün maliyeti", "−" + tl2(h.maliyet), `Alış ${o.adet} × ${tl2(u.maliyet)} + %${KAT[u.kat].kdv} KDV`);
      d += h.kdv >= 0
        ? satir("− KDV farkı (ödenecek)", "−" + tl2(h.kdv), `Satış KDV'si ${tl2(h.satisKdv)} − indirilecek ${tl2(h.indKdv)}`)
        : satir("+ KDV farkı (devreden)", "+" + tl2(-h.kdv), `İndirilecek KDV ${tl2(h.indKdv)} satış KDV'si ${tl2(h.satisKdv)}'dan fazla; sonraki aya devreder`);
    }
    d += satir("= Net kâr", tl2(h.net), h.satis > 0 ? `Kâr marjı ${yuzde(h.marj)}` : "", "top " + (h.net < -0.5 ? "no" : "ok"));
    let uyari = "";
    if (o.durum !== "iade" && h.net < -0.5) {
      const b = birimKar(u, o.kanal);
      const neden = h.kargo > h.satis * 0.3 ? "kargo ücreti satış tutarına göre çok yüksek" : h.indirim > 0 ? "kampanya indirimi kârı eritmiş" : "komisyon ve kargo toplamı fiyatı aşıyor";
      uyari = `<div class="uyari no"><b>Bu satış zarar ettiriyor:</b> ${neden}. ${isFinite(b.basaBas) ? `${KANAL[o.kanal].ad} için başa baş fiyat ${tl(Math.ceil(b.basaBas))}.` : ""} Çoklu satış paketi ya da fiyat güncellemesi önerilir.</div>`;
    } else if (o.durum === "iade") {
      uyari = `<div class="uyari no">İadede satış geri alınır ama iki yönlü kargo satıcıda kalır.</div>`;
    } else {
      uyari = `<div class="uyari ok">Bu sipariş kârlı. Aynı ürün ${KANAL[o.kanal].ad}'da tek adet satışta ${tl2(birimKar(u, o.kanal).net)} bırakıyor.</div>`;
    }
    $("#cIc").innerHTML = `<div class="meta">
        <div>Kanal<b>${KANAL[o.kanal].ad}</b></div><div>Durum<b>${DURUM_AD[o.durum]}</b></div>
        <div>Müşteri<b>${kacis(o.musteri)}</b></div><div>Teslimat<b>${kacis(o.sehir)}</b></div>
      </div>
      <div class="dokum">${d}</div>${uyari}
      <p class="not">Net kâr gelir vergisi öncesidir. Komisyon ve kargo faturalarındaki %20 KDV indirilecek KDV'ye eklenir.</p>`;
    $("#perde").classList.add("acik"); $("#cekmece").classList.add("acik");
    $("#kapat").focus();
  }
  function detayKapat() { $("#perde").classList.remove("acik"); $("#cekmece").classList.remove("acik"); }

  // ---------- görünüm geçişi ----------
  const BASLIK = {
    ozet: ["Genel bakış", "Tüm kanallar tek ekranda"],
    siparisler: ["Siparişler", "Trendyol, Hepsiburada ve site siparişleri birlikte"],
    stok: ["Stok", "Tek havuz, tüm kanallarda eş zamanlı"],
    karlilik: ["Kârlılık & komisyon", "Zarar eden ürünler ve kategori komisyonları"]
  };
  function gorunumAc(ad) {
    if (!BASLIK[ad]) ad = "ozet";
    gorunum = ad;
    $$(".gorunum").forEach(s => s.classList.toggle("aktif", s.id === "g-" + ad));
    $$("#yanMenu a, #altMenu a").forEach(a => a.classList.toggle("aktif", a.dataset.g === ad));
    $("#baslik").innerHTML = `${BASLIK[ad][0]}<small id="altBaslik">${BASLIK[ad][1]}</small>`;
    $("#donemSec").style.visibility = ad === "stok" ? "hidden" : "";
    if (ad === "ozet") trendCiz();
    window.scrollTo(0, 0);
  }

  // ---------- olaylar ----------
  window.addEventListener("hashchange", () => gorunumAc(location.hash.slice(1)));
  $("#donemSec").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    donem = +b.dataset.d;
    $$("#donemSec button").forEach(x => x.classList.toggle("sec", x === b));
    hepsiniCiz();
  });
  ["#ara", "#fKanal", "#fDurum", "#fZarar"].forEach(s => $(s).addEventListener("input", siparisCiz));
  document.addEventListener("click", e => {
    const tr = e.target.closest("tr[data-no]");
    if (tr) detayAc(tr.dataset.no);
  });
  $("#perde").addEventListener("click", detayKapat);
  $("#kapat").addEventListener("click", detayKapat);
  document.addEventListener("keydown", e => { if (e.key === "Escape") detayKapat(); });
  $("#stokFiltre").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    stokFiltre = b.dataset.s;
    $$("#stokFiltre button").forEach(x => x.classList.toggle("sec", x === b));
    stokCiz();
  });
  $("#yalnizZarar").addEventListener("change", e => { yalnizZarar = e.target.checked; karlilikCiz(); });
  $("#komTablo").addEventListener("input", e => {
    const i = e.target.closest("input[data-kat]"); if (!i) return;
    const v = parseFloat(String(i.value).replace(",", "."));
    if (!isFinite(v) || v < 0 || v > 60) return;
    KOM[i.dataset.kat][i.dataset.kanal] = v;
    hepsiniCiz();
  });
  $("#komSifirla").addEventListener("click", () => {
    KOM = JSON.parse(JSON.stringify(KOM_VARSAYILAN));
    komTabloCiz(); hepsiniCiz(); bildir("Komisyon oranları varsayılana döndü, kârlar yeniden hesaplandı.");
  });

  let bildirimZaman;
  function bildir(m) {
    const b = $("#bildirim"); b.textContent = m; b.classList.add("goster");
    clearTimeout(bildirimZaman); bildirimZaman = setTimeout(() => b.classList.remove("goster"), 3600);
  }
  let senkZaman = Date.now();
  setInterval(() => {
    const sn = Math.round((Date.now() - senkZaman) / 1000);
    $("#sonSenk").textContent = sn < 60 ? sn + " sn önce" : Math.floor(sn / 60) + " dk önce";
  }, 5000);

  $("#simBtn").addEventListener("click", () => {
    const stoklu = URUNLER.filter(u => u.stok > 0);
    if (!stoklu.length) return bildir("Havuzda stok kalmadı.");
    const r = Math.random();
    const kanal = r < 0.5 ? "ty" : r < 0.8 ? "hb" : "wc";
    const u = stoklu[Math.floor(Math.random() * stoklu.length)];
    const once = u.stok;
    u.stok -= 1;
    const o = { no: siparisNo(kanal), kanal, urun: u.id, adet: 1, birim: u.fiyat[kanal], ind: 0, durum: "yeni", t: Date.now(), musteri: maskeAd(), sehir: sec(SEHIR) };
    SIPARISLER.unshift(o);
    sonEklenen = o; senkZaman = Date.now(); $("#sonSenk").textContent = "az önce";
    hepsiniCiz();
    const h = hesap(o);
    bildir(`${KANAL[kanal].ad}: ${u.ad} satıldı (net ${tl(h.net)}). Stok ${once} → ${u.stok}, 3 kanalda güncellendi.`);
  });

  let boyutZaman;
  window.addEventListener("resize", () => { clearTimeout(boyutZaman); boyutZaman = setTimeout(() => { if (gorunum === "ozet") trendCiz(); }, 150); });

  // ---------- başlat ----------
  komTabloCiz();
  gorunumAc(location.hash.slice(1) || "ozet");
  hepsiniCiz();
})();
