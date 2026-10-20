// Shared by the Vercel Functions in api/ (journal, articles, coach, pay). Functions — unlike middleware.js — receive
// request bodies, so anything that saves text lives here. middleware.js still runs first on every request (signed-in
// members only, banned members out), but each function checks the cookie again itself: never trust a header.
// The cookie / store code mirrors middleware.js — keep both in step.
// 20 Oct 2026: private files moved from Vercel Blob (Hobby read quota ran out → whole Vercel team blocked) to Supabase,
// table kv (path text primary key, body text) over its REST API — same paths as before (access/pro.json, journal/<id>.json …).
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (secret / service_role key — server only, bypasses row-level security).
const sbUrl = () => (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const sbHeaders = (extra = {}) => {
  const k = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  return { apikey: k, ...(k.startsWith('eyJ') ? { authorization: `Bearer ${k}` } : {}), ...extra }; // legacy JWT keys also need the bearer
};

export async function blobGet(path) {
  const r = await fetch(`${sbUrl()}/rest/v1/kv?select=body&path=eq.${encodeURIComponent(path)}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`store get ${r.status}`);
  const rows = await r.json();
  return rows.length ? rows[0].body : null;
}
export async function blobPut(path, text) {
  const r = await fetch(`${sbUrl()}/rest/v1/kv?on_conflict=path`, {
    method: 'POST', body: JSON.stringify({ path, body: text, updated_at: new Date().toISOString() }),
    headers: sbHeaders({ 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' }),
  });
  if (!r.ok) throw new Error(`store put ${r.status}`);
}
export async function readJson(path, fallback) {
  const text = await blobGet(path); // a read error throws: never overwrite a file we failed to read
  return text == null ? fallback : JSON.parse(text);
}
export const writeJson = (path, value) => blobPut(path, JSON.stringify(value));

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const fail = (error, status = 400) => json({ ok: false, error }, status);

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// The signed-in member { id, name, email } from the gs_auth cookie, or null (also null when suspended)
export async function member(request) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)gs_auth=([^;]+)/);
  const secret = process.env.ACCESS_SECRET;
  if (!m || !secret) return null;
  const [data, exp, sig] = m[1].split('.');
  if (!data || !exp || !sig || +exp < Date.now()) return null;
  if (!safeEqual(await hmac(secret, `${data}.${exp}`), sig)) return null;
  let who;
  try { who = JSON.parse(decodeURIComponent(escape(atob(data)))); } catch (e) { return null; }
  if (!who || !/^user_[A-Za-z0-9]+$/.test(who.id || '')) return null;
  const banned = await readJson('access/banned.json', { ids: [] }).catch(() => ({ ids: [] }));
  return (banned.ids || []).includes(who.id) ? null : who;
}

const admins = () => (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
export const isAdmin = (m) => !!(m && m.email) && admins().includes(m.email.toLowerCase());

// ---------- PRO membership (access/pro.json, written by api/pay.mjs and the back office) ----------
// Paywall is OFF until switched on — by the back office's go-live button (access/pro-config.json { enabled: true }) or
// env PRO_ENABLED=1 — so nobody loses the dashboard before payments are live. PRO_FEATURES lists what PRO unlocks
// (default: the AI coach and the dashboard).
export const PRO_FILE = 'access/pro.json';
export const PRO_CONFIG = 'access/pro-config.json';
let cfgCache = { at: 0, v: null };
export async function proEnabled() {
  if (process.env.PRO_ENABLED === '1') return true;
  if (Date.now() - cfgCache.at > 30e3) cfgCache = { at: Date.now(), v: await readJson(PRO_CONFIG, {}).catch(() => cfgCache.v || {}) };
  return !!(cfgCache.v && cfgCache.v.enabled);
}
export const clearProCache = () => { cfgCache = { at: 0, v: null }; };
export const proFeatures = () => (process.env.PRO_FEATURES || 'ai,dashboard,signals,alerts').split(',').map((s) => s.trim()).filter(Boolean);
export async function proOf(m) {
  if (!m) return { pro: false, until: 0 };
  if (isAdmin(m)) return { pro: true, until: 0, admin: true };
  const all = await readJson(PRO_FILE, { users: {} }).catch(() => ({ users: {} }));
  const u = (all.users || {})[m.id];
  return u && u.until > Date.now() ? { pro: true, until: u.until, plan: u.plan, source: u.source, sub: !!u.sub } : { pro: false, until: u ? u.until : 0 };
}

export async function body(request, max = 20000) {
  const text = await request.text();
  if (text.length > max) throw new Error('too big');
  return text ? JSON.parse(text) : {};
}
export const clip = (s, n) => String(s == null ? '' : s).replace(/\u0000/g, '').slice(0, n);
export const num = (v) => (v === '' || v == null || !Number.isFinite(+v) ? null : +v);
