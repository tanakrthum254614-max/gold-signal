// Stripe over plain fetch (form-encoded REST, the same calls Stripe's SDK makes) for api/pay/* and api/pro.
// Env (from the Vercel Marketplace Stripe integration + scripts/stripe-setup.mjs): STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTH, STRIPE_PRICE_YEAR (recurring prices; PromptPay charges the same amounts once).
import { readJson, writeJson, hmac, safeEqual, PRO_FILE } from './gs.mjs';

function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
export async function stripe(path, params, method = params ? 'POST' : 'GET') {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  const qs = method === 'GET' && params ? `?${form(params)}` : '';
  const r = await fetch(`https://api.stripe.com/v1/${path}${qs}`, {
    method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': '2026-09-30.endive' },
    body: method === 'GET' ? undefined : form(params || {}),
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error((j.error && j.error.message) || `stripe ${r.status}`); e.status = r.status; throw e; }
  return j;
}

export const PLANS = { month: { env: 'STRIPE_PRICE_MONTH', days: 30, name: 'รายเดือน' }, year: { env: 'STRIPE_PRICE_YEAR', days: 365, name: 'รายปี' } };
let priceCache = { at: 0, v: null };
// { month: { id, amount, currency }, year: … } — whatever is set in Stripe (prices are decided there, not in code)
export async function prices() {
  if (priceCache.v && Date.now() - priceCache.at < 10 * 60e3) return priceCache.v;
  const v = {};
  for (const [plan, p] of Object.entries(PLANS)) {
    const id = (process.env[p.env] || '').trim();
    if (!id) continue;
    try { const pr = await stripe(`prices/${id}`); if (pr.active) v[plan] = { id, amount: pr.unit_amount, currency: pr.currency }; } catch (e) { /* not offered */ }
  }
  priceCache = { at: Date.now(), v };
  return v;
}

// Stripe-Signature: t=<unix>,v1=<hmac(secret, `${t}.${raw}`)> (5-minute tolerance)
export async function verify(raw, header, secret = process.env.STRIPE_WEBHOOK_SECRET || '') {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k, v]));
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  const t = +parts.t;
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = await hmac(secret, `${t}.${raw}`);
  return sigs.some((s) => safeEqual(s, want));
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
