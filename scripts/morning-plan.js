// Morning job: scores earlier signals, records today's signal in signals.json and sends it to LINE.
// Usage: node scripts/morning-plan.js data.json
// Env: LINE_CHANNEL_ACCESS_TOKEN; SEND=true to broadcast; RECORD=true to write signals.json; SITE_URL
const fs = require('fs');
const path = require('path');
const TA = require('../indicators.js');
const INV = require('../investing.js');
const EXPLAIN = require('../explain.js');
const { money } = require('../dailyplan.js');
const SIG = require('../signals.js');
const { broadcast } = require('./line.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const SIGNALS_FILE = process.env.SIGNALS_FILE || path.join(__dirname, '..', 'signals.json');
const BACKTEST_FILE = path.join(__dirname, '..', 'backtest.json');
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
  // Daily ATR from weekday sessions only (investing.com adds a short Sunday-evening bar)
  const weekdays = daily.filter((b) => ![0, 6].includes(new Date(b.time).getUTCDay()));
  out.atr = TA.computeAll(weekdays).atr[weekdays.length - 1];
  return out;
}

// Plain reasons stored with the signal and shown on the site / in LINE
function whyLines(a) {
  const lines = [];
  if (a.votes) lines.push(`investing.com วิเคราะห์ ${a.votes.total} ช่วงเวลา: บอก “ลง” ${a.votes.down} · “ขึ้น” ${a.votes.up}`);
  lines.push(`แนวโน้ม ระยะสั้น ${TREND_TH[a.bias.short]} · ระยะกลาง ${TREND_TH[a.bias.mid]} · ระยะยาว ${TREND_TH[a.bias.long]}`);
  lines.push(`เทรดสั้น: TP ${SIG.RULE.tpUsd.map((u) => `$${u}`).join(' / ')} · SL $${SIG.RULE.slUsd} · ให้สัญญาณทุกวันทำการ`);
  if (a.atr) lines.push(`ทองแกว่งเฉลี่ยวันละ ~$${money(a.atr)}`);
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
  if (s.status === 'skip') return '⏸ ไม่มีสัญญาณ (ตลาดไม่ชัด)';
  if (s.status === 'expired') return '⏹ ราคาไม่ถึงจุดเข้า (ไม่ได้เทรด)';
  const how = s.tps
    ? (s.hit ? `ถึง TP${s.hit}` : s.closedBy === 'sl' ? 'โดนตัดขาดทุน' : 'ปิดสิ้นวัน')
    : s.closedBy === 'tp' ? 'ถึงเป้า' : s.closedBy === 'sl' ? 'โดนตัดขาดทุน' : 'ปิดสิ้นวัน';
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
  const signalRows = sig.status === 'skip' ? [
    txt('⏸ วันนี้ไม่มีสัญญาณ', { size: 'xl', weight: 'bold', color: C.wait, margin: 'lg' }),
    txt(`ตลาดยังไม่ชัดพอ — ไม่เทรดดีกว่า รอสัญญาณใหม่ ${thaiTime(sig.expiresAt + 15 * 60e3)}`, { size: 'xs', color: C.muted }),
  ] : [
    txt(`${buy ? '🟢 ซื้อตอนนี้' : '🔴 ขายตอนนี้'} (${buy ? 'BUY' : 'SELL'})`, { size: 'xxl', weight: 'bold', color, margin: 'lg' }),
    txt(`ความมั่นใจ ${'★'.repeat(sig.stars)}${'☆'.repeat(5 - sig.stars)}`, { size: 'xs', color: C.muted }),
    row('🎯 เข้าที่ราคา', money(sig.entry), C.text),
    row('🛑 ตัดขาดทุน (SL)', money(sig.sl), C.down),
    ...(sig.tps || [sig.tp]).map((tp, k, all) =>
      row(`💰 ${all.length > 1 ? `TP${k + 1}` : 'เป้าหมาย (TP)'}`, `${money(tp)}  (+$${money(Math.abs(tp - sig.entry))})`, C.up)),
    txt(sig.tps
      ? `เปิดออเดอร์ ${buy ? 'Buy' : 'Sell'} ทันที (Market) · ตั้ง SL ${money(sig.sl)} · ปิด ⅓ ที่ TP แต่ละจุด · ถึง TP1 แล้วเลื่อน SL ไปที่ทุน — ถ้าถึง ${thaiTime(sig.expiresAt)} ยังไม่ปิด ให้ปิดเอง`
      : `เปิดออเดอร์ ${buy ? 'Buy' : 'Sell'} ทันที (Market) · ตั้ง SL ${money(sig.sl)} · TP ${money(sig.tp)} — ถ้าถึง ${thaiTime(sig.expiresAt)} ยังไม่ปิด ให้ปิดเอง`, { size: 'xs', color: C.blue, margin: 'md' }),
  ];
  const body = [
    ...(prev ? [txt(`ผลสัญญาณครั้งก่อน (${prev.id}): ${resultText(prev)}`, { size: 'xs' })] : []),
    sep(),
    ...signalRows,
    sep(),
    title('ทำไม'),
    ...sig.why.map((l) => txt(`• ${l}`, { size: 'xs' })),
    sep(),
    title('📊 ผลงานสัญญาณจริง'),
    txt(sum.traded
      ? `ชนะ ${sum.wins} · แพ้ ${sum.losses} (ชนะ ${sum.winRate}%) · กำไรสะสม ${signed(sum.pnl)}/ออนซ์`
      : 'เพิ่งเริ่มบันทึก — ยังไม่มีผลที่ปิดแล้ว', { size: 'xs' }),
    ...(bt ? [txt(`ทดสอบย้อนหลัง ${bt.days} วัน (จำลอง): ชนะ ${bt.summary.winRate}% · ${signed(bt.summary.pnl)}/ออนซ์`, { size: 'xxs', color: C.muted })] : []),
    txt(`ข้อมูล: ${a.source} · ไม่ใช่คำแนะนำการลงทุน`, { size: 'xxs', color: C.muted, margin: 'lg' }),
  ];
  return {
    type: 'flex',
    altText: sig.status === 'skip' ? '⏸ สัญญาณทองวันนี้: ไม่มีสัญญาณ (ตลาดไม่ชัด)' : `🎯 สัญญาณทอง: ${SIDE_TH[sig.side]} ตอนนี้ที่ ${money(sig.entry)} · SL ${money(sig.sl)} · TP ${(sig.tps || [sig.tp]).map(money).join(' / ')}`,
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
    // Market signals are filled at once: the morning message itself is the entry alert
    sig = SIG.makeMarket({ bias: a.bias, price: a.price, createdAt: now,
      extra: { why: whyLines(a), source: a.source, alerts: { entry: now } } });
    store.signals.push(sig);
  }
  const prev = store.signals.filter((s) => s.id !== todayId && SIG.isFinal(s)).slice(-1)[0];
  const sum = SIG.summary(store.signals);
  store.updatedAt = now;
  store.summary = sum;

  console.log(sig.status === 'skip' ? `signal ${sig.id}: no trade (trend ${sig.trendScore})` : `signal ${sig.id}: ${sig.side} now ${sig.entry} sl ${sig.sl} tp ${sig.tp} stars ${sig.stars}`);
  if (prev) console.log(`previous ${prev.id}: ${resultText(prev)}`);
  console.log(`record: win ${sum.wins} loss ${sum.losses} pnl ${sum.pnl}`);

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
