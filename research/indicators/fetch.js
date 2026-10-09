// Price data for the indicator study: Binance PAXG (gold token) — 2 years of 5m/15m/30m/1h/4h (bars2y.json) and daily /
// weekly since Sep 2019 (long.json), in DATA_DIR. node fetch.js
const fs = require('fs'), path = require('path');
const DIR = process.env.DATA_DIR || __dirname;
const API = 'https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT';
async function klines(interval, start, end) {
  const out = []; let from = start;
  while (from < end) {
    let r;
    for (let k = 0; k < 4; k++) { r = await fetch(`${API}&interval=${interval}&startTime=${from}&endTime=${end}&limit=1000`); if (r.ok) break; await new Promise((s) => setTimeout(s, 2000)); }
    if (!r.ok) throw new Error(`binance ${interval} ${r.status}`);
    const rows = await r.json(); if (!rows.length) break;
    rows.forEach((k) => out.push({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
    from = rows[rows.length - 1][0] + 1; if (rows.length < 1000) break;
  }
  return out.filter((b) => b.time < end); // closed candles only
}
(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const now = Date.now(), from = now - 760 * 864e5, D = { now };
  for (const tf of ['5m', '15m', '30m', '1h', '4h']) { D[tf] = await klines(tf, from, now); console.log(tf, D[tf].length); }
  fs.writeFileSync(path.join(DIR, 'bars2y.json'), JSON.stringify(D));
  const L = { d1: await klines('1d', Date.parse('2019-09-01'), now), w1: await klines('1w', Date.parse('2019-09-01'), now) };
  console.log('1d', L.d1.length, '1w', L.w1.length);
  fs.writeFileSync(path.join(DIR, 'long.json'), JSON.stringify(L));
})().catch((e) => { console.error(e); process.exit(1); });
