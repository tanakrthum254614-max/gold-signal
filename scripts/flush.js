// Sends everything queued in OUTBOX by this run's scripts as one LINE request, then clears the queue.
// Usage: OUTBOX=outbox.json node scripts/flush.js      Env: LINE_CHANNEL_ACCESS_TOKEN, SEND
const fs = require('fs');

const file = process.env.OUTBOX || 'outbox.json';
if (!fs.existsSync(file)) { console.log('nothing to send'); process.exit(0); }
const texts = JSON.parse(fs.readFileSync(file, 'utf8'));
fs.unlinkSync(file);
delete process.env.OUTBOX; // send for real now
require('./notify.js').send(texts).then(() => console.log(`flushed ${texts.length} message(s)`));
