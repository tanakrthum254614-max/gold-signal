// Morning job: scores earlier signals, records today's signal in signals.json and sends it to LINE.
// Usage: node scripts/morning-plan.js data.json
// Env: LINE_CHANNEL_ACCESS_TOKEN; SEND=true to broadcast; RECORD=true to write signals.json; SITE_URL
const fs = require('fs');
const path = require('path');
const TA = require('../indicators.js');
const INV = require('../investing.js');
const EXPLAIN = require('../explain.js');
const PLAN = require('../dailyplan.js');
const SIG = require('../signals.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const SIGNALS_FILE = path.join(__dirname, '..', 'signals.json');
const BACKTEST_FILE = path.join(__dirname, '..', 'backtest.json');
const money = PLAN.money;
const signed = (v) => `${v >= 0 ? '+' : '−'}$${money(Math.abs(v))}`;
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const TREND_TH = { strong_buy: 'ขาขึ้นแรง', buy: 'ขาขึ้น', neutral: 'ไซด์เวย์', sell: 'ขาลง', strong_sell: 'ขาลงแรง' };
const SIDE_TH = { BUY: 'ซื้อ (BUY)', SELL: 'ขาย (SELL)' };

function analyse(data) {
  const daily = bars(data.daily), hourly = bars(data.hourly);
  const price = hourly[hourly.length - 1].close;
  const out = { price, daily, source: data.source };

  if (data.tech) {
    const h = EXPLAIN.horizons(data.tech, INV);
    out.bias = { short: h[0].key, mid: h[1].key, long: h[2].key };
    let up = 0, down = 0;
    Object.values(data.tech).forEach((t) => {
      const d = INV.dirOf(INV.norm(t.summary));
      if (d > 0) up++; else if (d < 0) down++;
    });
    out.votes = { up, down, total: Object.keys(data.tech).length };
  } else {
    // Backup data: run our own indicator engine on Binance candles
    const key = (cs) => TA.analyze(cs).label.key.replace('-', '_');
    out.bias = { short: key(hourly), mid: key(bars(data.h4)), long: key(daily) };
  }
  // Pivots from the last full weekday session (investing.com's daily pivots can come from the
  // short Sunday-evening bar, which makes the levels far too tight)
  const lv = PLAN.levelsFromDaily(daily);
  out.session = lv.from;
  out.plan = PLAN.build({ price, levels: lv.levels, bias: out.bias });
  return out;
}

// Plain reasons stored with the signal and shown on the site / in LINE
function whyLines(a) {
  const lines = [];
  if (a.votes) lines.push(`investing.com วิเคราะห์ ${a.votes.total} ช่วงเวลา: บอก “ลง” ${a.votes.down} · “ขึ้น” ${a.votes.up}`);
  lines.push(`แนวโน้ม ระยะสั้น ${TREND_TH[a.bias.short]} · ระยะกลาง ${TREND_TH[a.bias.mid]} · ระยะยาว ${TREND_TH[a.bias.long]}`);
  const p = a.plan.primary;
  lines.push(`จุดเข้าคือ${p.label} คำนวณจากราคาวัน${a.session.dayTh} (สูง ${money(a.session.high)} · ต่ำ ${money(a.session.low)} · ปิด ${money(a.session.close)})`);
  return lines;
}

// 15-minute candles where available, older history filled with 30-minute candles (covers the weekend gap)
function scoringBars(data) {
  const m15 = bars(data.m15), m30 = bars(data.m30);
  const first = m15.length ? m15[0].time : Infinity;
  return [...m30.filter((b) => b.time + 30 * 60e3 <= first), ...m15];
}

function thaiDay(ms = Date.now()) {
  return new Date(ms).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
}
const thaiTime = (ms) => new Date(ms).toLocaleString('th-TH', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

function resultText(s) {
  if (s.status === 'expired') return '⏹ ราคาไม่ถึงจุดเข้า (ไม่ได้เทรด)';
  const how = s.closedBy === 'tp' ? 'ถึงเป้า' : s.closedBy === 'sl' ? 'โดนตัดขาดทุน' : 'ปิดสิ้นวัน';
  return `${s.status === 'win' ? '✅ ชนะ' : '❌ แพ้'} ${signed(s.pnl)}/ออนซ์ (${how})`;
}

// ---------- LINE Flex message ----------
const C = { gold: '#B8860B', up: '#0E9F6E', down: '#E02D4B', wait: '#D97706', muted: '#8C8C8C', text: '#1F1F1F', blue: '#2563EB' };
const txt = (text, extra = {}) => ({ type: 'text', text: String(text), wrap: true, size: 'sm', color: C.text, ...extra });
const row = (label, value, color) => ({
  type: 'box', layout: 'horizontal', spacing: 'sm',
  contents: [txt(label, { color: C.muted, flex: 5 }), txt(value, { weight: 'bold', align: 'end', flex: 6, color: color || C.text, size: 'md' })],
});
const sep = () => ({ type: 'separator', margin: 'lg' });
const title = (text) => txt(text, { weight: 'bold', size: 'sm', margin: 'lg' });

function flexMessage(a, sig, prev, sum, bt) {
  const buy = sig.side === 'BUY';
  const color = buy ? C.up : C.down;
  const body = [
    txt('🧪 โหมดทดลอง — ดูผลสะสมก่อนใช้เงินจริง', { size: 'xxs', color: C.wait }),
    ...(prev ? [txt(`ผลสัญญาณครั้งก่อน (${prev.id}): ${resultText(prev)}`, { size: 'xs', margin: 'md' })] : []),
    sep(),
    txt(`${buy ? '🟢' : '🔴'} ${SIDE_TH[sig.side]}`, { size: 'xxl', weight: 'bold', color, margin: 'lg' }),
    txt(`ความมั่นใจ ${'★'.repeat(sig.stars)}${'☆'.repeat(5 - sig.stars)} · ราคาตอนนี้ ${money(a.price)}`, { size: 'xs', color: C.muted }),
    row('🎯 จุดเข้า', money(sig.entry), C.text),
    row('🛑 ตัดขาดทุน', money(sig.sl), C.down),
    row('💰 เป้าหมาย', money(sig.tp), C.up),
    txt(`ตั้งคำสั่ง ${buy ? 'Buy' : 'Sell'} Limit ที่ ${money(sig.entry)} · SL ${money(sig.sl)} · TP ${money(sig.tp)} — ถ้าราคาไม่ถึงจุดเข้าภายใน ${thaiTime(sig.expiresAt)} ให้ยกเลิกคำสั่ง`, { size: 'xs', color: C.blue, margin: 'md' }),
    sep(),
    title('ทำไม'),
    ...sig.why.map((l) => txt(`• ${l}`, { size: 'xs' })),
    sep(),
    title('📊 ผลงานสัญญาณจริง'),
    txt(sum.traded
      ? `ชนะ ${sum.wins} · แพ้ ${sum.losses} (ชนะ ${sum.winRate}%) · กำไรสะสม ${signed(sum.pnl)}/ออนซ์ · ไม่เข้า ${sum.expired}`
      : 'เพิ่งเริ่มบันทึก — ยังไม่มีผลที่ปิดแล้ว', { size: 'xs' }),
    ...(bt ? [txt(`ทดสอบย้อนหลัง ${bt.days} วัน (จำลอง): ชนะ ${bt.summary.winRate}% · ${signed(bt.summary.pnl)}/ออนซ์`, { size: 'xxs', color: C.muted })] : []),
    txt(`ข้อมูล: ${a.source} · ไม่ใช่คำแนะนำการลงทุน`, { size: 'xxs', color: C.muted, margin: 'lg' }),
  ];
  return {
    type: 'flex',
    altText: `🎯 สัญญาณทอง: ${SIDE_TH[sig.side]} ที่ ${money(sig.entry)} · SL ${money(sig.sl)} · TP ${money(sig.tp)}`,
    contents: {
      type: 'bubble', size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#1A1D24', paddingAll: '16px',
        contents: [
          txt('🎯 สัญญาณทองคำวันนี้ (XAU/USD)', { color: '#E8B64C', weight: 'bold', size: 'lg' }),
          txt(thaiDay(), { color: '#C9CED8', size: 'xs' }),
        ],
      },
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: body },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{ type: 'button', style: 'primary', color: '#B8860B', action: { type: 'uri', label: 'ดูสัญญาณและสถิติ', uri: SITE_URL } }],
      },
    },
  };
}

