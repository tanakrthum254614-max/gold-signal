// Well-known indicators as full series → direction state per bar: +1 buy side, -1 sell side, 0 neutral.
// Each uses only bars up to and including i (no look-ahead).
const N = (n) => new Array(n).fill(NaN);
function sma(v, p) { const o = N(v.length); let s = 0; for (let i = 0; i < v.length; i++) { s += v[i]; if (i >= p) s -= v[i - p]; if (i >= p - 1) o[i] = s / p; } return o; }
function ema(v, p) { const o = N(v.length), k = 2 / (p + 1); let e = NaN; for (let i = 0; i < v.length; i++) { if (isNaN(v[i])) continue; e = isNaN(e) ? v[i] : v[i] * k + e * (1 - k); o[i] = e; } return o; }
function rma(v, p) { const o = N(v.length); let e = NaN, s = 0, c = 0; for (let i = 0; i < v.length; i++) { if (isNaN(v[i])) continue; if (isNaN(e)) { s += v[i]; c++; if (c === p) { e = s / p; o[i] = e; } } else { e = (e * (p - 1) + v[i]) / p; o[i] = e; } } return o; }
function wma(v, p) { const o = N(v.length), d = (p * (p + 1)) / 2; for (let i = p - 1; i < v.length; i++) { let s = 0; for (let k = 0; k < p; k++) s += v[i - k] * (p - k); o[i] = s / d; } return o; }
function std(v, p) { const m = sma(v, p), o = N(v.length); for (let i = p - 1; i < v.length; i++) { let s = 0; for (let k = 0; k < p; k++) s += (v[i - k] - m[i]) ** 2; o[i] = Math.sqrt(s / p); } return o; }
const hi = (b, i, p) => { let m = -Infinity; for (let k = Math.max(0, i - p + 1); k <= i; k++) m = Math.max(m, b[k].high); return m; };
const lo = (b, i, p) => { let m = Infinity; for (let k = Math.max(0, i - p + 1); k <= i; k++) m = Math.min(m, b[k].low); return m; };
function tr(b) { return b.map((x, i) => (i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low)); }
function rsi(c, p) { const up = c.map((x, i) => (i ? Math.max(0, x - c[i - 1]) : 0)), dn = c.map((x, i) => (i ? Math.max(0, c[i - 1] - x) : 0)); const u = rma(up, p), d = rma(dn, p); return u.map((x, i) => (d[i] === 0 ? 100 : 100 - 100 / (1 + x / d[i]))); }
const sgn = (x) => (isNaN(x) ? 0 : x > 0 ? 1 : x < 0 ? -1 : 0);
// hold a state until the opposite trigger (for event-style rules)
function latch(ev) { const o = []; let s = 0; for (const e of ev) { if (e) s = e; o.push(s); } return o; }

