// Runs every 5 minutes (with the price alerts): follows the open 30-minute-signal trade and, once per
// half hour, opens a new one when the 30-minute, 1-hour and 5-hour trends strongly agree.
// Results live in intraday.json. Same opening rule as scripts/backtest-30m.js: one trade at a time,
// a new trade only in a half hour that starts at least 15 minutes after the previous one closed.
// Every half hour it also sends one update (no skipped slots): which way to lean, where, SL/TP and the
// historical chance of reaching TP1 first (calibration table in backtest-30m.json). The last half hour
// announced is kept in STATE_DIR, which the workflow restores/saves with the Actions cache.
// Usage: node scripts/intraday-run.js data.json   Env: LINE_CHANNEL_ACCESS_TOKEN, SEND, RECORD, SITE_URL, STATE_DIR
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const INTRA = require('../intraday.js');
const { money } = require('../dailyplan.js');
const { broadcast } = require('./line.js');
const { signed, at, sumLine, targetEvents } = require('./trade-events.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const FILE = process.env.INTRADAY_FILE || path.join(__dirname, '..', 'intraday.json');
const BACKTEST = path.join(__dirname, '..', 'backtest-30m.json');
const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '..', 'state');
const STATE_FILE = path.join(STATE_DIR, 'notify.json');
const TH = INTRA.TREND_TH;
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));

// How worthwhile the historical odds are
const grade = (o) => (!o ? '❔ ยังไม่มีสถิติพอ'
  : o.winRate >= 57 ? '✅ น่าเข้า'
    : o.winRate >= 53 ? '🟡 พอเข้าได้ (ลดขนาดไม้)'
      : '⚠️ ไม่ค่อยคุ้ม — โอกาสใกล้ 50/50');

// The half-hourly message: current lean, where to enter, SL/TP and historical odds (or the open trade)
function updateText(dec, price, odds, open, now) {
  const lines = [`⏱️ อัปเดต 30 นาที · ${at(INTRA.slotOf(now))} น.`, `ราคาทอง ${money(price)}`];
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
  } else {
    lines.push(`👉 ถ้าจะเข้า: ${side} ~${money(lv.entry)}`);
    lines.push(`🛑 SL ${money(lv.sl)} · 💰 TP ${lv.tps.map(money).join(' / ')}`);
    lines.push(`📊 โอกาสถึง TP1 ก่อน SL ≈ ${oddsText} (สถิติย้อนหลัง คะแนน ${dec.score > 0 ? '+' : ''}${dec.score})`);
    lines.push(`ระดับ: ${grade(odds)}`);
  }
  lines.push(`แนวโน้ม 30น. ${TH[dec.keys.m30]} · 1ชม. ${TH[dec.keys.h1]} · 5ชม. ${TH[dec.keys.h5]}`);
  return lines.join('\n');
}

function entryText(t) {
  const buy = t.side === 'BUY';
  return [
    `⏱️ สัญญาณ 30 นาที (${at(t.createdAt)} น.)`,
    `${buy ? '🟢 ซื้อตอนนี้ (BUY)' : '🔴 ขายตอนนี้ (SELL)'} ทองคำ ~${money(t.entry)}`,
    `🛑 SL ${money(t.sl)} (−$${money(Math.abs(t.entry - t.sl))})`,
    `💰 TP1 ${money(t.tps[0])} · TP2 ${money(t.tps[1])} · TP3 ${money(t.tps[2])}`,
    t.why[0],
    'ปิด ⅓ ที่แต่ละ TP · ถึง TP1 แล้วเลื่อน SL ไปที่ทุน',
    'ไม่ใช่คำแนะนำการลงทุน',
  ].join('\n');
}

