// Every well-known indicator, on every chart timeframe: (A) alone as an entry rule, (B) as a confirmation filter on the
// site's current system (chartsys.js). Same trade rules as the site (SL / TP from SYS, hold limits), $0.4 spread,
// 2 years (1d: 5, 1w: 4), 4 equal periods old → new. node indlab.js <projectDir>
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const SIG = require(path.join(ROOT, 'signals.js'));
global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js'));
global.INTRA = INTRA;
const CS = require(path.join(ROOT, 'chartsys.js'));
const { IND } = require('./indlib.js');
const DIR = process.env.DATA_DIR || __dirname; // price data + results (fetch.js writes the data)
function group(bars, ms) { const out = []; for (const b of bars) { const t = Math.floor(b.time / ms) * ms, l = out[out.length - 1];
  if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ ...b, time: t }); } return out; }
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
const before = (b, t, n = 260) => { const i = lb(b, t); return b.slice(Math.max(0, i - n), i); };
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8'));
const L = JSON.parse(fs.readFileSync(path.join(DIR, 'long.json'), 'utf8'));
const M = 60e3, H = 3600e3, DAY = 864e5, now = D.now;
const B = { m5: D['5m'], m15: D['15m'], m30: D['30m'], h1: D['1h'], h4: D['4h'], h5: group(D['1h'], 5 * H), d1: L.d1, w1: L.w1 };
const TF = { '5m': ['m5', 730], '15m': ['m5', 730], '30m': ['m5', 730], '1h': ['m5', 730], '5h': ['h1', 700], '1d': ['d1', 1900], '1w': ['d1', 1500] };
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(TF);
const out = fs.existsSync(path.join(DIR, 'indlab.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'indlab.json'), 'utf8')) : {};

for (const tf of only) {
  const sys = CS.SYS[tf], [follow, days] = TF[tf], start = now - days * DAY;
  const [pk, dur] = sys.frames[0], P = B[pk], C = P.map((b) => b.close);
  // (1) the current system's decisions (cached)
  const cache = path.join(DIR, `decs-${tf}.json`);
  let decs;
  if (fs.existsSync(cache)) decs = JSON.parse(fs.readFileSync(cache, 'utf8'));
  else {
    decs = [];
    for (let t = Math.floor(start / dur) * dur + dur; t < now - dur; t += dur) {
      if (!sys.long) { const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue; }
      const data = Object.fromEntries(sys.frames.map(([k]) => [k, before(B[k], t)]));
      const dec = INTRA.decideWith(sys.frames, { ...CS.NONE, noChase: true }, data, t);
      if (!dec || (!sys.long && (dec.stale || dec.lastHour))) continue;
      const p = before(B[follow], t, 1)[0]; if (p) decs.push({ t, score: dec.score, bb: dec.bbPos, price: p.close });
    }
    fs.writeFileSync(cache, JSON.stringify(decs));
  }
  const FB = B[follow];
  // one trade at a time; c = side settings (th, tp1, mult)
  function sim(entries, side, c) {
    Object.assign(INTRA.RULE, { slUsd: 15 * c.mult, tpUsd: (c.tp1 ? [15] : [15, 20, 30]).map((u) => u * c.mult) });
    let busy = 0; const trs = [];
    for (const e of entries) {
      if (e.t < busy) continue;
      const t0 = INTRA.makeTrade({ dir: side, score: 0, keys: {}, frames: [] }, e.price, e.t);
      if (sys.hold) t0.expiresAt = e.t + sys.hold;
      const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1);
      const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
      trs.push(r); busy = (r.exitAt || t0.expiresAt) + dur;
    }
    const s = SIG.summary(trs, 0.4);
    const q = [0, 1, 2, 3].map((k) => Math.round(SIG.summary(trs.filter((x) => x.createdAt >= start + (k * days * DAY) / 4 && x.createdAt < start + ((k + 1) * days * DAY) / 4), 0.4).pnl));
    return { n: s.traded, win: s.winRate, pnl: Math.round(s.pnl), q, pos: q.filter((v) => v > 0).length };
  }
  const rows = [];
  const sides = [[1, sys.buy], [-1, sys.sell || (sys.buy ? { ...sys.buy, th: sys.buy.th } : null)]].filter(([, c]) => c);
  const base = {};
  for (const [side, c] of sides) {
    const ents = decs.filter((d) => d.score * side >= c.th && (side > 0 ? d.bb < 1 : d.bb > 0));
    base[side] = { ents, r: sim(ents, side, c) };
    rows.push({ tf, ind: '— ระบบปัจจุบัน —', mode: 'base', side: side > 0 ? 'BUY' : 'SELL', tested: side > 0 || !!sys.sell, ...base[side].r });
  }
  const t0 = Date.now();
  for (const [name, fn] of Object.entries(IND)) {
    const st = fn(P, C);
    const stateAt = (t) => { const i = lb(P, t) - 1; return i >= 0 ? st[i] : 0; }; // last closed bar before t
    for (const [side, c] of sides) {
      // (B) filter: keep the current system's entries where the indicator agrees
      const f = sim(base[side].ents.filter((e) => stateAt(e.t) === side), side, c);
      rows.push({ tf, ind: name, mode: 'filter', side: side > 0 ? 'BUY' : 'SELL', tested: side > 0 || !!sys.sell, ...f });
      // (A) alone: enter when the indicator turns to this side
      const ents = [];
      for (let i = 1; i < P.length; i++) {
        const t = P[i].time + dur; if (t < start || t >= now - dur) continue;
        if (!sys.long) { const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue; }
        if (st[i] === side && st[i - 1] !== side) ents.push({ t, price: P[i].close });
      }
      rows.push({ tf, ind: name, mode: 'alone', side: side > 0 ? 'BUY' : 'SELL', tested: true, ...sim(ents, side, c) });
    }
  }
  out[tf] = rows;
  fs.writeFileSync(path.join(DIR, 'indlab.json'), JSON.stringify(out));
  console.log(`${tf}: ${decs.length} decisions, ${rows.length} rows, ${Math.round((Date.now() - t0) / 1000)}s`);
}
