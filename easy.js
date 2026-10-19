// 💡 Easier to understand (user, 17 Oct 2026: "อยากปรับให้มันดูเข้าใจง่ายมากขึ้นอีกหน่อย" → all four):
//  1. #easySum — one plain-words answer on top of the signals tab: what to do now + the numbers to use (from main.js
//     renderIntra → state.easy, the same decision as the main card, nothing new decided here)
//  2. glossary — trade words (SL, TP, Bollinger, คะแนน…) get a dotted underline + ⓘ; tap → a short plain explanation
//  3. easy / trader mode — html.easy hides the advanced blocks (.adv: score gauge, reasons, donuts); remembered per device,
//     easy by default for new devices; the button sits in the top bar
//  4. a first-visit tour (5 steps, skippable, once per device; "ดูทัวร์อีกครั้ง" in the account tab)
// Loaded after main.js / chartzones.js. Touches no signal logic.
(function () {
  const $ = (id) => document.getElementById(id);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ok */ } } };
  const f2 = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const usd = (v) => `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v * 100) / 100).toLocaleString('en-US')}`;
  const tfName = (tf) => ({ '5m': '5 นาที', '15m': '15 นาที', '30m': '30 นาที', '1h': '1 ชม.', '5h': '5 ชม.', '1d': '1 วัน', '1w': '1 สัปดาห์' }[tf] || tf);
  const hhmm = (t) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

  // ---------- 1. one-line answer ----------
  window.renderEasy = function () {
    const box = $('easySum'), e = typeof state !== 'undefined' && state.easy;
    if (!box || !e) return;
    const main = tfName(CHARTSYS.MAIN_TF);
    let icon, title, lines = [], cls = 'wait';
    if (e.open) {
      const o = e.open, d = o.side === 'SELL' ? -1 : 1, pl = e.price != null ? d * (e.price - o.entry) : null;
      icon = '📌'; cls = d > 0 ? 'buy' : 'sell';
      title = `ระบบถือสถานะ${d > 0 ? 'ซื้อ (Buy)' : 'ขาย (Sell)'} อยู่ — ถือต่อตามแผน ไม่ต้องเปิดรายการใหม่`;
      lines.push(`เข้าที่ <b>${f2(o.entry)}</b> · <span data-term="SL">ตัดขาดทุน</span> <b>${f2(o.hit ? o.entry : o.sl)}</b>${o.hit ? ' (ย้ายมาที่ทุนแล้ว)' : ''} · <span data-term="TP">เป้ากำไร</span> <b>${f2(o.tps[Math.min(o.hit || 0, o.tps.length - 1)])}</b>`);
      if (pl != null) lines.push(`ตอนนี้ <b class="${pl >= 0 ? 'up' : 'down'}">${usd(pl)}</b> ต่อทอง 1 ออนซ์`);
    } else if (e.pause) {
      icon = '⛔'; title = 'ระบบพักชั่วคราว — ไม่แนะนำเปิดรายการใหม่';
      lines.push(`เหตุผล: ${e.pause.reason} · ระบบยังติดตามต่อ แล้วจะกลับมาให้สัญญาณเอง`);
    } else if (e.closed) {
      icon = '🌙'; title = 'ตลาดทองปิดอยู่ — ยังไม่มีอะไรต้องทำ';
      lines.push(`ตลาดเปิดอีกครั้ง ${new Date(e.nextOpen).toLocaleDateString('th-TH', { weekday: 'long', timeZone: 'Asia/Bangkok' })} ${hhmm(e.nextOpen)} น.`);
    } else if (e.late) {
      icon = '⏳'; title = 'กำลังอ่านกราฟล่าสุด…';
    } else if (e.go) {
      const d = e.go, c = d > 0 ? e.sys.buy : e.sys.sell, L = CHARTSYS.levelsFor(c, e.price, d);
      icon = '✅'; cls = d > 0 ? 'buy' : 'sell';
      title = L.dip ? `${d > 0 ? 'ซื้อ (Buy)' : 'ขาย (Sell)'} — รอราคา${d > 0 ? 'ย่อลง' : 'เด้งขึ้น'}มาที่ <b>${f2(L.entry)}</b> (ภายใน ${L.dipH} ชม.)` : `${d > 0 ? 'ซื้อ (Buy)' : 'ขาย (Sell)'} ได้ตอนนี้ ที่ราว <b>${f2(e.price)}</b>`;
      lines.push(`<span data-term="SL">ตัดขาดทุน</span> <b>${f2(L.sl)}</b> · <span data-term="TP">เป้ากำไร</span> <b>${L.tps.map(f2).join(' / ')}</b>`);
      lines.push('เสี่ยงไม่เกิน 1–2% ของทุนต่อรายการ <a href="#chart">→ คำนวณขนาดการซื้อขาย (lot) ที่หน้ากราฟ</a>');
    } else if (e.news) {
      icon = '⏸'; title = 'รอก่อน — ช่วงข่าวเศรษฐกิจสหรัฐแรง';
      lines.push('ราคามักกระชากแรงช่วงนี้ ระบบงดเข้า ±30 นาที แล้วค่อยดูใหม่');
    } else {
      const best = [...(e.sides || [])].filter((x) => x.tested).sort((a, b) => b.pct - a.pct)[0];
      icon = '⏸'; title = e.near ? `ใกล้ถึงจุดเข้าแล้ว — รอแท่งเทียนปิด ${hhmm(e.next)} น.` : 'รอก่อน — ตอนนี้ยังไม่มีจุดเข้า';
      if (best) lines.push(`ใกล้สุด: ${best.side > 0 ? 'Buy' : 'Sell'} กรอบ ${main} ได้ <span data-term="ความพร้อมเข้า">${best.pct}%</span> (ต้องถึง 100%)`);
      lines.push('ไม่ต้องเฝ้าจอ — ระบบแจ้ง LINE และบนมือถือทันทีที่ถึงจุดเข้า');
    }
    box.hidden = false;
    box.className = `card easy-sum ${cls}`;
    box.innerHTML = `<div class="es-k">ตอนนี้ควรทำอะไร? · ระบบหลัก ${main}</div><div class="es-t"><span class="es-i">${icon}</span><span>${title}</span></div>${lines.map((l) => `<div class="es-l">${l}</div>`).join('')}`;
    glossaryIn(box);
  };

  // ---------- 2. glossary ----------
  const TERMS = {
    SL: ['ตัดขาดทุน (SL · Stop Loss)', 'ราคาที่ปิดรายการให้อัตโนมัติเมื่อราคาวิ่งผิดทาง เพื่อไม่ให้ขาดทุนเกินที่ตั้งใจไว้ — ตั้งทุกรายการ ห้ามลืม'],
    TP: ['เป้ากำไร (TP · Take Profit)', 'ราคาที่ปิดรายการเอากำไร ระบบมีได้ 1–3 จุด (TP1/TP2/TP3) — ถึง TP1 แล้วย้ายตัดขาดทุนมาที่ทุน รายการนั้นจะไม่ขาดทุนอีก'],
    Buy: ['ซื้อ (Buy)', 'เปิดรายการเมื่อคาดว่าราคาทองจะขึ้น กำไรเมื่อราคาขึ้น'],
    Sell: ['ขาย (Sell)', 'เปิดรายการเมื่อคาดว่าราคาทองจะลง กำไรเมื่อราคาลง (ไม่ต้องมีทองอยู่ก่อน)'],
    'ความพร้อมเข้า': ['ความพร้อมเข้า (%)', 'ระบบให้คะแนนจากตัวชี้วัดหลายตัว แล้วบอกเป็น % ว่าใกล้จุดเข้าแค่ไหน — ถึง 100% และแท่งเทียนปิดแล้วยังถึง = มีสัญญาณ'],
    'คะแนน': ['คะแนนแนวโน้ม (−6 ถึง +6)', 'ผลโหวตของตัวชี้วัดจากหลายกรอบเวลา บวก = เอียงขึ้น ลบ = เอียงลง ยิ่งห่างจาก 0 ยิ่งชัด'],
    Bollinger: ['Bollinger Bands', 'เส้นกรอบบน–ล่างรอบราคาเฉลี่ย ราคาวิ่งหลุดกรอบมักย่อกลับ ระบบจึงไม่ไล่ซื้อ/ขายตอนราคายืดเกินกรอบ'],
    EMA: ['EMA (เส้นค่าเฉลี่ย)', 'เส้นราคาเฉลี่ยที่ให้น้ำหนักราคาล่าสุดมากกว่า ใช้ดูทิศทาง เช่น EMA 9 อยู่เหนือ EMA 21 = เอียงขึ้น'],
    lot: ['ขนาดการซื้อขาย (lot)', 'ปริมาณที่ซื้อขาย 1 lot ทอง = 100 ออนซ์ ราคาขยับ $1 = กำไร/ขาดทุน $100 — ใช้ปุ่ม 🧮 คำนวณ lot ให้พอดีกับทุน'],
    'กรอบเวลา': ['กรอบเวลา (Timeframe)', 'ความยาวของแท่งเทียน 1 แท่ง เช่น 1 ชม. กรอบเล็กสัญญาณบ่อยแต่เสี่ยงกว่า กรอบใหญ่สัญญาณน้อยแต่ชัดกว่า'],
    'สเปรด': ['สเปรด (Spread)', 'ส่วนต่างราคาซื้อ–ขายที่โบรกเกอร์คิด ทุกรายการเริ่มติดลบเล็กน้อยเท่าสเปรด ผลทดสอบหักไว้แล้ว $0.4 ต่อออนซ์'],
    'สัญญาณเสี่ยง': ['⚠️ สัญญาณเสี่ยง', 'กรอบ/ฝั่งที่ผลทดสอบช่วงล่าสุดหรือผลจริงยังไม่ดีพอ ยังแสดงจุดเข้า (กรอบ 5 นาที / 30 นาที / 1 ชม. ส่ง LINE พร้อมป้ายเสี่ยง) และควรใช้ขนาดเล็กกว่าปกติ'],
  };
  const WORDS = { 'ตัดขาดทุน': 'SL', 'เป้ากำไร': 'TP', 'Bollinger': 'Bollinger', 'ความพร้อมเข้า': 'ความพร้อมเข้า', 'SL': 'SL', 'TP1': 'TP', 'TP': 'TP', 'lot': 'lot', 'สัญญาณเสี่ยง': 'สัญญาณเสี่ยง', 'สเปรด': 'สเปรด', 'EMA': 'EMA' };
  const RX = new RegExp(`(${Object.keys(WORDS).sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  // wrap the FIRST occurrence of each word inside a container (no clutter); [data-term] spans written by code count too
  function glossaryIn(root) {
    if (!root || root.dataset.gl === '1' && root.querySelector('.gl')) return;
    root.querySelectorAll('[data-term]:not(.gl)').forEach((el) => el.classList.add('gl'));
    const seen = new Set([...root.querySelectorAll('.gl')].map((el) => el.dataset.term));
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (!n.parentElement || n.parentElement.closest('.gl, a, button, input, textarea, select, script, style, svg, canvas') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const todo = [];
    for (let n = walk.nextNode(); n; n = walk.nextNode()) { const m = n.nodeValue.match(RX); if (m && !seen.has(WORDS[m[1]])) { seen.add(WORDS[m[1]]); todo.push([n, m]); } }
    todo.forEach(([n, m]) => {
      const i = m.index, span = document.createElement('span');
      span.className = 'gl'; span.dataset.term = WORDS[m[1]]; span.textContent = m[1];
      const rest = n.splitText(i); rest.nodeValue = rest.nodeValue.slice(m[1].length); n.parentNode.insertBefore(span, rest);
    });
    root.dataset.gl = '1';
  }
  const pop = document.createElement('div');
  pop.className = 'gl-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog');
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('.gl');
    if (!t) { if (!ev.target.closest('.gl-pop')) pop.hidden = true; return; }
    ev.preventDefault(); ev.stopPropagation();
    const d = TERMS[t.dataset.term]; if (!d) return;
    if (!pop.isConnected) document.body.appendChild(pop);
    pop.innerHTML = `<b>${d[0]}</b><p>${d[1]}</p><button type="button" class="btn">เข้าใจแล้ว</button>`;
    pop.hidden = false;
    const r = t.getBoundingClientRect(), w = Math.min(320, innerWidth - 24);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2))}px`;
    const below = r.bottom + 10 + pop.offsetHeight < innerHeight;
    pop.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - pop.offsetHeight - 8)}px`;
    pop.querySelector('button').onclick = () => { pop.hidden = true; };
  }, true);
  addEventListener('scroll', () => { pop.hidden = true; }, { passive: true });
  // the cards re-render often: annotate them again shortly after each change (observer paused while wrapping)
  const AREAS = ['intraCard', 'tab-chart', 'recCard', 'dnBuy', 'dnSell'];
  let timer = 0;
  const mo = new MutationObserver(() => { if (!timer) timer = setTimeout(() => { timer = 0; scan(); }, 600); }); // throttle: the cards redraw every second
  function scan() { mo.disconnect(); AREAS.forEach((id) => { const el = $(id); if (el) { el.querySelectorAll('[data-gl]').forEach((x) => delete x.dataset.gl); delete el.dataset.gl; glossaryIn(el); } }); watch(); }
  function watch() { AREAS.forEach((id) => { const el = $(id); if (el) mo.observe(el, { childList: true, subtree: true }); }); }
  setTimeout(scan, 1500);

  // ---------- 3. easy / trader mode ----------
  const MODE = 'gs-mode';
  const setMode = (m) => {
    document.documentElement.classList.toggle('easy', m === 'easy');
    const b = $('modeBtn'); if (b) { b.textContent = m === 'easy' ? 'โหมดง่าย' : 'โหมดละเอียด'; b.title = m === 'easy' ? 'กดเพื่อดูแบบละเอียด' : 'กดเพื่อซ่อนรายละเอียด ดูแบบง่าย'; b.setAttribute('aria-pressed', m === 'easy'); }
    store.set(MODE, m);
  };
  setMode(store.get(MODE) || 'easy');
  const mb = $('modeBtn'); if (mb) mb.addEventListener('click', () => setMode(document.documentElement.classList.contains('easy') ? 'trader' : 'easy'));

  // ---------- 4. first-visit tour ----------
  const STEPS = [
    ['liveHero', 'ราคาทองสด', 'ราคา XAU/USD เปลี่ยนตามตลาดจริงเกือบทุกวินาที'],
    ['recCard', 'ผลจริงทุกรายการ', 'ทั้งรายการชนะและแพ้ที่ระบบบันทึกเอง — ใช้ตัดสินใจว่าจะเชื่อระบบแค่ไหน'],
    ['nav:chart', 'หน้ากราฟ', 'ดูจุดเข้า Buy/Sell บนกราฟทุกกรอบเวลา และถามจุดเข้าในแชทได้'],
    ['nav:account', 'แจ้งเตือน', 'ในแท็บบัญชี: เพิ่มเพื่อน LINE และเปิดแจ้งเตือนบนเครื่อง จะได้ไม่พลาดจุดเข้า'],
  ];
  const navEl = (tab) => [...document.querySelectorAll(`#tabbar a[data-tab="${tab}"]`)].find((a) => a.offsetParent);
  function tour(force) {
    if (!force && store.get('gs-tour') === '1') return;
    if (document.getElementById('welcome')) return setTimeout(() => tour(force), 1500); // after the first-payment guide
    if (location.hash && location.hash !== '#home') { if (!force) return; location.hash = '#home'; }
    let i = 0;
    const ov = document.createElement('div'); ov.className = 'tour';
    const hole = document.createElement('div'); hole.className = 'tour-hole';
    const tip = document.createElement('div'); tip.className = 'tour-tip';
    ov.append(hole, tip); document.body.appendChild(ov);
    const end = () => { ov.remove(); store.set('gs-tour', '1'); removeEventListener('resize', show); };
    function show() {
      const [id, title, text] = STEPS[i];
      const el = id.startsWith('nav:') ? navEl(id.slice(4)) : $(id);
      if (!el || !el.offsetParent) { if (++i < STEPS.length) return show(); return end(); }
      el.scrollIntoView({ block: id.startsWith('nav:') ? 'nearest' : 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect(), pad = 6;
      Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${Math.min(r.height, innerHeight * 0.6) + pad * 2}px` });
      tip.innerHTML = `<small>${i + 1} / ${STEPS.length}</small><b>${title}</b><p>${text}</p><div><button type="button" class="btn" data-t="skip">ข้าม</button><button type="button" class="btn gold" data-t="next">${i === STEPS.length - 1 ? 'เริ่มใช้งาน' : 'ถัดไป'}</button></div>`;
      const w = Math.min(320, innerWidth - 24); tip.style.width = `${w}px`;
      const below = r.bottom + 16 + 170 < innerHeight;
      tip.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2))}px`;
      tip.style.top = `${below ? Math.min(r.bottom + 14, innerHeight - 190) : Math.max(12, r.top - 184)}px`;
    }
    tip.addEventListener('click', (ev) => { const b = ev.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'skip' || ++i >= STEPS.length) return end(); show(); });
    addEventListener('resize', show);
    show();
  }
  window.gsTour = () => tour(true);
  // once the page is ready (splash gone, first data drawn)
  const ready = setInterval(() => { const s = $('splash'); if ((!s || s.classList.contains('gone')) && $('liveHero')) { /* was #easySum (removed 19 Oct 2026) */ clearInterval(ready); setTimeout(() => tour(false), 900); } }, 500);
})();
