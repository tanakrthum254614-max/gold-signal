// Where messages go:
// - important (entries, TP/SL, closes, daily signal): LINE, plus a copy on Telegram when configured
// - routine (hourly updates, news warnings): Telegram when configured (free, unlimited), otherwise LINE
// Send failures are logged, never thrown, so results keep being recorded (e.g. LINE monthly quota).
// Env: LINE_CHANNEL_ACCESS_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SEND=true
const { broadcast } = require('./line.js');

const tgToken = () => (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const tgChat = () => (process.env.TELEGRAM_CHAT_ID || '').trim();
const hasTelegram = () => !!(tgToken() && tgChat());

async function telegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${tgToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tgChat(), text, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${await r.text()}`);
}

async function attempt(name, fn) {
  try { await fn(); console.log(`✓ sent to ${name}`); return true; } catch (e) { console.log(`⚠️ ${name} send failed: ${e.message}`); return false; }
}

// texts: string[]; routine: true for hourly updates / warnings
async function send(texts, { routine = false } = {}) {
  if (!texts.length) return;
  if (process.env.SEND !== 'true') { texts.forEach((t) => console.log(`(dry run${routine ? ', routine' : ''})\n${t}`)); return; }
  if (hasTelegram()) {
    for (const t of texts) await attempt('Telegram', () => telegram(t));
    if (routine) return;
  }
  await attempt('LINE', () => broadcast(...texts.map((text) => ({ type: 'text', text }))));
}

// Rich LINE message (flex) for important posts, with a plain-text copy for Telegram
async function sendFlex(flex, plainText) {
  if (process.env.SEND !== 'true') { console.log(`(dry run) flex ${JSON.stringify(flex).length} bytes`); return; }
  if (hasTelegram() && plainText) await attempt('Telegram', () => telegram(plainText));
  await attempt('LINE', () => broadcast(flex));
}

module.exports = { send, sendFlex, hasTelegram };
