// Chart tab Q&A chat (user, 12 Oct: "อยากให้มีแชทถามตอบในหน้าของกราฟ ว่าควรเข้าตำแหน่งไหน ไม่ควรเข้าตำแหน่งไหน";
// then "ขอขยาย กรอบ 5 / 15 / 30 นาที / 1 ชม. ถามตอบมากกว่านี้ ของการเข้า Buy หรือ Sell").
// Answers ONLY from the site's own tested systems — the timeframe on screen comes from the chart card itself
// (window.CZ_NOW / CZ_LEVELS from chartzones.js), the others from window.CZ_TFNOW (same decide / sideInfo / brake /
// recorded trade) and CZ_ZONES_OF (same zones / price envelope). Plus pivots (state.pivotLv, screen tf only), news
// (state.news) and the live record (state.chartSig). No AI service, nothing sent anywhere.
// 🤖 Coach mode (14 Oct 2026): a second mode where typed questions go to the AI coach (api/coach.mjs) with the same
// four-timeframe snapshot, upcoming news and the member's settings attached; the server adds their trade journal.
(function () {
  const $ = (id) => document.getElementById(id);
  const tab = $('tab-chart');
  if (!tab) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const p2 = (v) => f2(SIG.round(v));
  const CHAT_TFS = ['5m', '15m', '30m', '1h'];
  const nameOf = (tf) => TF_LABEL[tf] || tf;
  let target = ''; // '' = whatever the chart shows
  const QUICK = [
    ['ตอนนี้ควรเข้าไหม', 'now'], ['สรุป 4 กรอบ', 'all'], ['Buy กรอบไหนดี', 'bestbuy'], ['Sell กรอบไหนดี', 'bestsell'],
    ['ซื้อตรงไหนดี', 'buy'], ['ขายตรงไหนดี', 'sell'], ['ทำไมยังไม่เข้า', 'why'], ['ตรงไหนไม่ควรเข้า', 'avoid'],
    ['SL / TP เท่าไร', 'sltp'], ['แนวรับ–แนวต้าน', 'levels'], ['ผลทดสอบ / ผลจริง', 'stats'], ['มีข่าวไหม', 'news'], ['รายการที่ถืออยู่', 'tfs'],
  ];

  // Inside the chart's signal card (user, 12 Oct: "เอาถามตอบอยู่ตรงนี้แทน" — where investing.com's reasons were); the
  // simple view has no side card, so there it sits under the chart
  const slot = $('ccSlot');
  if (!slot) return;
  slot.insertAdjacentHTML('beforeend', `
    <section class="cc-panel" id="ccPanel" aria-label="แชทถามจุดเข้า">
      <header class="cc-head"><b id="ccTitle">💬 ถามจุดเข้า Buy / Sell</b><span class="cc-mode" id="ccMode" role="group" aria-label="โหมดแชท"><button type="button" data-mode="sys" class="on">ระบบ</button><button type="button" data-mode="ai">🤖 โค้ช AI</button></span></header>
      <div class="cc-tfs" id="ccTfs" role="group" aria-label="ถามกรอบเวลา"><span>กรอบ:</span><button type="button" data-tf="">ตามกราฟ <small id="ccScreen"></small></button>${CHAT_TFS.map((t) => `<button type="button" data-tf="${t}">${nameOf(t)}</button>`).join('')}</div>
      <div class="cc-log" id="ccLog" aria-live="polite"></div>
      <div class="cc-quick" id="ccQuick">${QUICK.map(([t, k]) => `<button type="button" data-q="${k}">${t}</button>`).join('')}</div>
      <form class="cc-form" id="ccForm"><input id="ccIn" autocomplete="off" placeholder="เช่น ซื้อที่ 4150 ได้ไหม · Buy 1 ชม. เมื่อไร"><button type="submit" class="btn">ส่ง</button></form>
      <p class="cc-foot" id="ccFoot">ตอบจากระบบที่ทดสอบแล้ว · ไม่ใช่คำแนะนำการลงทุน</p>
    </section>`);
  const log = $('ccLog'), panel = $('ccPanel');

  function say(who, html) {
    log.insertAdjacentHTML('beforeend', `<div class="cc-msg ${who}">${html}</div>`);
    while (log.children.length > 50) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function paintTfs() {
    $('ccScreen').textContent = `(${nameOf(state.tf)})`;
    $('ccTfs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tf === target));
  }
  // pro view: in the signal card · simple view: under the chart
  function place() {
    const pro = $('chartPro'), simple = $('chartSimple');
    const host = pro && !pro.hidden ? slot : simple || slot;
    if (panel.parentElement !== host) host.appendChild(panel);
    panel.classList.toggle('cc-under', host !== slot);
  }
  [$('chartPro'), $('chartSimple')].filter(Boolean).forEach((el) => new MutationObserver(place).observe(el, { attributes: true, attributeFilter: ['hidden'] }));
  place();
  // "ตามกราฟ (x)" follows the chart's timeframe (it showed 1 ชม. on a 5-minute chart until a question was asked)
  setInterval(() => { const el = $('ccScreen'); if (el && el.textContent !== `(${nameOf(state.tf)})`) paintTfs(); }, 1000);
  paintTfs(); // no greeting message (user, 12 Oct: "เอาอันนี้ออก ให้กล่องถามตอบกระชับขึ้น") — an empty log shows one short hint (CSS)
  $('ccTfs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tf]'); if (!b) return; target = b.dataset.tf; paintTfs(); });
  $('ccQuick').addEventListener('click', (e) => { const b = e.target.closest('button[data-q]'); if (b) ask(b.textContent, b.dataset.q); });
  $('ccForm').addEventListener('submit', (e) => { e.preventDefault(); const t = $('ccIn').value.trim(); if (!t) return; $('ccIn').value = ''; if (mode === 'ai') coach(t); else ask(t); });
  $('ccMode').addEventListener('click', (e) => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode); });

  // ---------- 🤖 AI coach mode ----------
  let mode = 'sys';
  const history = [];
  function setMode(m) {
    mode = m;
    $('ccMode').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    panel.classList.toggle('cc-ai', m === 'ai');
    $('ccTitle').textContent = m === 'ai' ? '🤖 โค้ช AI' : '💬 ถามจุดเข้า Buy / Sell';
    $('ccIn').placeholder = m === 'ai' ? 'เล่าให้โค้ช AI ฟัง เช่น ขาดทุนติดต่อกัน 3 รายการ ควรทำยังไง' : 'เช่น ซื้อที่ 4150 ได้ไหม · Buy 1 ชม. เมื่อไร';
    $('ccFoot').textContent = m === 'ai' ? 'AI อ่านสัญญาณตอนนี้ + บันทึกการซื้อขายของคุณ · อาจผิดพลาดได้ · ไม่ใช่คำแนะนำการลงทุน' : 'ตอบจากระบบที่ทดสอบแล้ว · ไม่ใช่คำแนะนำการลงทุน';
  }
  // the coach's reply is plain text: escape, then keep line breaks and **bold**
  const plain = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  async function coach(text) {
    if (busy) return;
    busy = true;
    say('me', esc(text));
    say('bot', '<span class="cc-typing">โค้ช AI กำลังวิเคราะห์…</span>');
    const wait = log.lastElementChild;
    let signals = [];
    try { signals = await window.GS_SIGNALS(); } catch (e) { /* send without */ }
    const t = Date.now();
    const news = (state.news || []).filter((x) => x.time > t - 3600e3 && x.time < t + 24 * 3600e3).slice(0, 5).map((x) => ({ title: x.title, time: `${hhmm(x.time)} น. (${x.time > t ? `อีก ${mins(x.time - t)}` : 'ออกแล้ว'})` }));
    const st = window.UI ? UI.settings() : null;
    try {
      const r = await fetch('/api/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ message: text, history: history.slice(-8), context: { price: nowPrice(), signals, news, settings: st } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        wait.innerHTML = r.status === 402 ? `⭐ ${esc(j.error || 'สำหรับสมาชิก PRO')} — <a href="#account">ดูแพ็กเกจ</a>` : `ขอโทษครับ ${esc(j.error || 'โค้ชไม่ว่างชั่วคราว')}`;
      } else {
        history.push({ role: 'user', content: text }, { role: 'assistant', content: j.reply });
        wait.innerHTML = `${plain(j.reply)}<span class="cc-at">${hhmm(Date.now())} น. · 🤖 โค้ช AI${j.left != null ? ` · เหลือ ${j.left} คำถามวันนี้` : ''}</span>`;
      }
    } catch (e) { wait.textContent = 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'; }
    log.scrollTop = log.scrollHeight;
    busy = false;
  }
  window.CC_COACH = (text) => { setMode('ai'); panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); coach(text); };

  // ---------- one timeframe, right now ----------
  const fastCache = {}; // 5m candles when the chart isn't on 5m (refetched after 60 s)
  async function fastBars(tf) {
    if (tf !== '5m' || state.tf === '5m') return null;
    const c = fastCache[tf];
    if (c && Date.now() - c.at < 60e3) return c.bars;
    const r = await loadBars(tf);
    const bars = msBars(r.bars);
    fastCache[tf] = { at: Date.now(), bars };
    return bars;
  }
  // Snapshot for a timeframe: the chart card's own numbers when it is the one on screen, else computed the same way
  async function snap(tf) {
    if (tf === state.tf) {
      const n = window.CZ_NOW;
      if (n && n.tf === tf && Date.now() - n.at < 10 * 60e3) {
        const L = window.CZ_LEVELS || {};
        return { ...n, zones: L.zones || [], env: L.env || null, pivots: state.pivotLv || [], screen: true,
          live: ((state.chartSig && state.chartSig.trades) || []).filter((r) => r.tf === tf) };
      }
    }
    if (!window.CZ_TFNOW) return null;
    let fast = null;
    try { fast = await fastBars(tf); } catch (e) { return null; }
    const n = CZ_TFNOW(tf, fast);
    if (!n || !n.d || n.price == null) return null;
    const Z = n.bars.length > 20 && window.CZ_ZONES_OF ? CZ_ZONES_OF(n.bars) : { zones: [], env: null };
    return { ...n, zones: Z.zones, env: Z.env, pivots: [], screen: false };
  }
  const sysOf = (n) => CHARTSYS.SYS[n.tf];
  const atrOf = (n) => { const b = (n.screen ? state.bars : n.bars).slice(-14); return b.length ? b.reduce((a, x) => a + x.high - x.low, 0) / b.length : 5; };
  function zonesNear(n) {
    const sell = n.zones.filter((z) => z.side === 'sell' && z.top >= n.price).sort((a, b) => a.bottom - b.bottom);
    const buy = n.zones.filter((z) => z.side === 'buy' && z.bottom <= n.price).sort((a, b) => b.top - a.top);
    return { sell: sell[0] || null, buy: buy[0] || null };
  }
  const zTxt = (z) => `${p2(z.bottom)}–${p2(z.top)}`;
  const side = (n, s) => n.sides.find((x) => x.side === s);
  const sideName = (s) => (s > 0 ? '🟢 Buy (ซื้อ)' : '🔴 Sell (ขาย)');
  const dirTxt = (n) => { const f = window.CZ_FDIR ? CZ_FDIR(n.d) : 0; return f > 0 ? '▲ ขึ้น' : f < 0 ? '▼ ลง' : '• ทรงตัว'; };
  function nextNews(within = 6 * 3600e3) {
    const t = Date.now(), w = INTRA.RULE.newsMin * 60e3;
    return (state.news || []).filter((x) => x.time >= t - w && x.time <= t + within);
  }
  const mins = (ms) => { const m = Math.round(ms / 60e3); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`; };
  const levelsTxt = (c, entry, s) => { const L = CHARTSYS.levelsFor(c, entry, s); return `SL <b>${p2(L.sl)}</b> · ${L.tps.map((v, k) => `TP${k + 1} <b>${p2(v)}</b>`).join(' · ')}`; };
  const need = (n, x) => Math.max(1, (x.c || sysOf(n).buy).th - (x.side > 0 ? n.d.score : -n.d.score));

  // ---------- answers for one timeframe (n = snap) ----------
  function holding(n) {
    const o = n.open; if (!o) return null;
    const sell = o.side === 'SELL';
    return `📌 กรอบ ${nameOf(n.tf)} <b>ถือสถานะ${sell ? 'ขาย' : 'ซื้อ'}อยู่แล้ว</b> — เข้า ${p2(o.entry)} · SL ${p2(o.hit ? o.entry : o.sl)}${o.hit ? ' (ที่ทุน)' : ''} · ${o.tps.map((v, k) => `TP${k + 1} ${p2(v)}`).join(' · ')}<br>ไม่ต้องเปิดรายการใหม่ — ถือตามแผนจนถึง TP หรือ SL`;
  }
  function blockers(n, s) {
    const out = [], d = n.d, sy = sysOf(n);
    if (n.br) out.push(`⛔ ระบบกรอบนี้พักอยู่: ${n.br.why}`);
    if (!sy.long && d.stale) out.push('🌙 ตลาดปิดอยู่');
    if (!sy.long && d.news) out.push('📰 อยู่ในช่วงข่าวแรง ±30 นาที — ราคากระชากได้ทั้งสองทาง');
    if (!sy.long && d.lastHour) out.push('🕐 ใกล้ตลาดปิด — ระบบไม่เปิดรายการใหม่');
    if (n.stretched) out.push('📏 ราคายืดเกินขอบกรอบราคา (Bollinger) — มักย่อกลับก่อน อย่าไล่ราคา');
    if (n.unconf) { const c = CHARTSYS.CONFIRM[(d.score > 0 ? sy.buy : sy.sell || sy.buy).confirm]; if (c) out.push(`⏳ คะแนนถึงแล้ว แต่ ${c.name} ยังไม่ยืนยัน — รอ${c.wait}`); }
    if (s) { const x = side(n, s); if (x && !x.tested) out.push(`⚠️ ฝั่ง${s > 0 ? 'ซื้อ' : 'ขาย'}ของกรอบ ${nameOf(n.tf)} ${CHARTSYS.whyNo(x.c)}`);
      if (x && x.risky) out.push(`${CHARTSYS.riskText(x.c)} — ถ้าเข้า ใช้ขนาดเล็กกว่าปกติ`); }
    return out;
  }
  function ansNow(n) {
    const h = holding(n); if (h) return h;
    const go = n.sides.find((x) => x.go);
    if (go) return `${go.side > 0 ? '🟢' : '🔴'} <b>${go.risky ? 'มีสัญญาณ (เสี่ยง)' : 'ควรเข้า'} ${go.side > 0 ? 'Buy' : 'Sell'}</b> — กรอบ ${nameOf(n.tf)} ถึงจุดเข้า 100% (คะแนน ${signedScore(n.d.score)})<br>เข้า ~<b>${p2(n.price)}</b> · ${levelsTxt(go.c, n.price, go.side)}${go.risky ? `<br>${CHARTSYS.riskText(go.c)} — ถ้าเข้า ใช้ขนาดเล็กกว่าปกติ` : ''}<br><small>ทดสอบย้อนหลังชนะ ${go.c.win}% · สัญญาณยืนยันเมื่อแท่งนี้ปิดแล้วคะแนนยังถึง</small>`;
    const [b, s] = [side(n, 1), side(n, -1)], bl = blockers(n);
    const best = [b, s].filter((x) => x.tested).sort((a, c) => c.pct - a.pct)[0];
    let t = `⏸ <b>ยังไม่ควรเข้า</b> — กรอบ ${nameOf(n.tf)} (${dirTxt(n)}): Buy ${b.pct}% · Sell ${s.pct}% (ต้องถึง 100%)`;
    if (bl.length) t += `<br>${bl.join('<br>')}`;
    if (best && best.pct >= 60 && !n.br) t += `<br>ใกล้ที่สุดคือฝั่ง ${sideName(best.side)} — ขาดอีก ${need(n, best)} คะแนน`;
    else t += '<br>ตอนนี้ไม่มีฝั่งไหนใกล้จุดเข้า — รอดีกว่าครับ';
    return t;
  }
  function ansWhy(n) {
    const h = holding(n); if (h) return h;
    const sy = sysOf(n), d = n.d, B = sy.buy, S = sy.sell;
    const fr = d.frames.map((f) => `${f.label}: <b>${INV.trendTh(f.trend)}</b> (${signedScore(({ strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2 })[f.trend] || 0)})`).join(' · ');
    let t = `<b>ทำไมกรอบ ${nameOf(n.tf)} ยังไม่เข้า</b><br>คะแนนรวม <b>${signedScore(d.score)}</b> จาก ${fr}`;
    t += `<br>• Buy ต้องได้ +${B.th}${B.confirm ? ` และ ${CHARTSYS.CONFIRM[B.confirm].name} ยืนยันขาขึ้น` : ''} → ${side(n, 1).go ? '✅ ถึงแล้ว' : `ขาดอีก ${need(n, side(n, 1))} คะแนน`}`;
    t += S ? `<br>• Sell ต้องได้ −${S.th}${S.confirm ? ` และ ${CHARTSYS.CONFIRM[S.confirm].name} ยืนยันขาลง` : ''} → ${side(n, -1).go ? '✅ ถึงแล้ว' : `ขาดอีก ${need(n, side(n, -1))} คะแนน`}`
      : `<br>• Sell: กรอบนี้ไม่มีสัญญาณขาย (ทดสอบย้อนหลังขาดทุน) — Sell มีแค่กรอบ 5 นาที (⚠️ สัญญาณเสี่ยง)`;
    const bl = blockers(n);
    if (bl.length) t += `<br>${bl.join('<br>')}`;
    t += `<br><small>คะแนนแต่ละกรอบ: ขาขึ้นแรง +2 · ขาขึ้น +1 · แกว่ง 0 · ขาลง −1 · ขาลงแรง −2 — ระบบเข้าเมื่อหลายกรอบเห็นตรงกัน</small>`;
    return t;
  }
  function ansSide(n, s) {
    const h = holding(n); if (h) return h;
    const x = side(n, s), c = x.c || sysOf(n).buy, z = zonesNear(n), a = atrOf(n);
    const name = s > 0 ? 'ซื้อ' : 'ขาย';
    let t = `${sideName(s)} · กรอบ ${nameOf(n.tf)}: ความพร้อม <b>${x.pct}%</b> · ${x.verdict}`;
    const risk = x.risky ? `<br>${CHARTSYS.riskText(x.c)} — Buy ที่กำไรครบทุกช่วงทดสอบ: กรอบ 1 ชม. · 5 ชม. · 1 วัน` : '';
    if (x.go) return `${t}<br>${x.risky ? '⚠️ มีสัญญาณ' : '✅ เข้าได้ตอนนี้'}ที่ ~<b>${p2(n.price)}</b> · ${levelsTxt(c, n.price, s)}${risk}`;
    t += risk;
    if (!x.tested) t += `<br>⚠️ ฝั่ง${name}ของกรอบนี้ ${CHARTSYS.whyNo(x.c)}${s < 0 && n.tf !== '5m' ? ' — Sell มีแค่กรอบ 5 นาที (⚠️ เสี่ยง)' : ''}`;
    else if (!n.br) t += `<br>ขาดอีก ${need(n, x)} คะแนน${c.confirm ? ` และต้องมี ${CHARTSYS.CONFIRM[c.confirm].name} ยืนยัน` : ''}`;
    const zone = s > 0 ? z.buy : z.sell, spots = [];
    if (zone) spots.push(`โซน${s > 0 ? 'ซื้อ (แนวรับ)' : 'ขาย (แนวต้าน)'} <b>${zTxt(zone)}</b> — ห่างจากราคาตอนนี้ ${p2(Math.abs((s > 0 ? zone.top : zone.bottom) - n.price))} ดอลลาร์`);
    if (n.env) spots.push(`ขอบ${s > 0 ? 'ล่าง' : 'บน'}กรอบราคา <b>${p2(s > 0 ? n.env.lo : n.env.up)}</b>`);
    if (spots.length) t += `<br>📍 จุดรอ${name}ที่ดีกว่า:<br>• ${spots.join('<br>• ')}`;
    const opp = s > 0 ? z.sell : z.buy;
    if (opp && Math.abs((s > 0 ? opp.bottom : opp.top) - n.price) < 1.5 * a) t += `<br>🚫 อย่า${name}ตอนนี้: ราคาอยู่ใกล้โซน${s > 0 ? 'ขาย' : 'ซื้อ'} ${zTxt(opp)} — มักถูก${s > 0 ? 'กดลง' : 'ดันขึ้น'}`;
    t += `<br><small>ถึงราคาถึงจุดรอแล้ว ก็ยังต้องรอให้ความพร้อมถึง 100% ก่อน (ระบบเข้าตามคะแนน ไม่ใช่ตามราคาอย่างเดียว)</small>`;
    return t;
  }
  function ansAvoid(n) {
    const z = zonesNear(n), out = [], sy = sysOf(n);
    if (z.sell) out.push(`🚫 อย่า<b>ซื้อ</b>ใกล้ <b>${zTxt(z.sell)}</b> (โซนขาย/แนวต้านเหนือราคา) — ราคามักถูกกดลงตรงนั้น`);
    if (z.buy) out.push(`🚫 อย่า<b>ขาย</b>ใกล้ <b>${zTxt(z.buy)}</b> (โซนซื้อ/แนวรับใต้ราคา) — ราคามักเด้งขึ้นตรงนั้น`);
    if (n.env) out.push(`🚫 อย่าไล่ซื้อเหนือ <b>${p2(n.env.up)}</b> หรือไล่ขายใต้ <b>${p2(n.env.lo)}</b> (นอกกรอบราคา) — มักย่อกลับเข้ากรอบ`);
    nextNews().slice(0, 3).forEach((x) => out.push(`🚫 อย่าเปิดรายการช่วง <b>${hhmm(x.time - 30 * 60e3)}–${hhmm(x.time + 30 * 60e3)} น.</b> — ข่าว ${esc(x.title)}`));
    const [b, s] = [side(n, 1), side(n, -1)];
    if (!b.tested) out.push(`🚫 ฝั่งซื้อกรอบ ${nameOf(n.tf)} ${b.off ? 'ปิดจุดเข้าแล้ว — ใช้กรอบ 1 ชม. / 5 ชม. / 1 วัน' : 'ทดสอบไม่ผ่าน'}`);
    if (b.risky) out.push(`⚠️ ฝั่งซื้อกรอบ ${nameOf(n.tf)} เป็นสัญญาณเสี่ยง (ช่วงทดสอบล่าสุดไม่กำไร)`);
    if (!s.tested) out.push(`🚫 ฝั่งขายกรอบ ${nameOf(n.tf)} ${s.off ? 'ปิดจุดเข้าแล้ว' : 'ทดสอบไม่ผ่าน'} — ไม่มีสัญญาณ Sell ในกรอบนี้`);
    if (n.d.score <= -sy.buy.th / 2) out.push(`🚫 แนวโน้มลง (คะแนน ${signedScore(n.d.score)}) — อย่าซื้อสวนเทรนด์`);
    if (n.d.score >= sy.buy.th / 2) out.push(`🚫 แนวโน้มขึ้น (คะแนน ${signedScore(n.d.score)}) — อย่าขายสวนเทรนด์`);
    return `<b>ตำแหน่งที่ไม่ควรเข้า · กรอบ ${nameOf(n.tf)}</b> (ราคาตอนนี้ ${p2(n.price)})<br>${[...blockers(n), ...out].join('<br>') || 'ตอนนี้ไม่มีจุดอันตรายเด่น ๆ — แต่ยังต้องรอสัญญาณ 100% ก่อนเข้า'}`;
  }
  function ansSLTP(n) {
    const h = holding(n); if (h) return h;
    const rows = n.sides.map((x) => { const c = x.c || sysOf(n).buy, L = CHARTSYS.levelsFor(c, n.price, x.side);
      return `${sideName(x.side)} ${L.dip ? `รอเข้าที่ ${p2(L.entry)} (รอราคา${x.side > 0 ? 'ย่อ' : 'เด้งขึ้น'} $${L.dip} ภายใน ${L.dipH < 1 ? `${Math.round(L.dipH * 60)} นาที` : `${L.dipH} ชม.`} · ไม่ถึง = ยกเลิก)` : `ถ้าเข้าที่ ${p2(n.price)}`} → SL <b>${p2(L.sl)}</b> (−$${Math.round(15 * c.mult)}) · ${L.tps.map((v, k) => `TP${k + 1} <b>${p2(v)}</b> (+$${CHARTSYS.usdList(c)[k]})`).join(' · ')}${x.tested ? '' : x.off ? ' ⏸ ฝั่งนี้ปิดจุดเข้า' : ' ⚠️ ฝั่งนี้ทดสอบไม่ผ่าน'}`; });
    return `<b>SL / TP ของระบบกรอบ ${nameOf(n.tf)}</b><br>${rows.join('<br>')}<br><small>ตัวเลขต่อทอง 1 ออนซ์ (0.01 lot) · ใช้ปุ่ม 🧮 บนการ์ดเพื่อคำนวณ lot ตามทุน</small>`;
  }
  function ansLevels(n) {
    const z = zonesNear(n), lv = n.pivots.slice().sort((a, b) => b.price - a.price);
    const up = lv.filter((x) => x.price > n.price).slice(-3), dn = lv.filter((x) => x.price <= n.price).slice(0, 3);
    let t = `<b>แนวรับ–แนวต้าน · กรอบ ${nameOf(n.tf)}</b> (ราคา ${p2(n.price)})`;
    if (z.sell) t += `<br>🟥 โซนขายใกล้สุด: <b>${zTxt(z.sell)}</b>`;
    if (up.length) t += `<br>⬆️ แนวต้าน: ${up.map((x) => `${esc(x.name)} <b>${p2(x.price)}</b>`).join(' · ')}`;
    if (dn.length) t += `<br>⬇️ แนวรับ: ${dn.map((x) => `${esc(x.name)} <b>${p2(x.price)}</b>`).join(' · ')}`;
    if (z.buy) t += `<br>🟩 โซนซื้อใกล้สุด: <b>${zTxt(z.buy)}</b>`;
    if (n.env) t += `<br>〰 กรอบราคา: ${p2(n.env.lo)} – ${p2(n.env.up)} (กลาง ${p2(n.env.mid)})`;
    if (!z.sell && !z.buy && !n.env) t += '<br>ยังมีแท่งเทียนไม่พอจะหาโซน ลองใหม่อีกสักครู่';
    return t;
  }
  function ansStats(n) {
    const sy = sysOf(n), fin = n.live.filter((r) => SIG.isFinal(r));
    const row = (name, c, k) => {
      const mine = fin.filter((r) => (r.side === 'SELL') === (k === 'SELL')), w = mine.filter((r) => r.pnl > 0).length, pnl = mine.reduce((a, r) => a + (r.pnl || 0), 0);
      const real = mine.length ? `ผลจริง ${mine.length} รายการ ชนะ ${w} (${Math.round((w / mine.length) * 100)}%) ${pnl >= 0 ? '+' : '−'}$${Math.abs(SIG.round(pnl))}` : 'ผลจริง: ยังไม่มีรายการ';
      if (!c) return `• ${name}: ❌ ทดสอบขาดทุน — ไม่ให้สัญญาณ${sy.sellQ ? ` (${sy.sellQ.map((v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v)}`).join(' / ')})` : ''}`;
      return `• ${name}${c.off ? ` ⏸ ปิดจุดเข้า (${c.off})` : c.risky ? ' ⚠️ เสี่ยง' : ''}: ทดสอบ ${sy.span} ชนะ <b>${c.win}%</b> · 4 ช่วง ${c.q.map((v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v)}`).join(' / ')}<br>&nbsp;&nbsp;${real}`;
    };
    return `<b>ความแม่นยำ · กรอบ ${nameOf(n.tf)}</b><br>${row('🟢 Buy', sy.buy, 'BUY')}<br>${row('🔴 Sell', sy.sell, 'SELL')}<br><small>ทดสอบหลังหักสเปรด $0.4 · ผลจริง = รายการที่ระบบบันทึกตั้งแต่เริ่มบันทึก (ต่อทอง 1 ออนซ์) · รายการน้อยยังสรุปไม่ได้</small>`;
  }
  function ansPrice(n, px, s) {
    const a = atrOf(n);
    if (!s) s = px <= n.price ? 1 : -1;
    const x = side(n, s), c = x.c || sysOf(n).buy, name = s > 0 ? 'ซื้อ' : 'ขาย';
    if (Math.abs(px - n.price) > 40 * a) return `ราคา ${p2(px)} ห่างจากราคาตอนนี้ (${p2(n.price)}) มากเกินไปสำหรับกรอบ ${nameOf(n.tf)} — ลองเลือกกรอบใหญ่ขึ้น แล้วถามใหม่`;
    const inZ = (sd) => n.zones.find((q) => q.side === sd && px >= q.bottom - a * 0.3 && px <= q.top + a * 0.3);
    const good = [], bad = [], e = n.env;
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
    if (!x.tested) bad.push(`ฝั่ง${name}กรอบ ${nameOf(n.tf)} ${CHARTSYS.whyNo(x.c)}`);
    if (x.risky) bad.push(CHARTSYS.riskText(x.c));
    if (n.br) bad.push(`ระบบกรอบนี้พักอยู่: ${n.br.why}`);
    const verdict = bad.length ? `🚫 <b>ไม่ควร${name}ที่ ${p2(px)}</b>` : good.length ? `👍 <b>${p2(px)} เป็นจุดรอ${name}ที่ดี</b>` : `🤔 <b>${p2(px)} เป็นจุดกลาง ๆ</b> — ไม่ใช่แนวรับ/แนวต้านเด่น`;
    let t = `${verdict} · กรอบ ${nameOf(n.tf)} (ราคาตอนนี้ ${p2(n.price)})`;
    if (bad.length) t += `<br>• ${bad.join('<br>• ')}`;
    if (good.length) t += `<br>• ${good.join('<br>• ')}`;
    if (!bad.length) t += `<br>ถ้า${name}ที่ ${p2(px)}: ${levelsTxt(c, px, s)}`;
    t += `<br>สถานะระบบตอนนี้: ${name} ${x.pct}% · ${x.verdict}<br><small>ถึงราคาแล้วยังต้องรอความพร้อม 100% — ถามใหม่ตอนราคาไปถึงได้ครับ</small>`;
    return t;
  }

  // ---------- across 5m / 15m / 30m / 1h ----------
  async function snapAll() { return (await Promise.all(CHAT_TFS.map((tf) => snap(tf).catch(() => null)))).map((n, i) => ({ tf: CHAT_TFS[i], n })); }
  const pctTxt = (x) => `${x.pct}%${x.go ? ' ✅' : !x.tested ? ' ⚠️' : ''}`;
  async function ansAll() {
    const all = await snapAll();
    const rows = all.map(({ tf, n }) => {
      if (!n) return `• <b>${nameOf(tf)}</b>: กำลังโหลดข้อมูล…`;
      if (n.open) return `• <b>${nameOf(tf)}</b> ${dirTxt(n)} · 📌 ถือ${n.open.side === 'SELL' ? 'ขาย' : 'ซื้อ'}อยู่ (เข้า ${p2(n.open.entry)})`;
      const [b, s] = [side(n, 1), side(n, -1)];
      return `• <b>${nameOf(tf)}</b> ${dirTxt(n)} · คะแนน ${signedScore(n.d.score)} · Buy ${pctTxt(b)} · Sell ${pctTxt(s)}${n.br ? ' · ⛔ พัก' : ''}${n.d.news && !sysOf(n).long && sysOf(n).news ? ' · 📰 งดช่วงข่าว' : ''}`;
    });
    const ok = all.filter((r) => r.n);
    const go = ok.flatMap(({ n }) => n.sides.filter((x) => x.go).map((x) => ({ n, x })));
    const hold = ok.filter(({ n }) => n.open);
    let rec;
    if (go.length) rec = go.map(({ n, x }) => `✅ <b>กรอบ ${nameOf(n.tf)} ควรเข้า ${x.side > 0 ? 'Buy' : 'Sell'}</b> ที่ ~${p2(n.price)} · ${levelsTxt(x.c, n.price, x.side)}`).join('<br>');
    else {
      const near = ok.flatMap(({ n }) => n.open || n.br ? [] : n.sides.filter((x) => x.tested).map((x) => ({ n, x }))).sort((a, b) => b.x.pct - a.x.pct)[0];
      rec = `⏸ <b>ยังไม่มีกรอบไหนถึงจุดเข้า</b>${near ? ` — ใกล้สุดคือ ${near.x.side > 0 ? 'Buy' : 'Sell'} กรอบ ${nameOf(near.n.tf)} (${near.x.pct}%, ขาดอีก ${need(near.n, near.x)} คะแนน)` : ''}`;
    }
    if (hold.length) rec += `<br>📌 ถือสถานะอยู่: ${hold.map(({ n }) => `กรอบ ${nameOf(n.tf)} ${n.open.side === 'SELL' ? 'ขาย' : 'ซื้อ'}`).join(' · ')}`;
    const ups = ok.filter(({ n }) => (window.CZ_FDIR ? CZ_FDIR(n.d) : 0) > 0).length, downs = ok.filter(({ n }) => (window.CZ_FDIR ? CZ_FDIR(n.d) : 0) < 0).length;
    const mood = ups === ok.length ? 'ทุกกรอบชี้ขึ้น — ฝั่งซื้อได้เปรียบ' : downs === ok.length ? 'ทุกกรอบชี้ลง — ฝั่งขายได้เปรียบ (Sell มีแค่กรอบ 5 นาที — ⚠️ สัญญาณเสี่ยง)' : 'กรอบเล็กกับกรอบใหญ่ไม่ตรงกัน — ระวังสวนทาง รอให้ตรงกันก่อน';
    return `<b>สรุป 4 กรอบ</b> (ราคา ${p2(nowPrice())})<br>${rows.join('<br>')}<br>${rec}<br>🧭 ${mood}<br><small>% = ความพร้อมเข้า (100% = ถึงจุดเข้า) · ⚠️ = ฝั่งที่ทดสอบไม่ผ่าน ไม่ให้สัญญาณ</small>`;
  }
  async function ansBest(s) {
    const all = (await snapAll()).filter((r) => r.n);
    const name = s > 0 ? 'Buy' : 'Sell';
    const rows = all.map(({ n }) => ({ n, x: side(n, s) })).sort((a, b) => (b.x.go - a.x.go) || (b.x.tested - a.x.tested) || (b.x.pct - a.x.pct));
    const tested = rows.filter((r) => r.x.tested);
    let t = `<b>${s > 0 ? '🟢' : '🔴'} ${name} กรอบไหนดี</b>`;
    rows.forEach(({ n, x }) => {
      const c = x.c;
      t += `<br>• <b>${nameOf(n.tf)}</b>: ${n.open ? `📌 ถือ${n.open.side === 'SELL' ? 'ขาย' : 'ซื้อ'}อยู่` : `${x.pct}% · ${x.verdict}`}${c ? ` · ทดสอบชนะ ${c.win}% · SL $${Math.round(15 * c.mult)} TP $${CHARTSYS.usdList(c).join('/')}` : ' · ทดสอบขาดทุน'}`;
    });
    const go = tested.find((r) => r.x.go && !r.n.open);
    if (go) t += `<br>✅ <b>เข้า ${name} กรอบ ${nameOf(go.n.tf)} ได้ตอนนี้</b> ที่ ~${p2(go.n.price)} · ${levelsTxt(go.x.c, go.n.price, s)}`;
    else if (tested.length) { const b = tested.filter((r) => !r.n.open && !r.n.br)[0]; t += b ? `<br>⏸ ยังไม่มีกรอบไหนถึงจุดเข้า — ใกล้สุดคือ ${nameOf(b.n.tf)} (${b.x.pct}%, ขาดอีก ${need(b.n, b.x)} คะแนน)` : ''; }
    else t += `<br>⚠️ ไม่มีกรอบไหนที่ ${name} ทดสอบผ่าน`;
    if (s < 0) t += `<br><small>Sell มีแค่กรอบ 5 นาที ซึ่งติดป้าย ⚠️ เสี่ยง (ผลจริงชนะ 4 จาก 14) · จุดเข้าที่ผ่านการทดสอบทุกช่วง: Buy กรอบ 1 ชม. / 5 ชม. / 1 วัน</small>`;
    return t;
  }
  function ansNews() {
    const nw = nextNews(24 * 3600e3), t = Date.now(), w = INTRA.RULE.newsMin * 60e3;
    if (!nw.length) return 'ไม่มีข่าวแรงสหรัฐใน 24 ชม. ข้างหน้า ✅ (ดูทั้งสัปดาห์ได้ที่แท็บ 📰 ข่าวสหรัฐ)';
    return `<b>📰 ข่าวแรงสหรัฐ</b><br>${nw.slice(0, 5).map((x) => `• <b>${hhmm(x.time)} น.</b> ${esc(x.title)} — ${Math.abs(x.time - t) <= w ? '⚠️ อยู่ในช่วงข่าวตอนนี้' : x.time > t ? `อีก ${mins(x.time - t)}` : 'เพิ่งออก'}`).join('<br>')}<br><small>กรอบ 5 นาที และ 1 ชม. งดเข้า ±30 นาทีรอบข่าว (ทดสอบแล้วว่าช่วย) · 15 และ 30 นาทีไม่งด (ทดสอบแล้วไม่ช่วย) แต่ราคาจะกระชากแรง ควรระวัง</small>`;
  }
  function ansTfs() {
    const t = Date.now(), live = ((state.chartSig && state.chartSig.trades) || []).filter((r) => !SIG.isFinal(r) && (r.expiresAt || Infinity) > t);
    if (!live.length) return 'ตอนนี้ไม่มีกรอบเวลาไหนถือสถานะอยู่ — ทุกกรอบรอสัญญาณ (ถาม “สรุป 4 กรอบ” เพื่อดูว่ากรอบไหนใกล้เข้า)';
    return `<b>รายการที่ระบบถืออยู่ (ทุกกรอบ)</b><br>${live.map((r) => `• กรอบ ${nameOf(r.tf)}: ${r.side === 'SELL' ? '🔴 ขาย' : '🟢 ซื้อ'} ที่ ${p2(r.entry)} · SL ${p2(r.hit ? r.entry : r.sl)} · TP ${r.tps.map(p2).join(' / ')}`).join('<br>')}`;
  }

  // ---------- understanding the question ----------
  function tfIn(s) {
    if (/(^|[^\d])15 ?(นาที|น\.|m\b|min)/.test(s)) return '15m';
    if (/(^|[^\d])30 ?(นาที|น\.|m\b|min)/.test(s)) return '30m';
    if (/(^|[^\d])5 ?(นาที|น\.|m\b|min)/.test(s)) return '5m';
    if (/(^|[^\d])1 ?(ชม|ชั่วโมง|h\b|hr)|ชั่วโมง/.test(s)) return '1h';
    return null;
  }
  function intent(text) {
    const s = text.toLowerCase();
    const num = (s.replace(/,/g, '').match(/\d{3,5}(?:\.\d+)?/g) || []).map(Number).find((v) => v > 500);
    const sell = /ขาย|sell|short|ชอร์ต|ช็อต/.test(s), buy = /ซื้อ|buy|long/.test(s), tf = tfIn(s);
    const which = /กรอบไหน|ไทม์เฟรมไหน|tf ?ไหน|timeframe ?ไหน/.test(s);
    if (num) return { k: 'price', px: num, s: sell && !buy ? -1 : buy && !sell ? 1 : 0, tf };
    if (/สรุป|ทุกกรอบ|ทั้งหมด|ภาพรวม|4 ?กรอบ/.test(s)) return { k: 'all' };
    if (which && sell && !buy) return { k: 'bestsell' };
    if (which && buy && !sell) return { k: 'bestbuy' };
    if (which) return { k: 'all' };
    if (/ข่าว|news|cpi|nfp|fed|เฟด/.test(s)) return { k: 'news' };
    if (/ทำไม|เพราะ|why|ขาดอีก|เหตุผล/.test(s)) return { k: 'why', tf };
    if (/แม่น|ทดสอบ|ชนะ|ผลจริง|สถิติ|win/.test(s)) return { k: 'stats', tf };
    if (/ไม่ควร|ห้าม|อันตราย|หลีกเลี่ยง|อย่า|ไม่เข้า|เลี่ยง/.test(s)) return { k: 'avoid', tf };
    if (/\bsl\b|\btp\b|ตัดขาดทุน|ทำกำไร|เป้า|stop|take ?profit/.test(s)) return { k: 'sltp', tf };
    if (/แนวรับ|แนวต้าน|โซน|support|resist/.test(s)) return { k: 'levels', tf };
    if (/ถือไม้|ไม้ที่เปิด|ไม้ที่ถือ|ถือสถานะ|รายการที่ถือ|รายการที่เปิด/.test(s)) return { k: 'tfs' };
    if (sell && !buy) return { k: 'sell', tf };
    if (buy && !sell) return { k: 'buy', tf };
    return { k: 'now', tf };
  }
  const ONE = { now: ansNow, why: ansWhy, buy: (n) => ansSide(n, 1), sell: (n) => ansSide(n, -1), avoid: ansAvoid, sltp: ansSLTP, levels: ansLevels, stats: ansStats };
  let busy = false;
  async function ask(text, key) {
    if (busy) return;
    busy = true;
    say('me', esc(text));
    const q = key ? { k: key } : intent(text);
    const tf = q.tf || target || state.tf;
    say('bot', '<span class="cc-typing">กำลังดูกราฟ…</span>');
    const wait = log.lastElementChild;
    let out;
    try {
      if (!state.bars.length) out = 'กราฟยังโหลดไม่เสร็จ รอสักครู่แล้วถามใหม่ครับ';
      else if (q.k === 'all') out = await ansAll();
      else if (q.k === 'bestbuy') out = await ansBest(1);
      else if (q.k === 'bestsell') out = await ansBest(-1);
      else if (q.k === 'news') out = ansNews();
      else if (q.k === 'tfs') out = ansTfs();
      else {
        const n = await snap(tf);
        if (!n) out = `ระบบกรอบ ${nameOf(tf)} ยังคำนวณไม่เสร็จ (รอข้อมูลกรอบใหญ่) ลองใหม่ในไม่กี่วินาทีครับ`;
        else out = q.k === 'price' ? ansPrice(n, q.px, q.s) : ONE[q.k](n);
      }
    } catch (e) { console.error(e); out = 'ขอโทษครับ ตอบคำถามนี้ไม่ได้ตอนนี้ ลองกดคำถามด้านล่างแทน'; }
    const at = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
    const scope = ['all', 'bestbuy', 'bestsell', 'news', 'tfs'].includes(q.k) ? 'กรอบ 5 / 15 / 30 นาที · 1 ชม.' : `กรอบ ${esc(nameOf(tf))}`;
    wait.innerHTML = `${out}<span class="cc-at">${at} น. · ${scope}</span>`;
    log.scrollTop = log.scrollHeight;
    paintTfs();
    busy = false;
  }
  window.CC_ASK = ask; // tests
  // The gold dashboard's "สัญญาณ Gold Signal ตอนนี้" card (zframes/site-cards.js) reads the same four timeframes as
  // "สรุป 4 กรอบ" here — plain numbers only
  window.GS_SIGNALS = async () => (await snapAll()).map(({ tf, n }) => {
    if (!n) return { tf, label: nameOf(tf), loading: true };
    const side = (s) => { const x = n.sides.find((y) => y.side === s); return { pct: x.pct, verdict: x.verdict, go: x.go, tested: x.tested }; };
    return { tf, label: nameOf(tf), price: n.price, score: n.d.score, dir: window.CZ_FDIR ? CZ_FDIR(n.d) : 0,
      buy: side(1), sell: side(-1), open: n.open ? { side: n.open.side, entry: n.open.entry, sl: n.open.hit ? n.open.entry : n.open.sl, tps: n.open.tps } : null,
      pause: n.br ? n.br.why : null, news: !!(n.d.news && sysOf(n).news) };
  });
})();
