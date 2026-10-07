// Entry systems for every chart timeframe. Shared by the chart tab (chartzones.js) and the recorder that logs
// every real signal (scripts/chart-run.js), so both use the same rules. Needs INTRA (and through it TA / SIG).
// Settings: the ones that tested best per timeframe (scratchpad research 7 Oct 2026, Binance PAXG, after a $0.4
// spread, 4 equal periods old → new, $/oz). A side whose test failed has no entries — its arrows only show
// direction. SL $15 × mult; TP1 $15 × mult (tp1) or TP $15/20/30 × mult. long = 5h/1d/1w: no session close,
// trades held up to `hold`.
(function (root) {
  const INTRA = root.INTRA || (typeof require === 'function' ? require('./intraday.js') : null);
  const M = 60e3, H = 60 * M, DAY = 24 * H;
  const SYS = {
    '5m': { frames: [['m5', 5 * M, 60, '5 นาที'], ['m30', 30 * M, 60, '30 นาที'], ['h1', H, 60, '1 ชม.']], span: '2 ปี',
      buy: { th: 5, tp1: true, mult: 1, win: 53, q: [312, 448, 99, -452] }, sell: { th: 6, tp1: false, mult: 0.67, win: 51, q: [22, 31, -18, 101] },
      every: -1480 }, // taking every small arrow one at a time, SL / TP1 $15
    '15m': { frames: INTRA.FRAMES15, span: '2 ปี', buy: { th: 6, tp1: true, mult: 1.5, win: 54, q: [254, 22, 16, 48] }, sellQ: [115, -233, -72, 204] },
    '30m': { frames: INTRA.FRAMES, span: '2 ปี', buy: { th: 5, tp1: true, mult: 1, win: 57, q: [264, 462, 239, -7] }, sellQ: [129, -174, -58, 113] },
    '1h': { frames: [['h1', H, 60, '1 ชม.'], ['h4', 4 * H, 60, '4 ชม.'], ['h5', 5 * H, 40, '5 ชม.']], span: '2 ปี',
      buy: { th: 5, tp1: false, mult: 2, win: 57, q: [188, 181, 348, 57] }, sellQ: [-62, 4, -112, 8] },
    '5h': { frames: [['h5', 5 * H, 60, '5 ชม.'], ['d1', DAY, 60, '1 วัน']], span: '2 ปี', long: true, hold: 5 * DAY,
      buy: { th: 3, tp1: false, mult: 4, win: 61, q: [355, 451, 526, 127] }, sellQ: [-72, -179, -6, 105] },
    '1d': { frames: [['d1', DAY, 60, '1 วัน'], ['w1', 7 * DAY, 60, '1 สัปดาห์']], span: '5 ปี', long: true, hold: 20 * DAY,
      buy: { th: 3, tp1: true, mult: 8, win: 64, q: [128, 218, 1243, 966] }, sellQ: [92, -120, 0, 12] },
    '1w': { frames: [['w1', 7 * DAY, 60, '1 สัปดาห์']], span: '4 ปี', long: true, hold: 84 * DAY, few: 23,
      buy: { th: 1, tp1: true, mult: 20, win: 70, q: [196, 737, 1167, 296] } },
  };
  const NONE = { ...INTRA.RULE, threshold: 99, sides: 'both', noChase: false }; // score only; entries decided by dirOf
  const usdList = (c) => (c.tp1 ? [15] : INTRA.RULE.tpUsd).map((u) => Math.round(u * c.mult));
  const levelsFor = (c, price, d) => ({ sl: price - d * Math.round(15 * c.mult), tps: usdList(c).map((u) => price + d * u) });
  const maxScore = (sys) => sys.frames.length * 2;
  // Entry direction for a decision: only on a side that passed its test, never chasing outside the Bollinger band
  function dirOf(sys, dec) {
    if (!dec || (!sys.long && (dec.stale || dec.lastHour || dec.news))) return 0;
    if (sys.buy && dec.score >= sys.buy.th) return dec.bbPos >= 1 ? 0 : 1;
    if (sys.sell && dec.score <= -sys.sell.th) return dec.bbPos <= 0 ? 0 : -1;
    return 0;
  }
  const stretched = (sys, dec) => !!dec && ((sys.buy && dec.score >= sys.buy.th && dec.bbPos >= 1) || (sys.sell && dec.score <= -sys.sell.th && dec.bbPos <= 0));
  // Score at time t from closed candles (live = also the forming ones). data: { <frame key>: candles (ms) }
  const decide = (sys, data, t, news, live) => INTRA.decideWith(sys.frames, NONE, data, t, sys.long ? null : news, live);
  // A trade for an entry at `price` (the last closed candle's close) decided at t
  function trade(sys, dec, dir, price, t) {
    const c = dir > 0 ? sys.buy : sys.sell, tr = INTRA.makeTrade({ ...dec, dir }, price, t), L = levelsFor(c, tr.entry, dir);
    const r = (v) => Math.round(v * 100) / 100;
    tr.sl = r(L.sl); tr.tps = L.tps.map(r); tr.tp = tr.tps[0];
    if (sys.hold) tr.expiresAt = t + sys.hold;
    return tr;
  }

  const CHARTSYS = { SYS, NONE, usdList, levelsFor, maxScore, dirOf, stretched, decide, trade };
  if (typeof module !== 'undefined' && module.exports) module.exports = CHARTSYS;
  else root.CHARTSYS = CHARTSYS;
})(typeof window !== 'undefined' ? window : globalThis);
