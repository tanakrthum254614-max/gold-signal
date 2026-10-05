// Saturday-morning weekly report (both systems, after spread) to LINE.
// Also scores any daily signal that expired after Friday's morning run (the morning job is off on weekends).
// Usage: node scripts/weekly.js data.json      Env: SEND, RECORD, SPREAD_USD, SITE_URL, LINE_CHANNEL_ACCESS_TOKEN
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const { money } = require('../dailyplan.js');
const { send } = require('./notify.js');
const { signed } = require('./trade-events.js');

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const SPREAD = +(process.env.SPREAD_USD || 0.4);
const ROOT = path.join(__dirname, '..');
const read = (f, empty) => (fs.existsSync(path.join(ROOT, f)) ? JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) : empty);
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const day = (ms) => new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
const DAY = 864e5;

// Monday 07:00 Thai time of the week containing `now`
function weekStart(now) {
  const th = new Date(now + 7 * 3600e3);
  const back = (th.getUTCDay() + 6) % 7; // days since Monday
  const monday = new Date(now + 7 * 3600e3 - back * DAY).toISOString().slice(0, 10);
  return Date.parse(`${monday}T07:00:00+07:00`);
}

function section(name, trades) {
  const s = SIG.summary(trades, SPREAD);
  if (!s.traded) return { s, lines: [`${name}: ไม่มีไม้ในสัปดาห์นี้`] };
  const lines = [`${name}: ${s.traded} ไม้ · ชนะ ${s.wins} แพ้ ${s.losses} (${s.winRate}%) · ${signed(s.pnl)}/ออนซ์`];
  if (s.tp3) lines.push(`   ถึง TP1 ${s.tp1} · TP2 ${s.tp2} · TP3 ${s.tp3} ครั้ง`);
  return { s, lines };
}

(async function main() {
  const now = Date.now();
  const data = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'data.json'), 'utf8'));
  const daily = read('signals.json', { signals: [] });
  const intra = read('intraday.json', { trades: [] });

  // Score daily signals that expired since the last morning run
  const sb = [...bars(data.m30).filter((b) => !data.m15 || b.time + 30 * 60e3 <= data.m15[0][0]), ...bars(data.m15)];
  let changed = false;
  daily.signals = daily.signals.map((s) => {
    if (SIG.isFinal(s) || s.expiresAt > now || !sb.length || sb[0].time > s.createdAt) return s;
    changed = true;
    return SIG.evaluate(s, sb, now);
  });

  const from = weekStart(now), prevFrom = from - 7 * DAY;
  const done = (t) => t.status === 'win' || t.status === 'loss';
  const inWeek = (list, a, b) => list.filter((t) => t.createdAt >= a && t.createdAt < b && done(t));
  const i30 = section('⏱️ สัญญาณ 30 นาที', inWeek(intra.trades, from, now));
  // Advisory daily calls (overview only, SIG.RULE.advisory) are reported but not counted in the total
  const real = (list) => list.filter((t) => !t.advisory);
  const weekDaily = inWeek(daily.signals, from, now);
  const advisoryOnly = weekDaily.length && !real(weekDaily).length;
  const d1 = section(advisoryOnly ? '📅 สูตรรายวัน (ข้อมูลประกอบ · ไม่นับรวม)' : '📅 สัญญาณรายวัน', weekDaily);
  const total = i30.s.pnl + SIG.summary(real(weekDaily), SPREAD).pnl;
  const prevTotal = SIG.summary(inWeek(intra.trades, prevFrom, from), SPREAD).pnl + SIG.summary(real(inWeek(daily.signals, prevFrom, from)), SPREAD).pnl;

  const all = [...inWeek(intra.trades, from, now), ...real(weekDaily)].map((t) => ({ ...t, net: t.pnl - SPREAD }));
  const best = all.reduce((m, t) => (!m || t.net > m.net ? t : m), null);
  const worst = all.reduce((m, t) => (!m || t.net < m.net ? t : m), null);
  const label = (t) => `${day(t.createdAt)} ${t.side === 'BUY' ? 'ซื้อ' : 'ขาย'} ${money(t.entry)} → ${signed(t.net)}`;

  const lines = [`📊 สรุปผลสัปดาห์ ${day(from)} – ${day(now - DAY)}`, '', ...i30.lines, ...d1.lines, '',
    `รวมทั้งสัปดาห์: ${signed(total)}/ออนซ์ (หักสเปรด $${SPREAD}/ไม้แล้ว)`,
    `= ถ้าเทรดไม้ละ 0.01 lot ได้ ${signed(total)} · 0.10 lot ได้ ${signed(total * 10)}`];
  if (best && all.length > 1) lines.push(`ไม้ดีที่สุด: ${label(best)}`, `ไม้แย่ที่สุด: ${label(worst)}`);
  lines.push(`เทียบสัปดาห์ก่อน: ${signed(prevTotal)} → ${total >= prevTotal ? 'ดีขึ้น ▲' : 'แย่ลง ▼'}`, '', `ดูสถิติทั้งหมด: ${SITE_URL}/#stats`);
  const text = lines.join('\n');
  console.log(text);

  await send([text]);
  if (changed && process.env.RECORD === 'true') {
    daily.summary = SIG.summary(daily.signals, SPREAD);
    daily.updatedAt = now;
    fs.writeFileSync(path.join(ROOT, 'signals.json'), `${JSON.stringify(daily, null, 1)}\n`);
    console.log('✓ signals.json updated');
  }
})().catch((e) => { console.error(e); process.exit(1); });
