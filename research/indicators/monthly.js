// Monthly check of the indicator study (workflow monthly-research.yml): after fetch.js + indlab.js, writes
// monthly/<YYYY-MM>.txt — are the confirmation indicators the site uses still better than without them, and is there a
// new candidate? Only a report: rules change only when the owner approves. Sends a short version to the admins
// (web push; LINE to the owner when LINE_OWNER_ID is set). node monthly.js <projectDir>
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
global.INTRA = require(path.join(ROOT, 'intraday.js'));
const CS = require(path.join(ROOT, 'chartsys.js'));
const o = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR || __dirname, 'indlab.json'), 'utf8'));
const NAME = { ema921: 'EMA 9/21', roc12: 'ROC 12 (โมเมนตัม)', sma2050: 'SMA 20/50' };
const TF = { '5m': '5 นาที', '15m': '15 นาที', '30m': '30 นาที', '1h': '1 ชม.', '5h': '5 ชม.', '1d': '1 วัน', '1w': '1 สัปดาห์' };
const month = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
const lines = [`รายงานทดสอบตัวชี้วัดประจำเดือน ${month} (2 ปีล่าสุด, 1 วัน 5 ปี, หลังสเปรด $0.4, $/ออนซ์, 4 ช่วง เก่า→ใหม่)`, ''];
const short = [];
const q = (r) => `${r.n} ไม้ ชนะ ${r.win}% รวม ${r.pnl} (${r.q.join('/')})`;
lines.push('1) ตัวยืนยันที่เว็บใช้อยู่');
for (const [tf, sys] of Object.entries(CS.SYS)) {
  for (const [side, c] of [['BUY', sys.buy], ['SELL', sys.sell]]) {
    if (!c || !c.confirm || !o[tf]) continue;
    const base = o[tf].find((r) => r.mode === 'base' && r.side === side), f = o[tf].find((r) => r.mode === 'filter' && r.side === side && r.ind === NAME[c.confirm]);
    if (!base || !f) continue;
    const ok = f.pnl >= base.pnl && f.q[3] >= base.q[3];
    lines.push(`   ${ok ? '✅' : '⚠️'} ${TF[tf]} ${side} + ${CS.CONFIRM[c.confirm].name}: ${q(f)} · ไม่มีตัวยืนยัน: ${q(base)}`);
    short.push(`${ok ? '✅' : '⚠️'} ${TF[tf]} ${side} + ${CS.CONFIRM[c.confirm].name}${ok ? ' ยังดีกว่า' : ' ไม่ได้ช่วยแล้ว — ควรทบทวน'}`);
  }
}
lines.push('', '2) ตัวกรองใหม่ที่น่าสนใจ (ดีกว่าระบบเดิมอย่างน้อย 3 ใน 4 ช่วง และไม่แย่ลงเลย, ไม้ ≥ 40% ของเดิม, เฉพาะฝั่งที่เว็บใช้)');
let found = 0;
for (const [tf, rows] of Object.entries(o)) {
  const sys = CS.SYS[tf];
  for (const side of ['BUY', 'SELL']) {
    const c = side === 'BUY' ? sys.buy : sys.sell, base = rows.find((r) => r.mode === 'base' && r.side === side);
    if (!c || !base) continue;
    rows.filter((r) => r.mode === 'filter' && r.side === side && r.ind !== NAME[c.confirm] && r.n >= base.n * 0.4
      && r.q.filter((v, i) => v > base.q[i]).length >= 3 && r.q.every((v, i) => v >= base.q[i]))
      .sort((a, b) => b.pnl - a.pnl).slice(0, 3)
      .forEach((r) => { found++; lines.push(`   • ${TF[tf]} ${side} + ${r.ind}: ${q(r)} · เดิม ${q(base)}`); });
  }
}
if (!found) lines.push('   — ไม่มี');
short.push(found ? `🔎 มีตัวกรองใหม่น่าสนใจ ${found} แบบ — ดูรายงาน` : '🔎 ไม่มีตัวกรองใหม่ที่ผ่านเกณฑ์');
lines.push('', 'หมายเหตุ: เป็นผลจากอดีต ทดสอบหลายตัวพร้อมกันย่อมมีบางตัวดูดีโดยบังเอิญ · รายงานเท่านั้น ไม่เปลี่ยนกติกาเอง');
const dir = path.join(__dirname, 'monthly');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, `${month}.txt`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
fs.writeFileSync(path.join(process.env.DATA_DIR || __dirname, 'short.txt'), `🔬 ทดสอบตัวชี้วัดประจำเดือน ${month}\n${short.join('\n')}\nรายงาน: github.com/tanakrthum254614-max/gold-signal/blob/main/research/indicators/monthly/${month}.txt`);
