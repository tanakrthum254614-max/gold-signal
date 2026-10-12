// "Follow" signals like the user's reference picture (12 Oct): FollowSell / FollowBuy = with-trend entry when price pulls
// back to the EMA and is rejected; BUY / SELL triangles = RSI turning back from oversold / overbought (counter-trend dips).
// 2 years, $0.4 spread, SL = m×ATR14, TP = r×SL, one trade at a time, entry at the signal candle's close, max hold 48
// candles, SL first when one candle hits both. 4 equal periods: choose on 1–3, check 4.
const fs = require('fs');
const D = JSON.parse(fs.readFileSync((process.env.DATA_DIR || __dirname) + '/bars2y.json', 'utf8'));
const SPREAD = 0.4, HOLD = 48;
const ema = (v, p) => { const k = 2 / (p + 1), o = []; let e = v[0]; for (let i = 0; i < v.length; i++) { e = i ? v[i] * k + e * (1 - k) : v[i]; o.push(e); } return o; };
function rsi(c, p = 14) { const o = Array(c.length).fill(50); let g = 0, l = 0;
  for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= p) { g += up / p; l += dn / p; } else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; }
    if (i >= p) o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } return o; }
function atr(b, p = 14) { const o = []; let a = 0; for (let i = 0; i < b.length; i++) { const tr = i ? Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)) : b[i].high - b[i].low; a = i < p ? (a * i + tr) / (i + 1) : (a * (p - 1) + tr) / p; o.push(a); } return o; }

function signals(b, type) {
  const c = b.map((x) => x.close), e20 = ema(c, 20), e50 = ema(c, 50), e200 = ema(c, 200), r = rsi(c);
  const out = [];
  for (let i = 210; i < b.length - 1; i++) {
    const x = b[i], down = e50[i] < e200[i] && x.close < e200[i], up = e50[i] > e200[i] && x.close > e200[i];
    let d = 0;
    if (type === 'follow20' || type === 'follow50') {
      const m = type === 'follow20' ? e20 : e50;
      if (down && x.high >= m[i] && x.close < m[i] && x.close < x.open) d = -1;
      if (up && x.low <= m[i] && x.close > m[i] && x.close > x.open) d = 1;
    } else if (type === 'rsiRev') { // every RSI turn (both directions, any trend)
      if (r[i - 1] < 30 && r[i] >= 30) d = 1;
      if (r[i - 1] > 70 && r[i] <= 70) d = -1;
    } else if (type === 'rsiTrend') { // RSI turn only with the big trend (buy the dip in an uptrend, sell the bounce in a downtrend)
      if (up && r[i - 1] < 35 && r[i] >= 35) d = 1;
      if (down && r[i - 1] > 65 && r[i] <= 65) d = -1;
    }
    if (d) out.push({ i, d });
  }
  return out;
}
function sim(b, sigs, A, m, rr, side) {
  const t0 = b[0].time, span = b[b.length - 1].time - t0, q = [0, 0, 0, 0];
  let busy = -1, n = 0, w = 0, pnl = 0;
  for (const { i, d } of sigs) {
    if (i <= busy || (side && d !== side)) continue;
    const e = b[i].close, sl = e - d * m * A[i], tp = e + d * rr * m * A[i];
    let res = null, j = i + 1;
    for (; j < b.length && j <= i + HOLD; j++) {
      const hiHit = d > 0 ? b[j].low <= sl : b[j].high >= sl, tpHit = d > 0 ? b[j].high >= tp : b[j].low <= tp;
      if (hiHit) { res = -m * A[i]; break; }
      if (tpHit) { res = rr * m * A[i]; break; }
    }
    if (res == null) { j = Math.min(j, b.length - 1); res = d * (b[j].close - e); }
    res -= SPREAD; busy = j; n++; if (res > 0) w++; pnl += res;
    q[Math.min(3, Math.floor(((b[i].time - t0) / span) * 4))] += res;
  }
  return { n, win: n ? Math.round((w / n) * 100) : 0, pnl: Math.round(pnl), q: q.map(Math.round) };
}
const rows = [];
for (const tf of ['5m', '15m', '30m', '1h']) {
  const b = D[tf], A = atr(b);
  for (const type of ['follow20', 'follow50', 'rsiRev', 'rsiTrend']) {
    const sg = signals(b, type);
    for (const side of [1, -1]) for (const m of [1, 1.5, 2]) for (const rr of [1, 1.5, 2]) {
      const r = sim(b, sg, A, m, rr, side);
      if (r.n >= 40) rows.push({ tf, type, side: side > 0 ? 'BUY' : 'SELL', m, rr, ...r });
    }
  }
}
const ok13 = (r) => r.q[0] > 0 && r.q[1] > 0 && r.q[2] > 0;
console.log(`tested ${rows.length} variants`);
for (const tf of ['5m', '15m', '30m', '1h']) for (const side of ['BUY', 'SELL']) {
  const mine = rows.filter((r) => r.tf === tf && r.side === side);
  const pick = mine.filter(ok13).sort((a, b) => (b.q[0] + b.q[1] + b.q[2]) - (a.q[0] + a.q[1] + a.q[2]));
  console.log(`\n== ${tf} ${side}: ${mine.length} แบบ · ผ่านช่วง 1–3: ${pick.length} → ช่วง 4 ยังกำไร: ${pick.filter((r) => r.q[3] > 0).length} · กำไรครบ 4 ช่วง: ${mine.filter((r) => r.q.every((v) => v > 0)).length}`);
  pick.slice(0, 3).forEach((r) => console.log(`   ${r.q[3] > 0 ? '✓' : '✗'} ${r.type} SL ${r.m}×ATR TP ${r.rr}:1 → ${r.n} ไม้ (${(r.n / 104).toFixed(1)}/สัปดาห์) ชนะ ${r.win}% รวม ${r.pnl} [${r.q.join('/')}]`));
  for (const type of ['follow20', 'follow50', 'rsiRev', 'rsiTrend']) { const t = mine.filter((r) => r.type === type).sort((a, b) => b.pnl - a.pnl)[0]; if (t) console.log(`   · ดีสุดของ ${type}: ${t.n} ไม้ ${t.win}% ${t.pnl} [${t.q.join('/')}] (SL ${t.m} TP ${t.rr})`); }
}
fs.writeFileSync((process.env.DATA_DIR || __dirname) + '/follow.json', JSON.stringify(rows));
