// Reads indlab.json. Walk-forward honesty check: choose using the first 3 periods only, then look at period 4
// (data the choice never saw). node indreport.js
const o = require(require('path').join(process.env.DATA_DIR || __dirname, 'indlab.json'));
const sum3 = (q) => q[0] + q[1] + q[2];
const res = { alone: [], filter: [] };
for (const [tf, rows] of Object.entries(o)) {
  for (const side of ['BUY', 'SELL']) {
    const base = rows.find((r) => r.mode === 'base' && r.side === side);
    if (!base) continue;
    const tested = base.tested;
    const line = (r) => `${r.ind} · ${r.n} ไม้ ชนะ ${r.win}% · รวม ${r.pnl} (${r.q.join('/')})`;
    console.log(`\n== ${tf} ${side}${tested ? '' : ' (ระบบปัจจุบันไม่ใช้ฝั่งนี้)'} — ระบบปัจจุบัน: ${base.n} ไม้ ชนะ ${base.win}% รวม ${base.pnl} (${base.q.join('/')})`);
    for (const mode of ['filter', 'alone']) {
      const cand = rows.filter((r) => r.mode === mode && r.side === side && r.n >= (mode === 'filter' ? Math.max(6, base.n * 0.4) : 12));
      // in-sample: periods 1–3 all positive and (filter) better than the current system over 1–3
      const pick = cand.filter((r) => r.q[0] > 0 && r.q[1] > 0 && r.q[2] > 0 && (mode === 'alone' || sum3(r.q) > sum3(base.q)))
        .sort((a, b) => sum3(b.q) - sum3(a.q));
      const ok = pick.filter((r) => r.q[3] > 0 && (mode === 'alone' || r.q[3] >= base.q[3]));
      res[mode].push({ tf, side, picked: pick.length, held: ok.length });
      console.log(`  [${mode === 'filter' ? 'กรองระบบปัจจุบัน' : 'ใช้เดี่ยว ๆ'}] ผ่านช่วง 1–3: ${pick.length}/${cand.length} · ช่วง 4 ยังดี: ${ok.length}`);
      pick.slice(0, 5).forEach((r) => console.log(`     ${r.q[3] > 0 && (mode === 'alone' || r.q[3] >= base.q[3]) ? '✓' : '✗'} ${line(r)}`));
    }
  }
}
for (const m of ['filter', 'alone']) {
  const p = res[m].reduce((a, r) => a + r.picked, 0), h = res[m].reduce((a, r) => a + r.held, 0);
  console.log(`\n${m}: ดีในช่วง 1–3 ทั้งหมด ${p} แบบ → ยังดีในช่วง 4 ${h} (${p ? Math.round((h / p) * 100) : 0}%)`);
}
