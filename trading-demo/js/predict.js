/* Demo Exchange — prediction markets.
 * Market types: binary (YES/NO), multi-outcome (one event, several candidates) and range
 * (Kalshi-style price/value buckets). Pricing: LMSR automated market maker (see engine.js).
 * Every market here is a SAMPLE market: questions and starting odds are illustrative only and
 * nothing is resolved from real-world data; "Resolve (demo)" settles it by hand.
 */
(function (root) {
  'use strict';
  var E = root.VXEngine;
  var H = null, S = null;

  var CATS = ['Politics', 'Economics', 'Financials', 'Crypto', 'Commodities', 'Sports', 'Culture', 'Mentions', 'Climate & Weather', 'Tech'];
  var COLORS = ['#d7dadd', '#8ea4c8', '#c9a46a', '#93b592', '#b58fa8', '#7fb0b5'];   // categorical, muted
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function ceilTo(x, step) { return Math.ceil(x / step) * step; }
  function roundTo(x, step) { return Math.round(x / step) * step; }
  function usd0(v) { return '$' + Math.round(v).toLocaleString('en-US'); }
  function k(v) { return '$' + (v >= 1000 ? (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k' : v); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* strict number parsing: '1,000' -> 1000, '12abc' / '' -> NaN */
  function pnum(v) { var t = String(v == null ? '' : v).replace(/[,\s]/g, ''); return t === '' ? NaN : Number(t); }
  function cents(p) { var c = p * 100; return (c >= 99.95 ? '99.9' : c < 0.05 ? '0.1' : c.toFixed(1)) + '¢'; }
  /* share amounts shown in the ticket are rounded DOWN, so a prefilled amount never exceeds the holding */
  function floorSh(x) { if (!(x > 0)) return 0; var f = Math.floor(x * 100 + 1e-9) / 100; return f > 0 ? f : Math.floor(x * 1e6) / 1e6; }
  function shTxt(x) { var f = floorSh(x); return f >= 0.01 || f === 0 ? f.toFixed(2) : String(f); }
  /* a ticket amount within this many shares of the holding sells the whole holding (no dust left behind) */
  var SELL_SNAP = 0.01;   // the 2-decimal amount shown in the ticket (rounded down) is within 0.01 of the holding
  /* markets on the same underlying cannot be combined (their outcomes are not independent, some
     combinations can never win) */
  var UNDERLYING = { 'btc-above': 'BTC', 'btc-range': 'BTC', 'brent-range': 'crude oil', 'wti-100': 'crude oil' };
  /* the app tells us whether this tab may change the shared state (another tab can be the writer) */
  function canWrite() { return !H || !H.canWrite || H.canWrite(); }
  function claim() { if (H && H.claim) H.claim(); }
  /* every change to the account is written at once (another tab can take over at any moment) */
  function persist() { if (H && H.persist) H.persist(); }
  /* after claim() the state may have been replaced by the latest saved copy: use that copy's market */
  function liveM(m) { return m && S && S.pm ? (mk(m.id) || m) : m; }
  function hidden() { return typeof document !== 'undefined' && document.hidden; }

  /* ---------------- market catalogue (sample) ---------------- */
  function catalogue(px) {
    var btc = px('BTC') || 80000, eth = px('ETH') || 2500, gold = px('XAUUSD') || 4180, spx = px('US500') || 7650;
    var sc = roundTo(spx, 250);
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
        outcomes: ['Below 2.5%', '2.5% - 3.0%', '3.0% - 3.5%', 'Above 3.5%'], p0: [0.15, 0.35, 0.32, 0.18],
        rule: 'Resolves to the bucket containing the 12-month change of CPI-U for December 2026, as first published. Bucket edges belong to the higher bucket.',
        source: 'U.S. Bureau of Labor Statistics, CPI news release.' },
      { id: 'rec-27', cat: 'Economics', type: 'binary', b: 5000, close: 'Dec 31, 2027', p0: [0.28],
        q: 'Will the US enter a recession that starts in 2027?',
        rule: 'Resolves YES if the NBER Business Cycle Dating Committee dates a business-cycle peak in 2027.',
        source: 'NBER Business Cycle Dating Committee announcements.' },
      { id: 'spx-range', cat: 'Financials', type: 'range', b: 4000, close: 'Dec 31, 2026',
        q: 'S&P 500 closing level on Dec 31, 2026',
        outcomes: ['Below ' + (sc - 500).toLocaleString('en-US'), (sc - 500).toLocaleString('en-US') + ' - ' + (sc - 250).toLocaleString('en-US'), (sc - 250).toLocaleString('en-US') + ' - ' + sc.toLocaleString('en-US'), sc.toLocaleString('en-US') + ' - ' + (sc + 250).toLocaleString('en-US'), (sc + 250).toLocaleString('en-US') + ' - ' + (sc + 500).toLocaleString('en-US'), 'Above ' + (sc + 500).toLocaleString('en-US')],
        p0: [0.12, 0.14, 0.2, 0.22, 0.17, 0.15],
        rule: 'Resolves to the bucket containing the official S&P 500 index close on the last trading day of 2026. Edges belong to the higher bucket.',
        source: 'S&P Dow Jones Indices official close.' },
      { id: 'btc-above', cat: 'Crypto', type: 'binary', b: 6000, close: 'Dec 31, 2026', p0: [0.31],
        q: 'Will BTC trade above ' + usd0(bStrike) + ' on Dec 31, 2026?',
        rule: 'Resolves YES if the BTC/USDT last price is above ' + usd0(bStrike) + ' at 23:59 UTC on Dec 31, 2026.',
        source: 'Binance BTC/USDT spot market.' },
      { id: 'btc-range', cat: 'Crypto', type: 'range', b: 5000, close: 'Dec 31, 2026',
        q: 'BTC price on Dec 31, 2026 (23:59 UTC)',
        outcomes: ['Below ' + k(c - step), k(c - step) + ' - ' + k(c), k(c) + ' - ' + k(c + step), k(c + step) + ' - ' + k(c + 2 * step), 'Above ' + k(c + 2 * step)],
        p0: [0.18, 0.27, 0.27, 0.17, 0.11],
        rule: 'Resolves to the bucket containing the BTC/USDT last price at 23:59 UTC on Dec 31, 2026. Edges belong to the higher bucket.',
        source: 'Binance BTC/USDT spot market.' },
      { id: 'eth-above', cat: 'Crypto', type: 'binary', b: 5000, close: 'Dec 31, 2026', p0: [0.27],
        q: 'Will ETH close 2026 above ' + usd0(eStrike) + '?',
        rule: 'Resolves YES if the ETH/USDT daily candle of Dec 31, 2026 closes above ' + usd0(eStrike) + '.',
        source: 'Binance ETH/USDT spot market.' },
      { id: 'gold-month', cat: 'Commodities', type: 'binary', b: 5000, close: monthEnd, p0: [0.33], ends: Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate(), 21),
        q: 'Will gold settle above ' + usd0(gStrike) + ' at the end of ' + monthName + '?',
        rule: 'Resolves YES if spot gold (XAU/USD) is above ' + usd0(gStrike) + ' per troy oz at the last fixing of ' + monthName + '.',
        source: 'LBMA Gold Price PM (reference), spot XAU/USD.' },
      { id: 'brent-range', cat: 'Commodities', type: 'range', b: 4000, close: 'Dec 31, 2026',
        q: 'Brent crude front-month settlement on Dec 31, 2026',
        outcomes: ['Below $95', '$95 - $105', '$105 - $115', '$115 - $125', 'Above $125'], p0: [0.14, 0.24, 0.30, 0.20, 0.12],
        rule: 'Resolves to the bucket containing the ICE Brent front-month settlement price on the last trading day of 2026.',
        source: 'ICE Futures Europe settlement prices.' },
      { id: 'wti-100', cat: 'Commodities', type: 'binary', b: 5000, close: 'Nov 30, 2026', p0: [0.47],
        q: 'Will WTI crude settle above $100 on Nov 30, 2026?',
        rule: 'Resolves YES if the NYMEX WTI front-month settlement on Nov 30, 2026 is above $100.00.',
        source: 'CME Group NYMEX settlements.' },
      { id: 'nba-27', cat: 'Sports', type: 'multi', b: 4000, close: 'Jun 2027',
        q: '2026-27 NBA Champion',
        outcomes: ['Oklahoma City Thunder', 'Boston Celtics', 'Denver Nuggets', 'New York Knicks', 'Cleveland Cavaliers', 'Any other team'],
        p0: [0.22, 0.14, 0.10, 0.10, 0.10, 0.34],
        rule: 'Resolves to the team that wins the 2027 NBA Finals.',
        source: 'NBA official results.' },
      { id: 'sb-afc', cat: 'Sports', type: 'binary', b: 5000, close: 'Feb 2027', p0: [0.50],
        q: 'Will an AFC team win Super Bowl LXI?',
        rule: 'Resolves YES if the winner of Super Bowl LXI is the AFC champion.',
        source: 'NFL official results.' },
      { id: 'xmas-no1', cat: 'Culture', type: 'binary', b: 4000, close: 'Dec 22, 2026 (chart release)', p0: [0.62],
        q: 'Will “All I Want for Christmas Is You” be #1 on the Billboard Hot 100 dated Dec 26, 2026?',
        rule: 'Resolves YES if the song is #1 on the Billboard Hot 100 chart dated December 26, 2026.',
        source: 'Billboard Hot 100 chart.' },
      { id: 'fed-mention', cat: 'Mentions', type: 'binary', b: 4000, close: 'Dec 2026 FOMC press conference', p0: [0.36],
        q: 'Will the Fed Chair say “recession” at the December 2026 FOMC press conference?',
        rule: 'Resolves YES if the Chair of the Federal Reserve says the word “recession” (any form) during the press conference after the December 2026 FOMC meeting, per the official transcript or video.',
        source: 'Federal Reserve press conference transcript / video.' },
      { id: 'nyc-snow', cat: 'Climate & Weather', type: 'range', b: 3000, close: 'Jan 1, 2027',
        q: 'Total December 2026 snowfall in Central Park, NYC',
        outcomes: ['Under 1 in', '1 - 4 in', '4 - 8 in', '8 - 12 in', 'Over 12 in'], p0: [0.30, 0.32, 0.20, 0.10, 0.08],
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
        rule: 'Resolves YES if Apple has the largest market capitalization of any listed company at the Dec 31, 2026 close.',
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
      if (d.ends) m.ends = d.ends;
      // simulated warm-up history (sample) ending at the starting odds
      var seed = 0; for (var i = 0; i < d.id.length; i++) seed = (seed * 31 + d.id.charCodeAt(i)) >>> 0;
      function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
      var q = m.qv.slice(), pts = [], t = Math.floor(Date.now() / 1000);
      for (var s = 0; s < 90; s++) {
        pts.push([t - s * 120, E.lmsrPrices(q, m.b)]);
        q = q.map(function (v) { return v + (rnd() - 0.5) * m.b * 0.06; });
      }
      m.hist = pts.reverse();
      m.vol = Math.round(m.b * (1.5 + rnd() * 6)); m.trades = 30 + Math.floor(rnd() * 170);   // sample warm-up activity
      m.hist[m.hist.length - 1] = [t, E.lmsrPrices(m.qv, m.b)];
      return m;
    });
  }

  /* ---------------- core ---------------- */
  function prices(m) { return E.lmsrPrices(m.qv, m.b); }
  function side(m, i, s) { return E.sidePrice(m.qv, m.b, i, s); }
  function mk(id) { for (var i = 0; i < S.pm.markets.length; i++) if (S.pm.markets[i].id === id) return S.pm.markets[i]; return null; }
  function hk(i, s) { return i + ':' + s; }
  /* read-only view of the holdings in a market (does not create an empty record) */
  var NONE = {};
  function hold(m) { return S.pm.pos[m.id] || NONE; }
  function holdW(m) { return S.pm.pos[m.id] || (S.pm.pos[m.id] = {}); }   // for writes only
  function dropEmpty(m) { var h = S.pm.pos[m.id]; if (h && !Object.keys(h).length) delete S.pm.pos[m.id]; }
  function label(m, i, s) { if (m.auto) return s === 'yes' ? 'UP' : 'DOWN'; return m.type === 'binary' ? s.toUpperCase() : (s === 'yes' ? 'YES' : 'NO') + ' · ' + m.outcomes[i]; }
  function sideName(m, s) { return m.auto ? (s === 'yes' ? 'Up' : 'Down') : (s === 'yes' ? 'Yes' : 'No'); }
  function statusText(m) {
    if (m.status === 'closing') return 'Settling…';
    if (m.status === 'void') return 'Voided · stakes refunded';
    return m.winner != null ? m.outcomes[m.winner] : '';
  }
  function closedMsg(m) { return m.status === 'closing' ? 'This round has ended and is settling.' : m.status === 'void' ? 'This round was voided.' : 'This market is resolved.'; }

  /* probability history: 4 decimals are plenty for the chart and keep the saved state small */
  function rounded(pr) { return pr.map(function (x) { return Math.round(x * 1e4) / 1e4; }); }
  function pushHist(m) {
    var t = Math.floor(Date.now() / 1000), last = m.hist[m.hist.length - 1];
    if (last && last[0] >= t) last[1] = rounded(prices(m)); else m.hist.push([t, rounded(prices(m))]);
    if (m.hist.length > 400) m.hist.splice(0, m.hist.length - 400);
  }

  function execBuy(m, i, s, usd, who) {
    var x = E.lmsrSharesForSpend(m.qv, m.b, i, s, usd);
    m.qv = E.addVec(m.qv, i, s, x);
    m.vol += usd; m.trades++;
    if (who !== 'flow') { var h = holdW(m), key = hk(i, s); h[key] = h[key] || { sh: 0, cost: 0 }; h[key].sh += x; h[key].cost += usd; }
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
  function validIdx(m, i) { return typeof i === 'number' && Math.floor(i) === i && i >= 0 && i < (m.type === 'binary' ? 1 : m.outcomes.length); }
  function validSide(s) { return s === 'yes' || s === 'no'; }
  /* a sample market whose closing date has passed: trading stops, it waits for "Resolve (demo)" */
  function expired(m) { return !m.auto && m.status === 'open' && endsOf(m) < Date.now(); }
  var EXPIRED_MSG = 'Trading has closed for this market (closing date passed). It is awaiting resolution.';
  function strikeMsg(m) { return btcLive() ? 'Setting the price to beat… try again in a moment.' : 'Waiting for live Binance data to set the price to beat. This round opens for trading once Binance answers.'; }
  /* common checks before an order on market m */
  function tradeErr(m, i, s) {
    if (!m) return 'Unknown market.';
    if (m.status !== 'open') return closedMsg(m);
    if (expired(m)) return EXPIRED_MSG;
    if (!validIdx(m, i) || !validSide(s)) return 'Unknown outcome.';
    if (m.auto && !(m.round.strike > 0)) return strikeMsg(m);
    return '';
  }

  function buy(m, i, s, usd) {
    claim(); m = liveM(m);
    var e0 = tradeErr(m, i, s); if (e0) return e0;
    if (!validNum(usd)) return 'Enter an amount greater than 0.';
    if (usd < 1) return 'Minimum order is $1.';
    if (usd > S.balance + 1e-9) return 'Insufficient paper balance (' + H.usd(S.balance) + ' available).';
    S.balance -= usd;
    var x = execBuy(m, i, s, usd);
    log('Buy', m, i, s, x, usd, null);
    checkOrders(m);
    persist();
    return { shares: x, avg: usd / x };
  }

  function sell(m, i, s, x) {
    claim(); m = liveM(m);
    var e0 = tradeErr(m, i, s); if (e0) return e0;
    var h = hold(m), key = hk(i, s), cur = h[key];
    var have = cur ? cur.sh : 0;
    if (!validNum(x)) return 'Enter shares greater than 0.';
    // checked before any tolerance: with no shares even a tiny amount is refused (used to throw a TypeError)
    if (!cur || !(have > 0)) return 'You have no ' + label(m, i, s) + ' shares to sell.';
    if (x > have + 1e-6) return 'You hold only ' + shTxt(have) + ' shares.';
    x = Math.min(x, have);
    var basis = cur.cost * (x / have);
    var usd = execSell(m, i, s, x);
    cur.sh -= x; cur.cost -= basis;
    if (cur.sh < 1e-6) { delete h[key]; dropEmpty(m); }
    S.balance += usd;
    S.pmRealized = (S.pmRealized || 0) + (usd - basis);
    log('Sell', m, i, s, x, usd, usd - basis);
    checkOrders(m);
    persist();
    return { usd: usd, avg: usd / x, pnl: usd - basis };
  }

  /* ---- limit orders (rest against the AMM, can fill partially) ---- */
  function placeLimit(m, i, s, dir, limit, amount) {
    claim(); m = liveM(m);
    var e0 = tradeErr(m, i, s); if (e0) return e0;
    if (dir !== 'buy' && dir !== 'sell') return 'Choose buy or sell.';
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
      if (!cur || !(have > 0)) return 'You have no ' + label(m, i, s) + ' shares to sell.';
      if (amount > have + 1e-6) return 'You hold only ' + shTxt(have) + ' shares.';
      amount = Math.min(amount, have); o.rem = amount;
      o.basis = cur.cost * (amount / have);
      cur.sh -= amount; cur.cost -= o.basis;
      if (cur.sh < 1e-6) { delete h[key]; dropEmpty(m); }
    }
    S.pm.orders.push(o);
    log('Limit ' + dir, m, i, s, dir === 'sell' ? amount : null, dir === 'buy' ? amount : null, null, o.limit);
    checkOrders(m);
    persist();
    return o;
  }

  function cancelOrder(id, quiet) {
    if (!quiet) claim();
    var idx = -1;
    S.pm.orders.forEach(function (o, j) { if (o.id === id) idx = j; });
    if (idx < 0) return;
    var o = S.pm.orders[idx], m = mk(o.mid);
    S.pm.orders.splice(idx, 1);
    if (o.dir === 'buy') S.balance += o.rem;
    else if (m) { var h = holdW(m), key = hk(o.i, o.s); h[key] = h[key] || { sh: 0, cost: 0 }; h[key].sh += o.rem; h[key].cost += o.basis; }
    if (!quiet && m) log('Cancel', m, o.i, o.s, o.dir === 'sell' ? o.rem : null, o.dir === 'buy' ? o.rem : null, null, o.limit);
    if (!quiet) persist();
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

  /* ---- combos (parlays): 2-3 legs from different markets, priced as independent events ---- */
  var COMBO_MIN = 2, COMBO_MAX = 3;
  function legPrice(l) { var m = mk(l.mid); return m ? side(m, l.i, l.s) : 0; }
  function legLabel(l) { var m = mk(l.mid); return m ? label(m, l.i, l.s) : ''; }
  function slipPrice() { return S.pm.slip.reduce(function (a, l) { return a * legPrice(l); }, 1); }
  function addLeg(m, i, s) {
    claim(); m = liveM(m);
    if (!m || m.status !== 'open' || expired(m)) return 'Only open markets can go into a combo.';
    if (m.auto) return '15-minute rounds cannot be combined.';
    if (!validIdx(m, i) || !validSide(s)) return 'Unknown outcome.';
    var u = UNDERLYING[m.id];
    var clash = u && S.pm.slip.filter(function (l) { return l.mid !== m.id && UNDERLYING[l.mid] === u; })[0];
    if (clash) return 'These markets depend on the same underlying (' + u + '), so their outcomes are not independent. Combine markets on different events.';
    var have = S.pm.slip.filter(function (l) { return l.mid === m.id; })[0];
    if (have) { have.i = i; have.s = s; return { replaced: true }; }
    if (S.pm.slip.length >= COMBO_MAX) return 'A combo has at most ' + COMBO_MAX + ' legs.';
    S.pm.slip.push({ mid: m.id, i: i, s: s });
    return { added: true };
  }
  function removeLeg(mid) { S.pm.slip = S.pm.slip.filter(function (l) { return l.mid !== mid; }); }
  function placeCombo(stake) {
    claim();
    var legs = S.pm.slip;
    if (legs.length < COMBO_MIN) return 'Add at least ' + COMBO_MIN + ' legs from different markets.';
    if (!legs.every(function (l) { var m = mk(l.mid); return m && m.status === 'open' && !expired(m); })) return 'One of the legs is no longer open.';
    var seenU = {};
    for (var li = 0; li < legs.length; li++) { var uu = UNDERLYING[legs[li].mid]; if (uu && seenU[uu]) return 'Two legs depend on the same underlying (' + uu + '). Combine markets on different events.'; if (uu) seenU[uu] = 1; }
    if (!validNum(stake)) return 'Enter a stake greater than 0.';
    if (stake < 1) return 'Minimum stake is $1.';
    if (stake > S.balance + 1e-9) return 'Insufficient paper balance (' + H.usd(S.balance) + ' available).';
    var price = slipPrice();
    if (!(price >= 0.001)) return 'Combined probability is below 0.1%: pick other legs.';
    var c = { id: 'cb' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), legs: legs.map(function (l) { return { mid: l.mid, i: l.i, s: l.s, p0: legPrice(l), q: mk(l.mid).q, what: legLabel(l), res: null }; }),
              stake: stake, price: price, payout: stake / price, status: 'open', created: Date.now() };
    S.balance -= stake;
    S.pm.combos.unshift(c);
    S.pm.slip = [];
    S.pm.hist.unshift({ t: Date.now(), kind: 'Combo', mid: c.legs[0].mid, q: c.legs.length + '-leg combo', what: c.legs.map(function (l) { return l.what; }).join(' + '), sh: null, usd: stake, pnl: null });
    persist();
    return c;
  }
  function comboValue(c) { return c.status !== 'open' ? 0 : c.payout * c.legs.reduce(function (a, l) { return a * (l.res === 'won' ? 1 : legPrice(l)); }, 1); }
  function settleCombos(m, w) {
    (S.pm.combos || []).forEach(function (c) {
      if (c.status !== 'open') return;
      var touched = false;
      c.legs.forEach(function (l) { if (l.mid === m.id && l.res == null) { l.res = E.payout(l.i, l.s, 1, w) > 0 ? 'won' : 'lost'; touched = true; } });
      if (!touched) return;
      if (c.legs.some(function (l) { return l.res === 'lost'; })) {
        c.status = 'lost'; c.settledAt = Date.now();
        S.pmRealized = (S.pmRealized || 0) - c.stake;
        S.pm.hist.unshift({ t: Date.now(), kind: 'Combo lost', mid: m.id, q: c.legs.length + '-leg combo', what: c.legs.map(function (l) { return l.what; }).join(' + '), sh: null, usd: 0, pnl: -c.stake });
        H.toast('Combo lost', 'A leg settled against it: ' + m.q + ' · ' + H.signed(-c.stake), 'bad');
      } else if (c.legs.every(function (l) { return l.res === 'won'; })) {
        c.status = 'won'; c.settledAt = Date.now();
        S.balance += c.payout;
        S.pmRealized = (S.pmRealized || 0) + (c.payout - c.stake);
        S.pm.hist.unshift({ t: Date.now(), kind: 'Combo won', mid: m.id, q: c.legs.length + '-leg combo', what: c.legs.map(function (l) { return l.what; }).join(' + '), sh: null, usd: c.payout, pnl: c.payout - c.stake });
        H.toast('Combo won', 'All ' + c.legs.length + ' legs settled in your favour · paid ' + H.usd(c.payout), 'ok');
      }
    });
    S.pm.slip = S.pm.slip.filter(function (l) { return l.mid !== m.id; });
  }

  /* ---- operator-created markets (admin console) ---- */
  function createMarket(d) {
    claim();
    var title = String(d.q || '').trim(), type = d.type, outs;
    if (title.length < 10) return 'Title needs at least 10 characters.';
    if (title.length > 160) return 'Title is limited to 160 characters.';
    if (CATS.indexOf(d.cat) < 0) return 'Choose a category.';
    if (type === 'binary') outs = ['Yes', 'No'];
    else if (type === 'multi' || type === 'range') {
      outs = String(d.outcomes || '').split(/\n|,/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (outs.length < 2) return 'Enter at least 2 outcomes (one per line).';
      if (outs.length > 8) return 'At most 8 outcomes.';
      var seen = {}; for (var i = 0; i < outs.length; i++) { var kk = outs[i].toLowerCase(); if (seen[kk]) return 'Outcome "' + outs[i] + '" is listed twice.'; seen[kk] = 1; }
    } else return 'Choose a market type.';
    var ends = Date.parse(d.closeDate + 'T23:59:00Z');
    if (!isFinite(ends)) return 'Pick a closing date.';
    if (ends < Date.now() + 3600000) return 'The closing date must be in the future.';
    var rule = String(d.rule || '').trim();
    if (rule.length < 20) return 'Resolution rules need at least 20 characters.';
    // empty field -> default 3000; anything else must be a real number (no silent fallback for "abc")
    var b = d.b == null || String(d.b).trim() === '' ? 3000 : Number(String(d.b).replace(/,/g, '').trim());
    if (!isFinite(b)) return 'Liquidity (b) must be a number between 500 and 20,000.';
    if (!(b >= 500 && b <= 20000)) return 'Liquidity (b) must be between 500 and 20,000.';
    var p0 = outs.map(function () { return 1 / outs.length; });
    var dt = new Date(ends);
    var m = { id: 'cm-' + Date.now().toString(36), cat: d.cat, type: type, q: title, outcomes: outs, p0: p0, b: b,
              close: MONTHS[dt.getUTCMonth()].slice(0, 3) + ' ' + dt.getUTCDate() + ', ' + dt.getUTCFullYear(), ends: ends,
              rule: 'Operator market (demo). ' + rule, source: String(d.source || '').trim() || 'Set by the operator.', qv: E.lmsrInit(p0, b),
              status: 'open', winner: null, vol: 0, trades: 0, hist: [[Math.floor(Date.now() / 1000), p0.slice()]], custom: true, createdAt: Date.now() };
    S.pm.markets.push(m);
    persist();
    return m;
  }

  /* ---- sample discussion and leaderboard (clearly labelled sample; no real people) ---- */
  function rng(seedStr) { var h = 2166136261; for (var i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
  var CM_BIN = ['Took a small YES position at {p}. I will add if it dips below {lo}.', 'NO looks cheap to me at {q}. Keeping it small.', 'Read the resolution rules twice. The source matters more than the headline here.',
    'Filled 300 shares with very little slippage, the book is deeper than it looks.', 'Selling half of my position here and letting the rest ride.', 'Resting a limit at {lo} and walking away for the day.',
    'The price moved {mv} points in the last hour without any news. Probably one large order.', 'Fair value for me is close to the current price. Not trading this one.'];
  var CM_MULTI = ['{o} at {p} is the cheapest outcome that still looks plausible to me.', 'Splitting my stake across the two middle outcomes.', 'Buying NO on {o}. The crowd seems too confident.',
    'Edges belong to the higher bucket, worth checking before you size up.', 'I hold YES on {o} and NO on the favorite. Small positions on both.', 'Volume picked up on {o} today, watching the book.'];
  function sampleComments(m) {
    var r = rng(m.id), n = 4 + Math.floor(r() * 3), out = [], lst = m.type === 'binary' ? CM_BIN : CM_MULTI, pool = lst.slice();
    for (var k = 0; k < n; k++) {
      var j = m.type === 'binary' ? 0 : Math.floor(r() * m.outcomes.length);
      if (!pool.length) pool = lst.slice();
      var t = pool.splice(Math.floor(r() * pool.length), 1)[0];
      var pp = m.type === 'binary' ? m.p0[0] : m.p0[j];
      var txt = t.replace('{p}', Math.round(pp * 100) + '¢').replace('{q}', Math.round((1 - pp) * 100) + '¢').replace('{lo}', Math.max(1, Math.round(pp * 100) - 4) + '¢')
        .replace('{mv}', (1 + Math.floor(r() * 4))).replace(/\{o\}/g, m.outcomes[j]);
      var sd = r() < 0.6 ? 'yes' : 'no';
      out.push({ who: 'trader_' + (11 + Math.floor(r() * 880)), text: txt, ago: Math.floor(8 + Math.pow(r(), 2) * 2800), pos: (sd === 'yes' ? 'YES ' : 'NO ') + (m.type === 'binary' ? '' : m.outcomes[j] + ' ') + (20 + Math.floor(r() * 900)) });
    }
    out.sort(function (a, b) { return a.ago - b.ago; });
    return out;
  }
  function ago(min) { return min < 60 ? min + 'm' : min < 1440 ? Math.floor(min / 60) + 'h' : Math.floor(min / 1440) + 'd'; }
  var BOARD = (function () { var r = rng('leaderboard'), list = []; for (var k = 0; k < 9; k++) list.push({ who: 'trader_' + (100 + Math.floor(r() * 899)), pnl: Math.round((4200 - k * 430) * (0.7 + r() * 0.5) * 100) / 100, vol: Math.round(20000 + r() * 160000), win: 0.45 + r() * 0.25 }); return list; })();

  function resolve(m, w) {
    if (!m || (m.status !== 'open' && m.status !== 'closing')) return null;
    if (typeof w !== 'number' || Math.floor(w) !== w || w < 0 || w >= m.outcomes.length) return null;   // no such outcome
    claim(); m = liveM(m);
    if (m.status !== 'open' && m.status !== 'closing') return null;
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
    settleCombos(m, w);
    persist();
    return m.settled;
  }

  function log(kind, m, i, s, sh, usd, pnl, limit) {
    S.pm.hist.unshift({ t: Date.now(), kind: kind, mid: m.id, q: m.q, what: kind === 'Resolved' ? m.outcomes[i] : label(m, i, s), sh: sh, usd: usd, pnl: pnl, limit: limit });
    if (S.pm.hist.length > 150) S.pm.hist.length = 150;
  }

  /* simulated order flow from other paper traders */
  function flow() {
    if (!S || !S.pm || !canWrite() || hidden()) return;   // background tab: no simulated flow (and no saves)
    var open = S.pm.markets.filter(function (m) { return m.status === 'open' && !m.auto && !expired(m); });
    if (!open.length) return;
    var m = open[Math.floor(Math.random() * open.length)];
    var n = m.type === 'binary' ? 1 : m.outcomes.length;
    var i = Math.floor(Math.random() * n), p = prices(m)[i];
    var s = Math.random() < 0.5 + 1.2 * (m.p0[i] - p) ? 'yes' : 'no';
    execBuy(m, i, s, 10 + Math.pow(Math.random(), 2) * 380, 'flow');
    var filled = checkOrders(m);
    if (ptrBusy()) { pend[m.id] = true; pend._any = true; if (filled) pend._imp = true; return; }
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
    (S.pm.combos || []).forEach(function (c) { v += comboValue(c); });
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
    (S.pm.combos || []).forEach(function (c) { if (c.status === 'open') u += comboValue(c) - c.stake; });
    return u;
  }

  /* ---------------- rendering: grid ---------------- */
  var el = {}, filter = 'All', detail = null, dchart = null, dseries = [], sortBy = 'vol';
  var ENDS = { 'house-26': '2026-11-03', 'pres-28': '2028-11-07', 'fed-dec': '2026-12-09', 'cpi-dec': '2027-01-13', 'rec-27': '2027-12-31', 'spx-range': '2026-12-31',
    'btc-above': '2026-12-31', 'btc-range': '2026-12-31', 'eth-above': '2026-12-31', 'brent-range': '2026-12-31', 'wti-100': '2026-11-30', 'nba-27': '2027-06-20',
    'sb-afc': '2027-02-14', 'xmas-no1': '2026-12-22', 'fed-mention': '2026-12-09', 'nyc-snow': '2027-01-01', 'warm-26': '2027-01-15', 'ai-top': '2026-12-31', 'aapl-top': '2026-12-31' };
  function endsOf(m) {
    if (m.auto) return m.round.end;
    if (m.ends) return m.ends;
    if (ENDS[m.id]) return Date.parse(ENDS[m.id] + 'T23:59:00Z');
    if (m.id === 'gold-month') {   // saved before "ends" was stored: read the month from its closing date text
      var mm = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(String(m.close || ''));
      var mi = mm ? MONTHS.map(function (x) { return x.slice(0, 3); }).indexOf(mm[1]) : -1;
      if (mi >= 0) return Date.UTC(+mm[3], mi, +mm[2], 21);
      var n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0, 21);
    }
    return 9e15;
  }

  function typeTag(m) { if (m.auto) return '15 min'; return { binary: 'Yes / No', multi: 'Multi-outcome', range: 'Range' }[m.type]; }

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
    var pr = prices(m), res = m.status !== 'open' || expired(m);
    var top = '<div class="pm-top"><span class="pm-cat">' + esc(m.cat) + '</span><span class="pm-type">' + typeTag(m) + '</span>' + autoBadge(m) + '<span class="pill pill-sim">' + (m.auto ? 'Sample odds' : 'Sample') + '</span></div>' +
      '<h3 class="pm-q"><button class="pm-open" data-pm="open" data-m="' + m.id + '">' + esc(m.q) + '</button></h3>';
    var body;
    if (m.type === 'binary') {
      var ch = pr[0] - m.hist[Math.max(0, m.hist.length - 30)][1][0];
      body = '<div class="pm-prob"><div class="pm-prob-v mono">' + (res ? (m.status === 'resolved' ? esc(label(m, 0, m.winner === 0 ? 'yes' : 'no')) : '—') : Math.round(pr[0] * 100) + '<small>%</small>') + '</div>' +
        '<div class="pm-prob-k">' + (res ? (m.auto ? (m.status === 'resolved' ? 'Settled automatically' : esc(statusText(m))) : m.status === 'open' ? 'Awaiting resolution' : 'Resolved (demo)') : (m.auto ? 'chance of Up' : 'chance') + ' · <span class="mono ' + (ch >= 0 ? 'up' : 'down') + '">' + (ch >= 0 ? '+' : '') + (ch * 100).toFixed(1) + 'pt</span>') + '</div></div>' +
        '<div class="pm-chart">' + spark(m) + '</div>' +
        (res ? '' : '<div class="pm-btns"><button class="pm-btn yes" data-pm="trade" data-m="' + m.id + '" data-i="0" data-s="yes">' + sideName(m, 'yes') + ' <span class="mono">' + cents(pr[0]) + '</span></button>' +
          '<button class="pm-btn no" data-pm="trade" data-m="' + m.id + '" data-i="0" data-s="no">' + sideName(m, 'no') + ' <span class="mono">' + cents(1 - pr[0]) + '</span></button></div>');
    } else {
      var order = pr.map(function (p, j) { return j; });
      if (m.type === 'multi') order.sort(function (a, b) { return pr[b] - pr[a]; });
      var shown = order.slice(0, 4);
      body = '<ul class="pm-outs">' + shown.map(function (j) {
        var win = res && m.winner != null && m.winner === j;
        return '<li class="' + (res && m.winner != null && !win ? 'lost' : '') + '"><span class="po-l">' + (win ? '✓ ' : '') + esc(m.outcomes[j]) + '</span>' +
          '<span class="po-bar"><i style="width:' + (pr[j] * 100).toFixed(1) + '%"></i></span><span class="po-p mono">' + Math.round(pr[j] * 100) + '%</span>' +
          (res ? '' : '<button class="po-yes mono" data-pm="trade" data-m="' + m.id + '" data-i="' + j + '" data-s="yes" title="Buy YES on ' + esc(m.outcomes[j]) + '">' + cents(pr[j]) + '</button>') + '</li>';
      }).join('') + '</ul>' + (pr.length > 4 ? '<button class="linkbtn more" data-pm="open" data-m="' + m.id + '">+' + (pr.length - 4) + ' more outcomes</button>' : '');
    }
    var foot = autoInfo(m) + (res ? '<div class="pm-resolved">' + (m.status === 'resolved' ? 'Settled: ' : '') + '<b>' + esc(m.status === 'open' ? 'Awaiting resolution' : statusText(m)) + '</b>' + (m.settled && m.settled.had ? ' · you received ' + H.usd(m.settled.payout) + ' (' + H.signed(m.settled.pnl) + ')' : '') + '</div>' : '') +
      '<div class="pm-meta"><span>Vol ' + usd0(m.vol) + '</span><span>Liq. b=' + m.b.toLocaleString('en-US') + '</span><span>Closes ' + esc(m.close) + '</span>' + heldBadge(m) + '</div>';
    return top + body + foot;
  }

  function renderGrid() {
    if (!S.pm) { el.grid.innerHTML = '<div class="empty">Loading sample markets…</div>'; return; }
    var list = S.pm.markets.filter(function (m) { return filter === 'All' || m.cat === filter; });
    if (sortBy === 'new') list = list.slice().sort(function (a, b) { return endsOf(a) - endsOf(b); });
    else list = list.slice().sort(function (a, b) { return (b.auto ? 1e12 : b.vol) - (a.auto ? 1e12 : a.vol); });
    el.grid.innerHTML = list.map(function (m) { return '<article class="panel pm-card' + (m.status !== 'open' || expired(m) ? ' is-resolved' : '') + '" data-card="' + m.id + '">' + cardHtml(m) + '</article>'; }).join('') ||
      '<div class="empty">No markets in this category.</div>';
    el.cats.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.cat === filter); });
  }

  function refreshMarket(m, flash) {
    if (detail && detail.m === m) { renderDetail(true); return; }
    var c = el.grid.querySelector('[data-card="' + m.id + '"]');
    if (!c) return;
    c.innerHTML = cardHtml(m);
    c.classList.toggle('is-resolved', m.status !== 'open' || expired(m));
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
          '<div class="pmp-row"><b class="' + s + '">' + shTxt(c.sh) + ' ' + esc(label(m, i, s)) + '</b><span class="mono ' + (pnl >= 0 ? 'up' : 'down') + '">' + H.signed(pnl) + '</span></div>' +
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
      return '<div class="pmh"><span class="pmh-k">' + esc(h.kind) + '</span><span class="pmh-q">' + esc(h.what) + ' · ' + esc(h.q) + '</span>' +
        '<span class="mono">' + (h.sh != null ? h.sh.toFixed(2) + ' sh' : '') + (h.sh != null && h.usd != null ? ' · ' : '') + (h.usd != null ? H.usd(h.usd) : '') + (h.limit ? ' @' + cents(h.limit) : '') +
        (h.pnl != null ? ' · <span class="' + (h.pnl >= 0 ? 'up' : 'down') + '">' + H.signed(h.pnl) + '</span>' : '') + '</span>' +
        '<span class="pmh-t">' + new Date(h.t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '</span></div>';
    }).join('') || '<div class="empty">Your prediction trades will appear here.</div>';
    renderCombo(); renderBoard();
    el.sum.innerHTML = '<div><dt>Shares value</dt><dd class="mono">' + H.usd(holdingsValue()) + '</dd></div>' +
      '<div><dt>Unrealized</dt><dd class="mono ' + (unrealized() >= 0 ? 'up' : 'down') + '">' + H.signed(unrealized()) + '</dd></div>' +
      '<div><dt>Realized</dt><dd class="mono ' + ((S.pmRealized || 0) >= 0 ? 'up' : 'down') + '">' + H.signed(S.pmRealized || 0) + '</dd></div>';
  }

  /* combo slip: structure is rebuilt only when legs change, numbers update in place (keeps the stake input focused) */
  var comboKey = '', comboStake = '25';
  function renderCombo() {
    if (!el.combo) return;
    var slip = S.pm.slip, open = S.pm.combos.filter(function (c) { return c.status === 'open'; }), done = S.pm.combos.filter(function (c) { return c.status !== 'open'; }).slice(0, 4);
    var key = JSON.stringify(slip) + '|' + S.pm.combos.map(function (c) { return c.id + c.status + c.legs.map(function (l) { return l.res || ''; }).join(''); }).join(',');
    if (key !== comboKey) {
      comboKey = key;
      var h = '';
      if (!slip.length) h += '<p class="fine" style="margin:6px 0 4px">Combine 2 or 3 outcomes from different markets into one ticket. It pays only if every leg is right. Use <b>Add to combo</b> on a market page.</p>';
      else {
        h += slip.map(function (l) { var m = mk(l.mid); return '<div class="combo-leg"><span class="q" title="' + esc(m.q) + '"><b class="' + l.s + '">' + esc(legLabel(l)) + '</b> · ' + esc(m.q) + '</span><span class="mono" data-cl="' + l.mid + '"></span><button class="combo-x" data-pm="combo-rm" data-m="' + l.mid + '" aria-label="Remove leg"><i class="ph ph-x" aria-hidden="true"></i></button></div>'; }).join('');
        h += '<dl class="summary combo-sum"><div><dt>Combined price</dt><dd class="mono" id="cbPrice"></dd></div><div><dt>Pays if all legs win</dt><dd class="mono up" id="cbPay"></dd></div></dl>' +
          '<div class="field" style="margin:8px 0"><div class="input"><input id="cbStake" class="mono" inputmode="decimal" autocomplete="off" aria-label="Combo stake" value="' + esc(comboStake) + '"><span class="unit">USD</span></div></div>' +
          '<div class="ticket-err" id="cbErr"></div><div style="display:flex;gap:6px"><button class="btn-ghost sm" data-pm="combo-clear">Clear</button><button class="btn-primary sm" style="flex:1" data-pm="combo-place" id="cbGo">Place combo</button></div>' +
          '<p class="fine">Priced as independent events (product of leg prices), no fee. Correlated legs are not adjusted in this demo.</p>';
      }
      if (open.length || done.length) h += '<div class="lbl" style="margin:10px 0 0">Your combos</div>' + open.concat(done).map(function (c) {
        return '<div class="combo-bet"><span><b>' + c.legs.length + '-leg · ' + H.usd(c.stake) + '</b><span class="legs"><br>' + c.legs.map(function (l) { return esc(l.what) + (l.res ? ' (' + l.res + ')' : ''); }).join(' + ') + '</span></span>' +
          '<span class="mono r">' + (c.status === 'open' ? '<span data-cv="' + c.id + '"></span><br><span class="muted">pays ' + H.usd(c.payout) + '</span>' : '<span class="' + (c.status === 'won' ? 'up' : 'down') + '">' + (c.status === 'won' ? 'Won ' + H.usd(c.payout) : 'Lost') + '</span>') + '</span></div>';
      }).join('');
      el.combo.innerHTML = h;
      var inp = el.combo.querySelector('#cbStake');
      if (inp) inp.addEventListener('input', function () { comboStake = inp.value.trim(); updCombo(); });
    }
    updCombo();
  }
  function updCombo() {
    if (!el.combo) return;
    S.pm.slip.forEach(function (l) { var x = el.combo.querySelector('[data-cl="' + l.mid + '"]'); if (x) x.textContent = cents(legPrice(l)); });
    S.pm.combos.forEach(function (c) { var x = el.combo.querySelector('[data-cv="' + c.id + '"]'); if (x) x.textContent = 'value ' + H.usd(comboValue(c)); });
    var pe = el.combo.querySelector('#cbPrice'); if (!pe) return;
    var p = slipPrice(), v = pnum(comboStake), err = '';
    pe.textContent = (p * 100).toFixed(2) + '% · ' + cents(p);
    el.combo.querySelector('#cbPay').textContent = v > 0 && p > 0 ? H.usd(v / p) + ' (' + H.signed(v / p - v) + ')' : '—';
    if (S.pm.slip.length < COMBO_MIN) err = 'Add at least one more leg from another market.';
    else if (!(v > 0)) err = comboStake === '' ? '' : 'Enter a stake greater than 0.';
    else if (v < 1) err = 'Minimum stake is $1.';
    else if (v > S.balance + 1e-9) err = 'Insufficient paper balance.';
    el.combo.querySelector('#cbErr').textContent = err;
    el.combo.querySelector('#cbGo').disabled = !!err || !(v > 0);
  }
  function renderBoard() {
    if (!el.board) return;
    var you = (S.pmRealized || 0) + unrealized();
    var list = BOARD.map(function (x) { return { who: x.who, pnl: x.pnl, me: false }; }).concat([{ who: 'You (D-100248)', pnl: you, me: true }]);
    list.sort(function (a, b) { return b.pnl - a.pnl; });
    var rows = list.map(function (x, i) { return '<tr' + (x.me ? ' class="me"' : '') + '><td class="mono">' + (i + 1) + '</td><td>' + esc(x.who) + '</td><td class="mono r ' + (x.pnl >= 0 ? 'up' : 'down') + '">' + H.signed(x.pnl) + '</td></tr>'; });
    var html = '<table class="lb"><tbody>' + rows.join('') + '</tbody></table><p class="fine">Other rows are sample traders. Your row is your paper PnL.</p>';
    if (el.board.innerHTML !== html) el.board.innerHTML = html;
  }

  function relatedHtml(m) {
    var words = m.q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 3; });
    var scored = S.pm.markets.filter(function (x) { return x.id !== m.id && x.status === 'open' && !x.auto && !expired(x); }).map(function (x) {
      var q = x.q.toLowerCase(), sc = (x.cat === m.cat ? 3 : 0);
      words.forEach(function (w) { if (q.indexOf(w) >= 0) sc += 1; });
      return { x: x, sc: sc };
    }).filter(function (o) { return o.sc > 0; }).sort(function (a, b) { return b.sc - a.sc || b.x.vol - a.x.vol; }).slice(0, 4);
    if (!scored.length) return '<div class="empty-st sm"><b>No related markets</b><span>Nothing else open in this category.</span></div>';
    return scored.map(function (o) {
      var x = o.x, pr = prices(x), top = 0; pr.forEach(function (p, j) { if (p > pr[top]) top = j; });
      var lead = x.type === 'binary' ? 'Yes ' + Math.round(pr[0] * 100) + '%' : x.outcomes[top] + ' ' + Math.round(pr[top] * 100) + '%';
      return '<button class="rel" data-pm="open" data-m="' + x.id + '"><span>' + esc(x.q) + '<small>' + esc(x.cat) + ' · closes ' + esc(x.close) + '</small></span><span class="mono">' + esc(lead) + '</span></button>';
    }).join('');
  }
  function commentsHtml(m) {
    var mine = (S.pm.comments && S.pm.comments[m.id]) || [];
    var list = mine.map(function (c) { return '<div class="cm me"><div class="cm-h"><b>You (D-100248)</b><span>' + ago(Math.max(0, Math.round((Date.now() - c.t) / 60000))) + ' ago</span></div><p>' + esc(c.text) + '</p></div>'; }).join('');
    list += sampleComments(m).map(function (c) { return '<div class="cm"><div class="cm-h"><b>' + c.who + '</b><span class="pos">' + esc(c.pos) + '</span><span>' + ago(c.ago) + ' ago</span></div><p>' + esc(c.text) + '</p></div>'; }).join('');
    return '<div class="cm-form"><input class="text-in" id="cmIn" maxlength="280" placeholder="Share your view (stored in this browser only)" aria-label="Comment"><button class="btn-ghost" data-pm="comment" id="cmGo">Post</button></div>' + list;
  }

  /* ---------------- rendering: market detail ---------------- */
  function openDetail(m, i, s, dir) {
    var keep = detail && detail.m === m ? detail : null;
    detail = { m: m, i: i != null ? i : (keep ? keep.i : 0), s: s || (keep ? keep.s : 'yes'), dir: dir === 'sell' ? 'sell' : 'buy', type: 'market', amt: '100', lim: '' };
    if (m.type === 'binary') detail.i = 0;
    // "Sell" from the positions panel: prefill with what is actually held (rounded down), never 100
    if (detail.dir === 'sell') detail.amt = sellAmt(m, detail.i, detail.s);
    el.list.hidden = true; el.detail.hidden = false;
    renderDetail(false);
    try { el.detail.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } catch (e) {}
  }
  function sellAmt(m, i, s) { var hv = hold(m)[hk(i, s)]; return hv && hv.sh > 0 ? shTxt(hv.sh) : ''; }
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
    var v = pnum(d.amt), out = '', err = '';
    if (expired(m)) return { html: '', err: EXPIRED_MSG };
    if (m.auto && !(m.round.strike > 0)) return { html: '', err: strikeMsg(m) };
    if (d.type === 'limit') {
      var L = pnum(d.lim) / 100;
      if (!(L > 0)) return { html: '', err: d.lim === '' ? '' : 'Enter a limit price between 1 and 99¢.' };
      if (L < 0.01 || L > 0.99) return { html: '', err: 'Limit price must be between 1¢ and 99¢.' };
      if (!(v > 0)) return { html: '', err: d.amt === '' ? '' : (d.dir === 'buy' ? 'Enter an amount greater than 0.' : 'Enter shares greater than 0.') };
      var now = d.dir === 'buy' ? p <= L : p >= L;
      out = '<div><dt>Limit</dt><dd class="mono">' + (d.dir === 'buy' ? '≤ ' : '≥ ') + (L * 100).toFixed(1) + '¢</dd></div>' +
        '<div><dt>' + (d.dir === 'buy' ? 'Max shares' : 'Min proceeds') + '</dt><dd class="mono">' + (d.dir === 'buy' ? (v / L).toFixed(2) : H.usd(v * L)) + '</dd></div>' +
        '<div><dt>Status</dt><dd>' + (now ? 'Fills now (partly or fully)' : 'Rests until price reaches it') + '</dd></div>';
      if (d.dir === 'buy' && v > S.balance) err = 'Insufficient paper balance.';
      if (d.dir === 'buy' && v > 0 && v < 1) err = 'Minimum order is $1.';
      if (d.dir === 'sell' && !(have > 0)) err = 'You have no ' + label(m, i, s) + ' shares to sell.';
      else if (d.dir === 'sell' && v > have + SELL_SNAP) err = 'You hold only ' + shTxt(have) + ' shares.';
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
      var xs = Math.abs(v - have) < SELL_SNAP ? have : Math.min(v, have), usd = xs > 0 ? E.lmsrSellProceeds(m.qv, m.b, i, s, xs) : 0;
      out = '<div><dt>You receive</dt><dd class="mono">' + H.usd(usd) + '</dd></div>' +
        '<div><dt>Avg price</dt><dd class="mono">' + (xs > 0 ? cents(usd / xs) : '—') + '</dd></div>' +
        '<div><dt>Realized PnL</dt><dd class="mono">' + (xs > 0 && h ? H.signed(usd - h.cost * xs / have) : '—') + '</dd></div>';
      // no shares: always an error (even 0.0000001), so the button stays disabled
      if (!(have > 0)) err = 'You have no ' + label(m, i, s) + ' shares to sell.';
      else if (v > have + SELL_SNAP) err = 'You hold only ' + shTxt(have) + ' shares.';
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
          '<div class="pm-top"><span class="pm-cat">' + esc(m.cat) + '</span><span class="pm-type">' + typeTag(m) + '</span>' + autoBadge(m) + '<span class="pill pill-sim">' + (m.auto ? 'Sample odds' : 'Sample market') + '</span></div>' +
          '<h2 class="pd-q">' + esc(m.q) + '</h2>' +
          '<div id="pdInfo">' + infoHtml(m) + '</div>' +
          '<div class="pd-chart" id="pdChart"></div>' +
          '<div class="pd-legend" id="pdLegend"></div>' +
          '<div class="table-scroll"><table class="tbl pd-out"><thead><tr><th>Outcome</th><th>Chance</th><th>Buy ' + (m.auto ? 'Up' : 'YES') + '</th><th>Buy ' + (m.auto ? 'Down' : 'NO') + '</th></tr></thead><tbody id="pdOutcomes">' + outcomesHtml(m) + '</tbody></table></div>' +
          '<div class="pd-rules"><h4>Resolution rules</h4><p>' + esc(m.rule) + '</p><h4>Resolution source</h4><p>' + esc(m.source) + ' <span class="muted">' + (m.auto ? '(read automatically at the round start and end)' : '(reference only: this sample market is not connected to it)') + '</span></p>' +
          (res || m.auto ? '' : '<button class="btn-ghost sm" data-pm="resolve" data-m="' + m.id + '">Resolve (demo)…</button>') +
          (res && m.auto ? '<button class="btn-ghost sm" data-pm="current">Open the current round →</button>' : '') + '</div>' +
        '</section>' +
        '<aside class="pd-side">' +
          '<section class="panel ticket pd-ticket" id="pdTicket">' + ticketHtml(m) + '</section>' +
          '<section class="panel" id="pdYou">' + youHtml(m) + '</section>' +
          '<section class="panel book pd-book" id="pdBook">' + renderBook(m) + '</section>' +
        '</aside>' +
      '</div>' +
      '<div class="pd-extra">' +
        '<section class="sec"><div class="sec-h"><h2>Related markets</h2></div><div id="pdRel">' + relatedHtml(m) + '</div></section>' +
        '<section class="sec"><div class="sec-h"><h2>Discussion</h2><span class="tag">sample comments</span></div><div id="pdCm">' + commentsHtml(m) + '</div></section>' +
      '</div>';
    bindTicket(m);
    var cmIn = document.getElementById('cmIn');
    if (cmIn) cmIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') postComment(m); });
    buildChart(m);
    updQuote();
  }

  function infoHtml(m) {
    var res = m.status !== 'open';
    return '<dl class="pd-stats"><div><dt>Volume</dt><dd class="mono">' + usd0(m.vol) + '</dd></div><div><dt>Trades</dt><dd class="mono">' + m.trades + '</dd></div>' +
      '<div><dt>Liquidity (b)</dt><dd class="mono">' + m.b.toLocaleString('en-US') + '</dd></div><div><dt>Max MM loss</dt><dd class="mono" title="Worst case for the market maker: b · ln(1 / lowest starting probability)">' + H.usd(E.lmsrMaxLoss(m.b, m.auto ? [0.5, 0.5] : m.p0)) + '</dd></div>' +
      '<div><dt>Closes</dt><dd>' + esc(m.close) + '</dd></div><div><dt>Status</dt><dd>' + (res ? (m.status === 'resolved' ? 'Resolved: ' : '') + '<b>' + esc(statusText(m)) + '</b>' : expired(m) ? '<span class="warn">Awaiting resolution</span>' : '<span class="up">Open</span>') + '</dd></div></dl>' + autoInfo(m, true);
  }

  function outcomesHtml(m) {
    var pr = prices(m), res = m.status !== 'open';
    var n = m.type === 'binary' ? 1 : m.outcomes.length, out = '';
    for (var j = 0; j < n; j++) {
      var nm = m.type === 'binary' ? sideName(m, 'yes') : m.outcomes[j];
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
      rows += '<tr><td><b class="' + s + '">' + esc(label(m, i, s)) + '</b></td><td class="mono">' + shTxt(c.sh) + '</td><td class="mono">' + cents(c.cost / c.sh) + '</td><td class="mono">' + H.usd(v) + '</td><td class="mono ' + (pnl >= 0 ? 'up' : 'down') + '">' + H.signed(pnl) + '</td></tr>';
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
    if (res) return '<div class="panel-title">Trading closed</div><p class="fine">' + (m.auto ? (m.status === 'resolved' ? 'This round settled automatically: <b>' + esc(statusText(m)) + '</b>.' : esc(closedMsg(m))) + ' A new round opens every 15 minutes.' : 'This sample market was resolved (demo) to <b>' + esc(statusText(m)) + '</b>.') + '</p>';
    var multi = m.type !== 'binary';
    return '<div class="panel-title">Trade</div>' +
      (multi ? '<div class="field"><label for="ptOut">Outcome</label><select id="ptOut" class="select">' + m.outcomes.map(function (o, j) { return '<option value="' + j + '"' + (j === d.i ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="seg seg-side" id="ptSide"><button class="seg-btn long' + (d.s === 'yes' ? ' is-active' : '') + '" data-s="yes">' + sideName(m, 'yes') + ' <span class="mono" id="ptPy"></span></button><button class="seg-btn short' + (d.s === 'no' ? ' is-active' : '') + '" data-s="no">' + sideName(m, 'no') + ' <span class="mono" id="ptPn"></span></button></div>' +
      '<div class="pt-row"><div class="seg seg-sm" id="ptDir"><button class="seg-btn' + (d.dir === 'buy' ? ' is-active' : '') + '" data-dir="buy">Buy</button><button class="seg-btn' + (d.dir === 'sell' ? ' is-active' : '') + '" data-dir="sell">Sell</button></div>' +
      '<div class="seg seg-sm" id="ptType"><button class="seg-btn' + (d.type === 'market' ? ' is-active' : '') + '" data-type="market">Market</button><button class="seg-btn' + (d.type === 'limit' ? ' is-active' : '') + '" data-type="limit">Limit</button></div></div>' +
      '<div class="field"' + (d.type === 'limit' ? '' : ' hidden') + ' id="ptLimF"><label for="ptLim">Limit price</label><div class="input"><input id="ptLim" class="mono" inputmode="decimal" autocomplete="off" value="' + esc(d.lim) + '" placeholder="1 - 99"><span class="unit">¢</span></div></div>' +
      '<div class="field"><label for="ptAmt" id="ptAmtL">' + (d.dir === 'buy' ? 'Amount' : 'Shares') + '</label><div class="input"><input id="ptAmt" class="mono" inputmode="decimal" autocomplete="off" value="' + esc(d.amt) + '"><span class="unit" id="ptUnit">' + (d.dir === 'buy' ? 'USD' : 'shares') + '</span></div>' +
      '<div class="chips" id="ptChips"></div></div>' +
      '<dl class="summary" id="ptSum"></dl><div class="ticket-err" id="ptErr" role="alert"></div>' +
      '<button class="btn-submit ' + (d.s === 'yes' ? 'long' : 'short') + '" id="ptGo"></button>' +
      (m.auto ? '' : '<button class="btn-ghost sm" id="ptCombo" style="width:100%;margin-top:6px"><i class="ph ph-plus" aria-hidden="true"></i>Add to combo</button>') +
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
      : '<button data-f="0.25"' + (have ? '' : ' disabled') + '>25%</button><button data-f="0.5"' + (have ? '' : ' disabled') + '>50%</button><button data-f="1"' + (have ? '' : ' disabled') + ' title="Sell the whole holding">Max</button>';
    if (chips.dataset.k !== detail.dir + have.toFixed(4)) { chips.innerHTML = want; chips.dataset.k = detail.dir + have.toFixed(4); }
    updTicketPrices(m);
  }

  var busy = false;
  function bindTicket(m) {
    var t = document.getElementById('pdTicket'); if (!t || m.status !== 'open') return;
    var amt = document.getElementById('ptAmt'), lim = document.getElementById('ptLim'), out = document.getElementById('ptOut');
    amt.addEventListener('input', function () { detail.amt = amt.value.trim(); updQuote(); });
    lim.addEventListener('input', function () { detail.lim = lim.value.trim(); updQuote(); });
    if (out) out.addEventListener('change', function () { detail.i = +out.value; if (detail.dir === 'sell') detail.amt = sellAmt(m, detail.i, detail.s); renderDetail(false); });
    t.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.s) { detail.s = b.dataset.s; if (detail.dir === 'sell') detail.amt = sellAmt(m, detail.i, detail.s); renderDetail(false); return; }
      if (b.dataset.dir) { detail.dir = b.dataset.dir; detail.amt = detail.dir === 'sell' ? sellAmt(m, detail.i, detail.s) : '100'; renderDetail(false); return; }
      if (b.dataset.type) { detail.type = b.dataset.type; if (detail.type === 'limit' && !detail.lim) detail.lim = String(Math.max(1, Math.min(99, Math.round(side(m, detail.i, detail.s) * 100) + (detail.dir === 'buy' ? -2 : 2)))); renderDetail(false); return; }
      if (b.dataset.q) { amt.value = b.dataset.q === 'max' ? String(Math.floor(S.balance * 100) / 100) : b.dataset.q; detail.amt = amt.value; updQuote(); return; }
      if (b.dataset.f) { var h = hold(m)[hk(detail.i, detail.s)]; var hv2 = h ? h.sh : 0; amt.value = shTxt(hv2 * +b.dataset.f); detail.amt = amt.value; updQuote(); return; }
      if (b.id === 'ptGo') submit(m);
      if (b.id === 'ptCombo') {
        var r = addLeg(m, detail.i, detail.s);
        if (typeof r === 'string') { document.getElementById('ptErr').textContent = r; return; }
        H.toast(r.replaced ? 'Combo leg updated' : 'Added to combo', label(m, detail.i, detail.s) + ' · ' + m.q + ' (' + S.pm.slip.length + ' of ' + COMBO_MAX + ' legs)', 'ok');
        H.changed(true);
      }
    });
    amt.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(m); });
  }

  function postComment(m) {
    var inp = document.getElementById('cmIn'); if (!inp) return;
    claim();
    var t = inp.value.trim();
    if (t.length < 2) { inp.classList.add('bad'); return; }
    inp.classList.remove('bad');
    if (!S.pm.comments) S.pm.comments = {};
    (S.pm.comments[m.id] = S.pm.comments[m.id] || []).unshift({ t: Date.now(), text: t.slice(0, 280) });
    document.getElementById('pdCm').innerHTML = commentsHtml(m);
    var n = document.getElementById('cmIn'); if (n) { n.addEventListener('keydown', function (e) { if (e.key === 'Enter') postComment(m); }); }
    H.changed(true);
  }

  function submit(m) {
    if (busy) return;                  // guards against double clicks
    busy = true; setTimeout(function () { busy = false; }, 350);
    var d = detail, v = pnum(d.amt), r;
    if (d.dir === 'sell') {   // "sell 10.00" of 10.006 held sells everything (no 0.006 left behind)
      var hh = hold(m)[hk(d.i, d.s)];
      if (hh && v > 0 && Math.abs(v - hh.sh) < SELL_SNAP) v = hh.sh;
    }
    if (d.type === 'limit') {
      r = placeLimit(m, d.i, d.s, d.dir, pnum(d.lim) / 100, v);
      if (typeof r === 'string') { document.getElementById('ptErr').textContent = r; return; }
      H.toast('Limit order placed', (d.dir === 'buy' ? 'Buy ' : 'Sell ') + label(m, d.i, d.s) + ' @ ' + pnum(d.lim).toFixed(1) + '¢' + (r.filled ? ' · filled ' + r.filled.toFixed(2) + ' sh so far' : ''), 'ok');
    } else if (d.dir === 'buy') {
      r = buy(m, d.i, d.s, v);
      if (typeof r === 'string') { document.getElementById('ptErr').textContent = r; return; }
      H.toast('Bought ' + r.shares.toFixed(2) + ' ' + label(m, d.i, d.s), 'avg ' + cents(r.avg) + ' · ' + m.q, 'ok');
    } else {
      r = sell(m, d.i, d.s, v);
      if (typeof r === 'string') { document.getElementById('ptErr').textContent = r; return; }
      H.toast('Sold ' + shTxt(v) + ' ' + label(m, d.i, d.s) + ' for ' + H.usd(r.usd), 'PnL ' + H.signed(r.pnl), r.pnl >= 0 ? 'ok' : 'bad');
      d.amt = sellAmt(m, d.i, d.s);
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
    document.getElementById('pdLegend').innerHTML = show.map(function (j) { return '<span><i style="background:' + COLORS[j % COLORS.length] + '"></i>' + esc(m.type === 'binary' ? sideName(m, 'yes') : m.outcomes[j]) + '</span>'; }).join('') + '<span class="muted">' + (m.auto ? 'Odds during this round' : 'Earlier points: simulated warm-up history') + '</span>';
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
      '<p class="fine">Sample market: you choose the outcome. Winning shares pay $1.00 each, losing shares expire at $0, and open limit orders on this market are canceled and refunded.</p>' +
      '<div class="rs-list">' + m.outcomes.map(function (o, j) { return '<button class="pm-btn ' + (m.type === 'binary' ? (j === 0 ? 'yes' : 'no') : 'yes') + '" data-w="' + j + '">' + (m.type === 'binary' ? 'Resolve ' + esc(o.toUpperCase()) : esc(o)) + '</button>'; }).join('') + '</div></div>');
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

  /* ---------------- 15-minute BTC Up/Down rounds (auto-settled) ----------------
   * Like the short-term crypto markets on Polymarket / Kalshi. A new round opens every 15 minutes
   * (aligned to UTC quarter hours). "Price to beat" = BTC/USDT at the round start, settlement =
   * BTC/USDT at the round end (open of the Binance 1-minute candle at each moment). UP wins when
   * end >= start. Odds come from the local market maker (simulated flow). Both prices come from the
   * same source, live Binance data: while Binance is unreachable the price to beat is not set and the
   * round cannot be traded, and a round whose end price cannot be read from Binance (network down,
   * page closed) is voided and every stake is refunded. A round is never settled on a sample price. */
  var ROUND_MS = 15 * 60000, AUTO_B = 3000, SIG_S = 0.55 / Math.sqrt(365 * 86400);
  function DD() { return root.VXData; }
  function btcNow() { var d = DD(), t = d && d.tick.BTC; return t ? t.price : 0; }
  function btcState() { var d = DD(); return d ? d.BY_ID.BTC.state : 'pending'; }
  function btcLive() { return btcState() === 'live'; }
  function utc(ms) { var d = new Date(ms); return ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2); }
  function mmss(ms) { ms = Math.max(0, ms); var t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }
  function money(v) { return v > 0 ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'; }
  function ncdf(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }
  function fairUp(m) {
    var K = m.round.strike, P = btcNow(), left = (m.round.end - Date.now()) / 1000;
    if (!(K > 0) || !(P > 0)) return 0.5;
    if (left <= 1) return P >= K ? 0.97 : 0.03;
    return Math.min(0.97, Math.max(0.03, ncdf(Math.log(P / K) / (SIG_S * Math.sqrt(left)))));
  }
  function newRound(start) {
    var end = start + ROUND_MS;
    return { id: 'btc15-' + start, auto: 'btc15', cat: 'Crypto', type: 'binary', b: AUTO_B, outcomes: ['Up', 'Down'], p0: [0.5, 0.5],
      q: 'Bitcoin Up or Down · ' + utc(start) + '-' + utc(end) + ' UTC', close: utc(end) + ' UTC',
      rule: 'Resolves UP if the BTC/USDT price at the end of the round (' + utc(end) + ' UTC) is greater than or equal to the price at the start (' + utc(start) + ' UTC, the “price to beat”); otherwise DOWN. Settles automatically from the price feed, no manual resolution. If the end price cannot be read, the round is voided and stakes are refunded.',
      source: 'Binance BTC/USDT public market data: open of the 1-minute candle at the round start and at the round end.',
      qv: E.lmsrInit([0.5, 0.5], AUTO_B), status: 'open', winner: null, vol: 0, trades: 0, hist: [[Math.floor(Date.now() / 1000), [0.5, 0.5]]],
      round: { start: start, end: end, strike: null, strikeSrc: '', close: null, closeSrc: '' } };
  }
  var autoBusy = {};
  function fetchStrike(m) {
    if (autoBusy[m.id] || m.round.strike > 0) return;
    autoBusy[m.id] = true;
    var d = DD();
    var ok = function (p, src) {
      delete autoBusy[m.id];
      if (!(m.round.strike > 0) && p > 0 && m.status === 'open') { m.round.strike = p; m.round.strikeSrc = src; refreshAuto(true, true); }
    };
    // only a live Binance price can be the price to beat (the end price must come from the same source)
    var fallback = function () {
      var p = btcNow();
      if (!(p > 0) || !btcLive()) { delete autoBusy[m.id]; return; }   // try again on the next tick
      ok(p, Date.now() - m.round.start < 90000 ? 'Binance last price' : 'Binance price when this round was first opened in this browser');
    };
    if (!btcLive()) { delete autoBusy[m.id]; return; }
    if (d && d.priceAt) d.priceAt('BTC', m.round.start).then(function (p) { ok(p, 'Binance 1-minute candle open'); }, fallback);
    else fallback();
  }
  function settleAuto(m) {
    if (autoBusy[m.id + ':end']) return;
    autoBusy[m.id + ':end'] = true;
    m.status = 'closing';
    S.pm.orders.filter(function (o) { return o.mid === m.id; }).forEach(function (o) { cancelOrder(o.id, true); });
    var d = DD(), late = Date.now() - m.round.end;
    var done = function (p, src) {
      delete autoBusy[m.id + ':end'];
      if (m.status !== 'closing') return;
      if (!(m.round.strike > 0) || !(p > 0) || /sample/i.test(m.round.strikeSrc || '')) { voidAuto(m); return; }   // never mix sources
      m.round.close = p; m.round.closeSrc = src;
      var w = p >= m.round.strike ? 0 : 1, r = resolve(m, w);
      if (r && r.had) H.toast('BTC round settled: ' + m.outcomes[w], 'Start ' + money(m.round.strike) + ' → end ' + money(p) + ' · payout ' + H.usd(r.payout) + ' (' + H.signed(r.pnl) + ')', r.pnl >= 0 ? 'ok' : 'bad');
      refreshAuto(true, true);
    };
    // the live tick is used only if Binance is live and it was taken within seconds of the round end;
    // with Binance unreachable the round is voided (stakes refunded), never settled on a sample price
    var fallback = function () {
      if (btcLive() && late < 20000 && btcNow() > 0) done(btcNow(), 'Binance last price');
      else done(0, '');
    };
    if (d && d.priceAt && btcLive()) d.priceAt('BTC', m.round.end).then(function (p) { done(p, 'Binance 1-minute candle open'); }, fallback);
    else fallback();
  }
  function voidAuto(m) {
    S.pm.orders.filter(function (o) { return o.mid === m.id; }).forEach(function (o) { cancelOrder(o.id, true); });
    var h = S.pm.pos[m.id] || {}, refund = 0;
    Object.keys(h).forEach(function (key) { refund += h[key].cost; });
    S.balance += refund;
    delete S.pm.pos[m.id];
    m.status = 'void'; m.winner = null; m.settled = { payout: refund, pnl: 0, had: refund > 0 };
    if (refund > 0) { log('Voided', m, 0, 'yes', null, refund, 0); H.toast('BTC round voided', (m.round.strike > 0 ? 'The end price could not be read from Binance' : 'Binance did not answer during the round') + '. Stakes refunded: ' + H.usd(refund), 'warn'); }
    refreshAuto(true, true);
  }
  function currentRound() { var r = null; S.pm.markets.forEach(function (m) { if (m.auto && (!r || m.round.start > r.round.start)) r = m; }); return r; }
  function autoTick() {
    if (!S || !S.pm || !S.pm.markets) return;
    var now = Date.now(), start = Math.floor(now / ROUND_MS) * ROUND_MS, added = false, waiting = btcState() === 'pending';
    if (!canWrite()) { liveText(now); return; }   // another tab is the writer: it opens and settles rounds
    S.pm.markets.forEach(function (m) {
      if (!m.auto || waiting) return;   // wait until the BTC source has answered (live or offline)
      if (m.status === 'open' && now >= m.round.end + 2000) settleAuto(m);
      else if (m.status === 'closing') settleAuto(m);
      else if (m.status === 'open' && !(m.round.strike > 0)) fetchStrike(m);
    });
    if (!S.pm.markets.some(function (m) { return m.auto && m.round.start === start; })) {
      var nm = newRound(start);
      S.pm.markets.unshift(nm); added = true;
      if (!waiting) fetchStrike(nm);
      // keep the current round and the most recent finished one
      var autos = S.pm.markets.filter(function (m) { return m.auto; }).sort(function (a, b) { return b.round.start - a.round.start; });
      var drop = autos.slice(2).filter(function (m) { return m.status === 'resolved' || m.status === 'void'; }).map(function (m) { return m.id; });
      if (drop.length) S.pm.markets = S.pm.markets.filter(function (m) { return drop.indexOf(m.id) < 0; });
    }
    if (added && el.grid) refreshAuto(true, true);
    liveText(now);
  }
  /* live text (countdown, BTC price): text only, buttons are not re-rendered */
  function liveText(now) {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-cd]').forEach(function (x) { x.textContent = mmss(+x.dataset.cd - now); });
    var bn = btcNow();
    document.querySelectorAll('[data-btcnow]').forEach(function (x) {
      var m = mk(x.dataset.btcnow); if (!m) return;
      x.textContent = money(bn);
      x.className = 'mono ' + (m.round.strike > 0 ? (bn >= m.round.strike ? 'up' : 'down') : '');
    });
  }
  function autoFlow() {
    if (!S || !S.pm || !canWrite() || hidden()) return;
    S.pm.markets.forEach(function (m) {
      if (!m.auto || m.status !== 'open' || !(m.round.strike > 0)) return;
      var f = fairUp(m), p = prices(m)[0], diff = f - p;
      m.p0 = [f, 1 - f];
      if (Math.abs(diff) < 0.004) return;
      var amt = Math.min(1500, Math.max(10, Math.abs(diff) * 4000 * (0.6 + Math.random() * 0.5)));
      execBuy(m, 0, diff > 0 ? 'yes' : 'no', amt, 'flow');
      var filled = checkOrders(m);
      if (ptrBusy()) { pend[m.id] = true; pend._any = true; if (filled) pend._imp = true; return; }
      refreshMarket(m, false); H.changed(filled > 0);
    });
  }
  function refreshAuto(structural, important) {
    if (!el.grid) return;
    if (ptrBusy()) { pend._grid = true; pend._any = true; if (important) pend._imp = true; return; }
    if (detail) { var cur = mk(detail.m.id); if (cur) { detail.m = cur; renderDetail(!structural); } else closeDetail(); }
    else renderGrid();
    H.changed(!!important);
  }
  function autoBadge(m) {
    if (!m.auto) return '';
    var b = btcLive();
    return '<span class="badge ' + (b ? 'b-live' : 'b-off') + '" title="' + (b ? 'Price to beat and settlement use live Binance BTC/USDT data' : 'Binance is unreachable: the BTC price is sample data') + '">' + (b ? 'Live BTC' : 'BTC sample') + '</span>';
  }
  function autoInfo(m, wide) {
    if (!m.auto) return '';
    var r = m.round, res = m.status !== 'open';
    var a = '<div><dt>Price to beat</dt><dd class="mono">' + (r.strike > 0 ? money(r.strike) : res ? '—' : btcLive() ? 'loading…' : 'waiting for Binance') + '</dd></div>';
    var b = res ? '<div><dt>End price</dt><dd class="mono">' + (r.close ? money(r.close) : '—') + '</dd></div>'
                : '<div><dt>BTC now</dt><dd class="mono" data-btcnow="' + m.id + '">' + money(btcNow()) + '</dd></div>';
    var c = res ? '<div><dt>Round</dt><dd class="mono">' + utc(r.start) + '-' + utc(r.end) + '</dd></div>'
                : '<div><dt>Ends in</dt><dd class="mono" data-cd="' + r.end + '">' + mmss(r.end - Date.now()) + '</dd></div>';
    var src = wide ? '<p class="fine">Start price: ' + esc(r.strikeSrc || (res ? 'not available' : btcLive() ? 'loading…' : 'waiting for live Binance data (trading opens when it arrives)')) + (r.closeSrc ? ' · end price: ' + esc(r.closeSrc) : '') + '. Odds come from the demo market maker with simulated flow.</p>' : '';
    return '<dl class="pd-stats pm-auto">' + a + b + c + '</dl>' + src;
  }

  /* background renders wait while a pointer is pressed (otherwise the click would be lost) */
  var pend = {};
  function ptrBusy() { return !!(root.VXPointerBusy && root.VXPointerBusy()); }
  function flushPending() {
    if (!pend._any || ptrBusy() || !S || !S.pm) return;
    var p = pend; pend = {};
    if (p._grid) { if (detail) { var cur = mk(detail.m.id); if (cur) { detail.m = cur; renderDetail(true); } else closeDetail(); } else renderGrid(); }
    else Object.keys(p).forEach(function (id) { if (id.charAt(0) !== '_') { var m = mk(id); if (m) refreshMarket(m, false); } });
    H.changed(!!p._imp);
  }

  /* ---------------- init ---------------- */
  var flowTimer = null;
  function finite(x) { return typeof x === 'number' && isFinite(x); }
  function validMarket(m) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !Array.isArray(m.outcomes) || m.outcomes.length < 2) return false;
    if (!Array.isArray(m.qv) || m.qv.length !== m.outcomes.length || !m.qv.every(finite)) return false;
    if (!(finite(m.b) && m.b > 0) || !Array.isArray(m.hist) || !Array.isArray(m.p0) || typeof m.q !== 'string') return false;
    if (m.auto && (!m.round || !finite(m.round.start) || !finite(m.round.end))) return false;
    return true;
  }
  /* money tied up in a prediction state that cannot be used any more (old version or broken record):
     open buy orders and the cost of held shares and open combos go back to the balance */
  function refundOf(pm) {
    var r = 0;
    try {
      Object.keys(pm.pos || {}).forEach(function (mid) { var h = pm.pos[mid] || {}; Object.keys(h).forEach(function (k) { if (h[k] && finite(h[k].cost) && h[k].cost > 0) r += h[k].cost; }); });
      (pm.orders || []).forEach(function (o) { if (!o) return; if (o.dir === 'buy' && finite(o.rem) && o.rem > 0) r += o.rem; else if (o.dir === 'sell' && finite(o.basis) && o.basis > 0) r += o.basis; });
      (pm.combos || []).forEach(function (c) { if (c && c.status === 'open' && finite(c.stake) && c.stake > 0) r += c.stake; });
    } catch (e) {}
    return r;
  }
  function pmUsable(pm) {
    return pm && typeof pm === 'object' && pm.v === 2 && Array.isArray(pm.markets) && pm.markets.length && pm.markets.every(validMarket) &&
      (pm.pos == null || typeof pm.pos === 'object') && (pm.orders == null || Array.isArray(pm.orders)) && (pm.combos == null || Array.isArray(pm.combos));
  }
  function ensure(px) {
    if (!canWrite() && !S.pm) return;   // the writer tab builds the markets; this tab mirrors them
    if (!pmUsable(S.pm)) {
      var refund = S.pm && typeof S.pm === 'object' ? refundOf(S.pm) : 0;
      S.pm = { v: 2, markets: build(px), pos: {}, orders: [], hist: [] };
      if (refund > 0) {
        S.balance += refund;
        S.pm.hist.unshift({ t: Date.now(), kind: 'Refund', mid: '', q: 'Prediction markets were re-created', what: 'Open orders and shares refunded at cost', sh: null, usd: refund, pnl: null });
        if (H && H.toast) H.toast('Prediction markets re-created', 'Saved prediction data could not be used. Open orders and shares were refunded at cost: ' + H.usd(refund), 'warn');
      }
    }
    if (!S.pm.pos || typeof S.pm.pos !== 'object') S.pm.pos = {};
    Object.keys(S.pm.pos).forEach(function (mid) { if (!S.pm.pos[mid] || typeof S.pm.pos[mid] !== 'object' || !Object.keys(S.pm.pos[mid]).length) delete S.pm.pos[mid]; });
    if (!Array.isArray(S.pm.orders)) S.pm.orders = [];
    if (!Array.isArray(S.pm.combos)) S.pm.combos = [];
    if (!Array.isArray(S.pm.slip)) S.pm.slip = [];
    if (!Array.isArray(S.pm.hist)) S.pm.hist = [];
    if (!S.pm.comments || typeof S.pm.comments !== 'object') S.pm.comments = {};
    if (!canWrite()) return;
    // markets added to the catalogue after this browser saved its state
    var have = {}; S.pm.markets.forEach(function (m) { have[m.id] = true; });
    var missing = catalogue(px).filter(function (d) { return !have[d.id]; });
    if (missing.length) { var ids = missing.map(function (d) { return d.id; }); build(px).forEach(function (m) { if (ids.indexOf(m.id) >= 0) S.pm.markets.push(m); }); }
    autoTick();
  }

  function init(state, hooks) {
    S = state; H = hooks;
    el = { grid: document.getElementById('pmGrid'), list: document.getElementById('pmList'), detail: document.getElementById('pmDetail'),
           cats: document.getElementById('pmCats'), pos: document.getElementById('pmPositions'), ord: document.getElementById('pmOrders'),
           hist: document.getElementById('pmHistory'), sum: document.getElementById('pmSummary'), combo: document.getElementById('pmCombo'), board: document.getElementById('pmBoard') };
    var so = document.getElementById('pmSort');
    if (so) so.addEventListener('click', function (e) { var b = e.target.closest('[data-sort]'); if (!b) return; sortBy = b.dataset.sort; so.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); }); renderGrid(); });
    el.cats.innerHTML = ['All'].concat(CATS).map(function (c) { return '<button class="seg-btn" data-cat="' + c + '">' + c + '</button>'; }).join('');
    el.cats.addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; filter = b.dataset.cat; renderGrid(); });
    document.getElementById('viewPredict').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pm]'); if (!b) return;
      var a = b.dataset.pm;
      if (a === 'back') { closeDetail(); return; }
      if (a === 'cancel') { cancelOrder(b.dataset.o); H.toast('Limit order canceled', 'Reserved funds/shares returned', 'ok'); H.changed(true); if (detail) renderDetail(false); else renderSide(); return; }
      if (a === 'current') { var cr = currentRound(); if (cr) openDetail(cr); return; }
      if (a === 'pick') { detail.i = +b.dataset.i; detail.s = b.dataset.s; detail.dir = 'buy'; detail.amt = detail.amt || '100'; renderDetail(false); return; }
      if (a === 'combo-rm') { removeLeg(b.dataset.m); H.changed(true); return; }
      if (a === 'combo-clear') { S.pm.slip = []; H.changed(true); return; }
      if (a === 'combo-place') {
        var cr = placeCombo(pnum(comboStake));
        if (typeof cr === 'string') { var ce = document.getElementById('cbErr'); if (ce) ce.textContent = cr; return; }
        H.toast('Combo placed · ' + cr.legs.length + ' legs', 'Stake ' + H.usd(cr.stake) + ' · pays ' + H.usd(cr.payout) + ' if every leg wins', 'ok');
        H.changed(true); return;
      }
      if (a === 'comment') { if (detail) postComment(detail.m); return; }
      var m = mk(b.dataset.m); if (!m) return;
      if (a === 'open') openDetail(m);
      else if (a === 'trade') openDetail(m, +b.dataset.i, b.dataset.s, b.dataset.dir);
      else if (a === 'resolve') openResolve(m);
    });
    if (!flowTimer) { flowTimer = setInterval(flow, 3000); setInterval(autoTick, 1000); setInterval(autoFlow, 2000); setInterval(flushPending, 250); }
  }

  function setState(state) { S = state; if (detail) closeDetail(); }
  /* the shared state was replaced by the writer tab's copy: keep the open market page, refresh it */
  function resync() {
    if (!S || !S.pm) return;
    if (detail) { var m = mk(detail.m.id); if (m) { detail.m = m; renderDetail(true); renderSide(); } else closeDetail(); }
    else { renderGrid(); renderSide(); }
  }
  function render() { if (detail) renderDetail(true); else renderGrid(); renderSide(); }
  function renderAll() { if (detail) { var m = mk(detail.m.id); if (m) { detail.m = m; renderDetail(false); } else closeDetail(); } else renderGrid(); renderSide(); }

  root.VXPredict = { init: init, ensure: ensure, render: render, renderAll: renderAll, renderSide: renderSide, setState: setState, resync: resync, expired: expired,
                     value: holdingsValue, unrealized: unrealized, prices: prices, buy: buy, sell: sell, placeLimit: placeLimit,
                     cancelOrder: cancelOrder, resolve: resolve, flow: flow, market: mk, openDetail: openDetail, closeDetail: closeDetail,
                     createMarket: createMarket, addLeg: addLeg, removeLeg: removeLeg, placeCombo: placeCombo, comboValue: comboValue, slipPrice: slipPrice,
                     markets: function () { return S && S.pm ? S.pm.markets : []; }, CATS: CATS, label: label, endsOf: endsOf };
})(window);
