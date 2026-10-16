// 🔔 Gold price alerts members set themselves (account tab; middleware.js /api/alerts → Blob access/price-alerts.json).
// Each 5-minute check (scripts/check-loop.sh): an alert fires when gold has reached its price since it was set — the high /
// low of the 15-minute candles since then, so a quick touch between checks still counts. Fired → web push to that member's
// devices (no LINE quota), then removed. Usage: node scripts/price-alerts-user.js data.json   Env: BLOB_READ_WRITE_TOKEN, VAPID_*
const fs = require('fs');
const { push } = require('./push.js');

const FILE = 'access/price-alerts.json';
const f2 = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return console.log('price alerts: no Blob token — skipped');
  const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const bars = (data.m15 || []).map((b) => ({ t: b[0], h: b[2], l: b[3], c: b[4] }));
  if (!bars.length) return console.log('price alerts: no candles');
  const { get, put } = require('@vercel/blob');
  const r = await get(FILE, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return console.log('price alerts: none set');
  const all = JSON.parse(await new Response(r.stream).text());
  const last = bars[bars.length - 1].c;
  const fired = [];
  for (const a of all.alerts || []) {
    const since = bars.filter((b) => b.t + 15 * 60e3 > a.at); // candles that were still open when the alert was set, and later
    if (!since.length) continue;
    const hit = a.dir === 'up' ? Math.max(...since.map((b) => b.h)) >= a.price : Math.min(...since.map((b) => b.l)) <= a.price;
    if (hit) fired.push(a);
  }
  console.log(`price alerts: ${(all.alerts || []).length} set · ${fired.length} reached · gold ${f2(last)}`);
  if (!fired.length) return;
  const texts = fired.map((a) => `🔔 ทองถึง ${f2(a.price)} แล้ว (${a.dir === 'up' ? 'ขึ้นถึง' : 'ลงถึง'})\nราคาตอนนี้ ${f2(last)} · แจ้งเตือนราคาที่ตั้งไว้ในแท็บบัญชี`);
  // remove first (so a slow / failed push can't send the same alert again on the next check), then notify
  const left = all.alerts.filter((a) => !fired.includes(a));
  await put(FILE, JSON.stringify({ ...all, alerts: left }), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  await push(texts, { pick: (sub, i) => sub.who === fired[i].who });
})().catch((e) => console.log(`⚠️ price alerts failed: ${e.message}`)); // never fail the 5-minute check
