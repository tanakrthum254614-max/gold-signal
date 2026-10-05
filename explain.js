// Builds the "สรุปง่าย ๆ" box: what gold is doing and what to do, in everyday Thai
(function (root) {
  const money = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const STRENGTH = { strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2 };

  const HORIZONS = [
    { name: 'ระยะสั้น', hint: '5–30 นาที', tfs: ['5m', '15m', '30m'] },
    { name: 'ระยะกลาง', hint: '1–5 ชั่วโมง', tfs: ['1h', '5h'] },
    { name: 'ระยะยาว', hint: '1 วัน–1 สัปดาห์', tfs: ['1d', '1w'] },
  ];

  // Average investing.com summaries over a group of timeframes
  function horizons(tech, INV) {
    return HORIZONS.map((h) => {
      const vals = h.tfs.map((tf) => tech && tech[tf] && STRENGTH[INV.norm(tech[tf].summary)]).filter((v) => v != null);
      if (!vals.length) return { ...h, key: 'neutral', th: '—' };
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const key = avg >= 1.5 ? 'strong_buy' : avg >= 0.5 ? 'buy' : avg <= -1.5 ? 'strong_sell' : avg <= -0.5 ? 'sell' : 'neutral';
      return { ...h, key, th: INV.trendTh(key) };
    });
  }

  function brief({ plan, price, daily, tfLabel, horizon }) {
    const mid = horizon ? horizon[1].key : plan.summary || 'neutral';
    const trendDir = mid.includes('buy') ? 1 : mid.includes('sell') ? -1 : 0;
    const trend = trendDir > 0 ? 'ทองกำลังขึ้น' : trendDir < 0 ? 'ทองกำลังลง' : 'ทองยังแกว่งตัว ไม่ชัดเจน';
    const icon = plan.action === 'BUY' ? '🟢' : plan.action === 'SELL' ? '🔴' : '🟡';

    let todo;
    if (plan.action === 'BUY') todo = 'เป็นจังหวะซื้อได้';
    else if (plan.action === 'SELL') todo = 'เป็นจังหวะขาย';
    else todo = trendDir < 0 ? 'ยังไม่ควรซื้อ' : trendDir > 0 ? 'ยังไม่ควรไล่ซื้อ รอจังหวะก่อน' : 'รอดูก่อน';

    const lines = [];
    if (daily && daily.length >= 2) {
      const prev = daily[daily.length - 2].close;
      const chg = price - prev, pct = (chg / prev) * 100;
      lines.push(`วันนี้ราคาทอง${chg >= 0 ? 'ขึ้น' : 'ลง'} <b>$${money(Math.abs(chg))}</b> (${Math.abs(pct).toFixed(2)}%) จากเมื่อวาน ตอนนี้อยู่ที่ <b>$${money(price)}</b> ต่อออนซ์`);
    }

    if (plan.action === 'BUY') {
      lines.push(`ถ้าจะซื้อ: ซื้อแถว <b>${money(plan.entry)}</b> แล้วตั้ง “จุดตัดขาดทุน” ไว้ที่ <b>${money(plan.sl)}</b>
        (ถ้าราคาลงไปถึงจุดนี้ ให้ขายออกทันที จะเสียไม่เกิน $${money(Math.abs(plan.entry - plan.sl))} ต่อออนซ์)
        และตั้งเป้าขายทำกำไรที่ <b>${money(plan.tp1)}</b> หรือ <b>${money(plan.tp2)}</b>`);
    } else if (plan.action === 'SELL') {
      lines.push(`ถ้ามีทองอยู่: เป็นจังหวะขายเพื่อล็อกกำไรหรือลดความเสี่ยง ·
        ถ้าเทรดขาลง (Short): เข้าขายแถว <b>${money(plan.entry)}</b> ตัดขาดทุนที่ <b>${money(plan.sl)}</b>
        เป้าทำกำไร <b>${money(plan.tp1)}</b> หรือ <b>${money(plan.tp2)}</b>`);
    } else {
      if (plan.warn && plan.warn[0]) lines.push(`เหตุผลที่ให้รอ: ${plan.warn[0]}`);
      const watch = [];
      if (plan.buyZone) {
        watch.push(trendDir < 0
          ? `ถ้าราคาหลุด <b>${money(plan.buyZone.price)}</b> ลงไป มีโอกาสลงต่อ แต่ถ้าลงมาแล้วเด้งขึ้น อาจเป็นจังหวะซื้อ`
          : `ถ้าราคาย่อลงมาแถว <b>${money(plan.buyZone.price)}</b> แล้วเด้งขึ้น อาจเป็นจังหวะซื้อ`);
      }
      if (plan.sellZone) watch.push(`ถ้าราคาขึ้นไปเกิน <b>${money(plan.sellZone.price)}</b> ได้ แสดงว่าเริ่มแข็งแรงขึ้น`);
      if (watch.length) lines.push(`จุดที่ต้องจับตา: ${watch.join(' · ')}`);
    }

    return {
      icon,
      title: `${trend} — ${todo}`,
      basis: `อ้างอิงกราฟ ${tfLabel} จากสถิติ investing.com · ความมั่นใจ ${plan.confidence}%`,
      lines,
    };
  }

  const EXPLAIN = { horizons, brief };
  if (typeof module !== 'undefined' && module.exports) module.exports = EXPLAIN;
  else root.EXPLAIN = EXPLAIN;
})(typeof window !== 'undefined' ? window : globalThis);
