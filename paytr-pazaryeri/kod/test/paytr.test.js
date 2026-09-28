'use strict';
// Çalıştır: npm test  ya da  node --test test/*.test.js   (bağımlılık gerekmez)
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const p = require('../paytr');

const KEY = 'TEST_MERCHANT_KEY';
const SALT = 'TEST_SALT';
const cfg = { merchantId: '123456', merchantKey: KEY, merchantSalt: SALT, testMode: true, okUrl: 'https://ornek.test/ok', failUrl: 'https://ornek.test/fail' };

// Bağımsız ikinci yol: Web Crypto (SubtleCrypto) ile HMAC-SHA256 -> base64
async function subtleHmac(key, mesaj) {
  const k = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const imza = await webcrypto.subtle.sign('HMAC', k, new TextEncoder().encode(mesaj));
  return Buffer.from(imza).toString('base64');
}

// Üçüncü yol: Python hmac/hashlib ile önceden hesaplanmış sabit vektörler
const BEKLENEN = {
  sepet: 'W1siR8O8bmzDvGsga295IHR1cnUgKGtpxZ9pKSIsIjE0OTkuOTAiLDJdXQ==',
  token: 'Ng6ZyXsY8mXf0BebqIZNDCMROb2BY7wCWzFnnps7wes=',
  bildirim: '3m55gJxsstvX5x3X2pHtOEGX1kSzhi+LwXg7GDdACpM=',
  transfer: 'rja39OiXjuQqq10RLtJ87L9KUB72ed3VdYrwTfXEMf8=',
  iade: 'cXaEt5zw+z4Okybrz/LHJ9Rq4q7xYIZjXWSZPGFHA6k=',
  transferSonuc: '/9ore3fXqtiPbcXxkE3nO0rMN2Ip+C9I+iXtlRloHkQ=',
};

const siparis = {
  merchantOid: 'RZV1TEST', userIp: '85.34.78.112', email: 'ornek-musteri-eposta', paymentAmountKurus: 299980,
  sepet: [['Günlük koy turu (kişi)', '1499.90', 2]], noInstallment: 1, maxInstallment: 0, currency: 'TL',
};

test('get-token paytr_token: belge sırası + salt, üç yoldan aynı', async () => {
  const a = p.tokenAlanlari(cfg, siparis);
  assert.equal(a.user_basket, BEKLENEN.sepet);
  const mesaj = '123456' + '85.34.78.112' + 'RZV1TEST' + 'ornek-musteri-eposta' + '299980' + BEKLENEN.sepet + '1' + '0' + 'TL' + '1' + SALT;
  assert.equal(a.paytr_token, await subtleHmac(KEY, mesaj));
  assert.equal(a.paytr_token, BEKLENEN.token);
  assert.equal(a.test_mode, '1');
  assert.equal(a.payment_amount, '299980');
});

test('get-token: herhangi bir alan değişirse token değişir (ör. tutar)', () => {
  const a = p.tokenAlanlari(cfg, siparis);
  const b = p.tokenAlanlari(cfg, { ...siparis, paymentAmountKurus: 299981 });
  assert.notEqual(a.paytr_token, b.paytr_token);
});

test('bildirim (callback): doğru hash kabul, sahte/değişmiş reddedilir', async () => {
  const post = { merchant_oid: 'RZV1TEST', status: 'success', total_amount: '299980' };
  const h = p.bildirimHash(post, KEY, SALT);
  assert.equal(h, BEKLENEN.bildirim);
  assert.equal(h, await subtleHmac(KEY, 'RZV1TEST' + SALT + 'success' + '299980'));
  assert.equal(p.bildirimDogrula({ ...post, hash: h }, KEY, SALT), true);

  assert.equal(p.bildirimDogrula({ ...post, hash: 'sahte' }, KEY, SALT), false, 'uydurma hash');
  assert.equal(p.bildirimDogrula({ ...post, hash: '' }, KEY, SALT), false, 'boş hash');
  assert.equal(p.bildirimDogrula({ ...post }, KEY, SALT), false, 'hash yok');
  assert.equal(p.bildirimDogrula({ ...post, total_amount: '100', hash: h }, KEY, SALT), false, 'tutar oynanmış');
  assert.equal(p.bildirimDogrula({ ...post, status: 'failed', hash: h }, KEY, SALT), false, 'durum oynanmış');
  assert.equal(p.bildirimDogrula({ ...post, hash: p.bildirimHash(post, 'BASKA_KEY', SALT) }, KEY, SALT), false, 'başka anahtar');
  assert.equal(p.bildirimDogrula({ ...post, hash: p.bildirimHash(post, KEY, 'BASKA_SALT') }, KEY, SALT), false, 'başka salt');
});

test('platform transfer paytr_token: belge sırası, IBAN boşlukları temizlenir', async () => {
  const a = p.transferAlanlari(cfg, {
    merchantOid: 'RZV1TEST', transId: 'TRF1TEST', submerchantKurus: 269982, totalKurus: 299980,
    transferName: 'ORNEK DENIZCILIK TURIZM AS', transferIban: 'tr46 0006 2000 0000 0000 0678 90',
  });
  assert.equal(a.transfer_iban, 'TR460006200000000000067890');
  const mesaj = '123456' + 'RZV1TEST' + 'TRF1TEST' + '269982' + '299980' + 'ORNEK DENIZCILIK TURIZM AS' + 'TR460006200000000000067890' + SALT;
  assert.equal(a.paytr_token, await subtleHmac(KEY, mesaj));
  assert.equal(a.paytr_token, BEKLENEN.transfer);
});