const IND = {
  'EMA 9/21': (b, c) => { const a = ema(c, 9), z = ema(c, 21); return a.map((x, i) => sgn(x - z[i])); },
  'EMA 50/200': (b, c) => { const a = ema(c, 50), z = ema(c, 200); return a.map((x, i) => (i < 200 ? 0 : sgn(x - z[i]))); },
  'SMA 20/50': (b, c) => { const a = sma(c, 20), z = sma(c, 50); return a.map((x, i) => sgn(x - z[i])); },
  'ราคา vs EMA 200': (b, c) => { const z = ema(c, 200); return c.map((x, i) => (i < 200 ? 0 : sgn(x - z[i]))); },
  'MACD 12/26/9': (b, c) => { const m = ema(c, 12).map((x, i) => x - ema(c, 26)[i]); return m; },
  'RSI 14 (เหนือ/ใต้ 50)': (b, c) => rsi(c, 14).map((x) => sgn(x - 50)),
  'RSI 14 (กลับตัว 30/70)': (b, c) => { const r = rsi(c, 14); return latch(r.map((x, i) => (i && r[i - 1] < 30 && x >= 30 ? 1 : i && r[i - 1] > 70 && x <= 70 ? -1 : 0))); },
  'Stochastic 14/3': (b, c) => { const k = c.map((x, i) => { const h = hi(b, i, 14), l = lo(b, i, 14); return h === l ? 50 : ((x - l) / (h - l)) * 100; }); const ks = sma(k, 3), d = sma(ks, 3);
    return latch(ks.map((x, i) => (i && ks[i - 1] <= d[i - 1] && x > d[i] && x < 30 ? 1 : i && ks[i - 1] >= d[i - 1] && x < d[i] && x > 70 ? -1 : 0))); },
  'Bollinger (กลับตัวจากขอบ)': (b, c) => { const m = sma(c, 20), s = std(c, 20); return latch(c.map((x, i) => (x < m[i] - 2 * s[i] ? 1 : x > m[i] + 2 * s[i] ? -1 : 0))); },
  'Bollinger (ทะลุขอบ)': (b, c) => { const m = sma(c, 20), s = std(c, 20); return latch(c.map((x, i) => (x > m[i] + 2 * s[i] ? 1 : x < m[i] - 2 * s[i] ? -1 : 0))); },
  'Donchian 20 (Turtle)': (b, c) => latch(c.map((x, i) => (i < 21 ? 0 : x > hi(b, i - 1, 20) ? 1 : x < lo(b, i - 1, 20) ? -1 : 0))),
  'Keltner (ทะลุ)': (b, c) => { const m = ema(c, 20), a = rma(tr(b), 10); return latch(c.map((x, i) => (x > m[i] + 2 * a[i] ? 1 : x < m[i] - 2 * a[i] ? -1 : 0))); },
  'Supertrend 10/3': (b, c) => { const a = rma(tr(b), 10), o = []; let up = 0, dn = 0, d = 1;
    for (let i = 0; i < b.length; i++) { const m = (b[i].high + b[i].low) / 2, u0 = m - 3 * a[i], d0 = m + 3 * a[i]; if (isNaN(a[i])) { o.push(0); continue; }
      up = i && c[i - 1] > up ? Math.max(u0, up) : u0; dn = i && c[i - 1] < dn ? Math.min(d0, dn) : d0;
      if (d === 1 && c[i] < up) d = -1; else if (d === -1 && c[i] > dn) d = 1; o.push(d); } return o; },
  'Parabolic SAR': (b) => { const o = [0]; let up = true, sar = b[0].low, ep = b[0].high, af = 0.02;
    for (let i = 1; i < b.length; i++) { sar = sar + af * (ep - sar);
      if (up) { if (b[i].low < sar) { up = false; sar = ep; ep = b[i].low; af = 0.02; } else if (b[i].high > ep) { ep = b[i].high; af = Math.min(0.2, af + 0.02); } }
      else if (b[i].high > sar) { up = true; sar = ep; ep = b[i].high; af = 0.02; } else if (b[i].low < ep) { ep = b[i].low; af = Math.min(0.2, af + 0.02); }
      o.push(up ? 1 : -1); } return o; },
  'ADX/DMI 14 (ADX>20)': (b) => { const pdm = b.map((x, i) => (i ? (x.high - b[i - 1].high > b[i - 1].low - x.low && x.high - b[i - 1].high > 0 ? x.high - b[i - 1].high : 0) : 0));
    const ndm = b.map((x, i) => (i ? (b[i - 1].low - x.low > x.high - b[i - 1].high && b[i - 1].low - x.low > 0 ? b[i - 1].low - x.low : 0) : 0));
    const a = rma(tr(b), 14), p = rma(pdm, 14).map((x, i) => (100 * x) / a[i]), n = rma(ndm, 14).map((x, i) => (100 * x) / a[i]);
    const adx = rma(p.map((x, i) => (100 * Math.abs(x - n[i])) / (x + n[i] || 1)), 14); return p.map((x, i) => (adx[i] > 20 ? sgn(x - n[i]) : 0)); },
  'Ichimoku (เหนือเมฆ)': (b, c) => { const mid = (i, p) => (hi(b, i, p) + lo(b, i, p)) / 2;
    return c.map((x, i) => { if (i < 78) return 0; const ten = mid(i, 9), kij = mid(i, 26), sa = (mid(i - 26, 9) + mid(i - 26, 26)) / 2, sb = mid(i - 26, 52);
      return x > Math.max(sa, sb) && ten > kij ? 1 : x < Math.min(sa, sb) && ten < kij ? -1 : 0; }); },
  'CCI 20 (±100)': (b, c) => { const tp = b.map((x) => (x.high + x.low + x.close) / 3), m = sma(tp, 20);
    return latch(tp.map((x, i) => { if (i < 20) return 0; let md = 0; for (let k = 0; k < 20; k++) md += Math.abs(tp[i - k] - m[i]); const v = (x - m[i]) / (0.015 * (md / 20) || 1); return v > 100 ? 1 : v < -100 ? -1 : 0; })); },
  'Williams %R 14 (กลับตัว)': (b, c) => { const w = c.map((x, i) => { const h = hi(b, i, 14), l = lo(b, i, 14); return h === l ? -50 : ((h - x) / (h - l)) * -100; });
    return latch(w.map((x, i) => (i && w[i - 1] < -80 && x >= -80 ? 1 : i && w[i - 1] > -20 && x <= -20 ? -1 : 0))); },
  'Aroon 25': (b) => b.map((x, i) => { if (i < 25) return 0; let ih = i, il = i; for (let k = i - 25; k <= i; k++) { if (b[k].high >= b[ih].high) ih = k; if (b[k].low <= b[il].low) il = k; }
    const up = ((25 - (i - ih)) / 25) * 100, dn = ((25 - (i - il)) / 25) * 100; return up > 70 && dn < 30 ? 1 : dn > 70 && up < 30 ? -1 : 0; }),
  'Heikin Ashi (2 แท่ง)': (b) => { let ho = b[0].open, hc = b[0].close; const col = b.map((x, i) => { const c2 = (x.open + x.high + x.low + x.close) / 4, o2 = i ? (ho + hc) / 2 : x.open; ho = o2; hc = c2; return sgn(c2 - o2); });
    return col.map((x, i) => (i && x === col[i - 1] ? x : 0)); },
  'Hull MA 20 (ทิศ)': (b, c) => { const h = wma(wma(c, 10).map((x, i) => 2 * x - wma(c, 20)[i]), 4); return h.map((x, i) => (i ? sgn(x - h[i - 1]) : 0)); },
  'TRIX 15': (b, c) => { const t = ema(ema(ema(c, 15), 15), 15); return t.map((x, i) => (i ? sgn(x - t[i - 1]) : 0)); },
  'ROC 12 (โมเมนตัม)': (b, c) => c.map((x, i) => (i < 12 ? 0 : sgn(x - c[i - 12]))),
  'Awesome Oscillator': (b) => { const m = b.map((x) => (x.high + x.low) / 2), a = sma(m, 5), z = sma(m, 34); return a.map((x, i) => sgn(x - z[i])); },
  'Chandelier Exit 22/3': (b, c) => { const a = rma(tr(b), 22); return latch(c.map((x, i) => (i < 22 ? 0 : x > lo(b, i - 1, 22) + 3 * a[i] && x > hi(b, i - 1, 22) - 3 * a[i] ? 1 : x < hi(b, i - 1, 22) - 3 * a[i] ? -1 : 0))); },
  'Linear Regression 20 (ความชัน)': (b, c) => c.map((x, i) => { if (i < 20) return 0; let sx = 0, sy = 0, sxy = 0, sxx = 0; for (let k = 0; k < 20; k++) { const y = c[i - 19 + k]; sx += k; sy += y; sxy += k * y; sxx += k * k; } return sgn(20 * sxy - sx * sy); }),
  'Connors RSI-2 (+EMA200)': (b, c) => { const r = rsi(c, 2), z = sma(c, 200); return c.map((x, i) => (i < 200 ? 0 : x > z[i] && r[i] < 10 ? 1 : x < z[i] && r[i] > 90 ? -1 : 0)); },
  'Vortex 14': (b) => { const vp = b.map((x, i) => (i ? Math.abs(x.high - b[i - 1].low) : 0)), vm = b.map((x, i) => (i ? Math.abs(x.low - b[i - 1].high) : 0)), t = tr(b);
    const s = (v, i) => { let z = 0; for (let k = 0; k < 14; k++) z += v[i - k]; return z; }; return b.map((x, i) => (i < 15 ? 0 : sgn(s(vp, i) - s(vm, i)))); },
  'EMA 8/21/55 เรียงตัว': (b, c) => { const a = ema(c, 8), m = ema(c, 21), z = ema(c, 55); return a.map((x, i) => (x > m[i] && m[i] > z[i] ? 1 : x < m[i] && m[i] < z[i] ? -1 : 0)); },
};
// MACD returns the raw line − signal: turn it into a state
const _m = IND['MACD 12/26/9'];
IND['MACD 12/26/9'] = (b, c) => { const m = ema(c, 12).map((x, i, a) => x), s26 = ema(c, 26), line = m.map((x, i) => x - s26[i]), sig = ema(line, 9); return line.map((x, i) => sgn(x - sig[i])); };
module.exports = { IND };
