// Sends a text file to the admins only: web push to devices marked admin: true, and LINE to the owner when
// LINE_OWNER_ID is set (push API — never a broadcast). node scripts/admin-notify.js <file>
// Env: BLOB_READ_WRITE_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, LINE_CHANNEL_ACCESS_TOKEN, LINE_OWNER_ID, SEND=true
const fs = require('fs');
const { push } = require('./push.js');
(async () => {
  const text = fs.readFileSync(process.argv[2], 'utf8').trim();
  console.log(text);
  if (process.env.SEND !== 'true') return console.log('admin-notify: SEND is not true — nothing sent');
  await push([text], { adminsOnly: true });
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim(), to = (process.env.LINE_OWNER_ID || '').trim();
  if (!token || !to) return console.log('LINE: LINE_OWNER_ID not set — push notification only');
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  console.log(r.ok ? '✓ LINE sent to the owner' : `⚠️ LINE ${r.status}: ${await r.text()}`);
})().catch((e) => console.log(`⚠️ admin-notify failed: ${e.message}`));
