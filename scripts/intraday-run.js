// Runs every 5 minutes (with the price alerts): follows the open 30-minute-signal trade and, once per
// half hour, opens a new one when the 30-minute, 1-hour and 5-hour trends strongly agree (buy side
// only, never within ±30 minutes of high-impact US news). Results live in intraday.json. Same opening
// rule as scripts/backtest-30m.js: one trade at a time, a new trade only in a half hour that starts
// at least 15 minutes after the previous one closed.
// Also, while the market is open (07:00–03:00 Thai time):
// - every hour, one update (no skipped hours): lean direction, levels and the historical chance of
//   reaching TP1 first (calibration table in backtest-30m.json)
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
const { signed, at, sumLine, targetEvents, lotLine } = require('./trade-events.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const SPREAD = +(process.env.SPREAD_USD || 0.4);
const FILE = process.env.INTRADAY_FILE || path.join(__dirname, '..', 'intraday.json');
const BACKTEST = path.join(__dirname, '..', 'backtest-30m.json');
const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '..', 'state');
const STATE_FILE = path.join(STATE_DIR, 'notify.json');
const UPDATE_EVERY = 60 * 60e3; // routine update interval
const updateSlot = (ms) => Math.floor(ms / UPDATE_EVERY) * UPDATE_EVERY;
const TH = INTRA.TREND_TH;
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));

// How worthwhile the historical odds are
const grade = (o) => (!o ? '❔ ยังไม่มีสถิติพอ'
  : o.winRate >= 57 ? '✅ น่าเข้า'
    : o.winRate >= 53 ? '🟡 พอเข้าได้ (ลดขนาดไม้)'
      : '⚠️ ไม่ค่อยคุ้ม — โอกาสใกล้ 50/50');

// The hourly message: current lean, where to enter, SL/TP and historical odds (or the open trade)
function updateText(dec, price, odds, open, upcoming, now) {
  const lines = [`⏱️ อัปเดตรายชั่วโมง · ${at(updateSlot(now))} น.`, `ราคาทอง ${money(price)}`];
  const lv = INTRA.levels(dec.lean || 1, price);
  const side = lv.side === 'BUY' ? '🟢 ซื้อ (BUY)' : '🔴 ขาย (SELL)';
  const oddsText = odds ? `${odds.winRate}%` : '—';
  if (open) {
    const buy = open.side === 'BUY', d = buy ? 1 : -1, hit = open.hit || 0;
    const pnl = (open.realized || 0) + ((3 - hit) / 3) * d * (price - open.entry);
    lines.push(`📌 ถือไม้${buy ? 'ซื้อ' : 'ขาย'}อยู่ที่ ${money(open.entry)} · ตอนนี้ ${signed(pnl)}/ออนซ์`
      + (hit ? ` · ถึง TP${hit} แล้ว (SL อยู่ที่ทุน)` : ` · SL ${money(open.sl)}`));
    lines.push(`มุมมองตอนนี้: ${dec.lean ? side : 'ไม่มีทิศทาง'} · โอกาส ≈ ${oddsText}`);
  } else if (!dec.lean) {
    lines.push('👉 ตอนนี้ไม่มีทิศทาง (ทุกช่วงเวลาไซด์เวย์) — โอกาส ≈ 50/50 รอดูก่อนดีกว่า');
  } else if (dec.lean < 0 && INTRA.RULE.sides === 'buy') {
    lines.push('👉 แนวโน้มตอนนี้เป็นขาลง — ระบบเข้าเฉพาะฝั่งซื้อ แนะนำรอ');
    lines.push(`📊 ถ้าขาย โอกาสถึง TP1 ก่อน SL ≈ ${oddsText} (สถิติ 2 ปี ฝั่งขายแทบไม่มีความได้เปรียบ)`);
  } else {
    lines.push(`👉 ถ้าจะเข้า: ${side} ~${money(lv.entry)}`);
    lines.push(`🛑 SL ${money(lv.sl)} · 💰 TP ${lv.tps.map(money).join(' / ')}`);
    lines.push(`📊 โอกาสถึง TP1 ก่อน SL ≈ ${oddsText} (สถิติย้อนหลัง คะแนน ${dec.score > 0 ? '+' : ''}${dec.score})`);
    lines.push(`ระดับ: ${grade(odds)}`);
  }
  if (dec.news) lines.push(`📰 ช่วงข่าวแรง ${at(dec.news.time)} น. ${dec.news.title} — งดเปิดไม้ใหม่`);
  else if (upcoming) lines.push(`📰 ข่าวแรงถัดไป ${at(upcoming.time)} น. ${upcoming.title}`);
  lines.push(`แนวโน้ม 30น. ${TH[dec.keys.m30]} · 1ชม. ${TH[dec.keys.h1]} · 5ชม. ${TH[dec.keys.h5]}`);
  return lines.join('\n');
}

function entryText(t, odds) {
  const buy = t.side === 'BUY';
  return [
    `⏱️ สัญญาณ 30 นาที (${at(t.createdAt)} น.)`,
    `${buy ? '🟢 ซื้อตอนนี้ (BUY)' : '🔴 ขายตอนนี้ (SELL)'} ทองคำ ~${money(t.entry)}`,
    `🛑 SL ${money(t.sl)} (−$${money(Math.abs(t.entry - t.sl))})`,
    `💰 TP1 ${money(t.tps[0])} · TP2 ${money(t.tps[1])} · TP3 ${money(t.tps[2])}`,
    `📊 โอกาสถึง TP1 ก่อน SL ≈ ${odds ? `${odds.winRate}%` : '—'} (สถิติย้อนหลัง คะแนน ${t.score > 0 ? '+' : ''}${t.score})`,
    t.why[0],
    lotLine(INTRA.RULE.slUsd),
    'ปิด ⅓ ที่แต่ละ TP · ถึง TP1 แล้วเลื่อน SL ไปที่ทุน',
    'ไม่ใช่คำแนะนำการลงทุน',
  ].join('\n');
}

