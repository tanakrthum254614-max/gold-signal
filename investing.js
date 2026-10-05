// Turns investing.com technical analysis into a plain-Thai BUY / SELL / WAIT recommendation
(function (root) {
  const SUMMARY_TH = {
    strong_buy: 'ซื้อแรง', buy: 'ซื้อ', neutral: 'เป็นกลาง', sell: 'ขาย', strong_sell: 'ขายแรง',
  };
  const TREND_TH = {
    strong_buy: 'ขาขึ้นแรง', buy: 'ขาขึ้น', neutral: 'แกว่งตัว ยังไม่ชัด', sell: 'ขาลง', strong_sell: 'ขาลงแรง',
  };
  const ACTION_TH = {
    Buy: 'ซื้อ', Sell: 'ขาย', Neutral: 'เป็นกลาง', Overbought: 'ซื้อมากเกินไป', Oversold: 'ขายมากเกินไป',
    'Less Volatility': 'ผันผวนต่ำ', 'High Volatility': 'ผันผวนสูง',
  };
  const INDICATOR_NAME = {
    rsi: 'RSI(14)', stoch: 'STOCH(9,6)', stochrsi: 'STOCHRSI(14)', macd: 'MACD(12,26)', adx: 'ADX(14)',
    williamsR: 'Williams %R', cci: 'CCI(14)', atr: 'ATR(14)', hl: 'Highs/Lows(14)', uo: 'Ultimate Oscillator',
    roc: 'ROC', bullBear: 'Bull/Bear Power(13)',
  };
  // What each indicator measures, in plain words
  const INDICATOR_ABOUT = {
    rsi: 'วัดแรงซื้อเทียบแรงขาย (0–100)',
    stoch: 'ราคาอยู่ตรงไหนของช่วงขึ้นลงล่าสุด (0–100)',
    stochrsi: 'ความเร็วของแรงซื้อ-ขาย (0–100)',
    macd: 'แรงส่งของราคา',
    adx: 'ความแรงของแนวโน้ม',
    williamsR: 'ราคาใกล้จุดสูงหรือจุดต่ำของช่วงล่าสุด (−100 ถึง 0)',
    cci: 'ราคาห่างจากค่าปกติแค่ไหน',
    atr: 'ราคาแกว่งเฉลี่ยต่อแท่ง (ดอลลาร์)',
    hl: 'ทำจุดสูงใหม่หรือจุดต่ำใหม่',
    uo: 'แรงซื้อ-ขายรวมหลายช่วงเวลา (0–100)',
    roc: 'ราคาเปลี่ยนไปกี่ % จากช่วงก่อน',
    bullBear: 'ฝั่งผู้ซื้อ (กระทิง) หรือผู้ขาย (หมี) แรงกว่า',
  };
  const PIVOT_KEYS = [['r3', 'R3'], ['r2', 'R2'], ['r1', 'R1'], ['pivot', 'P'], ['s1', 'S1'], ['s2', 'S2'], ['s3', 'S3']];
  const PIVOT_TH = { R3: 'แนวต้าน 3', R2: 'แนวต้าน 2', R1: 'แนวต้าน 1', P: 'จุดกึ่งกลาง', S1: 'แนวรับ 1', S2: 'แนวรับ 2', S3: 'แนวรับ 3' };

  // "_Currencies_Strong_Sell" / "_moving_avarge_tool_sell" / "strong_sell" -> "strong_sell"
  const norm = (v) => String(v || '').toLowerCase().replace(/^_(currencies|moving_avarge_tool)_/, '').replace(/^_/, '');
  const dirOf = (s) => (s.includes('buy') ? 1 : s.includes('sell') ? -1 : 0);
  const summaryTh = (v) => SUMMARY_TH[norm(v)] || v;
  const trendTh = (v) => TREND_TH[norm(v)] || v;
  const actionTh = (a) => ACTION_TH[a] || a;
  const actionDir = (a) => (a === 'Buy' || a === 'Oversold' ? 1 : a === 'Sell' || a === 'Overbought' ? -1 : 0);
  const money = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pivotName = (n) => `${PIVOT_TH[n] || n} (${n})`;

  // Plain-Thai reading of one indicator value
  function meaning(key, value, action) {
    const v = parseFloat(value);
    switch (key) {
      case 'rsi':
        if (v > 70) return 'ราคาขึ้นมาแรงเกินไป เสี่ยงย่อตัวลง';
        if (v >= 55) return 'แรงซื้อมากกว่าแรงขาย';
        if (v > 45) return 'แรงซื้อและแรงขายพอ ๆ กัน';
        if (v >= 30) return 'แรงขายมากกว่าแรงซื้อ';
        return 'ราคาลงมาแรงเกินไป อาจเด้งกลับ';
      case 'stoch': case 'stochrsi':
        if (v > 80) return 'อยู่ใกล้จุดสูงสุดของช่วง (ขึ้นมาเยอะแล้ว)';
        if (v < 20) return 'อยู่ใกล้จุดต่ำสุดของช่วง (ลงมาเยอะแล้ว)';
        return v >= 50 ? 'อยู่ครึ่งบนของช่วง' : 'อยู่ครึ่งล่างของช่วง';
      case 'macd':
        return v >= 0 ? 'แรงส่งเป็นขาขึ้น' : 'แรงส่งเป็นขาลง';
      case 'adx': {
        const side = action === 'Buy' ? ' ไปทางขาขึ้น' : action === 'Sell' ? ' ไปทางขาลง' : '';
        if (v < 20) return 'ไม่มีแนวโน้มชัด ราคาแกว่งไปมา';
        if (v < 25) return `เริ่มมีแนวโน้ม${side}`;
        return `แนวโน้มแข็งแรง${side}`;
      }
      case 'williamsR':
        if (v > -20) return 'ใกล้จุดสูงสุด ซื้อกันมากเกินไป';
        if (v < -80) return 'ใกล้จุดต่ำสุด ขายกันมากเกินไป';
        return 'อยู่กลาง ๆ ของช่วง';
      case 'cci':
        if (v > 100) return 'ราคาสูงกว่าปกติมาก';
        if (v < -100) return 'ราคาต่ำกว่าปกติมาก';
        return 'ราคาใกล้ระดับปกติ';
      case 'atr':
        return `แกว่งเฉลี่ยแท่งละ ~$${v.toFixed(2)} (${actionTh(action)})`;
      case 'hl':
        return v >= 0 ? 'ทำจุดสูงใหม่ได้ (แข็งแรง)' : 'ทำจุดต่ำใหม่ (อ่อนแอ)';
      case 'uo':
        if (v > 70) return 'แรงซื้อมากเกินไป';
        if (v < 30) return 'แรงขายมากเกินไป';
        return v >= 50 ? 'เอนไปทางผู้ซื้อ' : 'เอนไปทางผู้ขาย';
      case 'roc':
        return v >= 0 ? `ราคาขึ้นมา ${v.toFixed(2)}% จากช่วงก่อน` : `ราคาลดลง ${Math.abs(v).toFixed(2)}% จากช่วงก่อน`;
      case 'bullBear':
        return v >= 0 ? 'ผู้ซื้อ (กระทิง) แรงกว่า' : 'ผู้ขาย (หมี) แรงกว่า';
      default:
        return actionTh(action);
    }
  }

  function indicators(t) {
    return Object.entries(t.indicators)
      .filter(([k]) => k !== 'summary')
      .map(([k, v]) => ({
        key: k, name: INDICATOR_NAME[k] || k, about: INDICATOR_ABOUT[k] || '',
        value: v.value, action: v.action, th: actionTh(v.action), meaning: meaning(k, v.value, v.action),
      }));
  }

  function movingAverages(t) {
    const rows = [];
    for (const p of [5, 10, 20, 50, 100, 200]) {
      const s = t.movingAverages.simple, e = t.movingAverages.exponential;
      rows.push({
        period: p,
        sma: s[`SMA${p}`], smaAction: s[`MA${p}BS`],
        ema: e[`EMA${p}`], emaAction: e[`MA${p}BS`],
      });
    }
    return rows;
  }

  function pivots(t) {
    return PIVOT_KEYS.map(([k, name]) => ({ name, label: pivotName(name), price: parseFloat(t.pivotPoints[k]) }))
      .filter((x) => !isNaN(x.price));
  }

  function overview(t) {
    const ma = t.movingAverages.summary, ind = t.indicators.summary;
    return {
      summary: norm(t.summary), summaryTh: summaryTh(t.summary), trendTh: trendTh(t.summary),
      ma: { key: norm(ma.value), th: summaryTh(ma.value), buy: ma.buy, sell: ma.sell },
      ind: { key: norm(ind.value), th: summaryTh(ind.value), buy: ind.buy, sell: ind.sell, neutral: ind.neutral },
    };
  }

  // t = selected timeframe analysis, ht = next larger timeframe
  function decide(t, ht, price, tfLabel, htfLabel) {
    const s = norm(t.summary), dir = dirOf(s), strong = s.startsWith('strong');
    const hs = ht ? norm(ht.summary) : null, hdir = hs ? dirOf(hs) : 0;
    const ind = t.indicators, ov = overview(t);
    const atr = parseFloat(ind.atr && ind.atr.value) || null;
    const rsi = parseFloat(ind.rsi && ind.rsi.value);
    const pv = pivots(t);
    const reasons = [], warn = [];
    const totalInd = ov.ind.buy + ov.ind.sell + ov.ind.neutral;

    reasons.push(`investing.com สรุปกราฟ ${tfLabel} ว่า “${ov.summaryTh}”`);
    if (dir !== 0) {
      reasons.push(dir > 0
        ? `ราคาอยู่เหนือเส้นค่าเฉลี่ย ${ov.ma.buy} จาก 12 เส้น → ราคากำลังแข็งแรง`
        : `ราคาอยู่ต่ำกว่าเส้นค่าเฉลี่ย ${ov.ma.sell} จาก 12 เส้น → ราคากำลังอ่อนตัว`);
      reasons.push(`ตัวชี้วัด ${dir > 0 ? ov.ind.buy : ov.ind.sell} จาก ${totalInd} ตัวบอกว่า “${dir > 0 ? 'ซื้อ' : 'ขาย'}”`);
      if (hdir === dir) reasons.push(`กราฟกรอบใหญ่ (${htfLabel}) ก็บอก “${summaryTh(hs)}” → แนวโน้มไปทางเดียวกัน`);
      for (const k of ['macd', 'adx', 'rsi']) {
        const v = ind[k];
        if (v && actionDir(v.action) === dir) reasons.push(`${INDICATOR_NAME[k]}: ${meaning(k, v.value, v.action)}`);
      }
    }

    if (dir === 0) warn.push('ตัวชี้วัดยังขัดแย้งกัน ตลาดยังไม่เลือกว่าจะขึ้นหรือลง');
    if (dir !== 0 && hdir === -dir) warn.push(`สวนทางกับแนวโน้มใหญ่ (กราฟ ${htfLabel} บอก “${summaryTh(hs)}”) มีโอกาสโดนลากกลับ`);
    if (dir !== 0 && !strong && hdir !== dir) warn.push(`สัญญาณยังไม่แรงพอ และกราฟกรอบใหญ่ (${htfLabel}) ยังไม่ยืนยัน`);
    if (dir > 0 && rsi > 70) warn.push(`ราคาขึ้นมาแรงเกินไปแล้ว (RSI ${rsi.toFixed(0)}) ซื้อตอนนี้เสี่ยงซื้อที่ยอด รอให้ราคาย่อลงก่อน`);
    if (dir < 0 && rsi < 30) warn.push(`ราคาลงมาแรงเกินไปแล้ว (RSI ${rsi.toFixed(0)}) ขายตอนนี้เสี่ยงขายที่ก้น รอให้ราคาเด้งก่อน`);
    const wr = ind.williamsR && ind.williamsR.action;
    if (dir > 0 && wr === 'Overbought') warn.push('ราคาขึ้นมาใกล้จุดสูงสุดของช่วงแล้ว (Williams %R) อาจย่อตัวก่อนไปต่อ');
    if (dir < 0 && wr === 'Oversold') warn.push('ราคาลงมาใกล้จุดต่ำสุดของช่วงแล้ว (Williams %R) อาจเด้งก่อนลงต่อ');

    const above = pv.filter((x) => x.price > price).sort((a, b) => a.price - b.price);
    const below = pv.filter((x) => x.price < price).sort((a, b) => b.price - a.price);
    if (atr && dir > 0 && above[0] && above[0].price - price < atr * 0.3)
      warn.push(`ราคาใกล้${above[0].label} ที่ ${money(above[0].price)} มาก ราคามักถูกกดลงตรงนี้ ซื้อตอนนี้เสี่ยง`);
    if (atr && dir < 0 && below[0] && price - below[0].price < atr * 0.3)
      warn.push(`ราคาใกล้${below[0].label} ที่ ${money(below[0].price)} มาก ราคามักเด้งขึ้นตรงนี้ ขายตอนนี้เสี่ยง`);

    const action = dir === 0 || warn.length ? 'WAIT' : dir > 0 ? 'BUY' : 'SELL';
    const agreeRatio = dir === 0 ? 0 : (dir > 0 ? ov.ind.buy + ov.ma.buy : ov.ind.sell + ov.ma.sell) / 22;
    let confidence = Math.round(35 + (strong ? 25 : dir ? 10 : 0) + (hdir === dir && dir ? 20 : 0) + agreeRatio * 15 - warn.length * 12);
    confidence = Math.max(10, Math.min(95, confidence));

    const plan = { action, confidence, reasons, warn, atr, summary: s, dir, pivots: pv };
    if (atr) {
      if (action !== 'WAIT') {
        // Targets: pivot levels in the trade direction, falling back to ATR multiples
        const ahead = (dir > 0 ? above : below).filter((x) => Math.abs(x.price - price) >= atr * 0.5);
        plan.entry = price;
        plan.sl = price - dir * atr * 1.5;
        plan.tp1 = ahead[0] ? ahead[0].price : price + dir * atr * 1.5;
        plan.tp2 = ahead[1] ? ahead[1].price : plan.tp1 + dir * atr * 1.5;
        plan.tp1Name = ahead[0] ? ahead[0].label : '1.5 เท่าของ ATR';
        plan.tp2Name = ahead[1] ? ahead[1].label : '3 เท่าของ ATR';
      }
      plan.buyZone = below[0] ? { name: below[0].label, price: below[0].price } : null;
      plan.sellZone = above[0] ? { name: above[0].label, price: above[0].price } : null;
    }
    return plan;
  }

  const INV = { norm, dirOf, summaryTh, trendTh, actionTh, actionDir, meaning, indicators, movingAverages, pivots, overview, decide, PIVOT_TH };
  if (typeof module !== 'undefined' && module.exports) module.exports = INV;
  else root.INV = INV;
})(typeof window !== 'undefined' ? window : globalThis);
