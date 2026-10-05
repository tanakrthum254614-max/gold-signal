// Loading screen + Google sign-in (Clerk). Exposes SPLASH and AUTH for main.js.
(function () {
  const $ = (id) => document.getElementById(id);

  window.SPLASH = {
    step(text, pct) {
      $('splashText').textContent = text;
      if (pct != null) $('splashFill').style.width = `${pct}%`;
    },
    show() { $('splash').classList.remove('gone'); },
    hide() {
      this.step('พร้อมแล้ว!', 100);
      setTimeout(() => $('splash').classList.add('gone'), 350);
    },
  };

  const THEME = {
    variables: {
      colorPrimary: '#e8b64c', colorPrimaryForeground: '#1a1205', colorTextOnPrimaryBackground: '#1a1205',
      colorBackground: '#151a23', colorForeground: '#e6e9ef', colorText: '#e6e9ef',
      colorMutedForeground: '#8a93a3', colorTextSecondary: '#8a93a3', colorNeutral: '#e6e9ef',
      colorInput: '#1b212c', colorInputBackground: '#1b212c', colorInputForeground: '#e6e9ef', colorInputText: '#e6e9ef',
      fontFamily: '"IBM Plex Sans Thai", system-ui, sans-serif', borderRadius: '10px',
    },
  };
  const THAI_OVERRIDES = {
    signIn: { start: {
      title: 'เข้าสู่ระบบ Gold Signal', subtitle: 'ใช้บัญชี Google ของคุณเพื่อเข้าใช้งาน',
      titleCombined: 'เข้าสู่ระบบ Gold Signal', subtitleCombined: 'ใช้บัญชี Google ของคุณเพื่อเข้าใช้งาน',
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

  function showApp(user) {
    $('login').hidden = true;
    $('app').hidden = false;
    if (!user) return;
    $('userBox').hidden = false;
    $('userName').textContent = user.firstName || user.fullName || (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) || '';
    window.Clerk.mountUserButton($('userBtn'));
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
