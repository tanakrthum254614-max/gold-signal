// Could a SELL side work on each chart timeframe? Grid: threshold × SL/TP size × TP1 or TP1/2/3, alone or with each of
// the 28 indicators as a confirmation. 2 years (1d: 5, 1w: 4), $0.4 spread, 4 equal periods; choose on periods 1–3,
// check period 4. node selltest.js <projectDir>     Env: DATA_DIR (bars2y.json, long.json, decs-<tf>.json, news-hist.json)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const DIR = process.env.DATA_DIR || __dirname;
const SIG = require(path.join(ROOT, 'signals.js'));
global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js'));
global.INTRA = INTRA;
const CS = require(path.join(ROOT, 'chartsys.js'));
const { IND } = require('./indlib.js');
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
function group(bars, ms) { const out = []; for (const b of bars) { const t = Math.floor(b.time / ms) * ms, l = out[out.length - 1];
  if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ ...b, time: t }); } return out; }
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8')), L = JSON.parse(fs.readFileSync(path.join(DIR, 'long.json'), 'utf8'));
const H = 3600e3, DAY = 864e5, now = D.now;
const B = { m5: D['5m'], m15: D['15m'], m30: D['30m'], h1: D['1h'], h5: group(D['1h'], 5 * H), d1: L.d1, w1: L.w1 };
const NEWS = fs.existsSync(path.join(DIR, 'news-hist.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'news-hist.json'), 'utf8')).map((n) => ({ time: n.t })).sort((a, b) => a.time - b.time) : [];
const nearNews = (t) => { const i = lb(NEWS, t - 30 * 60e3); return i < NEWS.length && NEWS[i].time <= t + 30 * 60e3; };
const TF = { '5m': ['m5', 730], '15m': ['m5', 730], '30m': ['m5', 730], '1h': ['m5', 730], '5h': ['h1', 700], '1d': ['d1', 1900], '1w': ['d1', 1500] };
const out = [];
for (const [tf, [follow, days]] of Object.entries(TF)) {
  const sys = CS.SYS[tf], [pk, dur] = sys.frames[0], P = B[pk], C = P.map((b) => b.close), FB = B[follow], start = now - days * DAY, max = sys.frames.length * 2;
  let decs = JSON.parse(fs.readFileSync(path.join(DIR, `decs-${tf}.json`), 'utf8'));
  if (sys.news && NEWS.length) decs = decs.filter((d) => !nearNews(d.t));
  const mults = sys.long ? [1, 2, 4, 8].filter((m) => m * 15 <= ({ '5h': 60, '1d': 120, '1w': 300 }[tf])) : [0.67, 1, 1.5, 2];
  const states = Object.fromEntries(Object.entries(IND).map(([n, fn]) => [n, fn(P, C)]));
  const sim = (ents, mult, tp1) => {
    Object.assign(INTRA.RULE, { slUsd: 15 * mult, tpUsd: (tp1 ? [15] : [15, 20, 30]).map((u) => u * mult) });
    let busy = 0; const trs = [];
    for (const e of ents) {
      if (e.t < busy) continue;
      const t0 = INTRA.makeTrade({ dir: -1, score: 0, keys: {}, frames: [] }, e.price, e.t);
      if (sys.hold) t0.expiresAt = e.t + sys.hold;
      const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1);
      const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
      trs.push(r); busy = (r.exitAt || t0.expiresAt) + dur;
    }
    const s = SIG.summary(trs, 0.4);
    const q = [0, 1, 2, 3].map((k) => Math.round(SIG.summary(trs.filter((x) => x.createdAt >= start + (k * days * DAY) / 4 && x.createdAt < start + ((k + 1) * days * DAY) / 4), 0.4).pnl));
    return { n: s.traded, win: s.winRate, pnl: Math.round(s.pnl), q };
  };
  const rows = [];
  for (const th of [max - 2, max - 1, max].filter((x) => x >= 1)) {
    const base = decs.filter((d) => d.score <= -th && d.bb > 0);
    for (const mult of mults) for (const tp1 of [true, false]) {
      const minN = sys.long ? 8 : 25;
      const r0 = sim(base, mult, tp1);
      if (r0.n >= minN) rows.push({ tf, th, sl: Math.round(15 * mult), tp: tp1 ? 'TP1' : 'TP123', confirm: '—', ...r0 });
      for (const [name, st] of Object.entries(states)) {
        const r = sim(base.filter((d) => st[lb(P, d.t) - 1] === -1), mult, tp1);
        if (r.n >= minN) rows.push({ tf, th, sl: Math.round(15 * mult), tp: tp1 ? 'TP1' : 'TP123', confirm: name, ...r });
      }
    }
  }
  // choose on periods 1–3 only (all three positive, best total), then look at period 4
  const pick = rows.filter((r) => r.q[0] > 0 && r.q[1] > 0 && r.q[2] > 0).sort((a, b) => (b.q[0] + b.q[1] + b.q[2]) - (a.q[0] + a.q[1] + a.q[2]));
  const all4 = rows.filter((r) => r.q.every((v) => v > 0)).length;
  const best = rows.slice().sort((a, b) => b.pnl - a.pnl)[0];
  out.push({ tf, tried: rows.length, chosen13: pick.length, held4: pick.filter((r) => r.q[3] > 0).length, all4, top: pick.slice(0, 3), best });
  console.log(`\n== ${tf} SELL — ${rows.length} แบบ · ดีครบ 4 ช่วง: ${all4} · ผ่านช่วง 1–3: ${pick.length} → ช่วง 4 ยังกำไร: ${pick.filter((r) => r.q[3] > 0).length}`);
  pick.slice(0, 3).forEach((r) => console.log(`   ${r.q[3] > 0 ? '✓' : '✗'} คะแนน −${r.th} · SL $${r.sl} · ${r.tp} · ${r.confirm} → ${r.n} ไม้ ชนะ ${r.win}% รวม ${r.pnl} (${r.q.join('/')})`));
  if (best) console.log(`   กำไรรวมสูงสุด (เลือกจากผลทั้งหมด = มองย้อนหลัง): ${best.confirm} −${best.th} SL $${best.sl} ${best.tp} → ${best.n} ไม้ ${best.win}% ${best.pnl} (${best.q.join('/')})`);
}
fs.writeFileSync(path.join(DIR, 'selltest.json'), JSON.stringify(out, null, 1));
