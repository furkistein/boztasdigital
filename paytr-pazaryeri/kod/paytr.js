'use strict';
/**
 * PayTR iFrame API + Pazaryeri (Platform Transfer) yardımcı modülü.
 *
 * Kaynak: PayTR resmi geliştirici belgeleri (dev.paytr.com)
 *   - iFrame API 1. Adım  : POST https://www.paytr.com/odeme/api/get-token
 *   - iFrame API 2. Adım  : Bildirim URL (callback) -> hash doğrula, düz metin "OK" dön
 *   - Platform Transfer   : POST https://www.paytr.com/odeme/platform/transfer
 *   - Transfer sonucu     : Platform Transfer Sonuç Bildirim URL -> trans_ids hash doğrula, "OK" dön
 *   - İade API            : POST https://www.paytr.com/odeme/iade
 *
 * Tüm imzalar: base64( HMAC-SHA256( anahtar = merchant_key, mesaj = <alanlar> + merchant_salt ) )
 * (Bildirim URL'de sıra farklıdır: merchant_oid + merchant_salt + status + total_amount)
 *
 * Tutarlar:
 *   - get-token payment_amount, callback total_amount, transfer submerchant_amount/total_amount -> KURUŞ (TL x 100, tamsayı)
 *   - iade return_amount -> TL, nokta ayraçlı ondalık metin ("149.90")
 *
 * Bu dosyada hiçbir gerçek anahtar yoktur; anahtarlar ortam değişkenlerinden (Replit Secrets / .env) okunur.
 * Bağımlılık yok: yalnız Node yerleşik 'crypto' ve global fetch (Node 18+).
 */
const crypto = require('crypto');

const UC = {
  token: 'https://www.paytr.com/odeme/api/get-token',
  iframe: 'https://www.paytr.com/odeme/guvenli/',
  transfer: 'https://www.paytr.com/odeme/platform/transfer',
  iade: 'https://www.paytr.com/odeme/iade',
};

/* ------------------------------------------------------------------ */
/* Temel imza                                                          */
/* ------------------------------------------------------------------ */

/** base64(HMAC-SHA256(key, mesaj)) */
function hmacB64(merchantKey, mesaj) {
  return crypto.createHmac('sha256', String(merchantKey)).update(String(mesaj), 'utf8').digest('base64');
}

/** Sabit zamanlı karşılaştırma (zamanlama saldırısına karşı). */
function esitMi(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  if (x.length !== y.length || x.length === 0) return false;
  return crypto.timingSafeEqual(x, y);
}

/* ------------------------------------------------------------------ */
/* Tutar yardımcıları (kuruş = tamsayı; kayan nokta hatası yok)         */
/* ------------------------------------------------------------------ */

/** "149,90" | "149.90" | 149.9 -> 14990 (kuruş). Metin üzerinden çevirir, float çarpımı yapmaz. */
function tlToKurus(tl) {
  const s = String(tl).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Geçersiz TL tutarı: ' + tl);
  const [tam, kes = ''] = s.split('.');
  return Number(tam) * 100 + Number((kes + '00').slice(0, 2));
}

/** 14990 -> "149.90" (iade API'sinin istediği biçim). */
function kurusToTl(kurus) {
  if (!Number.isInteger(kurus) || kurus < 0) throw new Error('Kuruş negatif olmayan tamsayı olmalı: ' + kurus);
  return Math.floor(kurus / 100) + '.' + String(kurus % 100).padStart(2, '0');
}

/**
 * Platform komisyonu bölüşümü.
 * @param {number} toplamKurus   müşteriden alınan tutar (kuruş)
 * @param {string|number} oranYuzde  platform komisyonu yüzdesi, ör. "12.5" (en çok 2 ondalık)
 * @param {number} [sabitKurus=0] işlem başı sabit platform ücreti (kuruş)
 * @returns {{toplam:number, platform:number, isletme:number}} hepsi kuruş; platform + isletme === toplam
 * Yuvarlama: yarım kuruş yukarı (platform lehine değil, matematiksel yuvarlama); tüm hesap tamsayıyla.
 */
function komisyonBol(toplamKurus, oranYuzde, sabitKurus = 0) {
  if (!Number.isInteger(toplamKurus) || toplamKurus <= 0) throw new Error('Toplam kuruş pozitif tamsayı olmalı');
  const bps = tlToKurus(oranYuzde); // "12.5" -> 1250 (yüzde * 100 = baz puan)
  if (bps > 10000) throw new Error('Komisyon oranı %100 den büyük olamaz');
  const oransal = Math.floor((toplamKurus * bps + 5000) / 10000);
  const platform = Math.min(toplamKurus, oransal + (sabitKurus | 0));
  return { toplam: toplamKurus, platform, isletme: toplamKurus - platform };
}

