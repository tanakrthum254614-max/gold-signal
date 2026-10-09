// Records every real entry of the chart-tab systems (chartsys.js) on all seven timeframes in chart-signals.json,
// so the website can compare live results with the backtest. Runs in every 5-minute check (check-loop.sh).
// Candles: investing.com 15m/30m/1h/5h from data.json where present; 5m, 4h, 1d, 1w (and anything missing)
// from Binance PAXG shifted onto the investing.com price — the same mix the chart tab uses.
// LINE: new entries and exits for the timeframes in CHART_NOTIFY (default 30m,1h,5h,1d,1w). 30m = the site's main
// system since 9 Oct 2026 — the old 30-minute system (intraday-run.js) was merged into it, so LINE, the signals tab and
// the stats show one record.
// Usage: node scripts/chart-run.js data.json      Env: RECORD, SEND / OUTBOX (notify.js), CHART_NOTIFY, SITE_URL
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const INTRA = require('../intraday.js');
const CS = require('../chartsys.js');
const { send } = require('./notify.js');
const { signed } = require('./trade-events.js');
// One set of test numbers everywhere (monthly study → test-stats.json)
try { CS.applyStats(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-stats.json'), 'utf8'))); } catch (e) { /* keep chartsys.js numbers */ }

const ROOT = path.join(__dirname, '..');
const FILE = process.env.CHART_FILE || path.join(ROOT, 'chart-signals.json'); // CHART_FILE / CHART_NOW: tests only
const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const NOTIFY = (process.env.CHART_NOTIFY || '30m,1h,5h,1d,1w').split(',').map((s) => s.trim()).filter(Boolean);
const TF_TH = { '5m': '5 นาที', '15m': '15 นาที', '30m': '30 นาที', '1h': '1 ชม.', '5h': '5 ชม.', '1d': '1 วัน', '1w': '1 สัปดาห์' };
const API = 'https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT';
const H = 3600e3;

async function klines(interval, limit) {
  const r = await fetch(`${API}&interval=${interval}&limit=${limit}`);
  if (!r.ok) throw new Error(`binance ${interval} ${r.status}`);
  const now = +process.env.CHART_NOW || Date.now();
  return (await r.json()).map((k) => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4] })).filter((b) => b.time < now);
}
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const shift = (rows, off) => rows.map((b) => ({ ...b, open: b.open + off, high: b.high + off, low: b.low + off, close: b.close + off }));
const when = (tf, ms) => new Date(ms).toLocaleString('th-TH', CS.SYS[tf].long
  ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }
  : { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const f2 = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const keep = ({ why, stars, rule, market, ...t }) => t; // drop the long explanation fields

(async function main() {
  const now = +process.env.CHART_NOW || Date.now();
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const [m5, m15b, h1b, h4, d1, w1] = await Promise.all([klines('5m', 1000), klines('15m', 200), klines('1h', 1000), klines('4h', 200), klines('1d', 200), klines('1w', 200)]);
  // PAXG trades a few dollars off spot gold: line Binance up with the investing.com price the site shows
  const inv = bars(data.m15);
  const off = inv.length ? inv[inv.length - 1].close - m15b[m15b.length - 1].close : 0;
  const h5b = [];
  h1b.forEach((b) => { const t = Math.floor(b.time / (5 * H)) * 5 * H, l = h5b[h5b.length - 1];
    if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else h5b.push({ ...b, time: t }); });
  const pick = (key, backup) => (data[key] && data[key].length ? bars(data[key]) : shift(backup, off));
  const C = {
    m5: shift(m5, off), m15: pick('m15', m15b), m30: pick('m30', []), h1: pick('h1', h1b.slice(-200)), h4: shift(h4, off),
    h5: pick('h5', h5b.slice(-160)), d1: shift(d1, off), w1: shift(w1, off),
  };
  if (!C.m30.length) C.m30 = shift(await klines('30m', 200), off);
  // Candles that follow open trades: 5-minute for intraday, 1-hour for 5h/1d (held days to weeks), daily for 1w
  const follow = { '5h': shift(h1b, off), '1d': shift(h1b, off), '1w': C.d1 };

  const store = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { startedAt: now, trades: [] };
  const before = JSON.stringify(store.trades);
  const texts = [];

  // 1) follow open trades
  store.trades = store.trades.map((t) => {
    if (SIG.isFinal(t)) return t;
    const r = keep(SIG.evaluate(t, (follow[t.tf] || C.m5).filter((b) => b.time >= t.createdAt), now));
    // Exits are recorded but not sent: LINE carries only entry signals and news warnings (user, 9 Oct 2026)
    if (SIG.isFinal(r)) console.log(`${r.tf}: closed ${r.side} ${f2(r.entry)} ${r.closedBy || ''} ${signed(r.pnl)}`);
    return r;
  });

  // 2) new entries: decided once per candle, at the open of the candle after the one that closed
  for (const [tf, sys] of Object.entries(CS.SYS)) {
    const [key, dur] = sys.frames[0];
    const fast = C[key].filter((b) => b.time + dur <= now);
    if (fast.length < 61) continue;
    const t = fast[fast.length - 1].time + dur;
    if (now - t > (sys.long ? 2 * H : Math.min(dur, 10 * 60e3))) continue; // missed this candle: never enter late
    const mine = store.trades.filter((x) => x.tf === tf);
    if (mine.some((x) => x.createdAt >= t || !SIG.isFinal(x) || (x.exitAt || x.expiresAt) + dur > t)) continue; // one at a time
    const data2 = Object.fromEntries(sys.frames.map(([k]) => [k, C[k]]));
    const dec = CS.decide(sys, data2, t, data.news || []);
    const dir = CS.dirOf(sys, dec);
    if (!dir) continue;
    // While the safety brake is on, keep recording (so it can lift by itself) but don't announce
    const paused = !!CS.brake(sys, mine, now);
    const tr = keep({ ...CS.trade(sys, dec, dir, fast[fast.length - 1].close, t), tf, id: `${tf}-${t}`, score: dec.score, ...(paused ? { paused } : {}) });
    store.trades.push(tr);
    console.log(`${tf}: ${tr.side} ${tr.entry} SL ${tr.sl} TP ${tr.tps.join('/')} (score ${dec.score})${paused ? ' — paused, not announced' : ''}`);
    if (NOTIFY.includes(tf) && !paused) {
      const c = dir > 0 ? sys.buy : sys.sell;
      texts.push(`${tf === '30m' ? '⏱️ สัญญาณ 30 นาที (ระบบหลัก)' : `🎯 สัญญาณกราฟ ${TF_TH[tf]}`} · ${dir > 0 ? '🟢 ซื้อ (BUY)' : '🔴 ขาย (SELL)'}\n`
        + `เข้า ~${f2(tr.entry)} · SL ${f2(tr.sl)} · ${tr.tps.map((v, k) => `TP${k + 1} ${f2(v)}`).join(' · ')}\n`
        + `แท่ง ${when(tf, t - dur)} ปิดแล้ว · คะแนน ${dec.score > 0 ? '+' : ''}${dec.score} · ทดสอบชนะ ${c.win}% (ไม่รับประกัน)\n${SITE_URL}/#chart`);
    }
  }

  // 3) safety brake on / off since the last run
  const brakes = {};
  for (const [tf, sys] of Object.entries(CS.SYS)) {
    const b = CS.brake(sys, store.trades.filter((x) => x.tf === tf), now);
    if (b) brakes[tf] = b;
    const was = (store.brakes || {})[tf];
    if (!NOTIFY.includes(tf) || !!was === !!b) continue;
    // recorded (the website shows ⛔) but not sent — LINE is entry signals and news warnings only
    console.log(b
      ? `⛔ พักสัญญาณกราฟ ${TF_TH[tf]}: ${b.why}
หยุดแจ้ง${b.until ? `ถึง ${when('1d', b.until)}` : 'จนกว่าผล 20 ไม้ล่าสุดจะกลับมาใกล้ผลทดสอบ'} · ระบบยังบันทึกต่อแบบไม่แจ้ง`
      : `✅ กลับมาแจ้งสัญญาณกราฟ ${TF_TH[tf]} แล้ว`);
  }
  const brakesChanged = JSON.stringify(brakes) !== JSON.stringify(store.brakes || {});
  store.brakes = brakes;

  store.trades = store.trades.slice(-600);
  if (JSON.stringify(store.trades) === before && !brakesChanged) return console.log('chart signals: no change');
  store.updatedAt = now;
  if (process.env.RECORD === 'true') fs.writeFileSync(FILE, `${JSON.stringify(store, null, 1)}\n`);
  else console.log(`(not recorded) ${store.trades.length} trades`);
  await send(texts);
})().catch((e) => { console.error(e); process.exit(1); });
