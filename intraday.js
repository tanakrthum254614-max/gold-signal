// 30-minute signals: every half hour, check whether the 30-minute, 1-hour and 5-hour trends
// strongly agree. If they do and no trade is open, enter at the current price with a $15 stop and
// targets at $15 / $20 / $30. Shared by the website and the Node scripts (needs TA and SIG).
(function (root) {
  const TA = root.TA || (typeof require === 'function' ? require('./indicators.js') : null);
  const SIG = root.SIG || (typeof require === 'function' ? require('./signals.js') : null);

  // sides: which official (recorded) trades to open — 'buy' or 'both'. Over 2 years a hypothetical sell
  // never beat ~53% at any score (buys reach 56–58%), so official trades are buys; the half-hourly
  // update still rates both sides. newsMin: no new trades ± this many minutes around high-impact US news.
  // pause: stop opening trades until next Monday 07:00 after `streak` losses in a row, or when this
  // week's result after spread reaches −weekLoss dollars per ounce (safety brake when live results go bad).
  const RULE = { threshold: 5, slUsd: 15, tpUsd: [15, 20, 30], maxHoldMs: 24 * 3600e3, sides: 'buy', newsMin: 30, pause: { streak: 5, weekLoss: 60 } };
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

  // Timeframes voting in each system: [candle key, candle length, minimum closed candles, Thai label].
  // The first one is the fast frame (used to spot a closed market / stale prices).
  const FRAMES = [['m30', 30 * 60e3, 60, '30 นาที'], ['h1', 3600e3, 60, '1 ชม.'], ['h5', 5 * 3600e3, 40, '5 ชม.']];

  // candles: { <frame key>: [{ time (ms), open, high, low, close }] }; news: upcoming releases
  // live: also use the candles still forming (for the website's real-time view). Official decisions
  // (LINE, recorded trades, backtest) use closed candles only. rule: { threshold, sides }.
  function decideWith(frames, rule, candles, now = Date.now(), news = null, live = false) {
    const pick = (bars, dur) => (live ? bars.filter((b) => b.time <= now).slice(-200) : closed(bars, dur, now));
    const cs = frames.map(([k, dur]) => pick(candles[k] || [], dur));
    if (cs.some((c, i) => c.length < frames[i][2])) return null;
    const keys = Object.fromEntries(frames.map(([k], i) => [k, trendKey(cs[i])]));
    const v = frames.map(([k]) => STRENGTH[keys[k]]);
    const score = v.reduce((a, b) => a + b, 0);
    // Direction to lean even when the score is too weak for a trade: middle, then slow, then fast frame
    const lean = Math.sign(score) || Math.sign(v[1]) || Math.sign(v[2]) || Math.sign(v[0]);
    const open = marketOpen(now);
    const lastHour = open && thai(now).h === HOURS.lastEntry; // 02:00–03:00: too close to the close
    const fast = cs[0];
    const stale = !open || now - fast[fast.length - 1].time > 2 * 3600e3; // market closed / no prices
    const event = newsNear(news, now);
    const sideOk = rule.sides !== 'buy' || score > 0;
    return {
      slot: slotOf(now), score, keys, lean, rule,
      frames: frames.map(([k, , , label]) => ({ key: k, label, trend: keys[k] })),
      dir: Math.abs(score) >= rule.threshold && sideOk && !lastHour && !stale && !event ? Math.sign(score) : 0,
      lastHour, stale, open, news: event, sellSkipped: Math.abs(score) >= rule.threshold && !sideOk,
    };
  }
  // The 30-minute system (LINE + recorded trades)
  const decide = (candles, now, news, live) => decideWith(FRAMES, RULE, candles, now, news, live);

  // The 15-minute system: website only (no LINE, nothing recorded) — re-checked whenever a 15-minute
  // candle closes; same scoring with a faster first frame. Calibrated by `SYSTEM=15 node scripts/backtest-30m.js`.
  const FRAMES15 = [['m15', 15 * 60e3, 60, '15 นาที'], ['h1', 3600e3, 60, '1 ชม.'], ['h5', 5 * 3600e3, 40, '5 ชม.']];
  // Buy only at +5: over 1 year (after a $0.4 spread) this was the only setting that made money —
  // both sides −$131, buy +3 −$460, +4 −$198, +5 +$97 (~1.4 trades a day), +6 +$37.
  const RULE15 = { ...RULE, threshold: 5, sides: 'buy' };
  const SLOT15 = 15 * 60e3;
  const decide15 = (candles, now, news, live) => decideWith(FRAMES15, RULE15, candles, now, news, live);

  // Plain-Thai reasons for a decision
  function reasons(dec) {
    const rule = dec.rule || RULE;
    const lines = [`แนวโน้ม ${dec.frames.map((f) => `${f.label} ${TREND_TH[f.trend]}`).join(' · ')} (คะแนน ${dec.score > 0 ? '+' : ''}${dec.score} จาก ±6)`];
    if (dec.stale) lines.push('ตลาดปิดอยู่ (เปิด 07:00–03:00 น.) — ไม่เปิดไม้ใหม่');
    else if (dec.lastHour) lines.push('ใกล้ปิดตลาด 03:00 น. — ไม่เปิดไม้ใหม่ในชั่วโมงสุดท้าย');
    else if (dec.news) lines.push(`📰 ช่วงข่าวแรง: ${dec.news.title} — ไม่เปิดไม้ใหม่ ±${RULE.newsMin} นาทีรอบข่าว`);
    else if (dec.sellSkipped) lines.push('แนวโน้มลงชัด แต่ระบบเข้าเฉพาะฝั่งซื้อ (สถิติ 2 ปี ฝั่งขายชนะแค่ ~50%) — แนะนำรอ');
    else if (!dec.dir) lines.push(`ต้องได้คะแนน ${rule.sides === 'buy' ? '+' : '±'}${rule.threshold} ขึ้นไปถึงจะเข้า (ทั้ง 3 ช่วงเวลาต้องชี้ทางเดียวกันชัดเจน)`);
    return lines;
  }

  // Historical odds at a score, from the calibration table in backtest-30m.json:
  // { buy: { "<score>": { n, winRate, avg, split } }, sell: {...} } — winRate = % of hypothetical trades on
  // that side, opened at that score, that ended in profit (TP1 reached, or closed in profit at the time
  // limit); split = % that never reached TP1 / reached TP1 / TP2 / TP3. side defaults to the score's sign.
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

  // Monday 07:00 Thai time of the week containing `now`, and of the following week
  function weekStart(now) {
    const th = new Date(now + 7 * 3600e3);
    const monday = new Date(now + 7 * 3600e3 - ((th.getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
    const t = Date.parse(`${monday}T07:00:00+07:00`);
    return t > now ? t - 7 * 864e5 : t; // Monday before 07:00 still belongs to last week
  }
  const nextWeek = (now) => weekStart(now) + 7 * 864e5;

  // Should the system stop opening trades? trades: recorded trades; since: ignore trades before this
  // (the end of the previous pause). Returns { reason } or null.
  function pauseCheck(trades, now, spread = 0, since = 0) {
    const done = trades.filter((t) => (t.status === 'win' || t.status === 'loss') && t.createdAt >= since);
    const P = RULE.pause;
    const last = done.slice(-P.streak);
    if (last.length === P.streak && last.every((t) => t.status === 'loss')) return { reason: `แพ้ติดกัน ${P.streak} ไม้` };
    const week = done.filter((t) => t.createdAt >= weekStart(now)).reduce((a, t) => a + t.pnl - spread, 0);
    if (week <= -P.weekLoss) return { reason: `ขาดทุนสัปดาห์นี้ −$${Math.abs(SIG.round(week))}/ออนซ์ (เกินเพดาน $${P.weekLoss})` };
    return null;
  }
  const paused = (store, now) => !!(store && store.pause && now < store.pause.until);

  const INTRA = { RULE, FRAMES, decideWith, FRAMES15, RULE15, SLOT15, decide15, weekStart, nextWeek, pauseCheck, paused, SLOT, HOURS, slotOf, closed, marketOpen, nextClose, newsNear, decide, reasons, odds, verdict, levels, makeTrade, TREND_TH };
  if (typeof module !== 'undefined' && module.exports) module.exports = INTRA;
  else root.INTRA = INTRA;
})(typeof window !== 'undefined' ? window : globalThis);