/** TR IBAN: boşlukları at, büyük harf, 26 karakter + mod-97 kontrolü. Geçersizse hata. */
function ibanDuzelt(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(s)) throw new Error('IBAN TR ile başlayan 26 karakter olmalı');
  const d = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let r = 0;
  for (const ch of d) r = (r * 10 + Number(ch)) % 97;
  if (r !== 1) throw new Error('IBAN kontrol hanesi hatalı');
  return s;
}

/** PayTR merchant_oid / trans_id: yalnız harf+rakam (belgede alfanümerik; oid en çok 64, trans_id en çok 60). */
function benzersizNo(onek = 'RZV', uzunluk = 64) {
  const no = (onek + Date.now().toString(36) + crypto.randomBytes(6).toString('hex')).replace(/[^A-Za-z0-9]/g, '');
  return no.slice(0, uzunluk).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* 1) iFrame token                                                     */
/* ------------------------------------------------------------------ */

/** Sepet: [["Ürün adı", "18.00", 1], ...] -> base64(JSON) */
function sepetKodla(sepet) {
  return Buffer.from(JSON.stringify(sepet), 'utf8').toString('base64');
}

/**
 * paytr_token (get-token):
 * merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket
 *   + no_installment + max_installment + currency + test_mode  (+ merchant_salt)
 */
function tokenHash(a, merchantKey, merchantSalt) {
  const hashStr = `${a.merchant_id}${a.user_ip}${a.merchant_oid}${a.email}${a.payment_amount}` +
    `${a.user_basket}${a.no_installment}${a.max_installment}${a.currency}${a.test_mode}`;
  return hmacB64(merchantKey, hashStr + merchantSalt);
}

/**
 * get-token için POST alanlarını hazırlar (ağ isteği yapmaz; test ve simülasyon için ayrı tutuldu).
 * @param {object} cfg  {merchantId, merchantKey, merchantSalt, testMode, okUrl, failUrl, debug}
 * @param {object} s    {merchantOid, userIp, email, paymentAmountKurus, sepet, userName, userAddress, userPhone,
 *                       noInstallment, maxInstallment, currency, timeoutLimit, lang}
 */
function tokenAlanlari(cfg, s) {
  const alan = {
    merchant_id: String(cfg.merchantId),
    user_ip: s.userIp,
    merchant_oid: s.merchantOid,
    email: s.email,
    payment_amount: String(s.paymentAmountKurus),
    user_basket: sepetKodla(s.sepet),
    no_installment: String(s.noInstallment ?? 0),
    max_installment: String(s.maxInstallment ?? 0),
    currency: s.currency || 'TL',
    test_mode: String(cfg.testMode ? 1 : 0),
    merchant_ok_url: cfg.okUrl,
    merchant_fail_url: cfg.failUrl,
    user_name: s.userName || '',
    user_address: s.userAddress || '',
    user_phone: s.userPhone || '',
    debug_on: String(cfg.debug ? 1 : 0),
    timeout_limit: String(s.timeoutLimit ?? 30),
    lang: s.lang || 'tr',
  };
  alan.paytr_token = tokenHash(alan, cfg.merchantKey, cfg.merchantSalt);
  return alan;
}

async function formPost(url, alanlar) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(alanlar).toString(),
  });
  const metin = await res.text();
  try { return JSON.parse(metin); } catch { return { status: 'error', err_msg: 'JSON olmayan cevap', ham: metin.slice(0, 300) }; }
}

/** get-token çağrısı. Başarılıysa {status:'success', token, iframeUrl}. */
async function iframeTokenAl(cfg, siparis) {
  const alan = tokenAlanlari(cfg, siparis);
  const c = await formPost(UC.token, alan);
  if (c.status === 'success') return { ...c, iframeUrl: UC.iframe + c.token };
  return c; // {status:'failed', reason}
}

/* ------------------------------------------------------------------ */
/* 2) Bildirim URL (callback)                                           */
/* ------------------------------------------------------------------ */

/** hash = base64(HMAC(key, merchant_oid + merchant_salt + status + total_amount)) */
function bildirimHash(post, merchantKey, merchantSalt) {
  return hmacB64(merchantKey, `${post.merchant_oid}${merchantSalt}${post.status}${post.total_amount}`);
}

/** Callback gerçekten PayTR'den mi? true/false. Doğrulanmadan sipariş ASLA onaylanmaz. */
function bildirimDogrula(post, merchantKey, merchantSalt) {
  if (!post || !post.merchant_oid || !post.status || post.total_amount === undefined) return false;
  return esitMi(bildirimHash(post, merchantKey, merchantSalt), post.hash);
}

