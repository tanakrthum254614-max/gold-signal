// Trading signals: one per weekday morning (the daily plan's main trade), scored against
// 15-minute candles. Shared by the website and the Node scripts.
(function (root) {
  const DAY = 24 * 3600e3;

  // Thai calendar date of a timestamp, e.g. "2026-10-06"
  const thaiDate = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);

  // Turn today's plan into a signal record
  function make(plan, createdAt, price, extra = {}) {
    const p = plan.primary;
    if (!p) return null;
    const a = Math.abs(plan.score);
    const id = thaiDate(createdAt);
    return {
      id,
      createdAt,
      // Valid until 06:45 Thai time the next day, just before the next morning signal
      expiresAt: expiry(id),
      side: p.side,
      entry: round(p.entry), sl: round(p.sl), tp: round(p.tp1),
      level: p.at.name,
      trend: plan.trend,
      stars: a >= 1.5 ? 5 : a >= 1.1 ? 4 : a >= 0.75 ? 3 : a >= 0.5 ? 2 : 1,
      priceAtSignal: round(price),
      status: 'pending',
      ...extra,
    };
  }
  const round = (v) => Math.round(v * 100) / 100;
  const expiry = (id) => Date.parse(`${id}T00:00:00+07:00`) + DAY + (6 * 60 + 45) * 60e3;

  // "Enter now" short-trade rule: a signal every weekday in the direction of the short + medium +
  // long-term trend (ties go to the medium term), at the current price with a $15 stop and three
  // targets at $15 / $20 / $30. A third closes at each target; after TP1 the stop moves to entry.
  // Stars show how strongly the three timeframes agree (|trend| 0–6).
  const RULE = { minTrend: 0, slUsd: 15, tpUsd: [15, 20, 30] };
  const STARS = [1, 2, 3, 3, 4, 5, 5];
  const STRENGTH = { strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2 };
  function makeMarket({ bias, price, createdAt, extra = {} }) {
    const id = thaiDate(createdAt);
    const mid = STRENGTH[bias.mid] || 0;
    const trend = (STRENGTH[bias.short] || 0) + mid + (STRENGTH[bias.long] || 0);
    const base = { id, createdAt, expiresAt: expiry(id), rule: 'market-trend', trendScore: trend, priceAtSignal: round(price), ...extra };
    if (Math.abs(trend) < RULE.minTrend) return { ...base, status: 'skip' };
    const buy = trend > 0 || (trend === 0 && mid >= 0), d = buy ? 1 : -1;
    return {
      ...base, market: true, side: buy ? 'BUY' : 'SELL',
      entry: round(price), sl: round(price - d * RULE.slUsd),
      tps: RULE.tpUsd.map((u) => round(price + d * u)), tp: round(price + d * RULE.tpUsd[0]),
      stars: STARS[Math.min(6, Math.abs(trend))], status: 'active', entryAt: createdAt,
    };
  }

  // bars: [{ time (ms), open, high, low, close }] sorted by time. Returns the signal's state at `now`.
  // Three-target trade: ⅓ closes at each target, stop moves to entry after TP1. A candle that touches
  // the stop is treated as hitting it before any target (conservative). pnl is $ per 1 oz position.
  function evaluateTargets(sig, bars, now) {
    const buy = sig.side === 'BUY', d = buy ? 1 : -1;
    const n = sig.tps.length, part = 1 / n;
    const end = Math.min(now, sig.expiresAt);
    let stop = sig.sl, hit = 0, realized = 0, last = null;
    const hitAt = [];
    const finish = (status, closedBy, exitPrice, at) => ({ ...sig, status, closedBy, exitPrice, exitAt: at, entryAt: sig.createdAt,
      hit, hitAt, stop, pnl: round(realized) });
    for (const b of bars) {
      if (b.time < sig.createdAt || b.time >= end) continue;
      last = b;
      if (buy ? b.low <= stop : b.high >= stop) {
        realized += (n - hit) * part * d * (stop - sig.entry);
        return hit ? finish('win', 'be', stop, b.time) : finish('loss', 'sl', stop, b.time);
      }
      while (hit < n && (buy ? b.high >= sig.tps[hit] : b.low <= sig.tps[hit])) {
        realized += part * Math.abs(sig.tps[hit] - sig.entry);
        hitAt.push(b.time);
        hit++;
        stop = sig.entry; // breakeven once the first target is in
      }
      if (hit === n) return finish('win', 'tp', sig.tps[n - 1], b.time);
    }
    if (!last) return { ...sig, status: 'active', hit, stop, pnl: 0 };
    const px = last.close;
    const open = (n - hit) * part * d * (px - sig.entry);
    if (now >= sig.expiresAt) {
      realized += open;
      return finish(hit || realized >= 0 ? 'win' : 'loss', 'eod', px, last.time);
    }
    return { ...sig, status: 'active', hit, hitAt, stop, realized: round(realized), pnl: round(realized + open), last: px };
  }

  function evaluate(sig, bars, now = Date.now()) {
    if (sig.status === 'skip') return sig;
    if (sig.tps) return evaluateTargets(sig, bars, now);
    const buy = sig.side === 'BUY';
    const end = Math.min(now, sig.expiresAt);
    // Market signals are filled at creation; follow them from the next candle on
    let entered = sig.market ? sig.createdAt : null;
    let last = null;
    for (const b of bars) {
      if ((sig.market ? b.time < sig.createdAt : b.time + 15 * 60e3 <= sig.createdAt) || b.time >= end) continue;
      last = b;
      if (!entered) {
        const touched = buy ? b.low <= sig.entry : b.high >= sig.entry;
        if (!touched) continue;
        entered = b.time;
        // Same candle that filled us also hit the stop: count it as a loss (conservative)
        if (buy ? b.low <= sig.sl : b.high >= sig.sl) return done('loss', sig.sl, b.time);
        continue;
      }
      const hitSl = buy ? b.low <= sig.sl : b.high >= sig.sl;
      const hitTp = buy ? b.high >= sig.tp : b.low <= sig.tp;
      if (hitSl) return done('loss', sig.sl, b.time); // both in one candle → loss
      if (hitTp) return done('win', sig.tp, b.time);
    }
    const over = now >= sig.expiresAt;
    if (!entered) return { ...sig, status: over ? 'expired' : 'pending', pnl: 0, last: last && last.close };
    if (!last) return { ...sig, status: 'active', entryAt: entered, pnl: 0 };
    const px = last.close;
    const pnl = round(buy ? px - sig.entry : sig.entry - px);
    if (over) return { ...sig, status: pnl >= 0 ? 'win' : 'loss', closedBy: 'eod', exitPrice: px, exitAt: last.time, entryAt: entered, pnl };
    return { ...sig, status: 'active', entryAt: entered, pnl, last: px };

    function done(status, exitPrice, at) {
      return { ...sig, status, closedBy: status === 'win' ? 'tp' : 'sl', exitPrice, exitAt: at, entryAt: entered,
        pnl: round(buy ? exitPrice - sig.entry : sig.entry - exitPrice) };
    }
  }

  const FINAL = ['win', 'loss', 'expired', 'skip'];
  const isFinal = (s) => FINAL.includes(s.status);

  function summary(signals) {
    const done = signals.filter((s) => isFinal(s) && s.status !== 'skip');
    const traded = done.filter((s) => s.status !== 'expired');
    const wins = traded.filter((s) => s.status === 'win').length;
    const losses = traded.length - wins;
    const pnl = round(traded.reduce((a, s) => a + (s.pnl || 0), 0));
    return {
      total: done.length, traded: traded.length, wins, losses,
      expired: done.length - traded.length,
      winRate: traded.length ? Math.round((wins / traded.length) * 100) : null,
      pnl, avg: traded.length ? round(pnl / traded.length) : null,
      bestWin: traded.reduce((m, s) => Math.max(m, s.pnl || 0), 0),
      worstLoss: traded.reduce((m, s) => Math.min(m, s.pnl || 0), 0),
      last: done.slice(-10),
      // How far the three-target trades went
      tp1: traded.filter((s) => (s.hit || 0) >= 1).length,
      tp2: traded.filter((s) => (s.hit || 0) >= 2).length,
      tp3: traded.filter((s) => (s.hit || 0) >= 3).length,
    };
  }

  const STATUS_TH = {
    pending: '⏳ รอราคาถึงจุดเข้า', active: '🟦 เข้าแล้ว กำลังวิ่ง', win: '✅ ชนะ', loss: '❌ แพ้', expired: '⏹ ราคาไม่ถึงจุดเข้า', skip: '⏸ ไม่มีสัญญาณ (ตลาดไม่ชัด)',
  };

  const SIG = { thaiDate, make, makeMarket, RULE, evaluate, summary, isFinal, STATUS_TH, round };
  if (typeof module !== 'undefined' && module.exports) module.exports = SIG;
  else root.SIG = SIG;
})(typeof window !== 'undefined' ? window : globalThis);
