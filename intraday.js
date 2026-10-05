// 30-minute signals: every half hour, check whether the 30-minute, 1-hour and 5-hour trends
// strongly agree. If they do and no trade is open, enter at the current price with a $15 stop and
// targets at $15 / $20 / $30. Shared by the website and the Node scripts (needs TA and SIG).
(function (root) {
  const TA = root.TA || (typeof require === 'function' ? require('./indicators.js') : null);
  const SIG = root.SIG || (typeof require === 'function' ? require('./signals.js') : null);

  const RULE = { threshold: 5, slUsd: 15, tpUsd: [15, 20, 30], maxHoldMs: 24 * 3600e3 };
  const SLOT = 30 * 60e3;
  const STRENGTH = { strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2 };
  const TREND_TH = { strong_buy: 'ขาขึ้นแรง', buy: 'ขาขึ้น', neutral: 'ไซด์เวย์', sell: 'ขาลง', strong_sell: 'ขาลงแรง' };
  const FRIDAY_CUTOFF_UTC = 19; // no new trades after 19:00 UTC Friday (market closes ~21:00 UTC)

  const slotOf = (ms) => Math.floor(ms / SLOT) * SLOT;
  // Only candles that have finished by `now`
  const closed = (bars, durMs, now) => bars.filter((b) => b.time + durMs <= now).slice(-200);
  const trendKey = (bars) => TA.analyze(bars).label.key.replace('-', '_');

  // candles: { m30, h1, h5 } arrays of { time (ms), open, high, low, close }
  function decide(candles, now = Date.now()) {
    const c30 = closed(candles.m30, 30 * 60e3, now), c1 = closed(candles.h1, 3600e3, now), c5 = closed(candles.h5, 5 * 3600e3, now);
    if (c30.length < 60 || c1.length < 60 || c5.length < 40) return null;
    const keys = { m30: trendKey(c30), h1: trendKey(c1), h5: trendKey(c5) };
    const score = STRENGTH[keys.m30] + STRENGTH[keys.h1] + STRENGTH[keys.h5];
    // Direction to lean every half hour, even when the score is too weak for an official trade
    const lean = Math.sign(score) || Math.sign(STRENGTH[keys.h1]) || Math.sign(STRENGTH[keys.h5]) || Math.sign(STRENGTH[keys.m30]);
    const d = new Date(now);
    const lateFriday = d.getUTCDay() === 5 && d.getUTCHours() >= FRIDAY_CUTOFF_UTC;
    const stale = now - c30[c30.length - 1].time > 2 * 3600e3; // market closed
    return {
      slot: slotOf(now), score, keys, lean,
      dir: Math.abs(score) >= RULE.threshold && !lateFriday && !stale ? Math.sign(score) : 0,
      lateFriday, stale,
    };
  }

  // Plain-Thai reasons for a decision
  function reasons(dec) {
    const lines = [`แนวโน้ม 30 นาที ${TREND_TH[dec.keys.m30]} · 1 ชม. ${TREND_TH[dec.keys.h1]} · 5 ชม. ${TREND_TH[dec.keys.h5]} (คะแนน ${dec.score > 0 ? '+' : ''}${dec.score} จาก ±6)`];
    if (dec.stale) lines.push('ตลาดปิดอยู่ — ไม่มีราคาเคลื่อนไหว');
    else if (dec.lateFriday) lines.push('ใกล้ปิดตลาดวันศุกร์ — ไม่เปิดไม้ใหม่ค้างข้ามสุดสัปดาห์');
    else if (!dec.dir) lines.push(`ต้องได้คะแนน ±${RULE.threshold} ขึ้นไปถึงจะเข้า (ทั้ง 3 ช่วงเวลาต้องชี้ทางเดียวกันชัดเจน)`);
    return lines;
  }

  // Historical odds for a score, from the calibration table in backtest-30m.json:
  // { "<score>": { n, winRate, avg } } — winRate = % of trades in the lean direction that hit TP1 first
  function odds(score, calibration) {
    const c = calibration && calibration[String(score)];
    return c && c.n >= 30 ? c : null;
  }

  // Entry / stop / targets for a direction at a price (used for the half-hourly suggestion too)
  function levels(dir, price) {
    const d = dir > 0 ? 1 : -1, r = (v) => SIG.round(v);
    return { side: d > 0 ? 'BUY' : 'SELL', entry: r(price), sl: r(price - d * RULE.slUsd), tps: RULE.tpUsd.map((u) => r(price + d * u)) };
  }

  function makeTrade(dec, price, now = Date.now()) {
    const buy = dec.dir > 0, d = buy ? 1 : -1;
    const r = (v) => SIG.round(v);
    let expiresAt = now + RULE.maxHoldMs;
    const fri = new Date(now);
    if (fri.getUTCDay() === 5 || fri.getUTCDay() === 4) {
      // Close before the weekend: Friday 20:45 UTC at the latest
      const cut = Date.UTC(fri.getUTCFullYear(), fri.getUTCMonth(), fri.getUTCDate() + (fri.getUTCDay() === 4 ? 1 : 0), 20, 45);
      expiresAt = Math.min(expiresAt, cut);
    }
    return {
      id: `${SIG.thaiDate(now)}-${new Date(now + 7 * 3600e3).toISOString().slice(11, 16).replace(':', '')}`,
      rule: 'intraday-30m', createdAt: now, expiresAt, market: true, status: 'active', entryAt: now,
      side: buy ? 'BUY' : 'SELL', entry: r(price), sl: r(price - d * RULE.slUsd),
      tps: RULE.tpUsd.map((u) => r(price + d * u)), tp: r(price + d * RULE.tpUsd[0]),
      score: dec.score, stars: Math.abs(dec.score) >= 6 ? 5 : 4, why: reasons(dec),
    };
  }

  const INTRA = { RULE, SLOT, slotOf, closed, decide, reasons, odds, levels, makeTrade, TREND_TH };
  if (typeof module !== 'undefined' && module.exports) module.exports = INTRA;
  else root.INTRA = INTRA;
})(typeof window !== 'undefined' ? window : globalThis);
