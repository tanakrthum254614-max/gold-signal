// One menu for the whole site (11 Nov 2026). First every tab got its own topic menu inside a panel; the user found two menus
// side by side hard to use ("มันดูแปลก … ดูยากมาก") and chose "รวมเป็นเมนูเดียว": the topics of the open tab now unfold
// under that tab in the main left menu (#tabbar), and each tab's content is one flat panel (.sp.tp) without a second menu.
// Click a topic = go to that part (switching tab first if needed); the part on screen is highlighted. Parts that are hidden
// (easy mode, home-off …) drop out of the list. Chart: แบบง่าย / แบบละเอียด in the list. US stocks: the embedded zframes
// reports its sets and pages ({zf:'zones'}) and follows the menu ({zf:'zone'} / {zf:'pick'}; {zf:'hostnav'} hides its own).
(function () {
  const $ = (id) => document.getElementById(id);
  const pick = (q) => (typeof q === 'function' ? q() : document.querySelector(q));
  const shown = (el) => !!el && !el.hidden && el.offsetParent !== null && el.getClientRects().length > 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const TABS = {
    home: [
      { label: 'คำตอบเดียว', q: '#easySum' },
      { label: 'ราคาสด', q: '#liveHero' },
      { label: 'แนวโน้มสด', q: '#intraCard' },
      { label: 'ถ้าเข้าตอนนี้', q: '#tab-home .donuts' },
      { label: 'สัญญาณวันนี้', q: '#todayCard' },
      { label: 'ผลจริงทุกรายการ', q: '#recCard' },
    ],
    stats: [
      { label: 'ข่าวล่าสุด', q: '#nfCard' },
      { label: 'ข่าวแรงถัดไป', q: '#tab-stats .ns-hero' },
      { label: 'ข่าวที่จะออก', q: () => $('nsWeek') && $('nsWeek').closest('.card') },
      { label: 'ข่าวที่ออกแล้ว', q: () => $('nsPast') && $('nsPast').closest('.card') },
      { label: 'สถิติข่าว', q: '#tab-stats .nc-stats' },
    ],
    chart: [
      { label: 'กราฟและจุดเข้า', q: () => ($('chartPro') && !$('chartPro').hidden ? $('chartPro') : $('chartSimple')) },
      { label: 'ถามจุดเข้า', q: '#ccPanel' },
      { label: 'คำนวณขนาดการซื้อขาย', q: '#calcCard' },
    ],
    zframes: [],
    account: [
      { label: 'การซื้อขาย', q: '#spTrade' },
      { label: 'หน้าจอ', q: '#spDisplay' },
      { label: 'แอปบนมือถือ', q: '#pwaCard' },
      { label: 'แชร์', q: '#spShare' },
      { label: 'เกี่ยวกับ', q: '#spAbout' },
    ],
  };
  const subs = {};

  function build(key, items) {
    const tab = $(`tab-${key}`), link = document.querySelector(`#tabbar a[data-tab="${key}"]`);
    if (!tab || !link) return;
    if (!tab.querySelector(':scope > .sp')) { // wrap the tab's content in one flat panel (settings already is one)
      const sp = document.createElement('div'); sp.className = `sp tp tp-${key}`;
      const body = document.createElement('div'); body.className = 'sp-body';
      while (tab.firstChild) body.appendChild(tab.firstChild);
      sp.appendChild(body); tab.appendChild(sp);
    }
    const sub = document.createElement('div'); sub.className = 'tb-sub'; sub.dataset.for = key;
    sub.innerHTML = (key === 'chart' ? '<div class="tb-modes"><button type="button" data-mode="simple">แบบง่าย</button><button type="button" data-mode="pro">แบบละเอียด</button></div>' : '')
      + (key === 'zframes' ? '<small class="tb-g">ชุดหุ้น</small><div class="tb-sets"></div><small class="tb-g">หน้า</small><div class="tb-zones"></div>' : '')
      + items.map((it, i) => `<button type="button" data-tp="${i}">${it.label}</button>`).join('');
    link.after(sub);
    subs[key] = { sub, items };
    sub.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const go = (fn) => { if (location.hash !== `#${key}`) { location.hash = `#${key}`; setTimeout(fn, 250); } else fn(); };
      if (b.dataset.mode) return go(() => { const m = document.querySelector(`#chartMode button[data-mode="${b.dataset.mode}"]`); if (m) m.click(); setTimeout(() => refresh(key), 50); });
      if (b.dataset.zone) return go(() => zfPost({ zf: 'zone', id: b.dataset.zone }));
      if (b.dataset.set) return go(() => zfPost({ zf: 'pick', d: b.dataset.set }));
      const i = +b.dataset.tp;
      go(() => { const el = pick(items[i].q); if (!el) return; lockUntil = Date.now() + 1200; mark(key, i); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
  }
  function mark(key, i) { subs[key].sub.querySelectorAll('button[data-tp]').forEach((b) => b.classList.toggle('on', +b.dataset.tp === i)); }
  const current = () => Object.keys(subs).find((k) => { const t = $(`tab-${k}`); return t && !t.hidden; });
  function refresh(key) {
    const s = subs[key]; if (!s) return;
    s.items.forEach((it, i) => { const b = s.sub.querySelector(`button[data-tp="${i}"]`); if (b) b.hidden = !shown(pick(it.q)); });
    if (key === 'chart') { const pro = $('chartPro') && !$('chartPro').hidden; s.sub.querySelectorAll('.tb-modes button').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'pro') === pro)); }
  }
  function open() { const k = current(); Object.entries(subs).forEach(([key, s]) => s.sub.classList.toggle('on', key === k)); if (k) { refresh(k); spy(); } }

  let lockUntil = 0; // a clicked topic stays highlighted while the page scrolls to it
  function spy() {
    if (Date.now() < lockUntil) return;
    const key = current(), s = key && subs[key]; if (!s || !s.items.length) return;
    let best = -1, bestTop = -Infinity;
    s.items.forEach((it, i) => { const el = pick(it.q); if (!shown(el)) return; const t = el.getBoundingClientRect().top; if (t <= 140 && t > bestTop) { bestTop = t; best = i; } });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) s.items.forEach((it, i) => { const el = pick(it.q); if (shown(el) && el.getBoundingClientRect().top < innerHeight * 0.8) best = i; });
    if (best < 0) best = s.items.findIndex((it) => shown(pick(it.q)));
    mark(key, best);
  }
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; spy(); }); }, { passive: true });

  // ---------- US stocks: sets and pages of the embedded dashboard ----------
  const zfFrame = () => $('zframesFrame');
  function zfPost(msg) { const f = zfFrame(); if (f && f.contentWindow) f.contentWindow.postMessage(msg, location.origin); }
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.zf !== 'zones' || !subs.zframes) return;
    const s = subs.zframes.sub;
    s.querySelector('.tb-sets').innerHTML = (e.data.sets || []).map((x) => `<button type="button" data-set="${esc(x.id)}" class="${x.id === e.data.set ? 'on' : ''}">${esc(x.label)}</button>`).join('');
    s.querySelector('.tb-zones').innerHTML = (e.data.zones || []).map((z) => `<button type="button" data-zone="${esc(z.id)}" class="${z.id === e.data.on ? 'on' : ''}">${esc(z.label)}</button>`).join('');
  });
  const zfHello = () => zfPost({ zf: 'hostnav' });

  function start() {
    Object.entries(TABS).forEach(([k, items]) => build(k, items));
    const f = zfFrame(); if (f) f.addEventListener('load', zfHello);
    zfHello();
    open();
    addEventListener('hashchange', () => setTimeout(open, 60));
    if (window.UI) Object.keys(TABS).forEach((k) => UI.on(`tab:${k}`, () => setTimeout(() => { open(); if (k === 'zframes') zfHello(); }, 60)));
    setInterval(() => { const k = current(); if (k) refresh(k); }, 2000); // parts appear later (chat panel, trader-mode cards, news)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
