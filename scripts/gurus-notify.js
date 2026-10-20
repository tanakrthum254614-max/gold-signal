// 🔔 Guru trade alerts (user, 16 Oct 2026: "ทำมา" — alert when a guru buys / sells): the new Form 4 trades and ARK daily
// trades found by scripts/gurus-live.js → web push (free, no LINE quota) to members who switched notifications on.
// Members following gurus (⭐, access/guru-follows.json via /api/gurus/follow) get only those; following nobody = all.
// Usage: node scripts/gurus-notify.js <new.json>      Env: BLOB_READ_WRITE_TOKEN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
const fs = require('fs');
const { push } = require('./push.js');

const TH = [[1e9, 'พันล้าน'], [1e6, 'ล้าน']];
const money = (v) => { const u = TH.find(([n]) => v >= n); return u ? `$${(v / u[0]).toFixed(1)} ${u[1]}` : `$${Math.round(v).toLocaleString('en-US')}`; };
const num = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)} ล้าน` : Math.round(v).toLocaleString('en-US'));

function text(x) {
  if (x.kind === 'f4') {
    const side = x.buy ? ['ซื้อ', x.buy, x.buyUsd] : ['ขาย', x.sell, x.sellUsd];
    return `🔔 ${x.th} ${side[0]} ${x.symbol || x.issuer}\n${num(side[1])} หุ้น ≈ ${money(side[2])}${side[1] ? ` @ $${(side[2] / side[1]).toFixed(2)}` : ''}${x.after ? ` · ถือรวม ${num(x.after)} หุ้น` : ''} · ฟอร์ม 4 ต่อ SEC`;
  }
  const b = (x.buys || []).slice(0, 3).map((m) => `${m.s} +${num(m.d)}`).join(', '), s = (x.sells || []).slice(0, 3).map((m) => `${m.s} −${num(-m.d)}`).join(', ');
  return `🔔 แคธี่ วูด (${x.fund}) ซื้อขายวันนี้\n${b ? `ซื้อ ${b}` : ''}${b && s ? ' · ' : ''}${s ? `ขาย ${s}` : ''}`;
}

(async () => {
  const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8') || '[]');
  if (!items.length) return console.log('guru alerts: nothing new');
  let follows = {};
  try {
    const { get } = require('./blob');
    const r = await get('access/guru-follows.json', { access: 'private', useCache: false });
    if (r && r.statusCode === 200) follows = JSON.parse(await new Response(r.stream).text()).follows || {};
  } catch (e) { console.log(`guru alerts: no follow list (${e.message}) — everyone gets all`); }
  const texts = items.slice(0, 6).map(text);
  console.log(texts.join('\n---\n'));
  await push(texts, { pick: (sub, i) => { const f = follows[sub.who]; return !f || !f.length || f.includes(items[i].cik); } });
})().catch((e) => { console.log(`⚠️ guru alerts failed: ${e.message}`); }); // never fail the job
