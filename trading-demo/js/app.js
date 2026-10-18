/* Demo Exchange - UI, paper account and order handling.
 * The commodity desk (desk.js), account pages (account.js) and admin console (admin.js) plug into
 * the shared API exposed as window.VXApp at the end of this file. */
(function () {
  'use strict';
  var E = window.VXEngine, D = window.VXData, P = window.VXPredict, HR = window.VXHours;
  var STORE_KEY = 'vx-demo-v2', PREF_KEY = 'vx-prefs';
  var SIM_KEY = 'vx-sim-v1';               // simulator prices, restored on reload (no jump back to the reference close)
  var LOCK_KEY = 'vx-writer';              // which open tab writes the account (see "several tabs" below)
  var BACKUP_KEY = STORE_KEY + '-backup';  // a saved record that could not be read is kept here, never thrown away
  var SCHEMA = 3;                          // v2 -> v3: positions and orders keep the fee / spread terms they were opened with
  var START_BALANCE = 100000;

  /* ---------------- preferences (survive "Reset demo") ---------------- */
  var prefs = { confirm: true, hours: 'exchange', flash: true };
  try { var pr = JSON.parse(window.localStorage.getItem(PREF_KEY) || 'null'); if (pr && typeof pr === 'object') Object.keys(prefs).forEach(function (k) { if (pr[k] != null) prefs[k] = pr[k]; }); } catch (e) {}
  // test hook: the automated browser checks set this before the page loads (works even when storage is blocked)
  if (window.__VX_TEST_PREFS && typeof window.__VX_TEST_PREFS === 'object') Object.keys(prefs).forEach(function (k) { if (window.__VX_TEST_PREFS[k] != null) prefs[k] = window.__VX_TEST_PREFS[k]; });
  HR.setMode(prefs.hours);
  function savePrefs() { try { window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} }

  /* ---------------- state ---------------- */
  function fresh() {
    return { v: SCHEMA, rev: 0, balance: START_BALANCE, realized: 0, pmRealized: 0, positions: [], orders: [], history: [],
             pm: null, favs: ['XAUUSD', 'WTI', 'BRENT', 'BTC', 'EURUSD'], alerts: [], notifs: [], notes: {}, admin: null,
             ui: { asset: 'XAUUSD', tf: '1m', cat: 'cmd', sub: 'all', lev: {}, ct: 'candle', vol: true } };
  }
  /* Loading the saved account.
     - The browser refusing storage is a storage error: the demo runs without saving (notice shown).
     - A record that cannot be read (broken JSON, wrong field types, unknown version) is NOT a storage
       error: it is copied to BACKUP_KEY, the demo starts with a clean account and keeps saving normally.
     - Older versions are migrated, their data is kept (v2 -> v3). */
  var storageOk = true, loadNote = '';
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function backupRecord(raw, why) {
    try { window.localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), reason: String(why).slice(0, 200), raw: raw })); } catch (e) {}
  }
  function clsTerms(s, a) {   // fee / spread of an asset under the record's own admin settings
    var cfg = isObj(s.admin) && isObj(s.admin.cfg) && isObj(s.admin.cfg[a.id]) ? s.admin.cfg[a.id] : {}, c = D.CLASS[a.cat];
    return { taker: fin(cfg.taker) ? cfg.taker : c.taker, maker: fin(cfg.maker) ? cfg.maker : c.maker, spread: fin(cfg.spread) ? cfg.spread : a.spread0 };
  }
  function migrate(s) {
    if (!isObj(s)) throw new Error('saved record is not an object');
    if (s.v === 2) {
      // v2 positions closed with the current taker fee and marked with the current spread; v3 stores them
      // per position. The terms in force when the record is migrated are the best available value.
      (Array.isArray(s.positions) ? s.positions : []).forEach(function (p) {
        var a = isObj(p) && D.BY_ID[p.asset]; if (!a) return; var t = clsTerms(s, a);
        if (!fin(p.taker)) p.taker = t.taker;
        if (!fin(p.spread)) p.spread = t.spread;
      });
      (Array.isArray(s.orders) ? s.orders : []).forEach(function (o) {
        var a = isObj(o) && D.BY_ID[o.asset]; if (!a) return; var t = clsTerms(s, a);
        if (!fin(o.feeRate)) o.feeRate = fin(o.fee) && o.margin * o.lev > 0 ? o.fee / (o.margin * o.lev) : t.maker;
        if (!fin(o.taker)) o.taker = t.taker;
      });
      s.v = 3;
    }
    if (s.v !== SCHEMA) throw new Error('unknown version ' + s.v);
    if (!fin(s.rev)) s.rev = 0;
    return s;
  }
  /* type checks. Money lists of the wrong type make the record unreadable; display state is repaired. */
  function validate(s) {
    var f = fresh(), fixed = [];
    if (!fin(s.balance)) throw new Error('balance is not a number');
    ['positions', 'orders'].forEach(function (k) { if (s[k] == null) s[k] = []; else if (!Array.isArray(s[k])) throw new Error(k + ' is not a list'); });
    ['history', 'alerts', 'notifs', 'favs'].forEach(function (k) { if (!Array.isArray(s[k])) { if (s[k] != null) fixed.push(k); s[k] = f[k]; } });
    ['realized', 'pmRealized'].forEach(function (k) { if (!fin(s[k])) { if (s[k] != null) fixed.push(k); s[k] = 0; } });
    if (!isObj(s.notes)) { if (s.notes != null) fixed.push('notes'); s.notes = {}; }
    if (s.admin != null && !isObj(s.admin)) { fixed.push('admin'); s.admin = null; }
    if (s.admin && !isObj(s.admin.cfg)) s.admin.cfg = {};
    if (!isObj(s.ui)) { if (s.ui != null) fixed.push('ui'); s.ui = f.ui; }
    Object.keys(f.ui).forEach(function (k) { if (s.ui[k] == null) s.ui[k] = f.ui[k]; });
    if (!isObj(s.ui.lev)) s.ui.lev = {};
    if (!D.BY_ID[s.ui.asset]) s.ui.asset = 'XAUUSD';
    if (!D.TF_SEC[s.ui.tf]) s.ui.tf = '1m';
    var n0 = s.positions.length + s.orders.length;
    s.positions = s.positions.filter(function (p) { return isObj(p) && D.BY_ID[p.asset] && (p.side === 'long' || p.side === 'short') && [p.qty, p.entry, p.margin, p.lev, p.liq].every(fin); });
    s.orders = s.orders.filter(function (o) { return isObj(o) && D.BY_ID[o.asset] && (o.side === 'long' || o.side === 'short') && [o.price, o.margin, o.lev, o.reserved].every(fin); });
    if (s.positions.length + s.orders.length !== n0) fixed.push('positions/orders');
    s.favs = s.favs.filter(function (id) { return D.BY_ID[id]; });
    s.alerts = s.alerts.filter(function (al) { return isObj(al) && D.BY_ID[al.asset] && fin(al.price); });
    s.history = s.history.filter(isObj);
    s.notifs = s.notifs.filter(isObj);
    if (s.pm != null && !isObj(s.pm)) { fixed.push('pm'); s.pm = null; }   // prediction state is checked (and refunded) by predict.js
    return fixed;
  }
  function parseRecord(raw) { var s = migrate(JSON.parse(raw)); var fixed = validate(s); return { s: s, fixed: fixed }; }
  function load() {
    var raw;
    try { raw = window.localStorage.getItem(STORE_KEY); } catch (e) { storageOk = false; return fresh(); }   // storage blocked
    if (!raw) return fresh();
    try {
      var r = parseRecord(raw);
      if (r.fixed.length) { backupRecord(raw, 'repaired: ' + r.fixed.join(', ')); loadNote = 'repaired'; }
      return r.s;
    } catch (e) {
      backupRecord(raw, e && e.message); loadNote = 'corrupt';
      return fresh();
    }
  }
  var S = load();

  /* Saving. User actions save at once (save(true)); background changes (simulated flow, chart settings)
     are written at most every BG_SAVE_MS. Only the writer tab writes. */
  var saveTimer = null, lastWrite = 0, BG_SAVE_MS = 5000;
  function writeNow() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!storageOk || !tab.leader || !tabVerify()) return;
    try {
      S.rev = (S.rev || 0) + 1; S.writer = TAB_ID; S.epoch = myEpoch;
      window.localStorage.setItem(STORE_KEY, JSON.stringify(S));
      lastWrite = Date.now();
    } catch (e) { storageOk = false; storageNotice(); return; }
    saveSim();
  }
  function saveSim() { if (!storageOk || !tab.leader) return; try { window.localStorage.setItem(SIM_KEY, JSON.stringify(D.snapshot())); } catch (e) {} }
  function save(now) {
    if (!storageOk) return;
    if (now) { writeNow(); return; }
    if (saveTimer) return;
    saveTimer = setTimeout(writeNow, Math.max(600, BG_SAVE_MS - (Date.now() - lastWrite)));
  }
  function storageNotice() { toast('Browser storage is unavailable', 'The demo works normally, but your paper account resets when the page reloads.', 'warn'); }

  /* ---------------- several tabs / windows of the demo ----------------
     Every tab keeps its own copy of the account, so two tabs writing in turn would erase each other's
     trades (the last writer wins). Exactly one tab is the WRITER: it runs the risk engine and the
     simulated flow and saves. The other tabs are FOLLOWERS: they never write, they take every saved copy
     over at once (storage event) and show the writer's simulated prices (BroadcastChannel).
     Using a tab (pointer, key, focus, or an order through the API) makes it the writer: it first loads the
     latest saved copy, then acts, so nothing done in another tab is lost.
     The writer lock (LOCK_KEY) carries an epoch that grows with every takeover, and every saved record
     carries the epoch of the tab that wrote it. A higher epoch always wins: a tab that still believes it
     is the writer (its storage view was a few ms behind) is outvoted, and if it managed to write once
     more, the real writer sees the older epoch on top of its record and writes its own copy again. */
  var TAB_ID = 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
  var LOCK_STALE = 75000;   // a hidden writer is throttled to one timer per minute: only a silent lock is stale
  var tab = { leader: true }, myEpoch = 0, seenEpoch = 0;
  var bc = null; try { if (window.BroadcastChannel) bc = new BroadcastChannel('vx-demo-tabs'); } catch (e) { bc = null; }
  function readLock() { try { var l = JSON.parse(window.localStorage.getItem(LOCK_KEY) || 'null'); return isObj(l) ? l : null; } catch (e) { return null; } }
  function writeLock(release) { try { window.localStorage.setItem(LOCK_KEY, JSON.stringify({ id: release ? null : TAB_ID, epoch: myEpoch, ts: release ? 0 : Date.now() })); } catch (e) {} }
  function ep(x) { return x && fin(x.epoch) ? x.epoch : 0; }
  /* does writer a outrank writer b? (higher epoch; same epoch: larger id) */
  function outranks(a, b) { if (ep(a) !== ep(b)) return ep(a) > ep(b); return String(a.id || a.writer || '') > String(b.id || b.writer || ''); }
  function me() { return { id: TAB_ID, epoch: myEpoch }; }
  function newEpoch() { return Math.max(seenEpoch, ep(readLock()), ep(S)) + 1; }
  /* called right before every write: still the writer? */
  function tabVerify() {
    if (!storageOk) return true;
    var l = readLock();
    if (l) seenEpoch = Math.max(seenEpoch, ep(l));
    if (l && l.id !== TAB_ID && outranks(l, me())) {   // a newer writer (or a newer released lock)
      becomeFollower();
      if (!l.id) setTimeout(claim, 0);
      return false;
    }
    if (!l || l.id !== TAB_ID || ep(l) !== myEpoch) writeLock();   // missing or an outdated writer's lock: ours again
    return true;
  }
  function becomeFollower() {
    if (!tab.leader) return;
    tab.leader = false; clearTimeout(saveTimer); saveTimer = null;
    D.setFollower(!!bc);
    renderFeedStatus();
  }
  /* take over a saved copy of the account (keeps this tab's own view: market, chart, page).
     A copy written by an outdated writer (epoch below minEpoch) is ignored. */
  function adoptRaw(raw, minEpoch) {
    if (!raw) return false;
    var r; try { r = parseRecord(raw); } catch (e) { return false; }
    var n = r.s;
    if (minEpoch != null && ep(n) < minEpoch) return false;
    if ((n.rev || 0) === (S.rev || 0) && n.writer === S.writer && ep(n) === ep(S)) return false;   // already this copy
    var ui = S.ui;
    Object.keys(S).forEach(function (k) { delete S[k]; });
    Object.keys(n).forEach(function (k) { S[k] = n[k]; });
    S.ui = ui;
    applyAdminCfg(); sessCache = {};
    return true;
  }
  function adoptLatest(minEpoch) { var raw = null; try { raw = window.localStorage.getItem(STORE_KEY); } catch (e) {} return adoptRaw(raw, minEpoch); }
  var refreshPending = false;
  function refreshAll() {
    if (pointerBusy()) { refreshPending = true; return; }
    refreshPending = false;
    buildWatch(); renderHead(); renderStar(); drawPriceLines(); renderActivity(); renderAccount(); renderBell(); updTicket();
    if (S.pm) P.resync();
    if (S.ui.view && S.ui.view !== 'trade' && S.ui.view !== 'predict' && views[S.ui.view] && views[S.ui.view].render) views[S.ui.view].render();
  }
  /* make this tab the writer (before a user action in it) */
  function claim() {
    if (!storageOk) return;
    if (tab.leader) {
      var l = readLock();
      if (l && l.id === TAB_ID && ep(l) === myEpoch) return;            // still the writer
      if (!l || (l.id && !outranks(l, me()))) { writeLock(); return; }   // an outdated writer's lock
    }
    var prevSeen = seenEpoch;
    myEpoch = newEpoch(); seenEpoch = myEpoch;
    writeLock();
    var changed = adoptLatest(prevSeen);
    tab.leader = true;
    D.setFollower(false);
    if (S.pm || pmReady()) P.ensure(pmPx);
    if (changed) refreshAll();
    renderFeedStatus();
  }
  function onStorage(e) {
    if (!e || !storageOk) return;
    if (e.key === LOCK_KEY) {
      var l = null; try { l = JSON.parse(e.newValue || 'null'); } catch (x) {}
      if (isObj(l)) seenEpoch = Math.max(seenEpoch, ep(l));
      if (!isObj(l) || !l.id) {   // the writer closed: one follower takes over (the epoch decides a tie)
        if (!tab.leader) setTimeout(function () { var cur = readLock(); if (!cur || !cur.id) claim(); }, 30 + Math.random() * 150);
        return;
      }
      if (l.id !== TAB_ID && tab.leader) { if (outranks(l, me())) becomeFollower(); else writeLock(); }
      return;
    }
    if (e.key === STORE_KEY) {
      if (!tab.leader) { if (adoptRaw(e.newValue, seenEpoch)) refreshAll(); return; }
      var w = null; try { var o = JSON.parse(e.newValue || 'null'); w = isObj(o) ? { writer: o.writer, epoch: o.epoch } : null; } catch (x) {}
      if (!w || w.writer === TAB_ID) return;
      if (outranks({ id: w.writer, epoch: w.epoch }, me())) { becomeFollower(); if (adoptRaw(e.newValue)) refreshAll(); }
      else save(true);   // an outdated writer wrote over our newer copy: write ours again
      return;
    }
    if (e.key === PREF_KEY) {
      var pr = null; try { pr = JSON.parse(e.newValue || 'null'); } catch (x) {}
      if (!isObj(pr)) return;
      Object.keys(prefs).forEach(function (k) { if (pr[k] != null) prefs[k] = pr[k]; });
      HR.setMode(prefs.hours); sessCache = {}; document.body.classList.toggle('no-flash', !prefs.flash);
      buildWatch(); renderHead(); updTicket(); renderBook();
    }
  }
  function tabsStart() {
    if (!storageOk) return;
    // the tab opened last is the one being used: it writes (it loaded the latest copy above)
    myEpoch = newEpoch(); seenEpoch = myEpoch; writeLock();
    window.addEventListener('storage', onStorage);
    ['pointerdown', 'keydown', 'click', 'focusin'].forEach(function (ev) { document.addEventListener(ev, claim, true); });
    window.addEventListener('focus', claim);
    // writer: refresh the lock and share the simulated prices; follower: take over a silent lock
    setInterval(function () {
      if (tab.leader) {
        if (tabVerify()) writeLock();
        if (bc) try { bc.postMessage({ t: 'sim', from: TAB_ID, snap: D.snapshot(true) }); } catch (e) {}
      } else {
        var l = readLock();
        if (!l || !l.id || Date.now() - (+l.ts || 0) > LOCK_STALE) claim();
      }
    }, 2000);
    if (bc) bc.onmessage = function (ev) { var m = ev && ev.data; if (m && m.t === 'sim' && m.from !== TAB_ID && !tab.leader) D.applySim(m.snap); };
    window.addEventListener('pagehide', function () {
      if (!tab.leader) return;
      if (saveTimer) writeNow();
      saveSim();
      var l = readLock(); if (l && l.id === TAB_ID) writeLock(true);   // release (keeps the epoch)
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && tab.leader && saveTimer) writeNow(); });
  }

  /* ---------------- formatting ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  function nf(v, dp) { return (isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function usd(v) { if (Math.abs(v) < 0.005) v = 0; return (v < 0 ? '-$' : '$') + nf(Math.abs(v), 2); }
  function signed(v) { if (Math.abs(v) < 0.005) v = 0; return (v >= 0 ? '+$' : '-$') + nf(Math.abs(v), 2); }
  function px(a, v) { return v == null || !isFinite(v) ? '—' : nf(v, a.dp); }
  function pct(v) { return (v >= 0 ? '+' : '') + nf(v * 100, 2) + '%'; }
  function qtyDp(a) { var p = mid(a); return p > 10000 ? 4 : p > 100 ? 3 : p > 1 ? 2 : 0; }
  function qtyFmt(a, q) {
    if (a.kind === 'inverse') return nf(q, 0) + ' USD';
    return nf(q, qtyDp(a));
  }
  function compact(v) {
    if (!isFinite(v) || v <= 0) return '—';
    if (v >= 1e9) return nf(v / 1e9, 2) + 'B'; if (v >= 1e6) return nf(v / 1e6, 2) + 'M'; if (v >= 1e3) return nf(v / 1e3, 1) + 'K';
    return nf(v, 0);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function timeFmt(t) { return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  function hms(t) { return new Date(t).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

  /* ---------------- prices ---------------- */
  function mid(a) { var t = D.tick[a.id]; return t ? t.price : a.anchor; }
  function quote(a) { return D.bidAsk(a, mid(a)); }
  function markFor(a, side) { var q = quote(a); return side === 'long' ? q.bid : q.ask; }
  /* an open position is marked with the spread it was opened with (admin changes do not reach back) */
  function markPos(p) {
    var a = D.BY_ID[p.asset], h = (fin(p.spread) ? p.spread : (a.spread || 0)) / 2, m = mid(a);
    return p.side === 'long' ? m - h : m + h;
  }
  function hasPrice(a) { return !!D.tick[a.id] && a.state !== 'pending'; }

  /* ---------------- instrument config (class defaults + admin overrides + region profile) ---------------- */
  var ESMA_MAJOR_FX = { EURUSD: 1, GBPUSD: 1, USDJPY: 1, USDCHF: 1, USDCAD: 1 };
  function adm() { if (!S.admin) S.admin = { cfg: {}, profile: 'default' }; if (!S.admin.cfg) S.admin.cfg = {}; return S.admin; }
  /* ESMA retail CFD caps: 30 major FX, 20 other FX / gold / major indices, 10 other commodities, 5 shares, 2 crypto */
  function profileCap(a) {
    if (!S.admin || S.admin.profile !== 'esma') return 0;
    if (a.cat === 'crypto' || a.id === 'PAXG') return 2;
    if (a.cat === 'stk') return 5;
    if (a.cat === 'fx') return ESMA_MAJOR_FX[a.id] ? 30 : 20;
    if (a.cat === 'idx' || a.id === 'XAUUSD') return 20;
    if (a.cat === 'cmd') return 10;
    return 0;
  }
  function cls(a) {
    var b = D.CLASS[a.cat], o = (S.admin && S.admin.cfg && S.admin.cfg[a.id]) || {};
    var cap = o.maxLev || b.maxLev, pc = profileCap(a);
    if (pc) cap = Math.min(cap, pc);
    return { label: b.label, maxLev: cap, taker: o.taker != null ? o.taker : b.taker, maker: o.maker != null ? o.maker : b.maker, profile: pc ? 'ESMA retail caps' : '' };
  }
  function applyAdminCfg() {
    var cfg = (S.admin && S.admin.cfg) || {};
    D.ASSETS.forEach(function (a) { var o = cfg[a.id]; a.spread = o && o.spread != null ? o.spread : a.spread0; });
  }

  /* ---------------- trading sessions ---------------- */
  var sessCache = {};
  function sess(a) {
    var c = sessCache[a.id], now = Date.now();
    // cached for 5 s, but never past the next open / close (the countdown must not linger at 0m)
    var edge = c && (c.s.next || (c.s.real && c.s.real.next));
    if (c && now - c.at < 5000 && c.mode === HR.getMode() && !(edge && now >= edge)) return c.s;
    var s = HR.status(a.id, a.cat);
    sessCache[a.id] = { at: now, s: s, mode: HR.getMode() };
    return s;
  }
  function sessText(s) {
    if (s.always) return 'Open 24/7';
    if (s.practice) return 'Practice 24/7';
    return s.open ? 'Open · closes in ' + HR.untilText(s.next) : s.label + ' · opens in ' + HR.untilText(s.next);
  }

  /* ---------------- account ---------------- */
  function upnlAll() { var u = 0; S.positions.forEach(function (p) { u += E.unrealizedPnl(p, markPos(p)); }); return u; }
  function marginAll() { var m = 0; S.positions.forEach(function (p) { m += p.margin; }); return m; }
  function reservedAll() { var r = 0; S.orders.forEach(function (o) { r += o.reserved; }); return r; }
  function equity() { return S.balance + reservedAll() + marginAll() + upnlAll() + P.value(); }
  /* maintenance margin / position equity. Liquidation happens at 100%. The maintenance margin is taken
     on the entry value, the same base as the liquidation price, so the ratio is exactly 100% there. */
  function marginRatio(p) {
    var m = markPos(p), u = E.unrealizedPnl(p, m);
    var mm = E.notionalOf(p.kind, p.qty, p.entry) * E.MMR;
    var eq = p.margin + u;
    return eq <= 0 ? 9.99 : mm / eq;
  }
  function marginLevel() { var used = marginAll() + reservedAll(); return used > 0 ? equity() / used : null; }

  function renderAccount() {
    var u = upnlAll() + P.unrealized(), r = S.realized + (S.pmRealized || 0);
    $('acEquity').textContent = usd(equity());
    $('acFree').textContent = usd(S.balance);
    $('acUpnl').textContent = signed(u); $('acUpnl').className = 'acct-v mono ' + (u >= 0 ? 'up' : 'down');
    $('acReal').textContent = signed(r); $('acReal').className = 'acct-v mono ' + (r >= 0 ? 'up' : 'down');
    var ml = marginLevel();
    $('acLevel').textContent = ml == null ? '—' : (ml > 99.99 ? '>9,999%' : nf(ml * 100, 0) + '%');
    $('acLevel').className = 'acct-v mono ' + (ml == null ? '' : ml < 1 ? 'down' : ml < 1.5 ? 'warn' : '');
    renderRiskBanner(ml);
  }
  var bannerKey = '';
  function renderRiskBanner(ml) {
    var worst = null;
    S.positions.forEach(function (p) { var r = marginRatio(p); if (!worst || r > worst.r) worst = { p: p, r: r }; });
    var msg = '', kind = '';
    if (ml != null && ml < 1) { msg = 'Margin call: account margin level ' + nf(ml * 100, 0) + '% is below 100%. Close or reduce positions, or add margin.'; kind = 'bad'; }
    else if (worst && worst.r >= 0.8) {
      var a = D.BY_ID[worst.p.asset];
      msg = 'Liquidation risk: ' + a.sym + ' ' + worst.p.side + ' ' + worst.p.lev + 'x is at ' + nf(worst.r * 100, 0) + '% margin ratio. It is closed at 100%.'; kind = 'warn';
    }
    var key = kind + msg.replace(/[0-9]+%/g, '');
    var b = $('riskBanner');
    if (!msg) { if (!b.hidden) b.hidden = true; bannerKey = ''; return; }
    if (key !== bannerKey || b.hidden) {
      bannerKey = key;
      b.className = 'risk-banner ' + kind; b.hidden = false;
      b.innerHTML = '<i class="ph ph-warning" aria-hidden="true"></i><span id="riskMsg"></span><button class="btn-text" data-goview="account">Open risk view</button>';
    }
    $('riskMsg').textContent = msg;
  }

  function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  function addHist(h) { h.t = Date.now(); h.id = uid('h'); S.history.unshift(h); if (S.history.length > 300) S.history.length = 300; }

  /* ---------------- trading actions ---------------- */
  /* terms: { fee, taker } from a limit order (the fee reserved at placement is the fee booked at the fill) */
  function openPosition(a, side, entry, margin, lev, feeRate, tp, sl, via, terms) {
    var pv = E.previewOrder({ side: side, price: entry, margin: margin, leverage: lev, kind: a.kind, feeRate: feeRate });
    var fee = terms && fin(terms.fee) ? terms.fee : pv.fee;
    var pos = { id: uid('p'), asset: a.id, side: side, kind: a.kind, qty: pv.qty, entry: entry, lev: lev, margin: margin,
                liq: pv.liq, tp: tp || null, sl: sl || null, openedAt: Date.now(), fees: fee,
                taker: terms && fin(terms.taker) ? terms.taker : cls(a).taker, spread: a.spread || 0 };
    if (a.state === 'fallback') pos.offline = true;   // opened while the price source was down
    S.positions.push(pos);
    S.realized -= fee;
    addHist({ asset: a.id, kind: via === 'limit' ? 'Limit filled' : 'Open', side: side, price: entry, qty: pv.qty, lev: lev, pnl: -fee, fee: fee, inv: a.kind === 'inverse', pid: pos.id });
    return pos;
  }
  /* a new position must not start beyond its own liquidation price (wide spread + high leverage) */
  function instantLiqErr(side, liq, markAtOpen, lev) {
    if (!E.isLiquidated({ side: side, liq: liq }, markAtOpen)) return '';
    return 'At ' + lev + 'x the spread is wider than the distance to liquidation: the position would be liquidated at once. Lower the leverage.';
  }

  function placeOrder(o) {
    // o: { asset, side, type, margin, lev, limit, tp, sl }
    claim();
    if (!isObj(o)) return 'Unknown order.';
    var a = D.BY_ID[o.asset];
    if (!a) return 'Unknown market.';
    if (o.side !== 'long' && o.side !== 'short') return 'Choose long or short.';
    if (o.type != null && o.type !== 'market' && o.type !== 'limit') return 'Unknown order type.';
    // numbers only: a text "500" must not reach the arithmetic ('500' + fee would join strings)
    if (typeof o.lev !== 'number') return 'Leverage must be a whole number from 1x.';
    if (typeof o.margin !== 'number') return 'Margin must be a number.';
    if (o.type === 'limit' && typeof o.limit !== 'number') return 'Enter a limit price greater than 0.';
    if (o.tp != null && typeof o.tp !== 'number') return 'Take profit must be a positive price.';
    if (o.sl != null && typeof o.sl !== 'number') return 'Stop loss must be a positive price.';
    if (!hasPrice(a)) return 'Waiting for a price for ' + a.sym + '.';
    var c = cls(a), ss = sess(a);
    var ml = marginLevel();
    if (ml != null && ml < 1) return 'Margin call: account margin level is ' + nf(ml * 100, 0) + '%. New positions are blocked until it is back above 100%.';
    if (o.type !== 'limit' && !ss.open) return 'Market closed. ' + a.sym + ' opens in ' + HR.untilText(ss.next) + '. Market orders are disabled; use a limit order to queue one.';
    if (!(o.lev >= 1) || Math.floor(o.lev) !== o.lev) return 'Leverage must be a whole number from 1x.';
    if (o.lev > c.maxLev) return 'Max leverage for ' + c.label + ' is ' + c.maxLev + 'x.';
    if (!(o.margin > 0) || !isFinite(o.margin)) return 'Enter a margin amount greater than 0.';
    if (o.margin < 10) return 'Minimum margin is $10.';
    var q = quote(a);
    var entry = o.type === 'limit' ? o.limit : (o.side === 'long' ? q.ask : q.bid);
    if (o.type === 'limit') {
      if (!(o.limit > 0) || !isFinite(o.limit)) return 'Enter a limit price greater than 0.';
      if (o.side === 'long' && o.limit >= q.ask) return 'A buy limit at or above the ask (' + px(a, q.ask) + ') would fill immediately. Use Market.';
      if (o.side === 'short' && o.limit <= q.bid) return 'A sell limit at or below the bid (' + px(a, q.bid) + ') would fill immediately. Use Market.';
    }
    var feeRate = o.type === 'limit' ? c.maker : c.taker;
    var pv = E.previewOrder({ side: o.side, price: entry, margin: o.margin, leverage: o.lev, kind: a.kind, feeRate: feeRate });
    if (pv.cost > S.balance + 1e-9) return 'Insufficient paper balance: needs ' + usd(pv.cost) + ' (margin + fee), available ' + usd(S.balance) + '.';
    var err = E.validateTpSl(o.side, entry, pv.liq, o.tp, o.sl);
    if (err) return err;
    var spr = a.spread || 0;
    err = instantLiqErr(o.side, pv.liq, o.type === 'limit' ? (o.side === 'long' ? o.limit - spr : o.limit + spr) : (o.side === 'long' ? q.bid : q.ask), o.lev);
    if (err) return err;
    S.balance -= pv.cost;
    if (o.type === 'limit') {
      // the order keeps its terms: fee rate and fee reserved now are the ones booked at the fill
      var ord = { id: uid('o'), asset: a.id, side: o.side, price: o.limit, margin: o.margin, lev: o.lev, tp: o.tp || null, sl: o.sl || null, reserved: pv.cost, fee: pv.fee, feeRate: feeRate, taker: c.taker, createdAt: Date.now(), queued: !ss.open };
      S.orders.push(ord);
      addHist({ asset: a.id, kind: 'Limit placed', side: o.side, price: o.limit, qty: pv.qty, lev: o.lev, inv: a.kind === 'inverse' });
      save(true);   // account changes are written at once (another tab may take over at any moment)
      return { order: ord };
    }
    var newPos = openPosition(a, o.side, entry, o.margin, o.lev, feeRate, o.tp, o.sl, 'market');
    save(true);
    return { position: newPos };
  }

  function closePosition(id, reason, atPrice) {
    if (reason === 'manual' || reason == null) claim();
    var idx = -1; S.positions.forEach(function (p, i) { if (p.id === id) idx = i; });
    if (idx < 0) return null;
    var p = S.positions[idx], a = D.BY_ID[p.asset], c = cls(a);
    var exit = atPrice != null ? atPrice : markPos(p);
    var st;
    if (reason === 'liquidated') st = { pnl: -p.margin, fee: 0, credit: 0, realized: -p.margin };
    else st = E.closeSettlement(p, exit, fin(p.taker) ? p.taker : c.taker);   // the taker fee the position was opened with
    S.positions.splice(idx, 1);
    S.balance += st.credit;
    S.realized += st.realized;
    addHist({ asset: a.id, kind: { manual: 'Close', tp: 'Take profit', sl: 'Stop loss', liquidated: 'Liquidated' }[reason] || 'Close',
              side: p.side, price: exit, qty: p.qty, lev: p.lev, pnl: st.realized, fee: st.fee, inv: p.kind === 'inverse',
              entry: p.entry, opened: p.openedAt, margin: p.margin, openFee: p.fees || 0, pid: p.id, closed: true });
    if (reason === 'manual' || reason == null) save(true);   // the risk engine saves once after all its events
    return { pos: p, st: st, exit: exit };
  }

  function cancelOrder(id) {
    claim();
    var o = null; S.orders = S.orders.filter(function (x) { if (x.id === id) { o = x; return false; } return true; });
    if (!o) return;
    S.balance += o.reserved;
    addHist({ asset: o.asset, kind: 'Cancelled', side: o.side, price: o.price, qty: null, lev: o.lev });
    save(true);
  }

  /* isolated margin top-up: lowers the effective leverage and moves the liquidation price away */
  function addMargin(id, amt) {
    claim();
    var p = S.positions.filter(function (x) { return x.id === id; })[0];
    if (!p) return 'Position not found.';
    if (typeof amt !== 'number' || !(amt > 0) || !isFinite(amt)) return 'Enter an amount greater than 0.';
    if (amt > S.balance + 1e-9) return 'Insufficient paper balance (' + usd(S.balance) + ' available).';
    var notional = E.notionalOf(p.kind, p.qty, p.entry);
    var L = notional / (p.margin + amt);
    if (L < 1) return 'Margin cannot exceed the position size (' + usd(notional) + ').';
    S.balance -= amt; p.margin += amt;
    p.lev = Math.round(L * 100) / 100;
    p.liq = E.liquidationPrice(p.side, p.entry, L, p.kind);
    save(true);
    return { pos: p };
  }

  /* one position against the current mark.
     TP / SL fill at the market price when triggered: if the price jumped over the level (gap, reconnect,
     session open) a stop fills at the worse gap price and a take profit at the better one, never at a
     price that did not trade. A stop that is crossed in the same move as the liquidation price is
     handled as the stop (at the market price; isolated margin caps the loss at the margin). */
  function riskCheck(p, a, events) {
    var m = markPos(p), hit = E.tpslHit(p, m);
    if (hit) {
      var lvl = hit === 'tp' ? p.tp : p.sl, r = closePosition(p.id, hit, m);
      if (r) events.push([r.st.realized >= 0 ? 'ok' : 'bad', (hit === 'tp' ? 'Take profit' : 'Stop loss') + ' hit · ' + a.sym,
        'Closed at ' + px(a, r.exit) + (Math.abs(r.exit - lvl) >= Math.pow(10, -a.dp) ? ' (trigger ' + px(a, lvl) + ', price gapped)' : '') + ' · ' + signed(r.st.realized)]);
      return;
    }
    if (E.isLiquidated(p, m)) {
      var r1 = closePosition(p.id, 'liquidated', p.liq);
      if (r1) events.push(['bad', 'Liquidated: ' + a.sym + ' ' + p.side + ' ' + p.lev + 'x', 'Mark reached ' + px(a, p.liq) + '. Margin lost: ' + usd(p.margin)]);
    }
  }
  /* risk engine: liquidation, TP/SL and limit fills on every price update (only while the market is open,
     and only in the writer tab) */
  function onPrice(id) {
    var a = D.BY_ID[id]; if (!a || !hasPrice(a)) return;
    if (!tab.leader) return;
    if (!sess(a).open) return;
    var events = [];
    if (a.sourceJump) {   // live data replaced sample prices that were never real
      a.sourceJump = false;
      var off = S.positions.filter(function (p) { return p.asset === id && p.offline; }).length;
      if (off) events.push(['warn', 'Live data is back · ' + a.sym, 'The price jumped from sample data to the real ' + (a.srcName || 'live') + ' price. ' + off + ' position' + (off > 1 ? 's were' : ' was') + ' opened on sample prices (marked "offline").']);
    }
    S.positions.slice().forEach(function (p) { if (p.asset === id) riskCheck(p, a, events); });
    var q = quote(a);
    S.orders.slice().forEach(function (o) {
      if (o.asset !== id || !E.limitTriggered(o, q.bid, q.ask)) return;
      S.orders = S.orders.filter(function (x) { return x.id !== o.id; });
      // fills at the limit or better (gap through the limit: the better market price)
      var fill = E.limitFillPrice(o, q.bid, q.ask);
      var fee = o.reserved - o.margin;   // exactly the fee reserved when the order was placed
      var pos = openPosition(a, o.side, fill, o.margin, o.lev, fin(o.feeRate) ? o.feeRate : cls(a).maker, o.tp, o.sl, 'limit', { fee: fee, taker: o.taker });
      events.push(['ok', 'Limit order filled · ' + a.sym, o.side.toUpperCase() + ' ' + o.lev + 'x at ' + px(a, fill) + (fill !== o.price ? ' (limit ' + px(a, o.price) + ', better price)' : '') + ' · liq. ' + px(a, pos.liq)]);
      riskCheck(pos, a, events);   // same price update: never leave a new position beyond its liquidation / TP / SL
    });
    if (events.length) { events.forEach(function (e) { toast(e[1], e[2], e[0]); }); save(true); dirty.act = true; }
  }

  /* ---------------- price alerts ---------------- */
  function checkAlerts(id) {
    if (!S.alerts.length || !tab.leader) return;
    var a = D.BY_ID[id], t = D.tick[id]; if (!t || !hasPrice(a)) return;
    var p = t.price, hit = false;
    S.alerts.forEach(function (al) {
      if (al.asset !== id || al.hitAt) return;
      if (al.dir === 'above' ? p >= al.price : p <= al.price) {
        al.hitAt = Date.now(); al.hitPx = p; hit = true;
        toast('Price alert · ' + a.sym, 'Crossed ' + (al.dir === 'above' ? 'above ' : 'below ') + px(a, al.price) + ' · last ' + px(a, p), 'warn');
      }
    });
    if (hit) { save(true); dirty.act = true; }
  }
  function addAlert(id, price) {
    claim();
    var a = D.BY_ID[id];
    if (!a) return 'Unknown market.';
    if (typeof price !== 'number') return 'Enter a price greater than 0.';
    if (!(price > 0) || !isFinite(price)) return 'Enter a price greater than 0.';
    var cur = mid(a);
    if (Math.abs(price - cur) < Math.pow(10, -a.dp)) return 'The alert price equals the current price.';
    var al = { id: uid('a'), asset: id, price: price, dir: price > cur ? 'above' : 'below', created: Date.now(), from: cur, hitAt: null };
    S.alerts.unshift(al);
    if (S.alerts.length > 50) S.alerts.length = 50;
    save(true);
    return al;
  }
  function alertModal() {
    var a = D.BY_ID[S.ui.asset], cur = mid(a);
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Price alert · ' + esc(a.sym) + '</div>' +
      '<p class="fine">Last ' + px(a, cur) + '. You get a notification when the price crosses this level (checked on every tick while the page is open).</p>' +
      '<div class="field"><label for="alPx">Alert price</label><div class="input"><input id="alPx" class="mono" inputmode="decimal" autocomplete="off" value="' + px(a, cur * 1.005).replace(/,/g, '') + '"><span class="unit">' + (a.kind === 'inverse' ? esc(a.sym.split('/')[1]) : 'USD') + '</span></div>' +
      '<div class="chips" id="alChips"><button data-f="-0.01">-1%</button><button data-f="-0.005">-0.5%</button><button data-f="0.005">+0.5%</button><button data-f="0.01">+1%</button></div></div>' +
      '<p class="fine" id="alDir"></p><div class="ticket-err" id="alErr"></div><div class="lf-btns"><button class="btn-ghost" id="alNo">Cancel</button><button class="btn-primary" id="alGo">Create alert</button></div></div>');
    function dirTxt() { var v = num('alPx'); $('alDir').textContent = v > 0 ? 'Triggers when the price goes ' + (v > cur ? 'above ' : 'below ') + px(a, v) + ' (' + pct(v / cur - 1) + ' from last).' : ''; }
    $('alPx').oninput = dirTxt; dirTxt();
    $('alChips').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; $('alPx').value = px(a, cur * (1 + +b.dataset.f)).replace(/,/g, ''); dirTxt(); };
    $('alNo').onclick = closeModal;
    $('alGo').onclick = function () {
      var r = addAlert(a.id, num('alPx'));
      if (typeof r === 'string') { $('alErr').textContent = r; return; }
      closeModal(); toast('Alert created · ' + a.sym, (r.dir === 'above' ? 'Above ' : 'Below ') + px(a, r.price), 'ok'); setAct('alerts');
    };
  }

  /* ---------------- toasts, notifications & modal ---------------- */
  function toast(title, body, kind) {
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = '<b>' + esc(title) + '</b>' + (body ? '<span>' + esc(body) + '</span>' : '');
    $('toasts').appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, 4200);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    notify(title, body, kind);
  }
  function notify(title, body, kind) {
    if (!S.notifs) S.notifs = [];
    S.notifs.unshift({ t: Date.now(), title: String(title), body: body ? String(body) : '', kind: kind || '', read: false });
    if (S.notifs.length > 40) S.notifs.length = 40;
    renderBell();
  }
  function renderBell() {
    var n = (S.notifs || []).filter(function (x) { return !x.read; }).length;
    $('bellN').hidden = !n; $('bellN').textContent = n > 9 ? '9+' : n;
  }
  var lastFocus = null;
  function modal(html, wide) {
    closePop();
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

  /* ---------------- popovers (bell, settings, account) ---------------- */
  var popFor = null;
  function openPop(btn, html, onBind) {
    var pop = $('pop');
    if (popFor === btn) { closePop(); return; }
    closePop();
    pop.innerHTML = html; pop.hidden = false; popFor = btn;
    btn.setAttribute('aria-expanded', 'true');
    var r = btn.getBoundingClientRect(), W = document.documentElement.clientWidth;
    var w = Math.min(pop.offsetWidth || 320, W - 16);
    pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(W - w - 8, r.right - w)) + 'px';
    if (onBind) onBind(pop);
  }
  function closePop() { if (!popFor) return; popFor.setAttribute('aria-expanded', 'false'); popFor = null; $('pop').hidden = true; $('pop').innerHTML = ''; }
  function bellPop() {
    var list = S.notifs || [];
    openPop($('btnBell'), '<div class="pop-head"><b>Notifications</b>' + (list.length ? '<button class="btn-text" id="ntClear">Clear</button>' : '') + '</div>' +
      (list.length ? '<ul class="nt-list">' + list.slice(0, 20).map(function (n) {
        return '<li class="' + (n.read ? '' : 'unread ') + esc(n.kind) + '"><b>' + esc(n.title) + '</b>' + (n.body ? '<span>' + esc(n.body) + '</span>' : '') + '<time class="mono">' + hms(n.t) + '</time></li>';
      }).join('') + '</ul>' : '<div class="empty-st"><i class="ph ph-bell-slash" aria-hidden="true"></i><b>No notifications</b><span>Fills, liquidations, price alerts and admin actions show up here.</span></div>'),
      function (pop) {
        list.forEach(function (n) { n.read = true; }); renderBell(); save();
        var c = pop.querySelector('#ntClear'); if (c) c.onclick = function () { S.notifs = []; save(true); closePop(); renderBell(); };
      });
  }
  function settingsPop() {
    openPop($('btnSettings'), '<div class="pop-head"><b>Settings</b></div>' +
      '<label class="set-row"><span><b>Confirm orders</b><small>Show a summary and ask before every order is sent</small></span><input type="checkbox" class="switch" id="stConfirm"' + (prefs.confirm ? ' checked' : '') + '></label>' +
      '<div class="set-row col"><span><b>Trading hours</b><small>Exchange hours block market orders while a market is closed. 24/7 practice opens every market for testing.</small></span>' +
        '<div class="tabs tabs-tight" id="stHours"><button class="seg-btn' + (prefs.hours !== 'always' ? ' is-active' : '') + '" data-h="exchange">Exchange hours</button><button class="seg-btn' + (prefs.hours === 'always' ? ' is-active' : '') + '" data-h="always">24/7 practice</button></div></div>' +
      '<label class="set-row"><span><b>Flash price changes</b><small>Briefly highlight a price green or red when it moves</small></span><input type="checkbox" class="switch" id="stFlash"' + (prefs.flash ? ' checked' : '') + '></label>' +
      '<div class="set-row"><span><b>Keyboard shortcuts</b><small>Press ? at any time</small></span><button class="btn-ghost sm" id="stKeys">Show</button></div>',
      function (pop) {
        pop.querySelector('#stConfirm').onchange = function (e) { prefs.confirm = e.target.checked; savePrefs(); };
        pop.querySelector('#stFlash').onchange = function (e) { prefs.flash = e.target.checked; savePrefs(); document.body.classList.toggle('no-flash', !prefs.flash); };
        pop.querySelector('#stHours').onclick = function (e) {
          var b = e.target.closest('[data-h]'); if (!b) return;
          setHoursMode(b.dataset.h);
          pop.querySelectorAll('#stHours .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
        };
        pop.querySelector('#stKeys').onclick = function () { closePop(); keysModal(); };
      });
  }
  function setHoursMode(m) {
    prefs.hours = m === 'always' ? 'always' : 'exchange'; HR.setMode(prefs.hours); savePrefs(); sessCache = {};
    buildWatch(); renderHead(); updTicket(); renderBook();
    toast('Trading hours: ' + (prefs.hours === 'always' ? '24/7 practice' : 'exchange hours'), prefs.hours === 'always' ? 'Every market accepts market orders. Real sessions are still shown.' : 'Closed markets accept limit orders only.', 'ok');
  }
  function acctPop() {
    var ml = marginLevel();
    openPop($('acctSel'), '<div class="pop-head"><b>Accounts</b></div>' +
      '<button class="acc-row is-cur" data-acc="demo"><span><b>D-100248 · Paper USD</b><small>Demo account · active</small></span><span class="mono">' + usd(equity()) + '</span></button>' +
      '<button class="acc-row" data-acc="live"><span><b>Live account</b><small>Requires KYC and a crypto deposit · walkthrough only</small></span><i class="ph ph-lock-simple" aria-hidden="true"></i></button>' +
      '<dl class="summary pop-sum"><div><dt>Available</dt><dd class="mono">' + usd(S.balance) + '</dd></div><div><dt>Used margin</dt><dd class="mono">' + usd(marginAll() + reservedAll()) + '</dd></div><div><dt>Margin level</dt><dd class="mono">' + (ml == null ? '—' : nf(ml * 100, 0) + '%') + '</dd></div></dl>' +
      '<div class="pop-foot"><button class="btn-ghost sm" data-acc="risk">Account and risk</button><button class="btn-ghost sm" data-acc="reset">Reset demo</button></div>',
      function (pop) {
        pop.onclick = function (e) {
          var b = e.target.closest('[data-acc]'); if (!b) return;
          var k = b.dataset.acc; closePop();
          if (k === 'live') { setMode('live'); liveFlow(0); }
          else if (k === 'risk') setView('account');
          else if (k === 'reset') resetDemo();
        };
      });
  }
  function keysModal() {
    var keys = [['B', 'Buy / Long: select the buy side and focus the margin field'], ['S', 'Sell / Short: select the sell side and focus the margin field'], ['Enter', 'Send the order (while in a ticket field)'],
                ['/', 'Search markets'], ['A', 'New price alert for the selected market'], ['1 - 6', 'Chart interval 1m, 5m, 15m, 1h, 4h, 1d'], ['G then T / P / C / A', 'Go to Trade, Predict, Commodities, Account'], ['?', 'This list'], ['Esc', 'Close a dialog or menu']];
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Keyboard shortcuts</div><table class="tbl keys"><tbody>' +
      keys.map(function (k) { return '<tr><td>' + k[0].split(' ').map(function (x) { return /^(then|-|\/)$/.test(x) && x !== '/' ? '<span class="muted">' + x + '</span>' : '<kbd>' + esc(x) + '</kbd>'; }).join(' ') + '</td><td>' + esc(k[1]) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="fine">Shortcuts are ignored while you type in a field.</p></div>');
  }

  /* ---------------- watchlist ---------------- */
  var rows = {};
  function isFav(id) { return S.favs.indexOf(id) >= 0; }
  function toggleFav(id) {
    var i = S.favs.indexOf(id);
    if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id);
    save(true);
    if (S.ui.cat === 'fav') buildWatch();
    else { var st = document.querySelector('.w-star[data-star="' + id + '"]'); if (st) setStar(st, isFav(id)); }
    if (id === S.ui.asset) renderStar();
  }
  function setStar(btn, on) {
    btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.innerHTML = '<i class="' + (on ? 'ph-fill' : 'ph') + ' ph-star" aria-hidden="true"></i>';
  }
  function renderStar() { var b = $('symStar'), on = isFav(S.ui.asset); setStar(b, on); b.setAttribute('data-tip', on ? 'Remove from starred' : 'Add to starred'); }
  function visibleAssets() {
    var cat = S.ui.cat, sub = S.ui.sub, q = ($('watchSearch').value || '').trim().toLowerCase();
    return D.ASSETS.filter(function (a) {
      if (q) return (a.sym + ' ' + a.name).toLowerCase().indexOf(q) >= 0;
      if (cat === 'fav') return isFav(a.id);
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
      var line = document.createElement('div'); line.className = 'wline';
      var st = document.createElement('button'); st.className = 'w-star'; st.dataset.star = a.id; st.setAttribute('aria-label', 'Star ' + a.sym); setStar(st, isFav(a.id));
      var r = document.createElement('button');
      r.className = 'wrow' + (a.id === S.ui.asset ? ' is-active' : '');
      r.dataset.id = a.id;
      r.title = a.name;
      r.innerHTML = '<span class="w-name"><b>' + esc(a.sym) + '</b>' + (a.sym.length > 8 ? '' : '<small>' + esc(a.name.replace(/ \(.*\)$/, '').replace(/ crude oil$/, '').replace(/ No\. \d+$/, '')) + '</small>') + '</span>' +
        '<span class="w-px mono"></span><span class="w-chg mono"></span><span class="w-src"></span>';
      line.appendChild(st); line.appendChild(r); list.appendChild(line);
      rows[a.id] = { el: r, px: r.querySelector('.w-px'), chg: r.querySelector('.w-chg'), src: r.querySelector('.w-src'), last: null };
      updRow(a);
    });
    if (!vis.length) list.innerHTML = S.ui.cat === 'fav' && !$('watchSearch').value ? '<div class="empty-st"><i class="ph ph-star" aria-hidden="true"></i><b>No starred markets</b><span>Use the star next to a market to keep it here.</span></div>' : '<div class="empty">No markets match.</div>';
    document.querySelectorAll('#catTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.cat === S.ui.cat); });
    $('subTabs').hidden = S.ui.cat !== 'cmd';
    document.querySelectorAll('#subTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.sub === S.ui.sub); });
  }
  function changeOf(a) { var t = D.tick[a.id]; return t && t.open24 ? t.price / t.open24 - 1 : 0; }
  function flash(el, up) { if (!prefs.flash) return; el.classList.remove('fl-up', 'fl-dn'); void el.offsetWidth; el.classList.add(up ? 'fl-up' : 'fl-dn'); }
  function updRow(a) {
    var r = rows[a.id]; if (!r) return;
    var t = D.tick[a.id], b = D.badge(a), ss = sess(a);
    var k = b.text + (ss.open ? '' : '|c');
    if (r.src.dataset.k !== k) {
      r.src.innerHTML = '<span class="badge ' + b.cls + '" title="' + esc(b.text + ': ' + b.title) + '">' + esc(b.text.split(' · ')[0]) + '</span>' + (ss.open ? '' : '<span class="w-closed" title="' + esc(ss.label + ' · opens in ' + HR.untilText(ss.next)) + '"><i class="ph ph-moon" aria-hidden="true"></i>' + (ss.state === 'break' ? 'Break' : 'Closed') + '</span>');
      r.src.dataset.k = k;
    }
    if (!t) { if (!r.px.firstChild || r.px.textContent) r.px.innerHTML = '<span class="sk sk-px"></span>'; r.chg.innerHTML = '<span class="sk sk-chg"></span>'; return; }
    var p = t.price;
    if (r.last != null && p !== r.last) flash(r.px, p > r.last);
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
  var headLast = null;
  function renderHead() {
    var a = D.BY_ID[S.ui.asset], t = D.tick[a.id], c = cls(a), b = D.badge(a), q = quote(a), ss = sess(a);
    $('symName').textContent = a.sym;
    $('symDesc').textContent = a.name + ' · ' + c.label + (a.sub ? ' · ' + D.SUB[a.sub] : '');
    var srcK = b.text;
    if ($('symSrc').dataset.k !== srcK) { $('symSrc').innerHTML = '<span class="badge ' + b.cls + '" title="' + esc(b.title) + '">' + esc(b.text) + '</span>'; $('symSrc').dataset.k = srcK; }
    $('symSess').innerHTML = '<span class="sess ' + (ss.open ? (ss.practice ? 'practice' : 'open') : 'closed') + '" title="' + esc(ss.sched) + '">' + esc(sessText(ss)) + '</span>';
    if (!t) { ['symPrice', 'symChg', 'symHigh', 'symLow', 'symVol'].forEach(function (k) { $(k).textContent = '—'; }); }
    else {
      var ch = changeOf(a);
      if (headLast && headLast.id === a.id && headLast.p !== t.price) flash($('symPrice'), t.price > headLast.p);
      headLast = { id: a.id, p: t.price };
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
      $('symChgK').textContent = a.state === 'daily' ? 'vs prev. day' : (a.feed === 'binance' && a.state === 'live' ? '24h change' : 'vs prev. close');
    }
    var spread = a.spread ? px(a, a.spread) : 'market (order book)';
    var specs =
      '<div><dt>Unit</dt><dd>' + esc(a.unit) + '</dd></div>' +
      '<div><dt>Trading hours</dt><dd>' + esc(a.hours) + '</dd></div>' +
      '<div><dt>Max leverage</dt><dd class="mono">' + c.maxLev + 'x' + (c.profile ? ' <span class="muted">' + c.profile + '</span>' : '') + '</dd></div>' +
      '<div><dt>Spread</dt><dd class="mono">' + spread + '</dd></div>' +
      '<div><dt>Fee taker / maker</dt><dd class="mono">' + nf(c.taker * 100, 3) + '% / ' + nf(c.maker * 100, 3) + '%</dd></div>' +
      '<div class="hide-xs"><dt>Bid / Ask</dt><dd class="mono">' + (t ? px(a, q.bid) + ' / ' + px(a, q.ask) : '—') + '</dd></div>' +
      '<div class="hide-xs"><dt>Contract</dt><dd>' + (a.kind === 'inverse' ? 'Size in USD, PnL converted at mark' : 'Linear, USD-settled') + '</dd></div>';
    if ($('specs').innerHTML !== specs) $('specs').innerHTML = specs;
    renderSessBanner(a, ss);
  }

  /* session banner above the trade screen: closed market, daily break or 24/7 practice */
  var TZ_ABBR = { 'America/New_York': 'ET', 'America/Chicago': 'CT', 'Europe/London': 'London', 'Europe/Berlin': 'Frankfurt' };
  var localTz = ''; try { localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  function whenText(ms, tz) {
    var o = { weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    if (tz) o.timeZone = tz;
    try { return new Date(ms).toLocaleString('en-US', o).replace(',', ''); } catch (e) { return ''; }
  }
  function opensAt(ms, tz) {
    var ex = whenText(ms, tz) + ' ' + (TZ_ABBR[tz] || 'UTC');
    if (!tz || tz === localTz) return ex;
    return ex + ' <span class="sb-local">(' + whenText(ms) + ' your time)</span>';
  }
  function renderSessBanner(a, ss) {
    var el = $('sessBanner'), sc = HR.schedFor(a.id, a.cat), html = '', kind = '';
    var real = ss.practice ? ss.real : ss;
    if (!ss.open && real.next) {
      kind = real.state === 'break' ? 'break' : 'closed';
      html = '<i class="ph ph-moon" aria-hidden="true"></i><span class="sb-t"><b>' + esc(a.sym) + (kind === 'break' ? ' daily break' : ' market closed') + '</b>' +
        ' Opens ' + opensAt(real.next, sc.tz) + ' · in <span class="mono">' + esc(HR.untilText(real.next)) + '</span>. Limit orders can be queued now.</span>' +
        '<span class="sb-act"><button class="btn-primary sm" data-sb="practice">Practice 24/7</button></span>';
    } else if (ss.practice && real && real.next) {
      kind = 'practice';
      html = '<i class="ph ph-clock-countdown" aria-hidden="true"></i><span class="sb-t"><b>24/7 practice</b> Real ' + esc(a.sym) + ' session ' + (real.state === 'break' ? 'is on its daily break' : 'is closed') + ', opens ' + opensAt(real.next, sc.tz) + '. Orders fill at the last price.</span>' +
        '<span class="sb-act"><button class="btn-ghost sm" data-sb="exchange">Use exchange hours</button></span>';
    }
    var key = kind + '|' + html;
    if (!html) { if (!el.hidden) el.hidden = true; el.dataset.k = ''; return; }
    if (el.dataset.k !== key) { el.className = 'sess-banner ' + kind; el.innerHTML = html; el.dataset.k = key; }
    if (el.hidden) el.hidden = false;
  }

  /* ---------------- chart ---------------- */
  var chart = null, cSeries = null, vSeries = null, priceLines = [], chartReq = 0, lastBar = null;
  var C_UP = '#26b37a', C_DN = '#e5484d', C_UP_V = 'rgba(38,179,122,0.30)', C_DN_V = 'rgba(229,72,77,0.30)';
  function chartOptions() {
    return {
      autoSize: true,
      localization: { locale: 'en-US' },
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#7c848e', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 11 },
      grid: { vertLines: { color: 'rgba(150,158,168,0.06)' }, horzLines: { color: 'rgba(150,158,168,0.06)' } },
      rightPriceScale: { borderColor: '#22262b' },
      timeScale: { borderColor: '#22262b', timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: { mode: 0, vertLine: { color: 'rgba(200,205,212,0.35)', width: 1, style: 3, labelBackgroundColor: '#2c3137' }, horzLine: { color: 'rgba(200,205,212,0.35)', width: 1, style: 3, labelBackgroundColor: '#2c3137' } },
      handleScroll: { vertTouchDrag: false }
    };
  }
  function makeMain() {
    if (cSeries) { try { chart.removeSeries(cSeries); } catch (e) {} cSeries = null; }
    priceLines = [];
    if (S.ui.ct === 'line') cSeries = chart.addAreaSeries({ lineColor: '#c9cdd2', lineWidth: 2, topColor: 'rgba(201,205,210,0.12)', bottomColor: 'rgba(201,205,210,0)', priceLineColor: '#6f7781' });
    else cSeries = chart.addCandlestickSeries({ upColor: C_UP, downColor: C_DN, borderVisible: false, wickUpColor: C_UP, wickDownColor: C_DN });
  }
  function toMain(b) { return S.ui.ct === 'line' ? { time: b.time, value: b.close } : { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }; }
  function initChart() {
    if (!window.LightweightCharts) { $('chartMsgT').textContent = 'Chart library could not be loaded (offline?). Trading still works.'; return; }
    chart = LightweightCharts.createChart($('chart'), chartOptions());
    vSeries = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    makeMain();
    vSeries.applyOptions({ visible: S.ui.vol !== false });
    chart.subscribeCrosshairMove(function (prm) {
      var a = D.BY_ID[S.ui.asset];
      var d = prm && prm.seriesData ? prm.seriesData.get(cSeries) : null;
      if (!d) d = lastBar;
      if (!d) { $('chartLegend').textContent = ''; return; }
      if (d.open == null) { $('chartLegend').innerHTML = 'C <b>' + px(a, d.value != null ? d.value : d.close) + '</b>'; return; }
      $('chartLegend').innerHTML = 'O <b>' + px(a, d.open) + '</b> H <b>' + px(a, d.high) + '</b> L <b>' + px(a, d.low) + '</b> C <b class="' + (d.close >= d.open ? 'up' : 'down') + '">' + px(a, d.close) + '</b>';
    });
  }
  function chartMsg(txt, sk) { $('chartMsg').hidden = false; $('chartMsgT').textContent = txt; $('chartMsg').classList.toggle('loading', !!sk); }
  function loadChart() {
    var a = D.BY_ID[S.ui.asset], tf = S.ui.tf, req = ++chartReq;
    $('chartNote').textContent = D.historyNote(a, tf) + ' · UTC';
    if (!chart) return;
    chartMsg('Loading ' + a.sym + ' · ' + tf, true);
    cSeries.applyOptions({ priceFormat: { type: 'price', precision: a.dp, minMove: Math.pow(10, -a.dp) } });
    lastBar = null;
    if (a.state === 'pending') { chartMsg('Connecting to the data source…', true); return; }
    D.getCandles(a.id, tf).then(function (bars) {
      if (req !== chartReq) return;
      cSeries.setData(bars.map(toMain));
      vSeries.setData(bars.map(function (b) { return { time: b.time, value: b.volume, color: b.close >= b.open ? C_UP_V : C_DN_V }; }));
      lastBar = bars[bars.length - 1] || null;
      chart.timeScale().applyOptions({ secondsVisible: false, timeVisible: tf !== '1d' });
      fitChart(bars.length);
      $('chartMsg').hidden = true;
      drawPriceLines();
      $('chartLegend').innerHTML = '';
    }, function () {
      if (req !== chartReq) return;
      chartMsg('Could not load candles for ' + a.sym + ' right now. Retrying…', false);
      setTimeout(function () { if (req === chartReq) loadChart(); }, 5000);
    });
  }
  var barCount = 0;
  function fitChart(n) {
    if (n != null) barCount = n;
    if (!chart || !barCount) return;
    var show = S.ui.tf === '1d' ? 160 : 120;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, barCount - show), to: barCount + 3 });
    chart.priceScale('right').applyOptions({ autoScale: true });
  }
  function onCandle(id, c) {
    if (id !== S.ui.asset || !cSeries || !lastBar) return;
    if (c.time < lastBar.time) return;
    try {
      if (c.time > lastBar.time) barCount++;
      cSeries.update(toMain(c));
      vSeries.update({ time: c.time, value: c.volume, color: c.close >= c.open ? C_UP_V : C_DN_V });
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
      line(p.entry, p.side === 'long' ? C_UP : C_DN, (p.side === 'long' ? 'Long ' : 'Short ') + p.lev + 'x', 0);
      line(p.liq, '#e8b33a', 'Liq.', 2);
      if (p.tp) line(p.tp, '#9aa1a9', 'TP', 1);
      if (p.sl) line(p.sl, '#9aa1a9', 'SL', 1);
    });
    S.orders.forEach(function (o) { if (o.asset === id) line(o.price, '#c9cdd2', 'Limit ' + o.side, 1); });
    S.alerts.forEach(function (al) { if (al.asset === id && !al.hitAt) line(al.price, '#6f7781', 'Alert', 3); });
  }

  /* ---------------- order book ---------------- */
  var lastBook = null, bookTimer = 0;
  function onBook(id, bk) { if (id !== S.ui.asset) return; lastBook = bk; if (!bookTimer) bookTimer = setTimeout(renderBook, 250); }
  function skRows(n) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="b-row sk-row"><span class="sk"></span><span class="sk"></span><span class="sk"></span></div>'; return s; }
  function renderBook() {
    bookTimer = 0;
    var a = D.BY_ID[S.ui.asset], bk = lastBook, ss = sess(a);
    if (!ss.open) {
      $('bookTag').textContent = 'closed'; $('bookTag').className = 'tag';
      $('bookAsks').innerHTML = ''; $('bookBids').innerHTML = '';
      $('bookMid').textContent = px(a, mid(a)); $('bookSpread').textContent = 'last';
      $('bookAsks').innerHTML = '<div class="empty-st sm"><i class="ph ph-moon" aria-hidden="true"></i><b>' + esc(ss.label) + '</b><span>Opens in ' + esc(HR.untilText(ss.next)) + '. Limit orders are queued.</span></div>';
      $('bookRatio').hidden = true;
      return;
    }
    $('bookTag').textContent = !bk ? '…' : bk.synthetic ? 'synthetic' : 'Binance live';
    $('bookTag').className = 'tag ' + (bk && !bk.synthetic ? 'tag-live' : '');
    if (!bk || !bk.asks.length) { $('bookAsks').innerHTML = skRows(7); $('bookBids').innerHTML = skRows(7); $('bookMid').textContent = '—'; $('bookSpread').textContent = ''; $('bookRatio').hidden = true; return; }
    var asks = bk.asks.slice(0, 7), bids = bk.bids.slice(0, 7);
    var max = 0, cumA = [], cumB = [], s = 0;
    asks.forEach(function (r) { s += r[1]; cumA.push(s); }); var totA = s; max = s; s = 0;
    bids.forEach(function (r) { s += r[1]; cumB.push(s); }); var totB = s; max = Math.max(max, s) || 1;
    function sz(v) { return v >= 1000 ? compact(v) : nf(v, v >= 10 ? 1 : 3); }
    $('bookAsks').innerHTML = asks.map(function (r, i) { return '<div class="b-row ask"><i style="width:' + (cumA[i] / max * 100).toFixed(1) + '%"></i><span class="mono">' + px(a, r[0]) + '</span><span class="mono">' + sz(r[1]) + '</span><span class="mono">' + sz(cumA[i]) + '</span></div>'; }).reverse().join('');
    $('bookBids').innerHTML = bids.map(function (r, i) { return '<div class="b-row bid"><i style="width:' + (cumB[i] / max * 100).toFixed(1) + '%"></i><span class="mono">' + px(a, r[0]) + '</span><span class="mono">' + sz(r[1]) + '</span><span class="mono">' + sz(cumB[i]) + '</span></div>'; }).join('');
    var spr = asks[0][0] - bids[0][0];
    $('bookMid').textContent = px(a, (asks[0][0] + bids[0][0]) / 2);
    $('bookSpread').textContent = 'spread ' + px(a, spr);
    var bp = totB / ((totA + totB) || 1);
    $('bookRatio').hidden = false;
    $('bookRatio').innerHTML = '<span class="mono up">B ' + nf(bp * 100, 0) + '%</span><i class="br-b" style="flex:' + bp.toFixed(3) + '"></i><i class="br-a" style="flex:' + (1 - bp).toFixed(3) + '"></i><span class="mono down">' + nf((1 - bp) * 100, 0) + '% S</span>';
  }

  /* ---------------- trade tape ---------------- */
  var tape = [], tapeTimer = 0, tapeKind = '';
  function onTrade(id, tr) {
    if (id !== S.ui.asset) return;
    tape.unshift(tr); if (tape.length > 40) tape.length = 40;
    tapeKind = tr.kind;
    if (!tapeTimer) tapeTimer = setTimeout(renderTape, 300);
  }
  var tapeTop = 0;
  function renderTape() {
    tapeTimer = 0;
    var a = D.BY_ID[S.ui.asset], ss = sess(a), el = $('tape');
    $('tapeTag').textContent = !tape.length ? (ss.open ? '…' : 'closed') : tapeKind === 'live' ? 'Binance live' : tapeKind === 'spot' ? 'spot updates' : 'simulated';
    $('tapeTag').className = 'tag ' + (tape.length && tapeKind !== 'sim' ? 'tag-live' : '');
    if (!tape.length) {
      el.innerHTML = ss.open ? skRows(6).replace(/b-row/g, 't-row') : '<div class="empty-st sm"><b>No prints</b><span>The market is closed.</span></div>';
      return;
    }
    var newest = tape[0].t + ':' + tape[0].p;
    var dp = qtyDp(a);
    el.innerHTML = tape.slice(0, 22).map(function (t, i) {
      return '<div class="t-row' + (i === 0 && newest !== tapeTop ? ' t-new' : '') + '"><span class="mono ' + (t.side === 'buy' ? 'up' : 'down') + '">' + px(a, t.p) + '</span><span class="mono">' + (t.q == null ? '—' : nf(t.q, t.q >= 1000 ? 0 : dp)) + '</span><span class="mono">' + hms(t.t) + '</span></div>';
    }).join('');
    tapeTop = newest;
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
    $('levCap').textContent = 'max ' + c.maxLev + 'x · ' + (c.profile || c.label);
    var marks = [1, 2, 5, 10, 20, 50, 100].filter(function (x) { return x <= c.maxLev; });
    if (marks.indexOf(c.maxLev) < 0) marks.push(c.maxLev);
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
    var a = D.BY_ID[S.ui.asset], c = cls(a), o = ticketInput(), ss = sess(a);
    var q = quote(a), ready = hasPrice(a);
    var entry = o.type === 'limit' ? o.limit : (o.side === 'long' ? q.ask : q.bid);
    $('levVal').textContent = (isFinite(o.lev) ? o.lev : '—') + 'x';
    var closedMkt = !ss.open && o.type !== 'limit';
    $('btnSubmit').textContent = closedMkt ? 'Market closed · use Limit' : (o.type === 'limit' ? (ss.open ? 'Place limit ' : 'Queue limit ') : 'Open ') + (o.side === 'long' ? 'long' : 'short') + ' · ' + a.sym;
    $('btnSubmit').className = 'btn-submit ' + o.side;
    $('sumAvail').textContent = usd(S.balance);
    var sn = $('sessNote');
    if (!ss.open) { sn.hidden = false; sn.className = 'sess-note'; sn.innerHTML = '<i class="ph ph-moon" aria-hidden="true"></i><span><b>' + esc(ss.label) + '</b> · opens in ' + esc(HR.untilText(ss.next)) + '. Market orders are disabled. Limit orders wait in the queue and can fill after the open.</span>'; }
    else if (ss.practice) { sn.hidden = false; sn.className = 'sess-note practice'; sn.innerHTML = '<i class="ph ph-info" aria-hidden="true"></i><span>24/7 practice. The real market is ' + (ss.real.state === 'break' ? 'on its daily break' : 'closed') + ' and opens in ' + esc(HR.untilText(ss.real.next)) + '. Change this in Settings.</span>'; }
    else sn.hidden = true;
    var err = '';
    if (!ready) err = 'Waiting for a price…';
    else if (closedMkt) err = '';   // the session note above and the button label already say it
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
      if (!err) { var spr = a.spread || 0; err = instantLiqErr(o.side, pv.liq, o.type === 'limit' ? (o.side === 'long' ? entry - spr : entry + spr) : (o.side === 'long' ? q.bid : q.ask), o.lev); }
      if (!err && o.type === 'limit') {
        if (o.side === 'long' && o.limit >= q.ask) err = 'A buy limit at or above the ask fills immediately. Use Market.';
        if (o.side === 'short' && o.limit <= q.bid) err = 'A sell limit at or below the bid fills immediately. Use Market.';
      }
    } else {
      ['sumEntry', 'sumNotional', 'sumQty', 'sumMargin', 'sumFee', 'sumLiq'].forEach(function (k) { $(k).textContent = '—'; });
      $('sumFeeRate').textContent = '';
      if (ready && o.type === 'limit' && o.limit == null && !err) err = '';
    }
    $('ticketErr').textContent = err;
    $('btnSubmit').disabled = !!err || !ok || closedMkt;
  }
  var submitLock = false;
  function submitTicket() {
    if (submitLock) return;
    updTicket();
    if ($('btnSubmit').disabled) return;   // invalid input: the error is already shown
    submitLock = true; $('btnSubmit').disabled = true;
    setTimeout(function () { submitLock = false; updTicket(); }, 400);
    var o = ticketInput();
    if (o.type !== 'limit') o.limit = null;
    if (prefs.confirm) { confirmOrder(o); return; }
    sendOrder(o);
  }
  function sendOrder(o) {
    var a = D.BY_ID[o.asset];
    var r = placeOrder(o);
    if (typeof r === 'string') { $('ticketErr').textContent = r; return r; }
    if (r.position) toast('Position opened · ' + a.sym, r.position.side.toUpperCase() + ' ' + r.position.lev + 'x at ' + px(a, r.position.entry) + ' · liq. ' + px(a, r.position.liq), 'ok');
    else toast((r.order.queued ? 'Limit order queued · ' : 'Limit order placed · ') + a.sym, o.side.toUpperCase() + ' ' + o.lev + 'x at ' + px(a, o.limit) + (r.order.queued ? ' · can fill after the open' : ''), 'ok');
    save(true); dirty.act = true; drawPriceLines(); renderAccount();
    setAct(r.position ? 'pos' : 'ord');
    return r;
  }
  function confirmOrder(o) {
    var a = D.BY_ID[o.asset], c = cls(a), q = quote(a);
    var entry = o.type === 'limit' ? o.limit : (o.side === 'long' ? q.ask : q.bid);
    var fr = o.type === 'limit' ? c.maker : c.taker;
    var pv = E.previewOrder({ side: o.side, price: entry, margin: o.margin, leverage: o.lev, kind: a.kind, feeRate: fr });
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Confirm order</div>' +
      '<div class="cf-head"><span class="side ' + o.side + '">' + (o.side === 'long' ? 'Buy / Long' : 'Sell / Short') + ' ' + o.lev + 'x</span><b>' + esc(a.sym) + '</b><span class="muted">' + (o.type === 'limit' ? 'Limit' : 'Market') + '</span></div>' +
      '<dl class="summary"><div><dt>' + (o.type === 'limit' ? 'Limit price' : 'Est. entry') + '</dt><dd class="mono">' + px(a, entry) + '</dd></div><div><dt>Position size</dt><dd class="mono">' + usd(pv.notional) + '</dd></div><div><dt>Quantity</dt><dd class="mono">' + qtyFmt(a, pv.qty) + '</dd></div>' +
      '<div><dt>Margin</dt><dd class="mono">' + usd(pv.margin) + '</dd></div><div><dt>Fee</dt><dd class="mono">' + usd(pv.fee) + '</dd></div><div class="liqrow"><dt>Liquidation price</dt><dd class="mono">' + px(a, pv.liq) + '</dd></div>' +
      (o.tp || o.sl ? '<div><dt>TP / SL</dt><dd class="mono">' + (o.tp ? px(a, o.tp) : '—') + ' / ' + (o.sl ? px(a, o.sl) : '—') + '</dd></div>' : '') + '</dl>' +
      '<p class="fine">Market orders fill at the current bid or ask, which can differ from this estimate.</p>' +
      '<label class="cf-skip"><input type="checkbox" id="cfSkip"> Don’t ask again <span class="muted">(change in Settings)</span></label>' +
      '<div class="ticket-err" id="cfErr"></div><div class="lf-btns"><button class="btn-ghost" id="cfNo">Cancel</button><button class="btn-submit ' + o.side + '" id="cfGo">Confirm ' + (o.side === 'long' ? 'buy' : 'sell') + '</button></div></div>');
    $('cfNo').onclick = closeModal;
    setTimeout(function () { try { $('cfGo').focus(); } catch (e) {} }, 40);
    var sent = false;
    $('cfGo').onclick = function () {
      if (sent) return; sent = true;
      if ($('cfSkip') && $('cfSkip').checked) { prefs.confirm = false; savePrefs(); }
      var r = sendOrder(o);
      if (typeof r === 'string') { sent = false; $('cfErr').textContent = r; return; }
      closeModal();
    };
  }

  /* ---------------- activity tables ---------------- */
  function setAct(k) {
    S.ui.act = k;
    document.querySelectorAll('#actTabs .seg-btn').forEach(function (b) { b.classList.toggle('is-active', b.dataset.act === k); });
    renderActivity();
  }
  function sideTag(side, lev) { return '<span class="side ' + side + '">' + (side === 'long' ? 'Long' : 'Short') + (lev ? ' ' + lev + 'x' : '') + '</span>'; }
  function emptySt(icon, title, sub) { return '<div class="empty-st"><i class="ph ph-' + icon + '" aria-hidden="true"></i><b>' + title + '</b><span>' + sub + '</span></div>'; }
  function renderActivity() {
    dirty.act = false;
    $('cntPos').textContent = S.positions.length; $('cntOrd').textContent = S.orders.length;
    $('cntAlert').textContent = S.alerts.filter(function (x) { return !x.hitAt; }).length;
    $('btnCloseAll').hidden = !(S.ui.act === 'pos' && S.positions.length > 1);
    var k = S.ui.act || 'pos', html;
    if (k === 'pos') {
      html = S.positions.length ? '<table class="tbl tbl-pos"><thead><tr><th>Market</th><th class="r">Size</th><th class="r">Entry / Mark</th><th class="r">Liq. price</th><th class="r">Margin</th><th class="r">PnL / ROE</th><th class="r">Margin ratio</th><th class="r">TP / SL</th><th></th></tr></thead><tbody>' +
        S.positions.map(function (p) {
          var a = D.BY_ID[p.asset], m = markPos(p), u = E.unrealizedPnl(p, m), r = E.roe(p, m), mr = marginRatio(p);
          return '<tr><td><button class="linkbtn sym" data-go="' + a.id + '">' + esc(a.sym) + '</button><div class="sub">' + sideTag(p.side, p.lev) + (p.offline ? ' <span class="muted" title="Opened while the price source was unreachable (sample price)">offline</span>' : '') + '</div></td><td class="mono r">' + qtyFmt(a, p.qty) + '</td>' +
            '<td class="mono r">' + px(a, p.entry) + '<div class="sub">' + px(a, m) + '</div></td><td class="mono r warn">' + px(a, p.liq) + '</td><td class="mono r">' + usd(p.margin) + '<div class="sub"><button class="linkbtn" data-addm="' + p.id + '">Add</button></div></td>' +
            '<td class="mono r ' + (u >= 0 ? 'up' : 'down') + '">' + signed(u) + '<div class="sub">' + pct(r) + '</div></td>' +
            '<td class="mono r ' + (mr >= 0.8 ? 'down' : mr >= 0.5 ? 'warn' : '') + '">' + nf(Math.min(mr, 9.99) * 100, 1) + '%</td>' +
            '<td class="mono r"><button class="linkbtn" data-tpsl="' + p.id + '" title="Edit take profit / stop loss">' + (p.tp ? px(a, p.tp) : '—') + '<br>' + (p.sl ? px(a, p.sl) : '—') + '</button></td>' +
            '<td class="r"><button class="btn-ghost sm" data-close="' + p.id + '"' + (sess(a).open ? '' : ' aria-disabled="true" data-tip="Market closed"') + '>Close</button></td></tr>';
        }).join('') + '</tbody></table>' : emptySt('stack', 'No open positions', 'Pick a market, set leverage and margin, then buy or sell. Press <kbd>B</kbd> or <kbd>S</kbd>.');
    } else if (k === 'ord') {
      html = S.orders.length ? '<table class="tbl"><thead><tr><th>Market</th><th>Side</th><th>Type</th><th class="r">Price</th><th class="r">Margin</th><th class="r">Reserved</th><th class="r">TP / SL</th><th>Status</th><th>Placed</th><th></th></tr></thead><tbody>' +
        S.orders.map(function (o) {
          var a = D.BY_ID[o.asset], ss = sess(a);
          return '<tr><td><button class="linkbtn sym" data-go="' + a.id + '">' + esc(a.sym) + '</button></td><td>' + sideTag(o.side, o.lev) + '</td><td>Limit</td><td class="mono r">' + px(a, o.price) + '</td><td class="mono r">' + usd(o.margin) + '</td><td class="mono r">' + usd(o.reserved) + '</td>' +
            '<td class="mono r">' + (o.tp ? px(a, o.tp) : '—') + ' / ' + (o.sl ? px(a, o.sl) : '—') + '</td><td>' + (ss.open ? 'Working' : '<span class="warn">Queued · market closed</span>') + '</td><td class="mono">' + timeFmt(o.createdAt) + '</td><td class="r"><button class="btn-ghost sm" data-cancel="' + o.id + '">Cancel</button></td></tr>';
        }).join('') + '</tbody></table>' : emptySt('list-checks', 'No open orders', 'Limit orders rest here until the price reaches them. On a closed market they wait in the queue.');
    } else if (k === 'alerts') {
      html = S.alerts.length ? '<table class="tbl"><thead><tr><th>Market</th><th>Condition</th><th class="r">Level</th><th class="r">Last</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>' +
        S.alerts.map(function (al) {
          var a = D.BY_ID[al.asset];
          return '<tr><td><button class="linkbtn sym" data-go="' + a.id + '">' + esc(a.sym) + '</button></td><td>Price ' + al.dir + '</td><td class="mono r">' + px(a, al.price) + '</td><td class="mono r">' + px(a, mid(a)) + '</td>' +
            '<td>' + (al.hitAt ? '<span class="warn">Triggered ' + hms(al.hitAt) + '</span>' : 'Active') + '</td><td class="mono">' + timeFmt(al.created) + '</td><td class="r"><button class="btn-ghost sm" data-delalert="' + al.id + '">Remove</button></td></tr>';
        }).join('') + '</tbody></table>' : emptySt('bell-simple-ringing', 'No price alerts', 'Use Alert in the market header (or press <kbd>A</kbd>) to get notified when a price crosses a level.');
    } else {
      html = S.history.length ? '<table class="tbl"><thead><tr><th>Time</th><th>Market</th><th>Event</th><th>Side</th><th class="r">Price</th><th class="r">Size</th><th class="r">Fee</th><th class="r">Realized</th></tr></thead><tbody>' +
        S.history.slice(0, 120).map(function (h) {
          var a = D.BY_ID[h.asset]; if (!a) return '';
          return '<tr><td class="mono">' + timeFmt(h.t) + '</td><td>' + esc(a.sym) + '</td><td class="' + (h.kind === 'Liquidated' ? 'down' : '') + '">' + esc(h.kind) + '</td><td>' + sideTag(h.side, h.lev) + '</td><td class="mono r">' + px(a, h.price) + '</td>' +
            '<td class="mono r">' + (h.qty != null ? qtyFmt(a, h.qty) : '—') + '</td><td class="mono r">' + (h.fee ? usd(h.fee) : '—') + '</td><td class="mono r ' + (h.pnl == null ? '' : h.pnl >= 0 ? 'up' : 'down') + '">' + (h.pnl == null ? '—' : signed(h.pnl)) + '</td></tr>';
        }).join('') + '</tbody></table>' : emptySt('clock-counter-clockwise', 'No history yet', 'Every open, fill, close, cancel and liquidation is recorded here.');
    }
    $('actBody').innerHTML = html;
  }

  /* ---------------- CSV export ---------------- */
  function csvCell(v) { if (v == null) return ''; var s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function csv(head, list) { return [head].concat(list).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }
  function iso(t) { return t ? new Date(t).toISOString() : ''; }
  function download(name, text) {
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function exportCsv(kind) {
    var day = new Date().toISOString().slice(0, 10), out;
    if (kind === 'pos') out = csv(['market', 'side', 'leverage', 'quantity', 'entry', 'mark', 'liquidation', 'margin_usd', 'unrealized_usd', 'tp', 'sl', 'opened_utc'], S.positions.map(function (p) { var a = D.BY_ID[p.asset], m = markPos(p); return [a.sym, p.side, p.lev, p.qty, p.entry, m, p.liq, p.margin.toFixed(2), E.unrealizedPnl(p, m).toFixed(2), p.tp, p.sl, iso(p.openedAt)]; }));
    else if (kind === 'ord') out = csv(['market', 'side', 'leverage', 'limit_price', 'margin_usd', 'reserved_usd', 'tp', 'sl', 'placed_utc'], S.orders.map(function (o) { return [D.BY_ID[o.asset].sym, o.side, o.lev, o.price, o.margin, o.reserved.toFixed(2), o.tp, o.sl, iso(o.createdAt)]; }));
    else if (kind === 'alerts') out = csv(['market', 'condition', 'level', 'created_utc', 'triggered_utc'], S.alerts.map(function (al) { return [D.BY_ID[al.asset].sym, 'price ' + al.dir, al.price, iso(al.created), iso(al.hitAt)]; }));
    else if (kind === 'journal') out = csv(['closed_utc', 'opened_utc', 'market', 'side', 'leverage', 'entry', 'exit', 'quantity', 'margin_usd', 'realized_usd', 'fees_usd', 'event', 'note'], journal().map(function (h) { return [iso(h.t), iso(h.opened), D.BY_ID[h.asset].sym, h.side, h.lev, h.entry, h.price, h.qty, h.margin, (h.pnl - (h.openFee || 0)).toFixed(2), ((h.fee || 0) + (h.openFee || 0)).toFixed(2), h.kind, S.notes[h.id] || '']; }));
    else out = csv(['time_utc', 'market', 'event', 'side', 'leverage', 'price', 'quantity', 'fee_usd', 'realized_usd'], S.history.map(function (h) { var a = D.BY_ID[h.asset]; return [iso(h.t), a ? a.sym : h.asset, h.kind, h.side, h.lev, h.price, h.qty, h.fee ? h.fee.toFixed(4) : '', h.pnl != null ? h.pnl.toFixed(2) : '']; }));
    download('demo-exchange-' + (kind === 'pos' ? 'positions' : kind === 'ord' ? 'orders' : kind === 'alerts' ? 'alerts' : kind === 'journal' ? 'journal' : 'history') + '-' + day + '.csv', out);
    return out;
  }
  /* closed trades (round trips), newest first */
  function journal() { return S.history.filter(function (h) { return h.closed; }); }

  function editTpSl(id) {
    var p = S.positions.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var a = D.BY_ID[p.asset];
    modal('<div class="pt"><div class="pt-q" id="modalTitle">TP / SL · ' + esc(a.sym) + ' ' + p.side + ' ' + p.lev + 'x</div>' +
      '<p class="fine">Entry ' + px(a, p.entry) + ' · mark ' + px(a, markPos(p)) + ' · liquidation ' + px(a, p.liq) + '. Leave empty to remove.</p>' +
      '<div class="tpsl-grid"><div class="input"><span class="pre">TP</span><input id="mTp" class="mono" inputmode="decimal" value="' + (p.tp ? px(a, p.tp).replace(/,/g, '') : '') + '"></div>' +
      '<div class="input"><span class="pre">SL</span><input id="mSl" class="mono" inputmode="decimal" value="' + (p.sl ? px(a, p.sl).replace(/,/g, '') : '') + '"></div></div>' +
      '<div class="ticket-err" id="mErr"></div><button class="btn-submit ' + p.side + '" id="mSave">Save TP / SL</button></div>');
    $('mSave').onclick = function () {
      var tp = num('mTp'), sl = num('mSl');
      var m = markPos(p);
      var err = E.validateTpSl(p.side, p.entry, p.liq, tp, sl);
      if (!err && tp && (p.side === 'long' ? tp <= m : tp >= m)) err = 'Take profit would trigger immediately at the current mark.';
      if (!err && sl && (p.side === 'long' ? sl >= m : sl <= m)) err = 'Stop loss would trigger immediately at the current mark.';
      if (err) { $('mErr').textContent = err; return; }
      p.tp = tp || null; p.sl = sl || null;
      closeModal(); save(true); dirty.act = true; drawPriceLines();
      toast('TP / SL updated · ' + a.sym, 'TP ' + (p.tp ? px(a, p.tp) : '—') + ' · SL ' + (p.sl ? px(a, p.sl) : '—'), 'ok');
    };
  }
  function addMarginModal(id) {
    var p = S.positions.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var a = D.BY_ID[p.asset];
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Add margin · ' + esc(a.sym) + ' ' + p.side + ' ' + p.lev + 'x</div>' +
      '<p class="fine">Isolated margin: extra margin lowers the effective leverage and moves the liquidation price away from the mark. Current margin ' + usd(p.margin) + ', liquidation ' + px(a, p.liq) + '.</p>' +
      '<div class="field"><label for="amAmt">Amount</label><div class="input"><input id="amAmt" class="mono" inputmode="decimal" autocomplete="off" value="' + Math.min(S.balance, Math.round(p.margin * 0.5)).toFixed(2) + '"><span class="unit">USD</span></div></div>' +
      '<dl class="summary" id="amSum"></dl><div class="ticket-err" id="amErr"></div><div class="lf-btns"><button class="btn-ghost" id="amNo">Cancel</button><button class="btn-primary" id="amGo">Add margin</button></div></div>');
    function prev() {
      var v = num('amAmt'), n = E.notionalOf(p.kind, p.qty, p.entry);
      if (!(v > 0)) { $('amSum').innerHTML = ''; return; }
      var L = n / (p.margin + v);
      $('amSum').innerHTML = '<div><dt>New margin</dt><dd class="mono">' + usd(p.margin + v) + '</dd></div><div><dt>Effective leverage</dt><dd class="mono">' + nf(L, 2) + 'x</dd></div><div class="liqrow"><dt>New liquidation</dt><dd class="mono">' + (L >= 1 ? px(a, E.liquidationPrice(p.side, p.entry, L, p.kind)) : '—') + '</dd></div>';
    }
    $('amAmt').oninput = prev; prev();
    $('amNo').onclick = closeModal;
    $('amGo').onclick = function () {
      var r = addMargin(p.id, num('amAmt'));
      if (typeof r === 'string') { $('amErr').textContent = r; return; }
      closeModal(); save(true); dirty.act = true; drawPriceLines(); renderAccount(); updTicket();
      toast('Margin added · ' + a.sym, 'Leverage ' + r.pos.lev + 'x · liq. ' + px(a, r.pos.liq), 'ok');
    };
  }

  /* ---------------- select asset ---------------- */
  /* scroll an element to just below the sticky top bar (phones and tablets) */
  function scrollUnderBar(el) {
    var bar = document.querySelector('.topbar'), h = bar ? bar.getBoundingClientRect().height : 0;
    var y = el.getBoundingClientRect().top + window.scrollY - h;
    try { window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); } catch (e) { window.scrollTo(0, y); }
  }
  function selectAsset(id) {
    if (!D.BY_ID[id]) return;
    S.ui.asset = id;
    D.select(id, S.ui.tf);
    lastBook = null; renderBook();
    tape = []; renderTape();
    headLast = null;
    Object.keys(rows).forEach(function (k) { rows[k].el.classList.toggle('is-active', k === id); });
    setupTicketForAsset();
    renderHead(); renderStar(); loadChart(); updTicket();
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
        '<div class="lf-btns"><button class="btn-ghost" data-lf="cancel">Stay in demo</button><button class="btn-primary" data-lf="next">Continue (demo walkthrough)</button></div>';
    } else if (step === 1) {
      body = '<h3 id="modalTitle">Deposit crypto</h3><p class="muted">Preview of the deposit screen. No address is issued and no payment can be made here.</p>' +
        '<div class="field"><label>Asset</label><div class="tabs tabs-tight" id="lfCoin">' + Object.keys(NETS).map(function (c) { return '<button class="seg-btn' + (c === sel.coin ? ' is-active' : '') + '" data-coin="' + c + '">' + c + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label for="lfNet">Network</label><select id="lfNet" class="select">' + NETS[sel.coin].map(function (n, i) { return '<option value="' + i + '"' + (i === sel.net ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>Deposit address</label><div class="addr-ph">Deposit address will be generated by the payment provider in the full build.<br><small>No address, QR code or payment link is shown in this demo.</small></div></div>' +
        '<dl class="summary"><div><dt>Credited as</dt><dd>USD trading balance (after conversion)</dd></div><div><dt>Confirmations</dt><dd>Set by the payment provider per network</dd></div><div><dt>Minimum deposit</dt><dd>Configured in the full build</dd></div></dl>' +
        '<div class="lf-btns"><button class="btn-ghost" data-lf="back">Back</button><button class="btn-primary" data-lf="next">Continue</button></div>';
    } else {
      body = '<h3 id="modalTitle">Live trading will be enabled in the full build</h3><p class="muted">This demo runs on paper money only. The full build connects a regulated broker / liquidity provider, a KYC provider and a crypto payment processor, and keeps live and demo accounts fully separated.</p>' +
        '<ul class="lf-list"><li>Separate live wallet &amp; ledger, withdrawals with 2FA</li><li>Real order routing with risk checks and margin calls</li><li>Region rules for US and EU clients (leverage caps, disclosures)</li></ul>' +
        '<div class="lf-btns"><button class="btn-primary" data-lf="cancel">Back to demo</button></div>';
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
    var rws = [
      ['Crypto', st('binance'), 'Binance public REST + WebSocket (keyless): last price, 24h stats, candles, order book, trades', 'Binance / Coinbase / Kraken WebSocket feeds (free); Kaiko or CoinAPI for consolidated, licensed data (paid)'],
      ['Metals (gold, silver, platinum, palladium, copper)', st('goldapi'), 'gold-api.com spot prices (keyless), refreshed every 12 s; chart history is sample', 'Metals-API, Twelve Data or Polygon.io (paid); LBMA / CME data licenses for production'],
      ['Energy & agriculture', st('sample'), 'Sample data around the ' + D.REF_DATE + ' reference close', 'CME Group DataMine, Barchart OnDemand, Twelve Data commodities (paid); broker/LP price feed for CFDs'],
      ['Forex (incl. USD/TRY)', st('fx'), 'Frankfurter (central-bank reference rates, daily), fallback open.er-api.com (daily); intraday ticks simulated', 'OANDA, Twelve Data, Polygon.io FX or the liquidity provider’s streaming quotes'],
      ['Indices', '<span class="badge b-sample">Sample</span>', 'Sample data around the ' + D.REF_DATE + ' reference close', 'Twelve Data / Polygon.io indices (paid, exchange licenses); CFD prices from the LP'],
      ['US stocks', '<span class="badge b-sample">Sample</span>', 'Sample data around the ' + D.REF_DATE + ' reference close', 'Alpaca (free IEX feed), Finnhub (free tier), Polygon.io (paid, full SIP)'],
      ['Prediction markets', '<span class="badge b-sample">Sample</span>', 'Sample markets priced by a local LMSR market maker; background flow simulated. 15-minute BTC Up/Down rounds take their start and end price from live Binance data only; a round without a Binance end price is voided and refunded', 'Own matching engine + resolution oracle; read-only reference data from the Polymarket and Kalshi public APIs'],
      ['Trading sessions', '<span class="badge b-daily">Rules</span>', 'Weekly exchange hours per market, evaluated in New York / Chicago / London / Frankfurt time (daylight-saving changes included); holidays not modeled', 'Exchange calendars (CME, ICE, NYSE) including holidays and early closes']
    ];
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Data sources</div><p class="fine">What drives each asset class in this demo right now, and what the full build would connect. Badges update live; if a source fails, its assets switch to sample data automatically.</p>' +
      '<div class="table-scroll"><table class="tbl ds"><thead><tr><th>Asset class</th><th>Status</th><th>In this demo</th><th>Full build options</th></tr></thead><tbody>' +
      rws.map(function (r) { return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('') +
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
      '<span>' + dot(fx.state === 'daily' ? true : fx.state === 'fallback' ? false : null) + fTxt + '</span>' +
      (tab.leader ? '' : '<span id="tabNote" title="This demo is also open in another tab or window. That tab saves the account; this one mirrors it and takes over as soon as you use it.">' + dot(null) + 'Synced with another open tab</span>');
  }

  /* ---------------- clock ---------------- */
  var etFmt = null;
  function renderClock() {
    try { etFmt = etFmt || new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); } catch (e) { return; }
    var d = new Date();
    $('clock').textContent = 'New York ' + etFmt.format(d) + ' · UTC ' + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
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
  var views = {};   // registered page modules: { render(), init() }
  var frameN = 0;
  function frame() {
    frameN++;
    if (refreshPending && !pointerBusy()) refreshAll();
    if (!S.pm && tab.leader && frameN % 5 === 0 && pmReady()) { P.ensure(pmPx); P.renderAll(); save(); }
    if (S.ui.view === 'trade' || !S.ui.view) {
      Object.keys(dirty.rows).forEach(function (id) { updRow(D.BY_ID[id]); });
      dirty.rows = {};
      if (dirty.head || frameN % 10 === 0) { renderHead(); updTicket(); dirty.head = false; }
      var busy = pointerBusy();
      if (dirty.movers && !busy) { renderMovers(); dirty.movers = false; }
      if (!busy && (dirty.act || (S.ui.act || 'pos') === 'pos' && S.positions.length)) renderActivity();
      if (frameN % 25 === 0) { var a = D.BY_ID[S.ui.asset]; if (!sess(a).open) renderBook(); }
    } else {
      var v = views[S.ui.view];
      if (v && v.tick && !pointerBusy()) v.tick();
    }
    renderAccount();
    if (frameN % 5 === 0) renderClock();
  }
  setInterval(frame, 400);

  /* ---------------- views ---------------- */
  var VIEW_EL = { trade: 'viewTrade', predict: 'viewPredict', cmd: 'viewCmd', account: 'viewAccount', admin: 'viewAdmin', build: 'viewBuild' };
  function setView(v) {
    if (!VIEW_EL[v]) v = 'trade';
    var was = S.ui.view;
    S.ui.view = v;
    closePop();
    document.querySelectorAll('.nav-btn').forEach(function (b) { var on = b.dataset.view === v; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    Object.keys(VIEW_EL).forEach(function (k) { $(VIEW_EL[k]).classList.toggle('is-active', k === v); });
    if (v === 'predict') { if (S.pm || pmReady()) P.ensure(pmPx); P.renderAll(); }
    if (v === 'trade' && was && was !== 'trade') { buildWatch(); renderHead(); renderActivity(); updTicket(); setTimeout(function () { if (chart) fitChart(); }, 30); }
    if (views[v] && views[v].render) views[v].render();
    var nb = document.querySelector('.nav-btn[data-view="' + v + '"]');
    if (nb && nb.scrollIntoView && window.innerWidth < 1100) try { nb.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    save();
  }

  function resetDemo() {
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Reset demo?</div><p class="fine">Restores the 100,000 USD paper balance and clears all positions, orders, prediction shares, alerts, admin changes and history. Sample prediction markets are re-created.</p>' +
      '<div class="lf-btns"><button class="btn-ghost" id="rsNo">Cancel</button><button class="btn-submit short" id="rsYes">Reset demo</button></div></div>');
    $('rsNo').onclick = closeModal;
    $('rsYes').onclick = function () {
      claim();
      var ui = S.ui; var keep = { asset: ui.asset, tf: ui.tf, cat: ui.cat, sub: ui.sub, view: ui.view, ct: ui.ct, vol: ui.vol };
      var n = fresh(); Object.keys(n).forEach(function (k) { S[k] = n[k]; });
      Object.keys(keep).forEach(function (k) { if (keep[k] != null) S.ui[k] = keep[k]; });
      applyAdminCfg();
      P.setState(S);
      if (pmReady()) P.ensure(pmPx);
      closeModal(); save(true);
      buildWatch(); setupTicketForAsset(); renderHead(); renderStar(); drawPriceLines(); renderActivity(); renderAccount(); P.renderAll(); updTicket(); renderBell();
      if (views[S.ui.view] && views[S.ui.view].render) views[S.ui.view].render();
      toast('Demo reset', 'Paper balance restored to $100,000.00', 'ok');
    };
  }

  /* ---------------- keyboard ---------------- */
  var gPending = 0;
  function onKey(e) {
    if (e.key === 'Escape') { if (!$('modal').hidden) { closeModal(); setMode('demo'); } else closePop(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (!$('modal').hidden) return;
    var k = e.key;
    if (k === '?') { e.preventDefault(); keysModal(); return; }
    if (gPending && Date.now() - gPending < 1200) {
      gPending = 0;
      var map = { t: 'trade', p: 'predict', c: 'cmd', a: 'account' };
      if (map[k.toLowerCase()]) { e.preventDefault(); setView(map[k.toLowerCase()]); }
      return;
    }
    if (k === 'g' || k === 'G') { gPending = Date.now(); return; }
    if (k === '/') { e.preventDefault(); if (S.ui.view !== 'trade') setView('trade'); var s = $('watchSearch'); s.focus(); s.select(); return; }
    if (S.ui.view !== 'trade') return;
    if (k === 'b' || k === 'B' || k === 's' || k === 'S') {
      e.preventDefault();
      var side = k.toLowerCase() === 'b' ? 'long' : 'short';
      tk.side = side;
      document.querySelectorAll('#sideTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.side === side); });
      updTicket();
      var m = $('inMargin'); m.focus(); m.select();
      return;
    }
    if (k === 'a' || k === 'A') { e.preventDefault(); alertModal(); return; }
    var tfs = ['1m', '5m', '15m', '1h', '4h', '1d'], n = +k;
    if (n >= 1 && n <= 6) { var b = document.querySelector('#tfTabs [data-tf="' + tfs[n - 1] + '"]'); if (b) b.click(); }
  }

  /* ---------------- wiring ---------------- */
  function bind() {
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.onclick = function () { setView(b.dataset.view); }; });
    $('catTabs').onclick = function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; S.ui.cat = b.dataset.cat; S.ui.sub = 'all'; $('watchSearch').value = ''; buildWatch(); save(); };
    $('subTabs').onclick = function (e) { var b = e.target.closest('[data-sub]'); if (!b) return; S.ui.sub = b.dataset.sub; buildWatch(); save(); };
    $('watchSearch').oninput = buildWatch;
    $('watchSearch').onkeydown = function (e) {
      if (e.key === 'Enter') { var f = $('watchList').querySelector('.wrow'); if (f) { selectAsset(f.dataset.id); $('watchSearch').blur(); } }
      if (e.key === 'Escape') { $('watchSearch').value = ''; buildWatch(); $('watchSearch').blur(); }
    };
    $('watchList').onclick = function (e) {
      var st = e.target.closest('[data-star]'); if (st) { toggleFav(st.dataset.star); return; }
      var r = e.target.closest('.wrow'); if (r) { selectAsset(r.dataset.id); if (window.innerWidth <= 900) scrollUnderBar($('chartwrap')); }
    };
    $('symStar').onclick = function () { toggleFav(S.ui.asset); };
    $('btnAlert').onclick = alertModal;
    $('movers').onclick = function (e) { var b = e.target.closest('[data-id]'); if (!b) return; S.ui.cat = 'cmd'; S.ui.sub = 'all'; buildWatch(); selectAsset(b.dataset.id); };
    $('tfTabs').onclick = function (e) {
      var b = e.target.closest('[data-tf]'); if (!b) return;
      S.ui.tf = b.dataset.tf;
      document.querySelectorAll('#tfTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      D.select(S.ui.asset, S.ui.tf); loadChart(); save();
    };
    $('ctTabs').onclick = function (e) {
      var b = e.target.closest('[data-ct]'); if (!b || !chart) return;
      if (S.ui.ct === b.dataset.ct) return;
      S.ui.ct = b.dataset.ct;
      document.querySelectorAll('#ctTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x === b); });
      makeMain(); loadChart(); save();
    };
    $('btnVol').onclick = function () {
      S.ui.vol = !(S.ui.vol !== false);
      $('btnVol').classList.toggle('is-on', S.ui.vol); $('btnVol').setAttribute('aria-pressed', S.ui.vol ? 'true' : 'false');
      if (vSeries) vSeries.applyOptions({ visible: S.ui.vol });
      save();
    };
    $('btnFit').onclick = function () { fitChart(); };
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
    $('btnCsv').onclick = function () { exportCsv(S.ui.act || 'pos'); };
    $('actBody').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.close) {
        var cp = S.positions.filter(function (x) { return x.id === b.dataset.close; })[0], ca = cp && D.BY_ID[cp.asset];
        if (ca && !sess(ca).open) { toast('Market closed · ' + ca.sym, 'Positions can be closed after the open (in ' + HR.untilText(sess(ca).next) + ').', 'warn'); return; }
        b.disabled = true;
        var r = closePosition(b.dataset.close, 'manual');
        if (r) { var a = D.BY_ID[r.pos.asset]; toast('Position closed · ' + a.sym, 'Exit ' + px(a, r.exit) + ' · realized ' + signed(r.st.realized), r.st.realized >= 0 ? 'ok' : 'bad'); }
        save(true); drawPriceLines(); renderActivity(); renderAccount(); updTicket();
      } else if (b.dataset.cancel) { cancelOrder(b.dataset.cancel); toast('Limit order canceled', 'Reserved margin returned', 'ok'); save(true); drawPriceLines(); renderActivity(); updTicket(); }
      else if (b.dataset.tpsl) editTpSl(b.dataset.tpsl);
      else if (b.dataset.addm) addMarginModal(b.dataset.addm);
      else if (b.dataset.delalert) { S.alerts = S.alerts.filter(function (x) { return x.id !== b.dataset.delalert; }); save(true); drawPriceLines(); renderActivity(); }
      else if (b.dataset.go) { selectAsset(b.dataset.go); }
    };
    $('btnCloseAll').onclick = function () {
      var tot = 0, n = 0;
      var skip = 0;
      S.positions.slice().forEach(function (p) { if (!sess(D.BY_ID[p.asset]).open) { skip++; return; } var r = closePosition(p.id, 'manual'); if (r) { tot += r.st.realized; n++; } });
      toast('Closed ' + n + ' positions' + (skip ? ' · ' + skip + ' left open (market closed)' : ''), 'Realized ' + signed(tot), tot >= 0 ? 'ok' : 'bad');
      save(true); drawPriceLines(); renderActivity(); renderAccount(); updTicket();
    };
    $('btnReset').onclick = resetDemo;
    $('btnSources').onclick = sourcesPanel;
    $('lnkSources').onclick = function (e) { e.preventDefault(); sourcesPanel(); };
    $('lnkKeys').onclick = keysModal;
    $('btnBell').onclick = bellPop;
    $('btnSettings').onclick = settingsPop;
    $('acctSel').onclick = acctPop;
    (function () {   // fade the right edge of the asset-class tabs only while more tabs are hidden
      var ct = $('catTabs'); function upd() { ct.classList.toggle('at-end', ct.scrollLeft + ct.clientWidth >= ct.scrollWidth - 2); }
      ct.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd); setTimeout(upd, 50);
    })();
    $('btnMkts').onclick = function () { scrollUnderBar(document.querySelector('.watch')); };
    $('sessBanner').onclick = function (e) { var b = e.target.closest('[data-sb]'); if (b) setHoursMode(b.dataset.sb === 'practice' ? 'always' : 'exchange'); };
    $('riskBanner').onclick = function (e) { var b = e.target.closest('[data-goview]'); if (b) setView(b.dataset.goview); };
    $('modeSwitch').onclick = function (e) { var b = e.target.closest('[data-mode]'); if (!b) return; if (b.dataset.mode === 'live') { setMode('live'); liveFlow(0); } else setMode('demo'); };
    $('modalX').onclick = function () { closeModal(); setMode('demo'); };
    $('modal').onclick = function (e) { if (e.target === $('modal')) { closeModal(); setMode('demo'); } };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', function (e) { if (popFor && !e.target.closest('#pop') && !popFor.contains(e.target)) closePop(); });
    window.addEventListener('resize', closePop);
  }

  /* ---------------- data events ---------------- */
  D.on('tick', function (id) {
    dirty.rows[id] = true;
    if (id === S.ui.asset) dirty.head = true;
    if (D.BY_ID[id].cat === 'cmd') dirty.movers = true;
    onPrice(id);
    checkAlerts(id);
  });
  D.on('candle', onCandle);
  D.on('book', onBook);
  D.on('trade', onTrade);
  D.on('status', function () { renderFeedStatus(); });
  function renderNetNotice() {
    var off = D.ASSETS.filter(function (a) { return a.state === 'fallback'; });
    var el = $('netNotice');
    el.hidden = !off.length;
    if (off.length) el.textContent = 'Some data sources are unreachable: ' + off.length + ' markets switched to sample data.';
  }
  D.on('source', function (a) {
    dirty.rows[a.id] = true; renderFeedStatus(); renderNetNotice();
    if (a.id === S.ui.asset) { renderHead(); $('chartNote').textContent = D.historyNote(a, S.ui.tf) + ' · UTC'; }   // badge right away, on any page
    if (a.state === 'fallback' && !srcWarned[a.feed]) {
      srcWarned[a.feed] = true;
      toast({ binance: 'Binance is unreachable', goldapi: 'Metals price source is unreachable', fx: 'FX rate source is unreachable' }[a.feed] || 'Data source unreachable',
        'Affected markets now show sample data and are labeled "Sample · offline". Trading keeps working.', 'warn');
    }
  });
  var srcWarned = {};
  D.on('reload', function (id) { if (id === S.ui.asset) { loadChart(); setupTicketForAsset(); updTicket(); } });

  /* ---------------- boot ---------------- */
  /* prediction strikes (BTC / ETH / gold) need real prices: wait until the sources answered (live or
     offline), at most 20 s after the start */
  var bootAt = Date.now();
  function pmPx(id) { return D.tick[id] ? D.tick[id].price : 0; }
  function pmReady() {
    return ['BTC', 'ETH', 'XAUUSD'].every(function (id) { return D.tick[id] && D.BY_ID[id].state !== 'pending'; }) || Date.now() - bootAt > 20000;
  }
  function boot() {
    applyAdminCfg();
    document.body.classList.toggle('no-flash', !prefs.flash);
    bind();
    tabsStart();
    P.init(S, {
      usd: usd, signed: signed, toast: toast, modal: modal, closeModal: closeModal,
      canWrite: function () { return tab.leader; }, claim: claim, persist: function () { save(true); },
      chartOptions: function () { var o = chartOptions(); o.timeScale.secondsVisible = false; return o; },
      changed: function (important) { save(!!important); renderAccount(); P.renderSide(); }
    });
    initChart();
    document.querySelectorAll('#ctTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.ct === S.ui.ct); });
    $('btnVol').classList.toggle('is-on', S.ui.vol !== false); $('btnVol').setAttribute('aria-pressed', S.ui.vol !== false ? 'true' : 'false');
    D.select(S.ui.asset, S.ui.tf);
    if (storageOk) { try { D.restore(JSON.parse(window.localStorage.getItem(SIM_KEY) || 'null')); } catch (e) {} }
    D.start();
    document.querySelectorAll('#tfTabs .seg-btn').forEach(function (x) { x.classList.toggle('is-active', x.dataset.tf === S.ui.tf); });
    buildWatch(); renderMovers(); renderFeedStatus(); renderClock(); renderBell();
    selectAsset(S.ui.asset);
    setAct(S.ui.act || 'pos');
    Object.keys(views).forEach(function (k) { if (views[k].init) views[k].init(); });
    // a link such as index.html#predict (from the home pages) opens that view
    var hashView = (window.location.hash || '').slice(1);
    setView(VIEW_EL[hashView] ? hashView : (VIEW_EL[S.ui.view] ? S.ui.view : 'trade'));
    window.addEventListener('hashchange', function () { var h = (window.location.hash || '').slice(1); if (VIEW_EL[h]) setView(h); });
    // prediction markets need live BTC/ETH/gold prices for their strikes: build them once prices arrive
    var pmTimer = setInterval(function () {
      if (pmReady() || S.pm) {
        clearInterval(pmTimer);
        P.ensure(pmPx);
        P.renderAll(); save();
      }
    }, 500);
    renderAccount();
    if (!storageOk) storageNotice();
    if (loadNote === 'corrupt') toast('Saved demo data could not be read', 'It was kept as a backup copy in this browser and a fresh paper account was started. Saving works normally.', 'warn');
    else if (loadNote === 'repaired') toast('Saved demo data was repaired', 'Some saved entries could not be read and were reset; a copy of the original was kept in this browser.', 'warn');
    try { window.localStorage.setItem('vx-probe', '1'); window.localStorage.removeItem('vx-probe'); } catch (e) { if (storageOk) { storageOk = false; storageNotice(); } }
    if (/[?&]selftest\b/.test(location.search)) showSelfTest();
  }

  function showSelfTest() {
    var r = window.VXRunTests(true);
    modal('<div class="pt"><div class="pt-q" id="modalTitle">Engine self-test · ' + r.passed + '/' + r.total + ' passed</div><div class="table-scroll"><table class="tbl"><thead><tr><th></th><th>Check</th><th>Expected</th><th>Actual</th></tr></thead><tbody>' +
      r.results.map(function (x) { return '<tr><td class="' + (x.pass ? 'up' : 'down') + '">' + (x.pass ? '✓' : '✗') + '</td><td>' + esc(x.name) + '</td><td class="mono">' + esc(String(x.expected)) + '</td><td class="mono">' + esc(typeof x.actual === 'number' ? (+x.actual.toFixed(8)).toString() : String(x.actual)) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>', true);
  }

  /* ---------------- shared API for page modules ---------------- */
  window.VXApp = {
    S: function () { return S; }, D: D, E: E, P: P, HR: HR,
    nf: nf, usd: usd, signed: signed, px: px, pct: pct, esc: esc, compact: compact, timeFmt: timeFmt, hms: hms, qtyFmt: qtyFmt,
    mid: mid, quote: quote, markFor: markFor, markPos: markPos, cls: cls, sess: sess, sessText: sessText, profileCap: profileCap, adm: adm, applyAdminCfg: applyAdminCfg, claim: claim,
    equity: equity, upnlAll: upnlAll, marginAll: marginAll, reservedAll: reservedAll, marginLevel: marginLevel, marginRatio: marginRatio, journal: journal,
    toast: toast, notify: notify, modal: modal, closeModal: closeModal, save: save, pointerBusy: pointerBusy, emptySt: emptySt,
    selectAsset: selectAsset, setView: setView, exportCsv: exportCsv, download: download, csv: csv,
    afterAdminChange: function () { applyAdminCfg(); sessCache = {}; setupTicketForAsset(); renderHead(); updTicket(); buildWatch(); },
    register: function (name, mod) { views[name] = mod; }
  };

  // test hooks (used by the automated browser check; harmless for visitors)
  window.VX = { state: function () { return S; }, placeOrder: placeOrder, closePosition: closePosition, cancelOrder: cancelOrder, onPrice: onPrice,
                selectAsset: selectAsset, quote: function (id) { return quote(D.BY_ID[id]); }, equity: equity, data: D, predict: P, save: save,
                addAlert: addAlert, checkAlerts: checkAlerts, addMargin: addMargin, exportCsv: exportCsv, cls: function (id) { return cls(D.BY_ID[id]); },
                marginLevel: marginLevel, marginRatio: marginRatio, setHoursMode: setHoursMode, hours: HR, prefs: function () { return prefs; },
                setClock: function (ms) { HR.setClock(ms); sessCache = {}; buildWatch(); renderHead(); updTicket(); renderBook(); renderActivity(); },
                setPrefs: function (o) { Object.keys(o).forEach(function (k) { prefs[k] = o[k]; }); savePrefs(); }, setView: setView, journal: journal,
                markPos: function (id) { var p = S.positions.filter(function (x) { return x.id === id; })[0]; return p ? markPos(p) : null; },
                tab: function () { return { id: TAB_ID, leader: tab.leader, storageOk: storageOk, loadNote: loadNote }; }, claim: claim };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
