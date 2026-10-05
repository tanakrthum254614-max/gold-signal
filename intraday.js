// 30-minute signals: every half hour, check whether the 30-minute, 1-hour and 5-hour trends
// strongly agree. If they do and no trade is open, enter at the current price with a $15 stop and
// targets at $15 / $20 / $30. Shared by the website and the Node scripts (needs TA and SIG).
(function (root) {
  const TA = root.TA || (typeof require === 'function' ? require('./indicators.js') : null);
  const SIG = root.SIG || (typeof require === 'function' ? require('./signals.js') : null);

  // sides: which official (recorded) trades to open — 'buy' or 'both'. Over 2 years a hypothetical sell
  // never beat ~53% at any score (buys reach 56–58%), so official trades are buys; the half-hourly
  // update still rates both sides. newsMin: no new trades ± this many minutes around high-impact US news.
  const RULE = { threshold: 5, slUsd: 15, tpUsd: [15, 20, 30], maxHoldMs: 24 * 3600e3, sides: 'buy', newsMin: 30 };
  const SLOT = 30 * 60e3;
  const STRENGTH = { strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2 };
  const TREND_TH = { strong_buy: 'ขาขึ้นแรง', buy: 'ขาขึ้น', neutral: 'ไซด์เวย์', sell: 'ขาลง', strong_sell: 'ขาลงแรง' };
  // Trading hours (Thai time): open 07:00 – 03:00 next day, Monday 07:00 to Saturday 03:00.
  // No new trades in the last hour (02:00–03:00); every trade is closed by 02:45.
  const HOURS = { open: 7, close: 3, lastEntry: 2, closeAt: { h: 2, m: 45 } };
  const thai = (ms) => { const d = new Date(ms + 7 * 3600e3); return { wd: d.getUTCDay(), h: d.getUTCHours(), m: d.getUTCMinutes() }; };
  function marketOpen(now) {
    const { wd, h } = thai(now);
    return (h >= HOURS.open && wd >= 1 && wd <= 5) || (h < HOURS.close && wd >= 2 && wd <= 6);
  }
  // The next 02:45 Thai time after `now` — when open trades are closed before the market shuts
  function nextClose(now) {
    const { h, m } = thai(now);
    const day = new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
    const today = Date.parse(`${day}T0${HOURS.closeAt.h}:${HOURS.closeAt.m}:00+07:00`);
    const before = h < HOURS.closeAt.h || (h === HOURS.closeAt.h && m < HOURS.closeAt.m);
    return before ? today : today + 24 * 3600e3;
  }

  const slotOf = (ms) => Math.floor(ms / SLOT) * SLOT;
  // Only candles that have finished by `now`
  const closed = (bars, durMs, now) => bars.filter((b) => b.time + durMs <= now).slice(-200);
  const trendKey = (bars) => TA.analyze(bars).label.key.replace('-', '_');

  // High-impact news within RULE.newsMin minutes of `now` (news: [{ time (ms), title }])
  function newsNear(news, now) {
    const w = RULE.newsMin * 60e3;
    return (news || []).find((n) => Math.abs(n.time - now) <= w) || null;
  }

  // candles: { m30, h1, h5 } arrays of { time (ms), open, high, low, close }; news: upcoming releases
  function decide(candles, now = Date.now(), news = null) {
    const c30 = closed(candles.m30, 30 * 60e3, now), c1 = closed(candles.h1, 3600e3, now), c5 = closed(candles.h5, 5 * 3600e3, now);
    if (c30.length < 60 || c1.length < 60 || c5.length < 40) return null;
    const keys = { m30: trendKey(c30), h1: trendKey(c1), h5: trendKey(c5) };
    const score = STRENGTH[keys.m30] + STRENGTH[keys.h1] + STRENGTH[keys.h5];
    // Direction to lean every half hour, even when the score is too weak for an official trade
    const lean = Math.sign(score) || Math.sign(STRENGTH[keys.h1]) || Math.sign(STRENGTH[keys.h5]) || Math.sign(STRENGTH[keys.m30]);
    const open = marketOpen(now);
    const lastHour = open && thai(now).h === HOURS.lastEntry; // 02:00–03:00: too close to the close
    const stale = !open || now - c30[c30.length - 1].time > 2 * 3600e3; // market closed / no prices
    const event = newsNear(news, now);
    const sideOk = RULE.sides !== 'buy' || score > 0;
    return {
      slot: slotOf(now), score, keys, lean,
      dir: Math.abs(score) >= RULE.threshold && sideOk && !lastHour && !stale && !event ? Math.sign(score) : 0,
      lastHour, stale, open, news: event, sellSkipped: Math.abs(score) >= RULE.threshold && !sideOk,
    };
  }

  // Plain-Thai reasons for a decision
  function reasons(dec) {
    const lines = [`แนวโน้ม 30 นาที ${TREND_TH[dec.keys.m30]} · 1 ชม. ${TREND_TH[dec.keys.h1]} · 5 ชม. ${TREND_TH[dec.keys.h5]} (คะแนน ${dec.score > 0 ? '+' : ''}${dec.score} จาก ±6)`];
    if (dec.stale) lines.push('ตลาดปิดอยู่ (เปิด 07:00–03:00 น.) — ไม่เปิดไม้ใหม่');
    else if (dec.lastHour) lines.push('ใกล้ปิดตลาด 03:00 น. — ไม่เปิดไม้ใหม่ในชั่วโมงสุดท้าย');
    else if (dec.news) lines.push(`📰 ช่วงข่าวแรง: ${dec.news.title} — ไม่เปิดไม้ใหม่ ±${RULE.newsMin} นาทีรอบข่าว`);
    else if (dec.sellSkipped) lines.push('แนวโน้มลงชัด แต่ระบบเข้าเฉพาะฝั่งซื้อ (สถิติ 2 ปี ฝั่งขายชนะแค่ ~50%) — แนะนำรอ');
    else if (!dec.dir) lines.push(`ต้องได้คะแนน +${RULE.threshold} ขึ้นไปถึงจะเข้าซื้อ (ทั้ง 3 ช่วงเวลาต้องชี้ขึ้นชัดเจน)`);
    return lines;
  }

  // Historical odds at a score, from the calibration table in backtest-30m.json:
  // { buy: { "<score>": { n, winRate, avg } }, sell: {...} } — winRate = % of hypothetical trades on that
  // side, opened at that score, that reached TP1 before the stop. side defaults to the score's direction.
  function odds(score, calibration, side) {
    if (!calibration) return null;
    const s = side || (score < 0 ? 'sell' : 'buy');
    const c = calibration[s] ? calibration[s][String(score)] : calibration[String(score)]; // older single table
    return c && c.n >= 30 ? c : null;
  }

  // Plain verdict for one side from its odds
  function verdict(o) {
    if (!o) return { key: 'unknown', th: '❔ ยังไม่มีสถิติพอ' };
    if (o.winRate >= 57) return { key: 'good', th: '✅ ควรเข้า' };
    if (o.winRate >= 53) return { key: 'ok', th: '🟡 เข้าได้ แต่ลดขนาดไม้' };
    return { key: 'bad', th: '❌ ไม่ควรเข้า' };
  }

  // Entry / stop / targets for a direction at a price (used for the half-hourly suggestion too)
  function levels(dir, price) {
    const d = dir > 0 ? 1 : -1, r = (v) => SIG.round(v);
    return { side: d > 0 ? 'BUY' : 'SELL', entry: r(price), sl: r(price - d * RULE.slUsd), tps: RULE.tpUsd.map((u) => r(price + d * u)) };
  }

  function makeTrade(dec, price, now = Date.now()) {
    const buy = dec.dir > 0, d = buy ? 1 : -1;
    const r = (v) => SIG.round(v);
    // Closed by 02:45 Thai time at the latest, before the market shuts at 03:00
    const expiresAt = Math.min(now + RULE.maxHoldMs, nextClose(now));
    return {
      id: `${SIG.thaiDate(now)}-${new Date(now + 7 * 3600e3).toISOString().slice(11, 16).replace(':', '')}`,
      rule: 'intraday-30m', createdAt: now, expiresAt, market: true, status: 'active', entryAt: now,
      side: buy ? 'BUY' : 'SELL', entry: r(price), sl: r(price - d * RULE.slUsd),
      tps: RULE.tpUsd.map((u) => r(price + d * u)), tp: r(price + d * RULE.tpUsd[0]),
      score: dec.score, stars: Math.abs(dec.score) >= 6 ? 5 : 4, why: reasons(dec),
    };
  }

  const INTRA = { RULE, SLOT, HOURS, slotOf, closed, marketOpen, nextClose, newsNear, decide, reasons, odds, verdict, levels, makeTrade, TREND_TH };
  if (typeof module !== 'undefined' && module.exports) module.exports = INTRA;
  else root.INTRA = INTRA;
})(typeof window !== 'undefined' ? window : globalThis);
