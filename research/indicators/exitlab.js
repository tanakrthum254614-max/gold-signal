// SL / TP study (16 Oct 2026 — user: "ขอความแม่นยำสูงในการเข้าเทรด ไม่อยากให้คนที่สมัครมาผิดหวัง").
// Same entries as the site (qual-<tf>.json from qualtest.js = CS.decide + CS.dirOf on 2 years of Binance PAXG), only the
// exit changes: SL = k × ATR14 of the signal frame (instead of a fixed $15 × mult), TP = r × SL as one target or 3
// targets (1 / 1.33 / 2 × r × SL, SL to entry after the first — the site's 3-TP mode), plus fixed $ × mult. One trade at a time, hold limit = the
// site's (sys.hold or 24 h), $0.4 spread, SL first when a candle touches both. 4 equal periods old → new; a setting
// "passes" only if it makes money in all 4 and beats the site's own result over periods 1–3 — period 4 is the check.
// node exitlab.js <projectDir> [tf,tf]   (DATA_DIR = bars2y.json, long.json, qual-*.json)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const SIG = require(path.join(ROOT, 'signals.js')); global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js')); global.INTRA = INTRA; const CS = require(path.join(ROOT, 'chartsys.js'));
const DIR = process.env.DATA_DIR || __dirname;
function group(bars, ms) { const out = []; for (const b of bars) { const t = Math.floor(b.time / ms) * ms, l = out[out.length - 1];
  if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ ...b, time: t }); } return out; }
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
function atr(b, p) { const o = []; let a; b.forEach((x, i) => { const tr = i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low;
  a = i < p ? ((a || 0) * i + tr) / (i + 1) : (a * (p - 1) + tr) / p; o.push(a); }); return o; }
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8')), L = JSON.parse(fs.readFileSync(path.join(DIR, 'long.json'), 'utf8'));
const H = 3600e3, DAY = 864e5, now = D.now, SPREAD = 0.4;
const B = { m5: D['5m'], m15: D['15m'], m30: D['30m'], h1: D['1h'], h4: D['4h'], h5: group(D['1h'], 5 * H), d1: L.d1, w1: L.w1 };
const TF = { '5m': ['m5', 730], '15m': ['m5', 730], '30m': ['m5', 730], '1h': ['m5', 730], '5h': ['h1', 700], '1d': ['d1', 1900], '1w': ['d1', 1500] };
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(TF);
const out = {};

