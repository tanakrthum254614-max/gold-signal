// Chart tab Q&A chat (user, 12 Oct: "อยากให้มีแชทถามตอบในหน้าของกราฟ ว่าควรเข้าตำแหน่งไหน ไม่ควรเข้าตำแหน่งไหน").
// Answers ONLY from what the chart already shows for the timeframe on screen — the tested system's score and Buy | Sell
// readiness (window.CZ_NOW from chartzones.js), the supply / demand zones and price envelope (window.CZ_LEVELS), pivot
// levels (state.pivotLv), news (state.news) and the recorded live trades (state.chartSig). No AI service, nothing sent
// anywhere, so it can never say something the chart doesn't.
(function () {
  const $ = (id) => document.getElementById(id);
  const tab = $('tab-chart');
  if (!tab) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const p2 = (v) => f2(SIG.round(v));
  const tfName = () => TF_LABEL[state.tf] || state.tf;
  const QUICK = [
    ['ตอนนี้ควรเข้าไหม', 'now'], ['ซื้อตรงไหนดี', 'buy'], ['ขายตรงไหนดี', 'sell'], ['ตรงไหนไม่ควรเข้า', 'avoid'],
    ['SL / TP เท่าไร', 'sltp'], ['แนวรับ–แนวต้าน', 'levels'], ['มีข่าวไหม', 'news'], ['กรอบอื่นถือไม้อยู่ไหม', 'tfs'],
  ];

  tab.insertAdjacentHTML('beforeend', `
    <button type="button" class="cc-fab" id="ccFab" aria-expanded="false" aria-controls="ccPanel">💬 ถามจุดเข้า</button>
    <section class="cc-panel" id="ccPanel" hidden aria-label="แชทถามจุดเข้า">
      <header class="cc-head"><b>💬 ถามระบบ: เข้าตรงไหนดี</b><span class="muted small" id="ccTf"></span><button type="button" class="cc-x" id="ccClose" aria-label="ปิด">✕</button></header>
      <div class="cc-log" id="ccLog" aria-live="polite"></div>
      <div class="cc-quick" id="ccQuick">${QUICK.map(([t, k]) => `<button type="button" data-q="${k}">${t}</button>`).join('')}</div>
      <form class="cc-form" id="ccForm"><input id="ccIn" autocomplete="off" placeholder="พิมพ์คำถาม เช่น ซื้อที่ 4150 ได้ไหม"><button type="submit" class="btn">ส่ง</button></form>
      <p class="cc-foot">ตอบจากระบบบนกราฟกรอบที่เลือกอยู่ (ตัวเดียวกับช่อง Buy | Sell) · ไม่ใช่คำแนะนำการลงทุน</p>
    </section>`);
  const log = $('ccLog'), panel = $('ccPanel'), fab = $('ccFab');

  function say(who, html) {
    log.insertAdjacentHTML('beforeend', `<div class="cc-msg ${who}">${html}</div>`);
    while (log.children.length > 40) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function open(on) {
    panel.hidden = !on; fab.setAttribute('aria-expanded', String(on)); fab.classList.toggle('on', on);
    if (on) {
      $('ccTf').textContent = `กรอบ ${tfName()}`;
      if (!log.children.length) say('bot', `สวัสดีครับ ถามได้เลยว่าตอนนี้ควรเข้าไหม ซื้อ/ขายตรงไหน ตรงไหนไม่ควรเข้า หรือพิมพ์ราคาที่อยากเข้า เช่น <b>“ซื้อที่ ${now() ? Math.round(now().price - 10) : 4150} ได้ไหม”</b><br><small>ตอบตามกรอบเวลาที่เลือกอยู่บนกราฟ — เปลี่ยนกรอบแล้วถามใหม่ได้</small>`);
      if (matchMedia('(min-width: 700px)').matches) $('ccIn').focus();
    }
  }
  fab.addEventListener('click', () => open(panel.hidden));
  $('ccClose').addEventListener('click', () => open(false));
  $('ccQuick').addEventListener('click', (e) => { const b = e.target.closest('button[data-q]'); if (b) ask(b.textContent, b.dataset.q); });
  $('ccForm').addEventListener('submit', (e) => { e.preventDefault(); const t = $('ccIn').value.trim(); if (!t) return; $('ccIn').value = ''; ask(t); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) open(false); });

  // ---------- what the chart knows right now ----------
  function now() {
    const n = window.CZ_NOW;
    return n && n.tf === state.tf && Date.now() - n.at < 10 * 60e3 ? n : null;
  }
  const sys = () => CHARTSYS.SYS[state.tf];
  const atr = () => { const b = state.bars.slice(-14); return b.length ? b.reduce((a, x) => a + x.high - x.low, 0) / b.length : 5; };
  function zonesNear(price) {
    const zn = (window.CZ_LEVELS && window.CZ_LEVELS.zones) || [];
    const sell = zn.filter((z) => z.side === 'sell' && z.top >= price).sort((a, b) => a.bottom - b.bottom);
    const buy = zn.filter((z) => z.side === 'buy' && z.bottom <= price).sort((a, b) => b.top - a.top);
    return { sell: sell[0] || null, buy: buy[0] || null, all: zn };
  }
  const env = () => (window.CZ_LEVELS && window.CZ_LEVELS.env) || null;
  const zTxt = (z) => `${p2(z.bottom)}–${p2(z.top)}`;
  const side = (n, s) => n.sides.find((x) => x.side === s);
  const sideName = (s) => (s > 0 ? '🟢 Buy (ซื้อ)' : '🔴 Sell (ขาย)');
  function nextNews(within = 6 * 3600e3) {
    const t = Date.now(), w = INTRA.RULE.newsMin * 60e3;
    return (state.news || []).filter((x) => x.time >= t - w && x.time <= t + within);
  }
  const mins = (ms) => { const m = Math.round(ms / 60e3); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`; };
  const levelsTxt = (c, entry, s) => { const L = CHARTSYS.levelsFor(c, entry, s); return `SL <b>${p2(L.sl)}</b> · ${L.tps.map((v, k) => `TP${k + 1} <b>${p2(v)}</b>`).join(' · ')}`; };

  // ---------- answers ----------
  function notReady() {
    if (!state.bars.length) return 'กราฟยังโหลดไม่เสร็จ รอสักครู่แล้วถามใหม่ครับ';
    const n = now();
    if (!n) return `ระบบกรอบ ${tfName()} ยังคำนวณไม่เสร็จ (รอกราฟกรอบใหญ่) ลองใหม่ในไม่กี่วินาทีครับ`;
    if (!n.d) return 'ระบบยังไม่มีข้อมูลแท่งล่าสุดพอจะตอบ ลองใหม่อีกสักครู่ครับ';
    return null;
  }
  function holding(n) {
    const o = n.open; if (!o) return null;
    const sell = o.side === 'SELL';
    return `📌 ระบบกรอบ ${tfName()} <b>ถือไม้${sell ? 'ขาย' : 'ซื้อ'}อยู่แล้ว</b> — เข้า ${p2(o.entry)} · SL ${p2(o.hit ? o.entry : o.sl)}${o.hit ? ' (ที่ทุน)' : ''} · ${o.tps.map((v, k) => `TP${k + 1} ${p2(v)}`).join(' · ')}<br>ไม่ต้องเปิดไม้ใหม่ — ถือตามแผนจนถึง TP หรือ SL`;
  }
  // The reasons NOT to enter right now (shared by several answers)
  function blockers(n, s) {
    const out = [], d = n.d, sy = sys();
    if (n.br) out.push(`⛔ ระบบกรอบนี้พักอยู่: ${n.br.why}`);
    if (!sy.long && d.stale) out.push('🌙 ตลาดปิดอยู่');
    if (!sy.long && d.news) out.push('📰 อยู่ในช่วงข่าวแรง ±30 นาที — ราคากระชากได้ทั้งสองทาง');
    if (!sy.long && d.lastHour) out.push('🕐 ใกล้ตลาดปิด — ระบบไม่เปิดไม้ใหม่');
    if (n.stretched) out.push('📏 ราคายืดเกินขอบกรอบราคา (Bollinger) — มักย่อกลับก่อน อย่าไล่ราคา');
    if (n.unconf) out.push('⏳ คะแนนถึงแล้ว แต่ตัวยืนยันยังไม่ยืนยัน');
    if (s) { const x = side(n, s); if (x && !x.tested) out.push(`⚠️ ฝั่ง${s > 0 ? 'ซื้อ' : 'ขาย'}ของกรอบ ${tfName()} ทดสอบย้อนหลังแล้วขาดทุน — ระบบไม่ให้สัญญาณฝั่งนี้`); }
    return out;
  }
  function ansNow() {
    const n = now(), h = holding(n); if (h) return h;
    const go = n.sides.find((x) => x.go);
    if (go) {
      const c = go.c;
      return `${go.side > 0 ? '🟢' : '🔴'} <b>ควรเข้า ${go.side > 0 ? 'Buy' : 'Sell'}</b> — ระบบกรอบ ${tfName()} ถึงจุดเข้า 100% (คะแนน ${signedScore(n.d.score)})<br>เข้า ~<b>${p2(n.price)}</b> · ${levelsTxt(c, n.price, go.side)}<br><small>ทดสอบย้อนหลังชนะ ${c.win}% · สัญญาณยืนยันเมื่อแท่งนี้ปิดแล้วคะแนนยังถึง</small>`;
    }
    const [b, s] = [side(n, 1), side(n, -1)], bl = blockers(n);
    const best = [b, s].filter((x) => x.tested).sort((a, c) => c.pct - a.pct)[0];
    let t = `⏸ <b>ยังไม่ควรเข้า</b> — กรอบ ${tfName()}: Buy ${b.pct}% · Sell ${s.pct}% (ต้องถึง 100%)`;
    if (bl.length) t += `<br>${bl.join('<br>')}`;
    if (best && best.pct >= 60 && !n.br) t += `<br>ใกล้ที่สุดคือฝั่ง ${sideName(best.side)} — ขาดอีก ${Math.max(1, best.c.th - Math.abs(n.d.score))} คะแนน รอให้แท่งปิดแล้วถามใหม่`;
    else t += '<br>ตอนนี้ไม่มีฝั่งไหนใกล้จุดเข้า — รอดีกว่าครับ';
    return t;
  }
  function ansSide(s) {
    const n = now(), h = holding(n); if (h) return h;
    const x = side(n, s), c = x.c || sys().buy, z = zonesNear(n.price), e = env(), a = atr();
    const name = s > 0 ? 'ซื้อ' : 'ขาย';
    let t = `${sideName(s)} · กรอบ ${tfName()}: ความพร้อม <b>${x.pct}%</b> · ${x.verdict}`;
    if (x.go) return `${t}<br>✅ เข้าได้ตอนนี้ที่ ~<b>${p2(n.price)}</b> · ${levelsTxt(c, n.price, s)}`;
    if (!x.tested) {
      t += `<br>⚠️ ฝั่ง${name}ของกรอบนี้ทดสอบย้อนหลังแล้วขาดทุน ระบบจึงไม่ให้สัญญาณ${s < 0 && sys().buy ? ' — ถ้าอยากเล่นฝั่งขาย ดูกรอบ 5 นาที (ฝั่งขายที่ทดสอบผ่าน)' : ''}`;
    }
    // where the price would be a better place to wait for this side
    const zone = s > 0 ? z.buy : z.sell;
    const spots = [];
    if (zone) spots.push(`โซน${s > 0 ? 'ซื้อ (แนวรับ)' : 'ขาย (แนวต้าน)'} <b>${zTxt(zone)}</b> — ห่างจากราคาตอนนี้ ${p2(Math.abs((s > 0 ? zone.top : zone.bottom) - n.price))} ดอลลาร์`);
    if (e) spots.push(`ขอบ${s > 0 ? 'ล่าง' : 'บน'}กรอบราคา <b>${p2(s > 0 ? e.lo : e.up)}</b>`);
    if (spots.length) t += `<br>📍 จุดรอ${name}ที่ดีกว่า:<br>• ${spots.join('<br>• ')}`;
    const opp = s > 0 ? z.sell : z.buy;
    if (opp && Math.abs((s > 0 ? opp.bottom : opp.top) - n.price) < 1.5 * a) t += `<br>🚫 อย่า${name}ตอนนี้: ราคาอยู่ใกล้โซน${s > 0 ? 'ขาย' : 'ซื้อ'} ${zTxt(opp)} — มักถูก${s > 0 ? 'กดลง' : 'ดันขึ้น'}`;
    t += `<br><small>ถึงราคาถึงจุดรอแล้ว ก็ยังต้องรอให้ความพร้อมถึง 100% ก่อน (ระบบเข้าตามคะแนน ไม่ใช่ตามราคาอย่างเดียว)</small>`;
    return t;
  }
  function ansAvoid() {
    const n = now(), z = zonesNear(n.price), e = env(), out = [];
    if (z.sell) out.push(`🚫 อย่า<b>ซื้อ</b>ใกล้ <b>${zTxt(z.sell)}</b> (โซนขาย/แนวต้านเหนือราคา) — ราคามักถูกกดลงตรงนั้น`);
    if (z.buy) out.push(`🚫 อย่า<b>ขาย</b>ใกล้ <b>${zTxt(z.buy)}</b> (โซนซื้อ/แนวรับใต้ราคา) — ราคามักเด้งขึ้นตรงนั้น`);
    if (e) out.push(`🚫 อย่าไล่ซื้อเหนือ <b>${p2(e.up)}</b> หรือไล่ขายใต้ <b>${p2(e.lo)}</b> (นอกกรอบราคา) — มักย่อกลับเข้ากรอบ`);
    const nw = nextNews();
    nw.slice(0, 3).forEach((x) => out.push(`🚫 อย่าเปิดไม้ช่วง <b>${hhmm(x.time - 30 * 60e3)}–${hhmm(x.time + 30 * 60e3)} น.</b> — ข่าว ${esc(x.title)}`));
    const bl = blockers(n, null);
    const [b, s] = [side(n, 1), side(n, -1)];
    if (!b.tested) out.push(`🚫 ฝั่งซื้อกรอบ ${tfName()} ทดสอบไม่ผ่าน`);
    if (!s.tested) out.push(`🚫 ฝั่งขายกรอบ ${tfName()} ทดสอบไม่ผ่าน — ไม่มีสัญญาณ Sell ในกรอบนี้`);
    if (n.d.score <= -sys().buy.th / 2) out.push(`🚫 แนวโน้มลง (คะแนน ${signedScore(n.d.score)}) — อย่าซื้อสวนเทรนด์`);
    if (n.d.score >= sys().buy.th / 2) out.push(`🚫 แนวโน้มขึ้น (คะแนน ${signedScore(n.d.score)}) — อย่าขายสวนเทรนด์`);
    return `<b>ตำแหน่งที่ไม่ควรเข้า · กรอบ ${tfName()}</b> (ราคาตอนนี้ ${p2(n.price)})<br>${[...bl, ...out].join('<br>') || 'ตอนนี้ไม่มีจุดอันตรายเด่น ๆ — แต่ยังต้องรอสัญญาณ 100% ก่อนเข้า'}`;
  }
  function ansSLTP() {
    const n = now(), h = holding(n); if (h) return h;
    const rows = n.sides.map((x) => { const c = x.c || sys().buy, L = CHARTSYS.levelsFor(c, n.price, x.side);
      return `${sideName(x.side)} ถ้าเข้าที่ ${p2(n.price)} → SL <b>${p2(L.sl)}</b> (−$${Math.round(15 * c.mult)}) · ${L.tps.map((v, k) => `TP${k + 1} <b>${p2(v)}</b> (+$${CHARTSYS.usdList(c)[k]})`).join(' · ')}${x.tested ? '' : ' ⚠️ ฝั่งนี้ทดสอบไม่ผ่าน'}`; });
    return `<b>SL / TP ของระบบกรอบ ${tfName()}</b><br>${rows.join('<br>')}<br><small>ตัวเลขต่อทอง 1 ออนซ์ (0.01 lot) · ใช้ปุ่ม 🧮 บนการ์ดเพื่อคำนวณ lot ตามทุน</small>`;
  }
  function ansLevels() {
    const n = now(), z = zonesNear(n.price), e = env(), lv = (state.pivotLv || []).slice().sort((a, b) => b.price - a.price);
    const up = lv.filter((x) => x.price > n.price).slice(-3), dn = lv.filter((x) => x.price <= n.price).slice(0, 3);
    let t = `<b>แนวรับ–แนวต้าน · กรอบ ${tfName()}</b> (ราคา ${p2(n.price)})`;
    if (z.sell) t += `<br>🟥 โซนขายใกล้สุด: <b>${zTxt(z.sell)}</b>`;
    if (up.length) t += `<br>⬆️ แนวต้าน: ${up.map((x) => `${esc(x.name)} <b>${p2(x.price)}</b>`).join(' · ')}`;
    if (dn.length) t += `<br>⬇️ แนวรับ: ${dn.map((x) => `${esc(x.name)} <b>${p2(x.price)}</b>`).join(' · ')}`;
    if (z.buy) t += `<br>🟩 โซนซื้อใกล้สุด: <b>${zTxt(z.buy)}</b>`;
    if (e) t += `<br>〰 กรอบราคา: ${p2(e.lo)} – ${p2(e.up)} (กลาง ${p2(e.mid)})`;
    return t;
  }
  function ansNews() {
    const nw = nextNews(24 * 3600e3), t = Date.now(), w = INTRA.RULE.newsMin * 60e3;
    if (!nw.length) return 'ไม่มีข่าวแรงสหรัฐใน 24 ชม. ข้างหน้า ✅ (ดูทั้งสัปดาห์ได้ที่แท็บ 📰 ข่าวสหรัฐ)';
    const which = sys().news ? `กรอบ ${tfName()} งดเข้า ±30 นาทีรอบข่าว (ทดสอบแล้วว่าช่วยได้)` : `กรอบ ${tfName()} ไม่ได้งดตามข่าว (ทดสอบแล้วไม่ช่วย) แต่ราคาจะกระชากแรง ควรระวัง`;
    return `<b>📰 ข่าวแรงสหรัฐ</b><br>${nw.slice(0, 5).map((x) => `• <b>${hhmm(x.time)} น.</b> ${esc(x.title)} — ${Math.abs(x.time - t) <= w ? '⚠️ อยู่ในช่วงข่าวตอนนี้' : x.time > t ? `อีก ${mins(x.time - t)}` : 'เพิ่งออก'}`).join('<br>')}<br><small>${which}</small>`;
  }
  function ansTfs() {
    const t = Date.now(), live = ((state.chartSig && state.chartSig.trades) || []).filter((r) => !SIG.isFinal(r) && (r.expiresAt || Infinity) > t);
    if (!live.length) return 'ตอนนี้ไม่มีกรอบเวลาไหนถือไม้อยู่ — ทุกกรอบรอสัญญาณ (เลือกกรอบด้านบนแล้วถาม “ตอนนี้ควรเข้าไหม” ได้)';
    return `<b>ไม้ที่ระบบถืออยู่ (ทุกกรอบ)</b><br>${live.map((r) => `• กรอบ ${TF_LABEL[r.tf] || r.tf}: ${r.side === 'SELL' ? '🔴 ขาย' : '🟢 ซื้อ'} ที่ ${p2(r.entry)} · SL ${p2(r.hit ? r.entry : r.sl)} · TP ${r.tps.map(p2).join(' / ')}`).join('<br>')}`;
  }
  // "ซื้อที่ 4150 ได้ไหม" — judge a price the user has in mind against this timeframe's zones, envelope and system
  function ansPrice(px, s) {
    const n = now(), z = zonesNear(n.price), e = env(), a = atr(), zn = z.all;
    if (!s) s = px <= n.price ? 1 : -1;
    const x = side(n, s), c = x.c || sys().buy, name = s > 0 ? 'ซื้อ' : 'ขาย';
    if (Math.abs(px - n.price) > 40 * a) return `ราคา ${p2(px)} ห่างจากราคาตอนนี้ (${p2(n.price)}) มากเกินไป — ระบบกรอบ ${tfName()} ประเมินได้แค่ช่วงใกล้ ๆ ลองเลือกกรอบใหญ่ขึ้น (เช่น 1 วัน) แล้วถามใหม่`;
    const inZ = (side_) => zn.find((q) => q.side === side_ && px >= q.bottom - a * 0.3 && px <= q.top + a * 0.3);
    const good = [], bad = [];
    if (s > 0) {
      if (inZ('buy')) good.push(`อยู่ในโซนซื้อ ${zTxt(inZ('buy'))} (แนวรับ) ✅`);
      if (inZ('sell')) bad.push(`อยู่ในโซนขาย ${zTxt(inZ('sell'))} — ซื้อตรงนี้มักโดนกดลง`);
      if (e && px > e.up) bad.push(`สูงกว่าขอบบนกรอบราคา ${p2(e.up)} = ไล่ราคา`);
      if (e && px <= e.lo) good.push(`ต่ำกว่า/ชิดขอบล่างกรอบราคา ${p2(e.lo)} ✅`);
    } else {
      if (inZ('sell')) good.push(`อยู่ในโซนขาย ${zTxt(inZ('sell'))} (แนวต้าน) ✅`);
      if (inZ('buy')) bad.push(`อยู่ในโซนซื้อ ${zTxt(inZ('buy'))} — ขายตรงนี้มักโดนดันขึ้น`);
      if (e && px < e.lo) bad.push(`ต่ำกว่าขอบล่างกรอบราคา ${p2(e.lo)} = ไล่ราคา`);
      if (e && px >= e.up) good.push(`สูงกว่า/ชิดขอบบนกรอบราคา ${p2(e.up)} ✅`);
    }
    if (!x.tested) bad.push(`ฝั่ง${name}กรอบ ${tfName()} ทดสอบย้อนหลังขาดทุน — ระบบไม่ให้สัญญาณฝั่งนี้`);
    if (n.br) bad.push(`ระบบกรอบนี้พักอยู่: ${n.br.why}`);
    const verdict = bad.length ? `🚫 <b>ไม่ควร${name}ที่ ${p2(px)}</b>` : good.length ? `👍 <b>${p2(px)} เป็นจุดรอ${name}ที่ดี</b>` : `🤔 <b>${p2(px)} เป็นจุดกลาง ๆ</b> — ไม่ใช่แนวรับ/แนวต้านเด่น`;
    let t = `${verdict} · กรอบ ${tfName()} (ราคาตอนนี้ ${p2(n.price)})`;
    if (bad.length) t += `<br>• ${bad.join('<br>• ')}`;
    if (good.length) t += `<br>• ${good.join('<br>• ')}`;
    if (!bad.length) t += `<br>ถ้า${name}ที่ ${p2(px)}: ${levelsTxt(c, px, s)}`;
    t += `<br>สถานะระบบตอนนี้: ${name} ${x.pct}% · ${x.verdict}<br><small>ถึงราคาแล้วยังต้องรอความพร้อม 100% — ถามใหม่ตอนราคาไปถึงได้ครับ</small>`;
    return t;
  }

  function intent(text) {
    const s = text.toLowerCase();
    const num = (s.replace(/,/g, '').match(/\d{3,5}(?:\.\d+)?/g) || []).map(Number).find((v) => v > 500);
    const sell = /ขาย|sell|short|ชอร์ต|ช็อต/.test(s), buy = /ซื้อ|buy|long/.test(s);
    if (num) return ['price', num, sell && !buy ? -1 : buy && !sell ? 1 : 0];
    if (/ข่าว|news|cpi|nfp|fed|เฟด/.test(s)) return ['news'];
    if (/ไม่ควร|ห้าม|อันตราย|หลีกเลี่ยง|อย่า|ไม่เข้า|เลี่ยง/.test(s)) return ['avoid'];
    if (/\bsl\b|\btp\b|ตัดขาดทุน|ทำกำไร|เป้า|stop|take ?profit/.test(s)) return ['sltp'];
    if (/แนวรับ|แนวต้าน|โซน|support|resist/.test(s)) return ['levels'];
    if (/กรอบอื่น|ทุกกรอบ|ถือไม้|ไม้ที่เปิด|timeframe|ไทม์เฟรม/.test(s)) return ['tfs'];
    if (sell && !buy) return ['sell'];
    if (buy && !sell) return ['buy'];
    return ['now'];
  }
  function ask(text, key) {
    say('me', esc(text));
    const nr = notReady();
    if (nr) { say('bot', nr); return; }
    const [k, a, b] = key ? [key] : intent(text);
    const A = { now: ansNow, buy: () => ansSide(1), sell: () => ansSide(-1), avoid: ansAvoid, sltp: ansSLTP, levels: ansLevels, news: ansNews, tfs: ansTfs, price: () => ansPrice(a, b) };
    let out;
    try { out = A[k](); } catch (e) { out = 'ขอโทษครับ ตอบคำถามนี้ไม่ได้ตอนนี้ ลองกดคำถามด้านล่างแทน'; console.error(e); }
    const at = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
    say('bot', `${out}<span class="cc-at">${at} น. · กรอบ ${esc(tfName())}</span>`);
    $('ccTf').textContent = `กรอบ ${tfName()}`;
  }
  window.CC_ASK = ask; // tests
})();
