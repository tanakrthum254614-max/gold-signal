// "Fewer but surer" part 2 (15 Oct 2026): take a timeframe's entry only when another timeframe's system says the same
// side at that moment (its entry condition is true on its latest closed candle). Uses the qual-<tf>.json caches written
// by qualtest.js (every candle where the site's code says "enter"). Same simulation and 4 periods as qualtest.js.
// node confluence.js <projectDir>
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const SIG = require(path.join(ROOT, 'signals.js')); global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js')); global.INTRA = INTRA; const CS = require(path.join(ROOT, 'chartsys.js'));
const DIR = process.env.DATA_DIR || __dirname;
function group(bars, ms) { const out = []; for (const b of bars) { const t = Math.floor(b.time / ms) * ms, l = out[out.length - 1];
  if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ ...b, time: t }); } return out; }
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8')), L = JSON.parse(fs.readFileSync(path.join(DIR, 'long.json'), 'utf8'));
const H = 3600e3, DAY = 864e5, now = D.now;
const B = { m5: D['5m'], h1: D['1h'], d1: L.d1 };
const TF = { '5m': ['m5', 730], '15m': ['m5', 730], '30m': ['m5', 730], '1h': ['m5', 730], '5h': ['h1', 700], '1d': ['d1', 1900] };
const E = {}; for (const tf of Object.keys(TF)) E[tf] = JSON.parse(fs.readFileSync(path.join(DIR, `qual-${tf}.json`), 'utf8'));
const durOf = (tf) => CS.SYS[tf].frames[0][1];
// is `tf`'s entry condition true for `side` at time t (its candle that closed last before t)?
function on(tf, side, t) { const d = durOf(tf), slot = Math.floor(t / d) * d, list = E[tf];
  let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].t < slot) lo = m + 1; else hi = m; }
  return lo < list.length && list[lo].t === slot && list[lo].dir === side; }
for (const tf of Object.keys(E)) E[tf].sort((a, b) => a.t - b.t);
for (const tf of ['5m', '15m', '30m', '1h', '5h']) {
  const sys = CS.SYS[tf], [follow, days] = TF[tf], start = now - days * DAY, dur = durOf(tf), FB = B[follow];
  function sim(list, side, c) {
    Object.assign(INTRA.RULE, { slUsd: 15 * c.mult, tpUsd: (c.tp1 ? [15] : [15, 20, 30]).map((u) => u * c.mult) });
    let busy = 0; const trs = [];
    for (const e of list) { if (e.t < busy) continue;
      const t0 = INTRA.makeTrade({ dir: side, score: 0, keys: {}, frames: [] }, e.price, e.t); if (sys.hold) t0.expiresAt = e.t + sys.hold;
      const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1); const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
      trs.push(r); busy = (r.exitAt || t0.expiresAt) + dur; }
    const per = [0, 1, 2, 3].map((k) => trs.filter((x) => x.createdAt >= start + (k * days * DAY) / 4 && x.createdAt < start + ((k + 1) * days * DAY) / 4));
    const s = SIG.summary(trs, 0.4);
    return { n: s.traded, win: s.winRate, pnl: Math.round(s.pnl), q: per.map((x) => Math.round(SIG.summary(x, 0.4).pnl)), qw: per.map((x) => SIG.summary(x, 0.4).winRate) };
  }
  const fmt = (r) => `${String(r.n).padStart(4)} ไม้ ${String(r.win).padStart(4)}% ${String(r.pnl).padStart(6)}  [${r.q.join(' / ')}]  win [${r.qw.join(' / ')}]`;
  for (const [side, c] of [[1, sys.buy], [-1, sys.sell]].filter(([, x]) => x)) {
    const all = E[tf].filter((e) => e.dir === side), base = sim(all, side, c);
    console.log(`\n=== ${tf} ${side > 0 ? 'BUY' : 'SELL'} — ระบบปัจจุบัน: ${fmt(base)}`);
    const others = Object.keys(E).filter((x) => x !== tf);
    const tests = others.map((o) => [`+ ${o} ตรงกัน`, (e) => on(o, side, e.t)]);
    tests.push(['+ กรอบอื่น ≥ 1', (e) => others.some((o) => on(o, side, e.t))], ['+ กรอบอื่น ≥ 2', (e) => others.filter((o) => on(o, side, e.t)).length >= 2]);
    for (const [name, fn] of tests) {
      const r = sim(all.filter(fn), side, c);
      const pick = r.n >= 20 && r.n < base.n && [0, 1, 2].every((k) => r.qw[k] >= base.qw[k] && r.q[k] >= base.q[k]);
      const p4 = r.q[3] >= base.q[3] && r.qw[3] >= base.qw[3];
      console.log(`${pick ? (p4 ? '✅' : '❌') : '  '} ${name.padEnd(15)} ${fmt(r)}`);
    }
  }
}
