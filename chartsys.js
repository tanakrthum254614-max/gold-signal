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
// risky (15 Oct 2026): only 1h BUY, 5h BUY, 1d BUY and 5m SELL made money in ALL 4 test periods (5m SELL turned risky the
// same day: live 4 wins in 14 vs 53% tested). 5m BUY (latest period
// −$433), 15m BUY, 30m BUY (−$7) and 1w BUY are "risky": their entries still show on the chart and are recorded, but
// labelled ⚠️ เสี่ยง, never the main system and not in LINE (CHART_NOTIFY). Briefly switched off the same morning; the
// user wanted entries visible on every timeframe ("เปิดกลับให้เห็นบนกราฟ แต่ติดป้ายเสี่ยง"). Entry filters and
// multi-timeframe agreement were tested first (research/indicators/qualtest.js, confluence.js) — none held up.
// off (16 Oct 2026, user: "ขอความแม่นยำสูงในการเข้าเทรด ไม่อยากให้คนที่สมัครมาผิดหวัง" → "ทำมาเลย"): the risky sides
// are switched off — live 7–16 Oct 38 trades, 39% win, −$103, nearly all on 5m/15m/30m, and the SL/TP study
// (research/indicators/exitlab.js, 72 exits per timeframe) found nothing that makes 5m/15m BUY pay in the latest period.
// Entries now only on 1h, 5h and 1d BUY (profitable in all 4 test periods). Off sides keep their settings and numbers
// (shown as "ปิดจุดเข้า"), but give no entries, no records, no LINE. Same night the user asked where the entries had
// gone ("จุดที่ให้เข้าซื้อไปไหนหมดของทุกทามเฟรม") — back to ⚠️ risky (as on 15 Oct); `off` stays available.
// 19 Oct 2026: off again for every risky side (user chose option A after a list full of losses), back the same
// morning (user: "เอาจุดเข้ามากลับมาทั้งหมด ทุกทามเฟรม") — risky sides keep giving entries, labelled ⚠️, no LINE.
// MAIN_TF = the timeframe of the signals tab and LINE's "ระบบหลัก" (30m until 15 Oct 2026, now 1h).
(function (root) {
  const INTRA = root.INTRA || (typeof require === 'function' ? require('./intraday.js') : null);
  const M = 60e3, H = 60 * M, DAY = 24 * H;
  const SYS = {
    // news: skip entries within ±30 minutes of high-impact US news. Tested with 2 years of investing.com's calendar (9 Oct
    // 2026, research/indicators/newstest.js): it helps on 5m (BUY +$407 → +$554, 4/4 periods; SELL +$353 → +$451) and
    // 1h (+$774 → +$792), but hurts 15m (+$465 → +$377) and 30m (+$957 → +$828) — so only 5m and 1h skip the news.
    '5m': { news: true, frames: [['m5', 5 * M, 60, '5 นาที'], ['m30', 30 * M, 60, '30 นาที'], ['h1', H, 60, '1 ชม.']], span: '2 ปี',
      // scale out (19 Oct 2026, user chose "ข้อ 1 + 3"): TP1 $5, SL to entry, then $10 / $15 — newidea.js PARTIAL: 1,702 trades, 75% win, +$137 (was TP1 $15: 54%, +$554)
      buy: { risky: 'ช่วงทดสอบล่าสุดขาดทุน', th: 5, tp1: false, mult: 1, tps: [5, 10, 15], dip: 5, dipH: 1, since: '2026-10-19T18:00:00+07:00', win: 84, q: [636, 473, 717, -75] }, /* dip: wait $5 lower, up to 1 h (newidea.js LIMIT THROUGH=0.3: 1,342 trades 84% +$1,750) */ sell: { risky: 'ผลจริงชนะต่ำกว่าทดสอบมาก (14 รายการ ชนะ 4)', th: 6, tp1: false, mult: 0.67, confirm: 'sma2050', since: '2026-10-09T09:54:00+07:00', win: 53, q: [39, 84, 156, 172] },
      every: -1480 }, // taking every small arrow one at a time, SL / TP1 $15
    '15m': { frames: INTRA.FRAMES15, span: '2 ปี', buy: { risky: 'ช่วงทดสอบล่าสุดกำไรน้อยมาก', th: 6, tp1: true, mult: 1.5, confirm: 'ema921', since: '2026-10-09T09:40:00+07:00', win: 56, q: [261, 72, 84, 48] },
      // SELL (19 Oct 2026, user: "มีฝั่ง Sell บ้างไหม" → "ทำมาเลย"): research/indicators/sellnew.js — score −4, wait for a $5 bounce
      // up to 2 h, SL $15, TP 3.75/15/30: 1,330 trades, 87%, +$1,219, profit in all 4 periods (latest +$531). One of ~1,100 tried → ⚠️
      sell: { risky: 'Sell ใหม่ — ยังไม่มีผลจริงครบ 20 รายการ', th: 4, tp1: false, mult: 1, tps: [3.75, 15, 30], dip: 5, dipH: 2, since: '2026-10-19T19:00:00+07:00', win: 87, q: [160, 132, 396, 531] }, sellQ: [115, -233, -72, 204] },
    // 30m scale out (19 Oct 2026, "ข้อ 1 + 3"): TP1 $3.75, SL to entry, then $15 / $30 — 1,054 trades, 81% win, +$355 (was TP1 $15: 57%, +$957)
    '30m': { frames: INTRA.FRAMES, span: '2 ปี', buy: { risky: 'ช่วงทดสอบล่าสุดขาดทุน', th: 5, tp1: false, mult: 1, tps: [3.75, 15, 30], dip: 5, dipH: 3, since: '2026-10-19T18:00:00+07:00', win: 87, q: [439, 232, 161, 1] }, /* dip $5 · 3 h: 765 trades 87% +$833 */
      // SELL (19 Oct 2026, sellnew.js): score −3, wait for a $5 bounce up to 3 h, SL $15, TP 3.75/15/30 — 1,376 trades, 87%, +$1,269,
      // profit in all 4 periods (latest +$651). ⚠️ until it has live results
      sell: { risky: 'Sell ใหม่ — ยังไม่มีผลจริงครบ 20 รายการ', th: 3, tp1: false, mult: 1, tps: [3.75, 15, 30], dip: 5, dipH: 3, since: '2026-10-19T19:00:00+07:00', win: 87, q: [110, 115, 393, 651] }, sellQ: [129, -174, -58, 113] },
    '1h': { news: true, frames: [['h1', H, 60, '1 ชม.'], ['h4', 4 * H, 60, '4 ชม.'], ['h5', 5 * H, 40, '5 ชม.']], span: '2 ปี',
      // scale out (19 Oct 2026, user: "ขอมากกว่า 70 ก็ได้ 50 เปอร์เซ็นต์ดูน้อยไป" → chose "ใช้กับ 1 ชม."): TP1 $7.5 near, then SL to
      // entry, the rest to $30 / $60 — research/indicators/newidea.js PARTIAL=1: 399 trades, 77% win, +$522, profit in all 4
      // periods (old 3 TP $30/40/60: 57%, +$804). The only scale-out ladder that also made money in the latest period.
      // limit entry (19 Oct 2026, user: "ขอแม่นยำจุดในการเข้า" → "ทั้ง 3 กรอบ Buy"): wait for a $3 dip, up to 6 h — 361 trades, 80% win,
      // +$775, profit in all 4 periods (latest +$105; entering at once: 77% +$522, latest +$9)
      buy: { th: 5, tp1: false, mult: 2, tps: [7.5, 30, 60], dip: 3, dipH: 6, since: '2026-10-19T18:00:00+07:00', win: 80, q: [206, 311, 154, 105] },
      // SELL (17 Oct 2026, user: "ทำมาหมดเลย" — no tested Sell left for falling markets): selltest.js 12 Oct best 1h Sell,
      // score −4 + Bollinger reversal, SL $30, TP 30/40/60 — profitable in all 4 periods but one of ~680 tried, so ⚠️ risky
      // (shown + recorded, no LINE) until 20 live trades say otherwise. Old score-only Sell: −62 / 4 / −112 / 8. Replayed with the site code 17 Oct: 74 trades, 65%, +$593.
      // + wait for a $6 bounce, up to 6 h (19 Oct 2026, sellnew.js): 70 trades, 76%, +$693, all 4 periods profit (at once: 62% +$545)
      sell: { risky: 'Sell ใหม่ — ยังไม่มีผลจริงครบ 20 รายการ', th: 4, tp1: false, mult: 2, confirm: 'bbrev', dip: 6, dipH: 6, since: '2026-10-19T19:00:00+07:00', win: 76, q: [140, 107, 191, 255] } },
    '5h': { frames: [['h5', 5 * H, 60, '5 ชม.'], ['d1', DAY, 60, '1 วัน']], span: '2 ปี', long: true, hold: 5 * DAY,
      buy: { th: 3, tp1: false, mult: 4, confirm: 'roc12', since: '2026-10-09T09:40:00+07:00', win: 65, q: [483, 511, 635, 205] }, sellQ: [-72, -179, -6, 105] },
    '1d': { frames: [['d1', DAY, 60, '1 วัน'], ['w1', 7 * DAY, 60, '1 สัปดาห์']], span: '5 ปี', long: true, hold: 20 * DAY,
      buy: { th: 3, tp1: true, mult: 8, win: 64, q: [128, 218, 1243, 966] }, sellQ: [92, -120, 0, 12] },
    '1w': { frames: [['w1', 7 * DAY, 60, '1 สัปดาห์']], span: '4 ปี', long: true, hold: 84 * DAY, few: 23,
      buy: { risky: 'รายการทดสอบน้อย และผลช่วงล่าสุดไม่สม่ำเสมอ', th: 1, tp1: true, mult: 20, win: 70, q: [196, 737, 1167, 296] } },
  };
  const NONE = { ...INTRA.RULE, threshold: 99, sides: 'both', noChase: false }; // score only; entries decided by dirOf
  // TP $ before × mult: TP1 only, or TP $15/20/30 — the targets the tests used (indlab / monthly / qualtest). Not
  // INTRA.RULE.tpUsd: that became [15] on 9 Oct 2026 (old 30m system → TP1) and had silently cut 1h, 5h and 5m SELL to
  // TP1 only until 15 Oct 2026.
  const usdList = (c) => (c.tps ? c.tps.slice() : (c.tp1 ? [15] : [15, 20, 30]).map((u) => Math.round(u * c.mult))); // c.tps: $ targets set directly
  // c.dip (19 Oct 2026): the entry is a limit $dip better than the price; SL / TPs measured from it
  const levelsFor = (c, price, d) => { const e = c && c.dip ? price - d * c.dip : price; return { entry: e, dip: (c && c.dip) || 0, dipH: (c && c.dipH) || 0, sl: e - d * Math.round(15 * c.mult), tps: usdList(c).map((u) => e + d * u) }; };
  const maxScore = (sys) => sys.frames.length * 2;
  // Confirmation indicators (dec.conf from INTRA.decideWith, fast frame)
  const CONFIRM = {
    ema921: { name: 'EMA 9/21', wait: ' EMA 9 ตัดผ่าน EMA 21' },
    roc12: { name: 'ROC 12', wait: 'ราคาปิดสูง/ต่ำกว่าเมื่อ 12 แท่งก่อน' },
    sma2050: { name: 'SMA 20/50', wait: ' SMA 20 ตัดผ่าน SMA 50' },
    bbrev: { name: 'Bollinger กลับตัว', wait: 'ราคาปิดหลุดขอบ Bollinger แล้วกลับเข้ามา (Sell: ขอบบน)' },
  };
  const confirmed = (c, dec, side) => !c.confirm || !dec.conf || dec.conf[c.confirm] === side;
  // A side in use: has settings and isn't switched off
  const on = (c) => (c && !c.off ? c : null);
  const ENTRY_TFS = ['1h', '5h', '1d']; // where entries are on (shown in "use these instead" texts)
  // Entry direction for a decision: only on a side that passed its test (risky sides included), never chasing outside the Bollinger band,
  // and with the side's confirmation indicator agreeing
  function dirOf(sys, dec) {
    if (!dec || (!sys.long && (dec.stale || dec.lastHour || (sys.news && dec.news)))) return 0;
    const B = on(sys.buy), S = on(sys.sell);
    if (B && dec.score >= B.th) return dec.bbPos >= 1 || !confirmed(B, dec, 1) ? 0 : 1;
    if (S && dec.score <= -S.th) return dec.bbPos <= 0 || !confirmed(S, dec, -1) ? 0 : -1;
    return 0;
  }
  // Score is there (and not stretched) but the confirmation indicator disagrees
  const unconfirmed = (sys, dec) => { const B = on(sys.buy), S = on(sys.sell);
    return !!dec && ((B && dec.score >= B.th && dec.bbPos < 1 && !confirmed(B, dec, 1)) || (S && dec.score <= -S.th && dec.bbPos > 0 && !confirmed(S, dec, -1))); };
  const stretched = (sys, dec) => { const B = on(sys.buy), S = on(sys.sell);
    return !!dec && ((B && dec.score >= B.th && dec.bbPos >= 1) || (S && dec.score <= -S.th && dec.bbPos <= 0)); };
  // Score at time t from closed candles (live = also the forming ones). data: { <frame key>: candles (ms) }
  const decide = (sys, data, t, news, live) => INTRA.decideWith(sys.frames, NONE, data, t, sys.news ? news : null, live);
  // A trade for an entry at `price` (the last closed candle's close) decided at t
  function trade(sys, dec, dir, price, t) {
    const c = dir > 0 ? sys.buy : sys.sell, tr = INTRA.makeTrade({ ...dec, dir }, price, t), L = levelsFor(c, tr.entry, dir);
    const r = (v) => Math.round(v * 100) / 100;
    tr.sl = r(L.sl); tr.tps = L.tps.map(r); tr.tp = tr.tps[0];
    if (sys.hold) tr.expiresAt = t + sys.hold;
    if (c.dip) { // limit entry: waits up to dipH for the price; held as long as a trade filled at the end of that wait
      const fillBy = t + c.dipH * 3600e3;
      Object.assign(tr, { entry: r(L.entry), priceAtSignal: r(price), fillBy, status: 'pending', limit: true,
        expiresAt: sys.hold ? fillBy + sys.hold : INTRA.makeTrade({ ...dec, dir }, L.entry, fillBy).expiresAt });
    }
    return tr;
  }

  // One side's readiness for the UI — the chart tab, the signals tab and the chart side card all use this, so they always
  // agree. pct = how far the score has come toward that side's threshold (100 = entry); a side that failed its test uses
  // the Buy threshold mirrored and is never "ควรเข้า". br = the safety brake (brake()) or null.
  function sideInfo(sys, dec, side, br) {
    const c = side > 0 ? sys.buy : sys.sell, cc = c || sys.buy, dir = dirOf(sys, dec), off = !!(c && c.off), risky = !off && !!(c && c.risky);
    const tested = !!on(c), go = tested && dir === side && !br;
    const pct = !dec ? 0 : dir === side ? 100 : Math.max(0, Math.min(tested ? 99 : 100, Math.round(((side > 0 ? dec.score : -dec.score) / cc.th) * 100)));
    const verdict = br && tested ? '⛔ พัก — ไม่เข้า' : go ? (risky ? '⚠️ มีสัญญาณ แต่เสี่ยง' : '✅ ควรเข้า')
      : off ? '⏸ ปิดจุดเข้า — ดูทิศเท่านั้น' : !tested ? (pct >= 100 ? '⚠️ ถึงเกณฑ์ แต่ไม่แนะนำ' : '⚠️ ไม่แนะนำ') : '⏸ ยังไม่ควรเข้า';
    return { side, c, pct, tested, risky, off, go, verdict, key: br && tested ? 'bad' : go ? 'good' : !tested ? 'bad' : 'wait' };
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
    if (now < until) return { why: 'ขาดทุนติดต่อกัน 5 รายการ', until };
    const last = done.slice(-20);
    if (last.length === 20) {
      const win = last.filter((t) => t.status === 'win').length * 5;
      const exp = Math.round(last.reduce((a, t) => a + ((t.side === 'SELL' && sys.sell) || sys.buy).win, 0) / 20);
      if (win < exp - 12) return { why: `ชนะ ${win}% ใน 20 รายการล่าสุด (ทดสอบ ${exp}%)`, until: null };
    }
    return null;
  }

  // Why a side is risky (messages: chart card, chat); c.risky = the reason (15 Oct 2026 study, qualtest.js)
  const riskText = (c) => (c && c.risky && !c.off ? `⚠️ สัญญาณเสี่ยง — ${c.risky} · ควรใช้ขนาดการซื้อขายเล็กกว่าปกติ` : ''); // LINE: 5m / 30m / 1h send these labelled since 19 Oct 2026
  // Why a side gives no entries (chart card, chat)
  const whyNo = (c) => (c && c.off ? `ปิดจุดเข้าแล้ว (${c.off}) — ใช้ดูทิศเท่านั้น · จุดเข้าอยู่ที่กรอบ 1 ชม. / 5 ชม. / 1 วัน` : 'ทดสอบย้อนหลังแล้วขาดทุน — ระบบไม่ให้สัญญาณฝั่งนี้');
  const MAIN_TF = '1h';
  const CHARTSYS = { SYS, MAIN_TF, ENTRY_TFS, on, whyNo, riskText, NONE, CONFIRM, usdList, levelsFor, maxScore, dirOf, stretched, unconfirmed, sideInfo, applyStats, decide, trade, brake };
  if (typeof module !== 'undefined' && module.exports) module.exports = CHARTSYS;
  else root.CHARTSYS = CHARTSYS;
})(typeof window !== 'undefined' ? window : globalThis);
