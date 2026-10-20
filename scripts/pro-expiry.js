// ⏰ Membership expiry reminder (17 Oct 2026 — back-office ideas list, user: "ทำมาหมดเลย"). Members who paid once
// (PromptPay / one-time card) or got days from the back office have no auto-renewal: 3 days before their PRO ends they
// get a web push on their own devices, once per expiry date (pro.json users[uid].reminded = that until). Card
// subscriptions renew by themselves and are skipped. Runs in every 5-minute check (scripts/check-loop.sh), never fails it.
// Usage: node scripts/pro-expiry.js   Env: BLOB_READ_WRITE_TOKEN, VAPID_*
const { push } = require('./push.js');
const FILE = 'access/pro.json', DAY = 864e5;
const thDate = (t) => new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

(async () => {
  if (!require('./blob').ready()) return console.log('pro expiry: no Blob token — skipped');
  const { get, put } = require('./blob');
  const r = await get(FILE, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return console.log('pro expiry: no members');
  const all = JSON.parse(await new Response(r.stream).text());
  const now = Date.now();
  const due = Object.entries(all.users || {}).filter(([, u]) => !u.sub && u.until > now && u.until - now <= 3 * DAY && u.reminded !== u.until);
  console.log(`pro expiry: ${due.length} to remind`);
  if (!due.length) return;
  // mark first (a failed push mustn't repeat every 5 minutes), then send
  due.forEach(([, u]) => { u.reminded = u.until; });
  await put(FILE, JSON.stringify(all), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  const texts = due.map(([, u]) => `⏰ สมาชิก Gold Signal หมดอายุ ${thDate(u.until)}\nอีก ${Math.max(1, Math.ceil((u.until - now) / DAY))} วัน · ต่ออายุได้ที่แท็บบัญชี → สมาชิก (รายเดือน / รายปี)`);
  await push(texts, { pick: (sub, i) => sub.who === due[i][0] });
})().catch((e) => console.log(`⚠️ pro expiry failed: ${e.message}`));
