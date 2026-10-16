// Access control for the whole site (Vercel Routing Middleware, runs before every request).
// Members only (user, 8 Oct 2026): people sign up / sign in with Clerk (email + password with an emailed code, or
// Google) on /login.html; that page hands the Clerk session token to POST /api/session, which checks it against
// Clerk's public keys and sets the site's own signed cookie (14 days). Without the cookie only /login.html and its icons
// are served — no app code, no signal data. Also: /api/me, /api/logout, /api/push (web-push devices in the private Blob
// store, access/push-subs.json, read by scripts/push.js), /api/visit, and the admin back office (/admin.html,
// /api/admin/members, /api/admin/log, /api/admin/ban — ADMIN_EMAILS only), and the new-member queue (access/new-members.json).
// Env: ACCESS_SECRET (cookie signing), CLERK_SECRET_KEY (names / emails), BLOB_READ_WRITE_TOKEN, ADMIN_EMAILS (comma list).
// 14 Oct 2026: routes that need request bodies are Vercel Functions in api/ (journal, articles, coach, pro, pay/*; shared
// code in lib/gs.mjs) — this file lets members through to them (next()), lets Stripe reach /api/pay/webhook, hides lib/,
// and, when PRO_ENABLED=1, keeps the ZFrames dashboard for PRO members (proOk / proWall at the bottom).
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
// demo.html (16 Oct 2026): plain candles for visitors — loads none of the members-only scripts
// terms.html (17 Oct 2026): prices, terms, cancel / refund policy, contact — Stripe's business verification needs it public
const PUBLIC = /^\/(login\.html|demo\.html|terms\.html|privacy\.html|logo\.svg|favicon\.ico|manifest\.webmanifest|robots\.txt|icons\/.*)$/;
// Stripe calls this one itself (no cookie) — api/pay/webhook.mjs refuses anything without a valid Stripe signature
const WEBHOOK = '/api/pay/webhook';

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
// ⭐ The gurus a member follows (US stocks → พอร์ตกูรู, 16 Oct 2026). Private Blob access/guru-follows.json { follows: { who: [cik…] } },
// read by scripts/gurus-notify.js: a member following anyone gets guru alerts only for them. GET → { ciks }, POST (header
// x-follow: base64 JSON { ciks }) → saved. At most 40 numbers.
const FOLLOWS = 'access/guru-follows.json';
async function guruFollowApi(request, m) {
  const all = await readJson(FOLLOWS, { follows: {} });
  if (request.method === 'GET') return json({ ciks: all.follows[m.id] || [] });
  if (request.method !== 'POST') return json({ ok: false }, 405);
  let body = {};
  try { const h = request.headers.get('x-follow'); body = h ? JSON.parse(atob(h)) : await request.json(); } catch (e) { return json({ ok: false }, 400); }
  const ciks = [...new Set((Array.isArray(body.ciks) ? body.ciks : []).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < 1e10))].slice(0, 40);
  if (ciks.length) all.follows[m.id] = ciks; else delete all.follows[m.id];
  await writeJson(FOLLOWS, all);
  return json({ ok: true, ciks });
}

// 🔔 Gold price alerts each member sets (account tab, 17 Oct 2026): private Blob access/price-alerts.json
// { alerts: [{ id, who, price, dir: 'up' | 'down', at }] }, checked every 5 minutes by scripts/price-alerts-user.js (web push to
// that member's devices, then removed). GET → { alerts } (mine) · POST header x-alert: base64 JSON { price, dir } → added (max 10)
// · DELETE header x-alert: base64 JSON { id } → removed.
const ALERTS = 'access/price-alerts.json';
async function priceAlertApi(request, m) {
  const all = await readJson(ALERTS, { alerts: [] });
  const mine = () => all.alerts.filter((a) => a.who === m.id).map(({ id, price, dir, at }) => ({ id, price, dir, at }));
  if (request.method === 'GET') return json({ alerts: mine() });
  let body = {};
  try { const h = request.headers.get('x-alert'); body = h ? JSON.parse(atob(h)) : await request.json(); } catch (e) { return json({ ok: false }, 400); }
  if (request.method === 'POST') {
    const price = Math.round(Number(body.price) * 100) / 100, dir = body.dir === 'down' ? 'down' : 'up';
    if (!(price > 100 && price < 100000)) return json({ ok: false, error: 'ราคาไม่ถูกต้อง' }, 400);
    // ⭐ PRO: 10 alerts · free member: 1 (always 10 while the paywall is off)
    const cap = (await proOk(m, 'alerts')) ? 10 : 1;
    if (all.alerts.filter((a) => a.who === m.id).length >= cap) return json({ ok: false, pro: cap === 1, error: cap === 1 ? 'สมาชิกฟรีตั้งได้ 1 รายการ — PRO ตั้งได้ 10' : 'ตั้งได้สูงสุด 10 รายการ' }, cap === 1 ? 402 : 400);
    all.alerts.push({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, who: m.id, price, dir, at: Date.now() });
  } else if (request.method === 'DELETE') {
    all.alerts = all.alerts.filter((a) => !(a.who === m.id && a.id === String(body.id)));
  } else return json({ ok: false }, 405);
  await writeJson(ALERTS, all);
  return json({ ok: true, alerts: mine() });
}

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

