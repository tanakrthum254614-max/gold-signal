// MERGED 9 Oct 2026: the 30-minute system now lives in chartsys.js ('30m': same trend rule, TP1 only — tested better)
// and is recorded / sent to LINE by scripts/chart-run.js, so every part of the site shows one system. This script no
// longer opens trades or sends the half-hourly ✅ updates: it finishes a trade still open from before the merge and keeps
// the high-impact-news warning and the investing.com outage warning. The old record stays in intraday.json.
// (Before the merge:) Runs every 5 minutes (with the price alerts): follows the open 30-minute-signal trade and, once per
// half hour, opens a new one when the 30-minute, 1-hour and 5-hour trends strongly agree (buy side
// only, never within ±30 minutes of high-impact US news). Results live in intraday.json. Same opening
// rule as scripts/backtest-30m.js: one trade at a time, a new trade only in a half hour that starts
// at least 15 minutes after the previous one closed.
// Also, while the market is open (07:00–03:00 Thai time, 08:00–04:00 in the US winter):
// - checked every half hour, but SENT only when a side turns ✅ (good to enter) or stops being ✅ — about
//   2 messages a day instead of ~40, so the free LINE plan lasts the month. Each update has a buy and a
//   sell verdict with levels and historical odds (calibration table in backtest-30m.json)
// - safety brake (INTRA.pauseCheck): after 5 losses in a row or −$60/oz this week, no new trades (and no
//   ✅ updates) until next Monday's open; recorded as `pause` in intraday.json so the website shows it
// - ~30 minutes before each high-impact US release, a warning
// What was already announced is kept in STATE_DIR (restored/saved by the workflow's Actions cache).
// Usage: node scripts/intraday-run.js data.json
// Env: LINE_CHANNEL_ACCESS_TOKEN, SEND, RECORD, SITE_URL, STATE_DIR, SPREAD_USD
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const INTRA = require('../intraday.js');
const { money } = require('../dailyplan.js');
const { send } = require('./notify.js');
const { at, targetEvents } = require('./trade-events.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const SPREAD = +(process.env.SPREAD_USD || 0.4);
const FILE = process.env.INTRADAY_FILE || path.join(__dirname, '..', 'intraday.json');
const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '..', 'state');
const STATE_FILE = path.join(STATE_DIR, 'notify.json');
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));

function newsWarning(n, open) {
  const lines = [`⚠️ อีกประมาณ 30 นาที (${at(n.time)} น.) มีข่าวแรงสหรัฐ`, `📰 ${n.title}`,
    `ราคาทองอาจวิ่งแรง $20–50 ในไม่กี่นาที — สัญญาณกรอบ 5 นาที และ 1 ชม. งดเปิดไม้ใหม่ ±${INTRA.RULE.newsMin} นาทีรอบข่าว`];
  if (open) lines.push(`📌 มีไม้${open.side === 'BUY' ? 'ซื้อ' : 'ขาย'}อยู่ที่ ${money(open.entry)} — พิจารณาปิดบางส่วนหรือเลื่อน SL ไปที่ทุนก่อนข่าว`);
  return lines.join('\n');
}

(async function main() {
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const m15 = bars(data.m15);
  if (!m15.length) return console.log('no candles');
  const now = Date.now();
  const news = data.news || [];
  const store = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { trades: [] };
  const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  const snapshot = () => JSON.stringify([store.trades, store.pause]);
  const before = snapshot();
  const important = [], routine = [];

  // 1. Follow the open trade
  const i = store.trades.findIndex((t) => !SIG.isFinal(t));
  if (i >= 0) {
    const t = SIG.evaluate(store.trades[i], m15, now);
    const sent = { ...(t.alerts || {}) };
    const lines = targetEvents(t, sent, now);
    store.trades[i] = { ...t, alerts: sent };
    if (lines.length) { // recorded, not sent (LINE = entry signals and news warnings only)
      console.log(`⏱️ สัญญาณ 30 นาที — ไม้${t.side === 'BUY' ? 'ซื้อ' : 'ขาย'}ที่ ${money(t.entry)} (${at(t.createdAt)} น.)\n${lines.join('\n')}`);
    }
    console.log(`open trade ${t.id} ${t.side} status=${t.status} hit=${t.hit || 0} pnl=${t.pnl}`);
  }

  // 2. (merged into chart-run.js '30m' on 9 Oct 2026: no safety brake, no new trades, no half-hourly ✅ updates here)
  // 3. A warning ~30 minutes before high-impact news
  const open = store.trades.find((t) => !SIG.isFinal(t));
  const warned = new Set(state.warned || []);
  const soon = INTRA.marketOpen(now) ? news.filter((n) => n.time > now && n.time - now <= 40 * 60e3 && !warned.has(n.time)) : [];
  soon.forEach((n) => { routine.push(newsWarning(n, open)); warned.add(n.time); });

  // 4. investing.com unreachable for over 30 minutes → tell the owner (at most every 6 hours)
  const next = { ...state };
  if (data.source !== 'investing.com') {
    next.backupSince = state.backupSince || now;
    if (now - next.backupSince > 30 * 60e3 && (!state.backupWarned || now - state.backupWarned > 6 * 3600e3)) {
      console.log('⚠️ investing.com unreachable for over 30 minutes — using the Binance backup'); // not sent to members
      next.backupWarned = now;
    }
  } else delete next.backupSince;

  await send([...important, ...routine]);

  if (process.env.RECORD === 'true') {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const keep = [...warned].filter((t) => t > now - 864e5); // forget old warnings
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...next, warned: keep, at: now }));
  }
  if (snapshot() === before) return console.log('trades unchanged');
  store.summary = SIG.summary(store.trades, SPREAD);
  store.updatedAt = now;
  if (process.env.RECORD === 'true') {
    fs.writeFileSync(FILE, `${JSON.stringify(store, null, 1)}\n`);
    console.log('✓ intraday.json updated');
  }
})().catch((e) => { console.error(e); process.exit(1); });
