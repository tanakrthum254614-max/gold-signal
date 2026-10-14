// Design refresh motion (14 Oct 2026, user chose "จัดเต็ม"): gold dust drifting behind the page, a ripple on every
// button press, a small bump when the live price changes, a highlight on numbers that change, and a gentle 3D tilt
// of the live price card under the mouse. Styles in design.css. Nothing runs with prefers-reduced-motion, and the
// dust stops while the tab is hidden so it costs no battery in the background.
(function () {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // ---------- Gold dust ----------
  const cv = document.createElement('canvas');
  cv.id = 'dsDust';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const small = () => innerWidth < 700;
  let W = 0, H = 0, dots = [], last = 0, raf = 0;
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = small() ? 18 : 42;
    dots = Array.from({ length: n }, () => spawn(true));
  }
  function spawn(anywhere) {
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10,
      r: 0.6 + Math.random() * 1.8, vy: 6 + Math.random() * 16, vx: -4 + Math.random() * 8,
      t: Math.random() * Math.PI * 2, tw: 0.6 + Math.random() * 1.6,
    };
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    if (now - last < 33) return; // ~30 fps is plenty for slow dust
    last = now;
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      d.y -= d.vy * dt; d.x += d.vx * dt + Math.sin(d.t) * 0.15; d.t += d.tw * dt;
      if (d.y < -10 || d.x < -10 || d.x > W + 10) Object.assign(d, spawn(false));
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(d.t * 2)); // twinkle
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 4);
      g.addColorStop(0, `rgba(240, 180, 41, ${a})`);
      g.addColorStop(1, 'rgba(240, 180, 41, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  const run = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  size(); run();
  let rs; addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(size, 200); });
  document.addEventListener('visibilitychange', run);

  // ---------- Ripple on press ----------
  const RIPPLE = '.btn, .tfs button, .cc-tfs button, .cc-quick button, .seg button, .tabbar a, .cc-mode button';
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(RIPPLE);
    if (!el) return;
    const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    const sp = document.createElement('span');
    sp.className = 'ds-ripple';
    sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    el.appendChild(sp);
    setTimeout(() => sp.remove(), 650);
  }, { passive: true });

  // ---------- Live price bump + highlight on changing numbers ----------
  function watch(el, cls) {
    if (!el) return;
    let prev = el.textContent;
    new MutationObserver(() => {
      const now = el.textContent;
      if (now === prev) return;
      prev = now;
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }
  function hook() {
    watch(document.getElementById('lvPrice'), 'ds-bump');
    document.querySelectorAll('.lv-stats b').forEach((b) => watch(b, 'ds-tick'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();

  // ---------- 3D tilt of the live price card (mouse only) ----------
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hero = () => document.getElementById('liveHero');
    document.addEventListener('pointermove', (e) => {
      const h = hero();
      if (!h || !h.offsetParent) return;
      const r = h.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) { if (h.style.transform) h.style.transform = ''; return; }
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      h.style.transform = `perspective(1200px) rotateX(${(-y * 2.2).toFixed(2)}deg) rotateY(${(x * 2.2).toFixed(2)}deg)`;
    }, { passive: true });
  }
})();
