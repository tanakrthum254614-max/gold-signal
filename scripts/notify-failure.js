// Tells the owner (LINE) that an automated job failed, at most once every 3 hours per job.
// Usage: node scripts/notify-failure.js "<job name>"     Env: RUN_URL, STATE_DIR, SEND (+ tokens)
const fs = require('fs');
const path = require('path');
const { send } = require('./notify.js');

const job = process.argv[2] || 'งานอัตโนมัติ';
const STATE_DIR = process.env.STATE_DIR || path.join(__dirname, '..', 'state');
const FILE = path.join(STATE_DIR, 'failures.json');
const now = Date.now();

(async function main() {
  const state = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  if (state[job] && now - state[job] < 3 * 3600e3) return console.log('already notified recently');
  const at = new Date(now).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
  await send([`⚠️ ระบบ Gold Signal มีปัญหา\nงาน: ${job}\nเวลา: ${at}\nระบบจะลองใหม่รอบถัดไปอัตโนมัติ — ถ้าเงียบนานผิดปกติ แปลว่ายังแก้ไม่ได้${process.env.RUN_URL ? `\nรายละเอียด: ${process.env.RUN_URL}` : ''}`]);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ ...state, [job]: now }));
})().catch((e) => { console.error(e); process.exit(0); });
