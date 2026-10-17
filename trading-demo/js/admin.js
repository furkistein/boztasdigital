/* Demo Exchange - admin console (demo).
 * Users, KYC applicants, other accounts' positions and funding requests are SAMPLE data generated
 * from a fixed seed (no real people, no real addresses). Instrument settings and prediction-market
 * operations act on the real demo engine in this browser. */
(function () {
  'use strict';
  var A = window.VXApp; if (!A) return;
  var D = A.D, E = A.E, P = A.P, esc = A.esc, nf = A.nf, usd = A.usd, signed = A.signed;
  var $ = function (id) { return document.getElementById(id); };
  function S() { return A.S(); }
  function ad() { var a = A.adm(); if (!a.kyc) a.kyc = {}; if (!a.fund) a.fund = {}; if (!a.audit) a.audit = []; return a; }
  function audit(txt) { var a = ad(); a.audit.unshift({ t: Date.now(), txt: txt }); if (a.audit.length > 60) a.audit.length = 60; }

  function seeded(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  var DAY = 86400000;

  /* ---------- sample users ---------- */
  var COUNTRIES = ['US', 'DE', 'GB', 'FR', 'NL', 'ES', 'IT', 'PL', 'CA', 'IE', 'SE', 'AT', 'PT', 'US', 'DE', 'US'];
  var USERS = (function () {
    var r = seeded('users'), out = [];
    for (var k = 0; k < 16; k++) {
      var id = 'U-' + (10240 + Math.floor(r() * 9000));
      var kyc = k < 5 ? 'pending' : r() < 0.82 ? 'verified' : r() < 0.5 ? 'rejected' : 'not_started';
      out.push({ id: id, handle: 'user_' + id.slice(2), country: COUNTRIES[k], tier: r() < 0.18 ? 'Professional' : 'Retail', kyc: kyc,
        equity: kyc === 'verified' ? Math.round(800 + Math.pow(r(), 2) * 64000) : Math.round(r() * 300), vol30: Math.round(Math.pow(r(), 1.6) * 1.8e6),
        joined: Date.now() - Math.floor(4 + r() * 280) * DAY, doc: ['Passport', 'ID card', "Driver's license"][Math.floor(r() * 3)],
        live: r() < 0.6 ? 'ok' : r() < 0.6 ? 'review' : 'ok', poa: r() < 0.7, sanc: r() < 0.92 ? 'clear' : 'possible match', score: Math.round(8 + r() * 70),
        submitted: Date.now() - Math.floor(10 + r() * 2600) * 60000 });
    }
    return out;
  })();
  function kycOf(u) { var o = ad().kyc[u.id]; return o ? o.status : u.kyc; }
  function kycLabel(st) { return { pending: ['wait', 'Pending review'], verified: ['ok', 'Verified'], rejected: ['bad', 'Rejected'], not_started: ['', 'Not started'] }[st] || ['', st]; }

  function usersHtml() {
    var a = ad(), pend = USERS.filter(function (u) { return kycOf(u) === 'pending'; }).sort(function (x, y) { return x.submitted - y.submitted; });
    var counts = { verified: 0, pending: 0, rejected: 0 }; USERS.forEach(function (u) { var k = kycOf(u); if (counts[k] != null) counts[k]++; });
    var h = '<div class="kpis">' +
      kpi('Accounts', String(USERS.length + 1), 'sample + this browser') + kpi('Verified', String(counts.verified), 'KYC passed') +
      kpi('KYC queue', String(counts.pending), counts.pending ? 'waiting for review' : 'queue empty', counts.pending ? 'warn' : '') + kpi('Rejected', String(counts.rejected), 'can re-apply') +
      kpi('Region profile', S().admin && S().admin.profile === 'esma' ? 'EU retail' : 'Demo default', 'leverage caps (Instruments)') + kpi('Audit entries', String(a.audit.length), 'operator actions') + '</div>';
    h += '<div class="pg"><div class="pg-grid"><section class="sec"><div class="sec-h"><h2>KYC review queue</h2><span class="tag">sample applicants</span></div>' +
      (pend.length ? '<div class="table-scroll"><table class="tbl"><thead><tr><th>Applicant</th><th>Country</th><th>Document</th><th>Liveness</th><th>Proof of address</th><th>Sanctions / PEP</th><th class="r">Risk score</th><th>Submitted</th><th></th></tr></thead><tbody>' +
      pend.map(function (u) {
        return '<tr><td><b>' + u.handle + '</b><div class="sub">' + u.id + ' · ' + u.tier + '</div></td><td>' + u.country + '</td><td>' + u.doc + ' <span class="st ok">checked</span></td>' +
          '<td>' + (u.live === 'ok' ? '<span class="st ok">passed</span>' : '<span class="st wait">manual review</span>') + '</td><td>' + (u.poa ? '<span class="st ok">received</span>' : '<span class="st wait">missing</span>') + '</td>' +
          '<td>' + (u.sanc === 'clear' ? '<span class="st ok">clear</span>' : '<span class="st bad">possible match</span>') + '</td><td class="mono r ' + (u.score > 55 ? 'warn' : '') + '">' + u.score + '</td><td class="mono">' + A.timeFmt(u.submitted) + '</td>' +
          '<td><div class="act"><select class="select" data-rsn="' + u.id + '" aria-label="Reject reason" style="height:24px;width:150px;font-size:11px"><option value="">Reject reason…</option><option>Document unreadable</option><option>Proof of address missing</option><option>Sanctions screening match</option><option>Unsupported country</option></select>' +
          '<button class="btn-ghost sm btn-danger" data-kyc="reject" data-u="' + u.id + '">Reject</button><button class="btn-primary sm" data-kyc="approve" data-u="' + u.id + '">Approve</button></div><div class="f-err" id="kerr-' + u.id + '"></div></td></tr>';
      }).join('') + '</tbody></table></div>' : A.emptySt('check-circle', 'Queue is empty', 'Every sample applicant has been reviewed. Reset demo to refill the queue.')) +
      '<div class="sec-note">Document, liveness and sanctions checks come from the KYC provider; operators decide flagged cases only.</div></section></div>';
    h += '<div class="pg-grid" style="margin-top:16px;grid-template-columns:minmax(0,2fr) minmax(0,1fr)"><section class="sec"><div class="sec-h"><h2>Users</h2><span class="tag">sample</span></div><div class="table-scroll"><table class="tbl"><thead><tr><th>User</th><th>Country</th><th>Tier</th><th>KYC</th><th class="r">Equity</th><th class="r">30d volume</th><th>Joined</th></tr></thead><tbody>' +
      '<tr><td><b>D-100248</b><div class="sub">this browser (paper)</div></td><td>—</td><td>Demo</td><td><span class="st">Demo only</span></td><td class="mono r">' + usd(A.equity()) + '</td><td class="mono r">' + usd(volume30()) + '</td><td class="mono">today</td></tr>' +
      USERS.map(function (u) { var k = kycLabel(kycOf(u)); return '<tr><td><b>' + u.handle + '</b><div class="sub">' + u.id + '</div></td><td>' + u.country + '</td><td>' + u.tier + '</td><td><span class="st ' + k[0] + '">' + k[1] + '</span></td><td class="mono r">' + usd(u.equity) + '</td><td class="mono r">' + usd(u.vol30) + '</td><td class="mono">' + new Date(u.joined).toISOString().slice(0, 10) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>' +
      '<section class="sec"><div class="sec-h"><h2>Audit log</h2></div>' + (a.audit.length ? '<ul class="plain audit">' + a.audit.map(function (x) { return '<li><time class="mono">' + A.hms(x.t) + '</time><span>' + esc(x.txt) + '</span></li>'; }).join('') + '</ul>' : A.emptySt('list-bullets', 'No operator actions yet', 'Approvals, rejections, setting changes and market operations are logged here.')) + '</section></div></div>';
    return h;
  }
  function volume30() { var v = 0, now = Date.now(); S().history.forEach(function (hh) { if (hh.qty != null && hh.price && now - hh.t < 30 * DAY && (hh.kind === 'Open' || hh.kind === 'Limit filled' || hh.closed)) { var a = D.BY_ID[hh.asset]; v += a && a.kind === 'inverse' ? hh.qty : hh.qty * hh.price; } }); return v; }

  /* ---------- platform risk ---------- */
  var BOOK = null;
  function sampleBook() {
    if (BOOK) return BOOK;
    var r = seeded('book'), ids = ['XAUUSD', 'XAGUSD', 'WTI', 'BRENT', 'NATGAS', 'CORN', 'WHEAT', 'COFFEE', 'BTC', 'ETH', 'SOL', 'EURUSD', 'USDJPY', 'GBPUSD', 'US500', 'NAS100', 'GER40', 'NVDA', 'TSLA', 'AAPL'];
    var accts = USERS.filter(function (u) { return u.kyc === 'verified'; }).slice(0, 10);
    BOOK = [];
    accts.forEach(function (u) {
      var n = 1 + Math.floor(r() * 4), cash = u.equity * (0.25 + r() * 0.4);
      for (var k = 0; k < n; k++) {
        var id = ids[Math.floor(r() * ids.length)], a = D.BY_ID[id], cap = D.CLASS[a.cat].maxLev;
        var L = Math.max(1, Math.min(cap, Math.round([2, 5, 10, 20, 25, 50][Math.floor(r() * 6)]))), margin = Math.round(u.equity * (0.04 + r() * 0.16));
        BOOK.push({ acct: u.handle, uid: u.id, cash: cash / n, id: id, side: r() < 0.58 ? 'long' : 'short', lev: L, margin: margin, off: (r() - 0.5) * 0.03 });
      }
    });
    return BOOK;
  }
  function riskRows() {
    var rows = [];
    sampleBook().forEach(function (b) {
      var a = D.BY_ID[b.id], m = A.mid(a); if (!(m > 0)) return;
      var entry = m * (1 - b.off), kind = a.kind, notional = b.margin * b.lev, qty = kind === 'inverse' ? notional : notional / entry;
      var p = { side: b.side, qty: qty, entry: entry, kind: kind };
      rows.push({ acct: b.acct, cash: b.cash, a: a, side: b.side, notional: E.notionalOf(kind, qty, m), margin: b.margin, upnl: E.unrealizedPnl(p, m), lev: b.lev, liq: E.liquidationPrice(b.side, entry, b.lev, kind), mark: m, you: false });
    });
    S().positions.forEach(function (p) {
      var a = D.BY_ID[p.asset], m = A.markFor(a, p.side);
      rows.push({ acct: 'D-100248 (you)', cash: S().balance, a: a, side: p.side, notional: E.notionalOf(p.kind, p.qty, m), margin: p.margin, upnl: E.unrealizedPnl(p, m), lev: p.lev, liq: p.liq, mark: m, you: true });
    });
    return rows;
  }
  function riskHtml() {
    var rows = riskRows(), by = {}, acct = {}, totL = 0, totS = 0, cpnl = 0;
    rows.forEach(function (r) {
      var x = by[r.a.id] = by[r.a.id] || { a: r.a, l: 0, s: 0, n: 0, pnl: 0 };
      if (r.side === 'long') { x.l += r.notional; totL += r.notional; } else { x.s += r.notional; totS += r.notional; }
      x.n++; x.pnl += r.upnl; cpnl += r.upnl;
      var ac = acct[r.acct] = acct[r.acct] || { name: r.acct, margin: 0, upnl: 0, cash: 0, n: 0, worst: 0, you: r.you };
      ac.margin += r.margin; ac.upnl += r.upnl; ac.n++; ac.cash = r.you ? r.cash : ac.cash + r.cash;
      var mr = r.notional * E.MMR / Math.max(1e-9, r.margin + r.upnl); ac.worst = Math.max(ac.worst, mr);
    });
    var assets = Object.keys(by).map(function (k) { return by[k]; }).sort(function (x, y) { return Math.abs(y.l - y.s) - Math.abs(x.l - x.s); });
    var accts = Object.keys(acct).map(function (k) { var a = acct[k]; a.eq = a.cash + a.margin + a.upnl; a.ml = a.margin > 0 ? a.eq / a.margin : null; return a; }).sort(function (x, y) { return y.worst - x.worst; });
    var h = '<div class="kpis">' + kpi('Open positions', String(rows.length), accts.length + ' accounts') + kpi('Long exposure', usd(totL), 'client longs', 'up') + kpi('Short exposure', usd(totS), 'client shorts', 'down') +
      kpi('Net client exposure', signed(totL - totS), 'house holds the opposite side', totL - totS >= 0 ? 'up' : 'down') + kpi('Client unrealized PnL', signed(cpnl), 'house PnL is the negative', cpnl >= 0 ? 'up' : 'down') +
      kpi('At-risk accounts', String(accts.filter(function (a) { return a.worst >= 0.8; }).length), 'a position at 80%+ margin ratio') + '</div>';
    var max = 1; assets.forEach(function (x) { max = Math.max(max, x.l, x.s); });
    h += '<div class="pg"><div class="pg-grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)"><section class="sec"><div class="sec-h"><h2>Net position by market</h2><span class="tag">sample accounts + yours, live prices</span></div><div class="table-scroll"><table class="tbl"><thead><tr><th>Market</th><th class="r">Long</th><th class="r">Short</th><th style="width:22%">Long vs short</th><th class="r">Net</th><th class="r">Positions</th><th class="r">Client PnL</th></tr></thead><tbody>' +
      assets.map(function (x) { var net = x.l - x.s; return '<tr><td><b>' + esc(x.a.sym) + '</b></td><td class="mono r">' + usd(x.l) + '</td><td class="mono r">' + usd(x.s) + '</td><td><span style="display:grid;grid-template-columns:1fr 1fr;gap:2px"><span class="bar-row" style="display:block"><span class="bar" style="display:block;height:6px;transform:scaleX(-1)"><i class="l" style="width:' + (x.l / max * 100).toFixed(1) + '%"></i></span></span><span class="bar-row" style="display:block"><span class="bar" style="display:block;height:6px"><i class="s" style="width:' + (x.s / max * 100).toFixed(1) + '%"></i></span></span></span></td><td class="mono r ' + (net >= 0 ? 'up' : 'down') + '">' + signed(net) + '</td><td class="mono r">' + x.n + '</td><td class="mono r ' + (x.pnl >= 0 ? 'up' : 'down') + '">' + signed(x.pnl) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>' +
      '<section class="sec"><div class="sec-h"><h2>Riskiest accounts</h2></div><div class="table-scroll"><table class="tbl"><thead><tr><th>Account</th><th class="r">Equity</th><th class="r">Margin level</th><th class="r">Worst margin ratio</th></tr></thead><tbody>' +
      accts.slice(0, 10).map(function (a) { return '<tr' + (a.you ? ' style="font-weight:500"' : '') + '><td>' + esc(a.name) + '<div class="sub">' + a.n + ' positions</div></td><td class="mono r">' + usd(a.eq) + '</td><td class="mono r">' + (a.ml == null ? '—' : nf(a.ml * 100, 0) + '%') + '</td><td class="mono r ' + (a.worst >= 0.8 ? 'down' : a.worst >= 0.5 ? 'warn' : '') + '">' + nf(Math.min(a.worst, 9.99) * 100, 1) + '%</td></tr>'; }).join('') +
      '</tbody></table></div><div class="sec-note">Sample accounts hold fixed sample positions; their PnL moves with the live demo prices. Your row is your real paper account.</div></section></div></div>';
    return h;
  }

  /* ---------- instruments ---------- */
  function instHtml() {
    var a0 = A.adm(), cfg = a0.cfg, prof = a0.profile || 'default';
    var h = '<div class="pg"><div class="pg-grid"><section class="sec"><div class="sec-h"><h2>Leverage profile</h2></div><div class="sec-b" style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">' +
      '<div class="tabs tabs-tight" id="admProf"><button class="seg-btn' + (prof !== 'esma' ? ' is-active' : '') + '" data-prof="default">Demo default</button><button class="seg-btn' + (prof === 'esma' ? ' is-active' : '') + '" data-prof="esma">EU retail (ESMA caps)</button></div>' +
      '<p class="fine" style="margin:0;max-width:72ch">ESMA retail CFD limits: 30:1 major FX pairs, 20:1 other FX, gold and major indices, 10:1 other commodities, 5:1 single stocks, 2:1 crypto. The lower of the profile cap and the instrument cap applies on the Trade page. US retail clients cannot be offered CFDs; a US launch would use listed futures or spot FX within NFA limits (50:1 majors, 20:1 others).</p></div></section></div>';
    h += '<div class="pg-grid" style="margin-top:16px"><section class="sec"><div class="sec-h"><h2>Instrument settings</h2><span class="sec-r"><span class="muted" id="instMsg"></span><button class="btn-ghost sm" id="instReset">Restore defaults</button><button class="btn-primary sm" id="instSave">Save changes</button></span></div>' +
      '<div class="table-scroll"><table class="tbl" id="instTbl"><thead><tr><th>Market</th><th>Class</th><th class="r">Spread</th><th class="r">Taker fee %</th><th class="r">Maker fee %</th><th class="r">Max leverage</th><th class="r">Effective cap</th></tr></thead><tbody>' +
      D.ASSETS.map(function (a) {
        var c = D.CLASS[a.cat], o = cfg[a.id] || {}, eff = A.cls(a);
        function cell(k, val, def, dp) { return '<td class="r"><input class="cell-in' + (o[k] != null ? ' changed' : '') + '" data-k="' + k + '" data-a="' + a.id + '" inputmode="decimal" value="' + val + '" aria-label="' + esc(a.sym) + ' ' + k + '"><div class="sub mono">default ' + def + '</div></td>'; }
        var spreadDef = a.spread0 ? nf(a.spread0, a.dp) : 'book';
        return '<tr><td><b>' + esc(a.sym) + '</b><div class="sub">' + esc(a.name) + '</div></td><td>' + c.label + '</td>' +
          (a.spread0 ? cell('spread', o.spread != null ? o.spread : a.spread0, spreadDef) : '<td class="r muted">order book<div class="sub">Binance spread</div></td>') +
          cell('taker', +((o.taker != null ? o.taker : c.taker) * 100).toFixed(4), nf(c.taker * 100, 3)) +
          cell('maker', +((o.maker != null ? o.maker : c.maker) * 100).toFixed(4), nf(c.maker * 100, 3)) +
          cell('maxLev', o.maxLev || c.maxLev, c.maxLev + 'x') +
          '<td class="mono r">' + eff.maxLev + 'x' + (eff.profile ? '<div class="sub">' + eff.profile + '</div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="sec-note">Changes apply to new orders right away (ticket, fees, liquidation preview, spread in the book). Open positions keep the terms they were opened with. Limits: spread below 2% of price, fees 0 to 0.5%, leverage 1 to 100x.</div></section></div></div>';
    return h;
  }
  function saveInst() {
    var a0 = A.adm(), next = {}, err = '', n = 0;
    document.querySelectorAll('#instTbl .cell-in').forEach(function (inp) {
      inp.classList.remove('bad');
      var id = inp.dataset.a, k = inp.dataset.k, a = D.BY_ID[id], c = D.CLASS[a.cat], v = Number(String(inp.value).replace(/,/g, '').trim());
      var bad = !isFinite(v) || String(inp.value).trim() === '';
      if (!bad && k === 'spread') bad = v < 0 || v > A.mid(a) * 0.02;
      if (!bad && (k === 'taker' || k === 'maker')) bad = v < 0 || v > 0.5;
      if (!bad && k === 'maxLev') bad = v < 1 || v > 100 || Math.floor(v) !== v;
      if (bad) { inp.classList.add('bad'); if (!err) err = a.sym + ': ' + { spread: 'spread must be 0 to 2% of price', taker: 'taker fee must be 0 to 0.5%', maker: 'maker fee must be 0 to 0.5%', maxLev: 'leverage must be a whole number 1 to 100' }[k]; return; }
      var def = k === 'spread' ? a.spread0 : k === 'maxLev' ? c.maxLev : c[k] * 100;
      if (Math.abs(v - def) > 1e-12) { (next[id] = next[id] || {})[k] = k === 'taker' || k === 'maker' ? v / 100 : v; n++; }
    });
    if (err) { $('instMsg').textContent = err; $('instMsg').className = 'down'; return; }
    var before = JSON.stringify(a0.cfg);
    a0.cfg = next;
    if (before !== JSON.stringify(next)) audit('Instrument settings saved (' + n + ' overrides)');
    A.afterAdminChange(); A.save(true);
    A.toast('Instrument settings saved', n ? n + ' values differ from the defaults. New orders use them now.' : 'All instruments use the default values.', 'ok');
    render();
  }

  /* ---------- prediction markets ---------- */
  var mkDraft = { q: '', cat: 'Commodities', type: 'binary', outcomes: '', closeDate: '', rule: '', source: '', b: '3000' };
  function marketsHtml() {
    var cats = P.CATS, d = mkDraft;
    if (!d.closeDate) { var t = new Date(Date.now() + 30 * DAY); d.closeDate = t.toISOString().slice(0, 10); }
    var h = '<div class="pg"><div class="pg-grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.3fr)"><section class="sec"><div class="sec-h"><h2>Create market</h2><span class="tag">demo</span></div><div class="sec-b"><div class="form-grid" id="mkForm">' +
      '<div class="full"><label class="lbl" for="mkQ">Title <small>(the question traders see)</small></label><input class="text-in" id="mkQ" maxlength="160" value="' + esc(d.q) + '" placeholder="Will WTI settle above $110 on the last trading day of the year?"></div>' +
      '<div><label class="lbl" for="mkCat">Category</label><select class="select" id="mkCat">' + cats.map(function (c) { return '<option' + (c === d.cat ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="lbl" for="mkType">Type</label><select class="select" id="mkType"><option value="binary"' + (d.type === 'binary' ? ' selected' : '') + '>Yes / No</option><option value="multi"' + (d.type === 'multi' ? ' selected' : '') + '>Multiple outcomes</option><option value="range"' + (d.type === 'range' ? ' selected' : '') + '>Range buckets</option></select></div>' +
      '<div class="full" id="mkOutsF"' + (d.type === 'binary' ? ' hidden' : '') + '><label class="lbl" for="mkOuts">Outcomes <small>(one per line, 2 to 8)</small></label><textarea class="area-in" id="mkOuts" rows="4" placeholder="Below $100&#10;$100 - $110&#10;Above $110">' + esc(d.outcomes) + '</textarea></div>' +
      '<div><label class="lbl" for="mkClose">Closing date (UTC)</label><input class="text-in" type="date" id="mkClose" value="' + esc(d.closeDate) + '"></div>' +
      '<div><label class="lbl" for="mkB">Liquidity b <small>(max MM loss b·ln n)</small></label><input class="text-in mono" id="mkB" inputmode="numeric" value="' + esc(d.b) + '"></div>' +
      '<div class="full"><label class="lbl" for="mkRule">Resolution rules</label><textarea class="area-in" id="mkRule" rows="3" placeholder="Resolves YES if ... according to ...">' + esc(d.rule) + '</textarea></div>' +
      '<div class="full"><label class="lbl" for="mkSrc">Resolution source</label><input class="text-in" id="mkSrc" value="' + esc(d.source) + '" placeholder="e.g. CME Group NYMEX settlement prices"></div>' +
      '<div class="full"><div class="f-err" id="mkErr"></div><button class="btn-primary" id="mkGo">Create market</button></div>' +
      '</div></div><div class="sec-note">New markets open with equal odds and are priced by the LMSR market maker. They appear on the Predict page under their category and are labeled as operator markets.</div></section>';
    var list = P.markets().filter(function (m) { return !m.auto; }).slice().sort(function (a, b) { return (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1); });
    h += '<section class="sec"><div class="sec-h"><h2>Markets</h2><span class="sec-r muted">' + list.filter(function (m) { return m.status === 'open'; }).length + ' open</span></div><div class="table-scroll"><table class="tbl"><thead><tr><th>Market</th><th>Type</th><th class="r">Volume</th><th>Closes</th><th>Status</th><th>Settle</th></tr></thead><tbody>' +
      list.map(function (m) {
        var res = m.status !== 'open';
        var settle = res ? '<span class="muted">' + (m.winner != null ? esc(m.outcomes[m.winner]) : '—') + '</span>' : m.custom ?
          '<div class="act" style="justify-content:flex-start"><select class="select" data-win="' + m.id + '" style="height:24px;width:140px;font-size:11px" aria-label="Winning outcome"><option value="">Winning outcome…</option>' + m.outcomes.map(function (o, j) { return '<option value="' + j + '">' + esc(o) + '</option>'; }).join('') + '</select><button class="btn-ghost sm" data-settle="' + m.id + '">Settle</button></div><div class="f-err" id="serr-' + m.id + '"></div>' :
          '<span class="muted">on its market page</span>';
        return '<tr><td class="wrap"><button class="linkbtn" data-openm="' + m.id + '">' + esc(m.q) + '</button><div class="sub">' + esc(m.cat) + (m.custom ? ' · operator market' : ' · sample') + '</div></td><td>' + { binary: 'Yes / No', multi: 'Multi', range: 'Range' }[m.type] + '</td><td class="mono r">' + usd(m.vol) + '</td><td>' + esc(m.close) + '</td>' +
          '<td>' + (res ? '<span class="st">Resolved</span>' : '<span class="st ok">Open</span>') + '</td><td>' + settle + '</td></tr>';
      }).join('') + '</tbody></table></div></section></div></div>';
    return h;
  }
  function readDraft() {
    mkDraft = { q: $('mkQ').value, cat: $('mkCat').value, type: $('mkType').value, outcomes: $('mkOuts').value, closeDate: $('mkClose').value, rule: $('mkRule').value, source: $('mkSrc').value, b: $('mkB').value };
  }
  function createMk() {
    readDraft();
    var r = P.createMarket(Object.assign({}, mkDraft, { b: Number(String(mkDraft.b).replace(/,/g, '')) }));
    if (typeof r === 'string') { $('mkErr').textContent = r; return; }
    audit('Market created: ' + r.q);
    A.save(true); A.toast('Market created', r.q + ' · ' + r.outcomes.length + ' outcomes, closes ' + r.close, 'ok');
    mkDraft = { q: '', cat: r.cat, type: 'binary', outcomes: '', closeDate: '', rule: '', source: '', b: '3000' };
    render();
  }

  /* ---------- funding ---------- */
  var FUND = (function () {
    var r = seeded('funding'), out = [], coins = [['USDT', 'Tron (TRC-20)'], ['USDT', 'Ethereum (ERC-20)'], ['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['USDC', 'Ethereum (ERC-20)']];
    for (var k = 0; k < 14; k++) {
      var u = USERS[Math.floor(r() * USERS.length)], c = coins[Math.floor(r() * coins.length)], dep = r() < 0.55;
      var usdAmt = Math.round((150 + Math.pow(r(), 2) * 24000) * 100) / 100;
      var amt = c[0] === 'BTC' ? usdAmt / 81500 : c[0] === 'ETH' ? usdAmt / 2420 : usdAmt;
      var st = dep ? (r() < 0.75 ? 'completed' : 'confirming') : (k < 6 ? 'pending' : r() < 0.7 ? 'completed' : 'rejected');
      var flags = []; if (!dep && usdAmt > 10000) flags.push('large amount'); if (!dep && r() < 0.3) flags.push('new destination'); if (u.kyc !== 'verified') flags.push('KYC not complete');
      if (!dep && st === 'completed' && u.kyc !== 'verified') st = 'rejected';   // no payout without completed KYC
      out.push({ id: (dep ? 'DEP-' : 'WDR-') + (30120 + k * 7 + Math.floor(r() * 5)), user: u.handle, dir: dep ? 'Deposit' : 'Withdrawal', coin: c[0], net: c[1], amt: amt, usd: usdAmt, status: st, conf: Math.floor(2 + r() * 9), need: c[0] === 'BTC' ? 3 : 12, flags: flags, t: Date.now() - Math.floor(r() * 3 * DAY) });
    }
    out.sort(function (a, b) { return b.t - a.t; });
    return out;
  })();
  function fundSt(f) { var o = ad().fund[f.id]; return o ? o.status : f.status; }
  function fundHtml() {
    var pend = FUND.filter(function (f) { return fundSt(f) === 'pending'; }), pv = pend.reduce(function (s, f) { return s + f.usd; }, 0);
    var dep24 = FUND.filter(function (f) { return f.dir === 'Deposit' && Date.now() - f.t < DAY; }).reduce(function (s, f) { return s + f.usd; }, 0);
    var h = '<div class="kpis">' + kpi('Pending withdrawals', String(pend.length), usd(pv) + ' waiting for approval', pend.length ? 'warn' : '') + kpi('Deposits, 24h', usd(dep24), 'sample') +
      kpi('Confirming', String(FUND.filter(function (f) { return fundSt(f) === 'confirming'; }).length), 'waiting for network confirmations') + kpi('Flagged', String(FUND.filter(function (f) { return f.flags.length && fundSt(f) === 'pending'; }).length), 'need a second look') +
      kpi('Hot wallet', 'Provider', 'custody by the payment processor') + kpi('Live money', 'None', 'demo: nothing is sent') + '</div>';
    h += '<div class="pg"><div class="pg-grid"><section class="sec"><div class="sec-h"><h2>Deposit and withdrawal requests</h2><span class="tag">sample · no real addresses</span></div><div class="table-scroll"><table class="tbl"><thead><tr><th>Request</th><th>User</th><th>Type</th><th>Asset / network</th><th class="r">Amount</th><th class="r">USD value</th><th>Status</th><th>Checks</th><th>Created</th><th></th></tr></thead><tbody>' +
      FUND.map(function (f) {
        var st = fundSt(f), lab = { pending: ['wait', 'Pending approval'], completed: ['ok', 'Completed'], rejected: ['bad', 'Rejected'], confirming: ['wait', 'Confirming ' + f.conf + '/' + f.need], approved: ['ok', 'Approved · sent to provider'] }[st];
        var acts = st === 'pending' ? '<div class="act"><button class="btn-ghost sm btn-danger" data-fund="reject" data-f="' + f.id + '">Reject</button><button class="btn-primary sm" data-fund="approve" data-f="' + f.id + '">Approve</button></div>' : '';
        var dp = f.coin === 'BTC' ? 6 : f.coin === 'ETH' ? 5 : 2;
        return '<tr><td class="mono">' + f.id + '</td><td>' + f.user + '</td><td class="' + (f.dir === 'Deposit' ? 'up' : 'down') + '">' + f.dir + '</td><td>' + f.coin + '<div class="sub">' + f.net + '</div></td><td class="mono r">' + nf(f.amt, dp) + '</td><td class="mono r">' + usd(f.usd) + '</td>' +
          '<td><span class="st ' + lab[0] + '">' + lab[1] + '</span></td><td>' + (f.flags.length ? '<span class="warn">' + f.flags.join(', ') + '</span>' : '<span class="muted">none</span>') + '</td><td class="mono">' + A.timeFmt(f.t) + '</td><td>' + acts + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="sec-note">Sample requests for the operator workflow. No wallet addresses, transaction hashes or QR codes are generated, and approving a row moves no funds. In the full build the crypto payment provider issues addresses, tracks confirmations and executes approved withdrawals after 2FA and travel-rule checks.</div></section></div></div>';
    return h;
  }

  function kpi(k, v, sub, cls) { return '<dl class="kpi"><dt>' + k + '</dt><dd class="' + (cls || '') + '">' + v + '</dd>' + (sub ? '<span class="kpi-s">' + sub + '</span>' : '') + '</dl>'; }

  /* ---------- page ---------- */
  var tab = 'users';
  function render() {
    var body = $('admBody'); if (!body) return;
    var inner = tab === 'risk' ? riskHtml() : tab === 'inst' ? instHtml() : tab === 'markets' ? marketsHtml() : tab === 'funding' ? fundHtml() : usersHtml();
    body.innerHTML = inner;
    document.querySelectorAll('#admTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.ad === tab); });
  }
  var last = 0;
  function tick() { if (tab !== 'risk') return; if (Date.now() - last < 1500) return; last = Date.now(); render(); }
  function init() {
    $('admTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-ad]'); if (!b) return; if (tab === 'markets' && $('mkQ')) readDraft(); tab = b.dataset.ad; render(); });
    var body = $('admBody');
    body.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.kyc) {
        var u = USERS.filter(function (x) { return x.id === b.dataset.u; })[0]; if (!u) return;
        if (b.dataset.kyc === 'reject') {
          var rs = body.querySelector('[data-rsn="' + u.id + '"]'), reason = rs ? rs.value : '';
          if (!reason) { $('kerr-' + u.id).textContent = 'Choose a reason first.'; return; }
          ad().kyc[u.id] = { status: 'rejected', reason: reason, t: Date.now() }; audit('KYC rejected: ' + u.handle + ' (' + reason + ')');
          A.toast('KYC rejected · ' + u.handle, reason, 'warn');
        } else { ad().kyc[u.id] = { status: 'verified', t: Date.now() }; audit('KYC approved: ' + u.handle); A.toast('KYC approved · ' + u.handle, 'Account can trade live in the full build', 'ok'); }
        A.save(true); render(); return;
      }
      if (b.dataset.fund) {
        var f = FUND.filter(function (x) { return x.id === b.dataset.f; })[0]; if (!f) return;
        var ok = b.dataset.fund === 'approve';
        ad().fund[f.id] = { status: ok ? 'approved' : 'rejected', t: Date.now() };
        audit('Withdrawal ' + (ok ? 'approved' : 'rejected') + ': ' + f.id + ' ' + usd(f.usd));
        A.toast('Withdrawal ' + (ok ? 'approved' : 'rejected') + ' · ' + f.id, ok ? 'Demo only: no funds move.' : 'User is notified in the full build.', ok ? 'ok' : 'warn');
        A.save(true); render(); return;
      }
      if (b.id === 'instSave') { saveInst(); return; }
      if (b.id === 'instReset') { A.adm().cfg = {}; audit('Instrument settings restored to defaults'); A.afterAdminChange(); A.save(true); A.toast('Defaults restored', 'Every instrument uses the class defaults again.', 'ok'); render(); return; }
      if (b.dataset.prof) { var a0 = A.adm(); if (a0.profile !== b.dataset.prof) { a0.profile = b.dataset.prof; audit('Leverage profile: ' + (a0.profile === 'esma' ? 'EU retail (ESMA)' : 'Demo default')); A.afterAdminChange(); A.save(true); A.toast('Leverage profile changed', a0.profile === 'esma' ? 'ESMA retail caps now limit leverage on the Trade page.' : 'Instrument caps apply again.', 'ok'); } render(); return; }
      if (b.id === 'mkGo') { createMk(); return; }
      if (b.dataset.settle) {
        var m = P.market(b.dataset.settle), sel = body.querySelector('[data-win="' + b.dataset.settle + '"]');
        if (!m || !sel) return;
        if (sel.value === '') { $('serr-' + m.id).textContent = 'Pick the winning outcome.'; return; }
        var w = +sel.value, res = P.resolve(m, w);
        if (res) { audit('Market settled: ' + m.q + ' -> ' + m.outcomes[w]); A.toast('Market settled (demo)', m.outcomes[w] + (res.had ? ' · your payout ' + usd(res.payout) : ''), 'ok'); A.save(true); }
        render(); return;
      }
      if (b.dataset.openm) { var mm = P.market(b.dataset.openm); if (mm) { A.setView('predict'); P.openDetail(mm); } }
    });
    body.addEventListener('change', function (e) {
      if (e.target.id === 'mkType') { $('mkOutsF').hidden = e.target.value === 'binary'; }
      if (e.target.classList && e.target.classList.contains('cell-in')) e.target.classList.add('changed');
    });
  }
  A.register('admin', { init: init, render: render, tick: tick });
  window.VXAdmin = { USERS: USERS, FUND: FUND, riskRows: riskRows, setTab: function (t) { tab = t; render(); } };
})();
