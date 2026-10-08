// Access control for the whole site (Vercel Routing Middleware, runs before every request).
// Members only (user, 8 Oct 2026): people sign up / sign in with Clerk (email + password with an emailed code, or
// Google) on /login.html; that page hands the Clerk session token to POST /api/session, which checks it against
// Clerk's public keys and sets the site's own signed cookie (14 days). Without the cookie only /login.html and its icons
// are served — no app code, no signal data. Also: /api/me, /api/logout, /api/push (web-push devices in the private Blob
// store, access/push-subs.json, read by scripts/push.js).
// Env: ACCESS_SECRET (cookie signing), CLERK_SECRET_KEY (name / email of a new session), BLOB_READ_WRITE_TOKEN.
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
const DAYS = 14;
// Clerk Frontend API host of the publishable key used by login.html (pk_test_<base64("host$")>, public by design) —
// where Clerk's public signing keys live.
const FAPI = 'delicate-tapir-2101.clerk.accounts.dev';
const SUBS = 'access/push-subs.json';
// Served to everyone: the login page and what it shows / the browser asks for on its own
const PUBLIC = /^\/(login\.html|logo\.svg|favicon\.ico|manifest\.webmanifest|robots\.txt|icons\/.*)$/;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sign(msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.ACCESS_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function readJson(path, fallback) {
  try {
    const text = await blobGet(path);
    return text == null ? fallback : JSON.parse(text);
  } catch (e) { return fallback; }
}
const writeJson = (path, value) => blobPut(path, JSON.stringify(value));

// Clerk's public signing keys, cached for an hour
let keys = { at: 0, list: [] };
async function jwks() {
  if (Date.now() - keys.at < 3600e3 && keys.list.length) return keys.list;
  const r = await fetch(`https://${FAPI}/.well-known/jwks.json`);
  if (!r.ok) throw new Error(`jwks ${r.status}`);
  keys = { at: Date.now(), list: (await r.json()).keys || [] };
  return keys.list;
}
// The Clerk user id in a session token (RS256 JWT) if it is genuine, current and from our Clerk instance, else null
async function clerkUser(token) {
  const [h, p, sig] = String(token || '').split('.');
  if (!h || !p || !sig) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64url(h)));
    const claims = JSON.parse(new TextDecoder().decode(b64url(p)));
    const jwk = (await jwks()).find((k) => k.kid === header.kid);
    if (!jwk || header.alg !== 'RS256') return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(sig), enc.encode(`${h}.${p}`)))) return null;
    const now = Date.now() / 1000;
    if (claims.iss !== `https://${FAPI}` || !(claims.exp > now - 5) || (claims.nbf && claims.nbf > now + 5)) return null;
    return claims.sub || null;
  } catch (e) { return null; }
}

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const cookieOut = (value, maxAge) => `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
function readCookie(request) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

// The member { id, name, email } when the cookie is valid, else null
async function member(request) {
  const raw = readCookie(request);
  if (!raw || !process.env.ACCESS_SECRET) return null;
  const [data, exp, sig] = raw.split('.');
  if (!data || !exp || !sig || +exp < Date.now()) return null;
  if ((await sign(`${data}.${exp}`)) !== sig) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(data)))); } catch (e) { return null; }
}

// After signing in with Clerk: Authorization: Bearer <Clerk session token> → the site's cookie
async function session(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const id = await clerkUser(token);
  if (!id || !process.env.ACCESS_SECRET) return json({ ok: false, error: 'เข้าสู่ระบบไม่สำเร็จ' }, 401);
  let name = '', email = '';
  try { // name and email for the account page (the session token doesn't carry them)
    const r = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${(process.env.CLERK_SECRET_KEY || '').trim()}` } });
    if (r.ok) {
      const u = await r.json();
      const primary = (u.email_addresses || []).find((e) => e.id === u.primary_email_address_id) || (u.email_addresses || [])[0];
      email = primary ? primary.email_address : '';
      name = [u.first_name, u.last_name].filter(Boolean).join(' ') || email;
    }
  } catch (e) { /* the cookie still works without them */ }
  const data = btoa(unescape(encodeURIComponent(JSON.stringify({ id, name, email }))));
  const exp = Date.now() + DAYS * 864e5;
  return json({ ok: true }, 200, { 'set-cookie': cookieOut(`${data}.${exp}.${await sign(`${data}.${exp}`)}`, DAYS * 86400) });
}

// Web-push devices of the signed-in member: GET → their devices, POST {endpoint, keys, device} → add, DELETE {endpoint}
async function pushApi(request, who) {
  const all = await readJson(SUBS, { subs: [] });
  const mine = () => all.subs.filter((s) => s.who === who);
  if (request.method === 'GET') return json({ subs: mine().map(({ endpoint, device, at }) => ({ endpoint, device, at })) });
  // Routing Middleware doesn't reliably receive request bodies: the device comes in a header (base64 JSON)
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
    const keep = new Map(); // at most 5 devices per member
    all.subs = all.subs.filter((s) => { const n = (keep.get(s.who) || 0) + 1; keep.set(s.who, n); return n <= 5; });
  }
  await writeJson(SUBS, all);
  return json({ ok: true });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (PUBLIC.test(path)) return next();
  if (path === '/api/session' && request.method === 'POST') return session(request);
  if (path === '/api/logout') {
    return new Response(null, { status: 302, headers: { location: '/login.html?signout=1', 'set-cookie': cookieOut('', 0), 'cache-control': 'no-store' } });
  }
  const who = await member(request);
  if (!who) {
    const page = path === '/' || path.endsWith('.html') || (request.headers.get('accept') || '').includes('text/html');
    if (page) return new Response(null, { status: 302, headers: { location: '/login.html', 'cache-control': 'no-store' } });
    return new Response('ต้องเข้าสู่ระบบก่อน', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (path === '/api/me') return json({ name: who.name, email: who.email });
  if (path === '/api/push') return pushApi(request, who.id);
  return next();
}
