// Techniques from the user's PDFs (28 Oct 2026, user: "เพิ่มเทคนิคนี้เข้าไปเพิ่มความเเม่นยำในการเทรดมากขึ้น" — PDF/ICT.pdf,
// "ท่าคัดกรอง Plan Of God", "ท่าเอาไว้สอบกองหรือเทรด" (ริวเรน 12 ท่า), "บทสรุปเทคนิค snr") tested as EXTRA CONFIRMATIONS on top of the
// site's current entries: the entry still comes from CHARTSYS, a filter only lets it through when the technique agrees.
// Same data / evaluator / live rule as edgetest.js MODE=side (one open trade per side, limit fills $0.3 through, $0.4 spread,
// 2 years in 4 equal periods). Builds score2-<tf>.json like morenew.js when missing.
// node pdftest.js <projectDir>   (DATA_DIR = bars2y.json + news-hist.json from fetch.js / fetch_news.py) · TFS=5m,15m,30m,1h
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const SIG = require(path.join(ROOT, 'signals.js')); global.TA = require(path.join(ROOT, 'indicators.js'));
const INTRA = require(path.join(ROOT, 'intraday.js')); global.INTRA = INTRA; const CS = require(path.join(ROOT, 'chartsys.js'));
const DIR = process.env.DATA_DIR || __dirname;
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'bars2y.json'), 'utf8'));
const M = 60e3, H = 3600e3, DAY = 864e5, now = D.now, days = 730, start = now - days * DAY, SPREAD = 0.4, FB = D['5m'];
function lb(b, t) { let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].time < t) lo = m + 1; else hi = m; } return lo; }
function group(bars, ms) { const out = []; for (const b of bars) { const t = Math.floor(b.time / ms) * ms, l = out[out.length - 1];
  if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; } else out.push({ ...b, time: t }); } return out; }
const period = (t) => Math.min(3, Math.floor(((t - start) / (days * DAY)) * 4));
const B = { m5: D['5m'], m15: D['15m'], m30: D['30m'], h1: D['1h'], h4: D['4h'], h5: group(D['1h'], 5 * H) };
const TFB = { '5m': D['5m'], '15m': D['15m'], '30m': D['30m'], '1h': D['1h'] };

// the site's score on every closed candle (same as morenew.js scores())
function scores(tf) {
  const f = path.join(DIR, `score2-${tf}.json`); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const NEWS = JSON.parse(fs.readFileSync(path.join(DIR, 'news-hist.json'), 'utf8')).map((n) => ({ time: n.t, title: n.name }));
  const before = (b, t, n = 260) => { const i = lb(b, t); return b.slice(Math.max(0, i - n), i); };
  const sys = CS.SYS[tf], dur = sys.frames[0][1], rows = [], t0 = Date.now();
  for (let t = Math.floor(start / dur) * dur + dur; t < now - dur; t += dur) {
    const wd = new Date(t).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const data = Object.fromEntries(sys.frames.map(([k]) => [k, before(B[k], t)]));
    const ni = lb(NEWS, t - H), dec = CS.decide(sys, data, t, NEWS.slice(ni, ni + 6));
    if (!dec || dec.stale || dec.lastHour || (sys.news && dec.news)) continue;
    const p = before(FB, t, 1)[0]; if (!p) continue;
    if (Math.abs(dec.score) < 2) continue;
    rows.push({ t, s: dec.score, bb: dec.bbPos, c: dec.conf || {}, price: p.close });
  }
  fs.writeFileSync(f, JSON.stringify(rows)); console.error(`${tf}: ${rows.length} rows in ${Math.round((Date.now() - t0) / 1000)} s`);
  return rows;
}

// ---- indicator series on the signal timeframe (index k = closed bar k) ----
function ema(c, p) { const k = 2 / (p + 1), o = []; c.forEach((x, i) => o.push(i ? x * k + o[i - 1] * (1 - k) : x)); return o; }
function rsi(c, p = 14) { const o = new Array(c.length).fill(50); let g = 0, l = 0;
  for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
    if (i <= p) { g += up / p; l += dn / p; } else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; }
    if (i >= p) o[i] = l ? 100 - 100 / (1 + g / l) : 100; } return o; }
function sma(a, p) { const o = []; let s = 0; a.forEach((x, i) => { s += x; if (i >= p) s -= a[i - p]; o.push(s / Math.min(i + 1, p)); }); return o; }
function stoch(b, kp = 5, ks = 3, dp = 3) { const raw = b.map((_, i) => { let hi = -Infinity, lo = Infinity;
  for (let j = Math.max(0, i - kp + 1); j <= i; j++) { hi = Math.max(hi, b[j].high); lo = Math.min(lo, b[j].low); }
  return hi > lo ? (100 * (b[i].close - lo)) / (hi - lo) : 50; }); const k = sma(raw, ks); return { k, d: sma(k, dp) }; }
const SER = {};
for (const [tf, b] of Object.entries(TFB)) {
  const c = b.map((x) => x.close), st = stoch(b);
  SER[tf] = { b, e9: ema(c, 9), e21: ema(c, 21), rsi: rsi(c), k: st.k, d: st.d };
}

