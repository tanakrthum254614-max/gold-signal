// New entry ideas (19 Oct 2026 — user: "ทำแพ้บ่อย ชนะไม่ถึง 80% เลย เปลี่ยนความคิดใหม่ในการเทรด คิดวิเคราะห์ในการเข้าใหม่
// หาจุดที่แม่นยำ และมีเหตุผลที่ชัดเจนในการเข้า").
//   A  pullback in a trend — higher frame up (close > EMA50, EMA20 > EMA50), price dips to the entry frame's EMA20 in the
//      last 3 candles, closes back above it with a reversal candle (close > open and > previous high), RSI14 40–65.
//      SL under the 5-candle swing low (− 0.1 ATR), TP = r × that risk. Every entry has its reasons. SELL = mirror.
//   B  high win rate — the site's own entries (qual-<tf>.json from qualtest.js), the site's SL, TP much nearer (0.25–0.75 ×).
// Scored by the site's evaluator (SIG.evaluate), one trade at a time, $0.4 spread, 2 years in 4 equal periods old → new.
// A setting "passes" only if it makes money in each of periods 1–3 — then period 4 (never used to choose) is the check.
// node newidea.js <projectDir>   (DATA_DIR = bars2y.json, long.json, qual-*.json)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const SIG = require(path.join(ROOT, 'signals.js')); global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js')); global.INTRA = INTRA; const CS = require(path.join(ROOT, 'chartsys.js'));
const DIR = process.env.DATA_DIR || __dirname;
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8'));
const M = 60e3, H = 3600e3, DAY = 864e5, now = D.now, SPREAD = 0.4, days = 730, start = now - days * DAY;
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
function ema(c, p) { const k = 2 / (p + 1), o = []; c.forEach((x, i) => o.push(i ? x * k + o[i - 1] * (1 - k) : x)); return o; }
function atr(b, p) { const o = []; let a; b.forEach((x, i) => { const tr = i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low;
  a = i < p ? ((a || 0) * i + tr) / (i + 1) : (a * (p - 1) + tr) / p; o.push(a); }); return o; }
function rsi(c, p) { const o = []; let u = 0, d = 0; c.forEach((x, i) => { const ch = i ? x - c[i - 1] : 0, up = Math.max(0, ch), dn = Math.max(0, -ch);
  if (i <= p) { u = (u * Math.max(0, i - 1) + up) / Math.max(1, i); d = (d * Math.max(0, i - 1) + dn) / Math.max(1, i); } else { u = (u * (p - 1) + up) / p; d = (d * (p - 1) + dn) / p; }
  o.push(d === 0 ? 100 : 100 - 100 / (1 + u / d)); }); return o; }
const FB = D['5m'];                              // every trade is followed on 5-minute candles
const period = (t) => Math.min(3, Math.floor(((t - start) / (days * DAY)) * 4));
function run(entries, holdMs) {                  // entries: { t, dir, price, sl$, tp$ } sorted by t
  let busy = 0; const trs = [];
  for (const e of entries) {
    if (e.t < busy || e.t < start) continue;
    Object.assign(INTRA.RULE, { slUsd: e.sl, tpUsd: e.tps || [e.tp] });
    const t0 = INTRA.makeTrade({ dir: e.dir, score: 0, keys: {}, frames: [] }, e.price, e.t); if (holdMs) t0.expiresAt = e.t + holdMs;
    const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1); const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
    const s = SIG.summary([r], SPREAD); if (!s.traded) continue;
    trs.push({ p: period(e.t), pnl: s.pnl }); busy = (r.exitAt || t0.expiresAt) + 5 * M;
  }
  const per = [0, 1, 2, 3].map((k) => trs.filter((x) => x.p === k)), sum = (a) => a.reduce((s, x) => s + x.pnl, 0);
  const win = (a) => (a.length ? Math.round((100 * a.filter((x) => x.pnl > 0).length) / a.length) : 0);
  return { n: trs.length, win: win(trs), pnl: Math.round(sum(trs)), q: per.map((a) => Math.round(sum(a))), qw: per.map(win) };
}
const fmt = (r) => `${String(r.n).padStart(4)} ไม้  ชนะ ${String(r.win).padStart(3)}%  ${String(r.pnl).padStart(6)}$  [${r.q.join(' / ')}]  ชนะ [${r.qw.join(' / ')}]`;
const verdict = (r) => (r.n < 30 ? '·' : r.q.slice(0, 3).every((x) => x > 0) ? (r.q[3] > 0 ? '✅' : '❌') : ' ');
const out = [];
const say = (s) => { console.log(s); out.push(s); };

