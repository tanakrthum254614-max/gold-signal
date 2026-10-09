// "New member" messages for the admins. middleware.js queues one in the private Blob store (access/new-members.json)
// when someone signs in within 15 minutes of signing up; this sends each as a push notification to the admins' devices
// (marked admin: true) and, when LINE_OWNER_ID is set, as a LINE message to the owner only (push API, 1 message each —
// never a broadcast to every friend). Then the queue is emptied (ids kept in `sent` so nobody is announced twice).
// Usage: node scripts/new-members.js      Env: BLOB_READ_WRITE_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SEND=true,
//        LINE_CHANNEL_ACCESS_TOKEN + LINE_OWNER_ID (optional), SITE_URL
const { push } = require('./push.js');
const SITE = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const QUEUE = 'access/new-members.json';

async function readQueue() {
  const { get } = require('@vercel/blob');
  const r = await get(QUEUE, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return { pending: [], sent: [] };
  return JSON.parse(await new Response(r.stream).text());
}
async function writeQueue(q) {
  const { put } = require('@vercel/blob');
  await put(QUEUE, JSON.stringify(q), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}
const thai = (ms) => new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
function text(m) {
  return [
    '👤 สมาชิกใหม่ Gold Signal',
    `${m.name && m.name !== m.email ? `${m.name} · ` : ''}${m.email}`,
    `สมัครด้วย ${m.method || '—'} · ${thai(m.at)}`,
    [m.device, m.place].filter(Boolean).join(' · '),
    `ดูในหลังบ้าน: ${SITE}/admin.html`,
  ].filter(Boolean).join('\n');
}
async function line(texts) {
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim(), to = (process.env.LINE_OWNER_ID || '').trim();
  if (!token || !to) return console.log('LINE: LINE_OWNER_ID not set — push notification only');
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: texts.slice(0, 5).map((t) => ({ type: 'text', text: t })) }),
  });
  console.log(r.ok ? `✓ LINE: ${Math.min(5, texts.length)} sent to the owner` : `⚠️ LINE ${r.status}: ${await r.text()}`);
}

(async () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return console.log('new-members: BLOB_READ_WRITE_TOKEN missing — skipped');
  const q = await readQueue();
  if (!q.pending.length) return console.log('new-members: nobody new');
  const texts = q.pending.map(text);
  texts.forEach((t) => console.log(`---\n${t.replace(/[^\s@]+@/, '***@')}`)); // no full emails in the public Actions log
  if (process.env.SEND !== 'true') return console.log('new-members: SEND is not true — nothing sent, queue kept');
  await push(texts, { adminsOnly: true });
  await line(texts).catch((e) => console.log(`⚠️ LINE failed: ${e.message}`));
  // Re-read so a sign-up queued meanwhile isn't lost; drop only what was just sent
  const done = new Set(q.pending.map((p) => p.id)), now = await readQueue();
  await writeQueue({ pending: now.pending.filter((p) => !done.has(p.id)), sent: [...(now.sent || []), ...done].slice(-500) });
})().catch((e) => { console.log(`⚠️ new-members failed: ${e.message}`); });