// ---- the techniques: f(S, i, side, price) where bars [0, i) are closed at the signal time ----
const lowMin = (b, a, z) => { let m = Infinity; for (let j = Math.max(0, a); j < z; j++) m = Math.min(m, b[j].low); return m; };
const highMax = (b, a, z) => { let m = -Infinity; for (let j = Math.max(0, a); j < z; j++) m = Math.max(m, b[j].high); return m; };
// liquidity sweep (ICT 1 / Plan Of God "ล่า SL"): within the last W bars a wick went past the 20-bar swing and the bar closed back inside
function sweepAt(b, i, side, W = 6) {
  for (let j = i - 1; j >= Math.max(21, i - W); j--) {
    if (side > 0) { const lo = lowMin(b, j - 20, j); if (b[j].low < lo && b[j].close > lo) return j; }
    else { const hi = highMax(b, j - 20, j); if (b[j].high > hi && b[j].close < hi) return j; }
  } return -1; }
const F = {
  // ริวเรน ท่า 3: EMA 9/21 — fast above slow for Buy
  ema: (S, i, s) => s * (S.e9[i - 1] - S.e21[i - 1]) > 0,
  // ท่า 3 strict: the 9/21 cross happened within the last 5 bars
  emax: (S, i, s) => { for (let j = i - 1; j >= i - 5 && j > 0; j--) if (s * (S.e9[j] - S.e21[j]) > 0 && s * (S.e9[j - 1] - S.e21[j - 1]) <= 0) return true; return false; },
  // ท่า 9: RSI 14 breaks out — the last RSI is beyond the previous 10 bars' extreme in the trade direction
  rsibrk: (S, i, s) => { const r = S.rsi; let m = s > 0 ? -Infinity : Infinity; for (let j = i - 11; j < i - 1; j++) m = s > 0 ? Math.max(m, r[j]) : Math.min(m, r[j]); return s * (r[i - 1] - m) > 0; },
  // ท่า 10: Stochastic 5-3-3 — %K crossed %D in the trade direction within the last 2 bars
  stoch: (S, i, s) => { for (let j = i - 1; j >= i - 2; j--) if (s * (S.k[j] - S.d[j]) > 0 && s * (S.k[j - 1] - S.d[j - 1]) <= 0) return true; return false; },
  sweep: (S, i, s) => sweepAt(S.b, i, s) >= 0,
  // ICT model / SNR "MSS": sweep, then a close beyond the high (Buy) of the bars around the sweep = structure shift
  mss: (S, i, s) => { const b = S.b, j = sweepAt(b, i, s, 12); if (j < 0) return false; const lvl = s > 0 ? highMax(b, j - 5, j + 1) : lowMin(b, j - 5, j + 1);
    for (let k = j + 1; k < i; k++) if (s * (b[k].close - lvl) > 0) return true; return false; },
  // ICT 2 / SNR 4 / ท่า 2: first retest of an untouched FVG from the last 20 bars (zone used once)
  fvg: (S, i, s, p) => { const b = S.b;
    for (let m = i - 1; m >= Math.max(2, i - 20); m--) {
      const top = s > 0 ? b[m].low : b[m - 2].low, bot = s > 0 ? b[m - 2].high : b[m].high; if (top <= bot) continue; // gap [bot, top]
      let used = false; for (let k = m + 1; k < i - 1; k++) if (s > 0 ? b[k].low <= top : b[k].high >= bot) { used = true; break; }
      if (used) continue;
      const last = b[i - 1], touched = s > 0 ? last.low <= top + 0.5 && p >= bot - 0.5 : last.high >= bot - 0.5 && p <= top + 0.5;
      if (touched && m < i - 1) return true;
    } return false; },
  // ICT 4: Premium / Discount — Buy only in the lower half of the last 50 bars' range, Sell in the upper half
  pd: (S, i, s, p) => { const hi = highMax(S.b, i - 50, i), lo = lowMin(S.b, i - 50, i); return s * ((hi + lo) / 2 - p) > 0; },
  // ICT 5: OTE — price retraced 61.8–79% of the 50-bar leg
  ote: (S, i, s, p) => { const hi = highMax(S.b, i - 50, i), lo = lowMin(S.b, i - 50, i), r = hi - lo; if (r <= 0) return false;
    const x = s > 0 ? (hi - p) / r : (p - lo) / r; return x >= 0.618 && x <= 0.79; },
  // Plan Of God: trade only Asia 07–09 / London 13–15 / New York 19–21 Thai time
  sess: (S, i, s, p, t) => { const h = new Date(t + 7 * H).getUTCHours(); return (h >= 7 && h < 9) || (h >= 13 && h < 15) || (h >= 19 && h < 21); },
  // ท่า 11: a pause box — the 12 bars before were a tight range (≤ 1.5× the 50-bar average bar) and price is back at the box edge
  box: (S, i, s, p) => { const b = S.b; if (i < 64) return false; let avg = 0; for (let j = i - 50; j < i; j++) avg += b[j].high - b[j].low; avg /= 50;
    const hi = highMax(b, i - 13, i - 1), lo = lowMin(b, i - 13, i - 1); if (hi - lo > 4 * avg) return false; return s > 0 ? p <= lo + avg : p >= hi - avg; },
};
const COMBOS = (process.env.COMBOS || 'ema+stoch,sweep+fvg,mss+fvg,pd+fvg,ema+rsibrk,sweep+pd,mss+pd').split(',').filter(Boolean);
const tests = ['base', ...Object.keys(F), ...COMBOS];
const pass = (name, S, i, s, p, t) => name === 'base' || name.split('+').every((k) => F[k](S, i, s, p, t));