for (const tf of only) {
  const sys = CS.SYS[tf], [follow, days] = TF[tf], start = now - days * DAY, dur = sys.frames[0][1], FB = B[follow];
  const P = B[sys.frames[0][0]], A = atr(P, 14);
  const ents = JSON.parse(fs.readFileSync(path.join(DIR, `qual-${tf}.json`), 'utf8'));
  const sides = [[1, sys.buy], [-1, sys.sell]].filter(([, c]) => c);
  const period = (t) => Math.min(3, Math.floor(((t - start) / (days * DAY)) * 4));
  const stats = (trs) => {
    const per = [0, 1, 2, 3].map((k) => trs.filter((x) => x.p === k));
    const sum = (a) => a.reduce((s, x) => s + x.pnl, 0);
    const gw = trs.filter((x) => x.pnl > 0).reduce((s, x) => s + x.pnl, 0), gl = -trs.filter((x) => x.pnl <= 0).reduce((s, x) => s + x.pnl, 0);
    let eq = 0, pk = 0, dd = 0; for (const x of trs) { eq += x.pnl; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
    return { n: trs.length, win: trs.length ? Math.round((100 * trs.filter((x) => x.pnl > 0).length) / trs.length) : 0, pnl: Math.round(sum(trs)),
      pf: gl ? +(gw / gl).toFixed(2) : 99, dd: Math.round(dd), q: per.map((a) => Math.round(sum(a))), qw: per.map((a) => (a.length ? Math.round((100 * a.filter((x) => x.pnl > 0).length) / a.length) : 0)),
      avgSl: trs.length ? +(trs.reduce((s, x) => s + x.sl, 0) / trs.length).toFixed(1) : 0 };
  };
  // the site's own exits (3 TPs / TP1, $15 × mult) — same code as qualtest.js
  function site(list, side, c) {
    Object.assign(INTRA.RULE, { slUsd: 15 * c.mult, tpUsd: (c.tp1 ? [15] : [15, 20, 30]).map((u) => u * c.mult) });
    let busy = 0; const trs = [];
    for (const e of list) {
      if (e.t < busy) continue;
      const t0 = INTRA.makeTrade({ dir: side, score: 0, keys: {}, frames: [] }, e.price, e.t); if (sys.hold) t0.expiresAt = e.t + sys.hold;
      const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1); const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
      const s = SIG.summary([r], SPREAD); if (!s.traded) continue;
      trs.push({ p: period(e.t), pnl: s.pnl, sl: 15 * c.mult }); busy = (r.exitAt || t0.expiresAt) + dur;
    }
    return stats(trs);
  }
  // our exits: sl in $, tp = rr × sl, be = move SL to entry after +1 × sl
  // Scored by the site's own evaluator (SIG.evaluate — same hold / close rules as the live recorder), so the numbers are
  // comparable with "เว็บตอนนี้". be = 3 targets (1, 1.33, 2 × the TP distance) → SL moves to entry after the first,
  // like the site's 3-TP mode; otherwise one target.
  function sim(list, side, slOf, rr, be) {
    let busy = 0; const trs = [];
    for (const e of list) {
      if (e.t < busy) continue;
      const sl = slOf(e); if (!(sl > 0)) continue;
      Object.assign(INTRA.RULE, { slUsd: sl, tpUsd: be ? [1, 4 / 3, 2].map((m) => sl * rr * m) : [sl * rr] });
      const t0 = INTRA.makeTrade({ dir: side, score: 0, keys: {}, frames: [] }, e.price, e.t); if (sys.hold) t0.expiresAt = e.t + sys.hold;
      const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1); const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
      const s = SIG.summary([r], SPREAD); if (!s.traded) continue;
      trs.push({ p: period(e.t), pnl: s.pnl, sl }); busy = (r.exitAt || t0.expiresAt) + dur;
    }
    return stats(trs);
  }
  for (const [side, c] of sides) {
    const list = ents.filter((e) => e.dir === side);
    list.forEach((e) => { const i = lb(P, e.t) - 1; e.atr = i >= 14 ? A[i] : null; });
    const base = site(list, side, c);
    const rows = [];
    for (const k of [0.75, 1, 1.5, 2, 2.5, 3]) for (const rr of [1, 1.5, 2, 3]) for (const be of [0, 1]) {
      rows.push({ name: `ATR×${k} · TP ${rr}:1${be ? ' · 3TP' : ''}`, kind: 'atr', k, rr, be, ...sim(list, side, (e) => e.atr && e.atr * k, rr, be) });
    }
    for (const usd of [10, 15, 20, 30]) for (const rr of [1, 1.5, 2]) for (const be of [0, 1]) rows.push({ name: `$${usd}×${c.mult || 1} · TP ${rr}:1${be ? ' · 3TP' : ''}`, kind: 'usd', usd, rr, be, ...sim(list, side, () => usd * (c.mult || 1), rr, be) });
    const b3 = base.q.slice(0, 3).reduce((a, b) => a + b, 0);
    rows.forEach((r) => { r.all4 = r.q.every((x) => x > 0); r.pick = r.q.slice(0, 3).every((x) => x > 0) && r.q.slice(0, 3).reduce((a, b) => a + b, 0) > b3 && r.n >= 20; r.p4 = r.q[3] > 0 && r.q[3] >= base.q[3]; });
    const best = rows.filter((r) => r.pick).sort((a, b) => b.q.slice(0, 3).reduce((x, y) => x + y, 0) - a.q.slice(0, 3).reduce((x, y) => x + y, 0));
    const key = `${tf} ${side > 0 ? 'BUY' : 'SELL'}`;
    out[key] = { base, best: best.slice(0, 8), rows, all4: rows.filter((r) => r.all4).length, tried: rows.length, picked: best.length, p4: best.filter((r) => r.p4).length };
    const fmt = (r) => `${String(r.n).padStart(4)} ไม้ ${String(r.win).padStart(3)}% ${String(r.pnl).padStart(6)} PF ${String(r.pf).padStart(4)} DD ${String(r.dd).padStart(5)} SL~${r.avgSl}  [${r.q.join(' / ')}]`;
    console.log(`\n=== ${key} — เว็บตอนนี้: ${fmt(base)}`);
    console.log(`    ลอง ${rows.length} แบบ · กำไรครบ 4 ช่วง ${out[key].all4} · ผ่านช่วง 1–3 ${best.length} · ผ่านแล้วช่วง 4 ก็ดีกว่า ${out[key].p4}`);
    for (const r of best.slice(0, 8)) console.log(`${r.p4 ? '✅' : '❌'} ${r.name.padEnd(24)} ${fmt(r)}`);
  }
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