// Signal records live on the repo's `data` branch (scripts/data-branch.sh), not main, so the 5-minute recorder no longer
// redeploys the site (Vercel Hobby: 100 deployments a day — used up on 12 Oct 2026). Members get these files fresh from
// that branch; the copies deployed with the site are only a fallback if GitHub can't be reached. The query string busts
// GitHub's 5-minute CDN cache at most once per 10 s per file, and each instance keeps a copy for 10 s.
const DATA = /^\/(signals|intraday|chart-signals|quota|backtest|backtest-30m|backtest-15m|zframes\/dashboards\/(?:gold|ndx|spx|div|gurus|gurus-live))\.json$/; // + dashboards refreshed each morning, guru 13F portfolios, guru filings every 10 min
const RAW = 'https://raw.githubusercontent.com/tanakrthum254614-max/gold-signal/data';
const dataCache = new Map();
async function dataFile(path) {
  const now = Date.now(), hit = dataCache.get(path);
  let text = hit && now - hit.at < 10e3 ? hit.text : null;
  if (text == null) {
    const r = await fetch(`${RAW}${path}?t=${Math.floor(now / 10e3)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    text = await r.text();
    dataCache.set(path, { at: now, text });
  }
  return new Response(text, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-gs-data': 'data-branch' } });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (PUBLIC.test(path)) return next();
  if (path === WEBHOOK && request.method === 'POST') return next();
  if (path.startsWith('/lib/')) return new Response('Not found', { status: 404 }); // server code for api/ — not a page
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
  // 💰 Paid membership (user, 16 Oct 2026: "อยากให้ตอนสมัครสมาชิกเสียตังเลย แยกเป็นรายเดือนและรายปี … ยกเว้นบัญชีแอดมิน"):
  // once the paywall is on, a member who hasn't paid (or whose PRO ran out) only reaches /pay.html and what it needs.
  if (path === '/api/paid') return json({ ok: true, paid: await paidOk(who, true) });
  if (!PAY_OPEN.test(path) && !(await paidOk(who))) {
    const page = path === '/' || path.endsWith('.html') || (request.headers.get('accept') || '').includes('text/html');
    if (page) return new Response(null, { status: 302, headers: { location: '/pay.html', 'cache-control': 'no-store' } });
    return json({ ok: false, pay: true, error: 'ต้องสมัครแพ็กเกจก่อน' }, 402);
  }
  if (path === '/api/push') return pushApi(request, who);
  if (path === '/api/gurus/follow') return (await proOk(who, 'dashboard')) ? guruFollowApi(request, who) : proWall(path); // ⭐ gurus = PRO
  if (path === '/api/alerts') return priceAlertApi(request, who);
  if (path === '/api/visit' && request.method === 'POST') { await logEvent(request, who, 'visit').catch(() => {}); return json({ ok: true }); }
  // PRO paywall (only when PRO_ENABLED=1 and PRO_FEATURES has "dashboard"): the ZFrames dashboard and its price API
  if ((path.startsWith('/zframes/') || path.startsWith('/api/zframes/') || path === '/api/candles' || path === '/api/gurus/follow') && !(await proOk(who, 'dashboard'))) return proWall(path);
  if (path === '/api/zframes/quotes' && request.method === 'GET') return zframesQuotes(request);
  // Back office: members and the access log — admins only (ADMIN_EMAILS)
  if (path === '/admin.html' || path.startsWith('/api/admin/')) {
    if (!isAdmin(who)) {
      return path === '/admin.html' ? new Response(null, { status: 302, headers: { location: '/', 'cache-control': 'no-store' } }) : json({ ok: false }, 403);
    }
    if (path === '/api/admin/members') return adminMembers();
    if (path === '/api/admin/log') return json((await readJson(LOG, { events: [] })).events.slice().reverse());
    if (path === '/api/admin/ban' && request.method === 'POST') return adminBan(request, who);
  }
  if (DATA.test(path)) {
    const r = await dataFile(path).catch(() => null);
    // ⭐ PRO: free members' recorded chart signals are the 1-hour main system only (the other timeframes are PRO)
    if (r && path === '/chart-signals.json' && !(await proOk(who, 'signals'))) {
      const j = JSON.parse(await r.text());
      j.trades = (j.trades || []).filter((t) => t.tf === '1h');
      return new Response(JSON.stringify(j), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-gs-data': 'data-branch-free' } });
    }
    if (r) return r;
  }
  return next();
}

// Initial and fallback Yahoo prices for the member dashboard. Yahoo blocks browser HTTP CORS.
async function zframesQuotes(request) {
  const symbols = (new URL(request.url).searchParams.get('symbols') || '').split(',').filter(Boolean);
  if (!Array.isArray(symbols) || symbols.length > 100 || symbols.some(s => typeof s !== 'string' || !/^\^?[A-Z0-9.\-]{1,12}$/.test(s)))
    return json({ error: 'Invalid symbols' }, 400);
  const unique = [...new Set(symbols)].map(s => s.replace('.', '-'));
  const chunks = [];
  for (let i = 0; i < unique.length; i += 20) chunks.push(unique.slice(i, i + 20));
  const out = {};
  for (let i = 0; i < chunks.length; i += 5) {
    await Promise.all(chunks.slice(i, i + 5).map(async chunk => {
      try {
        const url = 'https://query1.finance.yahoo.com/v7/finance/spark?symbols=' + chunk.map(encodeURIComponent).join(',') + '&range=1d&interval=5m&includePrePost=true';
        const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
        if (!r.ok) return;
        const data = await r.json();
        for (const item of data.spark?.result || []) {
          const meta = item.response?.[0]?.meta;
          if (!meta) continue;
          const now = Date.now()/1000, p = meta.currentTradingPeriod;
          const hours = !p ? 'closed' : now >= p.regular.start && now < p.regular.end ? 'open' : now >= p.pre.start && now < p.pre.end ? 'pre' : now >= p.post.start && now < p.post.end ? 'post' : 'closed';
          const px = Number(meta.fulldayPrice && hours !== 'open' ? meta.fulldayPrice : meta.regularMarketPrice);
          const prev = Number(meta.chartPreviousClose ?? meta.previousClose);
          if (!Number.isFinite(px) || px <= 0) continue;
          const key = item.symbol.replace(/^([A-Z]+)-([A-Z])$/, '$1.$2');
          out[key] = { px, prev, ch: prev ? px/prev-1 : 0, t: meta.regularMarketTime*1000, hours, src: 'spark', hi: meta.regularMarketDayHigh, lo: meta.regularMarketDayLow, vol: meta.regularMarketVolume };
        }
      } catch {}
    }));
  }
  return json({ at: Date.now(), q: out });
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

// ---------- PRO (access/pro.json, written by api/pay/webhook.mjs and api/pro.mjs — same rules as lib/gs.mjs proOf) ----------
// Paywall on = env PRO_ENABLED=1 or access/pro-config.json { enabled } (the back office's go-live button)
let proCache = { at: 0, users: {}, enabled: false };
async function proState(fresh) {
  if (fresh || Date.now() - proCache.at > 30e3) {
    const [cfg, all] = await Promise.all([readJson('access/pro-config.json', {}), readJson('access/pro.json', { users: {} })]);
    proCache = { at: Date.now(), users: all.users || {}, enabled: !!cfg.enabled };
  }
  return proCache;
}
// The pay page, its price list and Stripe checkout stay open to signed-in members who haven't paid
const PAY_OPEN = /^\/(pay\.html|api\/pro|api\/pay\/(checkout|portal)|api\/visit)$/;
async function paidOk(m, fresh) {
  const c = await proState(fresh);
  if (process.env.PRO_ENABLED !== '1' && !c.enabled) return true; // paywall off = everyone in
  if (isAdmin(m)) return true;
  const u = c.users[m.id];
  return !!(u && u.until > Date.now());
}
async function proOk(m, feature) {
  await proState();
  if (process.env.PRO_ENABLED !== '1' && !proCache.enabled) return true;
  if (!(process.env.PRO_FEATURES || 'ai,dashboard,signals,alerts').split(',').map((s) => s.trim()).includes(feature)) return true;
  if (isAdmin(m)) return true;
  const u = proCache.users[m.id];
  return !!(u && u.until > Date.now());
}
function proWall(path) {
  if (!path.endsWith('.html')) return json({ ok: false, pro: true, error: 'สำหรับสมาชิก PRO' }, 402);
  return new Response(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>สมาชิก PRO</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d1016;color:#e6e9ef;font-family:system-ui,sans-serif;text-align:center;padding:16px}a{display:inline-block;margin-top:14px;padding:10px 18px;border-radius:10px;background:#e8b64c;color:#1c2433;font-weight:700;text-decoration:none}</style></head>
<body><div><div style="font-size:44px">⭐</div><h2>หุ้นสหรัฐ + พอร์ตกูรู สำหรับสมาชิก PRO</h2><p>Nasdaq 100 · S&amp;P 500 · หุ้นปันผล ราคาสด · พอร์ตกูรู 28 คน ซื้อขายล่าสุดจาก SEC · แจ้งเตือนเมื่อกูรูซื้อขาย</p><a href="/#account" target="_top">ดูแพ็กเกจ PRO</a></div></body></html>`,
  { status: 402, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
