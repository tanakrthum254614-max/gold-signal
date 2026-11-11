// Every tab as a control panel like the settings tab (11 Nov 2026, user: "ปรับทุกแทบ" → "ทุกหน้าเป็นแผงแบบหน้าตั้งค่า"):
// one .sp panel per tab, a topic menu on the left (click = scroll to that part, the part on screen is highlighted), the tab's
// existing content unchanged on the right. Topics whose part is hidden (easy mode, home-off …) drop out of the menu.
// Chart tab: the menu also switches แบบง่าย / แบบละเอียด. US stocks tab: the menu lists the dashboard sets and pages of the
// embedded zframes (it reports them with postMessage {zf:'zones'}; the menu answers {zf:'zone'} / {zf:'pick'}).
(function () {
  const $ = (id) => document.getElementById(id);
  const SVG = {
    signal: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
    chart: '<path d="M3 3v18h18"/><path d="M9 5v4"/><rect x="7" y="9" width="4" height="6" rx="1"/><path d="M9 15v2M17 3v2"/><rect x="15" y="5" width="4" height="8" rx="1"/><path d="M17 13v3"/>',
    grid: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
    answer: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    price: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    bars: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h8"/>',
    layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  };
  const ico = (k) => `<svg viewBox="0 0 24 24">${SVG[k] || SVG.dot}</svg>`;
  const pick = (q) => (typeof q === 'function' ? q() : document.querySelector(q));
  const shown = (el) => !!el && !el.hidden && el.offsetParent !== null && el.getClientRects().length > 0;

  const TABS = {
    home: { icon: 'signal', title: 'สัญญาณ', sub: 'ระบบหลัก 1 ชม. · ทองคำ XAU/USD', items: [
      { label: 'คำตอบเดียว', icon: 'answer', q: '#easySum' },
      { label: 'ราคาสด', icon: 'price', q: '#liveHero' },
      { label: 'แนวโน้มสด', icon: 'gauge', q: '#intraCard' },
      { label: 'ถ้าเข้าตอนนี้', icon: 'pie', q: '#tab-home .donuts' },
      { label: 'สัญญาณวันนี้', icon: 'list', q: '#todayCard' },
      { label: 'ผลจริงทุกรายการ', icon: 'check', q: '#recCard' },
    ] },
    stats: { icon: 'news', title: 'ข่าวสหรัฐ', sub: 'ข่าวทองคำ · ปฏิทินข่าวแรง', items: [
      { label: 'ข่าวล่าสุด', icon: 'news', q: '#nfCard' },
      { label: 'ข่าวแรงถัดไป', icon: 'clock', q: '#tab-stats .ns-hero' },
      { label: 'ข่าวที่จะออก', icon: 'cal', q: () => $('nsWeek') && $('nsWeek').closest('.card') },
      { label: 'ข่าวที่ออกแล้ว', icon: 'list', q: () => $('nsPast') && $('nsPast').closest('.card') },
      { label: 'สถิติข่าว', icon: 'bars', q: '#tab-stats .nc-stats' },
    ] },
    chart: { icon: 'chart', title: 'กราฟ', sub: 'จุดเข้า Buy / Sell ทุกกรอบเวลา', modes: true, items: [
      { label: 'กราฟและจุดเข้า', icon: 'chart', q: () => ($('chartPro') && !$('chartPro').hidden ? $('chartPro') : $('chartSimple')) },
      { label: 'ถามจุดเข้า', icon: 'answer', q: '#ccPanel' },
      { label: 'คำนวณขนาดการซื้อขาย', icon: 'calc', q: '#calcCard' },
    ] },
    zframes: { icon: 'grid', title: 'หุ้นสหรัฐ', sub: 'Nasdaq 100 · S&P 500 · หุ้นปันผล', zf: true, items: [] },
  };

  const panels = {};
  function build(key, cfg) {
    const tab = $(`tab-${key}`);
    if (!tab || tab.querySelector(':scope > .sp')) return;
    const sp = document.createElement('div'); sp.className = `sp tp tp-${key}`;
    const nav = document.createElement('nav'); nav.className = 'sp-nav'; nav.setAttribute('aria-label', `หัวข้อในหน้า${cfg.title}`);
    nav.innerHTML = `<div class="sp-brand">${ico(cfg.icon)}<div><b>${cfg.title}</b><small>${cfg.sub}</small></div></div>`
      + (cfg.modes ? `<div class="tp-group">มุมมอง</div><div class="tp-modes"><button type="button" data-mode="simple">แบบง่าย</button><button type="button" data-mode="pro">แบบละเอียด</button></div><div class="tp-group">หัวข้อ</div>` : '')
      + (cfg.zf ? '<div class="tp-group">ชุดหุ้น</div><div class="tp-sets"></div><div class="tp-group">หน้า</div><div class="tp-zones"></div>' : '')
      + cfg.items.map((it, i) => `<button type="button" data-tp="${i}">${ico(it.icon)}${it.label}</button>`).join('');
    const body = document.createElement('div'); body.className = 'sp-body';
    while (tab.firstChild) body.appendChild(tab.firstChild);
    sp.append(nav, body); tab.appendChild(sp);
    panels[key] = { cfg, nav, body };

    nav.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mode) { const m = document.querySelector(`#chartMode button[data-mode="${b.dataset.mode}"]`); if (m) m.click(); setTimeout(() => refresh(key), 50); return; }
      if (b.dataset.zone) { zfPost({ zf: 'zone', id: b.dataset.zone }); return; }
      if (b.dataset.set) { zfPost({ zf: 'pick', d: b.dataset.set }); return; }
      const it = cfg.items[+b.dataset.tp]; const el = it && pick(it.q);
      if (el) { lockUntil = Date.now() + 1200; mark(key, +b.dataset.tp); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }
  function mark(key, i) { panels[key].nav.querySelectorAll('button[data-tp]').forEach((b) => b.classList.toggle('on', +b.dataset.tp === i)); }
  // show only topics that are on screen in this mode; highlight the one nearest the top of the window
  function refresh(key) {
    const p = panels[key]; if (!p) return;
    p.cfg.items.forEach((it, i) => { const b = p.nav.querySelector(`button[data-tp="${i}"]`); if (b) b.hidden = !shown(pick(it.q)); });
    if (p.cfg.modes) { const pro = $('chartPro') && !$('chartPro').hidden; p.nav.querySelectorAll('.tp-modes button').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'pro') === pro)); }
    spy();
  }
  function current() { return Object.keys(panels).find((k) => { const t = $(`tab-${k}`); return t && !t.hidden; }); }
  let lockUntil = 0; // a clicked topic stays highlighted while the page scrolls to it
  function spy() {
    if (Date.now() < lockUntil) return;
    const key = current(); const p = key && panels[key]; if (!p || !p.cfg.items.length) return;
    let best = -1, bestTop = -Infinity;
    p.cfg.items.forEach((it, i) => { const el = pick(it.q); if (!shown(el)) return; const t = el.getBoundingClientRect().top; if (t <= 140 && t > bestTop) { bestTop = t; best = i; } });
    // at the bottom of the page the last parts can't reach the top: take the last one that is on screen
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) p.cfg.items.forEach((it, i) => { const el = pick(it.q); if (shown(el) && el.getBoundingClientRect().top < innerHeight * 0.8) best = i; });
    if (best < 0) best = p.cfg.items.findIndex((it) => shown(pick(it.q)));
    mark(key, best);
  }
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; spy(); }); }, { passive: true });

  // ---------- US stocks: the embedded dashboard reports its sets and pages ----------
  const zfFrame = () => $('zframesFrame');
  function zfPost(msg) { const f = zfFrame(); if (f && f.contentWindow) f.contentWindow.postMessage(msg, location.origin); }
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.zf !== 'zones') return;
    const p = panels.zframes; if (!p) return;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    p.nav.querySelector('.tp-sets').innerHTML = (e.data.sets || []).map((s) => `<button type="button" data-set="${esc(s.id)}" class="${s.id === e.data.set ? 'on' : ''}">${ico('layers')}${esc(s.label)}</button>`).join('');
    p.nav.querySelector('.tp-zones').innerHTML = (e.data.zones || []).map((z) => `<button type="button" data-zone="${esc(z.id)}" class="${z.id === e.data.on ? 'on' : ''}">${ico('dot')}${esc(z.label)}</button>`).join('');
  });
  function zfHello() { zfPost({ zf: 'hostnav' }); }

  function start() {
    Object.entries(TABS).forEach(([k, c]) => build(k, c));
    const f = zfFrame(); if (f) f.addEventListener('load', zfHello);
    zfHello();
    const all = () => Object.keys(panels).forEach(refresh);
    all();
    if (window.UI) ['home', 'stats', 'chart', 'zframes'].forEach((k) => UI.on(`tab:${k}`, () => setTimeout(() => { refresh(k); if (k === 'zframes') zfHello(); }, 60)));
    setInterval(all, 2000); // parts appear later (chat panel, donuts in trader mode, news cards)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