test('platform transfer: geçersiz IBAN / fazla tutar reddedilir', () => {
  const t = { merchantOid: 'X', transId: 'Y', submerchantKurus: 100, totalKurus: 100, transferName: 'A', transferIban: 'TR460006200000000000067890' };
  assert.throws(() => p.transferAlanlari(cfg, { ...t, transferIban: 'TR470006200000000000067890' }), /kontrol/);
  assert.throws(() => p.transferAlanlari(cfg, { ...t, transferIban: 'DE89370400440532013000' }), /26/);
  assert.throws(() => p.transferAlanlari(cfg, { ...t, submerchantKurus: 101 }), /arasında/);
  assert.throws(() => p.transferAlanlari(cfg, { ...t, submerchantKurus: 10.5 }), /tamsayı/);
});

test('transfer sonuç bildirimi: trans_ids + salt; ters eğik çizgi temizlenir; sahte reddedilir', async () => {
  const h = await subtleHmac(KEY, '["TRF1TEST"]' + SALT);
  assert.equal(h, BEKLENEN.transferSonuc);
  assert.equal(p.transferSonucDogrula({ trans_ids: '["TRF1TEST"]', hash: h }, KEY, SALT), true);
  assert.equal(p.transferSonucDogrula({ trans_ids: '[\\"TRF1TEST\\"]', hash: h }, KEY, SALT), true);
  assert.equal(p.transferSonucDogrula({ trans_ids: '["TRF2"]', hash: h }, KEY, SALT), false);
});

test('iade paytr_token: return_amount TL noktalı metin', async () => {
  const a = p.iadeAlanlari(cfg, 'RZV1TEST', 149990);
  assert.equal(a.return_amount, '1499.90');
  assert.equal(a.paytr_token, await subtleHmac(KEY, '123456' + 'RZV1TEST' + '1499.90' + SALT));
  assert.equal(a.paytr_token, BEKLENEN.iade);
});

test('tutar çevirileri kuruşu kaybetmez', () => {
  assert.equal(p.tlToKurus('149,90'), 14990);
  assert.equal(p.tlToKurus('0.1'), 10);
  assert.equal(p.tlToKurus('1499.9'), 149990);
  assert.equal(p.tlToKurus(19.99), 1999); // float 19.99*100 = 1998.99... tuzağı yok
  assert.throws(() => p.tlToKurus('1.005'));
  assert.throws(() => p.tlToKurus('-5'));
  assert.equal(p.kurusToTl(5), '0.05');
  assert.equal(p.kurusToTl(100000), '1000.00');
  for (let k = 0; k < 5000; k += 7) assert.equal(p.tlToKurus(p.kurusToTl(k)), k);
});

test('komisyon bölüşümü kuruşa kadar doğru ve toplamı tutar', () => {
  assert.deepEqual(p.komisyonBol(299980, '10'), { toplam: 299980, platform: 29998, isletme: 269982 });
  assert.deepEqual(p.komisyonBol(14990, '12.5'), { toplam: 14990, platform: 1874, isletme: 13116 }); // 1873.75 -> 1874
  assert.deepEqual(p.komisyonBol(45000, '15'), { toplam: 45000, platform: 6750, isletme: 38250 });
  assert.deepEqual(p.komisyonBol(1001, '12.5'), { toplam: 1001, platform: 125, isletme: 876 }); // 125.125 -> 125
  assert.deepEqual(p.komisyonBol(1004, '12.5'), { toplam: 1004, platform: 126, isletme: 878 }); // 125.5 -> 126
  assert.deepEqual(p.komisyonBol(10000, '8', 250), { toplam: 10000, platform: 1050, isletme: 8950 }); // %8 + 2,50 TL sabit
  assert.deepEqual(p.komisyonBol(100, '0'), { toplam: 100, platform: 0, isletme: 100 });
  assert.throws(() => p.komisyonBol(100, '101'));
  // Rastgele: toplam her zaman korunur, platform payı gerçek değerden en çok yarım kuruş sapar
  for (let i = 0; i < 20000; i++) {
    const t = 1 + Math.floor(Math.random() * 5000000);
    const bps = Math.floor(Math.random() * 10001);
    const b = p.komisyonBol(t, (bps / 100).toFixed(2));
    assert.equal(b.platform + b.isletme, t);
    assert.ok(Math.abs(b.platform - (t * bps) / 10000) <= 0.5 + 1e-9);
    assert.ok(Number.isInteger(b.platform) && b.isletme >= 0);
  }
});

test('esitMi: uzunluk farkı ve boş değer güvenli', () => {
  assert.equal(p.esitMi('abc', 'abc'), true);
  assert.equal(p.esitMi('abc', 'abcd'), false);
  assert.equal(p.esitMi('', ''), false);
  assert.equal(p.esitMi(undefined, undefined), false);
});

test('benzersizNo yalnız harf/rakam ve uzunluk sınırında', () => {
  const o = p.benzersizNo('RZV');
  const t = p.benzersizNo('TRF', 60);
  assert.match(o, /^[A-Z0-9]+$/);
  assert.ok(o.length <= 64 && t.length <= 60);
  assert.notEqual(p.benzersizNo(), p.benzersizNo());
});
