// Trader toolkit on the home tab: market session, support / resistance ladder with reference entries,
// a short-term (1-minute) radar and a position-size calculator. Uses main.js globals (state, f2, …).
// Reference entries here are NOT backtested — the card says so; the tested signals are the 30 / 15-minute ones.
(function () {
  const $ = (id) => document.getElementById(id);
  const r2 = (v) => Math.round(v * 100) / 100;
  const sgn = (v) => `${v >= 0 ? '+' : '−'}$${f2(Math.abs(v))}`;

  // ----- Sessions (Thai clock in US-summer hours; SIG.marketShift moves them an hour later in winter) -----
  const SESS = [
    { from: 7, to: 14, name: '🌏 เอเชีย', tip: 'แกว่งแคบ มักวิ่งในกรอบ — เหมาะซื้อแนวรับ/ขายแนวต้าน ไม่ไล่ราคา' },
    { from: 14, to: 19, name: '🇬🇧 ลอนดอน', tip: 'เริ่มมีแรง มักเลือกทางของวัน — ระวังหลอกช่วงเปิด 14:00–15:00' },
    { from: 19, to: 23, name: '🔥 ลอนดอน+นิวยอร์ก', tip: 'แกว่งแรงที่สุดของวัน + ข่าวสหรัฐ — ใช้ SL เสมอ ลดขนาดไม้ได้' },
    { from: 23, to: 27, name: '🇺🇸 นิวยอร์กช่วงท้าย', tip: 'แรงค่อย ๆ ลด — ใกล้ปิดตลาดไม่ควรเปิดไม้ใหม่ช่วงชั่วโมงสุดท้าย' },
  ];
  function session(now) {
    const shift = SIG.marketShift(now), d = new Date(now - shift + 7 * 3600e3);
    let h = d.getUTCHours() + d.getUTCMinutes() / 60;
    if (h < 7) h += 24; // 00:00–03:00 belongs to the evening before
    return { h, open: INTRA.marketOpen(now), s: SESS.find((x) => h >= x.from && h < x.to), shift };
  }
  function renderSession(now) {
    const { h, open, s, shift } = session(now);
    const hh = (x) => `${String((x + (shift ? 1 : 0)) % 24).padStart(2, '0')}:00`;
    const pos = Math.max(0, Math.min(100, ((h - 7) / 20) * 100));
    $('tpSession').innerHTML = `<div class="tp-sbar">${SESS.map((x) => `<i class="${s === x ? 'on' : ''}" style="flex:${x.to - x.from}"><span>${x.name}</span></i>`).join('')}
      ${open ? `<b class="tp-now" style="left:${pos}%"></b>` : ''}</div>
      <div class="tp-sscale mono"><span>${hh(7)}</span><span>${hh(14)}</span><span>${hh(19)}</span><span>${hh(23)}</span><span>${hh(27)}</span></div>
      <p class="tp-stip">${open && s ? `ตอนนี้: <b>${s.name}</b> — ${s.tip}` : `🌙 ตลาดปิด — เปิดอีกครั้ง ${thaiTime(INTRA.nextOpen(now))} น.`}</p>`;
  }

  // ----- Levels: yesterday's pivots, today's high / low, recent 15-minute swing points -----
  function sessionStart(now) {
    const shift = SIG.marketShift(now), day = new Date(now - shift + 7 * 3600e3).toISOString().slice(0, 10);
    let t = Date.parse(`${day}T07:00:00+07:00`) + shift;
    if (t > now) t -= 864e5;
    return t;
  }
  function levels(price, now) {
    const out = [];
    const pv = state.daily.length ? PLAN.levelsFromDaily(state.daily, now) : null;
    if (pv) Object.entries(pv.levels).forEach(([k, v]) => out.push({ name: k === 'P' ? 'Pivot (จุดกลาง)' : `Pivot ${k}`, price: v, kind: 'p' }));
    const m15 = state.m15, from = sessionStart(now), today = m15.filter((b) => b.time >= from);
    if (today.length) {
      out.push({ name: 'สูงสุดวันนี้', price: Math.max(price, ...today.map((b) => b.high)), kind: 'd' });
      out.push({ name: 'ต่ำสุดวันนี้', price: Math.min(price, ...today.map((b) => b.low)), kind: 'd' });
    }
    if (m15.length > 20) {
      const sw = TA.swings(m15, 3, 150);
      sw.highs.filter((v) => v > price).sort((a, b) => a - b).slice(0, 2).forEach((v) => out.push({ name: 'จุดกลับตัว 15น. (บน)', price: v, kind: 's' }));
      sw.lows.filter((v) => v < price).sort((a, b) => b - a).slice(0, 2).forEach((v) => out.push({ name: 'จุดกลับตัว 15น. (ล่าง)', price: v, kind: 's' }));
    }
    // Merge levels closer than $1.5 (pivots / today's extremes win)
    const kept = [];
    out.sort((a, b) => (a.kind === 's') - (b.kind === 's')).forEach((l) => { if (!kept.some((k) => Math.abs(k.price - l.price) < 1.5)) kept.push(l); });
    return kept.sort((a, b) => b.price - a.price);
  }

  // ----- Entries at support / resistance: backtested 6 Oct 2026 and they LOSE, so the card shows the results
  // instead of entry calls (scratchpad research: every hour, orders kept 60 min, 5-minute candles, after $0.4 spread).
  // Columns = half-years, oldest → newest (Oct 2024 – Oct 2026), $ per ounce.
  const LEVEL_BT = [
    ['🟢 ซื้อที่แนวรับ (ทุกครั้ง)', [147, 71, -441, -587], '37–47%'],
    ['🟢 ซื้อที่แนวรับ (เฉพาะตอนเทรนด์ขึ้น)', [176, 94, -126, -179], '32–51%'],
    ['🔴 ขายที่แนวต้าน', [-422, -623, -705, -25], '32–39%'],
    ['🚀 ซื้อตามเบรกแนวต้าน', [-1213, -94, -359, -864], '26–33%'],
  ];
  const usd = (v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toLocaleString('en-US')}`;
  function renderLevels(price, lv) {
    const near = lv.filter((l) => Math.abs(l.price - price) < 80);
    const rows = [...near, { price, now: true }].sort((a, b) => b.price - a.price);
    $('tpLadder').innerHTML = rows.map((l) => l.now
      ? `<div class="lr now"><span>● ราคาตอนนี้</span><b class="mono">${f2(price)}</b><span></span></div>`
      : `<div class="lr ${l.price > price ? 'res' : 'sup'} k-${l.kind}"><span>${l.name}</span><b class="mono">${f2(l.price)}</b><span class="mono">${sgn(l.price - price)}</span></div>`).join('')
      || '<p class="muted small">กำลังโหลดข้อมูลรายวัน…</p>';
  }

  // What the levels are good for: does the system's fixed $15 stop / TP1 sit beyond the nearest level?
  function renderZones(price, lv) {
    const S = INTRA.RULE.slUsd, T = INTRA.RULE.tpUsd[0];
    const res = lv.filter((l) => l.price > price + 0.5).pop(), sup = lv.find((l) => l.price < price - 0.5);
    const tpLine = res ? (res.price - price < T
      ? `⚠️ ถ้าซื้อตอนนี้ แนวต้าน <b>${res.name} ${f2(res.price)}</b> อยู่ก่อน TP1 ของระบบ (+$${T}) — ห่างแค่ ${sgn(res.price - price)} ราคาอาจชนแนวแล้วกลับก่อนถึงเป้า`
      : `✅ ทางขึ้นถึง TP1 ของระบบ (+$${T}) ยังไม่มีแนวต้านขวาง — แนวต้านแรก ${f2(res.price)} (${sgn(res.price - price)})`) : '';
    const slLine = sup ? (price - sup.price < S
      ? `🛡️ SL ของระบบ (−$${S}) อยู่ <b>ใต้แนวรับ</b> ${sup.name} ${f2(sup.price)} — ราคาต้องหลุดแนวรับก่อนถึงจะโดน SL (ดี)`
      : `⚠️ แนวรับแรก ${f2(sup.price)} อยู่ต่ำกว่า SL ของระบบ (−$${S}) — SL จะโดนก่อนราคาถึงแนวรับ`) : '';
    const body = `<div class="lv-use"><p>${tpLine}</p><p>${slLine}</p></div>
      <div class="lv-bt"><p class="lv-bt-h">❌ ทดสอบย้อนหลัง 2 ปีแล้ว: <b>เข้าเพราะราคาแตะแนวอย่างเดียว ขาดทุน</b> — จึงไม่แนะนำจุดเข้าจากแนวรับ–ต้าน</p>
        <table><tr><th>วิธีเข้า</th><th>ต.ค.67–เม.ย.68</th><th>–ต.ค.68</th><th>–เม.ย.69</th><th>–ต.ค.69</th><th>ชนะ</th></tr>
        ${LEVEL_BT.map(([n, v, w]) => `<tr><td>${n}</td>${v.map((x) => `<td class="mono ${x >= 0 ? 'up' : 'down'}">${usd(x)}</td>`).join('')}<td class="mono">${w}</td></tr>`).join('')}</table>
        <p class="muted small">ต่อ 1 ออนซ์ หลังหักสเปรด $0.4 · จำลองทุกชั่วโมง ตั้งคำสั่งรอ 60 นาที SL เลยแนว TP ที่แนวถัดไป — <b>จุดเข้าให้ใช้สัญญาณ 30/15 นาทีด้านบน</b> (ผ่านการทดสอบ) แล้วใช้แนวเหล่านี้ดูว่าเป้า/SL มีอะไรขวาง</p></div>
      <button type="button" class="btn" id="tpUseSys">🧮 คำนวณไม้ตามระบบ (SL $${S} · TP $${T})</button>`;
    if (body !== renderZones.last) {
      renderZones.last = body; $('tpZones').innerHTML = body;
      $('tpUseSys').addEventListener('click', () => { const p = nowPrice(); if (p == null) return; calc.fill(1, r2(p), r2(p - S), r2(p + T)); $('tpCalc').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    }
  }

  // ----- Short-term radar on 1-minute candles -----
  function renderRadar(price, score, lv, now) {
    const b = state.tick;
    if (!b || b.length < 30) { $('tpRadar').innerHTML = '<p class="muted small">กำลังโหลดกราฟ 1 นาที…</p>'; return; }
    const c = b.map((x) => x.close), hi = b.map((x) => x.high), lo = b.map((x) => x.low), n = c.length - 1;
    const e9 = TA.ema(c, 9)[n], e21 = TA.ema(c, 21)[n], rsi = TA.rsi(c, 14)[n], atr1 = TA.atr(hi, lo, c, 14)[n];
    const roc5 = c[n] - c[n - 5], last15 = b.slice(-15), rng = Math.max(...last15.map((x) => x.high)) - Math.min(...last15.map((x) => x.low));
    const mom = e9 > e21 && roc5 > 0 ? 1 : e9 < e21 && roc5 < 0 ? -1 : 0;
    const up = lv.filter((l) => l.price > price).pop(), dn = lv.find((l) => l.price < price);
    const news = INTRA.newsNear(state.news, now);
    // Information only: as entries (limit at EMA9, SL max($4, 2×ATR1m), TP 1.5×SL) this lost over 2 years —
    // ~10,000 trades, 40–43% wins, −$1,811/oz after a $0.4 spread (half-years −$870 / −$387 / +$591 / −$1,145).
    let verdict, cls;
    if (!INTRA.marketOpen(now)) { verdict = '🌙 ตลาดปิด'; cls = 'wait'; }
    else if (news) { verdict = `📰 ใกล้ข่าวแรง (${news.title}) — ราคากระชากได้หลายสิบดอลลาร์ใน 1–2 นาที`; cls = 'wait'; }
    else if (mom && Math.sign(score) === mom) { verdict = `แรงสั้น${mom > 0 ? 'ขึ้น' : 'ลง'} ไปทางเดียวกับเทรนด์ 30 นาที (${signedScore(score)})`; cls = mom > 0 ? 'b' : 's'; }
    else if (mom) { verdict = `แรงสั้น${mom > 0 ? 'ขึ้น' : 'ลง'} สวนเทรนด์ 30 นาที (${signedScore(score)}) — มักเป็นแค่การย่อ/เด้งระยะสั้น`; cls = 'wait'; }
    else { verdict = 'ไม่มีแรงชัด (ไซด์เวย์สั้น)'; cls = 'wait'; }
    const tile = (label, val, sub, k = '') => `<div class="rd ${k}"><span>${label}</span><b class="mono">${val}</b><small>${sub}</small></div>`;
    $('tpRadar').innerHTML = `<div class="rd-tiles">
      ${tile('โมเมนตัม 1 นาที', mom > 0 ? '▲ ขึ้น' : mom < 0 ? '▼ ลง' : '• นิ่ง', `EMA9 ${mom >= 0 ? (e9 > e21 ? 'เหนือ' : 'ใต้') : 'ใต้'} EMA21 · 5 นาที ${sgn(roc5)}`, mom > 0 ? 'up' : mom < 0 ? 'down' : '')}
      ${tile('RSI 1 นาที', rsi.toFixed(0), rsi > 70 ? 'ซื้อมากเกิน ระวังย่อ' : rsi < 30 ? 'ขายมากเกิน ระวังเด้ง' : 'ปกติ', rsi > 70 ? 'down' : rsi < 30 ? 'up' : '')}
      ${tile('แกว่ง 15 นาทีล่าสุด', `$${f2(rng)}`, `เฉลี่ยต่อนาที $${f2(atr1)}`)}
      ${tile('ระยะถึงแนวใกล้สุด', `${up ? '↑ ' + sgn(up.price - price) : '—'}`, `${dn ? '↓ ' + sgn(dn.price - price) : ''}${up ? ` · ต้าน ${f2(up.price)}` : ''}`)}
    </div><p class="rd-verdict ${cls}">${verdict}</p>
      <p class="muted small rd-bt">❌ ทดสอบ 2 ปีแล้ว: เข้าไม้สั้นตามโมเมนตัม 1 นาที (SL ~$4 · TP ~$6) ~10,000 ไม้ ชนะ 40–43% <b>ขาดทุน −$1,811/ออนซ์ หลังหักสเปรด</b> — สเปรดกินกำไรสายสั้นเกือบหมด ส่วนนี้จึงเป็นข้อมูลประกอบ ไม่ใช่สัญญาณเข้า</p>`;
  }

  // ----- Position calculator -----
  const calc = {
    side: 1, touched: false,
    fill(side, entry, sl, tp) {
      calc.side = side; calc.touched = true;
      $('tpCalc').querySelectorAll('[data-side]').forEach((b) => b.classList.toggle('on', +b.dataset.side === side));
      $('cEntry').value = entry; $('cSl').value = sl; $('cTp').value = tp; calc.out();
    },
    out() {
      const e = +$('cEntry').value, sl = +$('cSl').value, tp = +$('cTp').value, d = calc.side;
      if (!e || !sl) { $('cOut').innerHTML = '<span class="muted">ใส่จุดเข้าและ SL</span>'; return; }
      if ((e - sl) * d <= 0) { $('cOut').innerHTML = `<span class="down">SL ต้องอยู่${d > 0 ? 'ต่ำกว่า' : 'สูงกว่า'}จุดเข้า (ฝั่ง${d > 0 ? 'ซื้อ' : 'ขาย'})</span>`; return; }
      const risk = Math.abs(e - sl), gain = tp ? (tp - e) * d : null;
      const l = window.lotFor(risk);
      const lot = l && l.lot ? l.lot : 0.01;
      $('cOut').innerHTML = `<div><span>ระยะ SL</span><b class="mono">$${f2(risk)}</b></div>
        <div><span>ระยะ TP</span><b class="mono ${gain != null && gain <= 0 ? 'down' : ''}">${gain != null ? '$' + f2(gain) : '—'}</b></div>
        <div><span>R:R</span><b class="mono">${gain > 0 ? '1:' + (gain / risk).toFixed(2) : '—'}</b></div>
        <div><span>ขนาดไม้</span><b class="mono">${lot.toFixed(2)} lot</b></div>
        <div><span>ถ้าโดน SL</span><b class="mono down">−$${f2(lot * 100 * risk)}</b></div>
        <div><span>ถ้าถึง TP</span><b class="mono up">${gain > 0 ? '+$' + f2(lot * 100 * gain) : '—'}</b></div>
        <p class="small muted">${l ? l.text : '0.01 lot = 1 ออนซ์ ($1 ต่อการขยับ $1) · <a href="#account">ใส่ทุน</a> เพื่อคำนวณขนาดไม้ตามความเสี่ยง'}${gain > 0 && gain / risk < 1 ? ' · ⚠️ R:R ต่ำกว่า 1 — ได้น้อยกว่าเสีย ต้องชนะเกินครึ่งถึงจะคุ้ม' : ''}</p>`;
    },
  };
  $('tpCalc').querySelectorAll('[data-side]').forEach((b) => b.addEventListener('click', () => {
    calc.side = +b.dataset.side; $('tpCalc').querySelectorAll('[data-side]').forEach((x) => x.classList.toggle('on', x === b)); calc.out();
  }));
  ['cEntry', 'cSl', 'cTp'].forEach((id) => $(id).addEventListener('input', () => { calc.touched = true; calc.out(); }));
  // The chart tab's "คำนวณ lot" button: fill the calculator with that signal (side 1 = buy, −1 = sell)
  window.fillCalc = (side, entry, sl, tp) => calc.fill(side, r2(entry), r2(sl), r2(tp));
  $('cNow').addEventListener('click', () => {
    const p = nowPrice(); if (p == null) return;
    const s = INTRA.RULE.slUsd, d = calc.side;
    calc.fill(d, r2(p), r2(p - d * s), r2(p + d * s));
  });

  // ----- Render (main.js calls this at most once a second) -----
  window.renderPlan = function () {
    const now = Date.now(), price = nowPrice();
    renderSession(now);
    if (price == null) return;
    const dec = state.intraCandles ? INTRA.decide(state.intraCandles, now, state.news, true) : null;
    const score = dec ? dec.score : 0;
    const lv = levels(price, now);
    renderLevels(price, lv);
    renderZones(price, lv);
    renderRadar(price, score, lv, now);
    if (!calc.touched) { const s = INTRA.RULE.slUsd; calc.fill(1, r2(price), r2(price - s), r2(price + s)); calc.touched = false; }
  };
})();
