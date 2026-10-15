// Entry-quality filters on the site's current entries ("fewer but surer", 15 Oct 2026). Replays the site's own code
// (CS.decide + CS.dirOf: thresholds, confirms, noChase, news on 5m/1h) on 2 years of Binance PAXG (1d: 5, 1w: 4), then
// keeps only entries that pass a filter measured on the fast frame's closed candles before the entry:
//   ext   distance from EMA20 in ATR14 (don't chase a stretched move)   run   move off the 10-bar low/high in ATR14
//   big   size of the last candle in ATR14 (no entry right after a huge candle)   rsi   RSI14 not overbought/oversold
//   pull  a dip to EMA9 in the last 3 candles (enter on a pullback)   htf   slowest frame's close on the trade side of its EMA50
//   vol   ATR14 percentile over 200 candles (skip the wildest)   margin  score beyond the threshold by ≥ 1
// One trade at a time, the site's SL / TP / hold rules, $0.4 spread, 4 equal periods old → new.
// Pick on periods 1–3, then look at period 4 (unseen). node qualtest.js <projectDir> [tf,tf]   (DATA_DIR = bars2y.json,
// long.json, news-hist.json)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const SIG = require(path.join(ROOT, 'signals.js')); global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js')); global.INTRA = INTRA; const CS = require(path.join(ROOT, 'chartsys.js'));
const DIR = process.env.DATA_DIR || __dirname;
function group(bars, ms) { const out = []; for (const b of bars) { const t = Math.floor(b.time / ms) * ms, l = out[out.length - 1];
  if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ ...b, time: t }); } return out; }
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
const before = (b, t, n = 260) => { const i = lb(b, t); return b.slice(Math.max(0, i - n), i); };
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8')), L = JSON.parse(fs.readFileSync(path.join(DIR, 'long.json'), 'utf8'));
const NEWS = JSON.parse(fs.readFileSync(path.join(DIR, 'news-hist.json'), 'utf8')).map((n) => ({ time: n.t, title: n.name }));
const M = 60e3, H = 3600e3, DAY = 864e5, now = D.now;
const B = { m5: D['5m'], m15: D['15m'], m30: D['30m'], h1: D['1h'], h4: D['4h'], h5: group(D['1h'], 5 * H), d1: L.d1, w1: L.w1 };
const TF = { '5m': ['m5', 730], '15m': ['m5', 730], '30m': ['m5', 730], '1h': ['m5', 730], '5h': ['h1', 700], '1d': ['d1', 1900], '1w': ['d1', 1500] };

// full-series helpers on a frame's candles
function ema(v, p) { const o = [], k = 2 / (p + 1); let e; v.forEach((x, i) => { e = i ? x * k + e * (1 - k) : x; o.push(e); }); return o; }
function atr(b, p) { const o = []; let a; b.forEach((x, i) => { const tr = i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low;
  a = i < p ? ((a || 0) * i + tr) / (i + 1) : (a * (p - 1) + tr) / p; o.push(a); }); return o; }
function rsi(c, p) { const o = []; let u = 0, d = 0; c.forEach((x, i) => { const ch = i ? x - c[i - 1] : 0, up = Math.max(0, ch), dn = Math.max(0, -ch);
  if (i <= p) { u = (u * Math.max(0, i - 1) + up) / Math.max(1, i); d = (d * Math.max(0, i - 1) + dn) / Math.max(1, i); } else { u = (u * (p - 1) + up) / p; d = (d * (p - 1) + dn) / p; }
  o.push(d === 0 ? 100 : 100 - 100 / (1 + u / d)); }); return o; }
