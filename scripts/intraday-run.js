// Runs every 5 minutes (with the price alerts): follows the open 30-minute-signal trade and, once per
// half hour, opens a new one when the 30-minute, 1-hour and 5-hour trends strongly agree.
// Results live in intraday.json. Same opening rule as scripts/backtest-30m.js: one trade at a time,
// a new trade only in a half hour that starts at least 15 minutes after the previous one closed.
// Usage: node scripts/intraday-run.js data.json     Env: LINE_CHANNEL_ACCESS_TOKEN, SEND, RECORD, SITE_URL
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const INTRA = require('../intraday.js');
const { money } = require('../dailyplan.js');
const { broadcast } = require('./line.js');
const { signed, at, sumLine, targetEvents } = require('./trade-events.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const FILE = process.env.INTRADAY_FILE || path.join(__dirname, '..', 'intraday.json');
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));

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

  if (JSON.stringify(store.trades) === before) return console.log('no change');
  store.summary = SIG.summary(store.trades);
  store.updatedAt = now;

  if (messages.length && process.env.SEND === 'true') {
    await broadcast(...messages.map((text) => ({ type: 'text', text })));
    console.log('✓ sent to LINE');
  } else messages.forEach((m) => console.log(`(dry run)\n${m}`));
  if (process.env.RECORD === 'true') {
    fs.writeFileSync(FILE, `${JSON.stringify(store, null, 1)}\n`);
    console.log('✓ intraday.json updated');
  }
})().catch((e) => { console.error(e); process.exit(1); });
