// 5m SELL: current rule (−6 + SMA 20/50) vs looser thresholds — how often, and does it still make money? 2y, $0.4 spread
const fs = require('fs'), path = require('path');
const ROOT = 'D:/โปรเจคทันเดอร์/Traeding', RI = ROOT + '/research/indicators/';
const SIG = require(ROOT + '/signals.js'); global.TA = require(ROOT + '/indicators.js');
const INTRA = require(ROOT + '/intraday.js'); global.INTRA = INTRA; const CS = require(ROOT + '/chartsys.js');
const { IND } = require(RI + 'indlib.js');
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
const D = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR || __dirname, 'bars2y.json'), 'utf8')), now = D.now, DAY = 864e5, days = 730, start = now - days * DAY;
const sys = CS.SYS['5m'], P = D['5m'], C = P.map((b) => b.close), FB = D['5m'];
let decs = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR || __dirname, 'decs-5m.json'), 'utf8'));
const NEWS = fs.existsSync(RI + 'news-hist.json') ? JSON.parse(fs.readFileSync(RI + 'news-hist.json', 'utf8')).map((n) => n.t).sort((a, b) => a - b) : null;
if (NEWS) decs = decs.filter((d) => { const i = lb(NEWS.map((t) => ({ time: t })), d.t - 30 * 60e3); return !(i < NEWS.length && NEWS[i] <= d.t + 30 * 60e3); });
const sma = IND['SMA 20/50'](P, C), ema = IND['EMA 9/21'](P, C);
const sim = (ents, mult, tp1) => {
  Object.assign(INTRA.RULE, { slUsd: 15 * mult, tpUsd: (tp1 ? [15] : [15, 20, 30]).map((u) => u * mult) });
  let busy = 0; const trs = [];
  for (const e of ents) { if (e.t < busy) continue;
    const t0 = INTRA.makeTrade({ dir: -1, score: 0, keys: {}, frames: [] }, e.price, e.t); if (sys.hold) t0.expiresAt = e.t + sys.hold;
    const i = lb(FB, e.t), j = lb(FB, t0.expiresAt + 1); const r = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
    trs.push(r); busy = (r.exitAt || t0.expiresAt) + 300e3; }
  const s = SIG.summary(trs, 0.4);
  const q = [0, 1, 2, 3].map((k) => Math.round(SIG.summary(trs.filter((x) => x.createdAt >= start + k * days * DAY / 4 && x.createdAt < start + (k + 1) * days * DAY / 4), 0.4).pnl));
  const last60 = trs.filter((x) => x.createdAt >= now - 60 * DAY);
  return { n: s.traded, win: s.winRate, pnl: Math.round(s.pnl), q, perWeek: (s.traded / 104).toFixed(1), last60: last60.length, last60pnl: Math.round(SIG.summary(last60, 0.4).pnl) };
};
console.log('news filter:', !!NEWS, '| decs', decs.length);
for (const th of [6, 5, 4, 3]) for (const [cn, st] of [['—', null], ['SMA 20/50', sma], ['EMA 9/21', ema]]) for (const mult of [0.67, 1]) for (const tp1 of [false, true]) {
  const base = decs.filter((d) => d.score <= -th && d.bb > 0 && (!st || st[lb(P, d.t) - 1] === -1));
  const r = sim(base, mult, tp1);
  if (r.n < 20) continue;
  console.log(`−${th} ${cn.padEnd(9)} SL$${Math.round(15 * mult)} ${tp1 ? 'TP1  ' : 'TP123'} → ${String(r.n).padStart(4)} ไม้ (${r.perWeek}/สัปดาห์) ชนะ ${r.win}% รวม ${String(r.pnl).padStart(5)} [${r.q.join('/')}] · 60 วันล่าสุด ${r.last60} ไม้ ${r.last60pnl}`);
}
