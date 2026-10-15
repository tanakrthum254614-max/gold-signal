// Sends messages to LINE, and the same texts as push notifications to the app (scripts/push.js). Failures are logged, never thrown, so results keep being recorded
// (e.g. when the monthly LINE quota runs out). Env: LINE_CHANNEL_ACCESS_TOKEN, SEND=true
// OUTBOX=<file>: queue texts there instead; scripts/flush.js then sends everything from one run as ONE
// LINE request (the free plan counts requests × friends, not bubbles).
//
// Kinds (16 Oct 2026 — the free plan's 300 messages/month are counted per friend: ~51/month × 6 friends = all of it):
//   'signal' (default) entry signals → always LINE + web push
//   'extra'  morning overview, news warnings → web push always; LINE only while the quota keeps room for
//            RESERVE more signal broadcasts this month (lineRoom). LINE_EXTRAS=on|off forces it.
//   'admin'  job failures, quota warnings → admins only (web push to admin devices; LINE push to LINE_OWNER_ID only
//            if it is set) — never a broadcast to members
const fs = require('fs');
const { broadcast } = require('./line.js');
const { push } = require('./push.js');

// Pack texts into at most 5 LINE text bubbles (≤ 5000 characters each)
function pack(texts, max = 4800) {
  const out = [];
  texts.forEach((t) => {
    const last = out[out.length - 1];
    if (out.length >= 5 || (last && last.length + t.length + 2 <= max && out.length >= 4)) out[out.length - 1] = `${last}

${t}`;
    else out.push(t);
  });
  return out;
}

async function attempt(fn) {
  try { await fn(); console.log('✓ sent to LINE'); } catch (e) { console.log(`⚠️ LINE send failed: ${e.message}`); }
}

async function lineGet(url) {
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`LINE ${r.status}`);
  return r.json();
}
// Friends a broadcast reaches: LINE's follower insight for yesterday (or the day before); null when not ready
async function friends() {
  for (const back of [1, 2]) {
    const d = new Date(Date.now() + 7 * 3600e3 - back * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const x = await lineGet(`https://api.line.me/v2/bot/insight/followers?date=${d}`);
      if (x.status === 'ready') return Math.max(1, x.targetedReaches ?? x.followers ?? 1);
    } catch (e) { /* try the day before */ }
  }
  return null;
}
// Room on LINE for a non-signal message: what's left after it must still cover RESERVE signal broadcasts
const RESERVE = 15;
async function lineRoom() {
  const mode = (process.env.LINE_EXTRAS || 'auto').toLowerCase();
  if (mode === 'on') return { ok: true, why: 'LINE_EXTRAS=on' };
  if (mode === 'off') return { ok: false, why: 'LINE_EXTRAS=off' };
  try {
    const [quota, used] = await Promise.all([lineGet('https://api.line.me/v2/bot/message/quota'), lineGet('https://api.line.me/v2/bot/message/quota/consumption')]);
    if (quota.type !== 'limited') return { ok: true, why: 'no monthly limit' };
    const n = await friends(), left = quota.value - used.totalUsage;
    if (n == null) return { ok: used.totalUsage < quota.value * 0.5, why: `used ${used.totalUsage}/${quota.value}, friends unknown → send while under 50%` };
    return { ok: left - n >= n * RESERVE, why: `used ${used.totalUsage}/${quota.value} · ${n} friend(s) · keeping ${n * RESERVE} for signals` };
  } catch (e) {
    return { ok: true, why: `quota check failed (${e.message}) — sending` };
  }
}

const norm = (x, kind) => (typeof x === 'string' ? { text: x, kind } : { text: x.text, kind: x.kind || kind });

// texts: (string | {text, kind})[] — sent together as one LINE request; opts.kind = kind of the plain strings
async function send(texts, opts = {}) {
  const items = (texts || []).filter(Boolean).map((x) => norm(x, opts.kind || 'signal'));
  if (!items.length) return;
  if (process.env.OUTBOX) {
    const q = fs.existsSync(process.env.OUTBOX) ? JSON.parse(fs.readFileSync(process.env.OUTBOX, 'utf8')) : [];
    fs.writeFileSync(process.env.OUTBOX, JSON.stringify([...q, ...items]));
    return console.log(`queued ${items.length} message(s)`);
  }
  if (process.env.SEND !== 'true') { items.forEach((m) => console.log(`(dry run · ${m.kind})\n${m.text}`)); return; }
  const of = (k) => items.filter((m) => m.kind === k).map((m) => m.text);
  const signal = items.filter((m) => m.kind !== 'admin' && m.kind !== 'extra').map((m) => m.text), extra = of('extra'), admin = of('admin');
  let line = signal;
  if (extra.length) {
    const room = await lineRoom();
    console.log(`LINE extras (${extra.length}): ${room.ok ? 'LINE + web push' : 'web push only'} — ${room.why}`);
    if (room.ok) line = [...signal, ...extra];
  }
  if (line.length) await attempt(() => broadcast(...pack(line).map((text) => ({ type: 'text', text }))));
  if (signal.length || extra.length) await push([...signal, ...extra]);
  if (admin.length) await toAdmins(admin);
}

// Rich LINE message (flex) — opts.kind as above (the morning overview is 'extra')
async function sendFlex(flex, opts = {}) {
  if (process.env.SEND !== 'true') { console.log(`(dry run · ${opts.kind || 'signal'}) flex ${JSON.stringify(flex).length} bytes`); return; }
  let ok = true;
  if (opts.kind === 'extra') { const room = await lineRoom(); ok = room.ok; console.log(`LINE flex: ${ok ? 'LINE + web push' : 'web push only'} — ${room.why}`); }
  if (ok) await attempt(() => broadcast(flex));
  if (flex.altText) await push([flex.altText]);
}

// Admins only: web push to admin devices; LINE push (never broadcast) to LINE_OWNER_ID when it is set
async function toAdmins(texts) {
  await push(texts, { adminsOnly: true });
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim(), to = (process.env.LINE_OWNER_ID || '').trim();
  if (!token || !to) return console.log('admin message: web push to admin devices only (LINE_OWNER_ID not set)');
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: pack(texts).map((text) => ({ type: 'text', text })) }),
    });
    console.log(r.ok ? '✓ LINE sent to the owner' : `⚠️ LINE ${r.status}: ${await r.text()}`);
  } catch (e) { console.log(`⚠️ LINE owner push failed: ${e.message}`); }
}

module.exports = { send, sendFlex, pack, lineRoom };
