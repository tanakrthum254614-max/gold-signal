// Saturday-morning weekly report (the main system = chart 30m, the daily overview, and the other chart timeframes;
// after spread) to LINE.
// Also scores any daily signal that expired after Friday's morning run (the morning job is off on weekends).
// Usage: node scripts/weekly.js data.json      Env: SEND, RECORD, SPREAD_USD, SITE_URL, LINE_CHANNEL_ACCESS_TOKEN
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');
const CS = require('../chartsys.js');
const { money } = require('../dailyplan.js');
const { send } = require('./notify.js');
const { signed } = require('./trade-events.js');
// One set of test numbers everywhere (monthly study → test-stats.json)
try { CS.applyStats(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test-stats.json'), 'utf8'))); } catch (e) { /* keep chartsys.js numbers */ }

const SITE_URL = process.env.SITE_URL || 'https://gold-signal-ten.vercel.app';
const SPREAD = +(process.env.SPREAD_USD || 0.4);
const ROOT = path.join(__dirname, '..');
const read = (f, empty) => (fs.existsSync(path.join(ROOT, f)) ? JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) : empty);
const bars = (rows) => (rows || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const day = (ms) => new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
const DAY = 864e5;

// The Monday market open (07:00 Thai, 08:00 in the US winter) of the week containing `now`
function weekStart(now) {
  const th = new Date(now + 7 * 3600e3);
  const back = (th.getUTCDay() + 6) % 7; // days since Monday
  const monday = new Date(now + 7 * 3600e3 - back * DAY).toISOString().slice(0, 10);
  const t = Date.parse(`${monday}T07:00:00+07:00`);
  return t + SIG.marketShift(t);
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
  const chart = read('chart-signals.json', { trades: [] });

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
  // Main system = the chart 30m record (the same as the website and LINE since the merge on 9 Oct 2026); the old
  // 30-minute record (intraday.json) is listed apart and not counted
  const main = chart.trades.filter((t) => t.tf === '30m');
  const i30 = section('⏱️ สัญญาณ 30 นาที (ระบบหลัก)', inWeek(main, from, now));
  const oldWeek = inWeek(intra.trades, from, now);
  if (oldWeek.length) { const o = SIG.summary(oldWeek, SPREAD); i30.lines.push(`   (ระบบ 30 นาทีแบบเดิม ก่อนรวมระบบ: ${o.traded} ไม้ · ${signed(o.pnl)} — ไม่นับรวม)`); }
  // Advisory daily calls (overview only, SIG.RULE.advisory) are reported but not counted in the total
  const real = (list) => list.filter((t) => !t.advisory);
  const weekDaily = inWeek(daily.signals, from, now);
  const advisoryOnly = weekDaily.length && !real(weekDaily).length;
  // Only the real daily signals are counted (and shown as such); overview days are listed apart so the lines add up to the total
  const d1 = section(advisoryOnly ? '📅 สูตรรายวัน (ข้อมูลประกอบ · ไม่นับรวม)' : '📅 สัญญาณรายวัน', advisoryOnly ? weekDaily : real(weekDaily));
  const advN = weekDaily.length - real(weekDaily).length;
  if (!advisoryOnly && advN) d1.lines.push(`   (+ ภาพรวมรายวัน ${advN} วัน เป็นข้อมูลประกอบ — ไม่นับรวม)`);
  const total = i30.s.pnl + SIG.summary(real(weekDaily), SPREAD).pnl;
  const prevTotal = SIG.summary(inWeek(main, prevFrom, from), SPREAD).pnl + SIG.summary(real(inWeek(daily.signals, prevFrom, from)), SPREAD).pnl;

  const all = [...inWeek(main, from, now), ...real(weekDaily)].map((t) => ({ ...t, net: t.pnl - SPREAD }));
  const best = all.reduce((m, t) => (!m || t.net > m.net ? t : m), null);
  const worst = all.reduce((m, t) => (!m || t.net < m.net ? t : m), null);
  const label = (t) => `${day(t.createdAt)} ${t.side === 'BUY' ? 'ซื้อ' : 'ขาย'} ${money(t.entry)} → ${signed(t.net)}`;

  // Chart-tab signals, every timeframe (live record by scripts/chart-run.js) — reported separately, not in the total
  const TF_TH = { '5m': '5 นาที', '15m': '15 นาที', '30m': '30 นาที', '1h': '1 ชม.', '5h': '5 ชม.', '1d': '1 วัน', '1w': '1 สัปดาห์' };
  const chartLines = [];
  Object.entries(CS.SYS).forEach(([tf, sys]) => {
    if (tf === '30m') return; // = the main system, above
    const all = chart.trades.filter((t) => t.tf === tf);
    const s = SIG.summary(inWeek(all, from, now), SPREAD), b = CS.brake(sys, all, now);
    if (!s.traded && !b) return;
    chartLines.push(`• ${TF_TH[tf]}: ${s.traded ? `${s.traded} ไม้ · ชนะ ${s.wins} แพ้ ${s.losses} · ${signed(s.pnl)}` : 'ไม่มีไม้'}${b ? ` · ⛔ พัก (${b.why})` : ''}`);
  });
  if (chartLines.length) chartLines.unshift('📈 สัญญาณบนกราฟกรอบอื่น (ผลจริง หักสเปรดแล้ว · ไม่รวมในยอดด้านล่าง)');
  else chartLines.push('📈 สัญญาณบนกราฟกรอบอื่น: ไม่มีไม้ในสัปดาห์นี้');

  const lines = [`📊 สรุปผลสัปดาห์ ${day(from)} – ${day(now - DAY)}`, '', ...i30.lines, ...d1.lines, '', ...chartLines, '',
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
