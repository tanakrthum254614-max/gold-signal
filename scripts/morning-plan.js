// Builds today's gold trading plan from data.json (see fetch_data.py) and broadcasts it to LINE.
// Usage: node scripts/morning-plan.js data.json
// Env: LINE_CHANNEL_ACCESS_TOKEN, SEND=true to actually send (otherwise prints only), SITE_URL
const fs = require('fs');
const path = require('path');
const TA = require('../indicators.js');
const INV = require('../investing.js');
const EXPLAIN = require('../explain.js');
const PLAN = require('../dailyplan.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const money = PLAN.money;
const signed = (v) => `${v >= 0 ? '+' : '−'}${money(Math.abs(v))}`;
const bars = (rows) => rows.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
// Thai gold bar (96.5%) per baht-weight
const toThb = (usd, thb) => usd * thb * ((15.244 * 0.965) / 31.1035);
const TREND_TH = { strong_buy: 'ขาขึ้นแรง', buy: 'ขาขึ้น', neutral: 'ไซด์เวย์', sell: 'ขาลง', strong_sell: 'ขาลงแรง' };

function analyse(data) {
  const daily = bars(data.daily), hourly = bars(data.hourly);
  const price = hourly[hourly.length - 1].close;
  const out = { price, daily, hourly, source: data.source, stats: [] };

  if (data.tech) {
    const h = EXPLAIN.horizons(data.tech, INV);
    out.bias = { short: h[0].key, mid: h[1].key, long: h[2].key };
    let up = 0, down = 0, flat = 0;
    Object.values(data.tech).forEach((t) => {
      const d = INV.dirOf(INV.norm(t.summary));
      if (d > 0) up++; else if (d < 0) down++; else flat++;
    });
    out.votes = { up, down, flat, total: up + down + flat };
    const di = data.tech['1d'].indicators;
    out.dailyAtr = parseFloat(di.atr.value);
    out.dailyRsi = parseFloat(di.rsi.value);
  } else {
    // Backup data: run our own indicator engine on Binance candles
    const key = (cs) => TA.analyze(cs).label.key.replace('-', '_');
    out.bias = { short: key(hourly), mid: key(bars(data.h4)), long: key(daily) };
    const ind = TA.computeAll(daily);
    out.dailyAtr = ind.atr[ind.atr.length - 1];
    out.dailyRsi = ind.rsi[ind.rsi.length - 1];
  }

  // Pivots from the last full weekday session (investing.com's daily pivots can come from the
  // short Sunday-evening bar, which makes the levels far too tight)
  const lv = PLAN.levelsFromDaily(daily);
  out.levels = lv.levels;
  out.session = lv.from;
  out.plan = PLAN.build({ price, levels: out.levels, bias: out.bias });
  out.chg24 = hourly.length > 24 ? price - hourly[hourly.length - 25].close : null;
  out.chg5d = daily.length > 6 ? price - daily[daily.length - 6].close : null;
  out.thb = data.thb;
  return out;
}

function thaiDate(ms = Date.now()) {
  return new Date(ms).toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
  });
}

function statLines(a) {
  const lines = [];
  if (a.session) lines.push(`คำนวณจากราคาวัน${a.session.dayTh}: สูง ${money(a.session.high)} · ต่ำ ${money(a.session.low)} · ปิด ${money(a.session.close)}`);
  if (a.chg24 != null) lines.push(`24 ชม.ที่ผ่านมา: ${signed(a.chg24)} ดอลลาร์`);
  if (a.chg5d != null) lines.push(`5 วันทำการ: ${signed(a.chg5d)} ดอลลาร์`);
  if (a.votes) lines.push(`investing.com: ลง ${a.votes.down} · ขึ้น ${a.votes.up} · ไม่ชัด ${a.votes.flat} (จาก ${a.votes.total} ช่วงเวลา)`);
  lines.push(`แนวโน้ม สั้น/กลาง/ยาว: ${TREND_TH[a.bias.short]} / ${TREND_TH[a.bias.mid]} / ${TREND_TH[a.bias.long]}`);
  if (a.dailyAtr) lines.push(`ทองแกว่งเฉลี่ยวันละ ~$${money(a.dailyAtr)}`);
  if (a.dailyRsi) lines.push(`RSI รายวัน ${a.dailyRsi.toFixed(0)} (${a.dailyRsi > 70 ? 'ขึ้นแรงเกินไป' : a.dailyRsi < 30 ? 'ลงแรงเกินไป' : a.dailyRsi >= 50 ? 'ฝั่งซื้อแรงกว่า' : 'ฝั่งขายแรงกว่า'})`);
  return lines;
}

function textMessage(a) {
  const p = a.plan;
  const out = [
    `🥇 แผนเทรดทองคำ ${thaiDate()}`,
    `ราคา ${money(a.price)} ดอลลาร์/ออนซ์${a.thb ? ` (≈ ${Math.round(toThb(a.price, a.thb) / 50) * 50} บาท/บาททองคำ)` : ''}`,
    `${p.icon} วันนี้: ${p.headline}`,
    '',
    `แผนหลัก: ${PLAN.describe(p.primary)}`,
  ];
  if (p.secondary) out.push(`แผนสำรอง: ${PLAN.describe(p.secondary)}${p.secondary.note ? ` (${p.secondary.note})` : ''}`);
  out.push(`⚠️ ${p.invalidate}`, '', ...statLines(a), '', `ดูกราฟ: ${SITE_URL}`);
  return out.join('\n');
}

