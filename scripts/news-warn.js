// ⚠️ High-impact US news warning (~30 minutes before the release) for LINE — the part of the old 30-minute system that
// is still useful. 17 Oct 2026 (user: "ทำมา" — trim what isn't important): the old system's trade-following and its
// intraday.json record were removed (no trades left since the 9 Oct merge into chartsys.js / scripts/chart-run.js).
// Also notes in the log when investing.com has been unreachable for 30+ minutes. Runs in every 5-minute check.
// What was already announced is kept in STATE_DIR (restored/saved by the workflow's Actions cache).
// Usage: node scripts/news-warn.js data.json   Env: LINE_CHANNEL_ACCESS_TOKEN, SEND, RECORD, STATE_DIR
const fs = require('fs');
const path = require('path');
const INTRA = require('../intraday.js');
const { send } = require('./notify.js');
const { at } = require('./trade-events.js');
const { money } = require('../dailyplan.js');

const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '..', 'state');
const STATE_FILE = path.join(STATE_DIR, 'notify.json');

function newsWarning(n, open) {
  const lines = [`⚠️ อีกประมาณ 30 นาที (${at(n.time)} น.) มีข่าวแรงสหรัฐ`, `📰 ${n.title}`,
    `ราคาทองอาจวิ่งแรง $20–50 ในไม่กี่นาที — สัญญาณกรอบ 5 นาที และ 1 ชม. งดเปิดรายการใหม่ ±${INTRA.RULE.newsMin} นาทีรอบข่าว`];
  if (open) lines.push(`📌 มีรายการ${open.side === 'BUY' ? 'ซื้อ' : 'ขาย'}อยู่ที่ ${money(open.entry)} — พิจารณาปิดบางส่วนหรือเลื่อน SL ไปที่ทุนก่อนข่าว`);
  return lines.join('\n');
}

(async function main() {
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const now = Date.now();
  const news = data.news || [];
  const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  const warned = new Set(state.warned || []);
  const soon = INTRA.marketOpen(now) ? news.filter((n) => n.time > now && n.time - now <= 40 * 60e3 && !warned.has(n.time)) : [];
  const routine = soon.map((n) => { warned.add(n.time); return newsWarning(n, null); });

  // investing.com unreachable for over 30 minutes → a note in the log (at most every 6 hours)
  const next = { ...state };
  if (data.source !== 'investing.com') {
    next.backupSince = state.backupSince || now;
    if (now - next.backupSince > 30 * 60e3 && (!state.backupWarned || now - state.backupWarned > 6 * 3600e3)) {
      console.log('⚠️ investing.com unreachable for over 30 minutes — using the Binance backup');
      next.backupWarned = now;
    }
  } else delete next.backupSince;

  await send(routine, { kind: 'extra' }); // LINE only while the quota has room (notify.js)
  console.log(`news warnings: ${routine.length}`);
  if (process.env.RECORD === 'true') {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...next, warned: [...warned].filter((t) => t > now - 864e5), at: now }));
  }
})().catch((e) => { console.error(e); process.exit(1); });
