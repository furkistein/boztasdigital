/* Demo Exchange — market data layer.
 *
 * Real, keyless, browser-accessible (CORS) sources used by the demo:
 *   Binance public API  — crypto + PAXG: REST api.binance.com (fallback data-api.binance.vision),
 *                          WebSocket stream.binance.com:9443 (fallback data-stream.binance.vision).
 *   gold-api.com         — spot gold, silver, platinum, palladium, copper (polled every 12 s).
 *   Frankfurter (v2)     — daily FX reference rates incl. USD/TRY (fallback open.er-api.com, daily).
 * Everything else (energy, agriculture, indices, stocks) is SAMPLE data: a seeded random walk
 * around a reference close (Yahoo Finance close of 16 Oct 2026, typed in by hand).
 * FX trades on simulated intraday ticks around the real daily rate.
 * When a source cannot be reached, its assets fall back to sample data and are re-labelled.
 */
(function (root) {
  'use strict';

  var REF_DATE = '16 Oct 2026';

  var CLASS = {
    cmd:    { label: 'Commodities', maxLev: 20,  taker: 0.0001,  maker: 0.0001 },
    crypto: { label: 'Crypto',      maxLev: 50,  taker: 0.0005,  maker: 0.0002 },
    fx:     { label: 'Forex',       maxLev: 100, taker: 0.00002, maker: 0.00002 },
    idx:    { label: 'Indices',     maxLev: 20,  taker: 0.0001,  maker: 0.0001 },
    stk:    { label: 'Stocks',      maxLev: 5,   taker: 0.0005,  maker: 0.0005 }
  };
  var SUB = { metals: 'Metals', energy: 'Energy', ag: 'Agriculture' };

  var H_CME = 'Sun–Fri 18:00–17:00 ET (60-min daily break)';
  var H_FX = '24/5 · Sun 17:00 – Fri 17:00 ET';
  var H_US_IDX = 'Sun–Fri 18:00–17:00 ET (index CFD)';
  var H_STK = 'Mon–Fri 09:30–16:00 ET (regular session)';

  // [id, symbol, name, cat, sub, feed, feedKey, decimals, refClose, prevClose, annualVol, spread, unit, hours, kind]
  var RAW = [
    // ---- commodities: metals
    ['XAUUSD', 'XAU/USD', 'Gold',      'cmd', 'metals', 'goldapi', 'XAU', 2, 4181.10, 4190.60, 0.18, 0.30, 'USD per troy oz', H_CME],
    ['XAGUSD', 'XAG/USD', 'Silver',    'cmd', 'metals', 'goldapi', 'XAG', 3, 57.305, 60.141, 0.32, 0.025, 'USD per troy oz', H_CME],
    ['XPTUSD', 'XPT/USD', 'Platinum',  'cmd', 'metals', 'goldapi', 'XPT', 2, 1633.10, 1679.40, 0.28, 1.50, 'USD per troy oz', H_CME],
    ['XPDUSD', 'XPD/USD', 'Palladium', 'cmd', 'metals', 'goldapi', 'XPD', 2, 1118.60, 1136.10, 0.35, 2.50, 'USD per troy oz', H_CME],
    ['COPPER', 'COPPER',  'Copper',    'cmd', 'metals', 'goldapi', 'HG',  4, 6.5735, 6.6985, 0.25, 0.003, 'USD per lb', H_CME],
    ['PAXG',   'PAXG/USDT', 'PAX Gold (tokenized gold)', 'cmd', 'metals', 'binance', 'PAXGUSDT', 2, 4164.08, 4164.08, 0.18, 0, '1 token = 1 troy oz', '24/7'],
    // ---- commodities: energy
    ['BRENT',  'BRENT',   'Brent crude oil', 'cmd', 'energy', 'sample', null, 2, 109.86, 106.65, 0.38, 0.04, 'USD per barrel', 'Sun–Fri 20:00–18:00 ET (ICE)'],
    ['WTI',    'WTI',     'WTI crude oil',   'cmd', 'energy', 'sample', null, 2, 99.02, 93.74, 0.40, 0.04, 'USD per barrel', H_CME],
    ['NATGAS', 'NATGAS',  'Natural gas (Henry Hub)', 'cmd', 'energy', 'sample', null, 3, 3.116, 3.167, 0.60, 0.004, 'USD per MMBtu', H_CME],
    // ---- commodities: agriculture
    ['WHEAT',  'WHEAT',   'Wheat (CBOT)',    'cmd', 'ag', 'sample', null, 4, 6.6050, 6.7225, 0.30, 0.005, 'USD per bushel', 'Sun–Fri 20:00–08:45 & 09:30–14:20 CT'],
    ['CORN',   'CORN',    'Corn (CBOT)',     'cmd', 'ag', 'sample', null, 4, 4.7425, 4.8300, 0.26, 0.0025, 'USD per bushel', 'Sun–Fri 20:00–08:45 & 09:30–14:20 CT'],
    ['SOYBEAN','SOYBEAN', 'Soybeans (CBOT)', 'cmd', 'ag', 'sample', null, 4, 12.6125, 12.8775, 0.22, 0.005, 'USD per bushel', 'Sun–Fri 20:00–08:45 & 09:30–14:20 CT'],
    ['COFFEE', 'COFFEE',  'Coffee (Arabica)', 'cmd', 'ag', 'sample', null, 4, 3.0555, 2.9060, 0.38, 0.0015, 'USD per lb', 'Mon–Fri 04:15–13:30 ET (ICE)'],
    ['SUGAR',  'SUGAR',   'Sugar No. 11',    'cmd', 'ag', 'sample', null, 4, 0.2085, 0.2085, 0.30, 0.0002, 'USD per lb', 'Mon–Fri 03:30–13:00 ET (ICE)'],
    ['COCOA',  'COCOA',   'Cocoa',           'cmd', 'ag', 'sample', null, 0, 5686, 5676, 0.50, 6, 'USD per metric ton', 'Mon–Fri 04:45–13:30 ET (ICE)'],
    ['COTTON', 'COTTON',  'Cotton No. 2',    'cmd', 'ag', 'sample', null, 4, 0.8019, 0.8060, 0.24, 0.0008, 'USD per lb', 'Sun–Fri 21:00–14:20 ET (ICE)'],
    // ---- crypto (live Binance; ref values = Binance price at build time, used only if Binance is offline)
    ['BTC',  'BTC/USDT',  'Bitcoin',   'crypto', null, 'binance', 'BTCUSDT',  2, 81578.66, 81578.66, 0.55, 0, 'per BTC', '24/7'],
    ['ETH',  'ETH/USDT',  'Ethereum',  'crypto', null, 'binance', 'ETHUSDT',  2, 2427.99, 2427.99, 0.70, 0, 'per ETH', '24/7'],
    ['SOL',  'SOL/USDT',  'Solana',    'crypto', null, 'binance', 'SOLUSDT',  2, 104.37, 104.37, 0.85, 0, 'per SOL', '24/7'],
    ['BNB',  'BNB/USDT',  'BNB',       'crypto', null, 'binance', 'BNBUSDT',  2, 722.00, 722.00, 0.55, 0, 'per BNB', '24/7'],
    ['XRP',  'XRP/USDT',  'XRP',       'crypto', null, 'binance', 'XRPUSDT',  4, 1.3028, 1.3028, 0.85, 0, 'per XRP', '24/7'],
    ['DOGE', 'DOGE/USDT', 'Dogecoin',  'crypto', null, 'binance', 'DOGEUSDT', 5, 0.08001, 0.08001, 0.95, 0, 'per DOGE', '24/7'],
    ['ADA',  'ADA/USDT',  'Cardano',   'crypto', null, 'binance', 'ADAUSDT',  4, 0.2221, 0.2221, 0.90, 0, 'per ADA', '24/7'],
    ['AVAX', 'AVAX/USDT', 'Avalanche', 'crypto', null, 'binance', 'AVAXUSDT', 3, 9.897, 9.897, 0.95, 0, 'per AVAX', '24/7'],
    ['LINK', 'LINK/USDT', 'Chainlink', 'crypto', null, 'binance', 'LINKUSDT', 3, 12.03, 12.03, 0.90, 0, 'per LINK', '24/7'],
    // ---- forex (real daily rate + simulated intraday ticks). kind inverse = USD is the base currency
    ['EURUSD', 'EUR/USD', 'Euro / US Dollar',              'fx', null, 'fx', 'EUR', 5, 1.1242, 1.1205, 0.08, 0.00008, 'per 1 EUR', H_FX],
    ['GBPUSD', 'GBP/USD', 'British Pound / US Dollar',     'fx', null, 'fx', 'GBP', 5, 1.3330, 1.3242, 0.09, 0.00012, 'per 1 GBP', H_FX],
    ['USDJPY', 'USD/JPY', 'US Dollar / Japanese Yen',      'fx', null, 'fx', 'JPY', 3, 157.987, 158.203, 0.10, 0.012, 'JPY per 1 USD', H_FX, 'inverse'],
    ['USDTRY', 'USD/TRY', 'US Dollar / Turkish Lira',      'fx', null, 'fx', 'TRY', 4, 49.5091, 49.3353, 0.12, 0.020, 'TRY per 1 USD', H_FX, 'inverse'],
    ['AUDUSD', 'AUD/USD', 'Australian Dollar / US Dollar', 'fx', null, 'fx', 'AUD', 5, 0.6949, 0.6985, 0.10, 0.00010, 'per 1 AUD', H_FX],
    ['USDCHF', 'USD/CHF', 'US Dollar / Swiss Franc',       'fx', null, 'fx', 'CHF', 5, 0.8236, 0.8299, 0.09, 0.00012, 'CHF per 1 USD', H_FX, 'inverse'],
    ['USDCAD', 'USD/CAD', 'US Dollar / Canadian Dollar',   'fx', null, 'fx', 'CAD', 5, 1.4137, 1.4259, 0.08, 0.00015, 'CAD per 1 USD', H_FX, 'inverse'],
    // ---- indices (sample; USD-settled per index point in the demo)
    ['US500',  'US500',  'S&P 500',       'idx', null, 'sample', null, 2, 7659.44, 7811.54, 0.18, 0.5, 'USD 1 per point', H_US_IDX],
    ['NAS100', 'NAS100', 'Nasdaq 100',    'idx', null, 'sample', null, 2, 29187.55, 30883.15, 0.24, 1.5, 'USD 1 per point', H_US_IDX],
    ['US30',   'US30',   'Dow Jones 30',  'idx', null, 'sample', null, 2, 52002.41, 51654.95, 0.16, 3.0, 'USD 1 per point', H_US_IDX],
    ['GER40',  'GER40',  'DAX 40',        'idx', null, 'sample', null, 2, 25622.61, 25087.27, 0.18, 1.5, 'USD 1 per point', 'Mon–Fri 02:00–16:00 ET (index CFD)'],
    ['UK100',  'UK100',  'FTSE 100',      'idx', null, 'sample', null, 2, 10881.90, 10552.10, 0.15, 1.2, 'USD 1 per point', 'Mon–Fri 03:00–16:00 ET (index CFD)'],
    // ---- stocks (sample)
    ['AAPL',  'AAPL',  'Apple Inc.',        'stk', null, 'sample', null, 2, 343.46, 336.64, 0.28, 0.04, 'per share', H_STK],
    ['NVDA',  'NVDA',  'NVIDIA Corp.',      'stk', null, 'sample', null, 2, 214.13, 229.28, 0.48, 0.04, 'per share', H_STK],
    ['TSLA',  'TSLA',  'Tesla Inc.',        'stk', null, 'sample', null, 2, 354.72, 382.70, 0.58, 0.06, 'per share', H_STK],
    ['MSFT',  'MSFT',  'Microsoft Corp.',   'stk', null, 'sample', null, 2, 529.05, 535.07, 0.26, 0.05, 'per share', H_STK],
    ['AMZN',  'AMZN',  'Amazon.com Inc.',   'stk', null, 'sample', null, 2, 250.00, 262.43, 0.34, 0.04, 'per share', H_STK],
    ['META',  'META',  'Meta Platforms',    'stk', null, 'sample', null, 2, 709.33, 718.67, 0.38, 0.08, 'per share', H_STK],
    ['GOOGL', 'GOOGL', 'Alphabet Class A',  'stk', null, 'sample', null, 2, 340.59, 351.66, 0.30, 0.05, 'per share', H_STK]
  ];

  var ASSETS = RAW.map(function (r) {
    return { id: r[0], sym: r[1], name: r[2], cat: r[3], sub: r[4], feed: r[5], key: r[6], dp: r[7],
             ref: r[8], prev: r[9], vol: r[10], spread: r[11], unit: r[12], hours: r[13], kind: r[14] || 'linear',
             anchor: r[8], state: r[5] === 'sample' ? 'sample' : 'pending', srcName: '' };
  });
  var BY_ID = {}; ASSETS.forEach(function (a) { BY_ID[a.id] = a; });
  var BY_BIN = {}; ASSETS.forEach(function (a) { if (a.feed === 'binance') BY_BIN[a.key] = a; });

  var TF_SEC = { '1m': 60, '5m': 300, '1h': 3600, '1d': 86400 };
  var YEAR = 365 * 86400;
  var SIM_BOOST = 1.6;

  var tick = {};   // id -> { price, open24, high, low, vol, qvol, ts }
  var listeners = { tick: [], status: [], candle: [], book: [], source: [], reload: [] };
  function emit(ev, a, b) { listeners[ev].forEach(function (f) { try { f(a, b); } catch (e) { if (root.console) console.error(e); } }); }
  function on(ev, f) { listeners[ev].push(f); }

  /* ---------- helpers ---------- */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(rnd) { var u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var liveRnd = mulberry((Date.now() & 0xffffffff) >>> 0);

  function getJson(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 8000);
    return fetch(url, ctl ? { signal: ctl.signal, cache: 'no-store' } : {}).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw e; });
  }

  /* is the asset currently driven by the simulator? */
  function simulated(a) { return a.state === 'sample' || a.state === 'fallback' || a.state === 'daily'; }

  function badge(a) {
    switch (a.state) {
      case 'live':     return { text: 'Live · ' + a.srcName, cls: 'b-live', title: a.feed === 'goldapi' ? 'Real spot price from gold-api.com, refreshed every 12 s' : 'Real-time Binance public market data' };
      case 'daily':    return { text: 'Daily · ' + a.srcName, cls: 'b-daily', title: 'Real daily reference rate from ' + a.srcName + '; intraday ticks are simulated around it' };
      case 'fallback': return { text: 'Sample · offline', cls: 'b-off', title: 'Source unreachable: showing sample data around the ' + REF_DATE + ' close' };
      case 'pending':  return { text: 'Connecting…', cls: 'b-pend', title: 'Waiting for the data source' };
      default:         return { text: 'Sample', cls: 'b-sample', title: 'Sample data: simulated around the ' + REF_DATE + ' reference close' };
    }
  }

  function bidAsk(a, mid) {
    var p = mid != null ? mid : (tick[a.id] ? tick[a.id].price : a.anchor);
    var h = (a.spread || 0) / 2;
    return { bid: p - h, ask: p + h, mid: p };
  }

  function setState(a, st, srcName) {
    var changed = a.state !== st || a.srcName !== srcName;
    a.state = st; a.srcName = srcName || a.srcName;
    if (changed) emit('source', a);
  }

  /* ---------- sample history ---------- */
  function simHistory(a, tf, n, endPrice) {
    var dt = TF_SEC[tf];
    var sig = a.vol * Math.sqrt(dt / YEAR) * SIM_BOOST;
    var rnd = mulberry(hash(a.id + '|' + tf));
    var now = Math.floor(Date.now() / 1000 / dt) * dt;
    var closes = new Array(n);
    closes[n - 1] = endPrice;
    for (var i = n - 1; i > 0; i--) closes[i - 1] = closes[i] * Math.exp(-sig * gauss(rnd));
    var out = [], baseVol = 1000 * Math.sqrt(dt / 60);
    for (var j = 0; j < n; j++) {
      var o = j === 0 ? closes[0] * Math.exp(-sig * gauss(rnd) * 0.5) : closes[j - 1];
      var c = closes[j];
      out.push({ time: now - (n - 1 - j) * dt, open: o, close: c,
        high: Math.max(o, c) * (1 + Math.abs(gauss(rnd)) * sig * 0.45),
        low: Math.min(o, c) * (1 - Math.abs(gauss(rnd)) * sig * 0.45),
        volume: baseVol * Math.exp(gauss(rnd) * 0.5) });
    }
    return out;
  }

  /* ---------- selected-asset candle aggregation (non-Binance) ---------- */
  var sel = { id: 'XAUUSD', tf: '1m' };
  var curCandle = {};
  function feedCandle(a, p, dv) {
    if (sel.id !== a.id) return;
    var dtf = TF_SEC[sel.tf];
    var bucket = Math.floor(Date.now() / 1000 / dtf) * dtf;
    var c = curCandle[a.id];
    if (!c || c.time > bucket) return;           // history not loaded yet
    if (c.time !== bucket) { c = { time: bucket, open: c.close, high: c.close, low: c.close, close: c.close, volume: 0 }; curCandle[a.id] = c; }
    c.high = Math.max(c.high, p); c.low = Math.min(c.low, p); c.close = p; c.volume += dv || 0;
    emit('candle', a.id, { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
  }

  function setPrice(a, p, dv) {
    var t = tick[a.id];
    if (!t) t = tick[a.id] = { price: p, open24: a.ref, high: p, low: p, vol: 0, qvol: 0, ts: 0 };
    t.price = p; t.high = Math.max(t.high, p); t.low = Math.min(t.low, p);
    t.vol += dv || 0; t.qvol += (dv || 0) * p; t.ts = Date.now();
    emit('tick', a.id, t);
    feedCandle(a, p, dv);
    if (sel.id === a.id && (a.feed !== 'binance' || a.state === 'fallback')) emit('book', a.id, synthBook(a, p));
  }

  function seedTicker(a, price, prev) {
    var h = simHistory(a, '1h', 24, price);
    var hi = price, lo = price, v = 0;
    h.forEach(function (c) { hi = Math.max(hi, c.high); lo = Math.min(lo, c.low); v += c.volume; });
    tick[a.id] = { price: price, open24: prev, high: hi, low: lo, vol: v, qvol: v * price, ts: Date.now() };
    emit('tick', a.id, tick[a.id]);
  }

  function stepSim() {
    var sa = BY_ID[sel.id];
    if (sa && sa.feed === 'goldapi' && sa.state === 'live' && tick[sa.id]) emit('book', sa.id, synthBook(sa, tick[sa.id].price));
    ASSETS.forEach(function (a) {
      if (!simulated(a) || !tick[a.id]) return;
      var t = tick[a.id];
      var sig = a.vol * Math.sqrt(1 / YEAR) * SIM_BOOST * 6;
      var rev = -0.002 * Math.log(t.price / a.anchor);
      var p = t.price * Math.exp(sig * gauss(liveRnd) + rev);
      setPrice(a, p, Math.abs(gauss(liveRnd)) * 3);
    });
  }

  function synthBook(a, mid) {
    var ba = bidAsk(a, mid);
    var unit = Math.pow(10, -a.dp);
    var step = Math.max(unit, Math.round((a.spread || mid * 0.0001) / unit) * unit);
    var bids = [], asks = [];
    for (var i = 0; i < 10; i++) {
      var sz = (0.4 + liveRnd() * 2.2) * (1 + i * 0.3) * (20000 / mid);
      asks.push([ba.ask + i * step, sz]);
      bids.push([ba.bid - i * step, sz * (0.7 + liveRnd() * 0.6)]);
    }
    return { bids: bids, asks: asks, synthetic: true };
  }

  /* ================= Binance ================= */
  var REST = ['https://api.binance.com', 'https://data-api.binance.vision'];
  var WSS = ['wss://stream.binance.com:9443', 'wss://data-stream.binance.vision'];
  var restIdx = 0, wsIdx = 0;
  var bnStatus = { mode: 'connecting', host: '' };
  var binAssets = ASSETS.filter(function (a) { return a.feed === 'binance'; });

  function bnSetStatus(mode, host) { bnStatus.mode = mode; bnStatus.host = host || bnStatus.host; emit('status', bnStatus); }

  function bnFetch(path) {
    var order = [restIdx, 1 - restIdx];
    return getJson(REST[order[0]] + path).then(function (j) { restIdx = order[0]; return j; }, function () {
      return getJson(REST[order[1]] + path).then(function (j) { restIdx = order[1]; return j; });
    });
  }

  function bnLive() {
    binAssets.forEach(function (a) {
      if (a.state !== 'live') {
        setState(a, 'live', 'Binance');
        if (sel.id === a.id) emit('reload', a.id);
      }
    });
  }
  function bnFallback() {
    binAssets.forEach(function (a) {
      if (a.state === 'live' || a.state === 'pending') {
        if (!tick[a.id]) seedTicker(a, a.ref, a.ref); else a.anchor = tick[a.id].price;
        setState(a, 'fallback', 'Binance');
        if (sel.id === a.id) emit('reload', a.id);
      }
    });
  }

  function applyTicker(sym, c, o, h, l, v, q) {
    var a = BY_BIN[sym]; if (!a) return;
    tick[a.id] = { price: +c, open24: +o, high: +h, low: +l, vol: +v, qvol: +q, ts: Date.now() };
    emit('tick', a.id, tick[a.id]);
  }

  function bnTickersRest() {
    var syms = encodeURIComponent(JSON.stringify(binAssets.map(function (a) { return a.key; })));
    return bnFetch('/api/v3/ticker/24hr?symbols=' + syms).then(function (arr) {
      bnLive();
      arr.forEach(function (t) { applyTicker(t.symbol, t.lastPrice, t.openPrice, t.highPrice, t.lowPrice, t.volume, t.quoteVolume); });
    });
  }

  var ws = null, wsFails = 0, lastMsg = 0, reqId = 1, wsSubs = [], pollTimer = null;
  function selStreams() {
    var a = BY_ID[sel.id];
    if (!a || a.feed !== 'binance') return [];
    var s = a.key.toLowerCase();
    return [s + '@kline_' + sel.tf, s + '@depth10@100ms'];
  }
  function connectWs() {
    if (typeof WebSocket === 'undefined') { startPolling(); return; }
    if (ws) { try { ws.onclose = null; ws.close(); } catch (e) {} ws = null; }
    var base = binAssets.map(function (a) { return a.key.toLowerCase() + '@miniTicker'; });
    var sock;
    try { sock = new WebSocket(WSS[wsIdx] + '/stream?streams=' + base.concat(selStreams()).join('/')); } catch (e) { onWsFail(); return; }
    ws = sock; wsSubs = selStreams();
    var openTimer = setTimeout(function () { if (sock.readyState !== 1) { try { sock.close(); } catch (e) {} } }, 7000);
    sock.onopen = function () {
      clearTimeout(openTimer); wsFails = 0; lastMsg = Date.now();
      stopPolling(); bnLive(); bnSetStatus('live', WSS[wsIdx].replace('wss://', ''));
    };
    sock.onmessage = function (ev) {
      lastMsg = Date.now();
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || !m.stream || !m.data) return;
      var d = m.data, st = m.stream;
      if (st.indexOf('@miniTicker') > 0) applyTicker(d.s, d.c, d.o, d.h, d.l, d.v, d.q);
      else if (st.indexOf('@kline_') > 0) {
        var a = BY_BIN[d.s]; if (!a || a.id !== sel.id || d.k.i !== sel.tf) return;
        var k = d.k;
        emit('candle', a.id, { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v });
        if (tick[a.id]) { tick[a.id].price = +k.c; tick[a.id].ts = Date.now(); emit('tick', a.id, tick[a.id]); }
      } else if (st.indexOf('@depth') > 0) {
        var a2 = BY_BIN[st.split('@')[0].toUpperCase()];
        if (!a2 || a2.id !== sel.id || !d.bids) return;
        emit('book', a2.id, { bids: d.bids.map(function (x) { return [+x[0], +x[1]]; }), asks: d.asks.map(function (x) { return [+x[0], +x[1]]; }), synthetic: false });
      }
    };
    sock.onerror = function () {};
    sock.onclose = function () { clearTimeout(openTimer); if (ws === sock) { ws = null; onWsFail(); } };
  }
  function onWsFail() {
    wsFails++;
    if (wsFails % 2 === 0) wsIdx = 1 - wsIdx;
    startPolling();
    if (bnStatus.mode === 'live') bnSetStatus('reconnecting');
    setTimeout(connectWs, Math.min(20000, 1000 * Math.pow(1.7, wsFails)));
  }
  function resubscribe() {
    if (!ws || ws.readyState !== 1) return;
    var want = selStreams();
    var drop = wsSubs.filter(function (s) { return want.indexOf(s) < 0; });
    var add = want.filter(function (s) { return wsSubs.indexOf(s) < 0; });
    try {
      if (drop.length) ws.send(JSON.stringify({ method: 'UNSUBSCRIBE', params: drop, id: reqId++ }));
      if (add.length) ws.send(JSON.stringify({ method: 'SUBSCRIBE', params: add, id: reqId++ }));
    } catch (e) {}
    wsSubs = want;
  }
  function pollOnce() {
    bnTickersRest().then(function () {
      if (bnStatus.mode !== 'live') bnSetStatus('rest', REST[restIdx].replace('https://', ''));
      var a = BY_ID[sel.id];
      if (a && a.feed === 'binance') {
        bnFetch('/api/v3/klines?symbol=' + a.key + '&interval=' + sel.tf + '&limit=2').then(function (rows) {
          var r = rows[rows.length - 1];
          if (a.id === sel.id && r) emit('candle', a.id, { time: Math.floor(r[0] / 1000), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] });
        }, function () {});
        bnFetch('/api/v3/depth?symbol=' + a.key + '&limit=10').then(function (d) {
          if (a.id === sel.id) emit('book', a.id, { bids: d.bids.map(function (x) { return [+x[0], +x[1]]; }), asks: d.asks.map(function (x) { return [+x[0], +x[1]]; }), synthetic: false });
        }, function () {});
      }
    }, function () { bnSetStatus('offline'); bnFallback(); });
  }
  function startPolling() { if (!pollTimer) { pollTimer = setInterval(pollOnce, 4000); } }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  /* ================= gold-api.com (metals) ================= */
  var goldAssets = ASSETS.filter(function (a) { return a.feed === 'goldapi'; });
  var goldFails = 0;
  function pollGold() {
    if (typeof document !== 'undefined' && document.hidden && goldFails === 0 && goldAssets[0].state === 'live') return;
    Promise.all(goldAssets.map(function (a) {
      return getJson('https://api.gold-api.com/price/' + a.key, 8000).then(function (j) {
        var p = +j.price; if (!(p > 0)) throw new Error('bad price');
        var was = a.state;
        if (!tick[a.id]) seedTicker(a, p, a.ref);
        if (was !== 'live') {
          // live spot: high/low are tracked from observed prices only (no simulated history)
          var t0 = tick[a.id]; t0.price = p; t0.high = p; t0.low = p; t0.vol = 0; t0.qvol = 0;
        }
        a.anchor = p;
        setState(a, 'live', 'gold-api');
        setPrice(a, p, 0);
        if (was !== 'live' && sel.id === a.id) emit('reload', a.id);
        return true;
      }, function () {
        if (a.state === 'pending' || a.state === 'live') {
          if (!tick[a.id]) seedTicker(a, a.ref, a.ref);
          setState(a, 'fallback', 'gold-api');
          if (sel.id === a.id) emit('reload', a.id);
        }
        return false;
      });
    })).then(function (r) { goldFails = r.indexOf(true) >= 0 ? 0 : goldFails + 1; });
  }

  /* ================= FX: Frankfurter v2 (daily) -> open.er-api.com -> sample ================= */
  var fxAssets = ASSETS.filter(function (a) { return a.feed === 'fx'; });
  var fxDaily = {};   // id -> [{time, close}]
  function fxRate(a, usdToX) { return a.kind === 'inverse' ? usdToX : 1 / usdToX; }  // inverse: USD/XXX
  function isoDay(d) { return d.toISOString().slice(0, 10); }
  function loadFx() {
    var from = isoDay(new Date(Date.now() - 430 * 86400000));
    var codes = fxAssets.map(function (a) { return a.key; }).join(',');
    return getJson('https://api.frankfurter.dev/v2/rates?base=USD&quotes=' + codes + '&from=' + from, 10000).then(function (rows) {
      if (!Array.isArray(rows) || !rows.length) throw new Error('empty');
      var per = {};
      rows.forEach(function (r) { (per[r.quote] = per[r.quote] || []).push({ date: r.date, v: +r.rate }); });
      fxAssets.forEach(function (a) {
        var s = (per[a.key] || []).sort(function (x, y) { return x.date < y.date ? -1 : 1; });
        if (s.length < 2) throw new Error('missing ' + a.key);
        fxDaily[a.id] = s.map(function (x) { return { time: Math.floor(Date.parse(x.date + 'T00:00:00Z') / 1000), close: fxRate(a, x.v) }; });
        var last = fxDaily[a.id][s.length - 1].close, prev = fxDaily[a.id][s.length - 2].close;
        a.anchor = last; a.prev = prev; a.asOf = s[s.length - 1].date;
        seedTicker(a, last, prev);
        setState(a, 'daily', 'Frankfurter');
      });
    }).catch(function () {
      return getJson('https://open.er-api.com/v6/latest/USD', 10000).then(function (j) {
        if (!j || j.result !== 'success' || !j.rates) throw new Error('bad');
        fxAssets.forEach(function (a) {
          var r = +j.rates[a.key]; if (!(r > 0)) throw new Error('missing');
          var p = fxRate(a, r);
          a.anchor = p; a.asOf = (j.time_last_update_utc || '').slice(5, 16);
          seedTicker(a, p, a.ref);
          setState(a, 'daily', 'ER-API');
        });
      });
    }).catch(function () {
      fxAssets.forEach(function (a) { if (!tick[a.id]) seedTicker(a, a.ref, a.ref); setState(a, 'fallback', 'FX'); });
    }).then(function () { if (BY_ID[sel.id].feed === 'fx') emit('reload', sel.id); });
  }

  /* ================= public ================= */
  function getCandles(id, tf) {
    var a = BY_ID[id];
    if (a.feed === 'binance' && a.state === 'live') {
      return bnFetch('/api/v3/klines?symbol=' + a.key + '&interval=' + tf + '&limit=500').then(function (rows) {
        return rows.map(function (r) { return { time: Math.floor(r[0] / 1000), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] }; });
      });
    }
    var p = (tick[id] && tick[id].price) || a.anchor;
    var h;
    if (tf === '1d' && fxDaily[id] && a.state === 'daily') {
      var d = fxDaily[id];
      h = d.map(function (x, i) {
        var o = i ? d[i - 1].close : x.close;
        return { time: x.time, open: o, high: Math.max(o, x.close), low: Math.min(o, x.close), close: x.close, volume: 0 };
      });
      var lastC = h[h.length - 1], today = Math.floor(Date.now() / 86400000) * 86400;
      if (lastC.time < today) h.push({ time: today, open: lastC.close, high: Math.max(lastC.close, p), low: Math.min(lastC.close, p), close: p, volume: 0 });
      else { lastC.close = p; lastC.high = Math.max(lastC.high, p); lastC.low = Math.min(lastC.low, p); }
    } else {
      h = simHistory(a, tf, 400, p);
    }
    curCandle[id] = Object.assign({}, h[h.length - 1]);
    return Promise.resolve(h);
  }

  function historyNote(a, tf) {
    if (a.feed === 'binance' && a.state === 'live') return 'Binance candles';
    if (a.state === 'daily' && tf === '1d' && fxDaily[a.id]) return 'Daily reference rates · ' + a.srcName + ' (close only)';
    if (a.state === 'live') return 'Earlier candles: sample history · forming candle: live spot';
    if (a.state === 'daily') return 'Intraday: simulated ticks around the real daily rate';
    return 'Sample data · simulated';
  }

  /* price of a Binance-fed asset at a past/current moment: open of the 1-minute candle starting at ms */
  function priceAt(id, ms) {
    var a = BY_ID[id];
    if (!a || a.feed !== 'binance' || a.state !== 'live') return Promise.reject(new Error('not live'));
    return bnFetch('/api/v3/klines?symbol=' + a.key + '&interval=1m&startTime=' + Math.floor(ms) + '&limit=1').then(function (rows) {
      var r = rows && rows[0];
      if (!r || Math.abs(r[0] - ms) > 60000 || !(+r[1] > 0)) throw new Error('no candle');
      return +r[1];
    });
  }

  function select(id, tf) { sel.id = id; sel.tf = tf; delete curCandle[id]; resubscribe(); }

  var started = false;
  function start() {
    if (started) return; started = true;
    ASSETS.forEach(function (a) { if (a.feed === 'sample') seedTicker(a, a.ref, a.ref); });
    setInterval(stepSim, 1000);
    bnTickersRest().catch(function () {});
    connectWs();
    // if Binance gives nothing at all within 9 s, switch its assets to sample data
    setTimeout(function () { if (binAssets.some(function (a) { return a.state === 'pending'; })) { pollOnce(); setTimeout(function () { if (binAssets.some(function (a) { return a.state === 'pending'; })) bnFallback(); }, 4000); } }, 9000);
    // a silent socket (network cut) may never fire onclose: drop it ourselves and fall back to REST / sample data
    setInterval(function () {
      if (ws && ws.readyState === 1 && Date.now() - lastMsg > 15000) {
        var dead = ws; ws = null; dead.onclose = null; dead.onmessage = null;
        try { dead.close(); } catch (e) {}
        onWsFail();
      }
    }, 5000);
    pollGold(); setInterval(pollGold, 12000);
    loadFx();
  }

  root.VXData = {
    ASSETS: ASSETS, BY_ID: BY_ID, CLASS: CLASS, SUB: SUB, TF_SEC: TF_SEC, REF_DATE: REF_DATE,
    tick: tick, binance: bnStatus, on: on, start: start, select: select, getCandles: getCandles,
    badge: badge, bidAsk: bidAsk, historyNote: historyNote, simulated: simulated, priceAt: priceAt,
    restHost: function () { return REST[restIdx]; }
  };
})(window);
