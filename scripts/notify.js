// Sends messages to LINE. Failures are logged, never thrown, so results keep being recorded
// (e.g. when the monthly LINE quota runs out). Env: LINE_CHANNEL_ACCESS_TOKEN, SEND=true
const { broadcast } = require('./line.js');

async function attempt(fn) {
  try { await fn(); console.log('✓ sent to LINE'); } catch (e) { console.log(`⚠️ LINE send failed: ${e.message}`); }
}

// texts: string[] — sent together as one LINE push
async function send(texts) {
  if (!texts.length) return;
  if (process.env.SEND !== 'true') { texts.forEach((t) => console.log(`(dry run)\n${t}`)); return; }
  await attempt(() => broadcast(...texts.map((text) => ({ type: 'text', text }))));
}

// Rich LINE message (flex)
async function sendFlex(flex) {
  if (process.env.SEND !== 'true') { console.log(`(dry run) flex ${JSON.stringify(flex).length} bytes`); return; }
  await attempt(() => broadcast(flex));
}

module.exports = { send, sendFlex };
