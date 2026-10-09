// Access control for the whole site (Vercel Routing Middleware, runs before every request).
// Members only (user, 8 Oct 2026): people sign up / sign in with Clerk (email + password with an emailed code, or
// Google) on /login.html; that page hands the Clerk session token to POST /api/session, which checks it against
// Clerk's public keys and sets the site's own signed cookie (14 days). Without the cookie only /login.html and its icons
// are served — no app code, no signal data. Also: /api/me, /api/logout, /api/push (web-push devices in the private Blob
// store, access/push-subs.json, read by scripts/push.js), /api/visit, and the admin back office (/admin.html,
// /api/admin/members, /api/admin/log, /api/admin/ban — ADMIN_EMAILS only), and the new-member queue (access/new-members.json).
// Env: ACCESS_SECRET (cookie signing), CLERK_SECRET_KEY (names / emails), BLOB_READ_WRITE_TOKEN, ADMIN_EMAILS (comma list).
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
const PUBLIC = /^\/(login\.html|privacy\.html|logo\.svg|favicon\.ico|manifest\.webmanifest|robots\.txt|icons\/.*)$/;

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

// Members suspended from the back office (access/banned.json), cached briefly per instance: a suspension takes effect
// within ~30 s even for someone already signed in
const BANNED = 'access/banned.json';
let banCache = { at: 0, ids: [] };
async function bannedIds() {
  if (Date.now() - banCache.at < 30e3) return banCache.ids;
  banCache = { at: Date.now(), ids: (await readJson(BANNED, { ids: [] })).ids || [] };
  return banCache.ids;
}

// The member { id, name, email } when the cookie is valid, else null ({ banned: true } when suspended)
async function member(request) {
  const raw = readCookie(request);
  if (!raw || !process.env.ACCESS_SECRET) return null;
  const [data, exp, sig] = raw.split('.');
  if (!data || !exp || !sig || +exp < Date.now()) return null;
  if ((await sign(`${data}.${exp}`)) !== sig) return null;
  let m;
  try { m = JSON.parse(decodeURIComponent(escape(atob(data)))); } catch (e) { return null; }
  return (await bannedIds()).includes(m.id) ? { banned: true } : m;
}

