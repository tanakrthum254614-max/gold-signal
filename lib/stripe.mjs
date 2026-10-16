// Stripe over plain fetch (form-encoded REST, the same calls Stripe's SDK makes) for api/pay/*, api/pro and api/golive.
// Two accounts:
//  · test — the Vercel Marketplace sandbox: STRIPE_SECRET_KEY + env STRIPE_PRICE_MONTH/YEAR, STRIPE_WEBHOOK_SECRET
//  · live — the owner's own Thai account: STRIPE_LIVE_SECRET_KEY (set by the owner, never read by anyone else). Its
//    prices and webhook secret are created by the back office's "go live" button (api/golive.mjs) and kept in the
//    private Blob file access/stripe-live.json — no env edits or redeploy needed.
// When the live key is set, everything uses the live account; the live prices exist only after go-live.
import { readJson, writeJson, hmac, safeEqual, PRO_FILE } from './gs.mjs';

export const LIVE_FILE = 'access/stripe-live.json';
export const hasLiveKey = () => !!(process.env.STRIPE_LIVE_SECRET_KEY || '').trim();
let liveCache = { at: 0, v: null };
export async function liveConfig(fresh) {
  if (!hasLiveKey()) return null;
  if (fresh || Date.now() - liveCache.at > 30e3) liveCache = { at: Date.now(), v: await readJson(LIVE_FILE, null).catch(() => liveCache.v) };
  return liveCache.v;
}
export const clearLiveCache = () => { liveCache = { at: 0, v: null }; priceCache = { at: 0, v: null }; };

function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
export async function stripe(path, params, method = params ? 'POST' : 'GET') {
  const key = (process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '').trim(); // the live key wins
  if (!key) throw new Error('STRIPE_LIVE_SECRET_KEY / STRIPE_SECRET_KEY not set');
  const qs = method === 'GET' && params ? `?${form(params)}` : '';
  const r = await fetch(`https://api.stripe.com/v1/${path}${qs}`, {
    method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': '2026-09-30.endive' },
    body: method === 'GET' ? undefined : form(params || {}),
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error((j.error && j.error.message) || `stripe ${r.status}`); e.status = r.status; e.type = j.error && j.error.type; throw e; }
  return j;
}

export const PLANS = { month: { env: 'STRIPE_PRICE_MONTH', live: 'priceMonth', days: 30, name: 'รายเดือน' }, year: { env: 'STRIPE_PRICE_YEAR', live: 'priceYear', days: 365, name: 'รายปี' } };
let priceCache = { at: 0, v: null };
// { month: { id, amount, currency }, year: … } — whatever is set in Stripe (prices are decided there, not in code)
export async function prices() {
  if (priceCache.v && Date.now() - priceCache.at < 60e3) return priceCache.v; // 1 min: a price change reaches every instance soon
  const live = hasLiveKey() ? await liveConfig() : null;
  const v = {};
  for (const [plan, p] of Object.entries(PLANS)) {
    const id = hasLiveKey() ? (live && live[p.live]) || '' : (process.env[p.env] || '').trim();
    if (!id) continue;
    try { const pr = await stripe(`prices/${id}`); if (pr.active) v[plan] = { id, amount: pr.unit_amount, currency: pr.currency }; } catch (e) { /* not offered */ }
  }
  priceCache = { at: Date.now(), v };
  return v;
}

// Stripe-Signature: t=<unix>,v1=<hmac(secret, `${t}.${raw}`)> (5-minute tolerance). Accepts the live endpoint's secret
// and the sandbox's, so test events keep working until the sandbox endpoint is removed.
export async function verify(raw, header, secrets) {
  if (!secrets) { const live = await liveConfig(); secrets = [live && live.webhookSecret, process.env.STRIPE_WEBHOOK_SECRET]; }
  secrets = secrets.filter(Boolean);
  if (!secrets.length || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  const t = +parts.t;
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  for (const secret of secrets) {
    const want = await hmac(secret, `${t}.${raw}`);
    if (sigs.some((s) => safeEqual(s, want))) return true;
  }
  return false;
}

// ---------- access/pro.json ----------
export async function loadPro() { return readJson(PRO_FILE, { users: {}, events: [], history: [] }); }
export async function savePro(all) {
  all.events = (all.events || []).slice(-300);
  all.history = (all.history || []).slice(-2000);
  await writeJson(PRO_FILE, all);
}
export function extend(all, uid, days, info) {
  const u = all.users[uid] || {};
  const from = Math.max(Date.now(), u.until || 0);
  all.users[uid] = { ...u, ...info, until: from + days * 864e5 };
  return all.users[uid];
}
export const periodEnd = (sub) => 1000 * (sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end) || 0);

// Launch gift: every member (Clerk) except admins / banned / already given gets `days` of PRO. Returns counts.
export async function giftExisting(all, days, isAdminEmail) {
  const key = (process.env.CLERK_SECRET_KEY || '').trim();
  const users = [];
  for (let offset = 0; offset < 20000; offset += 500) {
    const r = await fetch(`https://api.clerk.com/v1/users?limit=500&offset=${offset}`, { headers: { authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`clerk ${r.status}`);
    const page = await r.json();
    users.push(...page);
    if (page.length < 500) break;
  }
  all.users = all.users || {}; all.history = all.history || [];
  let given = 0, skipped = 0;
  for (const u of users) {
    const email = ((u.email_addresses || []).find((e) => e.id === u.primary_email_address_id) || {}).email_address || '';
    if (u.banned || isAdminEmail(email) || all.history.some((h) => h.uid === u.id && h.type === 'launch')) { skipped++; continue; }
    extend(all, u.id, days, { source: (all.users[u.id] || {}).source || 'admin', plan: (all.users[u.id] || {}).plan || 'launch' });
    all.history.push({ at: Date.now(), uid: u.id, type: 'launch', days, by: 'launch-gift' });
    given++;
  }
  return { given, skipped, total: users.length };
}