function featuresOf(P) {
  const C = P.map((b) => b.close), e20 = ema(C, 20), e9 = ema(C, 9), a = atr(P, 14), r = rsi(C, 14);
  return (i, side) => {
    if (i < 30) return null;
    const lo10 = Math.min(...P.slice(i - 9, i + 1).map((b) => b.low)), hi10 = Math.max(...P.slice(i - 9, i + 1).map((b) => b.high));
    const w = a.slice(Math.max(0, i - 199), i + 1).sort((x, y) => x - y);
    const dip = [0, 1, 2].some((k) => (side > 0 ? P[i - k].low <= e9[i - k] : P[i - k].high >= e9[i - k]));
    return { ext: (side * (C[i] - e20[i])) / a[i], run: (side > 0 ? C[i] - lo10 : hi10 - C[i]) / a[i], big: (P[i].high - P[i].low) / a[i],
      rsi: side > 0 ? r[i] : 100 - r[i], pull: dip ? 1 : 0, vol: w.findIndex((x) => x >= a[i]) / w.length };
  };
}
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(TF);
for (const tf of only) {
  const sys = CS.SYS[tf], [follow, days] = TF[tf], start = now - days * DAY, dur = sys.frames[0][1], FB = B[follow];
  const sides = [[1, sys.buy], [-1, sys.sell]].filter(([, c]) => c);
  // (1) every candle where the site's code says "enter" (cached — the slow part)
  const cache = path.join(DIR, `qual-${tf}.json`);
  let ents;
  if (fs.existsSync(cache)) ents = JSON.parse(fs.readFileSync(cache, 'utf8'));
  else {
    ents = []; const P = B[sys.frames[0][0]], feat = featuresOf(P), slow = sys.frames[sys.frames.length - 1][0], SB = B[slow], SE = ema(SB.map((b) => b.close), 50);
    const t0 = Date.now();
    for (let t = Math.floor(start / dur) * dur + dur; t < now - dur; t += dur) {
      if (!sys.long) { const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue; }
      const data = Object.fromEntries(sys.frames.map(([k]) => [k, before(B[k], t)]));
      const ni = lb(NEWS, t - H), news = NEWS.slice(ni, ni + 6);
      const dec = CS.decide(sys, data, t, news);
      const dir = CS.dirOf(sys, dec); if (!dir) continue;
      const p = before(FB, t, 1)[0], i = lb(P, t) - 1, si = lb(SB, t) - 1; if (!p || i < 0) continue;
      const f = feat(i, dir); if (!f) continue;
      ents.push({ t, dir, price: p.close, margin: Math.abs(dec.score) - (dir > 0 ? sys.buy.th : sys.sell.th), htf: si >= 50 && dir * (SB[si].close - SE[si]) > 0 ? 1 : 0, ...f });
    }
    fs.writeFileSync(cache, JSON.stringify(ents));
    console.error(`${tf}: ${ents.length} entry candles in ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  function sim(list, side, c) {
    Object.assign(INTRA.RULE, { slUsd: 15 * c.mult, tpUsd: (c.tp1 ? [15] : [15, 20, 30]).map((u) => u * c.mult) });
    let busy = 0; const trs = [];
    for (const e of list) {
      if (e.t < busy) continue;
      const t0 = INTRA.makeTrade({ dir: side, score: 0, keys: {}, frames: [] }, e.price, e.t); if (sys.hold) t0.expiresAt = e.t + sys.hold;
      const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1); const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
      trs.push(r); busy = (r.exitAt || t0.expiresAt) + dur;
    }
    const per = [0, 1, 2, 3].map((k) => trs.filter((x) => x.createdAt >= start + (k * days * DAY) / 4 && x.createdAt < start + ((k + 1) * days * DAY) / 4));
    const s = SIG.summary(trs, 0.4);
    return { n: s.traded, win: s.winRate, pnl: Math.round(s.pnl), q: per.map((x) => Math.round(SIG.summary(x, 0.4).pnl)), qw: per.map((x) => SIG.summary(x, 0.4).winRate) };
  }
  const FILTERS = [];
  for (const v of [1, 1.5, 2, 2.5, 3]) FILTERS.push([`ext ≤ ${v}`, (e) => e.ext <= v]);
  for (const v of [2, 3, 4, 5]) FILTERS.push([`run ≤ ${v}`, (e) => e.run <= v]);
  for (const v of [1.5, 2, 2.5]) FILTERS.push([`big ≤ ${v}`, (e) => e.big <= v]);
  for (const v of [65, 70, 75]) FILTERS.push([`rsi ≤ ${v}`, (e) => e.rsi <= v]);
  FILTERS.push(['pull', (e) => e.pull === 1], ['htf', (e) => e.htf === 1], ['margin ≥ 1', (e) => e.margin >= 1]);
  for (const v of [0.8, 0.9]) FILTERS.push([`vol ≤ ${v}`, (e) => e.vol <= v]);
  for (const [side, c] of sides) {
    const all = ents.filter((e) => e.dir === side), base = sim(all, side, c);
    const rows = FILTERS.map(([name, fn]) => ({ name, ...sim(all.filter(fn), side, c) }));
    const fmt = (r) => `${String(r.n).padStart(4)} ไม้ ${String(r.win).padStart(3)}% ${String(r.pnl).padStart(6)}  [${r.q.join(' / ')}]  win [${r.qw.join(' / ')}]`;
    console.log(`\n=== ${tf} ${side > 0 ? 'BUY' : 'SELL'} — ระบบปัจจุบัน: ${fmt(base)}`);
    for (const r of rows) {
      // chosen on periods 1–3 only: win% up and $ not worse in each of them, keeps ≥ 40% of trades (and drops at least one)
      const pick = [0, 1, 2].every((k) => r.qw[k] >= base.qw[k] && r.q[k] >= base.q[k]) && r.n >= 0.4 * base.n && r.n < base.n;
      const p4 = r.q[3] >= base.q[3] && r.qw[3] >= base.qw[3];
      console.log(`${pick ? (p4 ? '✅' : '❌') : '  '} ${r.name.padEnd(11)} ${fmt(r)}${pick ? (p4 ? '  ← ผ่าน 1–3 และช่วง 4 ก็ดีขึ้น' : '  ← ผ่าน 1–3 แต่ช่วง 4 แย่ลง') : ''}`);
    }
  }
}
