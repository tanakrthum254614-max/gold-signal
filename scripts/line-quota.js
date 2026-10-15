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
  // end-of-month forecast at this month's pace (Thai time; from day 3 so one busy morning doesn't skew it)
  const th = new Date(now + 7 * 3600e3);
  const days = new Date(Date.UTC(th.getUTCFullYear(), th.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsed = th.getUTCDate() - 1 + (th.getUTCHours() * 60 + th.getUTCMinutes()) / 1440;
  const projected = elapsed >= 2 ? Math.round((used.totalUsage / elapsed) * days) : null;
  const out = { used: used.totalUsage, limit, projected, month, at: now, warned: old.month === month ? old.warned || null : null };
  console.log(`LINE quota ${month}: ${out.used} / ${limit == null ? 'unlimited' : limit} · forecast ${projected ?? '-'}`);

  if (limit && out.used >= limit * WARN_AT && !out.warned) {
    const left = Math.max(0, limit - out.used);
    await send([[
      `⚠️ โควตา LINE เดือนนี้ใช้ไปแล้ว ${out.used} / ${limit} ข้อความ (${Math.round((out.used / limit) * 100)}%)`,
      `เหลือ ${left} ข้อความ — ถ้าหมด จะไม่ได้รับแจ้งเตือนจนถึงต้นเดือนหน้า`,
      'ภาพรวมเช้า / เตือนข่าว ย้ายไปแจ้งเตือนเว็บเองเมื่อโควตาเหลือน้อย (LINE เก็บไว้ส่งสัญญาณเข้าไม้) · ดูสัญญาณสดได้ที่เว็บเสมอ',
    ].join('\n')], { kind: 'admin' }); // admins only (notify.js) — not broadcast to members, no quota spent
    out.warned = now;
  }
  if (process.env.RECORD === 'true') fs.writeFileSync(FILE, `${JSON.stringify(out, null, 1)}\n`);
})().catch((e) => { console.log(`⚠️ quota check failed: ${e.message}`); }); // never fail the morning job
