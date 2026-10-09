// Does skipping entries within ±30 minutes of high-impact US news help? The live rules (chartsys.js, with their
// confirmation indicators) on every intraday timeframe, with and without the news blackout, 2 years, $0.4 spread,
// 4 equal periods. News history: news-hist.json [{ t, name }] (investing.com calendar, importance=high).
// node newstest.js <projectDir>      Env: DATA_DIR (bars2y.json, decs-<tf>.json from indlab.js, news-hist.json)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const DIR = process.env.DATA_DIR || __dirname;
const SIG = require(path.join(ROOT, 'signals.js'));
global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js'));
global.INTRA = INTRA;
const CS = require(path.join(ROOT, 'chartsys.js'));
const { IND } = require('./indlib.js');
const NAME = { ema921: 'EMA 9/21', roc12: 'ROC 12 (โมเมนตัม)', sma2050: 'SMA 20/50' };
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8'));
const NEWS = JSON.parse(fs.readFileSync(path.join(DIR, 'news-hist.json'), 'utf8')).map((n) => n.t).sort((a, b) => a - b);
const newsT = NEWS.map((x) => ({ time: x }));
const nearFast = (t, min) => { const i = lb(newsT, t - min * 60e3); return i < newsT.length && newsT[i].time <= t + min * 60e3; };
const B = { m5: D['5m'], m15: D['15m'], m30: D['30m'], h1: D['1h'] };
const now = D.now, DAY = 864e5, days = 730, start = now - days * DAY;
const rows = [];
for (const tf of ['5m', '15m', '30m', '1h']) {
  const sys = CS.SYS[tf], [pk, dur] = sys.frames[0], P = B[pk], C = P.map((b) => b.close), FB = B.m5;
  const decs = JSON.parse(fs.readFileSync(path.join(DIR, `decs-${tf}.json`), 'utf8'));
  for (const [side, c] of [[1, sys.buy], [-1, sys.sell]]) {
    if (!c) continue;
    const st = c.confirm ? IND[NAME[c.confirm]](P, C) : null;
    const ok = (d) => d.score * side >= c.th && (side > 0 ? d.bb < 1 : d.bb > 0) && (!st || st[lb(P, d.t) - 1] === side);
    const ents = decs.filter(ok);
    const sim = (list) => {
      Object.assign(INTRA.RULE, { slUsd: 15 * c.mult, tpUsd: (c.tp1 ? [15] : [15, 20, 30]).map((u) => u * c.mult) });
      let busy = 0; const trs = [];
      for (const e of list) {
        if (e.t < busy) continue;
        const t0 = INTRA.makeTrade({ dir: side, score: 0, keys: {}, frames: [] }, e.price, e.t);
        const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1);
        const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
        trs.push(r); busy = (r.exitAt || t0.expiresAt) + dur;
      }
      const s = SIG.summary(trs, 0.4);
      const q = [0, 1, 2, 3].map((k) => Math.round(SIG.summary(trs.filter((x) => x.createdAt >= start + (k * days * DAY) / 4 && x.createdAt < start + ((k + 1) * days * DAY) / 4), 0.4).pnl));
      return { n: s.traded, win: s.winRate, pnl: Math.round(s.pnl), q };
    };
    const all = sim(ents);
    for (const min of [0, 15, 30, 60]) {
      const r = min ? sim(ents.filter((e) => !nearFast(e.t, min))) : all;
      rows.push({ tf, side: side > 0 ? 'BUY' : 'SELL', blackout: min ? `±${min} นาที` : 'ไม่หลบข่าว', ...r, q: r.q.join('/'), better: min ? r.q.filter((v, k) => v > all.q[k]).length + '/4' : '' });
    }
  }
}
console.table(rows);
fs.writeFileSync(path.join(DIR, 'newstest.json'), JSON.stringify(rows, null, 1));
