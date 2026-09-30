'use strict';
/**
 * Örnek rezervasyon + PayTR Pazaryeri akışı (Express).
 *
 *  1) POST /api/rezervasyon            -> rezervasyon "odeme_bekliyor" olarak açılır, merchant_oid üretilir
 *  2) GET  /odeme/:oid                 -> get-token alınır, PayTR iFrame gösterilir
 *  3) POST /paytr/bildirim             -> PayTR callback: hash doğrulanır, rezervasyon onaylanır, "OK" dönülür
 *                                         (komisyon bölüşümü hesaplanır, işletme transferi kuyruğa girer)
 *  4) POST /yonetim/transferleri-gonder -> vadesi gelen transferler PayTR Platform Transfer'e gönderilir
 *                                         (belge: talep ödeme gününden sonra, istenen gün saat 10:00'a kadar)
 *  5) POST /paytr/transfer-sonuc       -> transfer sonuç bildirimi: hash doğrulanır, "OK" dönülür
 *  6) POST /api/rezervasyon/:oid/iade  -> iptal edilen rezervasyon için iade
 *
 * PAYTR_MERCHANT_ID boşsa SİMÜLASYON modunda çalışır: PayTR'ye hiç istek atmaz, sahte ödeme sayfası
 * gösterir ve callback'i örnek anahtarla kendisi imzalar. Gerçek ödeme alınmaz.
 *
 * Kayıtlar bellekte (Map) tutulur: canlıda veritabanına (Replit DB / PostgreSQL) taşıyın.
 */
try { process.loadEnvFile(); } catch { /* .env yoksa (ör. Replit Secrets) sorun değil */ }
const express = require('express');
const paytr = require('./paytr');

const cfg = paytr.ortamdanAyar();
const SIMULASYON = !cfg.merchantId;
if (SIMULASYON) Object.assign(cfg, { merchantId: '100000', merchantKey: 'ORNEK_KEY', merchantSalt: 'ORNEK_SALT', testMode: true });

const PORT = Number(process.env.PORT || 3000);
const TABAN = process.env.SITE_URL || `http://localhost:${PORT}`;
cfg.okUrl = cfg.okUrl || `${TABAN}/odeme-sonuc?durum=basarili`;
cfg.failUrl = cfg.failUrl || `${TABAN}/odeme-sonuc?durum=basarisiz`;
const KOMISYON_YUZDE = process.env.PLATFORM_KOMISYON_YUZDE || '10';
const YONETIM_ANAHTARI = process.env.YONETIM_ANAHTARI || '';

/* Örnek işletmeler (alt satıcılar). IBAN'lar biçimce geçerli ÖRNEK numaralardır. */
const isletmeler = new Map([
  ['kuafor-1', { ad: 'Örnek Kuaför Salonu', unvan: 'ORNEK KUAFOR LTD STI', iban: 'TR460001000000000000012345',
    hizmetler: { sac: { ad: 'Saç kesimi + fön', tl: '450.00' }, boya: { ad: 'Dip boya', tl: '1250.00' } } }],
  ['tekne-1', { ad: 'Örnek Tekne Turları', unvan: 'ORNEK DENIZCILIK TURIZM AS', iban: 'TR460006200000000000067890',
    hizmetler: { gunluk: { ad: 'Günlük koy turu (kişi)', tl: '1499.90' } } }],
]);
const rezervasyonlar = new Map(); // merchant_oid -> kayıt

const app = express();
app.set('trust proxy', true); // Replit / proxy arkasında gerçek istemci IP'si için
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  next();
});
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false })); // PayTR callback'leri form-urlencoded gelir

function istemciIp(req) {
  const ip = (req.ip || '').replace('::ffff:', '');
  return ip === '::1' || !ip ? '127.0.0.1' : ip;
}
function birSonrakiIsGunu(d = new Date()) {
  const t = new Date(d); t.setDate(t.getDate() + 1);
  while (t.getDay() === 0 || t.getDay() === 6) t.setDate(t.getDate() + 1);
  return t.toISOString().slice(0, 10);
}

/* 1) Rezervasyon oluştur */
app.post('/api/rezervasyon', (req, res) => {
  const { isletmeId, hizmetId, adet = 1, musteriEposta, musteriAd = '', musteriTel = '', tarih } = req.body || {};
  const isl = isletmeler.get(isletmeId);
  const hz = isl && isl.hizmetler[hizmetId];
  if (!hz) return res.status(400).json({ hata: 'İşletme ya da hizmet bulunamadı' });
  if (!musteriEposta) return res.status(400).json({ hata: 'E-posta zorunlu (PayTR email alanı)' });
  const n = Math.max(1, Math.min(20, parseInt(adet, 10) || 1));
  const tutarKurus = paytr.tlToKurus(hz.tl) * n;
  const oid = paytr.benzersizNo('RZV');
  rezervasyonlar.set(oid, {
    oid, isletmeId, hizmetId, adet: n, tarih, tutarKurus, durum: 'odeme_bekliyor',
    musteri: { eposta: musteriEposta, ad: musteriAd, tel: musteriTel }, ip: istemciIp(req),
    sepet: [[hz.ad, hz.tl, n]], olusturma: new Date().toISOString(),
  });
  res.json({ oid, tutar: paytr.kurusToTl(tutarKurus), odemeUrl: `/odeme/${oid}` });
});

