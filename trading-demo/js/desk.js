/* Demo Exchange - commodities desk: contract details, roll calendar (sample), economic calendar
 * (sample dates), seasonality (sample data). Nothing on this page claims a real future date or a
 * real historical statistic: every generated date or figure is labelled "sample". */
(function () {
  'use strict';
  var A = window.VXApp; if (!A) return;
  var D = A.D, esc = A.esc, nf = A.nf;
  var $ = function (id) { return document.getElementById(id); };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var CODE = 'FGHJKMNQUVXZ';

  /* reference futures contracts (exchange specifications) */
  var SPEC = {
    XAUUSD: { code: 'GC', exch: 'COMEX (CME Group)', size: '100 troy oz', tick: '0.10 USD/oz = 10.00 USD', months: [2, 4, 6, 8, 10, 12], settle: 'Physical delivery' },
    XAGUSD: { code: 'SI', exch: 'COMEX (CME Group)', size: '5,000 troy oz', tick: '0.005 USD/oz = 25.00 USD', months: [3, 5, 7, 9, 12], settle: 'Physical delivery' },
    XPTUSD: { code: 'PL', exch: 'NYMEX (CME Group)', size: '50 troy oz', tick: '0.10 USD/oz = 5.00 USD', months: [1, 4, 7, 10], settle: 'Physical delivery' },
    XPDUSD: { code: 'PA', exch: 'NYMEX (CME Group)', size: '100 troy oz', tick: '0.50 USD/oz = 50.00 USD', months: [3, 6, 9, 12], settle: 'Physical delivery' },
    COPPER: { code: 'HG', exch: 'COMEX (CME Group)', size: '25,000 lb', tick: '0.0005 USD/lb = 12.50 USD', months: [3, 5, 7, 9, 12], settle: 'Physical delivery' },
    PAXG:   { code: '—', exch: 'Paxos token (Ethereum)', size: '1 token = 1 fine troy oz', tick: 'n/a', months: null, settle: 'Redeemable with the issuer' },
    BRENT:  { code: 'B', exch: 'ICE Futures Europe', size: '1,000 barrels', tick: '0.01 USD/bbl = 10.00 USD', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], settle: 'Cash-settled (ICE Brent Index)', exp: 'brent' },
    WTI:    { code: 'CL', exch: 'NYMEX (CME Group)', size: '1,000 barrels', tick: '0.01 USD/bbl = 10.00 USD', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], settle: 'Physical delivery (Cushing, OK)', exp: 'cl' },
    NATGAS: { code: 'NG', exch: 'NYMEX (CME Group)', size: '10,000 MMBtu', tick: '0.001 USD/MMBtu = 10.00 USD', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], settle: 'Physical delivery (Henry Hub)', exp: 'ng' },
    WHEAT:  { code: 'ZW', exch: 'CBOT (CME Group)', size: '5,000 bushels', tick: '0.25 ¢/bu = 12.50 USD', months: [3, 5, 7, 9, 12], settle: 'Physical delivery' },
    CORN:   { code: 'ZC', exch: 'CBOT (CME Group)', size: '5,000 bushels', tick: '0.25 ¢/bu = 12.50 USD', months: [3, 5, 7, 9, 12], settle: 'Physical delivery' },
    SOYBEAN:{ code: 'ZS', exch: 'CBOT (CME Group)', size: '5,000 bushels', tick: '0.25 ¢/bu = 12.50 USD', months: [1, 3, 5, 7, 8, 9, 11], settle: 'Physical delivery' },
    COFFEE: { code: 'KC', exch: 'ICE Futures U.S.', size: '37,500 lb', tick: '0.05 ¢/lb = 18.75 USD', months: [3, 5, 7, 9, 12], settle: 'Physical delivery' },
    SUGAR:  { code: 'SB', exch: 'ICE Futures U.S.', size: '112,000 lb', tick: '0.01 ¢/lb = 11.20 USD', months: [3, 5, 7, 10], settle: 'Physical delivery' },
    COCOA:  { code: 'CC', exch: 'ICE Futures U.S.', size: '10 metric tons', tick: '1 USD/t = 10.00 USD', months: [3, 5, 7, 9, 12], settle: 'Physical delivery' },
    COTTON: { code: 'CT', exch: 'ICE Futures U.S.', size: '50,000 lb', tick: '0.01 ¢/lb = 5.00 USD', months: [3, 5, 7, 10, 12], settle: 'Physical delivery' }
  };
  function cmds() { return D.ASSETS.filter(function (a) { return a.cat === 'cmd'; }); }
  function goBtn(a, txt) { return '<button class="linkbtn sym" data-trade="' + a.id + '">' + esc(txt || a.sym) + '</button>'; }

  /* ---------- contracts ---------- */
  function specsHtml() {
    var rows = cmds().map(function (a) {
      var s = SPEC[a.id], c = A.cls(a), ss = A.sess(a);
      return '<tr><td>' + goBtn(a) + '<div class="sub">' + esc(a.name) + '</div></td><td class="mono">' + esc(s.code) + '</td><td>' + esc(s.exch) + '<div class="sub">' + esc(s.settle) + '</div></td><td>' + esc(s.size) + '</td><td class="mono">' + esc(s.tick) + '</td>' +
        '<td class="mono">' + (s.months ? (s.months.length === 12 ? 'Monthly' : s.months.map(function (m) { return CODE[m - 1]; }).join(' ')) : '—') + '</td>' +
        '<td class="mono r">' + c.maxLev + 'x</td><td class="mono r">' + (a.spread ? A.px(a, a.spread) : 'book') + '</td>' +
        '<td><span class="sess ' + (ss.open ? (ss.practice ? 'practice' : 'open') : 'closed') + '">' + esc(ss.open ? (ss.practice ? 'Practice 24/7' : 'Open') : ss.label) + '</span><div class="sub">' + esc(a.hours) + '</div></td></tr>';
    }).join('');
    return '<div class="pg"><section class="sec pg-grid"><div class="sec"><div class="sec-h"><h2>Contract details</h2><span class="sec-r"><span class="tag">exchange specifications</span></span></div>' +
      '<div class="table-scroll"><table class="tbl"><thead><tr><th>Market</th><th>Futures</th><th>Exchange</th><th>Contract size</th><th>Tick size / value</th><th>Months</th><th class="r">Max lev.</th><th class="r">Spread</th><th>Session</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="sec-note">Left columns: the exchange-traded futures contract each market references. Right columns: the instrument in this demo, a USD-settled CFD on the price where 1 unit equals 1 oz, barrel, bushel, lb or MMBtu, so a futures-size position is reached with quantity, not contract count. Month codes: F Jan, G Feb, H Mar, J Apr, K May, M Jun, N Jul, Q Aug, U Sep, V Oct, X Nov, Z Dec. Click a market to trade it.</div></div></section></div>';
  }

  /* ---------- roll calendar (sample rule) ---------- */
  function bizBack(d, n) { var x = new Date(d); while (n > 0) { x.setUTCDate(x.getUTCDate() - 1); var w = x.getUTCDay(); if (w !== 0 && w !== 6) n--; } return x; }
  function firstBiz(y, m) { var x = new Date(Date.UTC(y, m - 1, 1)); while (x.getUTCDay() === 0 || x.getUTCDay() === 6) x.setUTCDate(x.getUTCDate() + 1); return x; }
  function isBiz(d) { var w = d.getUTCDay(); return w !== 0 && w !== 6; }
  /* approximate last trading day of energy futures (holidays ignored):
     Brent: last business day of the second month before delivery; WTI: 3 business days before the 25th
     of the month before delivery (25th moved back to a business day); Henry Hub: 3 business days before the 1st */
  function energyExpiry(kind, y, m) {
    if (kind === 'brent') { var x = new Date(Date.UTC(y, m - 2, 0)); while (!isBiz(x)) x.setUTCDate(x.getUTCDate() - 1); return x; }
    if (kind === 'cl') { var d = new Date(Date.UTC(y, m - 2, 25)); while (!isBiz(d)) d.setUTCDate(d.getUTCDate() - 1); return bizBack(d, 3); }
    return bizBack(new Date(Date.UTC(y, m - 1, 1)), 3);
  }
  function contracts(s, from) {
    var out = [], y = from.getUTCFullYear(), guard = 0;
    for (var yy = y; yy <= y + 2 && out.length < 3 && guard < 40; yy++) {
      s.months.forEach(function (m) {
        guard++;
        if (out.length >= 3) return;
        var roll = s.exp ? bizBack(energyExpiry(s.exp, yy, m), 5) : bizBack(firstBiz(yy, m), 5);
        if (roll.getTime() > from.getTime()) out.push({ y: yy, m: m, roll: roll });
      });
    }
    return out;
  }
  function cname(code, c) { return MON[c.m - 1] + ' ' + c.y + ' <span class="muted">' + code + CODE[c.m - 1] + String(c.y).slice(-2) + '</span>'; }
  function fdate(d) { return MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); }
  function rollHtml() {
    var now = new Date(), list = [];
    cmds().forEach(function (a) {
      var s = SPEC[a.id]; if (!s.months) return;
      var cs = contracts(s, now); if (cs.length < 2) return;
      list.push({ a: a, s: s, front: cs[0], next: cs[1], days: Math.ceil((cs[0].roll - now) / 86400000) });
    });
    list.sort(function (x, y) { return x.days - y.days; });
    var rows = list.map(function (r) {
      return '<tr><td>' + goBtn(r.a) + '</td><td>' + cname(r.s.code, r.front) + '</td><td>' + cname(r.s.code, r.next) + '</td><td class="mono">' + fdate(r.front.roll) + ' <span class="pill pill-sim">sample</span></td>' +
        '<td class="mono r ' + (r.days <= 7 ? 'warn' : '') + '">' + r.days + 'd</td><td>' + r.s.months.map(function (m) { return CODE[m - 1]; }).join(' ') + '</td></tr>';
    }).join('');
    return '<div class="pg"><section class="sec pg-grid"><div class="sec"><div class="sec-h"><h2>Roll calendar</h2><span class="tag">sample dates</span></div>' +
      '<div class="table-scroll"><table class="tbl"><thead><tr><th>Market</th><th>Front contract</th><th>Next contract</th><th>Roll date</th><th class="r">Days to roll</th><th>Month codes</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="sec-note">Sample schedule. Contract cycles and month codes are the exchange’s; roll dates are 5 business days before an approximate last trading day (Brent, WTI, natural gas) or before the first business day of the delivery month (metals and softs/grains). Exchange holidays are ignored, so these are not the official last-trade or first-notice dates. Demo CFDs track the price directly, so no roll adjustment is applied to open positions.</div></div></section></div>';
  }

  /* ---------- economic calendar (sample dates) ---------- */
  var etParts = null;
  function etHour(ms) {
    etParts = etParts || new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    var o = {}; etParts.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; }); return (+o.hour % 24) * 60 + (+o.minute);
  }
  /* UTC ms of a New York wall-clock time (tries EDT then EST) */
  function et(y, m, d, h, mi) {
    for (var off = 4; off <= 5; off++) { var t = Date.UTC(y, m, d, h + off, mi); if (etHour(t) === h * 60 + mi) return t; }
    return Date.UTC(y, m, d, h + 5, mi);
  }
  function nextDow(from, dow, k) { var x = new Date(from); x.setUTCHours(12, 0, 0, 0); x.setUTCDate(x.getUTCDate() + ((dow - x.getUTCDay() + 7) % 7) + 7 * (k || 0)); return x; }
  var EVENTS = [
    { k: 'eia', name: 'EIA Weekly Petroleum Status Report', grp: 'energy', imp: 'h', dow: 3, h: 10, mi: 30, aff: ['WTI', 'BRENT'], note: 'US crude and product inventories. Usual slot: Wednesday 10:30 ET.' },
    { k: 'ngs', name: 'EIA Weekly Natural Gas Storage Report', grp: 'energy', imp: 'h', dow: 4, h: 10, mi: 30, aff: ['NATGAS'], note: 'Working gas in storage. Usual slot: Thursday 10:30 ET.' },
    { k: 'rig', name: 'Baker Hughes rig count', grp: 'energy', imp: 'l', dow: 5, h: 13, mi: 0, aff: ['WTI'], note: 'Active US drilling rigs. Usual slot: Friday 13:00 ET.' },
    { k: 'cot', name: 'CFTC Commitments of Traders', grp: 'macro', imp: 'm', dow: 5, h: 15, mi: 30, aff: ['XAUUSD', 'WTI', 'CORN'], note: 'Positioning by trader category. Usual slot: Friday 15:30 ET.' },
    { k: 'crop', name: 'USDA Crop Progress', grp: 'ag', imp: 'm', dow: 1, h: 16, mi: 0, aff: ['CORN', 'SOYBEAN', 'WHEAT', 'COTTON'], note: 'Planting and harvest progress, season only. Usual slot: Monday 16:00 ET.' },
    { k: 'wasde', name: 'USDA WASDE report', grp: 'ag', imp: 'h', monthly: 11, h: 12, mi: 0, aff: ['CORN', 'SOYBEAN', 'WHEAT', 'COTTON', 'SUGAR'], note: 'World Agricultural Supply and Demand Estimates, monthly.' },
    { k: 'opec', name: 'OPEC+ ministerial meeting', grp: 'energy', imp: 'h', monthly: 3, h: 8, mi: 0, aff: ['BRENT', 'WTI'], note: 'Production policy. Meeting dates are set by OPEC and change often.' },
    { k: 'fomc', name: 'FOMC rate decision', grp: 'macro', imp: 'h', monthly: 9, h: 14, mi: 0, aff: ['XAUUSD', 'XAGUSD', 'US500', 'EURUSD'], note: 'Federal Reserve policy statement, press conference 30 minutes later.' },
    { k: 'cpi', name: 'US CPI', grp: 'macro', imp: 'h', monthly: 13, h: 8, mi: 30, aff: ['XAUUSD', 'US500', 'EURUSD'], note: 'Consumer Price Index, BLS.' },
    { k: 'nfp', name: 'US Nonfarm payrolls', grp: 'macro', imp: 'h', firstFri: true, h: 8, mi: 30, aff: ['XAUUSD', 'US500', 'USDJPY'], note: 'Employment Situation report, BLS.' }
  ];
  var calFilter = 'all';
  function calItems() {
    var now = A.HR.now(), out = [], base = new Date(now);
    EVENTS.forEach(function (e) {
      var dates = [];
      if (e.dow != null) { for (var k = 0; k < 3; k++) dates.push(nextDow(base, e.dow, k)); }
      else {
        for (var mm = 0; mm < 2; mm++) {
          var y = base.getUTCFullYear(), m = base.getUTCMonth() + mm;
          var d;
          if (e.firstFri) { d = new Date(Date.UTC(y, m, 1, 12)); while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1); }
          else { d = new Date(Date.UTC(y, m, Math.min(e.monthly, 28), 12)); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1); }
          dates.push(d);
        }
      }
      dates.forEach(function (d) {
        var t = et(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), e.h, e.mi);
        if (t > now - 3600000 && t < now + 35 * 86400000) out.push({ e: e, t: t });
      });
    });
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }
  var dayFmt = null;
  function etDay(t) { dayFmt = dayFmt || new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' }); return dayFmt.format(new Date(t)); }
  function ecoHtml() {
    var items = calItems().filter(function (x) { return calFilter === 'all' || x.e.grp === calFilter; }), lastDay = '', rows = '';
    items.forEach(function (x) {
      var day = etDay(x.t);
      if (day !== lastDay) { lastDay = day; rows += '<tr><td colspan="6" class="cal-day">' + esc(day) + ' <span class="pill pill-sim">sample date</span></td></tr>'; }
      var e = x.e, left = x.t - A.HR.now();
      rows += '<tr><td class="mono">' + ('0' + e.h).slice(-2) + ':' + ('0' + e.mi).slice(-2) + ' ET</td><td><span class="imp ' + e.imp + '" title="' + { h: 'High', m: 'Medium', l: 'Low' }[e.imp] + ' impact"><i></i><i></i><i></i></span></td>' +
        '<td>' + esc(e.name) + '<div class="sub">' + esc(e.note) + '</div></td><td>' + e.aff.map(function (id) { var a = D.BY_ID[id]; return a ? goBtn(a, a.sym) : ''; }).join(' ') + '</td>' +
        '<td class="mono r">' + (left > 0 ? 'in ' + A.HR.untilText(x.t) : 'now') + '</td><td>' + { energy: 'Energy', ag: 'Agriculture', macro: 'Macro' }[e.grp] + '</td></tr>';
    });
    return '<div class="pg"><section class="sec pg-grid"><div class="sec"><div class="sec-h"><h2>Economic calendar</h2><span class="tag">sample dates</span>' +
      '<span class="sec-r"><span class="chips-row" id="calF">' + [['all', 'All'], ['energy', 'Energy'], ['ag', 'Agriculture'], ['macro', 'Macro']].map(function (f) { return '<button class="seg-btn' + (calFilter === f[0] ? ' is-active' : '') + '" data-cf="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</span></span></div>' +
      '<div class="table-scroll"><table class="tbl"><thead><tr><th>Time</th><th>Impact</th><th>Event</th><th>Moves</th><th class="r">Starts</th><th>Group</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6">' + A.emptySt('calendar-blank', 'No events in this group', 'Pick another filter.') + '</td></tr>') + '</tbody></table></div>' +
      '<div class="sec-note">Sample schedule built from each report’s usual weekday and time. Dates are examples for the demo, not the official release calendar; holidays and rescheduled releases are not reflected. The full build reads the publishers’ calendars (EIA, USDA, BLS, Federal Reserve, OPEC).</div></div></section></div>';
  }

  /* ---------- seasonality (sample data) ---------- */
  var seaSel = 'NATGAS';
  function seaData(id) {
    var h = 2166136261; for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    function r() { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
    var phase = r() * 12, amp = 1 + r() * 2.5;
    return MON.map(function (m, k) { var v = amp * Math.sin((k - phase) / 12 * 2 * Math.PI) + (r() - 0.5) * 2.2; return { m: m, avg: Math.round(v * 100) / 100, up: Math.max(3, Math.min(13, Math.round(7.5 + v * 1.4 + (r() - 0.5) * 3))) }; });
  }
  function seaHtml() {
    var a = D.BY_ID[seaSel], data = seaData(seaSel), W = 720, Hh = 220, pad = 34, max = 0;
    data.forEach(function (x) { max = Math.max(max, Math.abs(x.avg)); }); max = Math.ceil(max) || 1;
    var bw = (W - pad - 8) / 12, mid = Hh / 2, sc = (Hh / 2 - 24) / max, cur = new Date().getUTCMonth();
    var svg = '<svg class="season" viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" role="img" aria-label="Sample average monthly return by month for ' + esc(a.name) + '">';
    [max, 0, -max].forEach(function (v) { var y = mid - v * sc; svg += '<line class="axis" x1="' + pad + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/><text x="0" y="' + (y + 3) + '">' + (v > 0 ? '+' : '') + v + '%</text>'; });
    data.forEach(function (x, k) {
      var x0 = pad + 4 + k * bw, hgt = Math.abs(x.avg) * sc, y = x.avg >= 0 ? mid - hgt : mid;
      if (k === cur) svg += '<rect class="now" x="' + (x0 - 1) + '" y="8" width="' + (bw - 2) + '" height="' + (Hh - 26) + '"/>';
      svg += '<rect class="' + (x.avg >= 0 ? 'bu' : 'bd') + '" x="' + (x0 + bw * 0.18) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + Math.max(1, hgt).toFixed(1) + '"><title>' + x.m + ': ' + (x.avg >= 0 ? '+' : '') + x.avg + '% (sample)</title></rect>';
      svg += '<text x="' + (x0 + bw / 2 - 9) + '" y="' + (Hh - 4) + '">' + x.m + '</text>';
    });
    svg += '</svg>';
    var picks = cmds().filter(function (x) { return x.id !== 'PAXG'; });
    return '<div class="pg"><section class="sec pg-grid"><div class="sec"><div class="sec-h"><h2>Seasonality · ' + esc(a.name) + '</h2><span class="tag">sample data</span>' +
      '<span class="sec-r"><select class="select" id="seaSel" aria-label="Commodity" style="width:200px;height:26px">' + picks.map(function (x) { return '<option value="' + x.id + '"' + (x.id === seaSel ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></span></div>' +
      '<div class="sec-b">' + svg + '</div>' +
      '<div class="table-scroll"><table class="tbl"><thead><tr><th>Month</th>' + data.map(function (x, k) { return '<th class="r' + (k === cur ? ' warn' : '') + '">' + x.m + '</th>'; }).join('') + '</tr></thead><tbody>' +
      '<tr><td>Avg. return</td>' + data.map(function (x) { return '<td class="mono r ' + (x.avg >= 0 ? 'up' : 'down') + '">' + (x.avg >= 0 ? '+' : '') + nf(x.avg, 2) + '%</td>'; }).join('') + '</tr>' +
      '<tr><td>Up years of 15</td>' + data.map(function (x) { return '<td class="mono r">' + x.up + '</td>'; }).join('') + '</tr></tbody></table></div>' +
      '<div class="sec-note">Sample data generated for the demo layout. These are not historical returns and say nothing about the real market. The full build computes this view from licensed daily settlement history (15 years). Dashed outline: current month.</div></div></section></div>';
  }

  /* ---------- page ---------- */
  var tab = 'specs';
  function render() {
    var body = $('cmdBody'); if (!body) return;
    body.innerHTML = tab === 'roll' ? rollHtml() : tab === 'eco' ? ecoHtml() : tab === 'season' ? seaHtml() : specsHtml();
    document.querySelectorAll('#cmdTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.ct === tab); });
  }
  var lastTick = 0;
  function tick() { if (Date.now() - lastTick < 15000) return; lastTick = Date.now(); if (tab === 'specs' || tab === 'eco') render(); }
  function init() {
    $('cmdTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-ct]'); if (!b) return; tab = b.dataset.ct; render(); });
    $('cmdBody').addEventListener('click', function (e) {
      var t = e.target.closest('[data-trade]'); if (t) { A.setView('trade'); A.selectAsset(t.dataset.trade); return; }
      var f = e.target.closest('[data-cf]'); if (f) { calFilter = f.dataset.cf; render(); }
    });
    $('cmdBody').addEventListener('change', function (e) { if (e.target.id === 'seaSel') { seaSel = e.target.value; render(); } });
  }
  A.register('cmd', { init: init, render: render, tick: tick });
  window.VXDesk = { SPEC: SPEC, calItems: calItems, seaData: seaData, contracts: contracts, setTab: function (t) { tab = t; render(); } };
})();
