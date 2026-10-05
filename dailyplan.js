// Day-trading plan for gold: today's bias plus buy/sell points built on the daily pivot levels.
// Shared by the website (browser) and the morning LINE message (Node).
(function (root) {
  const STRENGTH = { strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2 };
  const money = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ORDER = ['R3', 'R2', 'R1', 'P', 'S1', 'S2', 'S3'];
  const DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  // Last complete weekday session. Skips the short Sunday-evening bar and the session still
  // trading (gold's daily session closes ~21:00 UTC). Bar times may be seconds or milliseconds.
  function prevSession(daily, now = Date.now()) {
    for (let i = daily.length - 1; i >= 0; i--) {
      const b = daily[i];
      const t = b.time < 1e12 ? b.time * 1000 : b.time;
      const wd = new Date(t).getUTCDay();
      if (wd === 0 || wd === 6 || t + 21 * 3600e3 > now) continue;
      return { ...b, ms: t, dayTh: DAY_TH[wd] };
    }
    return null;
  }

  // Classic floor pivots from that session
  function levelsFromDaily(daily, now) {
    const b = prevSession(daily, now);
    if (!b) return null;
    const { high: H, low: L, close: Cl } = b;
    const P = (H + L + Cl) / 3;
    return {
      from: b,
      levels: { R3: H + 2 * (P - L), R2: P + (H - L), R1: 2 * P - L, P, S1: 2 * P - H, S2: P - (H - L), S3: L - 2 * (H - P) },
    };
  }

  // levels: { R3, R2, R1, P, S1, S2, S3 } (classic pivots from yesterday's daily candle)
  // bias:   { short, mid, long } summary keys such as "strong_sell"
  function build({ price, levels, bias }) {
    const s = (k) => STRENGTH[bias[k]] || 0;
    const score = (s('short') + s('mid') * 2 + s('long')) / 4; // -2 … +2
    const trend = score >= 0.5 ? 'up' : score <= -0.5 ? 'down' : 'range';

    const lv = ORDER.filter((k) => levels[k] != null).map((k) => ({ name: k, price: levels[k] }));
    const above = lv.filter((l) => l.price > price).sort((a, b) => a.price - b.price);
    const below = lv.filter((l) => l.price < price).sort((a, b) => b.price - a.price);
    const buf = Math.max(1, ((levels.R1 || price) - (levels.S1 || price)) * 0.08);
    // First target that pays at least as much as the stop risks (falls back to the nearest level)
    const pickTargets = (targets, entry, risk) => {
      const i = targets.findIndex((t) => Math.abs(t.price - entry) >= risk);
      return i > 0 ? targets.slice(i) : targets;
    };
    const label = (l) => (l.name === 'P' ? 'จุดกึ่งกลาง (P)' : `${l.price < price ? 'แนวรับ' : 'แนวต้าน'} (${l.name})`);

    // Buy at a support below price, stop under the next support, targets at the levels above
    function buyAt(i) {
      const entry = below[i], stop = below[i + 1];
      if (!entry) return null;
      const sl = stop ? stop.price - buf : entry.price - buf * 4;
      const targets = pickTargets([...below.slice(0, i).reverse(), ...above], entry.price, entry.price - sl);
      const tp1 = targets[0] ? targets[0].price : entry.price + (entry.price - sl);
      const tp2 = targets[1] ? targets[1].price : tp1 + (tp1 - entry.price);
      return { side: 'BUY', at: entry, entry: entry.price, sl, tp1, tp2, rr: (tp1 - entry.price) / (entry.price - sl) };
    }
    // Sell at a resistance above price, stop over the next resistance, targets at the levels below
    function sellAt(i) {
      const entry = above[i], stop = above[i + 1];
      if (!entry) return null;
      const sl = stop ? stop.price + buf : entry.price + buf * 4;
      const targets = pickTargets([...above.slice(0, i).reverse(), ...below], entry.price, sl - entry.price);
      const tp1 = targets[0] ? targets[0].price : entry.price - (sl - entry.price);
      const tp2 = targets[1] ? targets[1].price : tp1 - (entry.price - tp1);
      return { side: 'SELL', at: entry, entry: entry.price, sl, tp1, tp2, rr: (entry.price - tp1) / (sl - entry.price) };
    }

    let headline, primary, secondary, invalidate;
    if (trend === 'up') {
      headline = 'ขาขึ้น — เน้น “ซื้อเมื่อราคาย่อ”';
      primary = buyAt(0);
      secondary = sellAt(1);
      if (secondary) secondary.note = 'สวนเทรนด์ เล่นสั้น ๆ เท่านั้น';
      const cut = below[1] || below[0];
      invalidate = cut ? `ถ้าราคาหลุด ${money(cut.price)} ลงไป แนวโน้มขาขึ้นวันนี้เสีย ให้หยุดซื้อ` : '';
    } else if (trend === 'down') {
      headline = 'ขาลง — เน้น “ขายเมื่อราคาเด้ง”';
      primary = sellAt(0);
      secondary = buyAt(1);
      if (secondary) secondary.note = 'สวนเทรนด์ เล่นสั้น ๆ เท่านั้น';
      const cut = above[1] || above[0];
      invalidate = cut ? `ถ้าราคายืนเหนือ ${money(cut.price)} ได้ แนวโน้มขาลงวันนี้เสีย ให้หยุดขาย` : '';
    } else {
      headline = 'ไซด์เวย์ — ซื้อที่แนวรับ ขายที่แนวต้าน';
      primary = buyAt(0);
      secondary = sellAt(0);
      invalidate = 'ถ้าราคาทะลุแนวรับหรือแนวต้านไปแรง ๆ ให้หยุดเล่นกรอบ รอดูทิศทางใหม่';
    }
    [primary, secondary].forEach((p) => { if (p) p.label = label(p.at); });

    return {
      trend, score, headline, primary, secondary, invalidate,
      icon: trend === 'up' ? '🟢' : trend === 'down' ? '🔴' : '🟡',
      levels: lv.map((l) => ({ ...l, label: label(l) })),
    };
  }

  // Thai sentence for one side of the plan
  function describe(p) {
    if (!p) return '';
    const verb = p.side === 'BUY' ? 'ซื้อ' : 'ขาย';
    return `${verb}ที่ ${money(p.entry)} (${p.label}) · ตัดขาดทุน ${money(p.sl)} · เป้า 1: ${money(p.tp1)} · เป้า 2: ${money(p.tp2)}`;
  }

  const PLAN = { build, describe, money, prevSession, levelsFromDaily };
  if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
  else root.PLAN = PLAN;
})(typeof window !== 'undefined' ? window : globalThis);
