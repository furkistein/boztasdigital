'use strict';
// Uçtan uca akış (SİMÜLASYON modu, PayTR'ye istek atmaz). express kurulu değilse atlanır: önce `npm install`.
const test = require('node:test');
const assert = require('node:assert/strict');

let expressVar = true;
try { require.resolve('express'); } catch { expressVar = false; }

test('rezervasyon -> ödeme -> callback -> onay -> transfer -> transfer sonucu -> iade kuralları', { skip: !expressVar && 'express kurulu değil' }, async () => {
  const PORT = 3900 + Math.floor(Math.random() * 90);
  process.env.PORT = String(PORT);
  process.env.PAYTR_MERCHANT_ID = '';
  process.env.PLATFORM_KOMISYON_YUZDE = '12.5';
  process.env.YONETIM_ANAHTARI = 'test-yonetim';
  const { app, rezervasyonlar, cfg } = require('../server');
  const paytr = require('../paytr');
  const sunucu = app.listen(PORT);
  const U = `http://127.0.0.1:${PORT}`;
  const Y = { 'x-yonetim-anahtari': 'test-yonetim', 'content-type': 'application/json' };
  try {
    // 1) rezervasyon: 2 kişi tekne turu = 2 x 1499.90 = 2999.80 TL
    let r = await fetch(`${U}/api/rezervasyon`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isletmeId: 'tekne-1', hizmetId: 'gunluk', adet: 2, musteriEposta: 'ornek-musteri-eposta' }) });
    const rz = await r.json();
    assert.equal(rz.tutar, '2999.80');

    // 2) ödeme sayfası (simülasyon)
    r = await fetch(`${U}${rz.odemeUrl}`);
    assert.match(await r.text(), /SİMÜLASYON/);

    // 3a) sahte callback reddedilir, rezervasyon değişmez
    r = await fetch(`${U}/paytr/bildirim`, { method: 'POST',
      body: new URLSearchParams({ merchant_oid: rz.oid, status: 'success', total_amount: '299980', hash: 'uydurma' }) });
    assert.equal(r.status, 400);
    assert.equal(rezervasyonlar.get(rz.oid).durum, 'odeme_bekliyor');

    // 3b) iade transfer öncesi, onaysız rezervasyonda reddedilir
    r = await fetch(`${U}/api/rezervasyon/${rz.oid}/iade`, { method: 'POST', headers: Y, body: '{}' });
    assert.equal(r.status, 400);

    // 3c) doğru imzalı callback -> "OK" + onay + bölüşüm
    const post = { merchant_oid: rz.oid, status: 'success', total_amount: '299980' };
    post.hash = paytr.bildirimHash(post, cfg.merchantKey, cfg.merchantSalt);
    r = await fetch(`${U}/paytr/bildirim`, { method: 'POST', body: new URLSearchParams(post) });
    assert.equal(await r.text(), 'OK');
    let d = await (await fetch(`${U}/api/rezervasyon/${rz.oid}`)).json();
    assert.equal(d.durum, 'onaylandi');
    assert.deepEqual(d.bolusum, { toplam: 299980, platform: 37498, isletme: 262482 }); // 37497.5 -> 37498
    assert.equal(d.transfer.durum, 'bekliyor');

    // 3d) aynı bildirim tekrar gelirse yine "OK", çift işlem yok
    r = await fetch(`${U}/paytr/bildirim`, { method: 'POST', body: new URLSearchParams(post) });
    assert.equal(await r.text(), 'OK');

    // 4) transfer: yetkisiz reddedilir; vadesi gelince gönderilir
    r = await fetch(`${U}/yonetim/transferleri-gonder`, { method: 'POST' });
    assert.equal(r.status, 401);
    rezervasyonlar.get(rz.oid).transfer.planTarih = '2000-01-01'; // vadeyi bugüne çek
    const g = await (await fetch(`${U}/yonetim/transferleri-gonder`, { method: 'POST', headers: Y })).json();
    assert.equal(g.gonderilen, 1);
    const alan = rezervasyonlar.get(rz.oid).transfer.cevap.alanlar;
    assert.equal(alan.submerchant_amount, '262482');
    assert.equal(alan.total_amount, '299980');
    assert.equal(alan.paytr_token, paytr.transferHash(alan, cfg.merchantKey, cfg.merchantSalt));

    // 5) transfer sonucu bildirimi
    const tid = rezervasyonlar.get(rz.oid).transfer.transId;
    const ids = JSON.stringify([tid]);
    r = await fetch(`${U}/paytr/transfer-sonuc`, { method: 'POST', body: new URLSearchParams({ trans_ids: ids, hash: 'x' }) });
    assert.equal(r.status, 400);
    r = await fetch(`${U}/paytr/transfer-sonuc`, { method: 'POST',
      body: new URLSearchParams({ trans_ids: ids, hash: paytr.hmacB64(cfg.merchantKey, ids + cfg.merchantSalt) }) });
    assert.equal(await r.text(), 'OK');
    d = await (await fetch(`${U}/api/rezervasyon/${rz.oid}`)).json();
    assert.equal(d.transfer.durum, 'tamamlandi');

    // 6) transfer yapılmış rezervasyonda iade mutabakat ister
    r = await fetch(`${U}/api/rezervasyon/${rz.oid}/iade`, { method: 'POST', headers: Y, body: '{}' });
    assert.equal(r.status, 409);

    // 7) ikinci rezervasyon: transfer öncesi kısmi iade -> işletme payı yeniden hesaplanır
    const rz2 = await (await fetch(`${U}/api/rezervasyon`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isletmeId: 'kuafor-1', hizmetId: 'boya', musteriEposta: 'ornek-musteri-2' }) })).json();
    const p2 = { merchant_oid: rz2.oid, status: 'success', total_amount: '125000' };
    p2.hash = paytr.bildirimHash(p2, cfg.merchantKey, cfg.merchantSalt);
    await fetch(`${U}/paytr/bildirim`, { method: 'POST', body: new URLSearchParams(p2) });
    const iade = await (await fetch(`${U}/api/rezervasyon/${rz2.oid}/iade`, { method: 'POST', headers: Y, body: JSON.stringify({ tutar: '250' }) })).json();
    assert.equal(iade.status, 'success');
    assert.equal(iade.alanlar.return_amount, '250.00');
    d = await (await fetch(`${U}/api/rezervasyon/${rz2.oid}`)).json();
    assert.deepEqual(d.bolusum, { toplam: 100000, platform: 12500, isletme: 87500 });
    assert.equal(d.transfer.submerchantKurus, 87500);
  } finally {
    sunucu.close();
  }
});