// ---------- C (PARTIAL=1): scale out — TP1 near (hit often), then SL to entry, the rest runs to TP2 / TP3 ----------
// user, 19 Oct 2026: "ขอมากกว่า 70 ก็ได้ 50 เปอร์เซ็นต์ดูน้อยไป". The site's evaluator splits the position equally over the
// targets and moves the stop to entry after TP1, so a trade that reaches TP1 can't end as a loss.
if (process.env.PARTIAL) {
  say('C — แบ่งปิดกำไร: TP1 ใกล้ (ถึงบ่อย) → เลื่อน SL มาที่ทุน → ส่วนที่เหลือวิ่งไป TP2 / TP3 · จุดเข้าเดิมของเว็บ · SL เดิม');
  for (const tf of (process.env.TFS || '5m,30m,1h,5h,1d').split(',')) {
    const sys = CS.SYS[tf], f = path.join(DIR, `qual-${tf}.json`); if (!fs.existsSync(f)) continue;
    const ents = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const [dir, c] of [[1, sys.buy], [-1, sys.sell]]) {
      if (!c) continue; const list = ents.filter((e) => e.dir === dir); if (!list.length) continue;
      const sl = 15 * c.mult;
      say(`\n  ${tf} ${dir > 0 ? 'BUY' : 'SELL'} (SL $${sl}) — เว็บตอนนี้ ${c.tp1 ? 'TP1 เดียว' : '3 TP'} ชนะ ${c.win}%`);
      for (const ladder of [[0.25, 0.5, 1], [0.25, 1, 2], [0.33, 0.67, 1], [0.33, 1, 2], [0.5, 1, 1.5], [0.5, 1, 2]]) {
        const r = run(list.map((e) => ({ t: e.t, dir, price: e.price, sl, tps: ladder.map((k) => +(sl * k).toFixed(2)) })), sys.hold || 0);
        say(`  ${verdict(r)} TP ${ladder.map((k) => `$${(sl * k).toFixed(1)}`).join(' / ').padEnd(22)} ${fmt(r)}${r.win >= 70 ? '  ← ชนะ ≥ 70%' : ''}`);
      }
    }
  }
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, out.join('\n') + '\n');
  process.exit(0);
}

