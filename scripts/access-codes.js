// Manage the site's access codes (checked by middleware.js). Only sha-256 hashes are stored, in the private Blob
// store (access/codes.json); a new code is printed once — send it to the person who asked by email.
// Changes take effect within ~30 s, no deploy needed. Removing a holder signs them out everywhere.
//   node scripts/access-codes.js list
//   node scripts/access-codes.js add <name> [note]      → prints the new code
//   node scripts/access-codes.js remove <name>
// Needs BLOB_READ_WRITE_TOKEN (env, or .env.local from `vercel env pull` / `vercel blob create-store`).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { get, put } = require('@vercel/blob');

const FILE = 'access/codes.json';
const envFile = path.join(__dirname, '..', '.env.local');
if (!process.env.BLOB_READ_WRITE_TOKEN && fs.existsSync(envFile)) {
  const m = fs.readFileSync(envFile, 'utf8').match(/^BLOB_READ_WRITE_TOKEN="?([^"\r\n]+)"?/m);
  if (m) process.env.BLOB_READ_WRITE_TOKEN = m[1];
}
const normalize = (code) => String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
// 10 characters without look-alikes (no 0/O, 1/I/L) ≈ 49 bits, shown as GOLD-XXXXX-XXXXX
function newCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const s = Array.from(crypto.randomBytes(10), (b) => abc[b % abc.length]).join('');
  return `GOLD-${s.slice(0, 5)}-${s.slice(5)}`;
}

async function load() {
  const r = await get(FILE, { access: 'private' }).catch(() => null);
  if (!r || r.statusCode !== 200) return { codes: [] };
  return JSON.parse(await new Response(r.stream).text());
}
const save = (data) => put(FILE, JSON.stringify(data, null, 1), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
const day = (ms) => new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });

(async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN not found (run `npx vercel env pull .env.local`)');
  const [cmd, name, ...note] = process.argv.slice(2);
  const data = await load();
  if (cmd === 'list' || !cmd) {
    if (!data.codes.length) return console.log('ยังไม่มีรหัส — เพิ่มด้วย: node scripts/access-codes.js add <ชื่อ>');
    data.codes.forEach((c) => console.log(`• ${c.name}  (สร้าง ${day(c.created)})${c.note ? `  — ${c.note}` : ''}`));
    return;
  }
  if (!name) throw new Error('ใส่ชื่อด้วย เช่น: add somchai');
  if (cmd === 'add') {
    if (data.codes.some((c) => c.name === name)) throw new Error(`มีชื่อ "${name}" แล้ว — ใช้ชื่ออื่น หรือ remove ก่อน`);
    const code = newCode();
    data.codes.push({ name, hash: sha256(normalize(code)), created: Date.now(), note: note.join(' ') || undefined });
    await save(data);
    console.log(`✓ เพิ่มรหัสให้ "${name}" แล้ว\n  รหัส: ${code}\n  (ส่งรหัสนี้ให้เจ้าของทางอีเมล — ระบบเก็บไว้แค่ค่าแฮช ดูซ้ำไม่ได้)`);
    return;
  }
  if (cmd === 'remove') {
    const left = data.codes.filter((c) => c.name !== name);
    if (left.length === data.codes.length) throw new Error(`ไม่พบชื่อ "${name}"`);
    await save({ ...data, codes: left });
    console.log(`✓ ยกเลิกรหัสของ "${name}" แล้ว — จะเข้าไม่ได้ภายใน ~30 วินาที`);
    return;
  }
  throw new Error(`ไม่รู้จักคำสั่ง "${cmd}" (list / add / remove)`);
})().catch((e) => { console.error(`⚠️ ${e.message}`); process.exit(1); });
