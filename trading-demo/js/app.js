/* Demo Exchange — UI, paper account and order handling. */
(function () {
  'use strict';
  var E = window.VXEngine, D = window.VXData, P = window.VXPredict;
  var STORE_KEY = 'vx-demo-v2';
  var START_BALANCE = 100000;

  /* ---------------- state ---------------- */
  function fresh() {
    return { v: 2, balance: START_BALANCE, realized: 0, pmRealized: 0, positions: [], orders: [], history: [],
             pm: null, ui: { asset: 'XAUUSD', tf: '1m', cat: 'cmd', sub: 'all', lev: {} } };
  }
  var storageOk = true;
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return fresh();
      var s = JSON.parse(raw);
      if (!s || s.v !== 2 || typeof s.balance !== 'number' || !isFinite(s.balance)) return fresh();
      var f = fresh();
      Object.keys(f).forEach(function (k) { if (s[k] == null) s[k] = f[k]; });
      if (!D.BY_ID[s.ui.asset]) s.ui.asset = 'XAUUSD';
      if (!D.TF_SEC[s.ui.tf]) s.ui.tf = '1m';
      s.positions = s.positions.filter(function (p) { return D.BY_ID[p.asset]; });
      s.orders = s.orders.filter(function (o) { return D.BY_ID[o.asset]; });
      return s;
    } catch (e) { storageOk = false; return fresh(); }
  }
  var S = load();
  var saveTimer = null;
  function save(now) {
    if (!storageOk) return;
    clearTimeout(saveTimer);
    var go = function () { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { storageOk = false; storageNotice(); } };
    if (now) go(); else saveTimer = setTimeout(go, 600);
  }
  function storageNotice() { toast('Browser storage is unavailable', 'The demo works normally, but your paper account resets when the page reloads.', 'warn'); }

  /* ---------------- formatting ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  function nf(v, dp) { return (isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function usd(v) { if (Math.abs(v) < 0.005) v = 0; return (v < 0 ? '-$' : '$') + nf(Math.abs(v), 2); }
  function signed(v) { if (Math.abs(v) < 0.005) v = 0; return (v >= 0 ? '+$' : '-$') + nf(Math.abs(v), 2); }
  function px(a, v) { return v == null || !isFinite(v) ? '—' : nf(v, a.dp); }
  function pct(v) { return (v >= 0 ? '+' : '') + nf(v * 100, 2) + '%'; }
  function qtyFmt(a, q) {
    if (a.kind === 'inverse') return nf(q, 0) + ' USD';
    var p = mid(a), dp = p > 10000 ? 4 : p > 100 ? 3 : p > 1 ? 2 : 0;
    return nf(q, dp);
  }
  function compact(v) {
    if (!isFinite(v) || v <= 0) return '—';
    if (v >= 1e9) return nf(v / 1e9, 2) + 'B'; if (v >= 1e6) return nf(v / 1e6, 2) + 'M'; if (v >= 1e3) return nf(v / 1e3, 1) + 'K';
    return nf(v, 0);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function timeFmt(t) { return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

  /* ---------------- prices ---------------- */
  function mid(a) { var t = D.tick[a.id]; return t ? t.price : a.anchor; }
  function quote(a) { return D.bidAsk(a, mid(a)); }
  function markFor(a, side) { var q = quote(a); return side === 'long' ? q.bid : q.ask; }
  function cls(a) { return D.CLASS[a.cat]; }
  function hasPrice(a) { return !!D.tick[a.id] && a.state !== 'pending'; }

  /* ---------------- account ---------------- */
  function upnlAll() { var u = 0; S.positions.forEach(function (p) { u += E.unrealizedPnl(p, markFor(D.BY_ID[p.asset], p.side)); }); return u; }
  function marginAll() { var m = 0; S.positions.forEach(function (p) { m += p.margin; }); return m; }
  function reservedAll() { var r = 0; S.orders.forEach(function (o) { r += o.reserved; }); return r; }
  function equity() { return S.balance + reservedAll() + marginAll() + upnlAll() + P.value(); }

  function renderAccount() {
    var u = upnlAll() + P.unrealized(), r = S.realized + (S.pmRealized || 0);
    $('acEquity').textContent = usd(equity());
    $('acFree').textContent = usd(S.balance);
    $('acUpnl').textContent = signed(u); $('acUpnl').className = 'acct-v mono ' + (u >= 0 ? 'up' : 'down');
    $('acReal').textContent = signed(r); $('acReal').className = 'acct-v mono ' + (r >= 0 ? 'up' : 'down');
  }

  function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  function addHist(h) { h.t = Date.now(); S.history.unshift(h); if (S.history.length > 300) S.history.length = 300; }

  /* ---------------- trading actions ---------------- */
  function openPosition(a, side, entry, margin, lev, feeRate, tp, sl, via) {
    var pv = E.previewOrder({ side: side, price: entry, margin: margin, leverage: lev, kind: a.kind, feeRate: feeRate });
    var pos = { id: uid('p'), asset: a.id, side: side, kind: a.kind, qty: pv.qty, entry: entry, lev: lev, margin: margin,
                liq: pv.liq, tp: tp || null, sl: sl || null, openedAt: Date.now(), fees: pv.fee };
    S.positions.push(pos);
    S.realized -= pv.fee;
    addHist({ asset: a.id, kind: via === 'limit' ? 'Limit filled' : 'Open', side: side, price: entry, qty: pv.qty, lev: lev, pnl: -pv.fee, fee: pv.fee, inv: a.kind === 'inverse' });
    return pos;
  }

  function placeOrder(o) {
    // o: { asset, side, type, margin, lev, limit, tp, sl }
    var a = D.BY_ID[o.asset];
    if (!a) return 'Unknown market.';
    if (!hasPrice(a)) return 'Waiting for a price for ' + a.sym + '.';
    var c = cls(a);
    if (!(o.lev >= 1) || Math.floor(o.lev) !== o.lev) return 'Leverage must be a whole number from 1x.';
    if (o.lev > c.maxLev) return 'Max leverage for ' + c.label + ' is ' + c.maxLev + 'x.';
    if (!(o.margin > 0) || !isFinite(o.margin)) return 'Enter a margin amount greater than 0.';
    if (o.margin < 10) return 'Minimum margin is $10.';
    var q = quote(a);
    var entry = o.type === 'limit' ? o.limit : (o.side === 'long' ? q.ask : q.bid);
    if (o.type === 'limit') {
      if (!(o.limit > 0) || !isFinite(o.limit)) return 'Enter a limit price greater than 0.';
      if (o.side === 'long' && o.limit >= q.ask) return 'A buy limit at or above the ask (' + px(a, q.ask) + ') would fill immediately — use Market.';
      if (o.side === 'short' && o.limit <= q.bid) return 'A sell limit at or below the bid (' + px(a, q.bid) + ') would fill immediately — use Market.';
    }
    var feeRate = o.type === 'limit' ? c.maker : c.taker;
    var pv = E.previewOrder({ side: o.side, price: entry, margin: o.margin, leverage: o.lev, kind: a.kind, feeRate: feeRate });
    if (pv.cost > S.balance + 1e-9) return 'Insufficient paper balance: needs ' + usd(pv.cost) + ' (margin + fee), available ' + usd(S.balance) + '.';
    var err = E.validateTpSl(o.side, entry, pv.liq, o.tp, o.sl);
    if (err) return err;
    S.balance -= pv.cost;
    if (o.type === 'limit') {
      var ord = { id: uid('o'), asset: a.id, side: o.side, price: o.limit, margin: o.margin, lev: o.lev, tp: o.tp || null, sl: o.sl || null, reserved: pv.cost, fee: pv.fee, createdAt: Date.now() };
      S.orders.push(ord);
      addHist({ asset: a.id, kind: 'Limit placed', side: o.side, price: o.limit, qty: pv.qty, lev: o.lev, inv: a.kind === 'inverse' });
      return { order: ord };
    }
    return { position: openPosition(a, o.side, entry, o.margin, o.lev, feeRate, o.tp, o.sl, 'market') };
  }

  function closePosition(id, reason, atPrice) {
    var idx = -1; S.positions.forEach(function (p, i) { if (p.id === id) idx = i; });
    if (idx < 0) return null;
    var p = S.positions[idx], a = D.BY_ID[p.asset], c = cls(a);
    var exit = atPrice != null ? atPrice : markFor(a, p.side);
    var st;
    if (reason === 'liquidated') st = { pnl: -p.margin, fee: 0, credit: 0, realized: -p.margin };
    else st = E.closeSettlement(p, exit, c.taker);
    S.positions.splice(idx, 1);
    S.balance += st.credit;
    S.realized += st.realized;
    addHist({ asset: a.id, kind: { manual: 'Close', tp: 'Take profit', sl: 'Stop loss', liquidated: 'Liquidated' }[reason] || 'Close',
              side: p.side, price: exit, qty: p.qty, lev: p.lev, pnl: st.realized, fee: st.fee, inv: p.kind === 'inverse' });
    return { pos: p, st: st, exit: exit };
  }

  function cancelOrder(id) {
    var o = null; S.orders = S.orders.filter(function (x) { if (x.id === id) { o = x; return false; } return true; });
    if (!o) return;
    S.balance += o.reserved;
    addHist({ asset: o.asset, kind: 'Cancelled', side: o.side, price: o.price, qty: null, lev: o.lev });
  }

  /* risk engine: liquidation, TP/SL and limit fills on every price update */
  function onPrice(id) {
    var a = D.BY_ID[id]; if (!a || !hasPrice(a)) return;
    var events = [];
    S.positions.slice().forEach(function (p) {
      if (p.asset !== id) return;
      var m = markFor(a, p.side);
      if (E.isLiquidated(p, m)) { var r = closePosition(p.id, 'liquidated', p.liq); if (r) events.push(['bad', 'Liquidated: ' + a.sym + ' ' + p.side + ' ' + p.lev + 'x', 'Mark reached ' + px(a, p.liq) + '. Margin lost: ' + usd(p.margin)]); return; }
      var hit = E.tpslHit(p, m);
      if (hit) { var r2 = closePosition(p.id, hit, hit === 'tp' ? p.tp : p.sl); if (r2) events.push([r2.st.realized >= 0 ? 'ok' : 'bad', (hit === 'tp' ? 'Take profit' : 'Stop loss') + ' hit · ' + a.sym, 'Closed at ' + px(a, r2.exit) + ' · ' + signed(r2.st.realized)]); }
    });
    var q = quote(a);
    S.orders.slice().forEach(function (o) {
      if (o.asset !== id || !E.limitTriggered(o, q.bid, q.ask)) return;
      S.orders = S.orders.filter(function (x) { return x.id !== o.id; });
      var pos = openPosition(a, o.side, o.price, o.margin, o.lev, cls(a).maker, o.tp, o.sl, 'limit');
      events.push(['ok', 'Limit order filled · ' + a.sym, o.side.toUpperCase() + ' ' + o.lev + 'x at ' + px(a, o.price) + ' · liq. ' + px(a, pos.liq)]);
    });
    if (events.length) { events.forEach(function (e) { toast(e[1], e[2], e[0]); }); save(true); dirty.act = true; }
  }

  /* ---------------- toasts & modal ---------------- */
  function toast(title, body, kind) {
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = '<b>' + esc(title) + '</b>' + (body ? '<span>' + esc(body) + '</span>' : '');
    $('toasts').appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 4200);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }
  var lastFocus = null;
  function modal(html, wide) {
    lastFocus = document.activeElement;
    $('modalBody').innerHTML = html;
    $('modal').hidden = false;
    $('modal').querySelector('.modal-card').classList.toggle('wide', !!wide);
    document.body.classList.add('modal-open');
    setTimeout(function () { var f = $('modalBody').querySelector('input,button,select'); if (f) try { f.focus(); } catch (e) {} }, 20);
  }
  function closeModal() {
    $('modal').hidden = true; $('modalBody').innerHTML = ''; document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }

  /* ---------------- watchlist ---------------- */
  var rows = {};
  function visibleAssets() {
    var cat = S.ui.cat, sub = S.ui.sub, q = ($('watchSearch').value || '').trim().toLowerCase();
    return D.ASSETS.filter(function (a) {
      if (q) return (a.sym + ' ' + a.name).toLowerCase().indexOf(q) >= 0;
      if (cat !== 'all' && a.cat !== cat) return false;
      if (cat === 'cmd' && sub !== 'all' && a.sub !== sub) return false;
      return true;
    });
  }
  function buildWatch() {
    var list = $('watchList'); list.innerHTML = ''; rows = {};
    var vis = visibleAssets(), lastSub = null;
    vis.forEach(function (a) {
      if (a.cat === 'cmd' && S.ui.cat === 'cmd' && S.ui.sub === 'all' && a.sub !== lastSub) {
        lastSub = a.sub;
        var g = document.createElement('div'); g.className = 'watch-group'; g.textContent = D.SUB[a.sub]; list.appendChild(g);
      }
      var r = document.createElement('button');
      r.className = 'wrow' + (a.id === S.ui.asset ? ' is-active' : '');
      r.dataset.id = a.id;
      r.innerHTML = '<span class="w-name"><b>' + esc(a.sym) + '</b><small>' + esc(a.name) + '</small></span>' +
        '<span class="w-px mono"></span><span class="w-chg mono"></span><span class="w-src"></span>';
      list.appendChild(r);
      rows[a.id] = { el: r, px: r.querySelector('.w-px'), chg: r.querySelector('.w-chg'), src: r.querySelector('.w-src'), last: null };
      updRow(a);
    });
    if (!vis.length) list.innerHTML = '<div class="empty">No markets match.</div>';
    document.querySelectorAll('#catTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.cat === S.ui.cat); });
    $('subTabs').hidden = S.ui.cat !== 'cmd';
    document.querySelectorAll('#subTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.sub === S.ui.sub); });
  }
  function changeOf(a) { var t = D.tick[a.id]; return t && t.open24 ? t.price / t.open24 - 1 : 0; }
  function updRow(a) {
    var r = rows[a.id]; if (!r) return;
    var t = D.tick[a.id], b = D.badge(a);
    if (r.src.dataset.k !== b.text) { r.src.innerHTML = '<span class="badge ' + b.cls + '" title="' + esc(b.title) + '">' + esc(b.text) + '</span>'; r.src.dataset.k = b.text; }
    if (!t) { r.px.textContent = '—'; r.chg.textContent = ''; return; }
    var p = t.price;
    if (r.last != null && p !== r.last) { r.px.classList.remove('fl-up', 'fl-dn'); void r.px.offsetWidth; r.px.classList.add(p > r.last ? 'fl-up' : 'fl-dn'); }
    r.last = p;
    r.px.textContent = px(a, p);
    var ch = changeOf(a);
    r.chg.textContent = pct(ch); r.chg.className = 'w-chg mono ' + (ch >= 0 ? 'up' : 'down');
  }

  /* commodity movers strip */
  function renderMovers() {
    var list = D.ASSETS.filter(function (a) { return a.cat === 'cmd' && D.tick[a.id]; }).map(function (a) { return { a: a, c: changeOf(a) }; });
    list.sort(function (x, y) { return y.c - x.c; });
    var up = list.slice(0, 3), dn = list.slice(-3).reverse();
    function chip(x) { return '<button class="mv" data-id="' + x.a.id + '"><b>' + esc(x.a.name.replace(/ \(.*\)/, '')) + '</b><span class="mono ' + (x.c >= 0 ? 'up' : 'down') + '">' + pct(x.c) + '</span></button>'; }
    $('moversUp').innerHTML = up.map(chip).join('');
    $('moversDn').innerHTML = dn.map(chip).join('');
    var metals = list.filter(function (x) { return x.a.sub === 'metals'; }), en = list.filter(function (x) { return x.a.sub === 'energy'; }), ag = list.filter(function (x) { return x.a.sub === 'ag'; });
    function avg(l) { return l.length ? l.reduce(function (s, x) { return s + x.c; }, 0) / l.length : 0; }
    $('moversGroups').innerHTML = [['Metals', metals], ['Energy', en], ['Agriculture', ag]].map(function (g) { var v = avg(g[1]); return '<span>' + g[0] + ' <b class="mono ' + (v >= 0 ? 'up' : 'down') + '">' + pct(v) + '</b></span>'; }).join('');
  }

  /* ---------------- symbol header & specs ---------------- */
  function renderHead() {
    var a = D.BY_ID[S.ui.asset], t = D.tick[a.id], c = cls(a), b = D.badge(a), q = quote(a);
    $('symName').textContent = a.sym;
    $('symDesc').textContent = a.name + ' · ' + c.label + (a.sub ? ' · ' + D.SUB[a.sub] : '');
    $('symSrc').innerHTML = '<span class="badge ' + b.cls + '" title="' + esc(b.title) + '">' + esc(b.text) + '</span>';
    if (!t) { ['symPrice', 'symChg', 'symHigh', 'symLow', 'symVol'].forEach(function (k) { $(k).textContent = '—'; }); }
    else {
      var ch = changeOf(a);
      $('symPrice').textContent = px(a, t.price);
      $('symPrice').className = 'mono big ' + (ch >= 0 ? 'up' : 'down');
      $('symChg').textContent = (ch >= 0 ? '+' : '') + px(a, t.price - t.open24) + '  ' + pct(ch);
      $('symChg').className = 'mono ' + (ch >= 0 ? 'up' : 'down');
      $('symHigh').textContent = px(a, t.high); $('symLow').textContent = px(a, t.low);
      var bnLive = a.feed === 'binance' && a.state === 'live', spotLive = a.state === 'live' && !bnLive;
      $('symHighK').textContent = bnLive ? '24h high' : spotLive ? 'Session high' : 'Sim. high';
      $('symLowK').textContent = bnLive ? '24h low' : spotLive ? 'Session low' : 'Sim. low';
      $('symVolK').textContent = bnLive ? '24h volume (USDT)' : spotLive ? 'Volume' : 'Sim. volume';
      $('symVol').textContent = bnLive ? compact(t.qvol) : spotLive ? 'n/a (spot)' : compact(t.vol);
      $('symChgK').textContent = a.state === 'daily' ? 'Chg vs prev. day' : (a.feed === 'binance' && a.state === 'live' ? '24h change' : 'Chg vs ref. close');
    }
    var spread = a.spread ? px(a, a.spread) : 'market (order book)';
    $('specs').innerHTML =
      '<div><dt>Unit</dt><dd>' + esc(a.unit) + '</dd></div>' +
      '<div><dt>Trading hours</dt><dd>' + esc(a.hours) + '</dd></div>' +
      '<div><dt>Max leverage</dt><dd class="mono">' + c.maxLev + 'x</dd></div>' +
      '<div><dt>Spread</dt><dd class="mono">' + spread + '</dd></div>' +
      '<div><dt>Fee taker / maker</dt><dd class="mono">' + nf(c.taker * 100, 3) + '% / ' + nf(c.maker * 100, 3) + '%</dd></div>' +
      '<div><dt>Bid / Ask</dt><dd class="mono">' + (t ? px(a, q.bid) + ' / ' + px(a, q.ask) : '—') + '</dd></div>' +
      '<div><dt>Contract</dt><dd>' + (a.kind === 'inverse' ? 'Size in USD, PnL converted at mark' : 'Linear, USD-settled') + '</dd></div>';
  }

  /* ---------------- chart ---------------- */
  var chart = null, cSeries = null, vSeries = null, priceLines = [], chartReq = 0, lastBar = null;
  function chartOptions() {
    return {
      autoSize: true,
      localization: { locale: 'en-US' },
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8a93a6', fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 11 },
      grid: { vertLines: { color: 'rgba(140,150,170,0.06)' }, horzLines: { color: 'rgba(140,150,170,0.06)' } },
      rightPriceScale: { borderColor: 'rgba(140,150,170,0.14)' },
      timeScale: { borderColor: 'rgba(140,150,170,0.14)', timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: 0, vertLine: { color: 'rgba(212,255,79,0.35)', labelBackgroundColor: '#20252f' }, horzLine: { color: 'rgba(212,255,79,0.35)', labelBackgroundColor: '#20252f' } },
      handleScroll: { vertTouchDrag: false }
    };
  }
  function initChart() {
    if (!window.LightweightCharts) { $('chartMsg').textContent = 'Chart library could not be loaded (offline?). Trading still works.'; return; }
    chart = LightweightCharts.createChart($('chart'), chartOptions());
    cSeries = chart.addCandlestickSeries({ upColor: '#2ad18b', downColor: '#ff5470', borderVisible: false, wickUpColor: '#2ad18b', wickDownColor: '#ff5470' });
    vSeries = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    chart.subscribeCrosshairMove(function (prm) {
      var a = D.BY_ID[S.ui.asset];
      var d = prm && prm.seriesData ? prm.seriesData.get(cSeries) : null;
      if (!d) d = lastBar;
      if (!d) { $('chartLegend').textContent = ''; return; }
      $('chartLegend').innerHTML = 'O <b>' + px(a, d.open) + '</b> H <b>' + px(a, d.high) + '</b> L <b>' + px(a, d.low) + '</b> C <b class="' + (d.close >= d.open ? 'up' : 'down') + '">' + px(a, d.close) + '</b>';
    });
  }
  function loadChart() {
    var a = D.BY_ID[S.ui.asset], tf = S.ui.tf, req = ++chartReq;
    $('chartNote').textContent = D.historyNote(a, tf) + ' · times in UTC';
    if (!chart) return;
    $('chartMsg').hidden = false; $('chartMsg').textContent = 'Loading ' + a.sym + ' · ' + tf + '…';
    cSeries.applyOptions({ priceFormat: { type: 'price', precision: a.dp, minMove: Math.pow(10, -a.dp) } });
    lastBar = null;
    if (a.state === 'pending') { $('chartMsg').textContent = 'Connecting to the data source…'; return; }
    D.getCandles(a.id, tf).then(function (bars) {
      if (req !== chartReq) return;
      cSeries.setData(bars.map(function (b) { return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }; }));
      vSeries.setData(bars.map(function (b) { return { time: b.time, value: b.volume, color: b.close >= b.open ? 'rgba(42,209,139,0.28)' : 'rgba(255,84,112,0.28)' }; }));
      lastBar = bars[bars.length - 1] || null;
      chart.timeScale().applyOptions({ secondsVisible: false, timeVisible: tf !== '1d' });
      var n = bars.length, show = tf === '1d' ? 160 : 120;
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - show), to: n + 3 });
      $('chartMsg').hidden = true;
      drawPriceLines();
      $('chartLegend').innerHTML = '';
    }, function () {
      if (req !== chartReq) return;
      $('chartMsg').hidden = false;
      $('chartMsg').textContent = 'Could not load candles for ' + a.sym + ' right now. Retrying…';
      setTimeout(function () { if (req === chartReq) loadChart(); }, 5000);
    });
  }
  function onCandle(id, c) {
    if (id !== S.ui.asset || !cSeries || !lastBar) return;
    if (c.time < lastBar.time) return;
    try {
      cSeries.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close });
      vSeries.update({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(42,209,139,0.28)' : 'rgba(255,84,112,0.28)' });
      lastBar = c;
    } catch (e) { /* out-of-order bar: ignore */ }
  }
  function drawPriceLines() {
    if (!cSeries) return;
    priceLines.forEach(function (l) { try { cSeries.removePriceLine(l); } catch (e) {} });
    priceLines = [];
    var id = S.ui.asset;
    function line(price, color, title, style) { priceLines.push(cSeries.createPriceLine({ price: price, color: color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title: title })); }
    S.positions.forEach(function (p) {
      if (p.asset !== id) return;
      line(p.entry, p.side === 'long' ? '#2ad18b' : '#ff5470', (p.side === 'long' ? 'Long ' : 'Short ') + p.lev + 'x', 0);
      line(p.liq, '#ffb547', 'Liq.', 2);
      if (p.tp) line(p.tp, '#7fd4ff', 'TP', 1);
      if (p.sl) line(p.sl, '#c38bff', 'SL', 1);
    });
    S.orders.forEach(function (o) { if (o.asset === id) line(o.price, '#d4ff4f', 'Limit ' + o.side, 1); });
  }

  /* ---------------- order book ---------------- */
  var lastBook = null, bookTimer = 0;
  function onBook(id, bk) { if (id !== S.ui.asset) return; lastBook = bk; if (!bookTimer) bookTimer = setTimeout(renderBook, 250); }
  function renderBook() {
    bookTimer = 0;
    var a = D.BY_ID[S.ui.asset], bk = lastBook;
    $('bookTag').textContent = !bk ? '—' : bk.synthetic ? 'synthetic' : 'Binance live';
    $('bookTag').className = 'tag ' + (bk && !bk.synthetic ? 'tag-live' : '');
    if (!bk || !bk.asks.length) { $('bookAsks').innerHTML = $('bookBids').innerHTML = ''; $('bookMid').textContent = '—'; $('bookSpread').textContent = ''; return; }
    var asks = bk.asks.slice(0, 8), bids = bk.bids.slice(0, 8);
    var max = 0, cumA = [], cumB = [], s = 0;
    asks.forEach(function (r) { s += r[1]; cumA.push(s); }); max = s; s = 0;
    bids.forEach(function (r) { s += r[1]; cumB.push(s); }); max = Math.max(max, s) || 1;
    function sz(v) { return v >= 1000 ? compact(v) : nf(v, v >= 10 ? 1 : 3); }
    $('bookAsks').innerHTML = asks.map(function (r, i) { return '<div class="b-row ask"><i style="width:' + (cumA[i] / max * 100).toFixed(1) + '%"></i><span class="mono">' + px(a, r[0]) + '</span><span class="mono">' + sz(r[1]) + '</span><span class="mono">' + sz(cumA[i]) + '</span></div>'; }).reverse().join('');
    $('bookBids').innerHTML = bids.map(function (r, i) { return '<div class="b-row bid"><i style="width:' + (cumB[i] / max * 100).toFixed(1) + '%"></i><span class="mono">' + px(a, r[0]) + '</span><span class="mono">' + sz(r[1]) + '</span><span class="mono">' + sz(cumB[i]) + '</span></div>'; }).join('');
    var spr = asks[0][0] - bids[0][0];
    $('bookMid').textContent = px(a, (asks[0][0] + bids[0][0]) / 2);
    $('bookSpread').textContent = 'spread ' + px(a, spr);
  }

  /* ---------------- ticket ---------------- */
  var tk = { side: 'long', type: 'market' };
  function levCap() { return cls(D.BY_ID[S.ui.asset]).maxLev; }
  function curLev() { var v = parseFloat($('inLevNum').value); return v; }
  function setLev(v, fromInput) {
    var cap = levCap();
    if (!fromInput) v = Math.max(1, Math.min(cap, Math.round(v)));
    $('inLev').value = Math.max(1, Math.min(cap, isFinite(v) ? v : 1));
    if (!fromInput) $('inLevNum').value = v;
    S.ui.lev[S.ui.asset] = isFinite(v) ? v : 1;
    updTicket();
  }
  function setupTicketForAsset() {
    var a = D.BY_ID[S.ui.asset], c = cls(a);
    $('inLev').max = c.maxLev;
    $('inLevNum').max = c.maxLev;
    $('levCap').textContent = 'max ' + c.maxLev + 'x · ' + c.label;
    var marks = [1, 2, 5, 10, 20, 50, 100].filter(function (x) { return x <= c.maxLev; });
    if (marks.length > 5) marks = [marks[0], marks[Math.floor(marks.length / 3)], marks[Math.floor(marks.length / 2)], marks[marks.length - 2], marks[marks.length - 1]];
    $('levChips').innerHTML = marks.map(function (x) { return '<button data-lev="' + x + '">' + x + 'x</button>'; }).join('');
    var want = S.ui.lev[a.id] || Math.min(10, c.maxLev);
    setLev(Math.min(want, c.maxLev));
    $('inTp').value = ''; $('inSl').value = '';
    if (tk.type === 'limit') $('inLimit').value = hasPrice(a) ? px(a, tk.side === 'long' ? quote(a).bid * 0.998 : quote(a).ask * 1.002).replace(/,/g, '') : '';
    $('limitUnit').textContent = a.kind === 'inverse' ? a.sym.split('/')[1] : 'USD';
    $('tpslUnit').textContent = 'Price in ' + (a.kind === 'inverse' ? a.sym.split('/')[1] + ' per USD' : 'USD');
  }
  function num(id) { var s = ($(id).value || '').replace(/,/g, '').trim(); if (s === '') return null; var v = Number(s); return isFinite(v) ? v : NaN; }
  function ticketInput() {
    return { asset: S.ui.asset, side: tk.side, type: tk.type, margin: num('inMargin'), lev: curLev(), limit: num('inLimit'), tp: num('inTp'), sl: num('inSl') };
  }
  function updTicket() {
    var a = D.BY_ID[S.ui.asset], c = cls(a), o = ticketInput();
    var q = quote(a), ready = hasPrice(a);
    var entry = o.type === 'limit' ? o.limit : (o.side === 'long' ? q.ask : q.bid);
    $('levVal').textContent = (isFinite(o.lev) ? o.lev : '—') + 'x';
    $('btnSubmit').textContent = (o.type === 'limit' ? 'Place limit ' : 'Open ') + (o.side === 'long' ? 'long' : 'short') + ' · ' + a.sym;
    $('btnSubmit').className = 'btn-submit ' + o.side;
    $('sumAvail').textContent = usd(S.balance);
    var err = '';
    if (!ready) err = 'Waiting for a price…';
    else if (!isFinite(o.lev) || o.lev < 1 || Math.floor(o.lev) !== o.lev) err = 'Leverage must be a whole number from 1x.';
    else if (o.lev > c.maxLev) err = 'Max leverage for ' + c.label + ' is ' + c.maxLev + 'x.';
    else if (o.margin == null) err = '';
    else if (!(o.margin > 0)) err = 'Enter a margin amount greater than 0.';
    else if (o.margin < 10) err = 'Minimum margin is $10.';
    else if (o.type === 'limit' && o.limit != null && !(o.limit > 0)) err = 'Enter a limit price greater than 0.';
    else if (o.tp != null && !(o.tp > 0)) err = 'Take profit must be a positive price.';
    else if (o.sl != null && !(o.sl > 0)) err = 'Stop loss must be a positive price.';
    var ok = ready && entry > 0 && o.margin > 0 && isFinite(o.lev) && o.lev >= 1 && o.lev <= c.maxLev;
    if (ok) {
      var feeRate = o.type === 'limit' ? c.maker : c.taker;
      var pv = E.previewOrder({ side: o.side, price: entry, margin: o.margin, leverage: o.lev, kind: a.kind, feeRate: feeRate });
      $('sumEntry').textContent = px(a, entry) + (o.type === 'market' ? (o.side === 'long' ? ' (ask)' : ' (bid)') : ' (limit)');
      $('sumNotional').textContent = usd(pv.notional);
      $('sumQty').textContent = qtyFmt(a, pv.qty);
      $('sumMargin').textContent = usd(pv.margin);
      $('sumFee').textContent = usd(pv.fee); $('sumFeeRate').textContent = '(' + nf(feeRate * 100, 3) + '%)';
      $('sumLiq').textContent = px(a, pv.liq);
      if (!err && pv.cost > S.balance + 1e-9) err = 'Insufficient paper balance: needs ' + usd(pv.cost) + ', available ' + usd(S.balance) + '.';
      if (!err) err = E.validateTpSl(o.side, entry, pv.liq, o.tp, o.sl);
      if (!err && o.type === 'limit') {
        if (o.side === 'long' && o.limit >= q.ask) err = 'A buy limit at or above the ask fills immediately — use Market.';
        if (o.side === 'short' && o.limit <= q.bid) err = 'A sell limit at or below the bid fills immediately — use Market.';
      }
    } else {
      ['sumEntry', 'sumNotional', 'sumQty', 'sumMargin', 'sumFee', 'sumLiq'].forEach(function (k) { $(k).textContent = '—'; });
      $('sumFeeRate').textContent = '';
      if (ready && o.type === 'limit' && o.limit == null && !err) err = '';
    }
    $('ticketErr').textContent = err;
    $('btnSubmit').disabled = !!err || !ok;
  }
  var submitLock = false;
  function submitTicket() {
    if (submitLock) return;
    updTicket();
    if ($('btnSubmit').disabled) return;   // invalid input: the error is already shown
    submitLock = true; $('btnSubmit').disabled = true;
    setTimeout(function () { submitLock = false; updTicket(); }, 400);
    var o = ticketInput(), a = D.BY_ID[o.asset];
    if (o.type !== 'limit') o.limit = null;
    var r = placeOrder(o);
    if (typeof r === 'string') { $('ticketErr').textContent = r; return; }
    if (r.position) toast('Position opened · ' + a.sym, r.position.side.toUpperCase() + ' ' + r.position.lev + 'x at ' + px(a, r.position.entry) + ' · liq. ' + px(a, r.position.liq), 'ok');
    else toast('Limit order placed · ' + a.sym, o.side.toUpperCase() + ' ' + o.lev + 'x at ' + px(a, o.limit), 'ok');
    save(true); dirty.act = true; drawPriceLines(); renderAccount();
    setAct(r.position ? 'pos' : 'ord');
  }

  /* ---------------- activity tables ---------------- */
  function setAct(k) {
    S.ui.act = k;
    document.querySelectorAll('#actTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.act === k); });
    renderActivity();
  }
  function sideTag(side, lev) { return '<span class="side ' + side + '">' + (side === 'long' ? 'Long' : 'Short') + (lev ? ' ' + lev + 'x' : '') + '</span>'; }
  function renderActivity() {
    dirty.act = false;
    $('cntPos').textContent = S.positions.length; $('cntOrd').textContent = S.orders.length;
    $('btnCloseAll').hidden = !(S.ui.act === 'pos' && S.positions.length > 1);
    var k = S.ui.act || 'pos', html;
    if (k === 'pos') {
      html = S.positions.length ? '<table class="tbl tbl-pos"><thead><tr><th>Market</th><th>Size</th><th>Entry / Mark</th><th>Liq. price</th><th>Margin</th><th>PnL / ROE</th><th>TP / SL</th><th></th></tr></thead><tbody>' +
        S.positions.map(function (p) {
          var a = D.BY_ID[p.asset], m = markFor(a, p.side), u = E.unrealizedPnl(p, m), r = E.roe(p, m);
          return '<tr><td><button class="linkbtn sym" data-go="' + a.id + '">' + esc(a.sym) + '</button><div class="sub">' + sideTag(p.side, p.lev) + '</div></td><td class="mono">' + qtyFmt(a, p.qty) + '</td>' +
            '<td class="mono">' + px(a, p.entry) + '<div class="sub">' + px(a, m) + '</div></td><td class="mono warn">' + px(a, p.liq) + '</td><td class="mono">' + usd(p.margin) + '</td>' +
            '<td class="mono ' + (u >= 0 ? 'up' : 'down') + '">' + signed(u) + '<div class="sub">' + pct(r) + '</div></td>' +
            '<td class="mono"><button class="linkbtn" data-tpsl="' + p.id + '" title="Edit take profit / stop loss">' + (p.tp ? px(a, p.tp) : '—') + '<br>' + (p.sl ? px(a, p.sl) : '—') + ' ✎</button></td>' +
            '<td><button class="btn-ghost sm" data-close="' + p.id + '">Close</button></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No open positions. Choose a market, set leverage and open a long or short.</div>';
    } else if (k === 'ord') {
      html = S.orders.length ? '<table class="tbl"><thead><tr><th>Market</th><th>Side</th><th>Type</th><th>Price</th><th>Margin</th><th>Reserved</th><th>TP / SL</th><th>Placed</th><th></th></tr></thead><tbody>' +
        S.orders.map(function (o) {
          var a = D.BY_ID[o.asset];
          return '<tr><td><button class="linkbtn sym" data-go="' + a.id + '">' + esc(a.sym) + '</button></td><td>' + sideTag(o.side, o.lev) + '</td><td>Limit</td><td class="mono">' + px(a, o.price) + '</td><td class="mono">' + usd(o.margin) + '</td><td class="mono">' + usd(o.reserved) + '</td>' +
            '<td class="mono">' + (o.tp ? px(a, o.tp) : '—') + ' / ' + (o.sl ? px(a, o.sl) : '—') + '</td><td>' + timeFmt(o.createdAt) + '</td><td><button class="btn-ghost sm" data-cancel="' + o.id + '">Cancel</button></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No open limit orders.</div>';
    } else {
      html = S.history.length ? '<table class="tbl"><thead><tr><th>Time</th><th>Market</th><th>Event</th><th>Side</th><th>Price</th><th>Size</th><th>Fee</th><th>Realized</th></tr></thead><tbody>' +
        S.history.slice(0, 120).map(function (h) {
          var a = D.BY_ID[h.asset]; if (!a) return '';
          return '<tr><td>' + timeFmt(h.t) + '</td><td>' + esc(a.sym) + '</td><td class="' + (h.kind === 'Liquidated' ? 'down' : '') + '">' + esc(h.kind) + '</td><td>' + sideTag(h.side, h.lev) + '</td><td class="mono">' + px(a, h.price) + '</td>' +
            '<td class="mono">' + (h.qty != null ? qtyFmt(a, h.qty) : '—') + '</td><td class="mono">' + (h.fee ? usd(h.fee) : '—') + '</td><td class="mono ' + (h.pnl == null ? '' : h.pnl >= 0 ? 'up' : 'down') + '">' + (h.pnl == null ? '—' : signed(h.pnl)) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">Order and position history will appear here.</div>';
    }
    $('actBody').innerHTML = html;
  }

  function editTpSl(id) {
    var p = S.positions.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var a = D.BY_ID[p.asset];
    modal('<div class="pt"><div class="pt-q" id="modalTitle">TP / SL · ' + esc(a.sym) + ' ' + p.side + ' ' + p.lev + 'x</div>' +
      '<p class="fine">Entry ' + px(a, p.entry) + ' · mark ' + px(a, markFor(a, p.side)) + ' · liquidation ' + px(a, p.liq) + '. Leave empty to remove.</p>' +
      '<div class="tpsl-grid"><div class="input"><span class="pre">TP</span><input id="mTp" class="mono" inputmode="decimal" value="' + (p.tp ? px(a, p.tp).replace(/,/g, '') : '') + '"></div>' +
      '<div class="input"><span class="pre">SL</span><input id="mSl" class="mono" inputmode="decimal" value="' + (p.sl ? px(a, p.sl).replace(/,/g, '') : '') + '"></div></div>' +
      '<div class="ticket-err" id="mErr"></div><button class="btn-submit ' + p.side + '" id="mSave">Save TP / SL</button></div>');
    $('mSave').onclick = function () {
      var tp = num('mTp'), sl = num('mSl');
      var m = markFor(a, p.side);
      var err = E.validateTpSl(p.side, p.entry, p.liq, tp, sl);
      if (!err && tp && (p.side === 'long' ? tp <= m : tp >= m)) err = 'Take profit would trigger immediately at the current mark.';
      if (!err && sl && (p.side === 'long' ? sl >= m : sl <= m)) err = 'Stop loss would trigger immediately at the current mark.';
      if (err) { $('mErr').textContent = err; return; }
      p.tp = tp || null; p.sl = sl || null;
      closeModal(); save(true); dirty.act = true; drawPriceLines();
      toast('TP / SL updated · ' + a.sym, 'TP ' + (p.tp ? px(a, p.tp) : '—') + ' · SL ' + (p.sl ? px(a, p.sl) : '—'), 'ok');
    };
  }

  /* ---------------- select asset ---------------- */
  function selectAsset(id) {
    if (!D.BY_ID[id]) return;
    S.ui.asset = id;
    D.select(id, S.ui.tf);
    lastBook = null; renderBook();
    Object.keys(rows).forEach(function (k) { rows[k].el.classList.toggle('is-active', k === id); });
    setupTicketForAsset();
    renderHead(); loadChart(); updTicket();
    save();
  }

  /* ---------------- live account flow (UI only) ---------------- */
  var NETS = { USDT: ['Tron (TRC-20)', 'Ethereum (ERC-20)', 'BNB Smart Chain (BEP-20)'], BTC: ['Bitcoin'], ETH: ['Ethereum', 'Arbitrum One'] };
  function liveFlow(step, sel) {
    sel = sel || { coin: 'USDT', net: 0 };
    var steps = ['Verify account', 'Deposit crypto', 'Go live'];
    var head = '<div class="lf-steps">' + steps.map(function (s, i) { return '<span class="' + (i < step ? 'done' : i === step ? 'cur' : '') + '"><i>' + (i + 1) + '</i>' + s + '</span>'; }).join('') + '</div>';
    var body;
    if (step === 0) {
      body = '<h3 id="modalTitle">Verify your identity</h3><p class="muted">Required before real-money trading. In the full build this step is handled by a licensed KYC provider; nothing is collected in this demo.</p>' +
        '<ol class="kyc">' +
        '<li><b>Email &amp; phone</b><span>One-time codes</span><em class="st">Full build</em></li>' +
        '<li><b>Personal details &amp; residency</b><span>Country eligibility check (US / EU rules)</span><em class="st">Full build</em></li>' +
        '<li><b>Identity document</b><span>Passport or ID card, captured by the KYC provider</span><em class="st">Full build</em></li>' +
        '<li><b>Liveness check</b><span>Selfie video, provider-hosted</span><em class="st">Full build</em></li>' +
        '<li><b>Suitability questionnaire</b><span>Leverage experience &amp; risk warnings</span><em class="st">Full build</em></li></ol>' +
        '<div class="lf-btns"><button class="btn-ghost" data-lf="cancel">Stay in demo</button><button class="btn-submit long" data-lf="next">Continue (demo walkthrough)</button></div>';
    } else if (step === 1) {
      body = '<h3 id="modalTitle">Deposit crypto</h3><p class="muted">Preview of the deposit screen. No address is issued and no payment can be made here.</p>' +
        '<div class="field"><label>Asset</label><div class="seg seg-sm" id="lfCoin">' + Object.keys(NETS).map(function (c) { return '<button class="seg-btn' + (c === sel.coin ? ' is-active' : '') + '" data-coin="' + c + '">' + c + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="lfNet">Network</label><select id="lfNet" class="select">' + NETS[sel.coin].map(function (n, i) { return '<option value="' + i + '"' + (i === sel.net ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Deposit address</label><div class="addr-ph">Deposit address will be generated by the payment provider in the full build.<br><small>No address, QR code or payment link is shown in this demo.</small></div></div>' +
        '<dl class="summary"><div><dt>Credited as</dt><dd>USD trading balance (after conversion)</dd></div><div><dt>Confirmations</dt><dd>Set by the payment provider per network</dd></div><div><dt>Minimum deposit</dt><dd>Configured in the full build</dd></div></dl>' +
        '<div class="lf-btns"><button class="btn-ghost" data-lf="back">Back</button><button class="btn-submit long" data-lf="next">Continue</button></div>';
    } else {
      body = '<h3 id="modalTitle">Live trading will be enabled in the full build</h3><p class="muted">This demo runs on paper money only. The full build connects a regulated broker / liquidity provider, a KYC provider and a crypto payment processor, and keeps live and demo accounts fully separated.</p>' +
        '<ul class="lf-list"><li>Separate live wallet &amp; ledger, withdrawals with 2FA</li><li>Real order routing with risk checks and margin calls</li><li>Region rules for US and EU clients (leverage caps, disclosures)</li></ul>' +
        '<div class="lf-btns"><button class="btn-submit long" data-lf="cancel">Back to demo</button></div>';
    }
    modal('<div class="lf">' + head + body + '</div>', true);
    var mb = $('modalBody');
    mb.querySelectorAll('[data-lf]').forEach(function (b) {
      b.onclick = function () {
        var k = b.dataset.lf;
        if (k === 'cancel') { closeModal(); setMode('demo'); }
        else if (k === 'next') liveFlow(step + 1, sel);
        else if (k === 'back') liveFlow(step - 1, sel);
      };
    });
    mb.querySelectorAll('[data-coin]').forEach(function (b) { b.onclick = function () { liveFlow(1, { coin: b.dataset.coin, net: 0 }); }; });
    var net = $('lfNet'); if (net) net.onchange = function () { sel.net = +net.value; };
  }
  function setMode(m) {
    document.querySelectorAll('#modeSwitch button').forEach(function (b) { b.classList.toggle('is-active', b.dataset.mode === m); b.setAttribute('aria-pressed', b.dataset.mode === m ? 'true' : 'false'); });
  }

  /* ---------------- data sources panel ---------------- */
  function sourcesPanel() {
    function st(feed) {
      var list = D.ASSETS.filter(function (a) { return a.feed === feed; });
      if (!list.length) return '';
      var b = D.badge(list[0]);
      return '<span class="badge ' + b.cls + '">' + esc(b.text) + '</span>';
    }
    var rows = [
      ['Crypto', st('binance'), 'Binance public REST + WebSocket (keyless): last price, 24h stats, candles, order book', 'Binance / Coinbase / Kraken WebSocket feeds (free); Kaiko or CoinAPI for consolidated, licensed data (paid)'],
      ['Metals (gold, silver, platinum, palladium, copper)', st('goldapi'), 'gold-api.com spot prices (keyless), refreshed every 12 s; chart history is sample', 'Metals-API, Twelve Data or Polygon.io (paid); LBMA / CME data licences for production'],
      ['Energy & agriculture', st('sample'), 'Sample data around the ' + D.REF_DATE + ' reference close', 'CME Group DataMine, Barchart OnDemand, Twelve Data commodities (paid); broker/LP price feed for CFDs'],
      ['Forex (incl. USD/TRY)', st('fx'), 'Frankfurter (central-bank reference rates, daily), fallback open.er-api.com (daily); intraday ticks simulated', 'OANDA, Twelve Data, Polygon.io FX or the liquidity provider’s streaming quotes'],
      ['Indices', '<span class="badge b-sample">Sample</span>', 'Sample data around the ' + D.REF_DATE + ' reference close', 'Twelve Data / Polygon.io indices (paid, exchange licences); CFD prices from the LP'],
      ['US stocks', '<span class="badge b-sample">Sample</span>', 'Sample data around the ' + D.REF_DATE + ' reference close', 'Alpaca (free IEX feed), Finnhub (free tier), Polygon.io (paid, full SIP)'],
      ['Prediction markets', '<span class="badge b-sample">Sample</span>', 'Sample markets priced by a local LMSR market maker; background flow simulated. 15-minute BTC Up/Down rounds take their start and end price from Binance (sample price if Binance is unreachable)', 'Own matching engine + resolution oracle; read-only reference data from the Polymarket and Kalshi public APIs']
    ];
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Data sources</div><p class="fine">What drives each asset class in this demo right now, and what the full build would connect. Badges update live; if a source fails, its assets switch to sample data automatically.</p>' +
      '<div class="table-scroll"><table class="tbl ds"><thead><tr><th>Asset class</th><th>Status</th><th>In this demo</th><th>Full build options</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="fine">Reference closes for sample data were taken from public quotes on ' + D.REF_DATE + '. No API keys are used anywhere in this demo.</p></div>', true);
  }

  /* ---------------- feed status line ---------------- */
  function renderFeedStatus() {
    var bn = D.binance, gold = D.BY_ID.XAUUSD, fx = D.BY_ID.EURUSD;
    var bnTxt = { live: 'Binance stream live', rest: 'Binance via REST polling', reconnecting: 'Binance reconnecting…', offline: 'Binance offline · sample', connecting: 'Connecting to Binance…' }[bn.mode] || '';
    var gTxt = gold.state === 'live' ? 'gold-api live' : gold.state === 'fallback' ? 'gold-api offline · sample' : 'gold-api…';
    var fTxt = fx.state === 'daily' ? 'FX daily · ' + fx.srcName : fx.state === 'fallback' ? 'FX offline · sample' : 'FX…';
    function dot(ok) { return '<span class="dot ' + (ok === true ? 'ok' : ok === false ? 'bad' : '') + '"></span>'; }
    $('feedStatus').innerHTML = '<span>' + dot(bn.mode === 'live' || bn.mode === 'rest' ? true : bn.mode === 'offline' ? false : null) + bnTxt + '</span>' +
      '<span>' + dot(gold.state === 'live' ? true : gold.state === 'fallback' ? false : null) + gTxt + '</span>' +
      '<span>' + dot(fx.state === 'daily' ? true : fx.state === 'fallback' ? false : null) + fTxt + '</span>';
  }

  /* ---------------- pointer guard ----------------
     Tables and chips are re-rendered several times a second. If that happens between a
     button's pointerdown and pointerup, the browser drops the click. While a pointer is
     pressed, background re-renders wait (user actions still render immediately). */
  var ptrDown = false, ptrAt = 0;
  document.addEventListener('pointerdown', function () { ptrDown = true; ptrAt = Date.now(); }, true);
  function ptrUp() { setTimeout(function () { ptrDown = false; }, 0); }
  document.addEventListener('pointerup', ptrUp, true);
  document.addEventListener('pointercancel', ptrUp, true);
  window.addEventListener('blur', ptrUp);
  function pointerBusy() { return ptrDown && Date.now() - ptrAt < 8000; }
  window.VXPointerBusy = pointerBusy;

  /* ---------------- render loop ---------------- */
  var dirty = { rows: {}, head: false, act: false, movers: false };
  function frame() {
    Object.keys(dirty.rows).forEach(function (id) { updRow(D.BY_ID[id]); });
    dirty.rows = {};
    if (dirty.head) { renderHead(); updTicket(); dirty.head = false; }
    var busy = pointerBusy();
    if (dirty.movers && !busy) { renderMovers(); dirty.movers = false; }
    if (!busy && (dirty.act || (S.ui.act || 'pos') === 'pos' && S.positions.length)) renderActivity();
    renderAccount();
  }
  setInterval(frame, 400);

  /* ---------------- views ---------------- */
  function setView(v) {
    S.ui.view = v;
    document.querySelectorAll('.nav-btn').forEach(function (b) { var on = b.dataset.view === v; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    $('viewTrade').classList.toggle('is-active', v === 'trade');
    $('viewPredict').classList.toggle('is-active', v === 'predict');
    if (v === 'predict') { P.ensure(function (id) { return D.tick[id] ? D.tick[id].price : 0; }); P.renderAll(); }
    save();
  }

  function resetDemo() {
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Reset demo?</div><p class="fine">Restores the 100,000 USD paper balance and clears all positions, orders, prediction shares and history. Sample prediction markets are re-created.</p>' +
      '<div class="lf-btns"><button class="btn-ghost" id="rsNo">Cancel</button><button class="btn-submit short" id="rsYes">Reset demo</button></div></div>');
    $('rsNo').onclick = closeModal;
    $('rsYes').onclick = function () {
      var ui = S.ui; var keep = { asset: ui.asset, tf: ui.tf, cat: ui.cat, sub: ui.sub, view: ui.view };
      var n = fresh(); Object.keys(n).forEach(function (k) { S[k] = n[k]; });
      Object.keys(keep).forEach(function (k) { if (keep[k] != null) S.ui[k] = keep[k]; });
      P.setState(S);
      P.ensure(function (id) { return D.tick[id] ? D.tick[id].price : 0; });
      closeModal(); save(true);
      setupTicketForAsset(); drawPriceLines(); renderActivity(); renderAccount(); P.renderAll(); updTicket();
      toast('Demo reset', 'Paper balance restored to $100,000.00', 'ok');
    };
  }

  /* ---------------- wiring ---------------- */
  function bind() {
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.onclick = function () { setView(b.dataset.view); }; });
    $('catTabs').onclick = function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; S.ui.cat = b.dataset.cat; S.ui.sub = 'all'; $('watchSearch').value = ''; buildWatch(); save(); };
    $('subTabs').onclick = function (e) { var b = e.target.closest('[data-sub]'); if (!b) return; S.ui.sub = b.dataset.sub; buildWatch(); save(); };
    $('watchSearch').oninput = buildWatch;
    $('watchList').onclick = function (e) { var r = e.target.closest('.wrow'); if (r) { selectAsset(r.dataset.id); if (window.innerWidth < 900) $('chartwrap').scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
    $('movers').onclick = function (e) { var b = e.target.closest('[data-id]'); if (!b) return; S.ui.cat = 'cmd'; S.ui.sub = 'all'; buildWatch(); selectAsset(b.dataset.id); };
    $('tfTabs').onclick = function (e) {
      var b = e.target.closest('[data-tf]'); if (!b) return;
      S.ui.tf = b.dataset.tf;
      document.querySelectorAll('#tfTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      D.select(S.ui.asset, S.ui.tf); loadChart(); save();
    };
    $('sideTabs').onclick = function (e) { var b = e.target.closest('[data-side]'); if (!b) return; tk.side = b.dataset.side; document.querySelectorAll('#sideTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); }); updTicket(); };
    $('typeTabs').onclick = function (e) {
      var b = e.target.closest('[data-type]'); if (!b) return; tk.type = b.dataset.type;
      document.querySelectorAll('#typeTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      $('limitField').hidden = tk.type !== 'limit';
      var a = D.BY_ID[S.ui.asset];
      if (tk.type === 'limit' && !$('inLimit').value && hasPrice(a)) $('inLimit').value = px(a, tk.side === 'long' ? quote(a).bid * 0.998 : quote(a).ask * 1.002).replace(/,/g, '');
      updTicket();
    };
    $('inLev').oninput = function () { $('inLevNum').value = $('inLev').value; setLev(+$('inLev').value, true); };
    $('inLevNum').oninput = function () { var v = parseFloat($('inLevNum').value); setLev(v, true); };
    $('inLevNum').onblur = function () { var v = parseFloat($('inLevNum').value); if (!isFinite(v) || v < 1) setLev(1); };
    $('levChips').onclick = function (e) { var b = e.target.closest('[data-lev]'); if (b) setLev(+b.dataset.lev); };
    $('pctChips').onclick = function (e) {
      var b = e.target.closest('[data-pct]'); if (!b) return;
      var a = D.BY_ID[S.ui.asset], c = cls(a), lev = Math.min(c.maxLev, Math.max(1, curLev() || 1));
      var maxM = S.balance / (1 + lev * (tk.type === 'limit' ? c.maker : c.taker));
      var v = Math.floor(maxM * (+b.dataset.pct) / 100 * 100) / 100;
      $('inMargin').value = v > 0 ? v.toFixed(2) : '0';
      updTicket();
    };
    ['inMargin', 'inLimit', 'inTp', 'inSl'].forEach(function (id) { $(id).oninput = updTicket; $(id).onkeydown = function (e) { if (e.key === 'Enter') submitTicket(); }; });
    $('btnSubmit').onclick = submitTicket;
    $('actTabs').onclick = function (e) { var b = e.target.closest('[data-act]'); if (b) setAct(b.dataset.act); };
    $('actBody').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.close) {
        b.disabled = true;
        var r = closePosition(b.dataset.close, 'manual');
        if (r) { var a = D.BY_ID[r.pos.asset]; toast('Position closed · ' + a.sym, 'Exit ' + px(a, r.exit) + ' · realized ' + signed(r.st.realized), r.st.realized >= 0 ? 'ok' : 'bad'); }
        save(true); drawPriceLines(); renderActivity(); renderAccount(); updTicket();
      } else if (b.dataset.cancel) { cancelOrder(b.dataset.cancel); toast('Limit order cancelled', 'Reserved margin returned', 'ok'); save(true); drawPriceLines(); renderActivity(); updTicket(); }
      else if (b.dataset.tpsl) editTpSl(b.dataset.tpsl);
      else if (b.dataset.go) { selectAsset(b.dataset.go); }
    };
    $('btnCloseAll').onclick = function () {
      var tot = 0, n = 0;
      S.positions.slice().forEach(function (p) { var r = closePosition(p.id, 'manual'); if (r) { tot += r.st.realized; n++; } });
      toast('Closed ' + n + ' positions', 'Realized ' + signed(tot), tot >= 0 ? 'ok' : 'bad');
      save(true); drawPriceLines(); renderActivity(); renderAccount(); updTicket();
    };
    $('btnReset').onclick = resetDemo;
    $('btnSources').onclick = sourcesPanel;
    $('lnkSources').onclick = function (e) { e.preventDefault(); sourcesPanel(); };
    $('modeSwitch').onclick = function (e) { var b = e.target.closest('[data-mode]'); if (!b) return; if (b.dataset.mode === 'live') { setMode('live'); liveFlow(0); } else setMode('demo'); };
    $('modalX').onclick = function () { closeModal(); setMode('demo'); };
    $('modal').onclick = function (e) { if (e.target === $('modal')) { closeModal(); setMode('demo'); } };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('modal').hidden) { closeModal(); setMode('demo'); } });
  }

  /* ---------------- data events ---------------- */
  D.on('tick', function (id) {
    dirty.rows[id] = true;
    if (id === S.ui.asset) dirty.head = true;
    if (D.BY_ID[id].cat === 'cmd') dirty.movers = true;
    onPrice(id);
  });
  D.on('candle', onCandle);
  D.on('book', onBook);
  D.on('status', function () { renderFeedStatus(); });
  function renderNetNotice() {
    var off = D.ASSETS.filter(function (a) { return a.state === 'fallback'; });
    var el = $('netNotice');
    el.hidden = !off.length;
    if (off.length) el.textContent = 'Some data sources are unreachable — ' + off.length + ' markets switched to sample data.';
  }
  D.on('source', function (a) {
    dirty.rows[a.id] = true; renderFeedStatus(); renderNetNotice();
    if (a.id === S.ui.asset) { dirty.head = true; $('chartNote').textContent = D.historyNote(a, S.ui.tf) + ' · times in UTC'; }
    if (a.state === 'fallback' && !srcWarned[a.feed]) {
      srcWarned[a.feed] = true;
      toast({ binance: 'Binance is unreachable', goldapi: 'Metals price source is unreachable', fx: 'FX rate source is unreachable' }[a.feed] || 'Data source unreachable',
        'Affected markets now show sample data and are labelled "Sample · offline". Trading keeps working.', 'warn');
    }
  });
  var srcWarned = {};
  D.on('reload', function (id) { if (id === S.ui.asset) { loadChart(); setupTicketForAsset(); updTicket(); } });

  /* ---------------- boot ---------------- */
  function boot() {
    bind();
    P.init(S, {
      usd: usd, signed: signed, toast: toast, modal: modal, closeModal: closeModal,
      chartOptions: function () { var o = chartOptions(); o.timeScale.secondsVisible = false; return o; },
      changed: function (important) { save(!!important); renderAccount(); P.renderSide(); }
    });
    initChart();
    D.select(S.ui.asset, S.ui.tf);
    D.start();
    document.querySelectorAll('#tfTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.tf === S.ui.tf); });
    buildWatch(); renderMovers(); renderFeedStatus();
    selectAsset(S.ui.asset);
    setAct(S.ui.act || 'pos');
    setView(S.ui.view === 'predict' ? 'predict' : 'trade');
    // prediction markets need live BTC/ETH/gold prices for their strikes: build them once prices arrive
    var tries = 0, pmTimer = setInterval(function () {
      tries++;
      var have = ['BTC', 'ETH', 'XAUUSD'].every(function (id) { return D.tick[id] && D.BY_ID[id].state !== 'pending'; });
      if (have || tries > 12 || (S.pm && S.pm.v === 2)) {
        clearInterval(pmTimer);
        P.ensure(function (id) { return D.tick[id] ? D.tick[id].price : 0; });
        P.renderAll(); save();
      }
    }, 500);
    renderAccount();
    if (!storageOk) storageNotice();
    try { window.localStorage.setItem('vx-probe', '1'); window.localStorage.removeItem('vx-probe'); } catch (e) { if (storageOk) { storageOk = false; storageNotice(); } }
    if (/[?&]selftest\b/.test(location.search)) showSelfTest();
  }

  function showSelfTest() {
    var r = window.VXRunTests(true);
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Engine self-test · ' + r.passed + '/' + r.total + ' passed</div><div class="table-scroll"><table class="tbl"><thead><tr><th></th><th>Check</th><th>Expected</th><th>Actual</th></tr></thead><tbody>' +
      r.results.map(function (x) { return '<tr><td class="' + (x.pass ? 'up' : 'down') + '">' + (x.pass ? '✓' : '✗') + '</td><td>' + esc(x.name) + '</td><td class="mono">' + esc(String(x.expected)) + '</td><td class="mono">' + esc(typeof x.actual === 'number' ? (+x.actual.toFixed(8)).toString() : String(x.actual)) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>', true);
  }

  // test hooks (used by the automated browser check; harmless for visitors)
  window.VX = { state: function () { return S; }, placeOrder: placeOrder, closePosition: closePosition, cancelOrder: cancelOrder, onPrice: onPrice,
                selectAsset: selectAsset, quote: function (id) { return quote(D.BY_ID[id]); }, equity: equity, data: D, predict: P, save: save };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