function newsWarning(n, open) {
  const lines = [`⚠️ อีกประมาณ 30 นาที (${at(n.time)} น.) มีข่าวแรงสหรัฐ`, `📰 ${n.title}`,
    `ราคาทองอาจวิ่งแรง $20–50 ในไม่กี่นาที — ระบบงดเปิดไม้ใหม่ ±${INTRA.RULE.newsMin} นาทีรอบข่าว`];
  if (open) lines.push(`📌 มีไม้${open.side === 'BUY' ? 'ซื้อ' : 'ขาย'}อยู่ที่ ${money(open.entry)} — พิจารณาปิดบางส่วนหรือเลื่อน SL ไปที่ทุนก่อนข่าว`);
  return lines.join('\n');
}

(async function main() {
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const m15 = bars(data.m15);
  if (!m15.length) return console.log('no candles');
  const now = Date.now();
  const price = m15[m15.length - 1].close;
  const news = data.news || [];
  const store = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { trades: [] };
  const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  const before = JSON.stringify(store.trades);
  const important = [], routine = [];
  const calib = fs.existsSync(BACKTEST) ? JSON.parse(fs.readFileSync(BACKTEST, 'utf8')).calibration : null;

  // 1. Follow the open trade
  const i = store.trades.findIndex((t) => !SIG.isFinal(t));
  if (i >= 0) {
    const t = SIG.evaluate(store.trades[i], m15, now);
    const sent = { ...(t.alerts || {}) };
    const lines = targetEvents(t, sent, now);
    store.trades[i] = { ...t, alerts: sent };
    if (lines.length) {
      if (SIG.isFinal(t)) lines.push(sumLine(SIG.summary(store.trades, SPREAD)), `ดูสถิติ: ${SITE_URL}/#stats`);
      important.push(`⏱️ สัญญาณ 30 นาที — ไม้${t.side === 'BUY' ? 'ซื้อ' : 'ขาย'}ที่ ${money(t.entry)} (${at(t.createdAt)} น.)\n${lines.join('\n')}`);
    }
    console.log(`open trade ${t.id} ${t.side} status=${t.status} hit=${t.hit || 0} pnl=${t.pnl}`);
  }

  // 2. New half hour: open a trade if the trends strongly agree and nothing is open
  const slot = INTRA.slotOf(now);
  const last = store.trades[store.trades.length - 1];
  const free = !store.trades.some((t) => !SIG.isFinal(t))
    && (!last || ((last.exitAt || last.expiresAt) + 15 * 60e3 <= slot && last.createdAt < slot));
  const dec = INTRA.decide({ m30: bars(data.m30), h1: bars(data.h1), h5: bars(data.h5) }, now, news);
  const odds = dec && INTRA.odds(dec.score, calib);
  if (dec) console.log(`decision score=${dec.score} dir=${dec.dir} free=${free} news=${dec.news ? dec.news.title : '-'}`);
  if (dec && dec.dir && free) {
    const t = INTRA.makeTrade(dec, price, now);
    t.alerts = { entry: now };
    t.source = data.source;
    store.trades.push(t);
    important.push(entryText(t, odds));
    console.log(`new trade ${t.id} ${t.side} ${t.entry} sl ${t.sl} tps ${t.tps.join('/')}`);
  }

  // 3. Market-hours messages: hourly update + warning ~30 minutes before high-impact news
  const open = store.trades.find((t) => !SIG.isFinal(t));
  const hour = updateSlot(now);
  const newHour = dec && !dec.stale && hour > (state.lastSlot || 0);
  const upcoming = news.find((n) => n.time > now);
  if (newHour && !(open && open.createdAt === now)) routine.push(updateText(dec, price, odds, open, upcoming, now));
  const warned = new Set(state.warned || []);
  const soon = INTRA.marketOpen(now) ? news.filter((n) => n.time > now && n.time - now <= 40 * 60e3 && !warned.has(n.time)) : [];
  soon.forEach((n) => { routine.push(newsWarning(n, open)); warned.add(n.time); });

  // 4. investing.com unreachable for over 30 minutes → tell the owner (at most every 6 hours)
  const next = { ...state };
  if (data.source !== 'investing.com') {
    next.backupSince = state.backupSince || now;
    if (now - next.backupSince > 30 * 60e3 && (!state.backupWarned || now - state.backupWarned > 6 * 3600e3)) {
      important.push('⚠️ ดึงข้อมูลจาก investing.com ไม่ได้มากกว่า 30 นาที — ตอนนี้ใช้ข้อมูลสำรอง (Binance PAXG) ราคาอาจต่างจาก investing.com เล็กน้อย');
      next.backupWarned = now;
    }
  } else delete next.backupSince;

  await send([...important, ...routine]);

  if (process.env.RECORD === 'true') {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const keep = [...warned].filter((t) => t > now - 864e5); // forget old warnings
    fs.writeFileSync(STATE_FILE, JSON.stringify({ ...next, lastSlot: newHour ? hour : state.lastSlot, warned: keep, at: now }));
  }
  if (JSON.stringify(store.trades) === before) return console.log('trades unchanged');
  store.summary = SIG.summary(store.trades, SPREAD);
  store.updatedAt = now;
  if (process.env.RECORD === 'true') {
    fs.writeFileSync(FILE, `${JSON.stringify(store, null, 1)}\n`);
    console.log('✓ intraday.json updated');
  }
})().catch((e) => { console.error(e); process.exit(1); });
