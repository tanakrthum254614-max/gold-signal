// Loading screen + Google sign-in (Clerk). Exposes SPLASH and AUTH for main.js.
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
    $('splashPct').textContent = `${Math.round(shown)}%`;
    $('splashFill').style.strokeDashoffset = RING * (1 - shown / 100);
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

  const THEME = {
    variables: {
      colorPrimary: '#1c2433', colorPrimaryForeground: '#ffffff', colorTextOnPrimaryBackground: '#ffffff',
      colorBackground: '#ffffff', colorForeground: '#1c2433', colorText: '#1c2433',
      colorMutedForeground: '#697386', colorTextSecondary: '#697386', colorNeutral: '#1c2433',
      colorInput: '#f2f5f9', colorInputBackground: '#f2f5f9', colorInputForeground: '#1c2433', colorInputText: '#1c2433',
      fontFamily: '"IBM Plex Sans Thai", system-ui, sans-serif', borderRadius: '10px', fontSize: '16px',
    },
    // Google only: hide the email form so the sign-in screen is a single button
    elements: {
      dividerRow: { display: 'none' }, form: { display: 'none' }, footerAction: { display: 'none' },
      socialButtonsBlockButton: { padding: '14px', fontSize: '16px' },
      cardBox: { boxShadow: '0 8px 24px rgba(20,30,50,.08)', border: '1px solid #e2e7ef', borderRadius: '20px' },
    },
  };
  const THAI_OVERRIDES = {
    signIn: { start: {
      title: 'เข้าใช้งานด้วย Google', subtitle: 'กดปุ่มเดียว ไม่ต้องสมัครสมาชิก',
      titleCombined: 'เข้าใช้งานด้วย Google', subtitleCombined: 'กดปุ่มเดียว ไม่ต้องสมัครสมาชิก',
    } },
    signUp: { start: { title: 'สมัครใช้งาน Gold Signal', subtitle: 'สมัครฟรีด้วยบัญชี Google' } },
  };

  function merge(base, extra) {
    const out = { ...base };
    for (const [k, v] of Object.entries(extra)) {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] || {}, v) : v;
    }
    return out;
  }

  function loadScript(src, attrs = {}) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
      s.onload = resolve;
      s.onerror = () => reject(new Error(`โหลด ${src} ไม่สำเร็จ`));
      document.head.appendChild(s);
    });
  }

  function showApp() {
    $('login').hidden = true;
    $('app').hidden = false;
  }

  let resolveReady;
  window.AUTH = { ready: new Promise((r) => { resolveReady = r; }), user: null };

  async function start() {
    SPLASH.step('กำลังตรวจสอบการเข้าสู่ระบบ…', 15);
    const pk = window.GOLD_CONFIG && window.GOLD_CONFIG.clerkPublishableKey;
    if (!pk) { showApp(null); return resolveReady(null); }

    // The publishable key encodes the Clerk Frontend API host: pk_test_<base64("host$")>
    const fapi = atob(pk.split('_')[2]).replace(/\$$/, '');
    let thTH = {};
    await Promise.all([
      loadScript(`https://${fapi}/npm/@clerk/ui@1/dist/ui.browser.js`),
      loadScript(`https://${fapi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, { 'data-clerk-publishable-key': pk }),
      import('https://cdn.jsdelivr.net/npm/@clerk/localizations@4/+esm').then((m) => { thTH = m.thTH; }).catch(() => {}),
    ]);
    const Clerk = window.Clerk;
    await Clerk.load({
      ui: { ClerkUI: window.__internal_ClerkUICtor },
      localization: merge(thTH, THAI_OVERRIDES),
      appearance: THEME,
      afterSignOutUrl: location.pathname,
    });

    let signedIn = !!Clerk.user;
    Clerk.addListener(({ user }) => {
      if (user && !signedIn) {
        signedIn = true;
        SPLASH.show();
        SPLASH.step('เข้าสู่ระบบสำเร็จ กำลังโหลด…', 30);
        window.AUTH.user = user;
        showApp(user);
        resolveReady(user);
      } else if (!user && signedIn) {
        location.reload(); // signed out
      }
    });

    if (signedIn) {
      window.AUTH.user = Clerk.user;
      showApp(Clerk.user);
      return resolveReady(Clerk.user);
    }

    // Not signed in: show the sign-in page instead of the app
    SPLASH.hide();
    $('login').hidden = false;
    Clerk.mountSignIn($('signIn'), { withSignUp: true, forceRedirectUrl: location.href, signUpForceRedirectUrl: location.href });
  }

  start().catch((e) => {
    console.error(e);
    SPLASH.step('ระบบเข้าสู่ระบบมีปัญหา กรุณารีเฟรชหน้าอีกครั้ง', 100);
  });
})();
