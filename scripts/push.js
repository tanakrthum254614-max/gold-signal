// Web push: sends every message that goes to LINE to the devices people switched notifications on
// for in the app (saved on their Clerk account as unsafeMetadata.push). Doesn't use the LINE quota.
// Env: CLERK_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (scripts/setup-push.js sets them up).
// Missing keys / the web-push package → skipped with a log line. Never throws.
const CLERK = 'https://api.clerk.com/v1';
const SITE = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';

async function clerk(pathname, init = {}) {
  const r = await fetch(`${CLERK}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY.trim()}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`Clerk ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// [{ id, subs: [{ endpoint, keys, device, at }] }] for every account with at least one device
async function subscribers() {
  const out = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const page = await clerk(`/users?limit=100&offset=${offset}&order_by=-created_at`);
    page.forEach((u) => {
      const subs = (u.unsafe_metadata && u.unsafe_metadata.push) || [];
      if (Array.isArray(subs) && subs.length) out.push({ id: u.id, subs });
    });
    if (page.length < 100) break;
  }
  return out;
}

// A LINE text → notification: first line is the title, the rest the body
function toNote(text, i) {
  const lines = String(text).trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const title = (lines.shift() || 'Gold Signal').slice(0, 80);
  const body = lines.join('\n').slice(0, 300);
  return { title, body, tag: `gs-${Date.now()}-${i}`, url: '/' };
}

async function push(texts) {
  const { CLERK_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!texts.length) return;
  if (!CLERK_SECRET_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return console.log('push: not set up (keys missing) — skipped');
  let webpush;
  try { webpush = require('web-push'); } catch (e) { return console.log('push: web-push package not installed — skipped'); }
  try {
    webpush.setVapidDetails(SITE, VAPID_PUBLIC_KEY.trim(), VAPID_PRIVATE_KEY.trim());
    const users = await subscribers();
    const notes = texts.map(toNote);
    let sent = 0, failed = 0, removed = 0;
    for (const u of users) {
      const dead = new Set();
      for (const sub of u.subs) {
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
      if (dead.size) {
        removed += dead.size;
        await clerk(`/users/${u.id}/metadata`, { method: 'PATCH', body: JSON.stringify({ unsafe_metadata: { push: u.subs.filter((s) => !dead.has(s.endpoint)) } }) })
          .catch((e) => console.log(`push: couldn't remove old devices: ${e.message}`));
      }
    }
    console.log(`✓ push: ${sent} sent to ${users.reduce((a, u) => a + u.subs.length, 0)} device(s)${failed ? `, ${failed} failed` : ''}${removed ? `, ${removed} old removed` : ''}`);
  } catch (e) {
    console.log(`⚠️ push failed: ${e.message}`);
  }
}

module.exports = { push, toNote };
