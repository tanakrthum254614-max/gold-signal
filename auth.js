// Loading screen + who is signed in (members — Clerk on /login.html, checked by middleware.js). Exposes SPLASH and AUTH.
(function () {
  const $ = (id) => document.getElementById(id);

  // Progress ring (r = 72) + a counting percentage + a list of finished steps
  const RING = 2 * Math.PI * 72;
  // Shown for at least MIN_MS, and the ring fills slowly, so every step can be read
  const MIN_MS = 4000;
  let shown = 0, target = 0, raf = 0, lastText = '', startAt = Date.now();
  function count() {
    shown += Math.max(0.25, (target - shown) * 0.035);
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
    raf = shown < target ? requestAnimationFrame(count) : 0;
  }
  window.SPLASH = {
    step(text, pct) {
      if (lastText && lastText !== text) {
        const li = document.createElement('li');
        li.textContent = lastText;
        $('splashSteps').appendChild(li);
        while ($('splashSteps').children.length > 3) $('splashSteps').firstChild.remove();
      }
      lastText = text;
      $('splashText').textContent = text;
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
  }
  async function start() {
    SPLASH.step('กำลังตรวจสอบการเข้าสู่ระบบ…', 15);
    const r = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' });
    if (r.status === 401) { location.replace('/login.html'); return; }
    // Opened as a plain file / dev server without the middleware: carry on unsigned
    const me = r.ok && (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    window.AUTH.user = me ? { fullName: me.name, email: me.email } : null;
    showApp();
    resolveReady(window.AUTH.user);
  }
  start().catch((e) => {
    console.error(e);
    showApp();
    resolveReady(null);
  });
})();