/* ------------------------------------------------------------------ */
/* 3) Pazaryeri: Platform Transfer talebi                               */
/* ------------------------------------------------------------------ */

/**
 * paytr_token (platform/transfer):
 * merchant_id + merchant_oid + trans_id + submerchant_amount + total_amount + transfer_name + transfer_iban (+ merchant_salt)
 */
function transferHash(a, merchantKey, merchantSalt) {
  const hashStr = `${a.merchant_id}${a.merchant_oid}${a.trans_id}${a.submerchant_amount}` +
    `${a.total_amount}${a.transfer_name}${a.transfer_iban}`;
  return hmacB64(merchantKey, hashStr + merchantSalt);
}

/**
 * @param {object} t {merchantOid, transId, submerchantKurus, totalKurus, transferName, transferIban}
 */
function transferAlanlari(cfg, t) {
  if (!Number.isInteger(t.submerchantKurus) || !Number.isInteger(t.totalKurus)) throw new Error('Tutarlar kuruş (tamsayı) olmalı');
  if (t.submerchantKurus <= 0 || t.submerchantKurus > t.totalKurus) throw new Error('İşletme payı 0 ile toplam arasında olmalı');
  const alan = {
    merchant_id: String(cfg.merchantId),
    merchant_oid: t.merchantOid,
    trans_id: t.transId,
    submerchant_amount: String(t.submerchantKurus),
    total_amount: String(t.totalKurus),
    transfer_name: String(t.transferName).trim(),
    transfer_iban: ibanDuzelt(t.transferIban),
  };
  alan.paytr_token = transferHash(alan, cfg.merchantKey, cfg.merchantSalt);
  return alan;
}

/** Transfer talimatı gönderir. Cevap: {status:'success', merchant_amount, submerchant_amount, trans_id, reference} | {status:'error', err_no, err_msg} */
async function platformTransfer(cfg, t) {
  return formPost(UC.transfer, transferAlanlari(cfg, t));
}

/** Transfer sonuç bildirimi: hash = base64(HMAC(key, trans_ids + merchant_salt)) */
function transferSonucDogrula(post, merchantKey, merchantSalt) {
  if (!post || !post.trans_ids) return false;
  const transIds = String(post.trans_ids).replace(/\\/g, ''); // belge: ters eğik çizgiler temizlenir
  return esitMi(hmacB64(merchantKey, transIds + merchantSalt), post.hash);
}

/* ------------------------------------------------------------------ */
/* 4) İade                                                              */
/* ------------------------------------------------------------------ */

/** paytr_token (iade): merchant_id + merchant_oid + return_amount (+ merchant_salt); return_amount TL "10.25" */
function iadeHash(a, merchantKey, merchantSalt) {
  return hmacB64(merchantKey, `${a.merchant_id}${a.merchant_oid}${a.return_amount}` + merchantSalt);
}

function iadeAlanlari(cfg, merchantOid, iadeKurus) {
  const alan = { merchant_id: String(cfg.merchantId), merchant_oid: merchantOid, return_amount: kurusToTl(iadeKurus) };
  alan.paytr_token = iadeHash(alan, cfg.merchantKey, cfg.merchantSalt);
  return alan;
}

/** Cevap: {status:'success', is_test, merchant_oid, return_amount} | {status:'error', err_no, err_msg} */
async function iadeEt(cfg, merchantOid, iadeKurus) {
  return formPost(UC.iade, iadeAlanlari(cfg, merchantOid, iadeKurus));
}

/* ------------------------------------------------------------------ */

/** Ortam değişkenlerinden yapılandırma (Replit Secrets aynı şekilde process.env'e düşer). */
function ortamdanAyar(env = process.env) {
  return {
    merchantId: env.PAYTR_MERCHANT_ID || '',
    merchantKey: env.PAYTR_MERCHANT_KEY || '',
    merchantSalt: env.PAYTR_MERCHANT_SALT || '',
    testMode: String(env.PAYTR_TEST_MODE ?? '1') === '1',
    debug: String(env.PAYTR_DEBUG ?? '0') === '1',
    okUrl: env.PAYTR_OK_URL || '',
    failUrl: env.PAYTR_FAIL_URL || '',
  };
}

module.exports = {
  UC,
  hmacB64, esitMi,
  tlToKurus, kurusToTl, komisyonBol, ibanDuzelt, benzersizNo, sepetKodla,
  tokenHash, tokenAlanlari, iframeTokenAl,
  bildirimHash, bildirimDogrula,
  transferHash, transferAlanlari, platformTransfer, transferSonucDogrula,
  iadeHash, iadeAlanlari, iadeEt,
  ortamdanAyar,
};
