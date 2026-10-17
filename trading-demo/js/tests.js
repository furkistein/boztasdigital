/* Demo Exchange — engine self-test.
 * Browser: open the page with ?selftest, or run VXRunTests() in the console.
 * Node:    node js/tests.js
 * Expected values are worked out by hand (formula in the comment), not taken from the engine.
 */
(function (root) {
  'use strict';
  var E = root.VXEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);

  function near(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-6 : eps); }

  function run() {
    var out = [];
    function t(name, actual, expected, eps) { out.push({ name: name, expected: expected, actual: actual, pass: near(actual, expected, eps) }); }
    function ok(name, cond) { out.push({ name: name, expected: true, actual: !!cond, pass: !!cond }); }

    /* ---- liquidation, linear ---- */
    // long 10x @60,000, mmr 0.5%: 60000*(1-0.1+0.005) = 54,300
    t('liq long 10x @60,000', E.liquidationPrice('long', 60000, 10), 54300);
    // short 10x @60,000: 60000*(1+0.1-0.005) = 65,700
    t('liq short 10x @60,000', E.liquidationPrice('short', 60000, 10), 65700, 1e-6);
    // gold long 20x @4,181.10: 4181.10*(1-0.05+0.005) = 3,992.95050
    t('liq long 20x gold @4,181.10', E.liquidationPrice('long', 4181.10, 20), 3992.9505, 1e-6);
    // EUR/USD long 100x @1.1242: 1.1242*(1-0.01+0.005) = 1.118579
    t('liq long 100x EUR/USD @1.1242', E.liquidationPrice('long', 1.1242, 100), 1.118579, 1e-9);
    // stock short 5x @343.46: 343.46*(1+0.2-0.005) = 410.43470
    t('liq short 5x AAPL @343.46', E.liquidationPrice('short', 343.46, 5), 410.4347, 1e-6);
    // margin + PnL at the liquidation price == maintenance margin (0.5% of 60,000 = 300)
    t('equity at liq = maintenance margin', 6000 + E.unrealizedPnl({ side: 'long', qty: 1, entry: 60000 }, 54300), 300);

    /* ---- liquidation, inverse (USD/JPY) ---- */
    // long 100x @158: 158/(1+0.01-0.005) = 157.213930
    t('liq long 100x USD/JPY @158 (inverse)', E.liquidationPrice('long', 158, 100, 'inverse'), 157.2139303, 1e-6);
    // short 100x @158: 158/(1-0.01+0.005) = 158.793970
    t('liq short 100x USD/JPY @158 (inverse)', E.liquidationPrice('short', 158, 100, 'inverse'), 158.7939698, 1e-6);
    // $10,000 long, PnL at liq = 10000*(157.21393-158)/157.21393 = -50 -> equity 100-50 = 50 = 0.5% of 10,000
    var inv = { side: 'long', qty: 10000, entry: 158, kind: 'inverse' };
    t('inverse PnL at liq = -50 USD', E.unrealizedPnl(inv, 158 / 1.005), -50, 1e-6);

    /* ---- order preview ---- */
    // margin 1,000 x20 @2,000, taker 0.05%: notional 20,000, qty 10, fee 10, cost 1,010
    var pv = E.previewOrder({ side: 'long', price: 2000, margin: 1000, leverage: 20, feeRate: 0.0005 });
    t('preview notional', pv.notional, 20000);
    t('preview qty', pv.qty, 10);
    t('preview fee 0.05%', pv.fee, 10);
    t('preview total cost', pv.cost, 1010);
    // USD/JPY inverse: margin 500 x100 -> qty = notional = 50,000 USD, fee 0.002% = 1
    var pvi = E.previewOrder({ side: 'short', price: 158, margin: 500, leverage: 100, kind: 'inverse', feeRate: 0.00002 });
    t('inverse preview qty = USD notional', pvi.qty, 50000);
    t('inverse preview fee', pvi.fee, 1, 1e-9);

    /* ---- PnL ---- */
    var L = { side: 'long', qty: 10, entry: 2000, margin: 1000 };
    t('uPnL long +5% = 1,000', E.unrealizedPnl(L, 2100), 1000);
    t('ROE long = 100%', E.roe(L, 2100), 1);
    t('uPnL short 0.5 @60,000 -> 58,000 = +1,000', E.unrealizedPnl({ side: 'short', qty: 0.5, entry: 60000 }, 58000), 1000);
    t('uPnL short losing = -500', E.unrealizedPnl({ side: 'short', qty: 0.5, entry: 60000 }, 61000), -500);
    // inverse short $50,000 @158 -> 157: 50000*(158-157)/157 = 318.4713
    t('uPnL inverse short USD/JPY', E.unrealizedPnl({ side: 'short', qty: 50000, entry: 158, kind: 'inverse' }, 157), 318.4713376, 1e-6);

    /* ---- close ---- */
    // close long 10 @2,100: pnl 1,000, fee 21,000*0.05% = 10.5, credit 1,989.5, realized 989.5
    var cs = E.closeSettlement(L, 2100, 0.0005);
    t('close fee', cs.fee, 10.5);
    t('close credit', cs.credit, 1989.5);
    t('close realized', cs.realized, 989.5);
    // loss beyond margin is capped (isolated)
    t('loss capped at margin', E.closeSettlement(L, 1800, 0.0005).credit, 0);

    /* ---- triggers ---- */
    var pl = { side: 'long', liq: 54300, tp: 66000, sl: 57000 };
    ok('long liquidated at 54,300', E.isLiquidated(pl, 54300));
    ok('long not liquidated at 54,301', !E.isLiquidated(pl, 54301));
    ok('long TP hit at 66,000', E.tpslHit(pl, 66000) === 'tp');
    ok('long SL hit at 56,999', E.tpslHit(pl, 56999) === 'sl');
    ok('short TP hit below', E.tpslHit({ side: 'short', tp: 55000, sl: 62000 }, 54990) === 'tp');
    ok('short SL hit above', E.tpslHit({ side: 'short', tp: 55000, sl: 62000 }, 62000) === 'sl');
    ok('buy limit fills when ask <= limit', E.limitTriggered({ side: 'long', price: 59000 }, 58998, 59000));
    ok('sell limit waits while bid < limit', !E.limitTriggered({ side: 'short', price: 61000 }, 60999, 61001));
    ok('SL beyond liquidation rejected', E.validateTpSl('long', 60000, 54300, null, 54000) !== '');
    ok('long TP below entry rejected', E.validateTpSl('long', 60000, 54300, 59000, null) !== '');
    ok('valid TP/SL accepted', E.validateTpSl('short', 60000, 65700, 55000, 62000) === '');

    /* ---- LMSR binary (n = 2), b = 100, q = [0, 0] ---- */
    var q2 = [0, 0];
    t('binary start price 50¢', E.lmsrPrices(q2, 100)[0], 0.5);
    // 100 YES: 100*ln((e^1 + 1)/2) = 62.011451
    t('binary cost of 100 YES', E.lmsrBuyCost(q2, 100, 0, 'yes', 100), 62.011451, 1e-5);
    // price after: e/(e+1) = 0.731059
    t('binary price after 100 YES', E.sidePrice([100, 0], 100, 0, 'yes'), 0.731059, 1e-6);
    t('binary NO cost (symmetric) = 62.011451', E.lmsrBuyCost(q2, 100, 0, 'no', 100), 62.011451, 1e-5);
    t('spend 62.011451 -> 100 YES shares', E.lmsrSharesForSpend(q2, 100, 0, 'yes', 62.011451), 100, 1e-4);
    t('spend 62.011451 -> 100 NO shares', E.lmsrSharesForSpend(q2, 100, 0, 'no', 62.011451), 100, 1e-4);
    t('sell 100 YES returns 62.011451', E.lmsrSellProceeds([100, 0], 100, 0, 'yes', 100), 62.011451, 1e-5);

    /* ---- LMSR multi-outcome (n = 4), b = 100 ---- */
    var q4 = [0, 0, 0, 0];
    t('4-way start price 25¢', E.lmsrPrices(q4, 100)[2], 0.25);
    // 100 YES on outcome 0: 100*ln((e + 3)/4) = 35.737402
    t('4-way cost of 100 YES', E.lmsrBuyCost(q4, 100, 0, 'yes', 100), 35.737402, 1e-5);
    // new price e/(e+3) = 0.475367
    t('4-way price after', E.lmsrPrices([100, 0, 0, 0], 100)[0], 0.475367, 1e-6);
    var pr = E.lmsrPrices([120, -40, 300, 10], 100);
    t('prices sum to 1', pr[0] + pr[1] + pr[2] + pr[3], 1, 1e-12);
    // NO bundle identity: cost(NO_i, x) = x - sellProceeds(YES_i, x)
    var qa = [120, -40, 300, 10];
    t('NO_i cost = x - YES_i sell proceeds', E.lmsrBuyCost(qa, 100, 1, 'no', 50), 50 - E.lmsrSellProceeds(qa, 100, 1, 'yes', 50), 1e-9);
    t('spend -> NO shares inverse (n=4)', E.lmsrSharesForSpend(qa, 100, 1, 'no', E.lmsrBuyCost(qa, 100, 1, 'no', 37)), 37, 1e-6);
    var ini = E.lmsrInit([0.1, 0.2, 0.3, 0.4], 5000);
    t('init reproduces 30%', E.lmsrPrices(ini, 5000)[2], 0.3, 1e-9);
    t('max market-maker loss b ln n (n=4, b=100)', E.lmsrMaxLoss(100, 4), 138.629436, 1e-5);
    // limit: buying YES to a 73.1059¢ cap from 50/50 allows ~100 shares
    t('shares up to limit price', E.lmsrSharesToLimit(q2, 100, 0, 'yes', 'buy', 0.7310586, 1000), 100, 1e-3);

    /* ---- payouts ---- */
    t('YES on winner pays $1/share', E.payout(2, 'yes', 40, 2), 40);
    t('YES on loser pays 0', E.payout(2, 'yes', 40, 1), 0);
    t('NO on loser outcome pays $1/share', E.payout(2, 'no', 40, 1), 40);
    t('NO on winner pays 0', E.payout(2, 'no', 40, 2), 0);

    return out;
  }

  root.VXRunTests = function (silent) {
    var r = run();
    var passed = r.filter(function (x) { return x.pass; }).length;
    if (!silent && typeof console !== 'undefined') console.log('[selftest] ' + passed + '/' + r.length + ' passed');
    return { passed: passed, total: r.length, results: r };
  };

  if (typeof module !== 'undefined' && typeof require !== 'undefined' && require.main === module) {
    var res = root.VXRunTests(true);
    res.results.forEach(function (x) { console.log((x.pass ? 'PASS ' : 'FAIL ') + x.name + '  expected=' + x.expected + '  actual=' + x.actual); });
    console.log(res.passed + '/' + res.total + ' passed');
    process.exit(res.passed === res.total ? 0 : 1);
  }
})(typeof window !== 'undefined' ? window : globalThis);