// ---------- A: pullback in a trend ----------
const PLAN = [['5m', '5m', '1h', 5 * M, 0], ['30m', '30m', '4h', 30 * M, 0], ['1h', '1h', '4h', H, 0]];
say('A — ย่อในแนวโน้ม (กรอบใหญ่ขาขึ้น/ลง + ย่อแตะ EMA20 + แท่งกลับตัว + RSI 40–65) · SL ใต้/เหนือจุดสวิง 5 แท่ง · TP = r × ความเสี่ยง');
for (const [name, fk, hk, dur, hold] of PLAN) {
  const P = D[fk], HB = D[hk]; if (!P || !HB) { say(`${name}: ไม่มีข้อมูล`); continue; }
  const C = P.map((b) => b.close), e20 = ema(C, 20), A = atr(P, 14), R = rsi(C, 14);
  const HC = HB.map((b) => b.close), h20 = ema(HC, 20), h50 = ema(HC, 50);
  const raw = [];
  for (let i = 60; i < P.length - 1; i++) {
    const t = P[i].time + dur; if (t < start) continue;
    const hi = lb(HB, t - (HB[1].time - HB[0].time) + 1) - 1; if (hi < 60) continue;     // the higher frame's last CLOSED candle
    for (const dir of [1, -1]) {
      const trend = dir > 0 ? HC[hi] > h50[hi] && h20[hi] > h50[hi] : HC[hi] < h50[hi] && h20[hi] < h50[hi];
      if (!trend) continue;
      const touch = [0, 1, 2].some((k) => (dir > 0 ? P[i - k].low <= e20[i - k] + 0.1 * A[i] : P[i - k].high >= e20[i - k] - 0.1 * A[i]));
      const back = dir > 0 ? C[i] > e20[i] : C[i] < e20[i];
      const rev = dir > 0 ? C[i] > P[i].open && C[i] > P[i - 1].high : C[i] < P[i].open && C[i] < P[i - 1].low;
      const r = dir > 0 ? R[i] : 100 - R[i];
      if (!(touch && back && rev && r >= 40 && r <= 65)) continue;
      const swing = dir > 0 ? Math.min(...P.slice(i - 4, i + 1).map((b) => b.low)) - 0.1 * A[i] : Math.max(...P.slice(i - 4, i + 1).map((b) => b.high)) + 0.1 * A[i];
      const risk = Math.abs(C[i] - swing); if (risk < 0.5 * A[i] || risk > 3 * A[i]) continue;
      raw.push({ t, dir, price: C[i], risk });
    }
  }
  for (const dir of [1, -1]) {
    const list = raw.filter((e) => e.dir === dir);
    say(`\n  ${name} ${dir > 0 ? 'BUY' : 'SELL'} — จุดที่เข้าเงื่อนไข ${list.length}`);
    for (const rr of [0.5, 1, 1.5, 2]) {
      const r = run(list.map((e) => ({ ...e, sl: +e.risk.toFixed(2), tp: +(e.risk * rr).toFixed(2) })), hold);
      say(`  ${verdict(r)} TP ${String(rr).padEnd(3)} × ความเสี่ยง  ${fmt(r)}`);
    }
  }
}

// ---------- B: the site's entries, nearer targets (high win rate) ----------
say('\nB — จุดเข้าเดิมของเว็บ · SL เดิม · TP ใกล้ขึ้น (ชนะบ่อยขึ้น — ได้เงินไหม?)');
for (const tf of (process.env.TFS || '5m,30m,1h,5h,1d').split(',')) {
  const sys = CS.SYS[tf], f = path.join(DIR, `qual-${tf}.json`); if (!fs.existsSync(f)) continue;
  const ents = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [dir, c] of [[1, sys.buy], [-1, sys.sell]]) {
    if (!c) continue; const list = ents.filter((e) => e.dir === dir); if (!list.length) continue;
    const sl = 15 * c.mult;
    say(`\n  ${tf} ${dir > 0 ? 'BUY' : 'SELL'} (SL $${sl})`);
    for (const k of [0.25, 0.33, 0.5, 0.75, 1]) {
      const r = run(list.map((e) => ({ t: e.t, dir, price: e.price, sl, tp: +(sl * k).toFixed(2) })), sys.hold || 0);
      say(`  ${verdict(r)} TP ${String(k).padEnd(4)} × SL ($${(sl * k).toFixed(1)})  ${fmt(r)}`);
    }
  }
}
say('\n✅ = กำไรทุกช่วง 1–3 และช่วง 4 (ไม่ได้ใช้เลือก) ก็กำไร · ❌ = ผ่าน 1–3 แต่ช่วง 4 ขาดทุน · · = ไม้น้อยกว่า 30');
if (process.env.OUT) fs.writeFileSync(process.env.OUT, out.join('\n') + '\n');
