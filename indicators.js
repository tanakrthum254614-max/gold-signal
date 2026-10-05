// Technical indicators + signal engine (pure functions, runs in browser and Node)
(function (root) {
  const nulls = (n) => new Array(n).fill(null);

  function sma(values, p) {
    const out = nulls(values.length);
    for (let i = p - 1; i < values.length; i++) {
      let sum = 0, ok = true;
      for (let j = i - p + 1; j <= i; j++) {
        if (values[j] == null) { ok = false; break; }
        sum += values[j];
      }
      if (ok) out[i] = sum / p;
    }
    return out;
  }

  // EMA seeded with SMA; skips leading nulls so it can be chained (e.g. MACD signal)
  function ema(values, p) {
    const out = nulls(values.length);
    const first = values.findIndex((v) => v != null);
    if (first < 0 || values.length - first < p) return out;
    const k = 2 / (p + 1);
    let prev = 0;
    for (let j = first; j < first + p; j++) prev += values[j];
    prev /= p;
    out[first + p - 1] = prev;
    for (let i = first + p; i < values.length; i++) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  function rsi(close, p = 14) {
    const out = nulls(close.length);
    if (close.length <= p) return out;
    let gain = 0, loss = 0;
    for (let i = 1; i <= p; i++) {
      const d = close[i] - close[i - 1];
      if (d > 0) gain += d; else loss -= d;
    }
    gain /= p; loss /= p;
    out[p] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    for (let i = p + 1; i < close.length; i++) {
      const d = close[i] - close[i - 1];
      gain = (gain * (p - 1) + Math.max(d, 0)) / p;
      loss = (loss * (p - 1) + Math.max(-d, 0)) / p;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
    return out;
  }

  function macd(close, fast = 12, slow = 26, sig = 9) {
    const f = ema(close, fast), s = ema(close, slow);
    const line = close.map((_, i) => (f[i] != null && s[i] != null ? f[i] - s[i] : null));
    const signal = ema(line, sig);
    const hist = line.map((v, i) => (v != null && signal[i] != null ? v - signal[i] : null));
    return { line, signal, hist };
  }

  function bollinger(close, p = 20, mult = 2) {
    const mid = sma(close, p);
    const upper = nulls(close.length), lower = nulls(close.length);
    for (let i = p - 1; i < close.length; i++) {
      let v = 0;
      for (let j = i - p + 1; j <= i; j++) v += (close[j] - mid[i]) ** 2;
      const sd = Math.sqrt(v / p);
      upper[i] = mid[i] + mult * sd;
      lower[i] = mid[i] - mult * sd;
    }
    return { mid, upper, lower };
  }

  function trueRange(h, l, c) {
    return h.map((_, i) => (i === 0 ? h[0] - l[0]
      : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))));
  }

  function atr(h, l, c, p = 14) {
    const tr = trueRange(h, l, c);
    const out = nulls(c.length);
    if (c.length < p) return out;
    let prev = 0;
    for (let i = 0; i < p; i++) prev += tr[i];
    prev /= p;
    out[p - 1] = prev;
    for (let i = p; i < c.length; i++) {
      prev = (prev * (p - 1) + tr[i]) / p;
      out[i] = prev;
    }
    return out;
  }

  function stochastic(h, l, c, p = 14, smoothK = 3, smoothD = 3) {
    const raw = nulls(c.length);
    for (let i = p - 1; i < c.length; i++) {
      let hh = -Infinity, ll = Infinity;
      for (let j = i - p + 1; j <= i; j++) { hh = Math.max(hh, h[j]); ll = Math.min(ll, l[j]); }
      raw[i] = hh === ll ? 50 : ((c[i] - ll) / (hh - ll)) * 100;
    }
    const k = sma(raw, smoothK);
    return { k, d: sma(k, smoothD) };
  }

  // Wilder's ADX with +DI / -DI
  function adx(h, l, c, p = 14) {
    const n = c.length;
    const out = { adx: nulls(n), plusDI: nulls(n), minusDI: nulls(n) };
    if (n < p * 2 + 1) return out;
    const tr = trueRange(h, l, c);
    let sTR = 0, sP = 0, sM = 0;
    const dx = nulls(n);
    for (let i = 1; i < n; i++) {
      const up = h[i] - h[i - 1], down = l[i - 1] - l[i];
      const pdm = up > down && up > 0 ? up : 0;
      const mdm = down > up && down > 0 ? down : 0;
      if (i <= p) {
        sTR += tr[i]; sP += pdm; sM += mdm;
        if (i < p) continue;
      } else {
        sTR = sTR - sTR / p + tr[i];
        sP = sP - sP / p + pdm;
        sM = sM - sM / p + mdm;
      }
      const pdi = sTR ? (100 * sP) / sTR : 0, mdi = sTR ? (100 * sM) / sTR : 0;
      out.plusDI[i] = pdi; out.minusDI[i] = mdi;
      dx[i] = pdi + mdi ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0;
    }
    let prev = 0;
    for (let i = p; i < p * 2; i++) prev += dx[i];
    prev /= p;
    out.adx[p * 2 - 1] = prev;
    for (let i = p * 2; i < n; i++) {
      prev = (prev * (p - 1) + dx[i]) / p;
      out.adx[i] = prev;
    }
    return out;
  }

  // Classic floor pivots from a completed candle (normally yesterday's daily bar)
  function pivots(bar) {
    const P = (bar.high + bar.low + bar.close) / 3, range = bar.high - bar.low;
    return { R2: P + range, R1: 2 * P - bar.low, P, S1: 2 * P - bar.high, S2: P - range };
  }

  // Swing highs/lows: bar whose high/low is the extreme of `w` bars on both sides
  function swings(candles, w = 3, lookback = 150) {
    const highs = [], lows = [];
    const start = Math.max(w, candles.length - lookback);
    for (let i = start; i < candles.length - w; i++) {
      let isH = true, isL = true;
      for (let j = i - w; j <= i + w; j++) {
        if (j === i) continue;
        if (candles[j].high >= candles[i].high) isH = false;
        if (candles[j].low <= candles[i].low) isL = false;
      }
      if (isH) highs.push(candles[i].high);
      if (isL) lows.push(candles[i].low);
    }
    return { highs, lows };
  }

  function computeAll(candles) {
    const o = candles.map((x) => x.open), h = candles.map((x) => x.high);
    const l = candles.map((x) => x.low), c = candles.map((x) => x.close);
    return {
      close: c, high: h, low: l, open: o,
      ema20: ema(c, 20), ema50: ema(c, 50), ema200: ema(c, 200),
      rsi: rsi(c, 14), macd: macd(c), bb: bollinger(c), atr: atr(h, l, c),
      stoch: stochastic(h, l, c), adx: adx(h, l, c),
    };
  }

  const fmt = (v, d = 2) => (v == null ? '-' : v.toFixed(d));

  // One vote per indicator at bar i: +1 buy, -1 sell, 0 neutral
  function votesAt(ind, i) {
    const c = ind.close[i];
    const v = [];
    const add = (name, value, signal, why) => v.push({ name, value, signal, why });

    for (const [key, label] of [['ema20', 'EMA 20'], ['ema50', 'EMA 50'], ['ema200', 'EMA 200']]) {
      const e = ind[key][i];
      if (e == null) continue;
      add(label, fmt(e), c > e ? 1 : -1, c > e ? `ราคาอยู่เหนือ ${label}` : `ราคาอยู่ใต้ ${label}`);
    }
    if (ind.ema20[i] != null && ind.ema50[i] != null) {
      const up = ind.ema20[i] > ind.ema50[i];
      add('EMA 20/50', up ? 'Golden' : 'Death', up ? 1 : -1,
        up ? 'EMA20 อยู่เหนือ EMA50 (แนวโน้มขาขึ้น)' : 'EMA20 อยู่ใต้ EMA50 (แนวโน้มขาลง)');
    }
    const r = ind.rsi[i];
    if (r != null) {
      let s = 0, why = 'RSI เป็นกลาง';
      if (r < 30) { s = 1; why = 'RSI ต่ำกว่า 30 (Oversold) มีโอกาสเด้ง'; }
      else if (r > 70) { s = -1; why = 'RSI สูงกว่า 70 (Overbought) เสี่ยงย่อตัว'; }
      else if (r >= 55) { s = 1; why = 'RSI > 55 แรงซื้อเหนือกว่า'; }
      else if (r <= 45) { s = -1; why = 'RSI < 45 แรงขายเหนือกว่า'; }
      add('RSI (14)', fmt(r, 1), s, why);
    }
    const m = ind.macd;
    if (m.hist[i] != null) {
      const up = m.hist[i] > 0;
      const rising = i > 0 && m.hist[i - 1] != null && m.hist[i] > m.hist[i - 1];
      add('MACD (12,26,9)', fmt(m.line[i]), up ? 1 : -1,
        (up ? 'MACD ตัดขึ้นเหนือ Signal' : 'MACD อยู่ใต้ Signal') + (rising ? ' · โมเมนตัมเพิ่มขึ้น' : ' · โมเมนตัมลดลง'));
    }
    const k = ind.stoch.k[i], d = ind.stoch.d[i];
    if (k != null && d != null) {
      let s = 0, why = 'Stochastic เป็นกลาง';
      if (k < 20 && k > d) { s = 1; why = 'Stochastic ต่ำกว่า 20 และตัดขึ้น'; }
      else if (k > 80 && k < d) { s = -1; why = 'Stochastic สูงกว่า 80 และตัดลง'; }
      else if (k < 20) why = 'Stochastic Oversold (รอตัดขึ้น)';
      else if (k > 80) why = 'Stochastic Overbought (รอตัดลง)';
      add('Stoch (14,3)', fmt(k, 1), s, why);
    }
    const bb = ind.bb;
    if (bb.mid[i] != null) {
      let s = 0, why = 'ราคาอยู่ในกรอบ Bollinger';
      if (c < bb.lower[i]) { s = 1; why = 'ราคาหลุดขอบล่าง Bollinger (ถูกเกินไป)'; }
      else if (c > bb.upper[i]) { s = -1; why = 'ราคาทะลุขอบบน Bollinger (แพงเกินไป)'; }
      add('Bollinger (20,2)', `${fmt(bb.lower[i])} – ${fmt(bb.upper[i])}`, s, why);
    }
    const a = ind.adx.adx[i];
    if (a != null) {
      const bull = ind.adx.plusDI[i] > ind.adx.minusDI[i];
      const s = a >= 25 ? (bull ? 1 : -1) : 0;
      add('ADX (14)', fmt(a, 1), s,
        a >= 25 ? `เทรนด์แข็งแรง (${bull ? '+DI นำ' : '-DI นำ'})` : 'เทรนด์อ่อน / ไซด์เวย์');
    }
    return v;
  }

  function scoreLabel(score) {
    if (score >= 0.5) return { key: 'strong-buy', th: 'ซื้อแรง' };
    if (score >= 0.15) return { key: 'buy', th: 'ซื้อ' };
    if (score <= -0.5) return { key: 'strong-sell', th: 'ขายแรง' };
    if (score <= -0.15) return { key: 'sell', th: 'ขาย' };
    return { key: 'neutral', th: 'เป็นกลาง' };
  }

  function analyzeAt(ind, i) {
    const votes = votesAt(ind, i);
    const sum = votes.reduce((s, x) => s + x.signal, 0);
    const score = votes.length ? sum / votes.length : 0;
    return {
      votes, score, label: scoreLabel(score),
      buys: votes.filter((x) => x.signal > 0).length,
      sells: votes.filter((x) => x.signal < 0).length,
      neutrals: votes.filter((x) => x.signal === 0).length,
    };
  }

  function analyze(candles) {
    const ind = computeAll(candles);
    return { ind, ...analyzeAt(ind, candles.length - 1) };
  }

  // Bars where the score crosses into strong buy / strong sell -> chart markers
  function signalHistory(ind, minIndex = 200) {
    const out = [];
    let prev = 0;
    for (let i = Math.max(1, minIndex); i < ind.close.length; i++) {
      const s = analyzeAt(ind, i).score;
      const state = s >= 0.5 ? 1 : s <= -0.5 ? -1 : 0;
      if (state !== 0 && state !== prev) out.push({ index: i, dir: state });
      if (state !== 0) prev = state;
    }
    return out;
  }

  // Merges levels closer than `tol` (pivots win over swings) so the list stays readable
  function levels(candles, dailyPrev, tol = 0) {
    const list = [];
    if (dailyPrev) {
      const pv = pivots(dailyPrev);
      for (const [k, v] of Object.entries(pv)) list.push({ name: `Pivot ${k}`, price: v });
    }
    const sw = swings(candles);
    sw.highs.slice(-4).forEach((p) => list.push({ name: 'Swing High', price: p }));
    sw.lows.slice(-4).forEach((p) => list.push({ name: 'Swing Low', price: p }));
    const kept = [];
    for (const lv of list) {
      if (!kept.some((k) => Math.abs(k.price - lv.price) < tol)) kept.push(lv);
    }
    return kept.sort((a, b) => b.price - a.price);
  }

  // Final recommendation: BUY / SELL / WAIT with entry, stop and targets
  function decide(main, higher, price, lvls) {
    const i = main.ind.close.length - 1;
    const atrV = main.ind.atr[i];
    const r = main.ind.rsi[i];
    const adxV = main.ind.adx.adx[i];
    const s = main.score, hs = higher ? higher.score : 0;
    const dir = s >= 0.15 ? 1 : s <= -0.15 ? -1 : 0;
    const res = lvls.filter((x) => x.price > price).sort((a, b) => a.price - b.price)[0];
    const sup = lvls.filter((x) => x.price < price).sort((a, b) => b.price - a.price)[0];
    const reasons = [];
    const warn = [];

    main.votes.filter((v) => v.signal !== 0 && Math.sign(v.signal) === dir).slice(0, 5)
      .forEach((v) => reasons.push(v.why));

    if (dir === 0) warn.push('สัญญาณตัวชี้วัดขัดแย้งกัน ตลาดยังไม่เลือกทาง');
    if (higher && dir !== 0 && Math.sign(hs) === -dir && Math.abs(hs) >= 0.15)
      warn.push(`สวนแนวโน้มของ Timeframe ใหญ่ (${higher.label.th})`);
    if (dir > 0 && r > 72) warn.push(`RSI ${r.toFixed(0)} Overbought — ไม่ควรไล่ซื้อ รอราคาย่อก่อน`);
    if (dir < 0 && r < 28) warn.push(`RSI ${r.toFixed(0)} Oversold — ไม่ควรไล่ขาย รอราคาเด้งก่อน`);
    if (adxV != null && adxV < 18 && Math.abs(s) < 0.5) warn.push(`ADX ${adxV.toFixed(0)} เทรนด์อ่อนมาก เสี่ยงโดนหลอก`);
    if (atrV && dir > 0 && res && res.price - price < atrV * 0.5)
      warn.push(`ใกล้แนวต้าน ${res.name} (${res.price.toFixed(2)}) เกินไป`);
    if (atrV && dir < 0 && sup && price - sup.price < atrV * 0.5)
      warn.push(`ใกล้แนวรับ ${sup.name} (${sup.price.toFixed(2)}) เกินไป`);

    const action = dir === 0 || warn.length ? 'WAIT' : dir > 0 ? 'BUY' : 'SELL';
    const agree = higher && Math.sign(hs) === dir && Math.abs(hs) >= 0.15;
    let confidence = Math.round(45 + Math.abs(s) * 35 + (agree ? 15 : 0) - warn.length * 10);
    confidence = Math.max(10, Math.min(95, confidence));

    const plan = { action, confidence, reasons, warn, atr: atrV, support: sup, resistance: res };
    if (atrV) {
      const d = action === 'SELL' ? -1 : 1;
      if (action !== 'WAIT') {
        plan.entry = price;
        plan.sl = price - d * atrV * 1.5;
        plan.tp1 = price + d * atrV * 1.5;
        plan.tp2 = price + d * atrV * 3;
      }
      // Zones to watch while waiting
      plan.buyZone = sup ? sup.price : price - atrV * 2;
      plan.sellZone = res ? res.price : price + atrV * 2;
    }
    return plan;
  }

  const TA = { sma, ema, rsi, macd, bollinger, atr, stochastic, adx, pivots, swings,
    computeAll, votesAt, analyzeAt, analyze, scoreLabel, signalHistory, levels, decide };
  if (typeof module !== 'undefined' && module.exports) module.exports = TA;
  else root.TA = TA;
})(typeof window !== 'undefined' ? window : globalThis);
