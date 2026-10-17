// Shared by the Vercel Functions in api/ (journal, articles, coach, pay). Functions — unlike middleware.js — receive
// request bodies, so anything that saves text lives here. middleware.js still runs first on every request (signed-in
// members only, banned members out), but each function checks the cookie again itself: never trust a header.
// The cookie / Blob code mirrors middleware.js, which can't import files (see the note at its top) — keep both in step.
const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN || '';
const storeId = () => blobToken().split('_')[3] || ''; // vercel_blob_rw_<storeId>_<secret>

export async function blobGet(path) {
  const r = await fetch(`https://${storeId()}.private.blob.vercel-storage.com/${path}?cache=0`, { headers: { authorization: `Bearer ${blobToken()}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`blob get ${r.status}`);
  return r.text();
}
export async function blobPut(path, text) {
  const r = await fetch(`https://vercel.com/api/blob/?pathname=${encodeURIComponent(path)}`, {
    method: 'PUT', body: text,
    headers: { authorization: `Bearer ${blobToken()}`, 'x-api-version': '12', 'x-vercel-blob-store-id': storeId(), 'x-vercel-blob-access': 'private',
      'x-add-random-suffix': '0', 'x-allow-overwrite': '1', 'x-content-type': 'application/json' },
  });
  if (!r.ok) throw new Error(`blob put ${r.status}`);
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