(async function main() {
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const m15 = bars(data.m15);
  if (!m15.length) return console.log('no candles');
  const now = Date.now();
  const store = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { trades: [] };
  const before = JSON.stringify(store.trades);
  const messages = [];

  // 1. Follow the open trade
  const i = store.trades.findIndex((t) => !SIG.isFinal(t));
  if (i >= 0) {
    const t = SIG.evaluate(store.trades[i], m15, now);
    const sent = { ...(t.alerts || {}) };
    const lines = targetEvents(t, sent, now);
    store.trades[i] = { ...t, alerts: sent };
    if (lines.length) {
      if (SIG.isFinal(t)) lines.push(sumLine(SIG.summary(store.trades)), `ดูสถิติ: ${SITE_URL}/#stats`);
      messages.push(`⏱️ สัญญาณ 30 นาที — ไม้${t.side === 'BUY' ? 'ซื้อ' : 'ขาย'}ที่ ${money(t.entry)} (${at(t.createdAt)} น.)\n${lines.join('\n')}`);
    }
    console.log(`open trade ${t.id} ${t.side} status=${t.status} hit=${t.hit || 0} pnl=${t.pnl}`);
  }

  // 2. New half hour: open a trade if the trends strongly agree and nothing is open
  const slot = INTRA.slotOf(now);
  const last = store.trades[store.trades.length - 1];
  const free = !store.trades.some((t) => !SIG.isFinal(t))
    && (!last || ((last.exitAt || last.expiresAt) + 15 * 60e3 <= slot && last.createdAt < slot));
  const dec = INTRA.decide({ m30: bars(data.m30), h1: bars(data.h1), h5: bars(data.h5) }, now);
  if (dec) console.log(`decision ${new Date(slot).toISOString().slice(11, 16)}Z score=${dec.score} dir=${dec.dir} free=${free}`);
  if (dec && dec.dir && free) {
    const t = INTRA.makeTrade(dec, m15[m15.length - 1].close, now);
    t.alerts = { entry: now };
    t.source = data.source;
    store.trades.push(t);
    messages.push(entryText(t));
    console.log(`new trade ${t.id} ${t.side} ${t.entry} sl ${t.sl} tps ${t.tps.join('/')}`);
  }

  // 3. Half-hourly update — once per half hour, whatever the signal
  const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
  const newSlot = dec && !dec.stale && slot > (state.lastSlot || 0);
  if (newSlot) {
    const calib = fs.existsSync(BACKTEST) ? JSON.parse(fs.readFileSync(BACKTEST, 'utf8')).calibration : null;
    const odds = INTRA.odds(dec.score, calib);
    const open = store.trades.find((t) => !SIG.isFinal(t));
    if (open && open.createdAt === now) {
      // A trade opened this run already has its entry message: just add the odds to it
      messages[messages.length - 1] += `\n📊 โอกาสถึง TP1 ก่อน SL ≈ ${odds ? `${odds.winRate}%` : '—'} (สถิติย้อนหลัง คะแนน ${dec.score > 0 ? '+' : ''}${dec.score})`;
    } else {
      messages.push(updateText(dec, m15[m15.length - 1].close, odds, open, now));
    }
  }

  if (messages.length && process.env.SEND === 'true') {
    try {
      await broadcast(...messages.map((text) => ({ type: 'text', text })));
      console.log(`✓ sent ${messages.length} message(s) to LINE`);
    } catch (e) {
      // Usually the monthly LINE quota; keep recording results either way
      console.log(`⚠️ LINE send failed: ${e.message}`);
    }
  } else messages.forEach((m) => console.log(`(dry run)\n${m}`));

  if (newSlot && process.env.RECORD === 'true') {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastSlot: slot, at: now }));
  }
  if (JSON.stringify(store.trades) === before) return console.log('trades unchanged');
  store.summary = SIG.summary(store.trades);
  store.updatedAt = now;
  if (process.env.RECORD === 'true') {
    fs.writeFileSync(FILE, `${JSON.stringify(store, null, 1)}\n`);
    console.log('✓ intraday.json updated');
  }
})().catch((e) => { console.error(e); process.exit(1); });
