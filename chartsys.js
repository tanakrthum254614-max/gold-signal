// Entry systems for every chart timeframe. Shared by the chart tab (chartzones.js) and the recorder that logs
// every real signal (scripts/chart-run.js), so both use the same rules. Needs INTRA (and through it TA / SIG).
// Settings: the ones that tested best per timeframe (scratchpad research 7 Oct 2026, Binance PAXG, after a $0.4
// spread, 4 equal periods old → new, $/oz). A side whose test failed has no entries — its arrows only show
// direction. confirm (indicator research 9 Oct 2026: 28 well-known indicators × every timeframe, chosen on the first
// 3 periods and checked on the 4th): a BUY also needs that indicator on the fast frame — 15m EMA 9 > EMA 21
// (+$339 → +$465, win 54 → 56%), 5h ROC 12 up (+$1,458 → +$1,834, win 61 → 65%, better in all 4 periods). Other
// timeframes: no indicator beat the current rules reliably, so none added. 5m SELL also needs SMA 20 < SMA 50 (+$136 →
// +$353, win 51 → 52%, better in all 4 periods; added 9 Oct after the 5m run finished). SL $15 × mult; TP1 $15 × mult (tp1) or TP $15/20/30 × mult. long = 5h/1d/1w: no session close,
// trades held up to `hold`.
(function (root) {
  const INTRA = root.INTRA || (typeof require === 'function' ? require('./intraday.js') : null);
  const M = 60e3, H = 60 * M, DAY = 24 * H;
  const SYS = {
    // news: skip entries within ±30 minutes of high-impact US news. Tested with 2 years of investing.com's calendar (9 Oct
    // 2026, research/indicators/newstest.js): it helps on 5m (BUY +$407 → +$554, 4/4 periods; SELL +$353 → +$451) and
    // 1h (+$774 → +$792), but hurts 15m (+$465 → +$377) and 30m (+$957 → +$828) — so only 5m and 1h skip the news.
    '5m': { news: true, frames: [['m5', 5 * M, 60, '5 นาที'], ['m30', 30 * M, 60, '30 นาที'], ['h1', H, 60, '1 ชม.']], span: '2 ปี',
      buy: { th: 5, tp1: true, mult: 1, win: 54, q: [331, 551, 104, -433] }, sell: { th: 6, tp1: false, mult: 0.67, confirm: 'sma2050', since: '2026-10-09T09:54:00+07:00', win: 53, q: [39, 84, 156, 172] },
      every: -1480 }, // taking every small arrow one at a time, SL / TP1 $15
    '15m': { frames: INTRA.FRAMES15, span: '2 ปี', buy: { th: 6, tp1: true, mult: 1.5, confirm: 'ema921', since: '2026-10-09T09:40:00+07:00', win: 56, q: [261, 72, 84, 48] }, sellQ: [115, -233, -72, 204] },
    '30m': { frames: INTRA.FRAMES, span: '2 ปี', buy: { th: 5, tp1: true, mult: 1, win: 57, q: [264, 462, 239, -7] }, sellQ: [129, -174, -58, 113] },
    '1h': { news: true, frames: [['h1', H, 60, '1 ชม.'], ['h4', 4 * H, 60, '4 ชม.'], ['h5', 5 * H, 40, '5 ชม.']], span: '2 ปี',
      buy: { th: 5, tp1: false, mult: 2, win: 57, q: [192, 209, 359, 32] }, sellQ: [-62, 4, -112, 8] },
    '5h': { frames: [['h5', 5 * H, 60, '5 ชม.'], ['d1', DAY, 60, '1 วัน']], span: '2 ปี', long: true, hold: 5 * DAY,
      buy: { th: 3, tp1: false, mult: 4, confirm: 'roc12', since: '2026-10-09T09:40:00+07:00', win: 65, q: [483, 511, 635, 205] }, sellQ: [-72, -179, -6, 105] },
    '1d': { frames: [['d1', DAY, 60, '1 วัน'], ['w1', 7 * DAY, 60, '1 สัปดาห์']], span: '5 ปี', long: true, hold: 20 * DAY,
      buy: { th: 3, tp1: true, mult: 8, win: 64, q: [128, 218, 1243, 966] }, sellQ: [92, -120, 0, 12] },
    '1w': { frames: [['w1', 7 * DAY, 60, '1 สัปดาห์']], span: '4 ปี', long: true, hold: 84 * DAY, few: 23,
      buy: { th: 1, tp1: true, mult: 20, win: 70, q: [196, 737, 1167, 296] } },
  };
  const NONE = { ...INTRA.RULE, threshold: 99, sides: 'both', noChase: false }; // score only; entries decided by dirOf
  const usdList = (c) => (c.tp1 ? [15] : INTRA.RULE.tpUsd).map((u) => Math.round(u * c.mult));
  const levelsFor = (c, price, d) => ({ sl: price - d * Math.round(15 * c.mult), tps: usdList(c).map((u) => price + d * u) });
  const maxScore = (sys) => sys.frames.length * 2;
  // Confirmation indicators (dec.conf from INTRA.decideWith, fast frame)
  const CONFIRM = {
    ema921: { name: 'EMA 9/21', wait: ' EMA 9 ตัดผ่าน EMA 21' },
    roc12: { name: 'ROC 12', wait: 'ราคาปิดสูง/ต่ำกว่าเมื่อ 12 แท่งก่อน' },
    sma2050: { name: 'SMA 20/50', wait: ' SMA 20 ตัดผ่าน SMA 50' },
  };
  const confirmed = (c, dec, side) => !c.confirm || !dec.conf || dec.conf[c.confirm] === side;
  // Entry direction for a decision: only on a side that passed its test, never chasing outside the Bollinger band,
  // and with the side's confirmation indicator agreeing
  function dirOf(sys, dec) {
    if (!dec || (!sys.long && (dec.stale || dec.lastHour || (sys.news && dec.news)))) return 0;
    if (sys.buy && dec.score >= sys.buy.th) return dec.bbPos >= 1 || !confirmed(sys.buy, dec, 1) ? 0 : 1;
    if (sys.sell && dec.score <= -sys.sell.th) return dec.bbPos <= 0 || !confirmed(sys.sell, dec, -1) ? 0 : -1;
    return 0;
  }
  // Score is there (and not stretched) but the confirmation indicator disagrees
  const unconfirmed = (sys, dec) => !!dec && ((sys.buy && dec.score >= sys.buy.th && dec.bbPos < 1 && !confirmed(sys.buy, dec, 1))
    || (sys.sell && dec.score <= -sys.sell.th && dec.bbPos > 0 && !confirmed(sys.sell, dec, -1)));
  const stretched = (sys, dec) => !!dec && ((sys.buy && dec.score >= sys.buy.th && dec.bbPos >= 1) || (sys.sell && dec.score <= -sys.sell.th && dec.bbPos <= 0));
  // Score at time t from closed candles (live = also the forming ones). data: { <frame key>: candles (ms) }
  const decide = (sys, data, t, news, live) => INTRA.decideWith(sys.frames, NONE, data, t, sys.news ? news : null, live);
  // A trade for an entry at `price` (the last closed candle's close) decided at t
  function trade(sys, dec, dir, price, t) {
    const c = dir > 0 ? sys.buy : sys.sell, tr = INTRA.makeTrade({ ...dec, dir }, price, t), L = levelsFor(c, tr.entry, dir);
    const r = (v) => Math.round(v * 100) / 100;
    tr.sl = r(L.sl); tr.tps = L.tps.map(r); tr.tp = tr.tps[0];
    if (sys.hold) tr.expiresAt = t + sys.hold;
    return tr;
  }

  // One side's readiness for the UI — the chart tab, the signals tab and the chart side card all use this, so they always
  // agree. pct = how far the score has come toward that side's threshold (100 = entry); a side that failed its test uses
  // the Buy threshold mirrored and is never "ควรเข้า". br = the safety brake (brake()) or null.
  function sideInfo(sys, dec, side, br) {
    const c = side > 0 ? sys.buy : sys.sell, cc = c || sys.buy, dir = dirOf(sys, dec);
    const pct = !dec ? 0 : dir === side ? 100 : Math.max(0, Math.min(c ? 99 : 100, Math.round(((side > 0 ? dec.score : -dec.score) / cc.th) * 100)));
    const tested = !!c, go = tested && dir === side && !br;
    const verdict = br && tested ? '⛔ พัก — ไม่เข้า' : go ? '✅ ควรเข้า' : !tested ? (pct >= 100 ? '⚠️ ถึงเกณฑ์ แต่ไม่แนะนำ' : '⚠️ ไม่แนะนำ') : '⏸ ยังไม่ควรเข้า';
    return { side, c, pct, tested, go, verdict, key: br && tested ? 'bad' : go ? 'good' : !tested ? 'bad' : 'wait' };
  }

  // Test results refreshed by the monthly study (test-stats.json, written by research/indicators/monthly.js:
  // { at, tf: { <tf>: { BUY: { n, win, pnl, q }, SELL: … } } }) — so every page, LINE and the safety brake show ONE set of
  // "ทดสอบ" numbers for the rules in use. Only the numbers change here, never the rules (th, confirm, SL/TP).
  function applyStats(st) {
    if (!st || !st.tf) return;
    for (const [tf, sides] of Object.entries(st.tf)) {
      const sys = SYS[tf];
      if (!sys) continue;
      [['BUY', sys.buy], ['SELL', sys.sell]].forEach(([k, c]) => { const r = sides[k]; if (c && r && r.n) Object.assign(c, { win: r.win, q: r.q, n: r.n, pnl: r.pnl }); });
    }
    CHARTSYS.statsAt = st.at || 0;
  }

  // Safety brake from the live record (chart-signals.json). Trades opened while paused are still recorded (paused:
  // true, no LINE), so a pause can lift by itself. Returns null, or { why, until } — until null = until the last 20 recover.
  // • 5 losses in a row → pause until next week's open (5h/1d/1w: 30 days); trades inside that pause don't count again
  // • 20 closed trades winning 12+ points less than the backtest
  function brake(sys, trades, now) {
    const done = trades.filter((t) => t.status === 'win' || t.status === 'loss').sort((a, b) => (a.exitAt || a.createdAt) - (b.exitAt || b.createdAt));
    let until = 0, streak = 0;
    for (const t of done) {
      if (t.createdAt < until) continue;
      streak = t.status === 'loss' ? streak + 1 : 0;
      if (streak >= 5) { const at = t.exitAt || t.createdAt; until = sys.long ? at + 30 * DAY : INTRA.nextWeek(at); streak = 0; }
    }
    if (now < until) return { why: 'แพ้ติดกัน 5 ไม้', until };
    const last = done.slice(-20);
    if (last.length === 20) {
      const win = last.filter((t) => t.status === 'win').length * 5;
      const exp = Math.round(last.reduce((a, t) => a + ((t.side === 'SELL' && sys.sell) || sys.buy).win, 0) / 20);
      if (win < exp - 12) return { why: `ชนะ ${win}% ใน 20 ไม้ล่าสุด (ทดสอบ ${exp}%)`, until: null };
    }
    return null;
  }

  const CHARTSYS = { SYS, NONE, CONFIRM, usdList, levelsFor, maxScore, dirOf, stretched, unconfirmed, sideInfo, applyStats, decide, trade, brake };
  if (typeof module !== 'undefined' && module.exports) module.exports = CHARTSYS;
  else root.CHARTSYS = CHARTSYS;
})(typeof window !== 'undefined' ? window : globalThis);