// After signing in with Clerk: Authorization: Bearer <Clerk session token> → the site's cookie
async function session(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const id = await clerkUser(token);
  if (!id || !process.env.ACCESS_SECRET) return json({ ok: false, error: 'เข้าสู่ระบบไม่สำเร็จ' }, 401);
  if ((await bannedIds()).includes(id)) return json({ ok: false, banned: true, error: 'บัญชีนี้ถูกระงับการใช้งาน' }, 403);
  let name = '', email = '', created = 0, method = '';
  try { // name and email for the account page (the session token doesn't carry them)
    const r = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${(process.env.CLERK_SECRET_KEY || '').trim()}` } });
    if (r.ok) {
      const u = await r.json();
      const primary = (u.email_addresses || []).find((e) => e.id === u.primary_email_address_id) || (u.email_addresses || [])[0];
      email = primary ? primary.email_address : '';
      name = [u.first_name, u.last_name].filter(Boolean).join(' ') || email;
      created = u.created_at || 0;
      method = (u.external_accounts || []).some((a) => /google/.test(a.provider)) ? 'Google' : 'อีเมล';
    }
  } catch (e) { /* the cookie still works without them */ }
  const data = btoa(unescape(encodeURIComponent(JSON.stringify({ id, name, email }))));
  const exp = Date.now() + DAYS * 864e5;
  await logEvent(request, { id, name, email }, 'login').catch(() => {});
  // Just signed up (account under 15 minutes old): queue a "new member" message for the admins (scripts/new-members.js)
  if (created && Date.now() - created < 15 * 60e3 && !isAdmin({ email })) await queueNewMember(request, { id, name, email, method }).catch(() => {});
  return json({ ok: true }, 200, { 'set-cookie': cookieOut(`${data}.${exp}.${await sign(`${data}.${exp}`)}`, DAYS * 86400) });
}

// Web-push devices of the signed-in member: GET → their devices, POST {endpoint, keys, device} → add, DELETE {endpoint}
async function pushApi(request, m) {
  const who = m.id;
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
    all.subs.unshift({ who, ...(isAdmin(m) ? { admin: true } : {}), endpoint: body.endpoint, keys: body.keys, device: String(body.device || '').slice(0, 40), at: Date.now() });
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
  if (who && who.banned) { // suspended from the back office: signed out at once
    const page = path === '/' || path.endsWith('.html') || (request.headers.get('accept') || '').includes('text/html');
    const headers = { 'set-cookie': cookieOut('', 0), 'cache-control': 'no-store' };
    return page ? new Response(null, { status: 302, headers: { ...headers, location: '/login.html?banned=1' } }) : json({ ok: false, banned: true }, 403, headers);
  }
  if (!who) {
    const page = path === '/' || path.endsWith('.html') || (request.headers.get('accept') || '').includes('text/html');
    if (page) return new Response(null, { status: 302, headers: { location: '/login.html', 'cache-control': 'no-store' } });
    return new Response('ต้องเข้าสู่ระบบก่อน', { status: 401, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (path === '/api/me') {
    if (isAdmin(who)) await markAdminDevices(who.id).catch(() => {});
    return json({ name: who.name, email: who.email, admin: isAdmin(who) });
  }
  if (path === '/api/push') return pushApi(request, who);
  if (path === '/api/visit' && request.method === 'POST') { await logEvent(request, who, 'visit').catch(() => {}); return json({ ok: true }); }
  // Back office: members and the access log — admins only (ADMIN_EMAILS)
  if (path === '/admin.html' || path.startsWith('/api/admin/')) {
    if (!isAdmin(who)) {
      return path === '/admin.html' ? new Response(null, { status: 302, headers: { location: '/', 'cache-control': 'no-store' } }) : json({ ok: false }, 403);
    }
    if (path === '/api/admin/members') return adminMembers();
    if (path === '/api/admin/log') return json((await readJson(LOG, { events: [] })).events.slice().reverse());
    if (path === '/api/admin/ban' && request.method === 'POST') return adminBan(request, who);
  }
  return next();
}

// ---------- Back office ----------
const LOG = 'access/log.json';
const admins = () => (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
const isAdmin = (m) => !!(m && m.email) && admins().includes(m.email.toLowerCase());
function device(ua) {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'อื่น ๆ';
  const app = /Line\//.test(ua) ? 'LINE' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return app ? `${os} · ${app}` : os;
}
// One line in the access log: a sign-in, or the first visit of the day from a device (sent by auth.js). Last 5,000 kept.
async function logEvent(request, m, type) {
  const h = request.headers;
  let city = h.get('x-vercel-ip-city') || '';
  try { city = decodeURIComponent(city); } catch (e) { /* keep raw */ }
  const all = await readJson(LOG, { events: [] });
  all.events.push({ at: Date.now(), type, id: m.id, name: m.name, email: m.email, device: device(h.get('user-agent') || ''), country: h.get('x-vercel-ip-country') || '', city });
  all.events = all.events.slice(-5000);
  await writeJson(LOG, all);
}
// "New member" messages for the admins: the sign-in queues one in access/new-members.json; scripts/new-members.js (GitHub
// Actions, every 15 min) sends it as a push notification to the admins' devices (and to the owner's LINE if LINE_OWNER_ID
// is set) and empties the queue. Admin devices are marked admin: true (when switched on, or on the admin's next visit).
const NEWQ = 'access/new-members.json';
async function queueNewMember(request, m) {
  const h = request.headers;
  let city = h.get('x-vercel-ip-city') || '';
  try { city = decodeURIComponent(city); } catch (e) { /* keep raw */ }
  const q = await readJson(NEWQ, { pending: [], sent: [] });
  if (q.pending.some((p) => p.id === m.id) || (q.sent || []).includes(m.id)) return;
  q.pending.push({ ...m, at: Date.now(), device: device(h.get('user-agent') || ''), place: [city, h.get('x-vercel-ip-country') || ''].filter(Boolean).join(', ') });
  await writeJson(NEWQ, q);
}
let adminMarked = new Set(); // per instance: an admin's devices already checked
async function markAdminDevices(id) {
  if (adminMarked.has(id)) return;
  const all = await readJson(SUBS, { subs: [] });
  if (all.subs.some((s) => s.who === id && !s.admin)) await writeJson(SUBS, { ...all, subs: all.subs.map((s) => (s.who === id ? { ...s, admin: true } : s)) });
  adminMarked.add(id);
}
// Suspend / restore a member (headers x-user-id, x-action: ban | unban): our list signs them out within ~30 s, and Clerk's
// ban stops new sign-ins. Admins can't be suspended (no locking yourself out).
async function adminBan(request, who) {
  const id = request.headers.get('x-user-id') || '', action = request.headers.get('x-action');
  if (!/^user_[A-Za-z0-9]+$/.test(id) || !['ban', 'unban'].includes(action)) return json({ ok: false, error: 'คำขอไม่ถูกต้อง' }, 400);
  if (id === who.id) return json({ ok: false, error: 'ระงับบัญชีตัวเองไม่ได้' }, 400);
  const key = (process.env.CLERK_SECRET_KEY || '').trim();
  const u = await fetch(`https://api.clerk.com/v1/users/${id}`, { headers: { authorization: `Bearer ${key}` } });
  if (!u.ok) return json({ ok: false, error: 'ไม่พบสมาชิก' }, 404);
  const user = await u.json();
  const email = ((user.email_addresses || []).find((e) => e.id === user.primary_email_address_id) || {}).email_address || '';
  if (action === 'ban' && admins().includes(email.toLowerCase())) return json({ ok: false, error: 'ระงับแอดมินไม่ได้' }, 400);
  const list = await readJson(BANNED, { ids: [] });
  list.ids = (list.ids || []).filter((x) => x !== id);
  if (action === 'ban') list.ids.push(id);
  await writeJson(BANNED, list);
  banCache = { at: 0, ids: [] }; // this instance sees it right away
  const r = await fetch(`https://api.clerk.com/v1/users/${id}/${action}`, { method: 'POST', headers: { authorization: `Bearer ${key}` } });
  await logEvent(request, { id, name: [user.first_name, user.last_name].filter(Boolean).join(' '), email }, action === 'ban' ? 'banned' : 'unbanned').catch(() => {});
  return json({ ok: true, clerk: r.ok });
}

// Everyone who signed up (Clerk), with sign-in / visit counts from the access log
async function adminMembers() {
  const key = (process.env.CLERK_SECRET_KEY || '').trim();
  const users = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const r = await fetch(`https://api.clerk.com/v1/users?limit=500&offset=${offset}&order_by=-created_at`, { headers: { authorization: `Bearer ${key}` } });
    if (!r.ok) return json({ ok: false, error: `Clerk ${r.status}` }, 502);
    const page = await r.json();
    users.push(...page);
    if (page.length < 500) break;
  }
  const events = (await readJson(LOG, { events: [] })).events.filter((e) => e.type === 'login' || e.type === 'visit');
  const banned = await readJson(BANNED, { ids: [] }).then((b) => b.ids || []);
  const stats = new Map();
  events.forEach((e) => {
    const s = stats.get(e.id) || { logins: 0, visits: 0, lastSeen: 0, device: '', place: '' };
    if (e.type === 'login') s.logins++; else s.visits++;
    if (e.at > s.lastSeen) { s.lastSeen = e.at; s.device = e.device; s.place = [e.city, e.country].filter(Boolean).join(', '); }
    stats.set(e.id, s);
  });
  return json(users.map((u) => {
    const primary = (u.email_addresses || []).find((e) => e.id === u.primary_email_address_id) || (u.email_addresses || [])[0];
    const email = primary ? primary.email_address : '';
    const s = stats.get(u.id) || { logins: 0, visits: 0, lastSeen: 0, device: '', place: '' };
    return {
      id: u.id, email, name: [u.first_name, u.last_name].filter(Boolean).join(' '), image: u.image_url || '',
      method: (u.external_accounts || []).some((a) => /google/.test(a.provider)) ? 'Google' : 'อีเมล',
      createdAt: u.created_at, lastSignInAt: u.last_sign_in_at || 0, lastActiveAt: u.last_active_at || 0, banned: !!u.banned || banned.includes(u.id),
      admin: admins().includes(email.toLowerCase()), ...s,
    };
  }));
}
