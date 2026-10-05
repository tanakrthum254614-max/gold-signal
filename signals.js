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
      expiresAt: Date.parse(`${id}T00:00:00+07:00`) + DAY + (6 * 60 + 45) * 60e3,
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

  // bars: [{ time (ms), open, high, low, close }] sorted by time. Returns the signal's state at `now`.
  function evaluate(sig, bars, now = Date.now()) {
    const buy = sig.side === 'BUY';
    const end = Math.min(now, sig.expiresAt);
    let entered = null;
    let last = null;
    for (const b of bars) {
      if (b.time + 15 * 60e3 <= sig.createdAt || b.time >= end) continue;
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
    const px = last.close;
    const pnl = round(buy ? px - sig.entry : sig.entry - px);
    if (over) return { ...sig, status: pnl >= 0 ? 'win' : 'loss', closedBy: 'eod', exitPrice: px, exitAt: last.time, entryAt: entered, pnl };
    return { ...sig, status: 'active', entryAt: entered, pnl, last: px };

    function done(status, exitPrice, at) {
      return { ...sig, status, closedBy: status === 'win' ? 'tp' : 'sl', exitPrice, exitAt: at, entryAt: entered,
        pnl: round(buy ? exitPrice - sig.entry : sig.entry - exitPrice) };
    }
  }

  const FINAL = ['win', 'loss', 'expired'];
  const isFinal = (s) => FINAL.includes(s.status);

  function summary(signals) {
    const done = signals.filter(isFinal);
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
    };
  }

  const STATUS_TH = {
    pending: '⏳ รอราคาถึงจุดเข้า', active: '🟦 เข้าแล้ว กำลังวิ่ง', win: '✅ ชนะ', loss: '❌ แพ้', expired: '⏹ ราคาไม่ถึงจุดเข้า',
  };

  const SIG = { thaiDate, make, evaluate, summary, isFinal, STATUS_TH, round };
  if (typeof module !== 'undefined' && module.exports) module.exports = SIG;
  else root.SIG = SIG;
})(typeof window !== 'undefined' ? window : globalThis);
