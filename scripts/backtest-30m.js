// Replays the 30-minute signal system (intraday.js) over past weekdays and writes backtest-30m.json.
// Candles from Binance PAXG; 5-hour candles are built from 1-hour ones. One trade open at a time.
// Usage: node scripts/backtest-30m.js [days=365]
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const INTRA = require('../intraday.js');

const DAYS = +(process.argv[2] || 365);
const API = 'https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT';

async function klines(interval, start, end) {
  const out = [];
  let from = start;
  while (from < end) {
    const r = await fetch(`${API}&interval=${interval}&startTime=${from}&endTime=${end}&limit=1000`);
    if (!r.ok) throw new Error(`binance ${r.status}`);
    const rows = await r.json();
    if (!rows.length) break;
    rows.forEach((k) => out.push({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
    from = rows[rows.length - 1][0] + 1;
    if (rows.length < 1000) break;
  }
  return out;
}

function group(bars, ms) {
  const out = [];
  for (const b of bars) {
    const t = Math.floor(b.time / ms) * ms;
    const last = out[out.length - 1];
    if (last && last.time === t) {
      last.high = Math.max(last.high, b.high); last.low = Math.min(last.low, b.low); last.close = b.close;
    } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close });
  }
  return out;
}

// Bars that started before `t`, last `n` of them (binary search keeps this fast)
function before(bars, t, n = 260) {
  let lo = 0, hi = bars.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].time < t) lo = m + 1; else hi = m; }
  return bars.slice(Math.max(0, lo - n), lo);
}

(async function main() {
  const now = Date.now();
  const start = now - DAYS * 864e5;
  const [m15, m30, h1] = await Promise.all([
    klines('15m', start, now), klines('30m', start - 260 * 30 * 60e3, now), klines('1h', start - 1400 * 3600e3, now),
  ]);
  const h5 = group(h1, 5 * 3600e3);
  console.log(`bars: 15m=${m15.length} 30m=${m30.length} 1h=${h1.length} 5h=${h5.length}`);

  const trades = [];
  let busyUntil = 0, decisions = 0;
  for (let t = INTRA.slotOf(start) + INTRA.SLOT; t < now - 864e5; t += INTRA.SLOT) {
    const wd = new Date(t).getUTCDay();
    if (wd === 0 || wd === 6 || t < busyUntil) continue;
    const dec = INTRA.decide({ m30: before(m30, t), h1: before(h1, t), h5: before(h5, t) }, t);
    if (!dec) continue;
    decisions++;
    if (!dec.dir) continue;
    const price = before(m15, t, 1)[0];
    if (!price) continue;
    const trade = INTRA.makeTrade(dec, price.close, t);
    const r = SIG.evaluate(trade, before(m15, trade.expiresAt + 1, 200).filter((b) => b.time >= t), now);
    trades.push(r);
    busyUntil = (r.exitAt || trade.expiresAt) + 15 * 60e3;
  }

  const s = SIG.summary(trades);
  const days = DAYS * 5 / 7;
  const out = { generatedAt: now, days: DAYS, rule: INTRA.RULE, source: 'Binance PAXG/USDT (จำลอง)', perDay: +(trades.length / days).toFixed(1), summary: s, trades };
  fs.writeFileSync(path.join(__dirname, '..', 'backtest-30m.json'), JSON.stringify(out));
  console.log(`decisions=${decisions} trades=${s.traded} (~${out.perDay}/day) win=${s.winRate}% pnl=$${s.pnl}/oz after-spread≈$${Math.round(s.pnl - 0.4 * s.traded)} TP1/2/3=${s.tp1}/${s.tp2}/${s.tp3}`);
})().catch((e) => { console.error(e); process.exit(1); });
