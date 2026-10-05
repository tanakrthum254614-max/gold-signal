// Loading screen + Google sign-in (Clerk). Exposes SPLASH and AUTH for main.js.
(function () {
  const $ = (id) => document.getElementById(id);

  // Progress ring (r = 72) + a counting percentage + a list of finished steps
  const RING = 2 * Math.PI * 72;
  let shown = 0, target = 0, raf = 0, lastText = '';
  function count() {
    shown += Math.max(0.6, (target - shown) * 0.12);
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
    show() { shown = target = 0; $('splash').classList.remove('gone', 'done'); },
    hide() {
      this.step('พร้อมแล้ว!', 100);
      $('splash').classList.add('done');
      setTimeout(() => $('splash').classList.add('gone'), 650);
    },
  };
  $('splashFill').style.strokeDasharray = RING;
  $('splashFill').style.strokeDashoffset = RING;
  SPLASH.step('กำลังเริ่มต้น…', 5);

  const THEME = {
    variables: {
      colorPrimary: '#e8b64c', colorPrimaryForeground: '#1a1205', colorTextOnPrimaryBackground: '#1a1205',
      colorBackground: '#151a23', colorForeground: '#e6e9ef', colorText: '#e6e9ef',
      colorMutedForeground: '#8a93a3', colorTextSecondary: '#8a93a3', colorNeutral: '#e6e9ef',
      colorInput: '#1b212c', colorInputBackground: '#1b212c', colorInputForeground: '#e6e9ef', colorInputText: '#e6e9ef',
      fontFamily: '"IBM Plex Sans Thai", system-ui, sans-serif', borderRadius: '10px', fontSize: '16px',
    },
    // Google only: hide the email form so the sign-in screen is a single button
    elements: {
      dividerRow: { display: 'none' }, form: { display: 'none' }, footerAction: { display: 'none' },
      socialButtonsBlockButton: { padding: '14px', fontSize: '16px' },
      cardBox: { boxShadow: 'none', border: '1px solid #262e3b' },
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
