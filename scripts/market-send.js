// 📣 Sends the marketing posts the admin approved for LINE (api/market.mjs → Blob marketing/queue.json). Runs in every
// 5-minute check (scripts/check-loop.sh): LINE only (no web push — members don't need ads on their phones), and only
// while the monthly quota keeps room for the signal broadcasts (notify.js lineRoom). At most one post per run; a post
// that has to wait shows "waiting" in the back office. Never fails the check.
// Usage: node scripts/market-send.js   Env: BLOB_READ_WRITE_TOKEN, LINE_CHANNEL_ACCESS_TOKEN, SEND=true (else dry run)
const { lineRoom, pack } = require('./notify.js');
const { broadcast } = require('./line.js');
const FILE = 'marketing/queue.json', CONFIG = 'marketing/config.json';

(async () => {
  if (!require('./blob').ready()) return console.log('marketing: no Blob token — skipped');
  const { get, put } = require('./blob');
  const read = async (k, d) => { const r = await get(k, { access: 'private', useCache: false }).catch(() => null); return r && r.statusCode === 200 ? JSON.parse(await new Response(r.stream).text()) : d; };
  const cfg = await read(CONFIG, {});
  if (!cfg.live) return console.log('marketing: off');
  const q = await read(FILE, { items: [] });
  const next = (q.items || []).find((x) => x.status === 'queued' || x.status === 'waiting');
  if (!next) return console.log('marketing: nothing queued');
  const room = await lineRoom();
  const save = () => put(FILE, JSON.stringify(q), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  if (!room.ok) { next.status = 'waiting'; next.why = room.why; await save(); return console.log(`marketing: waiting — ${room.why}`); }
  if (process.env.SEND !== 'true') return console.log(`marketing (dry run):\n${next.text}`);
  next.status = 'sending'; await save(); // never twice, even if the broadcast below hangs
  try { await broadcast(...pack([next.text]).map((text) => ({ type: 'text', text }))); next.status = 'sent'; next.sentAt = Date.now(); }
  catch (e) { next.status = 'failed'; next.why = e.message.slice(0, 200); }
  await save();
  console.log(`marketing: ${next.id} ${next.status}`);
})().catch((e) => console.log(`⚠️ marketing failed: ${e.message}`));
