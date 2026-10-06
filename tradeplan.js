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
  const atr15 = () => { const m = state.m15; if (m.length < 20) return 5; const a = TA.atr(m.map((b) => b.high), m.map((b) => b.low), m.map((b) => b.close)); return a[a.length - 1] || 5; };

  // ----- Reference entries: buy the dip at support, sell the rally at resistance, breakout -----
  function zones(price, lv, atr, score) {
    const pad = Math.max(5, r2(atr * 0.8)); // beyond the level by ~a 15-minute candle range: tighter stops get wicked out
    const minGap = Math.max(1, atr * 0.25);
    // nearest first: lv is sorted high → low
    const above = lv.filter((l) => l.price > price + minGap).reverse(), below = lv.filter((l) => l.price < price - minGap);
    // Targets: the first level at least 1R away, then the next one at least ½R further (else 1.5R / +1R)
    const plan = (side, entry, sl, why) => {
      const risk = Math.abs(entry - sl), d = side;
      const cand = lv.map((l) => l.price).filter((p) => (p - entry) * d > 0).sort((a, b) => (a - b) * d);
      const tp1 = cand.find((p) => (p - entry) * d >= risk) ?? entry + d * risk * 1.5;
      const tp2 = cand.find((p) => (p - tp1) * d >= risk / 2) ?? tp1 + d * risk;
      return { side, entry: r2(entry), sl: r2(sl), tp1: r2(tp1), tp2: r2(tp2), rr: r2(Math.abs(tp1 - entry) / risk), why, dist: r2(entry - price) };
    };
    const res = [];
    if (below[0]) res.push({ key: 'dip', title: '🟢 ซื้อเมื่อย่อ (แนวรับ)', ...plan(1, below[0].price + 0.5, below[0].price - pad, `${below[0].name} ${f2(below[0].price)}`) });
    if (above[0]) res.push({ key: 'rally', title: '🔴 ขายเมื่อเด้ง (แนวต้าน)', ...plan(-1, above[0].price - 0.5, above[0].price + pad, `${above[0].name} ${f2(above[0].price)}`) });
    if (above[0]) res.push({ key: 'break', title: '🚀 ซื้อตามเบรก (ทะลุแนวต้าน)', ...plan(1, above[0].price + 1, above[0].price - pad, `แท่ง 15 นาทีปิดเหนือ ${f2(above[0].price)}`) });
    // Which one fits the 30-minute trend right now
    const fav = score >= 3 ? ['dip', 'break'] : score <= -3 ? ['rally'] : ['dip', 'rally'];
    res.forEach((z) => { z.fit = fav.includes(z.key); });
    return res;
  }

  function renderLevels(price, lv, zs) {
    const near = lv.filter((l) => Math.abs(l.price - price) < 80);
    const rows = [...near, { price, now: true }].sort((a, b) => b.price - a.price);
    $('tpLadder').innerHTML = rows.map((l) => l.now
      ? `<div class="lr now"><span>● ราคาตอนนี้</span><b class="mono">${f2(price)}</b><span></span></div>`
      : `<div class="lr ${l.price > price ? 'res' : 'sup'} k-${l.kind}"><span>${l.name}</span><b class="mono">${f2(l.price)}</b><span class="mono">${sgn(l.price - price)}</span></div>`).join('')
      || '<p class="muted small">กำลังโหลดข้อมูลรายวัน…</p>';
  }

  function renderZones(zs, score) {
    const trend = score >= 3 ? 'แนวโน้ม 30 นาทีเป็นขาขึ้น → เน้นฝั่งซื้อ' : score <= -3 ? 'แนวโน้ม 30 นาทีเป็นขาลง → ฝั่งขายเข้ากว่า (แต่สถิติฝั่งขายของระบบอ่อน ลดขนาดไม้)' : 'แนวโน้มยังไม่ชัด → เล่นในกรอบ: ซื้อแนวรับ ขายแนวต้าน';
    $('tpZones').innerHTML = `<p class="tp-trend">${trend} <span class="muted">(คะแนนสด ${signedScore(score)})</span></p>` + zs.map((z, i) => `
      <div class="zn ${z.side > 0 ? 'b' : 's'}${z.fit ? ' fit' : ''}">
        <div class="zn-top"><b>${z.title}</b>${z.fit ? '<span class="tag">เข้ากับเทรนด์</span>' : '<span class="tag neutral">สวนเทรนด์ ระวัง</span>'}</div>
        <div class="zn-why muted small">${z.key === 'break' ? 'รอ' : 'ตั้งรอที่'} ${z.why} · ห่างจากราคาตอนนี้ ${sgn(z.dist)}</div>
        <div class="zn-lv mono"><span>เข้า <b>${f2(z.entry)}</b></span><span class="sl">SL ${f2(z.sl)}</span><span class="tp">TP1 ${f2(z.tp1)}</span><span class="tp">TP2 ${f2(z.tp2)}</span></div>
        <div class="zn-foot small"><span>เสี่ยง $${f2(Math.abs(z.entry - z.sl))} · ได้ $${f2(Math.abs(z.tp1 - z.entry))} ที่ TP1 · <b>R:R 1:${z.rr}</b></span><button type="button" class="btn zn-use" data-i="${i}">คำนวณไม้นี้</button></div>
      </div>`).join('');
    $('tpZones').querySelectorAll('.zn-use').forEach((b) => b.addEventListener('click', () => {
      const z = zs[+b.dataset.i]; calc.fill(z.side, z.entry, z.sl, z.tp1);
      $('tpCalc').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
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
    const sl = Math.max(4, r2(atr1 * 2)), tp = r2(sl * 1.5);
    let verdict, cls;
    if (!INTRA.marketOpen(now)) { verdict = '🌙 ตลาดปิด'; cls = 'wait'; }
    else if (news) { verdict = `📰 ใกล้ข่าวแรง (${news.title}) — สายสั้นงดเข้า ราคากระชากได้หลายสิบดอลลาร์`; cls = 'wait'; }
    else if (mom > 0 && score >= 0 && rsi < 75) { verdict = `เอียงซื้อสั้น: รอย่อใกล้ EMA9 ${f2(e9)} → SL ${f2(e9 - sl)} (−$${f2(sl)}) · TP ${f2(e9 + tp)} (+$${f2(tp)})`; cls = 'b'; }
    else if (mom < 0 && score <= 0 && rsi > 25) { verdict = `เอียงขายสั้น: รอเด้งใกล้ EMA9 ${f2(e9)} → SL ${f2(e9 + sl)} (+$${f2(sl)}) · TP ${f2(e9 - tp)} (−$${f2(tp)})`; cls = 's'; }
    else { verdict = mom ? 'โมเมนตัม 1 นาทีสวนกับเทรนด์ 30 นาที — ยังไม่เข้า รอให้ไปทางเดียวกัน' : 'ไม่มีแรงชัด (ไซด์เวย์สั้น) — รอ'; cls = 'wait'; }
    const tile = (label, val, sub, k = '') => `<div class="rd ${k}"><span>${label}</span><b class="mono">${val}</b><small>${sub}</small></div>`;
    $('tpRadar').innerHTML = `<div class="rd-tiles">
      ${tile('โมเมนตัม 1 นาที', mom > 0 ? '▲ ขึ้น' : mom < 0 ? '▼ ลง' : '• นิ่ง', `EMA9 ${mom >= 0 ? (e9 > e21 ? 'เหนือ' : 'ใต้') : 'ใต้'} EMA21 · 5 นาที ${sgn(roc5)}`, mom > 0 ? 'up' : mom < 0 ? 'down' : '')}
      ${tile('RSI 1 นาที', rsi.toFixed(0), rsi > 70 ? 'ซื้อมากเกิน ระวังย่อ' : rsi < 30 ? 'ขายมากเกิน ระวังเด้ง' : 'ปกติ', rsi > 70 ? 'down' : rsi < 30 ? 'up' : '')}
      ${tile('แกว่ง 15 นาทีล่าสุด', `$${f2(rng)}`, `เฉลี่ยต่อนาที $${f2(atr1)}`)}
      ${tile('ระยะถึงแนวใกล้สุด', `${up ? '↑ ' + sgn(up.price - price) : '—'}`, `${dn ? '↓ ' + sgn(dn.price - price) : ''}${up ? ` · ต้าน ${f2(up.price)}` : ''}`)}
    </div><p class="rd-verdict ${cls}">${verdict}</p>`;
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
    const lv = levels(price, now), atr = atr15(), zs = zones(price, lv, atr, score);
    renderLevels(price, lv, zs);
    // Zones only re-render when the plan changes (buttons keep working, no flicker)
    const key = JSON.stringify(zs.map((z) => [z.entry, z.sl, z.tp1, z.tp2, z.fit])) + score;
    if (key !== renderPlan.key) { renderPlan.key = key; renderZones(zs, score); }
    else $('tpZones').querySelectorAll('.zn-why').forEach((el, i) => { const z = zs[i]; el.textContent = `${z.key === 'break' ? 'รอ' : 'ตั้งรอที่'} ${z.why} · ห่างจากราคาตอนนี้ ${sgn(r2(z.entry - price))}`; });
    renderRadar(price, score, lv, now);
    if (!calc.touched) { const s = INTRA.RULE.slUsd; calc.fill(1, r2(price), r2(price - s), r2(price + s)); calc.touched = false; }
  };
})();
