// The site's CURRENT rules tested the way they now run live (20 Oct 2026): every NEW signal is an entry — the candle before
// did not give the same side — several trades may be open at once (was: one trade at a time per timeframe). Same data and
// evaluator as morenew.js (score2-<tf>.json cache, Binance PAXG 5m follow, $0.4 spread, limit fills $0.3 through, 4 periods).
// node edgetest.js <projectDir>   (DATA_DIR = bars2y.json + score2-*.json from morenew.js)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const SIG = require(path.join(ROOT, 'signals.js')); global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js')); global.INTRA = INTRA; const CS = require(path.join(ROOT, 'chartsys.js'));
const DIR = process.env.DATA_DIR || __dirname;
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8'));
const M = 60e3, H = 3600e3, DAY = 864e5, now = D.now, days = 730, start = now - days * DAY, SPREAD = 0.4, FB = D['5m'];
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
const period = (t) => Math.min(3, Math.floor(((t - start) / (days * DAY)) * 4));
// HTF=4h|1h (20 Oct 2026, user: "สัญญาณยังให้ไม่ค่อยตรงเลย"): trade only WITH the bigger frame — its last closed candle's close
// on the trade side of its EMA (HTF_EMA, default 50)
function emaArr(c, p) { const k = 2 / (p + 1), o = []; c.forEach((x, i) => o.push(i ? x * k + o[i - 1] * (1 - k) : x)); return o; }
const HK = process.env.HTF, HB = HK ? D[HK] : null, HDUR = HK === '4h' ? 4 * H : H, HE = HB ? emaArr(HB.map((b) => b.close), +(process.env.HTF_EMA || 50)) : null;
const withTrend = (t, side) => { if (!HB) return true; const i = lb(HB, t - HDUR + 1) - 1; return i >= 50 && side * (HB[i].close - HE[i]) > 0; };
// CONF=<tf>:<k> (20 Oct 2026, "ขอแม่นยำกว่านี้"): the bigger timeframe's latest closed score must lean the same way by ≥ k
const CONF = process.env.CONF ? process.env.CONF.split(':') : null;
const CDUR = { '5m': 5 * M, '15m': 15 * M, '30m': 30 * M, '1h': H };
const CROWS = CONF ? JSON.parse(fs.readFileSync(path.join(DIR, `score2-${CONF[0]}.json`), 'utf8')) : null;
const confOk = (t, side) => { if (!CROWS) return true; let lo = 0, hi = CROWS.length; while (lo < hi) { const m = (lo + hi) >> 1; if (CROWS[m].t <= t) lo = m + 1; else hi = m; } const i = lo - 1; const r = i >= 0 ? CROWS[i] : null; // rows sorted by t (closed candle end)
  return !!r && t - r.t < CDUR[CONF[0]] && side * r.s >= +CONF[1]; };
const out = []; const say = (s) => { console.log(s); out.push(s); }; const res = {};
for (const tf of (process.env.TFS || '5m,15m,30m,1h').split(',')) {
  const sys = CS.SYS[tf], dur = sys.frames[0][1], rows = JSON.parse(fs.readFileSync(path.join(DIR, `score2-${tf}.json`), 'utf8'));
  const byT = new Map(rows.map((r) => [r.t, r]));
  for (const side of [1, -1]) {
    const c = side > 0 ? sys.buy : sys.sell; if (!c) continue;
    const ok = (r) => !!r && side * r.s >= c.th && (side > 0 ? r.bb < 1 : r.bb > 0) && (!c.confirm || r.c[c.confirm] === side);
    const sl = 15 * c.mult, tps = CS.usdList(c), trs = [];
    let busy = 0;
    let sig = 0;
    for (const r of rows) {
      // MODE=side: one open trade per SIDE (Buy and Sell independent), any signal candle once that side's trade closed
      if (r.t < start || !ok(r) || !withTrend(r.t, side) || !confOk(r.t, side)) continue;
      if (process.env.MODE === 'side') { if (r.t < busy) continue; } else if (ok(byT.get(r.t - dur))) continue; // not new
      sig++;
      let t = r.t, price = r.price;
      if (c.dip) { const lim = r.price - side * c.dip, i0 = lb(FB, r.t), i1 = lb(FB, r.t + c.dipH * H); t = null;
        for (let i = i0; i < i1 && i < FB.length; i++) if (side > 0 ? FB[i].low <= lim - 0.3 : FB[i].high >= lim + 0.3) { t = FB[i].time; price = lim; break; }
        if (t == null) { busy = r.t + c.dipH * H; continue; } } // live: a waiting limit holds the side until it expires
      Object.assign(INTRA.RULE, { slUsd: sl, tpUsd: tps });
      const t0 = INTRA.makeTrade({ dir: side, score: 0, keys: {}, frames: [] }, price, t); if (sys.hold) t0.expiresAt = t + sys.hold;
      const i = lb(FB, t), j = lb(FB, t0.expiresAt + 1), ev = SIG.evaluate(t0, FB.slice(i, Math.min(j, i + 6000)), now);
      const s = SIG.summary([ev], SPREAD); if (s.traded) trs.push({ p: period(r.t), pnl: s.pnl });
      busy = (ev.exitAt || t0.expiresAt) + dur;
    }
    const per = [0, 1, 2, 3].map((k) => trs.filter((x) => x.p === k)), sum = (a) => a.reduce((x, y) => x + y.pnl, 0);
    const win = (a) => (a.length ? Math.round((100 * a.filter((x) => x.pnl > 0).length) / a.length) : 0);
    const r = { n: trs.length, win: win(trs), pnl: Math.round(sum(trs)), q: per.map((a) => Math.round(sum(a))), qw: per.map(win), signals: sig };
    (res[tf] = res[tf] || {})[side > 0 ? 'BUY' : 'SELL'] = r;
    say(`${tf} ${side > 0 ? 'BUY ' : 'SELL'} สัญญาณใหม่ ${String(sig).padStart(5)} (${(sig / (days * 5 / 7)).toFixed(1)}/วัน) · ได้เข้า ${String(r.n).padStart(5)} · ชนะ ${r.win}% · ${r.pnl}$ [${r.q.join(' / ')}] ชนะ [${r.qw.join(' / ')}] · เดิม (ทีละไม้) ${c.win}%`);
  }
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, out.join('\n') + '\n');
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(res, null, 1));
