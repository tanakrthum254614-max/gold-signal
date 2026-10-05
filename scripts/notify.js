// Sends messages to LINE. Failures are logged, never thrown, so results keep being recorded
// (e.g. when the monthly LINE quota runs out). Env: LINE_CHANNEL_ACCESS_TOKEN, SEND=true
// OUTBOX=<file>: queue texts there instead; scripts/flush.js then sends everything from one run as ONE
// LINE request (the free plan counts requests × friends, not bubbles).
const fs = require('fs');
const { broadcast } = require('./line.js');

// Pack texts into at most 5 LINE text bubbles (≤ 5000 characters each)
function pack(texts, max = 4800) {
  const out = [];
  texts.forEach((t) => {
    const last = out[out.length - 1];
    if (out.length >= 5 || (last && last.length + t.length + 2 <= max && out.length >= 4)) out[out.length - 1] = `${last}

${t}`;
    else out.push(t);
  });
  return out;
}

async function attempt(fn) {
  try { await fn(); console.log('✓ sent to LINE'); } catch (e) { console.log(`⚠️ LINE send failed: ${e.message}`); }
}

// texts: string[] — sent together as one LINE push
async function send(texts) {
  if (!texts.length) return;
  if (process.env.OUTBOX) {
    const q = fs.existsSync(process.env.OUTBOX) ? JSON.parse(fs.readFileSync(process.env.OUTBOX, 'utf8')) : [];
    fs.writeFileSync(process.env.OUTBOX, JSON.stringify([...q, ...texts]));
    return console.log(`queued ${texts.length} message(s)`);
  }
  if (process.env.SEND !== 'true') { texts.forEach((t) => console.log(`(dry run)\n${t}`)); return; }
  await attempt(() => broadcast(...pack(texts).map((text) => ({ type: 'text', text }))));
}

// Rich LINE message (flex)
async function sendFlex(flex) {
  if (process.env.SEND !== 'true') { console.log(`(dry run) flex ${JSON.stringify(flex).length} bytes`); return; }
  await attempt(() => broadcast(flex));
}

module.exports = { send, sendFlex, pack };
