// Replays the 30-minute signal system (intraday.js) over past weekdays and writes backtest-30m.json.
// Candles from Binance PAXG; 5-hour candles are built from 1-hour ones. One trade open at a time.
// The win-rate-by-score table (shown as "% chance" in the half-hourly updates) uses CAL_DAYS of data.
// Usage: node scripts/backtest-30m.js [days=365] [calibrationDays=730]
// SYSTEM=15: the website-only 15-minute system instead (15m/1h/5h trends, checked every 15 minutes,
// trades followed on 5-minute candles) → backtest-15m.json
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const INTRA = require('../intraday.js');

const DAYS = +(process.argv[2] || 365);
const CAL_DAYS = Math.max(DAYS, +(process.argv[3] || 730));
const API = 'https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT';
const SYS = process.env.SYSTEM === '15'
  ? { name: '15m', slot: INTRA.SLOT15, frames: INTRA.FRAMES15, rule: INTRA.RULE15, fast: '15m', follow: '5m', file: 'backtest-15m.json' }
  : { name: '30m', slot: INTRA.SLOT, frames: INTRA.FRAMES, rule: INTRA.RULE, fast: '30m', follow: '15m', file: 'backtest-30m.json' };
// Experiments: TH=<threshold> SIDES=buy|both override the rule (e.g. SYSTEM=15 TH=4 SIDES=buy)
if (process.env.TH || process.env.SIDES) SYS.rule = { ...SYS.rule, ...(process.env.TH ? { threshold: +process.env.TH } : {}), ...(process.env.SIDES ? { sides: process.env.SIDES } : {}) };
if (process.env.OUT) SYS.file = process.env.OUT;

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
  const start = now - CAL_DAYS * 864e5;
  const tradeFrom = now - DAYS * 864e5;
  // m15 = candles the trades are followed on (15m, or 5m for the 15-minute system); fast = first frame
  const fastMs = SYS.frames[0][1];
  const [m15, fast, h1] = await Promise.all([
    klines(SYS.follow, start, now), klines(SYS.fast, start - 260 * fastMs, now), klines('1h', start - 1400 * 3600e3, now),
  ]);
  const h5 = group(h1, 5 * 3600e3);
  const fastKey = SYS.frames[0][0];
  console.log(`${SYS.name} system · bars: follow(${SYS.follow})=${m15.length} ${SYS.fast}=${fast.length} 1h=${h1.length} 5h=${h5.length}`);

  const trades = [];
  // side → score → how often a hypothetical buy / sell at that half hour hit TP1 before the stop
  const calib = { buy: {}, sell: {} };
  let busyUntil = 0, decisions = 0;
  for (let t = Math.floor(start / SYS.slot) * SYS.slot + SYS.slot; t < now - 864e5; t += SYS.slot) {
    const wd = new Date(t).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const dec = INTRA.decideWith(SYS.frames, SYS.rule, { [fastKey]: before(fast, t), h1: before(h1, t), h5: before(h5, t) }, t);
    if (!dec || dec.stale) continue;
    const price = before(m15, t, 1)[0];
    if (!price) continue;
    // Calibration: every half hour, a hypothetical buy AND a hypothetical sell
    const ahead = before(m15, t + 864e5, SYS.follow === '5m' ? 600 : 200).filter((x) => x.time >= t);
    for (const [side, dir] of [['buy', 1], ['sell', -1]]) {
      const r = SIG.evaluate(INTRA.makeTrade({ ...dec, dir }, price.close, t), ahead, now);
      if (r.status !== 'win' && r.status !== 'loss') continue;
      const c = (calib[side][dec.score] = calib[side][dec.score] || { n: 0, wins: 0, pnl: 0, hit: [0, 0, 0, 0] });
      c.n++; if (r.status === 'win') c.wins++; c.pnl += r.pnl;
      c.hit[r.hit || 0]++; // how far it went: 0 = never reached TP1 … 3 = all targets
    }
    if (t < tradeFrom || t < busyUntil) continue;
    decisions++;
    if (!dec.dir) continue;
    const trade = INTRA.makeTrade(dec, price.close, t);
    const r = SIG.evaluate(trade, before(m15, trade.expiresAt + 1, SYS.follow === '5m' ? 600 : 200).filter((b) => b.time >= t), now);
    trades.push(r);
    busyUntil = (r.exitAt || trade.expiresAt) + 15 * 60e3;
  }

  const s = SIG.summary(trades);
  const days = DAYS * 5 / 7;
  const table = (bySide) => Object.fromEntries(Object.entries(bySide).sort((a, b) => a[0] - b[0]).map(([k, c]) =>
    [k, {
      n: c.n, winRate: Math.round((c.wins / c.n) * 100), avg: SIG.round(c.pnl / c.n),
      // outcome split in %: [never reached TP1, reached TP1 only, reached TP2, reached TP3]
      split: c.hit.map((h) => SIG.round((h / c.n) * 100)),
    }]));
  const calibration = { buy: table(calib.buy), sell: table(calib.sell) };
  const out = { generatedAt: now, days: DAYS, calibrationDays: CAL_DAYS, system: SYS.name, rule: SYS.rule, source: 'Binance PAXG/USDT (จำลอง)', perDay: +(trades.length / days).toFixed(1), summary: s, calibration, trades };
  fs.writeFileSync(path.join(__dirname, '..', SYS.file), JSON.stringify(out));
  for (let k = -6; k <= 6; k++) {
    const b = calibration.buy[k], s2 = calibration.sell[k];
    if (b || s2) console.log(`  score ${String(k).padStart(2)}: buy win=${b ? b.winRate : '-'}% sell win=${s2 ? s2.winRate : '-'}% (n=${b ? b.n : 0})`);
  }
  console.log(`decisions=${decisions} trades=${s.traded} (~${out.perDay}/day) win=${s.winRate}% pnl=$${s.pnl}/oz after-spread≈$${Math.round(s.pnl - 0.4 * s.traded)} TP1/2/3=${s.tp1}/${s.tp2}/${s.tp3}`);
})().catch((e) => { console.error(e); process.exit(1); });
