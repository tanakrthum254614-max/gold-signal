// Launch-day gift (user, 14 Oct 2026: "ให้สมาชิกเดิม PRO ฟรี 30 วัน"): every member who signed up before the paywall
// opens gets PRO for N days (default 30), added to access/pro.json like an admin grant. Run once, right before
// PRO_ENABLED=1:
//   CLERK_SECRET_KEY=… BLOB_READ_WRITE_TOKEN=… node scripts/grant-existing.mjs [--days 30] [--dry]
// Admins are skipped (always PRO). Members who already have PRO longer than N days keep their date (extend() adds on
// top of an active PRO, so paying members get the gift on top). Safe to re-run: a member already given the launch gift
// is skipped.
import { readJson, writeJson, PRO_FILE } from '../lib/gs.mjs';
import { extend } from '../lib/stripe.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const days = Math.round(+arg('days', 30)), dry = process.argv.includes('--dry');
const key = (process.env.CLERK_SECRET_KEY || '').trim();
const admins = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
if (!key || !process.env.BLOB_READ_WRITE_TOKEN || !(days > 0)) { console.error('set CLERK_SECRET_KEY, BLOB_READ_WRITE_TOKEN; --days > 0'); process.exit(1); }

const users = [];
for (let offset = 0; offset < 20000; offset += 500) {
  const r = await fetch(`https://api.clerk.com/v1/users?limit=500&offset=${offset}`, { headers: { authorization: `Bearer ${key}` } });
  if (!r.ok) throw new Error(`clerk ${r.status}`);
  const page = await r.json();
  users.push(...page);
  if (page.length < 500) break;
}
const all = await readJson(PRO_FILE, { users: {}, events: [], history: [] });
all.users = all.users || {}; all.history = all.history || [];
let given = 0, skipped = 0;
for (const u of users) {
  const email = ((u.email_addresses || []).find((e) => e.id === u.primary_email_address_id) || {}).email_address || '';
  if (u.banned || admins.includes(email.toLowerCase()) || all.history.some((h) => h.uid === u.id && h.type === 'launch')) { skipped++; continue; }
  if (!dry) {
    extend(all, u.id, days, { source: (all.users[u.id] || {}).source || 'admin', plan: (all.users[u.id] || {}).plan || 'launch' });
    all.history.push({ at: Date.now(), uid: u.id, type: 'launch', days, by: 'launch-gift' });
  }
  given++;
}
if (!dry) await writeJson(PRO_FILE, all);
console.log(`${dry ? '[dry] would give' : 'gave'} ${days} days PRO to ${given} members · skipped ${skipped} (admins / banned / already given) · of ${users.length}`);
