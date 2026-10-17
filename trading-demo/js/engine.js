/* Demo Exchange — pure calculation engine. No DOM, no network.
 * Used by the UI and by the self-test (tests.js).
 *
 * LEVERAGED POSITIONS — isolated margin, USD settlement.
 *   kind 'linear'  (crypto, metals, energy, agriculture, indices, stocks, EUR/USD-type pairs):
 *       qty in base units, notional = qty * price, PnL = side * qty * (mark - entry)
 *       liq long  = entry * (1 - 1/L + mmr)        liq short = entry * (1 + 1/L - mmr)
 *   kind 'inverse' (USD/JPY-type pairs: base currency is USD, quote is not):
 *       qty = notional in USD, PnL(USD) = side * qty * (mark - entry) / mark
 *       liq long  = entry / (1 + 1/L - mmr)        liq short = entry / (1 - 1/L + mmr)
 *   Both: initial margin = notional / L, fee = notional * feeRate, a position is liquidated
 *   when margin + PnL falls to the maintenance margin (notional * mmr). Loss is capped at margin.
 *
 * PREDICTION MARKETS — LMSR (Hanson), n mutually exclusive outcomes, liquidity b.
 *   C(q) = b * ln(sum_j e^(q_j / b)),  p_i = e^(q_i/b) / sum_j e^(q_j/b)  (prices sum to 1)
 *   YES on outcome i = 1 share of i (pays $1 if i wins).
 *   NO  on outcome i = 1 share of every other outcome (pays $1 if i loses), price = 1 - p_i.
 *   A binary market is the n = 2 case.
 */