// ---------- LINE Flex message ----------
const C = { gold: '#B8860B', up: '#0E9F6E', down: '#E02D4B', wait: '#D97706', muted: '#8C8C8C', text: '#1F1F1F' };
const txt = (text, extra = {}) => ({ type: 'text', text: String(text), wrap: true, size: 'sm', color: C.text, ...extra });
const row = (label, value, color) => ({
  type: 'box', layout: 'horizontal', spacing: 'sm',
  contents: [txt(label, { color: C.muted, flex: 5 }), txt(value, { weight: 'bold', align: 'end', flex: 6, color: color || C.text })],
});
const sep = () => ({ type: 'separator', margin: 'lg' });
const title = (text, color) => txt(text, { weight: 'bold', size: 'md', margin: 'lg', color: color || C.text });

function planRows(p, heading) {
  if (!p) return [];
  const buy = p.side === 'BUY';
  return [
    title(`${heading}: ${buy ? 'ซื้อ (Buy)' : 'ขาย (Sell)'}`, buy ? C.up : C.down),
    ...(p.note ? [txt(p.note, { size: 'xs', color: C.wait })] : []),
    row(buy ? 'จุดซื้อ' : 'จุดขาย', `${money(p.entry)} ${p.at.name}`),
    row('ตัดขาดทุน (SL)', money(p.sl), C.down),
    row('เป้า 1 (TP1)', money(p.tp1), C.up),
    row('เป้า 2 (TP2)', money(p.tp2), C.up),
    row('กำไร : ความเสี่ยง', `${p.rr.toFixed(1)} : 1`),
  ];
}

function flexMessage(a) {
  const p = a.plan;
  const color = p.trend === 'up' ? C.up : p.trend === 'down' ? C.down : C.wait;
  const lvRows = p.levels.filter((l) => ['R2', 'R1', 'P', 'S1', 'S2'].includes(l.name))
    .map((l) => row(l.name === 'P' ? 'จุดกึ่งกลาง (P)' : `${l.name[0] === 'R' ? 'แนวต้าน' : 'แนวรับ'} ${l.name}`, money(l.price), l.name[0] === 'R' ? C.down : l.name[0] === 'S' ? C.up : C.text));
  const body = [
    txt(`${money(a.price)}`, { size: 'xxl', weight: 'bold' }),
    txt(`ดอลลาร์/ออนซ์${a.thb ? ` · ≈ ${(Math.round(toThb(a.price, a.thb) / 50) * 50).toLocaleString('en-US')} บาท/บาททองคำ` : ''}`, { size: 'xs', color: C.muted }),
    txt(`${p.icon} ${p.headline}`, { weight: 'bold', size: 'md', color, margin: 'md' }),
    sep(),
    ...planRows(p.primary, 'แผนหลัก'),
    ...(p.secondary ? [sep(), ...planRows(p.secondary, 'แผนสำรอง')] : []),
    txt(`⚠️ ${p.invalidate}`, { size: 'xs', color: C.wait, margin: 'lg' }),
    sep(),
    title('แนวรับ–แนวต้านวันนี้'),
    ...lvRows,
    sep(),
    title('สถิติ'),
    ...statLines(a).map((l) => txt(`• ${l}`, { size: 'xs' })),
    txt(`ข้อมูล: ${a.source} · ไม่ใช่คำแนะนำการลงทุน`, { size: 'xxs', color: C.muted, margin: 'lg' }),
  ];
  return {
    type: 'flex',
    altText: `🥇 แผนเทรดทอง: ${p.headline} · ${PLAN.describe(p.primary)}`.slice(0, 390),
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#1A1D24', paddingAll: '16px',
        contents: [
          txt('🥇 แผนเทรดทองคำวันนี้', { color: '#E8B64C', weight: 'bold', size: 'lg' }),
          txt(thaiDate(), { color: '#C9CED8', size: 'xs' }),
        ],
      },
      body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: body },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'button', style: 'primary', color: '#B8860B', action: { type: 'uri', label: 'ดูกราฟและจุดซื้อขาย', uri: SITE_URL } }],
      },
    },
  };
}

async function broadcast(message) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [message] }),
  });
  if (!r.ok) throw new Error(`LINE ${r.status}: ${await r.text()}`);
}

(async function main() {
  const file = process.argv[2] || 'data.json';
  const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const a = analyse(data);
  console.log(textMessage(a));
  const flex = flexMessage(a);
  if (process.env.SEND === 'true') {
    await broadcast(flex);
    console.log('\n✓ sent to LINE');
  } else {
    console.log(`\n(dry run — flex message ${JSON.stringify(flex).length} bytes, not sent)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
