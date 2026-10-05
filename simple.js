// "Simple mode": answers in everyday Thai with no trading jargon
(function (root) {
  const STRENGTH = { strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2 };
  // Thai gold bar (96.5%) per baht-weight = USD/oz x THB x (15.244 g x 0.965 / 31.1035 g)
  const BAHT_WEIGHT_FACTOR = (15.244 * 0.965) / 31.1035;
  const money = (v, d = 2) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

  const toThaiGold = (usd, thb) => (thb ? usd * thb * BAHT_WEIGHT_FACTOR : null);

  function analyze({ tech, plan, price, daily, thb, horizons, INV, tfLabel }) {
    const [sh, mid, long] = horizons.map((h) => STRENGTH[h.key] || 0);
    const score = (sh + mid * 2 + long * 2) / 5; // -2 … +2

    let trend, light, mood;
    if (score >= 1.4) { trend = 'กำลังขึ้นแรง'; light = '🟢'; mood = 'up'; }
    else if (score >= 0.5) { trend = 'กำลังขึ้น'; light = '🟢'; mood = 'up'; }
    else if (score <= -1.4) { trend = 'กำลังลงแรง'; light = '🔴'; mood = 'down'; }
    else if (score <= -0.5) { trend = 'กำลังลง'; light = '🔴'; mood = 'down'; }
    else { trend = 'ทรงตัว ยังไม่ไปทางไหน'; light = '🟡'; mood = 'flat'; }
    const sure = Math.abs(score) >= 1.4 ? 'สูง' : Math.abs(score) >= 0.6 ? 'ปานกลาง' : 'ต่ำ (สัญญาณยังไม่ชัด)';

    // How many of investing.com's timeframes point up vs down
    const tfs = Object.keys(tech || {});
    let up = 0, down = 0, flat = 0;
    tfs.forEach((tf) => {
      const d = INV.dirOf(INV.norm(tech[tf].summary));
      if (d > 0) up++; else if (d < 0) down++; else flat++;
    });

    const why = [];
    if (tfs.length) {
      why.push(`investing.com วิเคราะห์ทองไว้ ${tfs.length} ช่วงเวลา (ตั้งแต่ 5 นาทีถึง 1 เดือน) — บอกว่า “ลง” ${down} ช่วง, “ขึ้น” ${up} ช่วง${flat ? `, “ไม่ชัด” ${flat} ช่วง` : ''}`);
    }
    let today = null;
    if (daily && daily.length >= 6) {
      const n = daily.length;
      const wk = price - daily[n - 6].close;
      why.push(`สัปดาห์นี้ราคา${wk >= 0 ? 'ขึ้น' : 'ลง'}มา ${money(Math.abs(wk))} ดอลลาร์${thb ? ` (ประมาณ ${money(Math.abs(toThaiGold(wk, thb)), 0)} บาทต่อทอง 1 บาท)` : ''}`);
      const chg = price - daily[n - 2].close;
      const pct = (chg / daily[n - 2].close) * 100;
      const size = Math.abs(pct) < 0.3 ? 'นิดหน่อย' : Math.abs(pct) < 1 ? 'พอสมควร' : 'ค่อนข้างแรง';
      today = { chg, pct, text: `วันนี้${chg >= 0 ? 'ขึ้น' : 'ลง'} ${money(Math.abs(chg))} ดอลลาร์ (${Math.abs(pct).toFixed(2)}%) — ${chg >= 0 ? 'ขึ้น' : 'ลง'}${size}` };
      if (thb) today.thbText = `≈ ${chg >= 0 ? '+' : '−'}${money(Math.abs(toThaiGold(chg, thb)), 0)} บาท ต่อทอง 1 บาท`;
    }

    // Daily support/resistance are the meaningful levels for people buying or holding gold
    const dayPv = tech && tech['1d'] ? INV.pivots(tech['1d']) : [];
    // Skip levels hugging the current price (< 0.2%), they aren't useful to watch
    const gap = price * 0.002;
    const sup = dayPv.filter((p) => p.price < price - gap).sort((a, b) => b.price - a.price)[0];
    const res = dayPv.filter((p) => p.price > price + gap).sort((a, b) => a.price - b.price)[0];
    const at = (p) => (p ? `${money(p.price)} ดอลลาร์` : 'ราคาที่ต่ำกว่านี้');

    let buy;
    if (long > 0 && mid > 0) buy = { tone: 'good', answer: 'ซื้อได้', text: 'แนวโน้มทั้งระยะกลางและระยะยาวเป็นขาขึ้น ทยอยซื้อได้ ไม่ต้องทุ่มเงินทีเดียว' };
    else if (long > 0) buy = { tone: 'ok', answer: 'รอซื้อตอนราคาย่อ', text: `แนวโน้มใหญ่ยังขึ้น แต่ช่วงนี้ราคากำลังพักตัว ถ้ารอซื้อแถว ${at(sup)} จะได้ราคาดีกว่า` };
    else if (long < 0 && mid < 0) buy = { tone: 'bad', answer: 'ยังไม่ควรซื้อ', text: 'ราคากำลังลงทั้งระยะกลางและระยะยาว ซื้อตอนนี้มีโอกาสได้ของแพงกว่าที่ควร รอให้ราคาหยุดลงก่อน' };
    else if (long < 0) buy = { tone: 'ok', answer: 'ยังไม่ต้องรีบ', text: 'ราคาเพิ่งเด้งขึ้นมา แต่แนวโน้มใหญ่ยังเป็นขาลง รอดูให้ชัดก่อนค่อยซื้อ' };
    else buy = { tone: 'ok', answer: 'ทยอยซื้อทีละน้อย', text: 'ราคายังไม่ไปทางไหนชัด ถ้าจะซื้อเก็บระยะยาว แบ่งซื้อทีละน้อยจะปลอดภัยกว่า' };

    let hold;
    if (long > 0) hold = { tone: 'good', answer: 'ถือต่อได้', text: 'แนวโน้มใหญ่ยังเป็นขาขึ้น ยังไม่จำเป็นต้องขาย' };
    else if (long < 0 && mid < 0) hold = { tone: 'bad', answer: 'ระวัง อาจขายบางส่วน', text: `ราคากำลังลง ถ้ากลัวขาดทุนเพิ่ม อาจขายออกบางส่วน${sup ? ` หรือตั้งใจไว้ว่าจะขายถ้าราคาหลุด ${at(sup)}` : ''}` };
    else hold = { tone: 'ok', answer: 'ถือต่อ แต่คอยดู', text: sup ? `ยังถือได้ ถ้าราคาหลุด ${at(sup)} ลงไป ค่อยพิจารณาขาย` : 'ยังถือได้ คอยติดตามราคา' };

    let trade;
    if (plan.action === 'BUY') {
      trade = { tone: 'good', answer: 'จังหวะซื้อ', text: `ซื้อแถว ${money(plan.entry)} · ถ้าราคาลงไปถึง ${money(plan.sl)} ให้ยอมขายตัดขาดทุน · ขายทำกำไรที่ ${money(plan.tp1)}` };
    } else if (plan.action === 'SELL') {
      trade = { tone: 'bad', answer: 'จังหวะขาย', text: `ขาย (Short) แถว ${money(plan.entry)} · ถ้าราคาขึ้นไปถึง ${money(plan.sl)} ให้ยอมปิดตัดขาดทุน · ปิดทำกำไรที่ ${money(plan.tp1)}` };
    } else {
      trade = { tone: 'ok', answer: 'รอก่อน', text: plan.warn && plan.warn[0] ? plan.warn[0] : 'ยังไม่มีจังหวะที่ดี' };
    }
    trade.text += ` (ดูจากกราฟ ${tfLabel})`;

    return {
      trend, light, mood, sure, why, today,
      gauge: ((score + 2) / 4) * 100,
      thaiPrice: toThaiGold(price, thb),
      sup, res,
      personas: { buy, hold, trade },
    };
  }

  const SIMPLE = { analyze, toThaiGold };
  if (typeof module !== 'undefined' && module.exports) module.exports = SIMPLE;
  else root.SIMPLE = SIMPLE;
})(typeof window !== 'undefined' ? window : globalThis);