(function (root) {
  'use strict';

  var MMR = 0.005; // maintenance margin rate 0.5% (must stay below 1 / max leverage = 1%)

  function sgn(side) { return side === 'long' ? 1 : -1; }

  function liquidationPrice(side, entry, L, kind, mmr) {
    if (mmr == null) mmr = MMR;
    if (kind === 'inverse') {
      return side === 'long' ? entry / (1 + 1 / L - mmr) : entry / Math.max(1e-9, 1 - 1 / L + mmr);
    }
    return side === 'long' ? Math.max(0, entry * (1 - 1 / L + mmr)) : entry * (1 + 1 / L - mmr);
  }

  function notionalOf(kind, qty, px) { return kind === 'inverse' ? qty : qty * px; }

  /* o: { side, price, margin, leverage, kind, feeRate } */
  function previewOrder(o) {
    var notional = o.margin * o.leverage;
    var qty = o.kind === 'inverse' ? notional : (o.price > 0 ? notional / o.price : 0);
    var fee = notional * o.feeRate;
    return { notional: notional, qty: qty, margin: o.margin, fee: fee, cost: o.margin + fee,
             liq: liquidationPrice(o.side, o.price, o.leverage, o.kind) };
  }

  function unrealizedPnl(pos, mark) {
    var d = sgn(pos.side) * pos.qty * (mark - pos.entry);
    return pos.kind === 'inverse' ? d / mark : d;
  }

  function roe(pos, mark) { return pos.margin > 0 ? unrealizedPnl(pos, mark) / pos.margin : 0; }

  /* closing at px with feeRate: what goes back to the free balance */
  function closeSettlement(pos, px, feeRate) {
    var pnl = unrealizedPnl(pos, px);
    var fee = notionalOf(pos.kind, pos.qty, px) * feeRate;
    var credit = pos.margin + pnl - fee;
    if (credit < 0) credit = 0;               // isolated: never lose more than the margin
    return { pnl: pnl, fee: fee, credit: credit, realized: credit - pos.margin };
  }

  function isLiquidated(pos, mark) { return pos.side === 'long' ? mark <= pos.liq : mark >= pos.liq; }

  function tpslHit(pos, mark) {
    if (pos.side === 'long') {
      if (pos.tp && mark >= pos.tp) return 'tp';
      if (pos.sl && mark <= pos.sl) return 'sl';
    } else {
      if (pos.tp && mark <= pos.tp) return 'tp';
      if (pos.sl && mark >= pos.sl) return 'sl';
    }
    return null;
  }

  function validateTpSl(side, entry, liq, tp, sl) {
    if (tp != null && !(tp > 0)) return 'Take profit must be a positive price.';
    if (sl != null && !(sl > 0)) return 'Stop loss must be a positive price.';
    if (side === 'long') {
      if (tp && tp <= entry) return 'Take profit must be above the entry price for a long.';
      if (sl && sl >= entry) return 'Stop loss must be below the entry price for a long.';
      if (sl && sl <= liq) return 'Stop loss is beyond the liquidation price.';
    } else {
      if (tp && tp >= entry) return 'Take profit must be below the entry price for a short.';
      if (sl && sl <= entry) return 'Stop loss must be above the entry price for a short.';
      if (sl && sl >= liq) return 'Stop loss is beyond the liquidation price.';
    }
    return '';
  }

  /* long (buy) limit fills when the ask reaches the limit, short (sell) limit when the bid does */
  function limitTriggered(order, bid, ask) { return order.side === 'long' ? ask <= order.price : bid >= order.price; }
  /* fill price of a triggered limit order: the limit or better. If the market gapped through the limit
     (e.g. the ask opens below a buy limit), the order fills at the better market price. */
  function limitFillPrice(order, bid, ask) { return order.side === 'long' ? Math.min(order.price, ask) : Math.max(order.price, bid); }

  /* ---------------- LMSR (n outcomes) ---------------- */
  function lmsrCost(q, b) {
    var m = -Infinity, i, s = 0;
    for (i = 0; i < q.length; i++) m = Math.max(m, q[i] / b);
    for (i = 0; i < q.length; i++) s += Math.exp(q[i] / b - m);
    return b * (m + Math.log(s));
  }
  function lmsrPrices(q, b) {
    var m = -Infinity, i, s = 0, e = [];
    for (i = 0; i < q.length; i++) m = Math.max(m, q[i] / b);
    for (i = 0; i < q.length; i++) { e[i] = Math.exp(q[i] / b - m); s += e[i]; }
    return e.map(function (x) { return x / s; });
  }
  function lmsrInit(probs, b) {
    var tot = probs.reduce(function (a, x) { return a + x; }, 0);
    return probs.map(function (p) { return b * Math.log(Math.max(1e-4, p / tot)); });
  }
  function addVec(q, i, side, x) {
    return q.map(function (v, j) { return side === 'yes' ? (j === i ? v + x : v) : (j === i ? v : v + x); });
  }
  /* side price: YES_i = p_i, NO_i = 1 - p_i */
  function sidePrice(q, b, i, side) { var p = lmsrPrices(q, b)[i]; return side === 'yes' ? p : 1 - p; }
  function lmsrBuyCost(q, b, i, side, x) { return lmsrCost(addVec(q, i, side, x), b) - lmsrCost(q, b); }
  function lmsrSellProceeds(q, b, i, side, x) { return lmsrCost(q, b) - lmsrCost(addVec(q, i, side, -x), b); }
  /* shares received for spending s (closed form, computed relative to K = C(q)/b) */
  function lmsrSharesForSpend(q, b, i, side, s) {
    if (!(s > 0)) return 0;
    var K = lmsrCost(q, b) / b, ei = Math.exp(q[i] / b - K), R = 0;
    for (var j = 0; j < q.length; j++) if (j !== i) R += Math.exp(q[j] / b - K);
    var ems = Math.exp(-s / b);   // log-space form, no overflow for large s
    if (side === 'yes') return s + b * Math.log(1 - R * ems) - (q[i] - b * K);   // e^((q_i+x)/b-K) = e^(s/b) - R
    return s + b * Math.log(1 - ei * ems) - b * Math.log(R);                       // e^(-x/b) = R / (e^(s/b) - e_i)
  }
  /* largest x (<= cap) such that the side price after buying (dir 'buy') stays <= limit,
     or after selling (dir 'sell') stays >= limit. Bisection, monotone in x. */
  function lmsrSharesToLimit(q, b, i, side, dir, limit, cap) {
    function after(x) { return sidePrice(addVec(q, i, side, dir === 'buy' ? x : -x), b, i, side); }
    var ok = function (x) { return dir === 'buy' ? after(x) <= limit + 1e-12 : after(x) >= limit - 1e-12; };
    if (!ok(0)) return 0;
    if (ok(cap)) return cap;
    var lo = 0, hi = cap;
    for (var k = 0; k < 60; k++) { var mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
    return lo;
  }
  /* worst-case market-maker loss. With n equally likely outcomes this is b*ln(n); a market that starts at
     unequal odds p0 can lose b*ln(1 / min p0_i) (traders pile into the outcome the maker priced lowest).
     Pass the starting probabilities (array) or n (number). The 1e-4 floor of lmsrInit is applied. */
  function lmsrMaxLoss(b, p0) {
    if (Array.isArray(p0) && p0.length) {
      var pr = lmsrPrices(lmsrInit(p0, b), b), lo = 1;
      for (var i = 0; i < pr.length; i++) lo = Math.min(lo, pr[i]);
      return b * Math.log(1 / lo);
    }
    return b * Math.log(p0 || 2);
  }
  /* payout of a holding when outcome w wins */
  function payout(i, side, shares, w) { return (side === 'yes' ? i === w : i !== w) ? shares : 0; }

  var api = {
    MMR: MMR,
    liquidationPrice: liquidationPrice, notionalOf: notionalOf, previewOrder: previewOrder,
    unrealizedPnl: unrealizedPnl, roe: roe, closeSettlement: closeSettlement, isLiquidated: isLiquidated,
    tpslHit: tpslHit, validateTpSl: validateTpSl, limitTriggered: limitTriggered, limitFillPrice: limitFillPrice,
    lmsrCost: lmsrCost, lmsrPrices: lmsrPrices, lmsrInit: lmsrInit, addVec: addVec, sidePrice: sidePrice,
    lmsrBuyCost: lmsrBuyCost, lmsrSellProceeds: lmsrSellProceeds, lmsrSharesForSpend: lmsrSharesForSpend,
    lmsrSharesToLimit: lmsrSharesToLimit, lmsrMaxLoss: lmsrMaxLoss, payout: payout
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VXEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
