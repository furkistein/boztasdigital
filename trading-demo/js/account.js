/* Demo Exchange - account and risk, performance, trade journal. Every figure is computed from the
 * paper account in this browser (no sample data on this page). */
(function () {
  'use strict';
  var A = window.VXApp; if (!A) return;
  var D = A.D, E = A.E, esc = A.esc, nf = A.nf, usd = A.usd, signed = A.signed;
  var $ = function (id) { return document.getElementById(id); };
  var MC = 1.0;     // margin call: account margin level below 100%
  var WARN = 0.8;   // position margin ratio warning; liquidation at 100%

  function S() { return A.S(); }
  function lev(n) { return nf(n, 2) + 'x'; }

  /* exposure per asset class */
  function exposure() {
    var by = {};
    Object.keys(D.CLASS).forEach(function (k) { by[k] = { k: k, label: D.CLASS[k].label, long: 0, short: 0, margin: 0, upnl: 0, n: 0 }; });
    S().positions.forEach(function (p) {
      var a = D.BY_ID[p.asset], m = A.markFor(a, p.side), n = E.notionalOf(p.kind, p.qty, m), r = by[a.cat];
      if (p.side === 'long') r.long += n; else r.short += n;
      r.margin += p.margin; r.upnl += E.unrealizedPnl(p, m); r.n++;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }
  /* scenario: every open position's market moves by pct at once */
  function stress(pct) {
    var pnl = 0, liq = [];
    S().positions.forEach(function (p) {
      var a = D.BY_ID[p.asset], m = A.markFor(a, p.side), m2 = m * (1 + pct);
      var hit = p.side === 'long' ? m2 <= p.liq : m2 >= p.liq;
      if (hit) { pnl += -p.margin - E.unrealizedPnl(p, m); liq.push(a.sym + ' ' + p.side); }
      else pnl += E.unrealizedPnl(p, m2) - E.unrealizedPnl(p, m);
    });
    return { pnl: pnl, liq: liq };
  }

  function kpi(k, v, sub, cls) { return '<dl class="kpi"><dt>' + k + '</dt><dd class="' + (cls || '') + '">' + v + '</dd>' + (sub ? '<span class="kpi-s">' + sub + '</span>' : '') + '</dl>'; }

  function riskHtml() {
    var s = S(), eq = A.equity(), used = A.marginAll() + A.reservedAll(), ml = A.marginLevel(), up = A.upnlAll();
    var gross = 0; exposure().forEach(function (r) { gross += r.long + r.short; });
    var mlTxt = ml == null ? '—' : ml > 99.99 ? '>9,999%' : nf(ml * 100, 1) + '%';
    var mlCls = ml == null ? '' : ml < MC ? 'down' : ml < 1.5 ? 'warn' : '';
    var meterPct = ml == null ? 0 : Math.min(100, ml * 100 / 5);   // scale 0..500%
    var h = '<div class="kpis">' +
      kpi('Equity', usd(eq), 'balance + margin + PnL + shares') +
      kpi('Used margin', usd(used), A.marginAll() ? usd(A.marginAll()) + ' positions · ' + usd(A.reservedAll()) + ' orders' : 'no open positions') +
      kpi('Free margin', usd(s.balance), 'available for new orders') +
      kpi('Margin level', mlTxt, 'equity / used margin', mlCls) +
      kpi('Unrealized PnL', signed(up), s.positions.length + ' open positions', up >= 0 ? 'up' : 'down') +
      kpi('Effective leverage', eq > 0 ? lev(gross / eq) : '—', 'gross exposure ' + usd(gross)) +
      '</div>';
    h += '<div class="pg"><div class="pg-grid" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)">';
    // margin level & rules
    h += '<section class="sec"><div class="sec-h"><h2>Margin level</h2><span class="sec-r mono ' + mlCls + '">' + mlTxt + '</span></div><div class="sec-b">' +
      '<div class="meter ' + (ml == null ? '' : ml < MC ? 'bad' : ml < 1.5 ? 'warn' : 'ok') + '"><i style="width:' + meterPct.toFixed(1) + '%"></i><span class="mk" style="left:20%" title="Margin call 100%"></span></div>' +
      '<div style="position:relative;height:14px;font-size:10.5px;color:var(--text-3);margin-top:4px" class="mono"><span style="position:absolute;left:0">0%</span><span style="position:absolute;left:20%;transform:translateX(-50%);white-space:nowrap">100% call</span><span style="position:absolute;right:0">500%+</span></div>' +
      '<dl class="summary" style="margin-top:12px"><div><dt>Margin call</dt><dd>Below 100%: a warning shows in the top bar and new positions are blocked</dd></div>' +
      '<div><dt>Stop-out</dt><dd>Isolated margin: each position is closed when its margin ratio reaches 100%</dd></div>' +
      '<div><dt>Margin ratio</dt><dd>maintenance margin (0.5% of position value) / (margin + PnL)</dd></div>' +
      '<div><dt>Warning level</dt><dd>' + nf(WARN * 100, 0) + '% margin ratio on any position</dd></div></dl></div></section>';
    // stress test
    var sc = [-0.1, -0.05, -0.02, 0.02, 0.05, 0.1];
    h += '<section class="sec"><div class="sec-h"><h2>Stress test</h2><span class="tag">all markets move together</span></div>' +
      (s.positions.length ? '<div class="table-scroll"><table class="tbl"><thead><tr><th>Move</th><th class="r">PnL change</th><th class="r">Equity after</th><th>Liquidated</th></tr></thead><tbody>' +
      sc.map(function (p) { var r = stress(p); return '<tr><td class="mono ' + (p > 0 ? 'up' : 'down') + '">' + (p > 0 ? '+' : '') + (p * 100) + '%</td><td class="mono r ' + (r.pnl >= 0 ? 'up' : 'down') + '">' + signed(r.pnl) + '</td><td class="mono r">' + usd(eq + r.pnl) + '</td><td class="' + (r.liq.length ? 'warn' : 'muted') + '">' + (r.liq.length ? esc(r.liq.join(', ')) : 'none') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : A.emptySt('chart-line-down', 'Nothing to stress', 'Open a position to see how a sudden move would change your equity.')) + '</section>';
    h += '</div>';
    // exposure by class
    var ex = exposure(), maxN = 1; ex.forEach(function (r) { maxN = Math.max(maxN, r.long, r.short); });
    h += '<div class="pg-grid" style="margin-top:16px"><section class="sec"><div class="sec-h"><h2>Risk by asset class</h2><span class="sec-r muted">long and short position value</span></div><div class="sec-b"><div class="bars">' +
      ex.map(function (r) {
        return '<div class="bar-row"><span>' + esc(r.label) + ' <span class="muted mono">' + r.n + '</span></span><span style="display:grid;grid-template-columns:1fr 1fr;gap:2px"><span class="bar" style="transform:scaleX(-1)"><i class="l" style="width:' + (r.long / maxN * 100).toFixed(1) + '%"></i></span><span class="bar"><i class="s" style="width:' + (r.short / maxN * 100).toFixed(1) + '%"></i></span></span>' +
          '<span class="v mono"><span class="up">' + A.compact(r.long) + '</span> / <span class="down">' + A.compact(r.short) + '</span></span></div>';
      }).join('') + '</div></div>' +
      '<div class="table-scroll"><table class="tbl"><thead><tr><th>Class</th><th class="r">Long</th><th class="r">Short</th><th class="r">Net</th><th class="r">Margin</th><th class="r">Unrealized</th><th class="r">% of equity</th></tr></thead><tbody>' +
      ex.map(function (r) { var net = r.long - r.short; return '<tr><td>' + esc(r.label) + '</td><td class="mono r">' + usd(r.long) + '</td><td class="mono r">' + usd(r.short) + '</td><td class="mono r ' + (net >= 0 ? 'up' : 'down') + '">' + signed(net) + '</td><td class="mono r">' + usd(r.margin) + '</td><td class="mono r ' + (r.upnl >= 0 ? 'up' : 'down') + '">' + signed(r.upnl) + '</td><td class="mono r">' + (eq > 0 ? nf((r.long + r.short) / eq * 100, 1) + '%' : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div></section></div>';
    // positions closest to liquidation
    var pos = s.positions.map(function (p) { var a = D.BY_ID[p.asset], m = A.markFor(a, p.side); return { p: p, a: a, m: m, mr: A.marginRatio(p), dist: Math.abs(m - p.liq) / m }; }).sort(function (x, y) { return y.mr - x.mr; });
    h += '<div class="pg-grid" style="margin-top:16px"><section class="sec"><div class="sec-h"><h2>Positions by liquidation risk</h2></div>' +
      (pos.length ? '<div class="table-scroll"><table class="tbl"><thead><tr><th>Market</th><th class="r">Leverage</th><th class="r">Mark</th><th class="r">Liq. price</th><th class="r">Distance</th><th class="r">Margin ratio</th><th></th></tr></thead><tbody>' +
      pos.map(function (r) { return '<tr><td><button class="linkbtn sym" data-trade="' + r.a.id + '">' + esc(r.a.sym) + '</button> <span class="side ' + r.p.side + '">' + r.p.side + '</span></td><td class="mono r">' + r.p.lev + 'x</td><td class="mono r">' + A.px(r.a, r.m) + '</td><td class="mono r warn">' + A.px(r.a, r.p.liq) + '</td><td class="mono r">' + nf(r.dist * 100, 2) + '%</td>' +
        '<td class="mono r ' + (r.mr >= WARN ? 'down' : r.mr >= 0.5 ? 'warn' : '') + '">' + nf(Math.min(r.mr, 9.99) * 100, 1) + '%</td><td class="r"><button class="btn-ghost sm" data-trade="' + r.a.id + '">Trade</button></td></tr>'; }).join('') +
      '</tbody></table></div>' : A.emptySt('shield-check', 'No open positions', 'Positions you open on the Trade page are ranked here by how close they are to liquidation.')) + '</section></div></div>';
    return h;
  }

  /* ---------- performance ---------- */
  function trades() { return A.journal().slice().reverse(); }   // oldest first
  function net(h) { return h.pnl - (h.openFee || 0); }
  function perfStats() {
    var list = trades(), eq = 100000, curve = [{ t: list.length ? (list[0].opened || list[0].t) : Date.now(), v: eq }], peak = eq, mdd = 0, mddAbs = 0;
    var wins = 0, gw = 0, gl = 0, fees = 0, best = null, worst = null;
    list.forEach(function (h) {
      var n = net(h); eq += n; curve.push({ t: h.t, v: eq });
      if (eq > peak) peak = eq;
      var dd = (peak - eq) / peak; if (dd > mdd) { mdd = dd; mddAbs = peak - eq; }
      if (n > 0) { wins++; gw += n; } else gl += -n;
      fees += (h.fee || 0) + (h.openFee || 0);
      if (!best || n > net(best)) best = h; if (!worst || n < net(worst)) worst = h;
    });
    return { list: list, curve: curve, n: list.length, wins: wins, gw: gw, gl: gl, fees: fees, total: eq - 100000, mdd: mdd, mddAbs: mddAbs, best: best, worst: worst };
  }
  function curveSvg(c) {
    var W = 800, H = 200, n = c.length, min = Infinity, max = -Infinity;
    c.forEach(function (p) { min = Math.min(min, p.v); max = Math.max(max, p.v); });
    if (max - min < 1) { max += 50; min -= 50; }
    var pad = (max - min) * 0.1; min -= pad; max += pad;
    function x(i) { return n > 1 ? i / (n - 1) * W : W / 2; }
    function y(v) { return H - (v - min) / (max - min) * H; }
    var d = c.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
    var peak = -Infinity, dd = '';
    c.forEach(function (p, i) { peak = Math.max(peak, p.v); if (p.v < peak) dd += '<rect class="dd" x="' + (x(i) - W / Math.max(2, n) / 2).toFixed(1) + '" y="' + y(peak).toFixed(1) + '" width="' + (W / Math.max(2, n)).toFixed(1) + '" height="' + (y(p.v) - y(peak)).toFixed(1) + '"/>'; });
    return '<svg class="curve" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Closed-trade equity curve"><line class="base" x1="0" x2="' + W + '" y1="' + y(100000).toFixed(1) + '" y2="' + y(100000).toFixed(1) + '"/>' + dd +
      '<path class="ar" d="' + d + ' L ' + x(n - 1).toFixed(1) + ' ' + H + ' L 0 ' + H + ' Z"/><path class="ln" d="' + d + '"/></svg>';
  }
  function perfHtml() {
    var st = perfStats();
    if (!st.n) return '<div class="pg"><div class="pg-grid"><section class="sec">' + A.emptySt('chart-line-up', 'No closed trades yet', 'Win rate, PnL, drawdown and the equity curve are calculated from positions you have closed. Open and close a trade on the Trade page.') + '</section></div></div>';
    var pf = st.gl > 0 ? st.gw / st.gl : null;
    var h = '<div class="kpis">' +
      kpi('Closed trades', String(st.n), st.wins + ' won · ' + (st.n - st.wins) + ' lost') +
      kpi('Win rate', nf(st.wins / st.n * 100, 1) + '%', 'net of fees') +
      kpi('Total PnL', signed(st.total), 'fees paid ' + usd(st.fees), st.total >= 0 ? 'up' : 'down') +
      kpi('Max drawdown', '-' + nf(st.mdd * 100, 2) + '%', usd(st.mddAbs) + ' from peak', st.mdd > 0 ? 'down' : '') +
      kpi('Profit factor', pf == null ? '∞' : nf(pf, 2), 'gross win / gross loss') +
      kpi('Avg win / loss', (st.wins ? usd(st.gw / st.wins) : '—') + ' / ' + (st.n - st.wins ? usd(st.gl / (st.n - st.wins)) : '—'), 'per closed trade') +
      '</div>';
    h += '<div class="pg"><div class="pg-grid"><section class="sec"><div class="sec-h"><h2>Equity curve</h2><span class="sec-r muted">closed trades only · start $100,000 · red = drawdown</span></div><div class="sec-b">' + curveSvg(st.curve) + '</div></section></div>';
    var by = {};
    st.list.forEach(function (h0) { var r = by[h0.asset] = by[h0.asset] || { n: 0, w: 0, pnl: 0 }; r.n++; if (net(h0) > 0) r.w++; r.pnl += net(h0); });
    h += '<div class="pg-grid" style="margin-top:16px;grid-template-columns:minmax(0,1fr) minmax(0,1fr)"><section class="sec"><div class="sec-h"><h2>By market</h2></div><div class="table-scroll"><table class="tbl"><thead><tr><th>Market</th><th class="r">Trades</th><th class="r">Win rate</th><th class="r">PnL</th></tr></thead><tbody>' +
      Object.keys(by).sort(function (a, b) { return by[b].pnl - by[a].pnl; }).map(function (id) { var r = by[id]; return '<tr><td>' + esc(D.BY_ID[id].sym) + '</td><td class="mono r">' + r.n + '</td><td class="mono r">' + nf(r.w / r.n * 100, 0) + '%</td><td class="mono r ' + (r.pnl >= 0 ? 'up' : 'down') + '">' + signed(r.pnl) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>' +
      '<section class="sec"><div class="sec-h"><h2>Extremes</h2></div><dl class="summary" style="margin:0;padding:10px 12px;border:0">' +
      '<div><dt>Best trade</dt><dd class="mono up">' + signed(net(st.best)) + ' · ' + esc(D.BY_ID[st.best.asset].sym) + '</dd></div>' +
      '<div><dt>Worst trade</dt><dd class="mono down">' + signed(net(st.worst)) + ' · ' + esc(D.BY_ID[st.worst.asset].sym) + '</dd></div>' +
      '<div><dt>Liquidations</dt><dd class="mono">' + st.list.filter(function (x) { return x.kind === 'Liquidated'; }).length + '</dd></div>' +
      '<div><dt>Take profit / stop loss exits</dt><dd class="mono">' + st.list.filter(function (x) { return x.kind === 'Take profit'; }).length + ' / ' + st.list.filter(function (x) { return x.kind === 'Stop loss'; }).length + '</dd></div>' +
      '</dl></section></div></div>';
    return h;
  }

  /* ---------- journal ---------- */
  function dur(ms) { if (!(ms > 0)) return '—'; var m = Math.round(ms / 60000); return m < 60 ? m + 'm' : m < 1440 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h'; }
  function journalHtml() {
    var list = A.journal(), s = S();
    var head = '<div class="sec-h"><h2>Trade journal</h2><span class="sec-r"><span class="muted">' + list.length + ' closed trades · notes are saved in this browser</span><button class="btn-ghost sm" id="jCsv"' + (list.length ? '' : ' disabled') + '><i class="ph ph-download-simple" aria-hidden="true"></i>Export CSV</button></span></div>';
    if (!list.length) return '<div class="pg"><div class="pg-grid"><section class="sec">' + head + A.emptySt('notebook', 'Your journal is empty', 'Each closed position lands here with entry, exit, duration and PnL. Add a note to record why you took the trade.') + '</section></div></div>';
    return '<div class="pg"><div class="pg-grid"><section class="sec">' + head + '<div class="table-scroll"><table class="tbl"><thead><tr><th>Closed</th><th>Market</th><th>Side</th><th class="r">Entry</th><th class="r">Exit</th><th class="r">Size</th><th>Held</th><th>Exit reason</th><th class="r">Net PnL</th><th class="r">ROE</th><th>Note</th></tr></thead><tbody>' +
      list.map(function (h) {
        var a = D.BY_ID[h.asset], n = net(h);
        return '<tr><td class="mono">' + A.timeFmt(h.t) + '</td><td>' + esc(a.sym) + '</td><td><span class="side ' + h.side + '">' + (h.side === 'long' ? 'Long' : 'Short') + ' ' + h.lev + 'x</span></td>' +
          '<td class="mono r">' + A.px(a, h.entry) + '</td><td class="mono r">' + A.px(a, h.price) + '</td><td class="mono r">' + A.qtyFmt(a, h.qty) + '</td><td class="mono">' + dur(h.t - h.opened) + '</td><td class="' + (h.kind === 'Liquidated' ? 'down' : '') + '">' + esc(h.kind) + '</td>' +
          '<td class="mono r ' + (n >= 0 ? 'up' : 'down') + '">' + signed(n) + '</td><td class="mono r">' + (h.margin ? A.pct(n / h.margin) : '—') + '</td>' +
          '<td><input class="note-in" data-note="' + h.id + '" maxlength="200" placeholder="Add a note" aria-label="Note for this trade" value="' + esc(s.notes[h.id] || '') + '"></td></tr>';
      }).join('') + '</tbody></table></div></section></div></div>';
  }

  /* ---------- page ---------- */
  var tab = 'risk';
  function render() {
    var body = $('accBody'); if (!body) return;
    body.innerHTML = tab === 'perf' ? perfHtml() : tab === 'journal' ? journalHtml() : riskHtml();
    document.querySelectorAll('#accTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.at === tab); });
  }
  var last = 0;
  function tick() { if (tab !== 'risk') return; if (Date.now() - last < 1200) return; last = Date.now(); render(); }
  function init() {
    $('accTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-at]'); if (!b) return; tab = b.dataset.at; render(); });
    $('accBody').addEventListener('click', function (e) {
      var t = e.target.closest('[data-trade]'); if (t) { A.setView('trade'); A.selectAsset(t.dataset.trade); return; }
      if (e.target.closest('#jCsv')) A.exportCsv('journal');
    });
    var nt = null;
    $('accBody').addEventListener('input', function (e) {
      var id = e.target.dataset && e.target.dataset.note; if (!id) return;
      var v = e.target.value.slice(0, 200);
      if (v) S().notes[id] = v; else delete S().notes[id];
      clearTimeout(nt); nt = setTimeout(function () { A.save(true); }, 400);
    });
  }
  A.register('account', { init: init, render: render, tick: tick });
  window.VXAccount = { exposure: exposure, stress: stress, perfStats: perfStats, setTab: function (t) { tab = t; render(); } };
})();
