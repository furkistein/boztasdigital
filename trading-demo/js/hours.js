/* Demo Exchange - trading sessions.
 * Weekly session windows for every market, evaluated in the exchange's own time zone with the
 * browser's Intl API (so US daylight-saving changes are handled). Exchange holidays are not modelled.
 *
 * mode 'exchange' (default): markets follow their real weekly hours; outside them market orders
 *                            are blocked and limit orders wait in the queue.
 * mode 'always'            : "24/7 practice" - every market is treated as open (set in Settings).
 */
(function (root) {
  'use strict';

  var DAY = 1440, WEEK = 7 * DAY;
  function m(d, hh, mm) { return d * DAY + hh * 60 + (mm || 0); }
  /* repeat one overnight window for Sun..Thu (opens day d, closes day d+1) */
  function overnight(oh, om, ch, cm, days) {
    var out = []; (days || [0, 1, 2, 3, 4]).forEach(function (d) { out.push([m(d, oh, om), m(d + 1, ch, cm)]); }); return out;
  }
  function dayWindows(oh, om, ch, cm, days) {
    var out = []; (days || [1, 2, 3, 4, 5]).forEach(function (d) { out.push([m(d, oh, om), m(d, ch, cm)]); }); return out;
  }

  var ET = 'America/New_York', CT = 'America/Chicago';
  var SCHED = {
    always:  { tz: null, label: '24/7', windows: null },
    cme:     { tz: ET, label: 'Sun-Fri 18:00-17:00 ET, 60-min daily break', windows: overnight(18, 0, 17, 0) },
    iceBrent:{ tz: ET, label: 'Sun-Fri 20:00-18:00 ET, 2-hour daily break', windows: overnight(20, 0, 18, 0) },
    cbot:    { tz: CT, label: 'Sun-Fri 19:00-07:45 CT and Mon-Fri 08:30-13:20 CT', windows: overnight(19, 0, 7, 45).concat(dayWindows(8, 30, 13, 20)) },
    coffee:  { tz: ET, label: 'Mon-Fri 04:15-13:30 ET', windows: dayWindows(4, 15, 13, 30) },
    sugar:   { tz: ET, label: 'Mon-Fri 03:30-13:00 ET', windows: dayWindows(3, 30, 13, 0) },
    cocoa:   { tz: ET, label: 'Mon-Fri 04:45-13:30 ET', windows: dayWindows(4, 45, 13, 30) },
    cotton:  { tz: ET, label: 'Sun-Fri 21:00-14:20 ET', windows: overnight(21, 0, 14, 20) },
    fx:      { tz: ET, label: 'Sun 17:00 - Fri 17:00 ET, continuous', windows: [[m(0, 17), m(5, 17)]] },
    usIdx:   { tz: ET, label: 'Sun-Fri 18:00-17:00 ET, 60-min daily break', windows: overnight(18, 0, 17, 0) },
    ger40:   { tz: ET, label: 'Mon-Fri 02:00-16:00 ET', windows: dayWindows(2, 0, 16, 0) },
    uk100:   { tz: ET, label: 'Mon-Fri 03:00-16:00 ET', windows: dayWindows(3, 0, 16, 0) },
    usStock: { tz: ET, label: 'Mon-Fri 09:30-16:00 ET (regular session)', windows: dayWindows(9, 30, 16, 0) }
  };

  var BY_ASSET = {
    XAUUSD: 'cme', XAGUSD: 'cme', XPTUSD: 'cme', XPDUSD: 'cme', COPPER: 'cme', PAXG: 'always',
    BRENT: 'iceBrent', WTI: 'cme', NATGAS: 'cme',
    WHEAT: 'cbot', CORN: 'cbot', SOYBEAN: 'cbot', COFFEE: 'coffee', SUGAR: 'sugar', COCOA: 'cocoa', COTTON: 'cotton',
    EURUSD: 'fx', GBPUSD: 'fx', USDJPY: 'fx', USDTRY: 'fx', AUDUSD: 'fx', USDCHF: 'fx', USDCAD: 'fx',
    US500: 'usIdx', NAS100: 'usIdx', US30: 'usIdx', GER40: 'ger40', UK100: 'uk100'
  };
  function schedFor(id, cat) {
    if (BY_ASSET[id]) return SCHED[BY_ASSET[id]];
    if (cat === 'crypto') return SCHED.always;
    if (cat === 'stk') return SCHED.usStock;
    return SCHED.always;
  }

  var WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var fmtCache = {};
  function weekMinute(tz, ms) {
    var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }));
    var parts = f.formatToParts(new Date(ms)), o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    var h = +o.hour % 24;
    return WD[o.weekday] * DAY + h * 60 + (+o.minute);
  }

  var mode = 'exchange';
  /* test clock: lets the automated checks evaluate sessions at a chosen moment (it keeps ticking from there) */
  var clockBase = null, clockAt = 0;
  function setClock(ms) { clockBase = ms == null ? null : +ms; clockAt = Date.now(); }
  function now() { return clockBase == null ? Date.now() : clockBase + (Date.now() - clockAt); }
  function setMode(v) { mode = v === 'always' ? 'always' : 'exchange'; }
  function getMode() { return mode; }

  /* status of one market at time ms (default now) */
  function status(id, cat, ms) {
    if (ms == null) ms = now();
    var s = schedFor(id, cat);
    if (!s.windows) return { open: true, always: true, state: 'open', label: 'Open 24/7', next: null, sched: s.label };
    var wm = weekMinute(s.tz, ms), secs = new Date(ms).getUTCSeconds();
    var inWin = null;
    s.windows.forEach(function (w) { if (wm >= w[0] && wm < w[1]) inWin = w; });
    var nextMin;
    if (inWin) nextMin = inWin[1] - wm;
    else {
      nextMin = WEEK;
      s.windows.forEach(function (w) { var d = (w[0] - wm + WEEK) % WEEK; if (d > 0 && d < nextMin) nextMin = d; });
    }
    var next = ms + nextMin * 60000 - secs * 1000;
    var real = { open: !!inWin, always: false, next: next, sched: s.label };
    if (inWin) { real.state = 'open'; real.label = 'Open'; }
    else {
      var since = WEEK;   // minutes since the previous session ended
      s.windows.forEach(function (w) { var d = (wm - w[1] + WEEK) % WEEK; if (d < since) since = d; });
      real.state = since + nextMin <= 180 ? 'break' : 'closed';
      real.label = real.state === 'break' ? 'Daily break' : 'Market closed';
    }
    if (mode === 'always' && !real.open) {
      return { open: true, always: false, practice: true, state: 'practice', label: 'Practice 24/7', next: null, sched: s.label, real: real };
    }
    return real;
  }

  function untilText(ms, nowMs) {
    var d = Math.max(0, Math.round(((ms || 0) - (nowMs || now())) / 60000));
    var days = Math.floor(d / DAY), h = Math.floor((d % DAY) / 60), mi = d % 60;
    if (days) return days + 'd ' + h + 'h';
    if (h) return h + 'h ' + ('0' + mi).slice(-2) + 'm';
    return mi + 'm';
  }

  var api = { status: status, setMode: setMode, getMode: getMode, setClock: setClock, now: now, untilText: untilText, schedFor: schedFor, weekMinute: weekMinute, SCHED: SCHED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VXHours = api;
})(typeof window !== 'undefined' ? window : globalThis);
