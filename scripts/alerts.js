// Runs every 5 minutes: follows today's signal on 15-minute candles and sends a LINE alert
// when the price reaches the entry, the target (TP) or the stop-loss (SL). Each alert is sent once;
// what was sent is remembered in the signal record (signals.json). Advisory signals (SIG.RULE.advisory)
// are scored the same way but send nothing.
// Usage: node scripts/alerts.js data.json     Env: LINE_CHANNEL_ACCESS_TOKEN, SEND=true, SITE_URL
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const { money } = require('../dailyplan.js');
const { send } = require('./notify.js');
const { at, targetEvents } = require('./trade-events.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const SPREAD = +(process.env.SPREAD_USD || 0.4);
const SIGNALS_FILE = process.env.SIGNALS_FILE || path.join(__dirname, '..', 'signals.json');

function entryText(s, price) {
  const buy = s.side === 'BUY';
  return [
    `🔔 ถึงจุดเข้าแล้ว! (${at(s.entryAt)} น.)`,
    `${buy ? '🟢 ซื้อ (BUY)' : '🔴 ขาย (SELL)'} ทองคำที่ ${money(s.entry)}`,
    `🛑 SL ${money(s.sl)} · 💰 TP ${money(s.tp)}`,
    `ราคาตอนนี้ ${money(price)}`,
    `ถ้าตั้ง ${buy ? 'Buy' : 'Sell'} Limit ไว้ คำสั่งทำงานแล้ว — อย่าลืมตั้ง SL/TP`,
    'ไม่ใช่คำแนะนำการลงทุน',
  ].join('\n');
}


(async function main() {
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const bars = (data.m15 || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
  if (!bars.length || !fs.existsSync(SIGNALS_FILE)) return console.log('nothing to check');
  const now = Date.now();
  const price = bars[bars.length - 1].close;
  const store = JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8'));

  // Only the open signal whose window we can fully see in the candles
  const i = store.signals.findIndex((s) => !SIG.isFinal(s) && s.createdAt <= now && now < s.expiresAt + 15 * 60e3);
  if (i < 0) return console.log(`no open signal · price ${price}`);
  const s = SIG.evaluate(store.signals[i], bars, now);
  if (bars[0].time > s.createdAt) return console.log('candles do not cover the signal window yet');
  const sent = { ...(s.alerts || {}) };
  const messages = [];

  const entered = s.entryAt != null && (s.status === 'active' || s.closedBy === 'tp' || s.closedBy === 'sl');
  if (entered && !sent.entry) {
    messages.push({ type: 'text', text: entryText(s, price) });
    sent.entry = now;
  }
  // TP / SL / exit results are recorded but not sent (LINE = entry signals and news warnings only, user 9 Oct 2026)
  if (s.tps) targetEvents(s, sent, now);
  else if ((s.closedBy === 'tp' || s.closedBy === 'sl') && !sent.exit) sent.exit = now;
  console.log(`${s.id} ${s.side} status=${s.status} price=${price} new alerts=${messages.length}`);

  // Store the live status (final win/loss, or "active") so the site and stats match the alerts
  const changed = messages.length || s.status !== store.signals[i].status;
  if (!changed) return;
  // Only TP/SL outcomes are final here; end-of-day closes are left to the morning job
  const keep = s.status === 'active' || ['tp', 'sl', 'be'].includes(s.closedBy) ? s : store.signals[i];
  store.signals[i] = { ...keep, alerts: sent };
  store.summary = SIG.summary(store.signals, SPREAD);
  store.updatedAt = now;

  // Advisory (overview-only) days are tracked silently: no entry / TP / SL messages
  if (s.advisory) console.log(`advisory signal — ${messages.length} event(s) recorded, not sent`);
  else await send(messages.map((m) => `📅 สัญญาณรายวัน ${s.id}\n${m.text}`));
  if (process.env.RECORD === 'true') {
    fs.writeFileSync(SIGNALS_FILE, `${JSON.stringify(store, null, 1)}\n`);
    console.log('✓ signals.json updated');
  }
})().catch((e) => { console.error(e); process.exit(1); });
