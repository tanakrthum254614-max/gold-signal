// Replays the daily-signal system over past weekdays and writes backtest.json.
// investing.com's technical summaries have no history, so the trend bias here comes from our own
// indicator engine on Binance PAXG candles; entry/stop/target and scoring are the live rules
// (SIG.makeMarket: 5-star days only, enter at 07:00 Thai, fixed $ stop and target).
// Usage: node scripts/backtest.js [days=120]
const fs = require('fs');
const path = require('path');
const TA = require('../indicators.js');
const SIG = require('../signals.js');

const DAYS = +(process.argv[2] || 120);
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

const key = (cs) => TA.analyze(cs).label.key.replace('-', '_');

(async function main() {
  const now = Date.now();
  const start = now - DAYS * 24 * 3600e3;
  const [m15, h1, h4, d1] = await Promise.all([
    klines('15m', start, now),
    klines('1h', start - 320 * 3600e3, now),
    klines('4h', start - 320 * 4 * 3600e3, now),
    klines('1d', start - 320 * 24 * 3600e3, now),
  ]);
  console.log(`bars: 15m=${m15.length} 1h=${h1.length} 4h=${h4.length} 1d=${d1.length}`);

  const signals = [];
  for (let t = Math.ceil(start / 864e5) * 864e5; t < now - 24 * 3600e3; t += 864e5) {
    const wd = new Date(t).getUTCDay();
    if (wd === 0 || wd === 6) continue; // weekdays only, signal at 00:00 UTC = 07:00 Thai
    const upto = (bars, ms) => bars.filter((b) => b.time + ms <= t).slice(-300);
    const hh = upto(h1, 3600e3), h44 = upto(h4, 4 * 3600e3), dd = upto(d1, 864e5);
    if (hh.length < 60 || dd.length < 60) continue;
    const price = hh[hh.length - 1].close;
    const sig = SIG.makeMarket({ bias: { short: key(hh), mid: key(h44), long: key(dd) }, price, createdAt: t });
    signals.push(SIG.evaluate(sig, m15, now));
  }

  const s = SIG.summary(signals);
  const out = { generatedAt: now, days: DAYS, rule: SIG.RULE, source: 'Binance PAXG/USDT (จำลอง)', summary: s, signals };
  fs.writeFileSync(path.join(__dirname, '..', 'backtest.json'), JSON.stringify(out));
  console.log(`days=${signals.length} signals=${s.total} skipped=${signals.length - s.total} win=${s.wins} loss=${s.losses} winRate=${s.winRate}% pnl=${s.pnl}/oz avg=${s.avg}`);
  const byStars = {};
  signals.filter((x) => x.status === 'win' || x.status === 'loss').forEach((x) => {
    const b = (byStars[x.stars] = byStars[x.stars] || { n: 0, w: 0, pnl: 0 });
    b.n++; if (x.status === 'win') b.w++; b.pnl += x.pnl;
  });
  Object.entries(byStars).forEach(([k, v]) => console.log(`  ${k}★ trades=${v.n} win=${Math.round((v.w / v.n) * 100)}% pnl=$${v.pnl.toFixed(0)}`));
})().catch((e) => { console.error(e); process.exit(1); });
