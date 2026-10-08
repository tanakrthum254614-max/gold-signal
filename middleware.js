// Access control for the whole site (Vercel Routing Middleware, runs before every request).
// Only people with an access code from the owner get in (user, 8 Oct 2026): the code list lives in the private Blob
// store (access/codes.json — sha-256 hashes, managed with scripts/access-codes.js), so adding or revoking a code works
// without a deploy. A signed cookie keeps a visitor in for 30 days; it names the code's holder and stops working the
// moment that code is removed. Without it only /login.html and its icons are served — no app code, no signal data.
// Also hosts the small API the app needs once signed in: /api/me, /api/logout and /api/push (web-push devices,
// access/push-subs.json, read by scripts/push.js). Env: ACCESS_SECRET (cookie signing), BLOB_READ_WRITE_TOKEN.
// NO imports on purpose: Vercel does not ship node_modules with Routing Middleware (with @vercel/blob imported, production
// failed "Cannot find module '@vercel/blob'", and a bundled copy wouldn't load as a module). The Blob store is reached
// with plain fetch — the same requests @vercel/blob makes (reads: the store host with ?cache=0; writes: the Blob API).
const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN || '';
const storeId = () => blobToken().split('_')[3] || ''; // vercel_blob_rw_<storeId>_<secret>
async function blobGet(path) {
  const r = await fetch(`https://${storeId()}.private.blob.vercel-storage.com/${path}?cache=0`, { headers: { authorization: `Bearer ${blobToken()}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`blob get ${r.status}`);
  return r.text();
}
async function blobPut(path, text) {
  const r = await fetch(`https://vercel.com/api/blob/?pathname=${encodeURIComponent(path)}`, {
    method: 'PUT', body: text,
    headers: { authorization: `Bearer ${blobToken()}`, 'x-api-version': '12', 'x-vercel-blob-store-id': storeId(), 'x-vercel-blob-access': 'private',
      'x-add-random-suffix': '0', 'x-allow-overwrite': '1', 'x-content-type': 'application/json' },
  });
  if (!r.ok) throw new Error(`blob put ${r.status}`);
}
// What @vercel/functions next() returns: let the request continue to the static file
const next = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

export const config = { matcher: '/:path*', runtime: 'nodejs' };

const COOKIE = 'gs_auth';
const DAYS = 30;
const CODES = 'access/codes.json';
const SUBS = 'access/push-subs.json';
// Served to everyone: the login page and what it shows / the browser asks for on its own
const PUBLIC = /^\/(login\.html|logo\.svg|favicon\.ico|manifest\.webmanifest|robots\.txt|icons\/.*)$/;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function sign(msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.ACCESS_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
const normalize = (code) => String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

async function readJson(path, fallback) {
  try {
    const text = await blobGet(path);
    return text == null ? fallback : JSON.parse(text);
  } catch (e) { return fallback; }
}
const writeJson = (path, value) => blobPut(path, JSON.stringify(value));

// The code list, cached briefly per instance (a revoked code stops working within ~30 s)
let cache = { at: 0, codes: [] };
async function codes() {
  if (Date.now() - cache.at < 30e3) return cache.codes;
  const data = await readJson(CODES, { codes: [] });
  cache = { at: Date.now(), codes: data.codes || [] };
  return cache.codes;
}

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const cookieOut = (value, maxAge) => `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
function readCookie(request) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

// The holder's name when the cookie is valid and their code still exists, else null
async function holder(request) {
  const raw = readCookie(request);
  if (!raw || !process.env.ACCESS_SECRET) return null;
  const [name64, exp, sig] = raw.split('.');
  if (!name64 || !exp || !sig || +exp < Date.now()) return null;
  let name;
  try { name = decodeURIComponent(atob(name64)); } catch (e) { return null; }
  const entry = (await codes()).find((c) => c.name === name);
  if (!entry) return null;
  return (await sign(`${name}|${exp}|${entry.hash}`)) === sig ? name : null;
}

async function login(request) {
  // The code comes in a header: Routing Middleware doesn't reliably receive the request body (it arrived empty).
  let code = request.headers.get('x-access-code') || '';
  if (!code) { try { code = (await request.json()).code; } catch (e) { /* empty */ } }
  const hash = await sha256(normalize(code));
  const entry = normalize(code) && (await codes()).find((c) => c.hash === hash);
  if (!entry || !process.env.ACCESS_SECRET) {
    await new Promise((r) => setTimeout(r, 700)); // slows down guessing
    return json({ ok: false, error: 'รหัสไม่ถูกต้อง' }, 401);
  }
  const exp = Date.now() + DAYS * 864e5;
  const name64 = btoa(encodeURIComponent(entry.name));
  const value = `${name64}.${exp}.${await sign(`${entry.name}|${exp}|${entry.hash}`)}`;
  return json({ ok: true, name: entry.name }, 200, { 'set-cookie': cookieOut(value, DAYS * 86400) });
}

// Web-push devices of the signed-in holder: GET → their devices, POST {endpoint, keys, device} → add, DELETE {endpoint}
async function pushApi(request, who) {
  const all = await readJson(SUBS, { subs: [] });
  const mine = () => all.subs.filter((s) => s.who === who);
  if (request.method === 'GET') return json({ subs: mine().map(({ endpoint, device, at }) => ({ endpoint, device, at })) });
  // Same as login: the device comes in a header (base64 JSON), the body as a fallback
  let body = {};
  try {
    const h = request.headers.get('x-push');
    body = h ? JSON.parse(decodeURIComponent(escape(atob(h)))) : await request.json();
  } catch (e) { return json({ ok: false }, 400); }
  if (!body.endpoint) return json({ ok: false }, 400);
  all.subs = all.subs.filter((s) => s.endpoint !== body.endpoint);
  if (request.method === 'POST') {
    if (!body.keys || !body.keys.p256dh || !body.keys.auth) return json({ ok: false }, 400);
    all.subs.unshift({ who, endpoint: body.endpoint, keys: body.keys, device: String(body.device || '').slice(0, 40), at: Date.now() });
    const keep = new Map(); // at most 5 devices per holder
    all.subs = all.subs.filter((s) => { const n = (keep.get(s.who) || 0) + 1; keep.set(s.who, n); return n <= 5; });
  }
  await writeJson(SUBS, all);
  return json({ ok: true });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (PUBLIC.test(path)) return next();
  if (path === '/api/login' && request.method === 'POST') return login(request);
  if (path === '/api/logout') {
    return new Response(null, { status: 302, headers: { location: '/login.html', 'set-cookie': cookieOut('', 0), 'cache-control': 'no-store' } });
  }
  const who = await holder(request);
  if (!who) {
    const page = path === '/' || path.endsWith('.html') || (request.headers.get('accept') || '').includes('text/html');
    if (page) return new Response(null, { status: 302, headers: { location: '/login.html', 'cache-control': 'no-store' } });
    return new Response('ต้องเข้าสู่ระบบด้วยรหัสก่อน', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (path === '/api/me') return json({ name: who });
  if (path === '/api/push') return pushApi(request, who);
  return next();
}
