// Web push: sends every message that goes to LINE to the devices people switched notifications on
// for in the app (saved by middleware.js /api/push in the private Blob store, access/push-subs.json, one entry per
// device with the access-code holder's name). Doesn't use the LINE quota.
// Env: BLOB_READ_WRITE_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (scripts/setup-push.js sets the VAPID keys up).
// Missing keys / packages → skipped with a log line. Never throws.
const SITE = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const SUBS = 'access/push-subs.json';

async function readSubs() {
  const { get } = require('@vercel/blob');
  const r = await get(SUBS, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return { subs: [] };
  return JSON.parse(await new Response(r.stream).text());
}
async function writeSubs(data) {
  const { put } = require('@vercel/blob');
  await put(SUBS, JSON.stringify(data), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

// A LINE text → notification: first line is the title, the rest the body
function toNote(text, i) {
  const lines = String(text).trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const title = (lines.shift() || 'Gold Signal').slice(0, 80);
  const body = lines.join('\n').slice(0, 300);
  return { title, body, tag: `gs-${Date.now()}-${i}`, url: '/' };
}

// opts.adminsOnly: only the devices marked admin: true by middleware.js (e.g. "new member" messages)
async function push(texts, opts = {}) {
  const { BLOB_READ_WRITE_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!texts.length) return;
  if (!BLOB_READ_WRITE_TOKEN || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return console.log('push: not set up (keys missing) — skipped');
  let webpush;
  try { webpush = require('web-push'); } catch (e) { return console.log('push: web-push package not installed — skipped'); }
  try {
    webpush.setVapidDetails(SITE, VAPID_PUBLIC_KEY.trim(), VAPID_PRIVATE_KEY.trim());
    const data = await readSubs();
    const notes = texts.map(toNote);
    let sent = 0, failed = 0;
    const dead = new Set();
    const targets = opts.adminsOnly ? data.subs.filter((s) => s.admin) : data.subs;
    for (const sub of targets) {
      for (const n of notes) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(n), { TTL: 3600, urgency: 'high' });
          sent++;
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) { dead.add(sub.endpoint); break; } // device unsubscribed / app removed
          failed++;
          console.log(`push: ${e.statusCode || ''} ${e.message}`);
        }
      }
    }
    const removed = dead.size;
    if (removed) await writeSubs({ ...data, subs: data.subs.filter((s) => !dead.has(s.endpoint)) }).catch((e) => console.log(`push: couldn't remove old devices: ${e.message}`));
    console.log(`✓ push: ${sent} sent to ${targets.length} device(s)${failed ? `, ${failed} failed` : ''}${removed ? `, ${removed} old removed` : ''}`);
  } catch (e) {
    console.log(`⚠️ push failed: ${e.message}`);
  }
}

module.exports = { push, toNote };
