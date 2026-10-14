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

  // Broker-style boot screen (14 Oct 2026): progress bar + %, three connection steps, a connection pill that turns LIVE
  // once the price is in, and the XAU/USD ticker whose digits roll until main.js has written the real price (#lvPrice)
  const MIN_MS = 1200; // shown at least this long so it doesn't flash
  let shown = 0, target = 0, raf = 0, startAt = Date.now(), landed = false, lastRoll = 0;
  const roll = () => { const d = () => Math.floor(Math.random() * 10); return `${d()},${d()}${d()}${d()}.${d()}${d()}`; };
  function ticker(now) {
    const px = $('bkPx');
    if (!px || landed) return;
    const real = ($('lvPrice') || {}).textContent || '';
    if (/\d/.test(real)) { // the real price is in: stop rolling and land on it
      landed = true;
      px.textContent = real.trim();
      const chg = $('lvChg');
      const dir = chg && /\bup\b/.test(chg.className) ? 'up' : chg && /\bdown\b/.test(chg.className) ? 'down' : '';
      px.className = `bk-px mono land ${dir}`;
      if (chg && chg.textContent.trim()) { $('bkChg').textContent = chg.textContent; $('bkChg').className = `bk-chg mono ${dir}`; }
      $('bkPill').classList.add('live'); $('bkPillText').textContent = 'LIVE · เชื่อมต่อแล้ว';
      return;
    }
    if (now - lastRoll > 70) { px.textContent = roll(); lastRoll = now; }
  }
  function count(now) {
    shown += Math.max(0.6, (target - shown) * 0.06);
    if (shown >= target) shown = target;
    $('splashPct').textContent = `${Math.round(shown)}%`;
    $('splashBar').style.width = `${shown}%`;
    let active = false;
    document.querySelectorAll('#splashChips [data-at]').forEach((li) => {
      const done = shown >= +li.dataset.at;
      li.classList.toggle('done', done);
      li.classList.toggle('on', !done && !active);
      if (!done) active = true;
    });
    raf = shown < target ? requestAnimationFrame(count) : 0;
  }
  (function tick(now) { ticker(now || 0); if (!landed && !$('splash').classList.contains('gone')) requestAnimationFrame(tick); })();

  // Streaming candlestick chart behind the card — decorative motion only (a random walk, not market data)
  (function chart() {
    const cv = $('bkChart');
    if (!cv || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, bars = [], cur = null, last = 0;
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size(); addEventListener('resize', size);
    const n = () => Math.ceil(W / 14) + 2;
    let p = 100;
    const newBar = () => ({ o: p, h: p, l: p, c: p });
    while (bars.length < n()) { cur = newBar(); for (let i = 0; i < 6; i++) step(); bars.push(cur); }
    cur = newBar();
    function step() { p += (Math.random() - 0.48) * 1.6; cur.c = p; cur.h = Math.max(cur.h, p); cur.l = Math.min(cur.l, p); }
    function draw(now) {
      if ($('splash').classList.contains('gone')) return;
      requestAnimationFrame(draw);
      if (now - last < 50) return;
      last = now; step();
      if (Math.random() < 0.06) { bars.push(cur); if (bars.length > n()) bars.shift(); cur = newBar(); }
      const all = bars.concat([cur]);
      let lo = Infinity, hi = -Infinity; all.forEach((b) => { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); });
      const pad = (hi - lo) * 0.15 + 0.5, top = H * 0.18, bot = H * 0.82;
      const y = (v) => bot - ((v - lo + pad) / (hi - lo + 2 * pad)) * (bot - top);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(43, 49, 57, .55)'; ctx.lineWidth = 1;
      for (let g = 1; g < 6; g++) { const gy = (H / 6) * g; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      all.forEach((b, i) => {
        const x = W - (all.length - i) * 14 + 7, up = b.c >= b.o;
        ctx.strokeStyle = ctx.fillStyle = up ? 'rgba(14, 203, 129, .55)' : 'rgba(246, 70, 93, .55)';
        ctx.beginPath(); ctx.moveTo(x, y(b.h)); ctx.lineTo(x, y(b.l)); ctx.stroke();
        const t = y(Math.max(b.o, b.c)), h = Math.max(1, Math.abs(y(b.o) - y(b.c)));
        ctx.fillRect(x - 4, t, 8, h);
      });
      const ly = y(cur.c); // last-price line, like a trading app
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(240, 185, 11, .6)';
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke(); ctx.setLineDash([]);
    }
    requestAnimationFrame(draw);
  })();

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
          if (shown < 100) return setTimeout(finish, 80);
          $('splash').classList.add('done');
          setTimeout(() => $('splash').classList.add('gone'), 700);
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
