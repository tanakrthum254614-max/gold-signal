// Loading screen + who is signed in (members — Clerk on /login.html, checked by middleware.js). Exposes SPLASH and AUTH.
(function () {
  const $ = (id) => document.getElementById(id);
  const skipSplash = (() => {
    try {
      const skip = sessionStorage.getItem('gs-skip-splash-once') === '1';
      sessionStorage.removeItem('gs-skip-splash-once');
      return skip;
    } catch (e) { return false; }
  })();

  // Loading screen (15 Oct 2026 redesign: no panel / ring / chips): a gold price line draws itself left → right with
  // the %, a glowing dot at its tip. The line is a fixed, gently rising walk (decoration, not market data).
  // Shown for at least MIN_MS (14 Oct: 6500 ms; 15 Oct: "ขอให้เร็วขึ้น" → 4000 ms, the user's choice). The line can't run
  // ahead of the clock, so it fills evenly over the whole MIN_MS.
  const MIN_MS = 4000;
  const W = 600, H = 140, N = 64;
  const pts = (() => {
    let y = 116, seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    return Array.from({ length: N }, (_, i) => {
      const trend = -1.45, wave = Math.sin(i / 5.5) * 2.6;
      y = Math.max(18, Math.min(124, y + trend + wave + (rnd() - 0.5) * 9));
      return [(i / (N - 1)) * W, y];
    });
  })();
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  $('spxLine').setAttribute('d', d);
  $('spxArea').setAttribute('d', `${d} L${W} ${H} L0 ${H} Z`);
  const yAt = (x) => { const f = (x / W) * (N - 1), i = Math.min(N - 2, Math.floor(f)), t = f - i; return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t; };
  let shown = 0, target = 0, raf = 0, startAt = Date.now();
  function count() {
    const goal = Math.min(target, ((Date.now() - startAt) / MIN_MS) * 100); // paced by the clock
    if (shown < goal) shown = Math.min(goal, shown + Math.max(0.4, (goal - shown) * 0.08));
    const x = (shown / 100) * W;
    $('splashPct').textContent = `${Math.round(shown)}%`;
    $('spxReveal').setAttribute('width', x.toFixed(1));
    const dot = $('spxDot');
    dot.style.left = `${shown}%`;
    dot.style.top = `${(yAt(x) / H) * 100}%`;
    dot.classList.toggle('on', shown > 0.5);
    raf = shown < target ? requestAnimationFrame(count) : 0; // keeps running while the clock holds it back
  }
  window.SPLASH = {
    step(text, pct) { // text: kept for the callers, not shown
      if (pct != null && pct > target) {
        target = pct;
        if (!raf) raf = requestAnimationFrame(count);
      }
    },
    show() { shown = target = 0; startAt = Date.now(); $('splash').classList.remove('gone', 'done'); },
    hide() {
      setTimeout(() => {
        this.step('พร้อมแล้ว!', 100);
        const finish = () => {
          if (shown < 100) return setTimeout(finish, 60);
          $('splash').classList.add('done');
          setTimeout(() => $('splash').classList.add('gone'), 450);
        };
        finish();
      }, Math.max(0, startAt + MIN_MS - Date.now()));
    },
  };
  SPLASH.step('กำลังเริ่มต้น…', 5);

  // Signing in happens on /login.html (Clerk); the server only serves this page to a signed-in member.
  // AUTH.user = { fullName, email } from the site's session (/api/me).
  let resolveReady;
  window.AUTH = { ready: new Promise((r) => { resolveReady = r; }), user: null };
  function showApp() {
    $('login').hidden = true;
    $('app').hidden = false;
    if (skipSplash) $('splash').classList.add('gone');
  }
  async function start() {
    SPLASH.step('กำลังตรวจสอบการเข้าสู่ระบบ…', 15);
    const r = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' });
    if (r.status === 401) { location.replace('/login.html'); return; }
    // Opened as a plain file / dev server without the middleware: carry on unsigned
    const me = r.ok && (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    window.AUTH.user = me ? { fullName: me.name, email: me.email, admin: !!me.admin } : null;
    showApp();
    resolveReady(window.AUTH.user);
    // Access log (back office): the first visit of the day from this device
    if (me) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
      let last = null;
      try { last = localStorage.getItem('gs-visit'); } catch (e) { /* storage blocked */ }
      if (last !== today) fetch('/api/visit', { method: 'POST' }).then(() => { try { localStorage.setItem('gs-visit', today); } catch (e) { /* ok */ } }).catch(() => {});
    }
  }
  start().catch((e) => {
    console.error(e);
    showApp();
    resolveReady(null);
  });
})();