async function broadcast(message) {
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim(); // copy-paste often adds spaces/newlines
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages: [message] }),
  });
  if (!r.ok) throw new Error(`LINE ${r.status}: ${await r.text()}`);
}

(async function main() {
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const now = Date.now();
  const a = analyse(data);
  const store = fs.existsSync(SIGNALS_FILE) ? JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8')) : { signals: [] };
  const bt = fs.existsSync(BACKTEST_FILE) ? JSON.parse(fs.readFileSync(BACKTEST_FILE, 'utf8')) : null;

  // Score earlier signals that have finished, if our candles cover their whole window
  const sb = scoringBars(data);
  store.signals = store.signals.map((s) => {
    if (SIG.isFinal(s) || s.expiresAt > now || !sb.length || sb[0].time > s.createdAt) return s;
    return SIG.evaluate(s, sb, now);
  });

  const todayId = SIG.thaiDate(now);
  let sig = store.signals.find((s) => s.id === todayId);
  if (!sig) {
    sig = SIG.make(a.plan, now, a.price, { why: whyLines(a), source: a.source });
    store.signals.push(sig);
  }
  const prev = store.signals.filter((s) => s.id !== todayId && SIG.isFinal(s)).slice(-1)[0];
  const sum = SIG.summary(store.signals);
  store.updatedAt = now;
  store.summary = sum;

  console.log(`signal ${sig.id}: ${sig.side} entry ${sig.entry} sl ${sig.sl} tp ${sig.tp} stars ${sig.stars}`);
  if (prev) console.log(`previous ${prev.id}: ${resultText(prev)}`);
  console.log(`record: win ${sum.wins} loss ${sum.losses} noentry ${sum.expired} pnl ${sum.pnl}`);

  if (process.env.RECORD === 'true') {
    fs.writeFileSync(SIGNALS_FILE, `${JSON.stringify(store, null, 1)}\n`);
    console.log('✓ signals.json updated');
  }
  const flex = flexMessage(a, sig, prev, sum, bt);
  if (process.env.SEND === 'true') {
    await broadcast(flex);
    console.log('✓ sent to LINE');
  } else {
    console.log(`(dry run — flex message ${JSON.stringify(flex).length} bytes, not sent)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
