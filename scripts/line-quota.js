// Checks how much of this month's LINE message quota is used, saves it to quota.json (shown on the
// account tab) and warns once a month when usage passes 80%.
// Usage: node scripts/line-quota.js      Env: LINE_CHANNEL_ACCESS_TOKEN, SEND, RECORD
const fs = require('fs');
const path = require('path');
const { send } = require('./notify.js');

const FILE = path.join(__dirname, '..', 'quota.json');
const WARN_AT = 0.8;

async function get(url) {
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`LINE ${r.status}: ${await r.text()}`);
  return r.json();
}

(async function main() {
  const [quota, used] = await Promise.all([
    get('https://api.line.me/v2/bot/message/quota'),
    get('https://api.line.me/v2/bot/message/quota/consumption'),
  ]);
  const now = Date.now();
  const month = new Date(now + 7 * 3600e3).toISOString().slice(0, 7);
  const limit = quota.type === 'limited' ? quota.value : null; // null = no monthly limit (paid plan)
  const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const out = { used: used.totalUsage, limit, month, at: now, warned: old.month === month ? old.warned || null : null };
  console.log(`LINE quota ${month}: ${out.used} / ${limit == null ? 'unlimited' : limit}`);

  if (limit && out.used >= limit * WARN_AT && !out.warned) {
    const left = Math.max(0, limit - out.used);
    await send([[
      `⚠️ โควตา LINE เดือนนี้ใช้ไปแล้ว ${out.used} / ${limit} ข้อความ (${Math.round((out.used / limit) * 100)}%)`,
      `เหลือ ${left} ข้อความ — ถ้าหมด จะไม่ได้รับแจ้งเตือนจนถึงต้นเดือนหน้า`,
      'ดูสัญญาณสดได้ที่เว็บเสมอ · ถ้าต้องการรับครบทุกข้อความ อัปเกรดแพ็กเกจ LINE OA ได้ที่ manager.line.biz',
    ].join('\n')]);
    out.warned = now;
  }
  if (process.env.RECORD === 'true') fs.writeFileSync(FILE, `${JSON.stringify(out, null, 1)}\n`);
})().catch((e) => { console.log(`⚠️ quota check failed: ${e.message}`); }); // never fail the morning job