/* 2) Ödeme sayfası: token al, iFrame göster */
app.get('/odeme/:oid', async (req, res) => {
  const r = rezervasyonlar.get(req.params.oid);
  if (!r || r.durum !== 'odeme_bekliyor') return res.status(404).send('Rezervasyon yok ya da ödenmiş');
  const siparis = {
    merchantOid: r.oid, userIp: r.ip, email: r.musteri.eposta, paymentAmountKurus: r.tutarKurus,
    sepet: r.sepet, userName: r.musteri.ad, userPhone: r.musteri.tel, userAddress: '-',
    noInstallment: 1, maxInstallment: 0, currency: 'TL',
  };
  if (SIMULASYON) {
    return res.send(`<!doctype html><meta charset="utf-8"><title>Simülasyon ödeme</title>
      <p>SİMÜLASYON: PayTR yerine sahte ödeme ekranı. Tutar: ${paytr.kurusToTl(r.tutarKurus)} TL</p>
      <form method="post" action="/simulasyon/ode/${r.oid}"><button name="durum" value="success">Ödemeyi başarılı say</button>
      <button name="durum" value="failed">Başarısız say</button></form>`);
  }
  try {
    const c = await paytr.iframeTokenAl(cfg, siparis);
    if (c.status !== 'success') return res.status(502).send('PayTR token alınamadı: ' + (c.reason || c.err_msg));
    res.send(`<!doctype html><meta charset="utf-8"><title>Ödeme</title>
      <script src="https://www.paytr.com/js/iframeResizer.min.js"></script>
      <iframe src="${c.iframeUrl}" id="paytriframe" frameborder="0" scrolling="no" style="width:100%;"></iframe>
      <script>iFrameResize({},'#paytriframe');</script>`);
  } catch (e) {
    res.status(502).send('PayTR bağlantı hatası');
  }
});

/* 3) PayTR Bildirim URL (Mağaza Paneli > Ayarlar'a bu adres yazılır) */
app.post('/paytr/bildirim', (req, res) => {
  const p = req.body;
  if (!paytr.bildirimDogrula(p, cfg.merchantKey, cfg.merchantSalt)) {
    return res.status(400).send('PAYTR notification failed: bad hash'); // sahte istek: hiçbir şey değişmez
  }
  const r = rezervasyonlar.get(p.merchant_oid);
  // Aynı sipariş için birden fazla bildirim gelebilir: zaten işlenmişse yalnız "OK".
  if (!r || r.durum !== 'odeme_bekliyor') return res.type('text/plain').send('OK');

  if (p.status === 'success') {
    const odenen = parseInt(p.total_amount, 10); // kuruş; taksit vade farkıyla payment_amount'tan büyük olabilir
    const bol = paytr.komisyonBol(r.tutarKurus, KOMISYON_YUZDE);
    const isl = isletmeler.get(r.isletmeId);
    Object.assign(r, {
      durum: 'onaylandi', odenenKurus: odenen, odemeTipi: p.payment_type, testMi: p.test_mode === '1',
      bolusum: bol,
      transfer: {
        durum: 'bekliyor', transId: paytr.benzersizNo('TRF', 60), planTarih: birSonrakiIsGunu(),
        submerchantKurus: bol.isletme, totalKurus: r.tutarKurus, ad: isl.unvan, iban: isl.iban,
      },
    });
  } else {
    Object.assign(r, { durum: 'odeme_basarisiz', hata: `${p.failed_reason_code || ''} ${p.failed_reason_msg || ''}`.trim() });
  }
  res.type('text/plain').send('OK'); // belge: yalnız düz "OK"
});

/* Simülasyon: callback'i PayTR yerine kendimiz, AYNI imza kuralıyla üretip kendi uç noktamıza gönderiyoruz */
app.post('/simulasyon/ode/:oid', async (req, res) => {
  if (!SIMULASYON) return res.status(404).end();
  const r = rezervasyonlar.get(req.params.oid);
  if (!r) return res.status(404).end();
  const post = { merchant_oid: r.oid, status: req.body.durum === 'failed' ? 'failed' : 'success',
    total_amount: String(r.tutarKurus), payment_amount: String(r.tutarKurus), payment_type: 'card', currency: 'TL', test_mode: '1' };
  post.hash = paytr.bildirimHash(post, cfg.merchantKey, cfg.merchantSalt);
  const c = await fetch(`http://127.0.0.1:${PORT}/paytr/bildirim`, { method: 'POST', body: new URLSearchParams(post) });
  res.redirect(`/odeme-sonuc?durum=${post.status === 'success' ? 'basarili' : 'basarisiz'}&callback=${encodeURIComponent(await c.text())}`);
});

