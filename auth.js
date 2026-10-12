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

  // Progress ring (r = 72) + a counting percentage — no step texts (user, 12 Oct: too many words on the loading screen)
  const RING = 2 * Math.PI * 72;
  // Shown for at least MIN_MS so the logo animation plays once
  const MIN_MS = 2000;
  let shown = 0, target = 0, raf = 0, startAt = Date.now();
  function count() {
    shown += Math.max(0.6, (target - shown) * 0.06);
    if (shown >= target) shown = target;
    const pct = Math.round(shown), el = $('splashPct');
    // Bump the number every 25%
    if (Math.floor(pct / 25) > Math.floor(parseInt(el.textContent, 10) / 25)) {
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
    el.textContent = `${pct}%`;
    $('splashFill').style.strokeDashoffset = RING * (1 - shown / 100);
    // Comet head at the tip of the ring (the svg is rotated −90°, so 0 rad = top)
    const a = 2 * Math.PI * shown / 100, head = $('splashHead');
    head.setAttribute('cx', (80 + 72 * Math.cos(a)).toFixed(2));
    head.setAttribute('cy', (80 + 72 * Math.sin(a)).toFixed(2));
    head.classList.toggle('on', shown > 0.5 && shown < 100);
    // chips: done (✓) once the ring passes their mark, the next one pulses as "loading"
    let active = false;
    document.querySelectorAll('#splashChips li').forEach((li) => {
      const done = shown >= +li.dataset.at;
      li.classList.toggle('done', done);
      li.classList.toggle('on', !done && !active);
      if (!done) active = true;
    });
    raf = shown < target ? requestAnimationFrame(count) : 0;
  }
  window.SPLASH = {
    step(text, pct) { // text: kept for the callers, no longer shown
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
          if (shown < 100) return setTimeout(finish, 80);
          $('splash').classList.add('done');
          setTimeout(() => $('splash').classList.add('gone'), 900);
        };
        finish();
      }, Math.max(0, startAt + MIN_MS - Date.now()));
    },
  };
  $('splashFill').style.strokeDasharray = RING;
  $('splashFill').style.strokeDashoffset = RING;
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
