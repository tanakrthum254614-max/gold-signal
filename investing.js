// Turns investing.com technical analysis into a Thai BUY / SELL / WAIT recommendation
(function (root) {
  const SUMMARY_TH = {
    strong_buy: 'ซื้อแรง', buy: 'ซื้อ', neutral: 'เป็นกลาง', sell: 'ขาย', strong_sell: 'ขายแรง',
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
  const PIVOT_KEYS = [['r3', 'R3'], ['r2', 'R2'], ['r1', 'R1'], ['pivot', 'P'], ['s1', 'S1'], ['s2', 'S2'], ['s3', 'S3']];

  // "_Currencies_Strong_Sell" / "strong_sell" -> "strong_sell"
  const norm = (v) => String(v || '').toLowerCase().replace(/^_(currencies|moving_avarge_tool)_/, '').replace(/^_/, '');
  const dirOf = (s) => (s.includes('buy') ? 1 : s.includes('sell') ? -1 : 0);
  const summaryTh = (v) => SUMMARY_TH[norm(v)] || v;
  const actionTh = (a) => ACTION_TH[a] || a;
  const actionDir = (a) => (a === 'Buy' || a === 'Oversold' ? 1 : a === 'Sell' || a === 'Overbought' ? -1 : 0);

  function indicators(t) {
    return Object.entries(t.indicators)
      .filter(([k]) => k !== 'summary')
      .map(([k, v]) => ({ key: k, name: INDICATOR_NAME[k] || k, value: v.value, action: v.action, th: actionTh(v.action) }));
  }

  function movingAverages(t) {
    const rows = [];
    for (const p of [5, 10, 20, 50, 100, 200]) {
      const s = t.movingAverages.simple, e = t.movingAverages.exponential;
      rows.push({
        period: `MA${p}`,
        sma: s[`SMA${p}`], smaAction: s[`MA${p}BS`],
        ema: e[`EMA${p}`], emaAction: e[`MA${p}BS`],
      });
    }
    return rows;
  }

  function pivots(t) {
    return PIVOT_KEYS.map(([k, name]) => ({ name, price: parseFloat(t.pivotPoints[k]) }))
      .filter((x) => !isNaN(x.price));
  }

  function overview(t) {
    const ma = t.movingAverages.summary, ind = t.indicators.summary;
    return {
      summary: norm(t.summary), summaryTh: summaryTh(t.summary),
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

    reasons.push(`investing.com สรุป ${tfLabel}: ${ov.summaryTh}`);
    if (dir !== 0) {
      reasons.push(`ค่าเฉลี่ยเคลื่อนที่: ซื้อ ${ov.ma.buy} / ขาย ${ov.ma.sell} (${ov.ma.th})`);
      reasons.push(`ตัวชี้วัด: ซื้อ ${ov.ind.buy} / ขาย ${ov.ind.sell} / กลาง ${ov.ind.neutral} (${ov.ind.th})`);
      if (hdir === dir) reasons.push(`Timeframe ใหญ่ (${htfLabel}) ไปทางเดียวกัน: ${summaryTh(hs)}`);
      for (const k of ['macd', 'adx', 'rsi']) {
        const v = ind[k];
        if (v && actionDir(v.action) === dir) reasons.push(`${INDICATOR_NAME[k]} = ${v.value} → ${actionTh(v.action)}`);
      }
    }

    if (dir === 0) warn.push('investing.com สรุปเป็นกลาง — ตลาดยังไม่เลือกทาง');
    if (dir !== 0 && hdir === -dir) warn.push(`สวนแนวโน้ม Timeframe ใหญ่ (${htfLabel}: ${summaryTh(hs)})`);
    if (dir !== 0 && !strong && hdir !== dir) warn.push(`สัญญาณยังไม่แรง และ ${htfLabel} ยังไม่ยืนยัน`);
    if (dir > 0 && rsi > 70) warn.push(`RSI ${rsi.toFixed(0)} Overbought — ไม่ควรไล่ซื้อ รอย่อ`);
    if (dir < 0 && rsi < 30) warn.push(`RSI ${rsi.toFixed(0)} Oversold — ไม่ควรไล่ขาย รอเด้ง`);
    const wr = ind.williamsR && ind.williamsR.action;
    if (dir > 0 && wr === 'Overbought') warn.push('Williams %R Overbought — ราคาขึ้นมาไกลแล้ว');
    if (dir < 0 && wr === 'Oversold') warn.push('Williams %R Oversold — ราคาลงมาไกลแล้ว');

    const above = pv.filter((x) => x.price > price).sort((a, b) => a.price - b.price);
    const below = pv.filter((x) => x.price < price).sort((a, b) => b.price - a.price);
    if (atr && dir > 0 && above[0] && above[0].price - price < atr * 0.3)
      warn.push(`ชนแนวต้าน ${above[0].name} (${above[0].price.toFixed(2)}) ใกล้เกินไป`);
    if (atr && dir < 0 && below[0] && price - below[0].price < atr * 0.3)
      warn.push(`ชนแนวรับ ${below[0].name} (${below[0].price.toFixed(2)}) ใกล้เกินไป`);

    const action = dir === 0 || warn.length ? 'WAIT' : dir > 0 ? 'BUY' : 'SELL';
    const agreeRatio = dir === 0 ? 0 : (dir > 0 ? ov.ind.buy + ov.ma.buy : ov.ind.sell + ov.ma.sell) / 22;
    let confidence = Math.round(35 + (strong ? 25 : dir ? 10 : 0) + (hdir === dir && dir ? 20 : 0) + agreeRatio * 15 - warn.length * 12);
    confidence = Math.max(10, Math.min(95, confidence));

    const plan = { action, confidence, reasons, warn, atr, summary: s, pivots: pv };
    if (atr) {
      if (action !== 'WAIT') {
        const d = dir;
        // Targets: pivot levels in the trade direction, falling back to ATR multiples
        const ahead = (d > 0 ? above : below).filter((x) => Math.abs(x.price - price) >= atr * 0.5);
        plan.entry = price;
        plan.sl = price - d * atr * 1.5;
        plan.tp1 = ahead[0] ? ahead[0].price : price + d * atr * 1.5;
        plan.tp2 = ahead[1] ? ahead[1].price : plan.tp1 + d * atr * 1.5;
        plan.tp1Name = ahead[0] ? ahead[0].name : '1.5 ATR';
        plan.tp2Name = ahead[1] ? ahead[1].name : '3 ATR';
      }
      plan.buyZone = below[0] || null;
      plan.sellZone = above[0] || null;
    }
    return plan;
  }

  const INV = { norm, dirOf, summaryTh, actionTh, actionDir, indicators, movingAverages, pivots, overview, decide };
  if (typeof module !== 'undefined' && module.exports) module.exports = INV;
  else root.INV = INV;
})(typeof window !== 'undefined' ? window : globalThis);