app.get('/odeme-sonuc', (req, res) => {
  // Önemli: bu sayfa yalnız kullanıcıya bilgi verir; onayı DAİMA bildirim (callback) belirler.
  res.send(`<!doctype html><meta charset="utf-8"><p>Ödeme sonucu: ${req.query.durum === 'basarili' ? 'alındı, onay bekleniyor' : 'başarısız'}</p>`);
});

app.get('/api/rezervasyon/:oid', (req, res) => {
  const r = rezervasyonlar.get(req.params.oid);
  if (!r) return res.status(404).json({ hata: 'yok' });
  res.json({ oid: r.oid, durum: r.durum, tutar: paytr.kurusToTl(r.tutarKurus), bolusum: r.bolusum, transfer: r.transfer && { ...r.transfer, iban: undefined } });
});

/* 4) Vadesi gelen işletme transferlerini gönder (günlük zamanlanmış görevle, sabah 10:00'dan önce çağırın) */
function yonetimMi(req) { return YONETIM_ANAHTARI && paytr.esitMi(req.get('x-yonetim-anahtari'), YONETIM_ANAHTARI); }
app.post('/yonetim/transferleri-gonder', async (req, res) => {
  if (!yonetimMi(req)) return res.status(401).json({ hata: 'yetkisiz' });
  const bugun = new Date().toISOString().slice(0, 10);
  const sonuc = [];
  for (const r of rezervasyonlar.values()) {
    const t = r.transfer;
    if (r.durum !== 'onaylandi' || !t || t.durum !== 'bekliyor' || t.planTarih > bugun) continue;
    const istek = { merchantOid: r.oid, transId: t.transId, submerchantKurus: t.submerchantKurus,
      totalKurus: t.totalKurus, transferName: t.ad, transferIban: t.iban };
    const c = SIMULASYON
      ? { status: 'success', simulasyon: true, alanlar: paytr.transferAlanlari(cfg, istek) }
      : await paytr.platformTransfer(cfg, istek);
    t.durum = c.status === 'success' ? 'gonderildi' : 'hata';
    t.cevap = c;
    sonuc.push({ oid: r.oid, transId: t.transId, durum: t.durum, err: c.err_msg });
  }
  res.json({ gonderilen: sonuc.length, sonuc });
});

/* 5) Platform Transfer sonuç bildirimi (Mağaza Paneli > Ayarlar > Platform Transfer Sonuç Bildirim URL) */
app.post('/paytr/transfer-sonuc', (req, res) => {
  if (!paytr.transferSonucDogrula(req.body, cfg.merchantKey, cfg.merchantSalt)) {
    return res.status(400).send('PAYTR notification failed: bad hash');
  }
  let ids = [];
  try { ids = JSON.parse(String(req.body.trans_ids).replace(/\\/g, '')); } catch { /* biçim belgeden teyit edilecek */ }
  for (const r of rezervasyonlar.values()) {
    if (r.transfer && ids.includes(r.transfer.transId)) r.transfer.durum = 'tamamlandi';
  }
  res.type('text/plain').send('OK');
});

/* 6) İade (rezervasyon iptali). tutar verilmezse tamamı. Transfer gönderilmişse önce işletmeyle mutabakat gerekir. */
app.post('/api/rezervasyon/:oid/iade', async (req, res) => {
  if (!yonetimMi(req)) return res.status(401).json({ hata: 'yetkisiz' });
  const r = rezervasyonlar.get(req.params.oid);
  if (!r || r.durum !== 'onaylandi') return res.status(400).json({ hata: 'İade edilebilir rezervasyon yok' });
  if (r.transfer && r.transfer.durum !== 'bekliyor') return res.status(409).json({ hata: 'İşletmeye transfer yapılmış; iade öncesi mutabakat gerekli' });
  const kurus = req.body.tutar ? paytr.tlToKurus(req.body.tutar) : r.tutarKurus;
  if (kurus > r.tutarKurus) return res.status(400).json({ hata: 'İade tutarı ödemeden büyük olamaz' });
  const c = SIMULASYON
    ? { status: 'success', simulasyon: true, alanlar: paytr.iadeAlanlari(cfg, r.oid, kurus) }
    : await paytr.iadeEt(cfg, r.oid, kurus);
  if (c.status === 'success') {
    r.iadeKurus = (r.iadeKurus || 0) + kurus;
    if (r.iadeKurus >= r.tutarKurus) { r.durum = 'iade_edildi'; if (r.transfer) r.transfer.durum = 'iptal'; }
    else if (r.transfer) { // kısmi iade: işletme payını yeniden hesapla
      const bol = paytr.komisyonBol(r.tutarKurus - r.iadeKurus, KOMISYON_YUZDE);
      Object.assign(r.transfer, { submerchantKurus: bol.isletme });
      r.bolusum = bol;
    }
  }
  res.json(c);
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Rezervasyon + PayTR örneği :${PORT} ${SIMULASYON ? '(SİMÜLASYON)' : cfg.testMode ? '(PayTR TEST modu)' : '(CANLI)'}`));
}
module.exports = { app, rezervasyonlar, cfg };