// COUNT=1: only count base candles and how many pass each side's chosen technique (c.pdf) — compare with the site code
if (process.env.COUNT) {
  for (const tf of (process.env.TFS || '1h,30m,15m').split(',')) { const sys = CS.SYS[tf], rows = scores(tf), S = SER[tf];
    for (const side of [1, -1]) { const c = side > 0 ? sys.buy : sys.sell; if (!c || !c.pdf) continue; let n = 0, yes = 0;
      for (const r of rows) { if (!(side * r.s >= c.th && (side > 0 ? r.bb < 1 : r.bb > 0) && (!c.confirm || r.c[c.confirm] === side))) continue;
        const i = lb(S.b, r.t); n++; if (i >= 70 && F[c.pdf](S, i, side, r.price, r.t)) yes++; }
      console.log(tf, side > 0 ? 'BUY' : 'SELL', c.pdf, 'base rows', n, 'pass', yes); } }
  process.exit(0);
}
const out = []; const say = (x) => { console.log(x); out.push(x); }; const res = {};
for (const tf of (process.env.TFS || '5m,15m,30m,1h').split(',')) {
  const sys = CS.SYS[tf], dur = sys.frames[0][1], rows = scores(tf), S = SER[tf];
  for (const side of [1, -1]) {
    const c = side > 0 ? sys.buy : sys.sell; if (!c) continue;
    const ok = (r) => !!r && side * r.s >= c.th && (side > 0 ? r.bb < 1 : r.bb > 0) && (!c.confirm || r.c[c.confirm] === side);
    const sl = 15 * c.mult, tps = CS.usdList(c);
    say(`\n=== ${tf} ${side > 0 ? 'BUY' : 'SELL'}${c.risky ? ' (risky)' : ''} ===`);
    for (const name of tests) {
      const trs = []; let busy = 0, sig = 0;
      for (const r of rows) {
        if (r.t < start || !ok(r) || r.t < busy) continue;
        const i = lb(S.b, r.t); if (i < 70) continue;
        if (!pass(name, S, i, side, r.price, r.t)) continue;
        sig++;
        let t = r.t, price = r.price;
        if (c.dip) { const lim = r.price - side * c.dip, i0 = lb(FB, r.t), i1 = lb(FB, r.t + c.dipH * H); t = null;
          for (let q = i0; q < i1 && q < FB.length; q++) if (side > 0 ? FB[q].low <= lim - 0.3 : FB[q].high >= lim + 0.3) { t = FB[q].time; price = lim; break; }
          if (t == null) { busy = r.t + c.dipH * H; continue; } }
        Object.assign(INTRA.RULE, { slUsd: sl, tpUsd: tps });
        const t0 = INTRA.makeTrade({ dir: side, score: 0, keys: {}, frames: [] }, price, t); if (sys.hold) t0.expiresAt = t + sys.hold;
        const a = lb(FB, t), z = lb(FB, t0.expiresAt + 1), ev = SIG.evaluate(t0, FB.slice(a, Math.min(z, a + 6000)), now);
        const sm = SIG.summary([ev], SPREAD); if (sm.traded) trs.push({ p: period(r.t), pnl: sm.pnl });
        busy = (ev.exitAt || t0.expiresAt) + dur;
      }
      const per = [0, 1, 2, 3].map((k) => trs.filter((x) => x.p === k)), sum = (a) => a.reduce((x, y) => x + y.pnl, 0);
      const win = (a) => (a.length ? Math.round((100 * a.filter((x) => x.pnl > 0).length) / a.length) : 0);
      const r = { n: trs.length, win: win(trs), pnl: Math.round(sum(trs)), q: per.map((a) => Math.round(sum(a))), qw: per.map(win), avg: trs.length ? +(sum(trs) / trs.length).toFixed(2) : 0 };
      ((res[tf] = res[tf] || {})[side > 0 ? 'BUY' : 'SELL'] = res[tf][side > 0 ? 'BUY' : 'SELL'] || {})[name] = r;
      say(`${name.padEnd(12)} ไม้ ${String(r.n).padStart(5)} · ชนะ ${String(r.win).padStart(3)}% · ${String(r.pnl).padStart(6)}$ · เฉลี่ย ${String(r.avg).padStart(6)}$ [${r.q.join(' / ')}] ชนะ [${r.qw.join(' / ')}]`);
    }
  }
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, out.join('\n') + '\n');
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(res, null, 1));
