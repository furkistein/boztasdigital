/* Demo Exchange - trading sessions.
 * Weekly session windows for every market, evaluated in the exchange's own time zone with the
 * browser's Intl API (US and European daylight-saving changes are handled, also for the "opens at"
 * time and the countdown: the next session start is converted from exchange wall-clock time to UTC
 * with the zone offset of that future moment). Exchange holidays are not modelled.
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

  var ET = 'America/New_York', CT = 'America/Chicago', LON = 'Europe/London', FRA = 'Europe/Berlin';
  var SCHED = {
    always:  { tz: null, label: '24/7', windows: null },
    cme:     { tz: ET, label: 'Sun-Fri 18:00-17:00 ET, 60-min daily break', windows: overnight(18, 0, 17, 0) },
    // ICE Futures Europe Brent: 01:00-23:00 London time (the week opens Monday 01:00 London = Sunday evening in New York)
    iceBrent:{ tz: LON, label: 'Mon-Fri 01:00-23:00 London (ICE Europe), 2-hour daily break', windows: dayWindows(1, 0, 23, 0) },
    cbot:    { tz: CT, label: 'Sun-Fri 19:00-07:45 CT and Mon-Fri 08:30-13:20 CT', windows: overnight(19, 0, 7, 45).concat(dayWindows(8, 30, 13, 20)) },
    coffee:  { tz: ET, label: 'Mon-Fri 04:15-13:30 ET', windows: dayWindows(4, 15, 13, 30) },
    sugar:   { tz: ET, label: 'Mon-Fri 03:30-13:00 ET', windows: dayWindows(3, 30, 13, 0) },
    cocoa:   { tz: ET, label: 'Mon-Fri 04:45-13:30 ET', windows: dayWindows(4, 45, 13, 30) },
    cotton:  { tz: ET, label: 'Sun-Fri 21:00-14:20 ET', windows: overnight(21, 0, 14, 20) },
    fx:      { tz: ET, label: 'Sun 17:00 - Fri 17:00 ET, continuous', windows: [[m(0, 17), m(5, 17)]] },
    usIdx:   { tz: ET, label: 'Sun-Fri 18:00-17:00 ET, 60-min daily break', windows: overnight(18, 0, 17, 0) },
    // European index CFDs follow European time (EU/UK and US clocks change on different dates)
    ger40:   { tz: FRA, label: 'Mon-Fri 08:00-22:00 Frankfurt time (index CFD)', windows: dayWindows(8, 0, 22, 0) },
    uk100:   { tz: LON, label: 'Mon-Fri 08:00-21:00 London (index CFD)', windows: dayWindows(8, 0, 21, 0) },
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
  /* wall-clock parts of the moment ms in time zone tz */
  function parts(tz, ms) {
    var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
    var o = {};
    f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { wd: WD[o.weekday], y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
  }
  function weekMinute(tz, ms) { var p = parts(tz, ms); return p.wd * DAY + p.h * 60 + p.mi; }
  /* the wall-clock time of ms in tz, written as if it were UTC (whole seconds) */
  function wallMs(tz, ms) { var p = parts(tz, ms); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s); }
  /* zone offset in minutes at the moment ms (e.g. -240 for EDT, -300 for EST) */
  function offsetMin(tz, ms) { return Math.round((wallMs(tz, ms) - Math.floor(ms / 1000) * 1000) / 60000); }
  /* UTC moment at which the wall clock in tz shows `wall` (wall-clock ms written as UTC).
     Fixed-point iteration on the offset: it converges in one or two steps, also across a DST change. */
  function wallToUtc(tz, wall) {
    var t = wall - offsetMin(tz, wall) * 60000;
    for (var k = 0; k < 3; k++) { var t2 = wall - offsetMin(tz, t) * 60000; if (t2 === t) break; t = t2; }
    return t;
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
    var pp = parts(s.tz, ms), wm = pp.wd * DAY + pp.h * 60 + pp.mi;
    var inWin = null;
    s.windows.forEach(function (w) { if (wm >= w[0] && wm < w[1]) inWin = w; });
    var nextMin;
    if (inWin) nextMin = inWin[1] - wm;
    else {
      nextMin = WEEK;
      s.windows.forEach(function (w) { var d = (w[0] - wm + WEEK) % WEEK; if (d > 0 && d < nextMin) nextMin = d; });
    }
    // next boundary in exchange wall-clock time, converted to UTC with the offset valid at that moment
    // (counting minutes from now would be one hour off when a DST change falls in between)
    var wallNow = Date.UTC(pp.y, pp.mo - 1, pp.d, pp.h, pp.mi);
    var next = wallToUtc(s.tz, wallNow + nextMin * 60000);
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

  var api = { status: status, setMode: setMode, getMode: getMode, setClock: setClock, now: now, untilText: untilText, schedFor: schedFor, weekMinute: weekMinute,
              offsetMin: offsetMin, wallToUtc: wallToUtc, SCHED: SCHED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VXHours = api;
})(typeof window !== 'undefined' ? window : globalThis);
