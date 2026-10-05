// LINE wording for trade events, shared by the daily-signal alerts and the 30-minute signals
const { money } = require('../dailyplan.js');

const signed = (v) => `${v >= 0 ? '+' : '−'}$${money(Math.abs(v))}`;
const at = (ms) => new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const sumLine = (sum) => `ผลงานสะสม: ชนะ ${sum.wins} · แพ้ ${sum.losses}${sum.winRate != null ? ` (ชนะ ${sum.winRate}%)` : ''} · ${signed(sum.pnl)}/ออนซ์${sum.spread ? ` (หักสเปรด $${sum.spread}/ไม้แล้ว)` : ''}`;

// New events on a three-target trade (TP1/TP2/TP3, breakeven exit, stop-loss, time-out close).
// `sent` remembers what was already announced and is updated in place.
function targetEvents(s, sent, now) {
  const lines = [];
  const side = s.side === 'BUY' ? 'ซื้อ' : 'ขาย';
  for (let k = 1; k <= (s.hit || 0); k++) {
    if (sent[`tp${k}`]) continue;
    sent[`tp${k}`] = now;
    const usd = Math.abs(s.tps[k - 1] - s.entry);
    lines.push(`✅ TP${k} ถึงแล้ว! ${money(s.tps[k - 1])} (+$${money(usd)}) — ปิด ⅓ ของออเดอร์`);
    if (k === 1) lines.push(`🛡️ เลื่อน SL ไปที่ทุน ${money(s.entry)} → ไม้นี้ไม่ขาดทุนแล้ว`);
  }
  if (!sent.exit) {
    if (s.closedBy === 'tp') lines.push(`🏆 ครบทั้ง 3 เป้า! ${side}ที่ ${money(s.entry)} · กำไรรวม ${signed(s.pnl)}/ออนซ์`);
    if (s.closedBy === 'be') lines.push(`⏹ ราคากลับมาที่ทุน ปิดส่วนที่เหลือ (${at(s.exitAt)} น.) · กำไรรวม ${signed(s.pnl)}/ออนซ์`);
    if (s.closedBy === 'sl') lines.push(`❌ โดน SL ที่ ${money(s.sl)} (${at(s.exitAt)} น.) · ${side}ที่ ${money(s.entry)} = ${signed(s.pnl)}/ออนซ์`);
    if (s.closedBy === 'eod') lines.push(`⏰ หมดเวลาถือ ปิดไม้ที่ ${money(s.exitPrice)} (${at(s.exitAt)} น.) · ${signed(s.pnl)}/ออนซ์`);
  }
  if (s.closedBy) sent.exit = sent.exit || now;
  return lines;
}

// Position size: 0.01 lot = 1 oz, so a $sl stop risks $sl per 0.01 lot
const lotLine = (sl) => `📏 ขนาดไม้: 0.01 lot เสี่ยง ~$${sl} — ทุกทุน $${(sl * 100).toLocaleString('en-US')} ที่ยอมเสีย 1% = 0.01 lot (ตั้งทุนในเว็บให้คำนวณให้)`;

module.exports = { signed, at, sumLine, targetEvents, lotLine };
