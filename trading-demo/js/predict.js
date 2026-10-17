/* Vertex Markets (Demo) — prediction markets.
 * Market types: binary (YES/NO), multi-outcome (one event, several candidates) and range
 * (Kalshi-style price/value buckets). Pricing: LMSR automated market maker (see engine.js).
 * Every market here is a SAMPLE market: questions and starting odds are illustrative only and
 * nothing is resolved from real-world data; "Resolve (demo)" settles it by hand.
 */
(function (root) {
  'use strict';
  var E = root.VXEngine;
  var H = null, S = null;

  var CATS = ['Politics', 'Economics', 'Crypto', 'Commodities', 'Sports', 'Climate & Weather', 'Tech'];
  var COLORS = ['#d4ff4f', '#5ea8ff', '#ff8a4c', '#c38bff', '#3fd0a8', '#ff5f8f'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function ceilTo(x, step) { return Math.ceil(x / step) * step; }
  function roundTo(x, step) { return Math.round(x / step) * step; }
  function usd0(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  function k(v) { return '$' + (v >= 1000 ? (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k' : v); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cents(p) { var c = p * 100; return (c >= 99.95 ? '99.9' : c < 0.05 ? '0.1' : c.toFixed(1)) + '¢'; }

  /* ---------------- market catalogue (sample) ---------------- */
  function catalogue(px) {
    var btc = px('BTC') || 80000, eth = px('ETH') || 2500, gold = px('XAUUSD') || 4180;
    var now = new Date();
    var monthName = MONTHS[now.getUTCMonth()] + ' ' + now.getUTCFullYear();
    var lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    var monthEnd = MONTHS[lastDay.getUTCMonth()].slice(0, 3) + ' ' + lastDay.getUTCDate() + ', ' + lastDay.getUTCFullYear();
    var bStrike = ceilTo(btc * 1.15, 5000), eStrike = ceilTo(eth * 1.2, 250), gStrike = ceilTo(gold * 1.03, 50);
    var step = btc > 40000 ? 10000 : 5000, c = roundTo(btc, step);
    var DEMO = 'Demo rule: settled by hand with "Resolve (demo)". ';
    return [
      { id: 'house-26', cat: 'Politics', type: 'binary', b: 6000, close: 'Nov 3, 2026', p0: [0.55],
        q: 'Will Democrats win control of the US House in the 2026 midterm elections?',
        rule: 'Resolves YES if Democratic members hold a majority of seats in the House of Representatives after the 2026 general election results are certified.',
        source: 'Official results certified by state election authorities / Clerk of the House.' },
      { id: 'pres-28', cat: 'Politics', type: 'multi', b: 6000, close: 'Nov 7, 2028',
        q: 'Which party will win the 2028 US presidential election?',
        outcomes: ['Democratic Party', 'Republican Party', 'Any other party'], p0: [0.48, 0.49, 0.03],
        rule: 'Resolves to the party whose candidate receives a majority of Electoral College votes.',
        source: 'Electoral College results as certified by Congress.' },
      { id: 'fed-dec', cat: 'Economics', type: 'multi', b: 5000, close: 'Dec 2026 FOMC meeting',
        q: 'Fed decision at the December 2026 FOMC meeting',
        outcomes: ['Cut 50 bp or more', 'Cut 25 bp', 'No change', 'Hike'], p0: [0.08, 0.44, 0.45, 0.03],
        rule: 'Resolves to the change in the upper bound of the federal funds target range announced after the December 2026 meeting.',
        source: 'Federal Reserve FOMC statement.' },
      { id: 'cpi-dec', cat: 'Economics', type: 'range', b: 4000, close: 'Jan 2027 (BLS release)',
        q: 'US CPI inflation (YoY, NSA) for December 2026',
        outcomes: ['Below 2.5%', '2.5% – 3.0%', '3.0% – 3.5%', 'Above 3.5%'], p0: [0.15, 0.35, 0.32, 0.18],
        rule: 'Resolves to the bucket containing the 12-month change of CPI-U for December 2026, as first published. Bucket edges belong to the higher bucket.',
        source: 'U.S. Bureau of Labor Statistics, CPI news release.' },
      { id: 'rec-27', cat: 'Economics', type: 'binary', b: 5000, close: 'Dec 31, 2027', p0: [0.28],
        q: 'Will the US enter a recession that starts in 2027?',
        rule: 'Resolves YES if the NBER Business Cycle Dating Committee dates a business-cycle peak in 2027.',
        source: 'NBER Business Cycle Dating Committee announcements.' },
      { id: 'btc-above', cat: 'Crypto', type: 'binary', b: 6000, close: 'Dec 31, 2026', p0: [0.31],
        q: 'Will BTC trade above ' + usd0(bStrike) + ' on Dec 31, 2026?',
        rule: 'Resolves YES if the BTC/USDT last price is above ' + usd0(bStrike) + ' at 23:59 UTC on Dec 31, 2026.',
        source: 'Binance BTC/USDT spot market.' },
      { id: 'btc-range', cat: 'Crypto', type: 'range', b: 5000, close: 'Dec 31, 2026',
        q: 'BTC price on Dec 31, 2026 (23:59 UTC)',
        outcomes: ['Below ' + k(c - step), k(c - step) + ' – ' + k(c), k(c) + ' – ' + k(c + step), k(c + step) + ' – ' + k(c + 2 * step), 'Above ' + k(c + 2 * step)],
        p0: [0.18, 0.27, 0.27, 0.17, 0.11],
        rule: 'Resolves to the bucket containing the BTC/USDT last price at 23:59 UTC on Dec 31, 2026. Edges belong to the higher bucket.',
        source: 'Binance BTC/USDT spot market.' },
      { id: 'eth-above', cat: 'Crypto', type: 'binary', b: 5000, close: 'Dec 31, 2026', p0: [0.27],
        q: 'Will ETH close 2026 above ' + usd0(eStrike) + '?',
        rule: 'Resolves YES if the ETH/USDT daily candle of Dec 31, 2026 closes above ' + usd0(eStrike) + '.',
        source: 'Binance ETH/USDT spot market.' },
      { id: 'gold-month', cat: 'Commodities', type: 'binary', b: 5000, close: monthEnd, p0: [0.33],
        q: 'Will gold settle above ' + usd0(gStrike) + ' at the end of ' + monthName + '?',
        rule: 'Resolves YES if spot gold (XAU/USD) is above ' + usd0(gStrike) + ' per troy oz at the last fixing of ' + monthName + '.',
        source: 'LBMA Gold Price PM (reference), spot XAU/USD.' },
      { id: 'brent-range', cat: 'Commodities', type: 'range', b: 4000, close: 'Dec 31, 2026',
        q: 'Brent crude front-month settlement on Dec 31, 2026',
        outcomes: ['Below $95', '$95 – $105', '$105 – $115', '$115 – $125', 'Above $125'], p0: [0.14, 0.24, 0.30, 0.20, 0.12],
        rule: 'Resolves to the bucket containing the ICE Brent front-month settlement price on the last trading day of 2026.',
        source: 'ICE Futures Europe settlement prices.' },
      { id: 'wti-100', cat: 'Commodities', type: 'binary', b: 5000, close: 'Nov 30, 2026', p0: [0.47],
        q: 'Will WTI crude settle above $100 on Nov 30, 2026?',
        rule: 'Resolves YES if the NYMEX WTI front-month settlement on Nov 30, 2026 is above $100.00.',
        source: 'CME Group NYMEX settlements.' },
      { id: 'nba-27', cat: 'Sports', type: 'multi', b: 4000, close: 'Jun 2027',
        q: '2026–27 NBA Champion',
        outcomes: ['Oklahoma City Thunder', 'Boston Celtics', 'Denver Nuggets', 'New York Knicks', 'Cleveland Cavaliers', 'Any other team'],
        p0: [0.22, 0.14, 0.10, 0.10, 0.10, 0.34],
        rule: 'Resolves to the team that wins the 2027 NBA Finals.',
        source: 'NBA official results.' },
      { id: 'sb-afc', cat: 'Sports', type: 'binary', b: 5000, close: 'Feb 2027', p0: [0.50],
        q: 'Will an AFC team win Super Bowl LXI?',
        rule: 'Resolves YES if the winner of Super Bowl LXI is the AFC champion.',
        source: 'NFL official results.' },
      { id: 'nyc-snow', cat: 'Climate & Weather', type: 'range', b: 3000, close: 'Jan 1, 2027',
        q: 'Total December 2026 snowfall in Central Park, NYC',
        outcomes: ['Under 1 in', '1 – 4 in', '4 – 8 in', '8 – 12 in', 'Over 12 in'], p0: [0.30, 0.32, 0.20, 0.10, 0.08],
        rule: 'Resolves to the bucket containing the monthly snowfall total for Central Park in December 2026.',
        source: 'NOAA / National Weather Service monthly climate report (CLM).' },
      { id: 'warm-26', cat: 'Climate & Weather', type: 'binary', b: 4000, close: 'Jan 2027 (NASA release)', p0: [0.35],
        q: 'Will 2026 be the warmest year on record (NASA GISTEMP)?',
        rule: 'Resolves YES if NASA GISTEMP v4 ranks 2026 as the warmest calendar year in its record.',
        source: 'NASA GISS Surface Temperature Analysis (GISTEMP v4).' },
      { id: 'ai-top', cat: 'Tech', type: 'multi', b: 4000, close: 'Dec 31, 2026',
        q: 'Which lab will hold #1 on the LMArena text leaderboard on Dec 31, 2026?',
        outcomes: ['Google', 'OpenAI', 'Anthropic', 'xAI', 'Any other lab'], p0: [0.32, 0.30, 0.18, 0.10, 0.10],
        rule: 'Resolves to the organisation behind the top-ranked model (by score) on the LMArena text leaderboard at 23:59 UTC on Dec 31, 2026.',
        source: 'LMArena public leaderboard.' },
      { id: 'aapl-top', cat: 'Tech', type: 'binary', b: 5000, close: 'Dec 31, 2026', p0: [0.30],
        q: 'Will Apple be the world’s most valuable listed company on Dec 31, 2026?',
        rule: 'Resolves YES if Apple has the largest market capitalisation of any listed company at the Dec 31, 2026 close.',
        source: 'Exchange closing prices × shares outstanding.' }
    ].map(function (d) {
      if (d.type === 'binary') { d.outcomes = ['Yes', 'No']; d.p0 = [d.p0[0], 1 - d.p0[0]]; }
      d.rule = DEMO + d.rule;
      return d;
    });
  }

  function build(px) {
    return catalogue(px).map(function (d) {
      var m = { id: d.id, cat: d.cat, type: d.type, q: d.q, outcomes: d.outcomes, p0: d.p0, b: d.b,
                close: d.close, rule: d.rule, source: d.source, qv: E.lmsrInit(d.p0, d.b),
                status: 'open', winner: null, vol: 0, trades: 0, hist: [] };
      // simulated warm-up history (sample) ending at the starting odds
      var seed = 0; for (var i = 0; i < d.id.length; i++) seed = (seed * 31 + d.id.charCodeAt(i)) >>> 0;
      function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
      var q = m.qv.slice(), pts = [], t = Math.floor(Date.now() / 1000);
      for (var s = 0; s < 90; s++) {
        pts.push([t - s * 120, E.lmsrPrices(q, m.b)]);
        q = q.map(function (v) { return v + (rnd() - 0.5) * m.b * 0.06; });
      }
      m.hist = pts.reverse();
      m.hist[m.hist.length - 1] = [t, E.lmsrPrices(m.qv, m.b)];
      return m;
    });
  }

  /* ---------------- core ---------------- */
  function prices(m) { return E.lmsrPrices(m.qv, m.b); }
  function side(m, i, s) { return E.sidePrice(m.qv, m.b, i, s); }
  function mk(id) { for (var i = 0; i < S.pm.markets.length; i++) if (S.pm.markets[i].id === id) return S.pm.markets[i]; return null; }
  function hk(i, s) { return i + ':' + s; }
  function hold(m) { return S.pm.pos[m.id] || (S.pm.pos[m.id] = {}); }
  function label(m, i, s) { return m.type === 'binary' ? s.toUpperCase() : (s === 'yes' ? 'YES' : 'NO') + ' · ' + m.outcomes[i]; }

  function pushHist(m) {
    var t = Math.floor(Date.now() / 1000), last = m.hist[m.hist.length - 1];
    if (last && last[0] >= t) last[1] = prices(m); else m.hist.push([t, prices(m)]);
    if (m.hist.length > 400) m.hist.splice(0, m.hist.length - 400);
  }

  function execBuy(m, i, s, usd, who) {
    var x = E.lmsrSharesForSpend(m.qv, m.b, i, s, usd);
    m.qv = E.addVec(m.qv, i, s, x);
    m.vol += usd; m.trades++;
    if (who !== 'flow') { var h = hold(m), key = hk(i, s); h[key] = h[key] || { sh: 0, cost: 0 }; h[key].sh += x; h[key].cost += usd; }
    pushHist(m);
    return x;
  }
  function execSell(m, i, s, x) {
    var usd = E.lmsrSellProceeds(m.qv, m.b, i, s, x);
    m.qv = E.addVec(m.qv, i, s, -x);
    m.vol += usd; m.trades++;
    pushHist(m);
    return usd;
  }

  function validNum(v) { return typeof v === 'number' && isFinite(v) && v > 0; }

  function buy(m, i, s, usd) {
    if (m.status !== 'open') return 'This market is resolved.';
    if (!validNum(usd)) return 'Enter an amount greater than 0.';
    if (usd < 1) return 'Minimum order is $1.';
    if (usd > S.balance + 1e-9) return 'Insufficient paper balance (' + H.usd(S.balance) + ' available).';
    S.balance -= usd;
    var x = execBuy(m, i, s, usd);
    log('Buy', m, i, s, x, usd, null);
    checkOrders(m);
    return { shares: x, avg: usd / x };
  }

  function sell(m, i, s, x) {
    if (m.status !== 'open') return 'This market is resolved.';
    var h = hold(m), key = hk(i, s), cur = h[key];
    var have = cur ? cur.sh : 0;
    if (!validNum(x)) return 'Enter shares greater than 0.';
    if (x > have + 1e-6) return 'You hold only ' + have.toFixed(2) + ' shares.';
    x = Math.min(x, have);
    var basis = cur.cost * (x / have);
    var usd = execSell(m, i, s, x);
    cur.sh -= x; cur.cost -= basis;
    if (cur.sh < 1e-6) delete h[key];
    S.balance += usd;
    S.pmRealized = (S.pmRealized || 0) + (usd - basis);
    log('Sell', m, i, s, x, usd, usd - basis);
    checkOrders(m);
    return { usd: usd, avg: usd / x, pnl: usd - basis };
  }

  /* ---- limit orders (rest against the AMM, can fill partially) ---- */
  function placeLimit(m, i, s, dir, limit, amount) {
    if (m.status !== 'open') return 'This market is resolved.';
    if (!validNum(limit) || limit >= 1) return 'Limit price must be between 1¢ and 99¢.';
    if (limit < 0.01 || limit > 0.99) return 'Limit price must be between 1¢ and 99¢.';
    if (!validNum(amount)) return dir === 'buy' ? 'Enter an amount greater than 0.' : 'Enter shares greater than 0.';
    var o = { id: 'po' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), mid: m.id, i: i, s: s, dir: dir, limit: limit, rem: amount, filled: 0, created: Date.now() };
    if (dir === 'buy') {
      if (amount < 1) return 'Minimum order is $1.';
      if (amount > S.balance + 1e-9) return 'Insufficient paper balance (' + H.usd(S.balance) + ' available).';
      S.balance -= amount;
    } else {
      var h = hold(m), key = hk(i, s), cur = h[key], have = cur ? cur.sh : 0;
      if (amount > have + 1e-6) return 'You hold only ' + have.toFixed(2) + ' shares.';
      amount = Math.min(amount, have); o.rem = amount;
      o.basis = cur.cost * (amount / have);
      cur.sh -= amount; cur.cost -= o.basis;
      if (cur.sh < 1e-6) delete h[key];
    }
    S.pm.orders.push(o);
    log('Limit ' + dir, m, i, s, dir === 'sell' ? amount : null, dir === 'buy' ? amount : null, null, o.limit);
    checkOrders(m);
    return o;
  }

  function cancelOrder(id, quiet) {
    var idx = -1;
    S.pm.orders.forEach(function (o, j) { if (o.id === id) idx = j; });
    if (idx < 0) return;
    var o = S.pm.orders[idx], m = mk(o.mid);
    S.pm.orders.splice(idx, 1);
    if (o.dir === 'buy') S.balance += o.rem;
    else { var h = hold(m), key = hk(o.i, o.s); h[key] = h[key] || { sh: 0, cost: 0 }; h[key].sh += o.rem; h[key].cost += o.basis; }
    if (!quiet) log('Cancel', m, o.i, o.s, o.dir === 'sell' ? o.rem : null, o.dir === 'buy' ? o.rem : null, null, o.limit);
  }

  function checkOrders(m) {
    var fills = [];
    S.pm.orders.slice().forEach(function (o) {
      if (o.mid !== m.id || m.status !== 'open') return;
      var p = side(m, o.i, o.s);
      if (o.dir === 'buy' && p <= o.limit + 1e-12) {
        var cap = E.lmsrSharesForSpend(m.qv, m.b, o.i, o.s, o.rem);
        var x = E.lmsrSharesToLimit(m.qv, m.b, o.i, o.s, 'buy', o.limit, cap);
        if (x <= 1e-6) return;
        var cost = Math.min(o.rem, E.lmsrBuyCost(m.qv, m.b, o.i, o.s, x));
        var got = execBuy(m, o.i, o.s, cost);
        o.rem -= cost; o.filled += got;
        fills.push({ o: o, sh: got, usd: cost });
        log('Limit fill', m, o.i, o.s, got, cost, null, o.limit);
        if (o.rem < 0.01) { S.balance += Math.max(0, o.rem); removeOrder(o.id); }
      } else if (o.dir === 'sell' && p >= o.limit - 1e-12) {
        var xs = E.lmsrSharesToLimit(m.qv, m.b, o.i, o.s, 'sell', o.limit, o.rem);
        if (xs <= 1e-6) return;
        var usd = execSell(m, o.i, o.s, xs);
        var basis = o.basis * (xs / o.rem);
        o.basis -= basis; o.rem -= xs; o.filled += xs;
        S.balance += usd; S.pmRealized = (S.pmRealized || 0) + (usd - basis);
        fills.push({ o: o, sh: xs, usd: usd });
        log('Limit fill', m, o.i, o.s, xs, usd, usd - basis, o.limit);
        if (o.rem < 1e-4) removeOrder(o.id);
      }
    });
    fills.forEach(function (f) { H.toast('Limit order filled', f.sh.toFixed(2) + ' ' + label(m, f.o.i, f.o.s) + ' @ ≤' + cents(f.o.limit), 'ok'); });
    return fills.length;
  }
  function removeOrder(id) { S.pm.orders = S.pm.orders.filter(function (o) { return o.id !== id; }); }

  function resolve(m, w) {
    if (m.status !== 'open') return null;
    S.pm.orders.filter(function (o) { return o.mid === m.id; }).forEach(function (o) { cancelOrder(o.id, true); });
    var h = hold(m), payout = 0, basis = 0;
    Object.keys(h).forEach(function (key) {
      var parts = key.split(':'), i = +parts[0], s = parts[1];
      payout += E.payout(i, s, h[key].sh, w); basis += h[key].cost;
    });
    S.balance += payout;
    S.pmRealized = (S.pmRealized || 0) + (payout - basis);
    m.status = 'resolved'; m.winner = w;
    m.settled = { payout: payout, pnl: payout - basis, had: Object.keys(h).length > 0 };
    delete S.pm.pos[m.id];
    var t = Math.floor(Date.now() / 1000), last = m.hist[m.hist.length - 1];
    var fin = m.outcomes.map(function (_, j) { return j === w ? 1 : 0; });
    if (last && last[0] >= t) last[1] = fin; else m.hist.push([t, fin]);
    log('Resolved', m, w, 'yes', null, payout, payout - basis);
    return m.settled;
  }

  function log(kind, m, i, s, sh, usd, pnl, limit) {
    S.pm.hist.unshift({ t: Date.now(), kind: kind, mid: m.id, q: m.q, what: kind === 'Resolved' ? m.outcomes[i] : label(m, i, s), sh: sh, usd: usd, pnl: pnl, limit: limit });
    if (S.pm.hist.length > 150) S.pm.hist.length = 150;
  }

  /* simulated order flow from other paper traders */
  function flow() {
    if (!S || !S.pm) return;
    var open = S.pm.markets.filter(function (m) { return m.status === 'open'; });
    if (!open.length) return;
    var m = open[Math.floor(Math.random() * open.length)];
    var n = m.type === 'binary' ? 1 : m.outcomes.length;
    var i = Math.floor(Math.random() * n), p = prices(m)[i];
    var s = Math.random() < 0.5 + 1.2 * (m.p0[i] - p) ? 'yes' : 'no';
    execBuy(m, i, s, 10 + Math.pow(Math.random(), 2) * 380, 'flow');
    var filled = checkOrders(m);
    refreshMarket(m, true);
    H.changed(filled > 0);
  }

  /* ---------------- value / PnL ---------------- */
  function holdingsValue() {
    var v = 0;
    if (!S || !S.pm) return 0;
    S.pm.markets.forEach(function (m) {
      var h = S.pm.pos[m.id]; if (!h) return;
      Object.keys(h).forEach(function (key) { var p = key.split(':'); v += h[key].sh * side(m, +p[0], p[1]); });
    });
    S.pm.orders.forEach(function (o) { var m = mk(o.mid); if (!m) return; v += o.dir === 'buy' ? o.rem : o.rem * side(m, o.i, o.s); });
    return v;
  }
  function unrealized() {
    var u = 0;
    if (!S || !S.pm) return 0;
    S.pm.markets.forEach(function (m) {
      var h = S.pm.pos[m.id]; if (!h) return;
      Object.keys(h).forEach(function (key) { var p = key.split(':'); u += h[key].sh * side(m, +p[0], p[1]) - h[key].cost; });
    });
    S.pm.orders.forEach(function (o) { var m = mk(o.mid); if (m && o.dir === 'sell') u += o.rem * side(m, o.i, o.s) - o.basis; });
    return u;
  }

  /* ---------------- rendering: grid ---------------- */
  var el = {}, filter = 'All', detail = null, dchart = null, dseries = [];

  function typeTag(m) { return { binary: 'Yes / No', multi: 'Multi-outcome', range: 'Range' }[m.type]; }

  function spark(m) {
    var pts = m.hist; if (pts.length < 2) return '';
    var w = 300, h = 48, t0 = pts[0][0], t1 = pts[pts.length - 1][0];
    var d = pts.map(function (pt, j) {
      var x = ((pt[0] - t0) / Math.max(1, t1 - t0)) * w, y = h - 3 - pt[1][0] * (h - 6);
      return (j ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    var up = pts[pts.length - 1][1][0] >= pts[0][1][0];
    return '<svg class="spark ' + (up ? 'up' : 'down') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + ' L ' + w + ' ' + h + ' L 0 ' + h + ' Z" class="spark-fill"/><path d="' + d + '" class="spark-line"/></svg>';
  }

  function heldBadge(m) {
    var h = S.pm.pos[m.id]; if (!h) return '';
    var keys = Object.keys(h); if (!keys.length) return '';
    var u = 0; keys.forEach(function (key) { var p = key.split(':'); u += h[key].sh * side(m, +p[0], p[1]) - h[key].cost; });
    return '<span class="pm-heldtag">Position <b class="mono ' + (u >= 0 ? 'up' : 'down') + '">' + H.signed(u) + '</b></span>';
  }

  function cardHtml(m) {
    var pr = prices(m), res = m.status !== 'open';
    var top = '<div class="pm-top"><span class="pm-cat">' + m.cat + '</span><span class="pm-type">' + typeTag(m) + '</span><span class="pill pill-sim">Sample</span></div>' +
      '<h3 class="pm-q"><button class="pm-open" data-pm="open" data-m="' + m.id + '">' + esc(m.q) + '</button></h3>';
    var body;
    if (m.type === 'binary') {
      var ch = pr[0] - m.hist[Math.max(0, m.hist.length - 30)][1][0];
      body = '<div class="pm-prob"><div class="pm-prob-v mono">' + (res ? (m.winner === 0 ? 'YES' : 'NO') : Math.round(pr[0] * 100) + '<small>%</small>') + '</div>' +
        '<div class="pm-prob-k">' + (res ? 'Resolved (demo)' : 'chance · <span class="mono ' + (ch >= 0 ? 'up' : 'down') + '">' + (ch >= 0 ? '+' : '') + (ch * 100).toFixed(1) + 'pt</span>') + '</div></div>' +
        '<div class="pm-chart">' + spark(m) + '</div>' +
        (res ? '' : '<div class="pm-btns"><button class="pm-btn yes" data-pm="trade" data-m="' + m.id + '" data-i="0" data-s="yes">Yes <span class="mono">' + cents(pr[0]) + '</span></button>' +
          '<button class="pm-btn no" data-pm="trade" data-m="' + m.id + '" data-i="0" data-s="no">No <span class="mono">' + cents(1 - pr[0]) + '</span></button></div>');
    } else {
      var order = pr.map(function (p, j) { return j; });
      if (m.type === 'multi') order.sort(function (a, b) { return pr[b] - pr[a]; });
      var shown = order.slice(0, 4);
      body = '<ul class="pm-outs">' + shown.map(function (j) {
        var win = res && m.winner === j;
        return '<li class="' + (res && !win ? 'lost' : '') + '"><span class="po-l">' + (win ? '✓ ' : '') + esc(m.outcomes[j]) + '</span>' +
          '<span class="po-bar"><i style="width:' + (pr[j] * 100).toFixed(1) + '%"></i></span><span class="po-p mono">' + Math.round(pr[j] * 100) + '%</span>' +
          (res ? '' : '<button class="po-yes mono" data-pm="trade" data-m="' + m.id + '" data-i="' + j + '" data-s="yes" title="Buy YES on ' + esc(m.outcomes[j]) + '">' + cents(pr[j]) + '</button>') + '</li>';
      }).join('') + '</ul>' + (pr.length > 4 ? '<button class="linkbtn more" data-pm="open" data-m="' + m.id + '">+' + (pr.length - 4) + ' more outcomes</button>' : '');
    }
    var foot = (res ? '<div class="pm-resolved">Settled: <b>' + esc(m.outcomes[m.winner]) + '</b>' + (m.settled && m.settled.had ? ' · you received ' + H.usd(m.settled.payout) + ' (' + H.signed(m.settled.pnl) + ')' : '') + '</div>' : '') +
      '<div class="pm-meta"><span>Vol ' + usd0(m.vol) + '</span><span>Liq. b=' + m.b.toLocaleString('en-US') + '</span><span>Closes ' + esc(m.close) + '</span>' + heldBadge(m) + '</div>';
    return top + body + foot;
  }

  function renderGrid() {
    if (!S.pm) { el.grid.innerHTML = '<div class="empty">Loading sample markets…</div>'; return; }
    var list = S.pm.markets.filter(function (m) { return filter === 'All' || m.cat === filter; });
    el.grid.innerHTML = list.map(function (m) { return '<article class="panel pm-card' + (m.status !== 'open' ? ' is-resolved' : '') + '" data-card="' + m.id + '">' + cardHtml(m) + '</article>'; }).join('') ||
      '<div class="empty">No markets in this category.</div>';
    el.cats.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.cat === filter); });
  }

  function refreshMarket(m, flash) {
    if (detail && detail.m === m) { renderDetail(true); return; }
    var c = el.grid.querySelector('[data-card="' + m.id + '"]');
    if (!c) return;
    c.innerHTML = cardHtml(m);
    c.classList.toggle('is-resolved', m.status !== 'open');
    if (flash) { c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); }
  }

  function renderSide() {
    var rows = [];
    if (!S.pm) return;
    S.pm.markets.forEach(function (m) {
      var h = S.pm.pos[m.id]; if (!h) return;
      Object.keys(h).forEach(function (key) {
        var p = key.split(':'), i = +p[0], s = p[1], c = h[key], pr = side(m, i, s), val = c.sh * pr, pnl = val - c.cost;
        rows.push('<div class="pmp"><button class="pmp-q" data-pm="open" data-m="' + m.id + '">' + esc(m.q) + '</button>' +
          '<div class="pmp-row"><b class="' + s + '">' + c.sh.toFixed(2) + ' ' + esc(label(m, i, s)) + '</b><span class="mono ' + (pnl >= 0 ? 'up' : 'down') + '">' + H.signed(pnl) + '</span></div>' +
          '<div class="pmp-row sub"><span class="mono">avg ' + cents(c.cost / c.sh) + ' → ' + cents(pr) + ' · value ' + H.usd(val) + '</span>' +
          '<button class="linkbtn" data-pm="trade" data-m="' + m.id + '" data-i="' + i + '" data-s="' + s + '" data-dir="sell">Sell</button></div></div>');
      });
    });
    el.pos.innerHTML = rows.join('') || '<div class="empty">No shares yet. Open a market and buy YES or NO.</div>';
    el.ord.innerHTML = S.pm.orders.map(function (o) {
      var m = mk(o.mid);
      return '<div class="pmo"><div class="pmo-l"><b class="' + o.s + '">' + (o.dir === 'buy' ? 'Buy ' : 'Sell ') + esc(label(m, o.i, o.s)) + '</b><span class="muted">' + esc(m.q) + '</span></div>' +
        '<span class="mono">' + (o.dir === 'buy' ? '≤' : '≥') + (o.limit * 100).toFixed(1) + '¢ · ' + (o.dir === 'buy' ? H.usd(o.rem) : o.rem.toFixed(2) + ' sh') + '</span>' +
        '<button class="linkbtn" data-pm="cancel" data-o="' + o.id + '">Cancel</button></div>';
    }).join('') || '<div class="empty">No open limit orders.</div>';
    el.hist.innerHTML = S.pm.hist.slice(0, 40).map(function (h) {
      return '<div class="pmh"><span class="pmh-k">' + esc(h.kind) + '</span><span class="pmh-q">' + esc(h.what) + ' — ' + esc(h.q) + '</span>' +
        '<span class="mono">' + (h.sh != null ? h.sh.toFixed(2) + ' sh' : '') + (h.sh != null && h.usd != null ? ' · ' : '') + (h.usd != null ? H.usd(h.usd) : '') + (h.limit ? ' @' + cents(h.limit) : '') +
        (h.pnl != null ? ' · <span class="' + (h.pnl >= 0 ? 'up' : 'down') + '">' + H.signed(h.pnl) + '</span>' : '') + '</span>' +
        '<span class="pmh-t">' + new Date(h.t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</span></div>';
    }).join('') || '<div class="empty">Your prediction trades will appear here.</div>';
    el.sum.innerHTML = '<div><dt>Shares value</dt><dd class="mono">' + H.usd(holdingsValue()) + '</dd></div>' +
      '<div><dt>Unrealized</dt><dd class="mono ' + (unrealized() >= 0 ? 'up' : 'down') + '">' + H.signed(unrealized()) + '</dd></div>' +
      '<div><dt>Realized</dt><dd class="mono ' + ((S.pmRealized || 0) >= 0 ? 'up' : 'down') + '">' + H.signed(S.pmRealized || 0) + '</dd></div>';
  }

  /* ---------------- rendering: market detail ---------------- */
  function openDetail(m, i, s, dir) {
    var keep = detail && detail.m === m ? detail : null;
    detail = { m: m, i: i != null ? i : (keep ? keep.i : 0), s: s || (keep ? keep.s : 'yes'), dir: dir || 'buy', type: 'market', amt: '100', lim: '' };
    if (m.type === 'binary') detail.i = 0;
    el.list.hidden = true; el.detail.hidden = false;
    renderDetail(false);
    try { el.detail.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } catch (e) {}
  }
  function closeDetail() {
    if (dchart) { try { dchart.remove(); } catch (e) {} dchart = null; dseries = []; }
    detail = null; el.detail.hidden = true; el.list.hidden = false; renderGrid();
  }

  function bookFor(m, i, s) {
    // implied depth of the AMM curve: shares between 1¢ price levels
    var p = side(m, i, s), asks = [], bids = [], lvl, prev, x;
    var q = m.qv;
    lvl = Math.min(0.99, Math.ceil(p * 100 + 1e-9) / 100); prev = 0;
    for (var a = 0; a < 6 && lvl <= 0.99; a++, lvl = Math.round((lvl + 0.01) * 100) / 100) {
      x = E.lmsrSharesToLimit(q, m.b, i, s, 'buy', lvl, 1e7); asks.push([lvl, Math.max(0, x - prev)]); prev = x;
    }
    lvl = Math.max(0.01, Math.floor(p * 100 - 1e-9) / 100); prev = 0;
    for (var b = 0; b < 6 && lvl >= 0.01; b++, lvl = Math.round((lvl - 0.01) * 100) / 100) {
      x = E.lmsrSharesToLimit(q, m.b, i, s, 'sell', lvl, 1e7); bids.push([lvl, Math.max(0, x - prev)]); prev = x;
    }
    var mine = {};
    S.pm.orders.forEach(function (o) { if (o.mid === m.id && o.i === i && o.s === s) mine[(o.dir === 'buy' ? 'b' : 'a') + o.limit.toFixed(2)] = true; });
    return { asks: asks, bids: bids, mine: mine, mid: p };
  }

  function renderBook(m) {
    var bk = bookFor(m, detail.i, detail.s);
    var max = 1; bk.asks.concat(bk.bids).forEach(function (r) { max = Math.max(max, r[1]); });
    function row(r, cls, key) {
      return '<div class="bk-row ' + cls + (bk.mine[key + r[0].toFixed(2)] ? ' mine' : '') + '"><i style="width:' + (r[1] / max * 100).toFixed(1) + '%"></i><span class="mono">' + (r[0] * 100).toFixed(0) + '¢</span><span class="mono">' + r[1].toLocaleString('en-US', { maximumFractionDigits: 0 }) + '</span><span class="mono">' + H.usd(r[0] * r[1]) + '</span></div>';
    }
    return '<div class="panel-title">Order book · ' + esc(label(m, detail.i, detail.s)) + ' <span class="tag">AMM depth</span></div>' +
      '<div class="book-cols"><span>Price</span><span>Shares</span><span>Total</span></div>' +
      '<div class="bk asks">' + bk.asks.slice().reverse().map(function (r) { return row(r, 'ask', 'b'); }).join('') + '</div>' +
      '<div class="book-mid"><span class="mono">' + cents(bk.mid) + '</span><span class="book-spread">last · implied ' + (bk.mid * 100).toFixed(1) + '%</span></div>' +
      '<div class="bk bids">' + bk.bids.map(function (r) { return row(r, 'bid', 'a'); }).join('') + '</div>' +
      '<p class="fine">Liquidity comes from the LMSR market maker; each row is the number of shares that moves the price by 1¢. Your resting limit orders are highlighted.</p>';
  }

  function quoteHtml(m) {
    var d = detail, i = d.i, s = d.s, p = side(m, i, s), h = hold(m)[hk(i, s)], have = h ? h.sh : 0;
    var v = parseFloat(d.amt), out = '', err = '';
    if (d.type === 'limit') {
      var L = parseFloat(d.lim) / 100;
      if (!(L > 0)) return { html: '', err: d.lim === '' ? '' : 'Enter a limit price between 1 and 99¢.' };
      if (L < 0.01 || L > 0.99) return { html: '', err: 'Limit price must be between 1¢ and 99¢.' };
      if (!(v > 0)) return { html: '', err: d.amt === '' ? '' : (d.dir === 'buy' ? 'Enter an amount greater than 0.' : 'Enter shares greater than 0.') };
      var now = d.dir === 'buy' ? p <= L : p >= L;
      out = '<div><dt>Limit</dt><dd class="mono">' + (d.dir === 'buy' ? '≤ ' : '≥ ') + (L * 100).toFixed(1) + '¢</dd></div>' +
        '<div><dt>' + (d.dir === 'buy' ? 'Max shares' : 'Min proceeds') + '</dt><dd class="mono">' + (d.dir === 'buy' ? (v / L).toFixed(2) : H.usd(v * L)) + '</dd></div>' +
        '<div><dt>Status</dt><dd>' + (now ? 'Fills now (partly or fully)' : 'Rests until price reaches it') + '</dd></div>';
      if (d.dir === 'buy' && v > S.balance) err = 'Insufficient paper balance.';
      if (d.dir === 'buy' && v > 0 && v < 1) err = 'Minimum order is $1.';
      if (d.dir === 'sell' && v > have + 1e-6) err = 'You hold only ' + have.toFixed(2) + ' shares.';
      return { html: out, err: err };
    }
    if (!(v > 0)) return { html: '', err: d.amt === '' ? '' : (d.dir === 'buy' ? 'Enter an amount greater than 0.' : 'Enter shares greater than 0.') };
    if (d.dir === 'buy') {
      if (v > S.balance + 1e-9) return { html: '', err: 'Insufficient paper balance (' + H.usd(S.balance) + ' available).' };
      if (v < 1) return { html: '', err: 'Minimum order is $1.' };
      var x = E.lmsrSharesForSpend(m.qv, m.b, i, s, v), np = E.sidePrice(E.addVec(m.qv, i, s, x), m.b, i, s);
      out = '<div><dt>Shares</dt><dd class="mono">' + x.toFixed(2) + '</dd></div>' +
        '<div><dt>Avg price</dt><dd class="mono">' + cents(v / x) + '</dd></div>' +
        '<div><dt>Price impact</dt><dd class="mono">' + cents(p) + ' → ' + cents(np) + '</dd></div>' +
        '<div class="liqrow"><dt>Pays if right</dt><dd class="mono up">' + H.usd(x) + ' (' + H.signed(x - v) + ')</dd></div>';
      if (v > S.balance + 1e-9) err = 'Insufficient paper balance (' + H.usd(S.balance) + ' available).';
      else if (v < 1) err = 'Minimum order is $1.';
    } else {
      var xs = Math.min(v, have), usd = xs > 0 ? E.lmsrSellProceeds(m.qv, m.b, i, s, xs) : 0;
      out = '<div><dt>You receive</dt><dd class="mono">' + H.usd(usd) + '</dd></div>' +
        '<div><dt>Avg price</dt><dd class="mono">' + (xs > 0 ? cents(usd / xs) : '—') + '</dd></div>' +
        '<div><dt>Realized PnL</dt><dd class="mono">' + (xs > 0 && h ? H.signed(usd - h.cost * xs / have) : '—') + '</dd></div>';
      if (v > have + 1e-6) err = have > 0 ? 'You hold only ' + have.toFixed(2) + ' shares.' : 'You have no ' + label(m, i, s) + ' shares to sell.';
    }
    return { html: out, err: err };
  }

  function renderDetail(soft) {
    var m = detail.m, pr = prices(m), res = m.status !== 'open', d = detail;
    if (soft) {
      // live refresh without rebuilding inputs
      var oc = el.detail.querySelector('#pdOutcomes'); if (oc) oc.innerHTML = outcomesHtml(m);
      var bk = el.detail.querySelector('#pdBook'); if (bk) bk.innerHTML = renderBook(m);
      var info = el.detail.querySelector('#pdInfo'); if (info) info.innerHTML = infoHtml(m);
      var you = el.detail.querySelector('#pdYou'); if (you) you.innerHTML = youHtml(m);
      updQuote(); updChart(m); updTicketPrices(m);
      return;
    }
    el.detail.innerHTML =
      '<button class="btn-ghost sm back" data-pm="back">← All markets</button>' +
      '<div class="pd">' +
        '<section class="panel pd-main">' +
          '<div class="pm-top"><span class="pm-cat">' + m.cat + '</span><span class="pm-type">' + typeTag(m) + '</span><span class="pill pill-sim">Sample market</span></div>' +
          '<h2 class="pd-q">' + esc(m.q) + '</h2>' +
          '<div id="pdInfo">' + infoHtml(m) + '</div>' +
          '<div class="pd-chart" id="pdChart"></div>' +
          '<div class="pd-legend" id="pdLegend"></div>' +
          '<div class="table-scroll"><table class="tbl pd-out"><thead><tr><th>Outcome</th><th>Chance</th><th>Buy YES</th><th>Buy NO</th></tr></thead><tbody id="pdOutcomes">' + outcomesHtml(m) + '</tbody></table></div>' +
          '<div class="pd-rules"><h4>Resolution rules</h4><p>' + esc(m.rule) + '</p><h4>Resolution source</h4><p>' + esc(m.source) + ' <span class="muted">(reference only — this sample market is not connected to it)</span></p>' +
          (res ? '' : '<button class="btn-ghost sm" data-pm="resolve" data-m="' + m.id + '">Resolve (demo)…</button>') + '</div>' +
        '</section>' +
        '<aside class="pd-side">' +
          '<section class="panel ticket pd-ticket" id="pdTicket">' + ticketHtml(m) + '</section>' +
          '<section class="panel" id="pdYou">' + youHtml(m) + '</section>' +
          '<section class="panel book pd-book" id="pdBook">' + renderBook(m) + '</section>' +
        '</aside>' +
      '</div>';
    bindTicket(m);
    buildChart(m);
    updQuote();
  }

  function infoHtml(m) {
    var res = m.status !== 'open';
    return '<dl class="pd-stats"><div><dt>Volume</dt><dd class="mono">' + usd0(m.vol) + '</dd></div><div><dt>Trades</dt><dd class="mono">' + m.trades + '</dd></div>' +
      '<div><dt>Liquidity (b)</dt><dd class="mono">' + m.b.toLocaleString('en-US') + '</dd></div><div><dt>Max MM loss</dt><dd class="mono">' + H.usd(E.lmsrMaxLoss(m.b, m.outcomes.length)) + '</dd></div>' +
      '<div><dt>Closes</dt><dd>' + esc(m.close) + '</dd></div><div><dt>Status</dt><dd>' + (res ? 'Resolved: <b>' + esc(m.outcomes[m.winner]) + '</b>' : '<span class="up">Open</span>') + '</dd></div></dl>';
  }

  function outcomesHtml(m) {
    var pr = prices(m), res = m.status !== 'open';
    var n = m.type === 'binary' ? 1 : m.outcomes.length, out = '';
    for (var j = 0; j < n; j++) {
      var nm = m.type === 'binary' ? 'Yes' : m.outcomes[j];
      out += '<tr' + (detail && detail.i === j ? ' class="sel"' : '') + '><td><span class="sw" style="background:' + COLORS[j % COLORS.length] + '"></span>' + esc(nm) + (res && m.winner === j ? ' <b class="up">✓ won</b>' : '') + '</td>' +
        '<td class="mono">' + (pr[j] * 100).toFixed(1) + '%</td>' +
        '<td>' + (res ? '—' : '<button class="pm-btn yes sm" data-pm="pick" data-i="' + j + '" data-s="yes">' + cents(pr[j]) + '</button>') + '</td>' +
        '<td>' + (res ? '—' : '<button class="pm-btn no sm" data-pm="pick" data-i="' + j + '" data-s="no">' + cents(1 - pr[j]) + '</button>') + '</td></tr>';
    }
    return out;
  }

  function youHtml(m) {
    var h = S.pm.pos[m.id], rows = '';
    if (h) Object.keys(h).forEach(function (key) {
      var p = key.split(':'), i = +p[0], s = p[1], c = h[key], v = c.sh * side(m, i, s), pnl = v - c.cost;
      rows += '<tr><td><b class="' + s + '">' + esc(label(m, i, s)) + '</b></td><td class="mono">' + c.sh.toFixed(2) + '</td><td class="mono">' + cents(c.cost / c.sh) + '</td><td class="mono">' + H.usd(v) + '</td><td class="mono ' + (pnl >= 0 ? 'up' : 'down') + '">' + H.signed(pnl) + '</td></tr>';
    });
    var ords = S.pm.orders.filter(function (o) { return o.mid === m.id; }).map(function (o) {
      return '<tr><td><b class="' + o.s + '">' + (o.dir === 'buy' ? 'Buy ' : 'Sell ') + esc(label(m, o.i, o.s)) + '</b></td><td class="mono">' + (o.dir === 'buy' ? '≤' : '≥') + (o.limit * 100).toFixed(1) + '¢</td><td class="mono" colspan="2">' + (o.dir === 'buy' ? H.usd(o.rem) + ' left' : o.rem.toFixed(2) + ' sh left') + (o.filled ? ' · filled ' + o.filled.toFixed(2) + ' sh' : '') + '</td><td><button class="linkbtn" data-pm="cancel" data-o="' + o.id + '">Cancel</button></td></tr>';
    }).join('');
    var settled = m.status !== 'open' && m.settled && m.settled.had ? '<p class="fine">Settled: paid ' + H.usd(m.settled.payout) + ' · PnL ' + H.signed(m.settled.pnl) + '</p>' : '';
    return '<div class="panel-title">Your position</div>' + settled +
      (rows ? '<div class="table-scroll"><table class="tbl"><thead><tr><th>Side</th><th>Shares</th><th>Avg</th><th>Value</th><th>PnL</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty">No shares in this market.</div>') +
      (ords ? '<div class="panel-title mt">Open limit orders</div><div class="table-scroll"><table class="tbl"><tbody>' + ords + '</tbody></table></div>' : '');
  }

  function ticketHtml(m) {
    var d = detail, res = m.status !== 'open';
    if (res) return '<div class="panel-title">Trading closed</div><p class="fine">This sample market was resolved (demo) to <b>' + esc(m.outcomes[m.winner]) + '</b>.</p>';
    var multi = m.type !== 'binary';
    return '<div class="panel-title">Trade</div>' +
      (multi ? '<div class="field"><label for="ptOut">Outcome</label><select id="ptOut" class="select">' + m.outcomes.map(function (o, j) { return '<option value="' + j + '"' + (j === d.i ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="seg seg-side" id="ptSide"><button class="seg-btn long' + (d.s === 'yes' ? ' is-active' : '') + '" data-s="yes">Yes <span class="mono" id="ptPy"></span></button><button class="seg-btn short' + (d.s === 'no' ? ' is-active' : '') + '" data-s="no">No <span class="mono" id="ptPn"></span></button></div>' +
      '<div class="pt-row"><div class="seg seg-sm" id="ptDir"><button class="seg-btn' + (d.dir === 'buy' ? ' is-active' : '') + '" data-dir="buy">Buy</button><button class="seg-btn' + (d.dir === 'sell' ? ' is-active' : '') + '" data-dir="sell">Sell</button></div>' +
      '<div class="seg seg-sm" id="ptType"><button class="seg-btn' + (d.type === 'market' ? ' is-active' : '') + '" data-type="market">Market</button><button class="seg-btn' + (d.type === 'limit' ? ' is-active' : '') + '" data-type="limit">Limit</button></div></div>' +
      '<div class="field"' + (d.type === 'limit' ? '' : ' hidden') + ' id="ptLimF"><label for="ptLim">Limit price</label><div class="input"><input id="ptLim" class="mono" inputmode="decimal" autocomplete="off" value="' + esc(d.lim) + '" placeholder="1 – 99"><span class="unit">¢</span></div></div>' +
      '<div class="field"><label for="ptAmt" id="ptAmtL">' + (d.dir === 'buy' ? 'Amount' : 'Shares') + '</label><div class="input"><input id="ptAmt" class="mono" inputmode="decimal" autocomplete="off" value="' + esc(d.amt) + '"><span class="unit" id="ptUnit">' + (d.dir === 'buy' ? 'USD' : 'shares') + '</span></div>' +
      '<div class="chips" id="ptChips"></div></div>' +
      '<dl class="summary" id="ptSum"></dl><div class="ticket-err" id="ptErr" role="alert"></div>' +
      '<button class="btn-submit ' + (d.s === 'yes' ? 'long' : 'short') + '" id="ptGo"></button>' +
      '<p class="fine">No fees. Shares pay $1.00 if right, $0 if wrong. Paper balance ' + '<span class="mono" id="ptBal"></span>.</p>';
  }

  function updTicketPrices(m) {
    var py = document.getElementById('ptPy'), pn = document.getElementById('ptPn');
    if (py) py.textContent = cents(side(m, detail.i, 'yes'));
    if (pn) pn.textContent = cents(side(m, detail.i, 'no'));
    var bal = document.getElementById('ptBal'); if (bal) bal.textContent = H.usd(S.balance);
  }

  function updQuote() {
    if (!detail) return;
    var m = detail.m, sum = document.getElementById('ptSum'); if (!sum) return;
    var q = quoteHtml(m);
    sum.innerHTML = q.html;
    document.getElementById('ptErr').textContent = q.err;
    var go = document.getElementById('ptGo');
    go.textContent = (detail.type === 'limit' ? 'Place limit ' : '') + (detail.dir === 'buy' ? 'Buy ' : 'Sell ') + label(m, detail.i, detail.s);
    go.disabled = !!q.err || !q.html;
    var chips = document.getElementById('ptChips');
    var have = (hold(m)[hk(detail.i, detail.s)] || { sh: 0 }).sh;
    var want = detail.dir === 'buy' ? '<button data-q="10">$10</button><button data-q="100">$100</button><button data-q="1000">$1k</button><button data-q="max">Max</button>'
      : '<button data-f="0.25"' + (have ? '' : ' disabled') + '>25%</button><button data-f="0.5"' + (have ? '' : ' disabled') + '>50%</button><button data-f="1"' + (have ? '' : ' disabled') + '>All</button>';
    if (chips.dataset.k !== detail.dir + have.toFixed(4)) { chips.innerHTML = want; chips.dataset.k = detail.dir + have.toFixed(4); }
    updTicketPrices(m);
  }

  var busy = false;
  function bindTicket(m) {
    var t = document.getElementById('pdTicket'); if (!t || m.status !== 'open') return;
    var amt = document.getElementById('ptAmt'), lim = document.getElementById('ptLim'), out = document.getElementById('ptOut');
    amt.addEventListener('input', function () { detail.amt = amt.value.trim(); updQuote(); });
    lim.addEventListener('input', function () { detail.lim = lim.value.trim(); updQuote(); });
    if (out) out.addEventListener('change', function () { detail.i = +out.value; renderDetail(false); });
    t.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.s) { detail.s = b.dataset.s; renderDetail(false); return; }
      if (b.dataset.dir) { detail.dir = b.dataset.dir; if (detail.dir === 'sell') { var hv = hold(m)[hk(detail.i, detail.s)]; detail.amt = hv ? String(+hv.sh.toFixed(2)) : ''; } else detail.amt = '100'; renderDetail(false); return; }
      if (b.dataset.type) { detail.type = b.dataset.type; if (detail.type === 'limit' && !detail.lim) detail.lim = String(Math.max(1, Math.min(99, Math.round(side(m, detail.i, detail.s) * 100) + (detail.dir === 'buy' ? -2 : 2)))); renderDetail(false); return; }
      if (b.dataset.q) { amt.value = b.dataset.q === 'max' ? String(Math.floor(S.balance * 100) / 100) : b.dataset.q; detail.amt = amt.value; updQuote(); return; }
      if (b.dataset.f) { var h = hold(m)[hk(detail.i, detail.s)]; var hv2 = h ? h.sh : 0; amt.value = b.dataset.f === '1' ? String(hv2) : (Math.floor(hv2 * +b.dataset.f * 100) / 100).toFixed(2); detail.amt = amt.value; updQuote(); return; }
      if (b.id === 'ptGo') submit(m);
    });
    amt.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(m); });
  }

  function submit(m) {
    if (busy) return;                  // guards against double clicks
    busy = true; setTimeout(function () { busy = false; }, 350);
    var d = detail, v = parseFloat(d.amt), r;
    if (d.type === 'limit') {
      r = placeLimit(m, d.i, d.s, d.dir, parseFloat(d.lim) / 100, v);
      if (typeof r === 'string') { document.getElementById('ptErr').textContent = r; return; }
      H.toast('Limit order placed', (d.dir === 'buy' ? 'Buy ' : 'Sell ') + label(m, d.i, d.s) + ' @ ' + parseFloat(d.lim).toFixed(1) + '¢' + (r.filled ? ' · filled ' + r.filled.toFixed(2) + ' sh so far' : ''), 'ok');
    } else if (d.dir === 'buy') {
      r = buy(m, d.i, d.s, v);
      if (typeof r === 'string') { document.getElementById('ptErr').textContent = r; return; }
      H.toast('Bought ' + r.shares.toFixed(2) + ' ' + label(m, d.i, d.s), 'avg ' + cents(r.avg) + ' · ' + m.q, 'ok');
    } else {
      r = sell(m, d.i, d.s, v);
      if (typeof r === 'string') { document.getElementById('ptErr').textContent = r; return; }
      H.toast('Sold ' + v.toFixed(2) + ' ' + label(m, d.i, d.s) + ' for ' + H.usd(r.usd), 'PnL ' + H.signed(r.pnl), r.pnl >= 0 ? 'ok' : 'bad');
      var left = hold(m)[hk(d.i, d.s)]; d.amt = left ? String(+left.sh.toFixed(2)) : '';
    }
    H.changed(true);
    renderDetail(false);
  }

  /* ---- probability chart ---- */
  function buildChart(m) {
    var box = document.getElementById('pdChart');
    if (dchart) { try { dchart.remove(); } catch (e) {} dchart = null; dseries = []; }
    if (!root.LightweightCharts) { box.innerHTML = '<div class="chart-msg">Chart library unavailable.</div>'; return; }
    dchart = root.LightweightCharts.createChart(box, H.chartOptions({ priceFormat: true }));
    var n = m.type === 'binary' ? 1 : m.outcomes.length;
    var show = []; for (var j = 0; j < n; j++) show.push(j);
    if (n > 4) show = show.sort(function (a, b) { return prices(m)[b] - prices(m)[a]; }).slice(0, 4);
    dseries = show.map(function (j) {
      var sr = dchart.addLineSeries({ color: COLORS[j % COLORS.length], lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
        priceFormat: { type: 'custom', minMove: 0.1, formatter: function (v) { return v.toFixed(1) + '%'; } } });
      return { j: j, s: sr };
    });
    dchart.priceScale('right').applyOptions({ autoScale: true, scaleMargins: { top: 0.1, bottom: 0.08 } });
    document.getElementById('pdLegend').innerHTML = show.map(function (j) { return '<span><i style="background:' + COLORS[j % COLORS.length] + '"></i>' + esc(m.type === 'binary' ? 'Yes' : m.outcomes[j]) + '</span>'; }).join('') + '<span class="muted">Earlier points: simulated warm-up history</span>';
    dseries.forEach(function (d) { d.s.setData(m.hist.map(function (pt) { return { time: pt[0], value: pt[1][d.j] * 100 }; })); });
    dchart.timeScale().fitContent();
  }
  function updChart(m) {
    if (!dchart) return;
    var last = m.hist[m.hist.length - 1];
    dseries.forEach(function (d) { try { d.s.update({ time: last[0], value: last[1][d.j] * 100 }); } catch (e) { d.s.setData(m.hist.map(function (pt) { return { time: pt[0], value: pt[1][d.j] * 100 }; })); } });
  }

  /* ---- resolve modal ---- */
  function openResolve(m) {
    H.modal('<div class="pt"><div class="pt-q" id="modalTitle">Resolve (demo)</div><p class="muted">' + esc(m.q) + '</p>' +
      '<p class="fine">Sample market: you choose the outcome. Winning shares pay $1.00 each, losing shares expire at $0, and open limit orders on this market are cancelled and refunded.</p>' +
      '<div class="rs-list">' + m.outcomes.map(function (o, j) { return '<button class="pm-btn ' + (m.type === 'binary' ? (j === 0 ? 'yes' : 'no') : 'yes') + '" data-w="' + j + '">' + (m.type === 'binary' ? 'Resolve ' + o.toUpperCase() : esc(o)) + '</button>'; }).join('') + '</div></div>');
    document.querySelectorAll('#modalBody [data-w]').forEach(function (b) {
      b.onclick = function () {
        var r = resolve(m, +b.dataset.w);
        H.closeModal();
        if (!r) return;
        H.toast('Resolved: ' + m.outcomes[+b.dataset.w] + ' (demo)', r.had ? 'Payout ' + H.usd(r.payout) + ' · PnL ' + H.signed(r.pnl) : 'You had no position in this market', r.pnl >= 0 ? 'ok' : 'bad');
        H.changed(true);
        if (detail && detail.m === m) renderDetail(false); else renderGrid();
      };
    });
  }

  /* ---------------- init ---------------- */
  var flowTimer = null;
  function ensure(px) {
    if (!S.pm || !S.pm.markets || !S.pm.markets.length || S.pm.v !== 2) S.pm = { v: 2, markets: build(px), pos: {}, orders: [], hist: [] };
    if (!S.pm.orders) S.pm.orders = [];
  }

  function init(state, hooks) {
    S = state; H = hooks;
    el = { grid: document.getElementById('pmGrid'), list: document.getElementById('pmList'), detail: document.getElementById('pmDetail'),
           cats: document.getElementById('pmCats'), pos: document.getElementById('pmPositions'), ord: document.getElementById('pmOrders'),
           hist: document.getElementById('pmHistory'), sum: document.getElementById('pmSummary') };
    el.cats.innerHTML = ['All'].concat(CATS).map(function (c) { return '<button class="seg-btn" data-cat="' + c + '">' + c + '</button>'; }).join('');
    el.cats.addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; filter = b.dataset.cat; renderGrid(); });
    document.getElementById('viewPredict').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pm]'); if (!b) return;
      var a = b.dataset.pm;
      if (a === 'back') { closeDetail(); return; }
      if (a === 'cancel') { cancelOrder(b.dataset.o); H.toast('Limit order cancelled', 'Reserved funds/shares returned', 'ok'); H.changed(true); if (detail) renderDetail(false); else renderSide(); return; }
      if (a === 'pick') { detail.i = +b.dataset.i; detail.s = b.dataset.s; detail.dir = 'buy'; detail.amt = detail.amt || '100'; renderDetail(false); return; }
      var m = mk(b.dataset.m); if (!m) return;
      if (a === 'open') openDetail(m);
      else if (a === 'trade') openDetail(m, +b.dataset.i, b.dataset.s, b.dataset.dir);
      else if (a === 'resolve') openResolve(m);
    });
    if (!flowTimer) flowTimer = setInterval(flow, 3000);
  }

  function setState(state) { S = state; if (detail) closeDetail(); }
  function render() { if (detail) renderDetail(true); else renderGrid(); renderSide(); }
  function renderAll() { if (detail) { var m = mk(detail.m.id); if (m) { detail.m = m; renderDetail(false); } else closeDetail(); } else renderGrid(); renderSide(); }

  root.VXPredict = { init: init, ensure: ensure, render: render, renderAll: renderAll, renderSide: renderSide, setState: setState,
                     value: holdingsValue, unrealized: unrealized, prices: prices, buy: buy, sell: sell, placeLimit: placeLimit,
                     cancelOrder: cancelOrder, resolve: resolve, flow: flow, market: mk, openDetail: openDetail, closeDetail: closeDetail };
})(window);
