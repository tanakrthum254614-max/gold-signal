// Replays the site's own code (CS.decide + CS.dirOf, with the new confirm filters) and compares with indlab.json
const fs = require('fs'), path = require('path'); const ROOT = process.argv[2];
const SIG = require(path.join(ROOT, 'signals.js')); global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js')); global.INTRA = INTRA; const CS = require(path.join(ROOT, 'chartsys.js'));
function group(bars, ms) { const out = []; for (const b of bars) { const t = Math.floor(b.time / ms) * ms, l = out[out.length - 1];
  if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ ...b, time: t }); } return out; }
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
const before = (b, t, n = 260) => { const i = lb(b, t); return b.slice(Math.max(0, i - n), i); };
const D = JSON.parse(fs.readFileSync('bars2y.json', 'utf8')), L = JSON.parse(fs.readFileSync('long.json', 'utf8'));
const H = 3600e3, DAY = 864e5, now = D.now;
const B = { m5: D['5m'], m15: D['15m'], m30: D['30m'], h1: D['1h'], h4: D['4h'], h5: group(D['1h'], 5 * H), d1: L.d1, w1: L.w1 };
for (const [tf, follow, days] of [['5h', 'h1', 700], ['15m', 'm5', 730]]) {
  const sys = CS.SYS[tf], dur = sys.frames[0][1], start = now - days * DAY, FB = B[follow], c = sys.buy;
  Object.assign(INTRA.RULE, { slUsd: 15 * c.mult, tpUsd: (c.tp1 ? [15] : [15, 20, 30]).map((u) => u * c.mult) });
  let busy = 0, blocked = 0; const trs = [];
  for (let t = Math.floor(start / dur) * dur + dur; t < now - dur; t += dur) {
    if (t < busy) continue;
    if (!sys.long) { const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue; }
    const data = Object.fromEntries(sys.frames.map(([k]) => [k, before(B[k], t)]));
    const dec = CS.decide(sys, data, t, null);
    if (!dec || (!sys.long && (dec.stale || dec.lastHour))) continue;
    if (CS.unconfirmed(sys, dec)) blocked++;
    if (CS.dirOf(sys, dec) !== 1) continue;
    const p = before(FB, t, 1)[0]; if (!p) continue;
    const t0 = INTRA.makeTrade({ dir: 1, score: 0, keys: {}, frames: [] }, p.close, t); if (sys.hold) t0.expiresAt = t + sys.hold;
    const i = lb(FB, t), j = lb(FB, t0.expiresAt + 1); const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
    trs.push(r); busy = (r.exitAt || t0.expiresAt) + dur;
  }
  const s = SIG.summary(trs, 0.4), q = [0, 1, 2, 3].map((k) => Math.round(SIG.summary(trs.filter((x) => x.createdAt >= start + (k * days * DAY) / 4 && x.createdAt < start + ((k + 1) * days * DAY) / 4), 0.4).pnl));
  console.log(tf, 'site code:', s.traded, 'trades', s.winRate + '%', Math.round(s.pnl), q.join('/'), '| blocked by confirm:', blocked, '| SYS says win', c.win, c.q.join('/'));
}
