// Install as an app (PWA) + push notifications on this device.
// Subscriptions are saved on the server under the access-code holder (/api/push → private Blob, middleware.js); the
// GitHub Actions jobs read them with the Clerk secret key and send every LINE message as a push too
// (scripts/push.js), so notifications don't use the LINE quota.
(function () {
  const $ = (id) => document.getElementById(id);
  const VAPID = (window.GOLD_CONFIG && GOLD_CONFIG.vapidPublicKey) || '';
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const mobile = ios || /android/i.test(ua);
  const toast = (t) => window.UI && UI.toast(t);
  let installEvent = null, reg = null;

  // ---------- Service worker ----------
  const swReady = 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('/sw.js').then((r) => { reg = r; return navigator.serviceWorker.ready; }).catch(() => null)
    : Promise.resolve(null);

  // ---------- Install ----------
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; render(); });
  addEventListener('appinstalled', () => { installEvent = null; toast('📲 ติดตั้งแอปแล้ว — เปิดจากหน้าจอหลักได้เลย'); render(); });

  async function install() {
    if (installEvent) {
      installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === 'accepted') installEvent = null;
      render();
    } else {
      $('pwaHow').hidden = !$('pwaHow').hidden; // show the manual steps
    }
  }

  // ---------- Push ----------
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const user = () => window.AUTH && AUTH.user;
  // This holder's devices on the server (/api/push in middleware.js)
  async function serverSubs() {
    const r = await fetch('/api/push', { cache: 'no-store' });
    return r.ok ? (await r.json()).subs || [] : [];
  }
  const pushApi = (method, body) => fetch('/api/push', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then((r) => { if (!r.ok) throw new Error('บันทึกบนเซิร์ฟเวอร์ไม่สำเร็จ'); });
  const keyBytes = (b64) => {
    const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };
  async function currentSub() {
    const r = await swReady;
    return r && r.pushManager ? r.pushManager.getSubscription() : null;
  }
  async function enablePush() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { render(); return toast('ยังไม่ได้อนุญาตการแจ้งเตือน — เปิดได้ในการตั้งค่าเบราว์เซอร์'); }
    const r = await swReady;
    // the browser's push service can hang (no connection to Google/Apple) — give up after 20 s
    const late = new Promise((_, no) => setTimeout(() => no(new Error('เชื่อมต่อบริการแจ้งเตือนของเบราว์เซอร์ไม่ได้ ลองใหม่อีกครั้ง')), 20e3));
    const sub = (await r.pushManager.getSubscription())
      || await Promise.race([r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }), late]);
    const json = sub.toJSON();
    const device = ios ? 'iPhone/iPad' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'อุปกรณ์อื่น';
    await pushApi('POST', { endpoint: json.endpoint, keys: json.keys, device }); // the server keeps 5 devices per holder
    store.set('gs-push', 'on');
    r.showNotification('🔔 เปิดแจ้งเตือนแล้ว', { body: 'จะเด้งเตือนเมื่อมีจังหวะ ✅ เข้าไม้ ถึง TP โดน SL และข่าวแรง — เหมือนใน LINE', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: 'gs-test' });
    render();
  }
  async function disablePush() {
    const sub = await currentSub();
    if (sub) {
      await pushApi('DELETE', { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    store.set('gs-push', 'off');
    toast('ปิดแจ้งเตือนบนเครื่องนี้แล้ว');
    render();
  }
  async function testPush() {
    const r = await swReady;
    r.showNotification('🧪 ทดสอบแจ้งเตือน', { body: 'ถ้าเห็นข้อความนี้ แปลว่าเครื่องนี้พร้อมรับสัญญาณแล้ว', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', tag: 'gs-test' });
  }

  // ---------- UI (account tab card + install banner on home) ----------
  async function render() {
    if (!$('pwaCard')) return;
    // Install row
    const installed = standalone();
    $('pwaInstallTx').textContent = installed ? '✅ กำลังใช้งานแบบแอปอยู่'
      : installEvent ? 'กดติดตั้ง แล้วเปิดจากหน้าจอหลักได้เหมือนแอปทั่วไป — ไม่ต้องโหลดจาก Store'
      : ios ? 'iPhone/iPad: ติดตั้งผ่าน Safari (กดดูวิธี)' : 'เพิ่มไปยังหน้าจอหลักจากเมนูของเบราว์เซอร์ (กดดูวิธี)';
    $('pwaInstall').hidden = installed;
    $('pwaInstall').textContent = installEvent ? '📲 ติดตั้ง' : 'ดูวิธีติดตั้ง';
    $('pwaHowIos').hidden = !ios; $('pwaHowOther').hidden = ios;

    const bar = $('installBar');
    bar.hidden = installed || !mobile || store.get('gs-install-bar') === 'closed';
    $('installBarBtn').textContent = installEvent ? 'ติดตั้ง' : 'วิธีติดตั้ง';

    // Push row
    const btn = $('pwaPush'), tx = $('pwaPushTx');
    btn.hidden = false; $('pwaTest').hidden = true;
    let state;
    if (!VAPID) state = ['ระบบแจ้งเตือนกำลังเตรียม — เร็ว ๆ นี้', null];
    else if (!pushSupported()) state = [ios && !installed ? 'iPhone/iPad: ต้องติดตั้งเป็นแอปก่อน (ข้อด้านบน) แล้วเปิดจากหน้าจอหลัก' : 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน', null];
    else if (!user()) state = ['เข้าใช้งานด้วยรหัสก่อน เพื่อเปิดการแจ้งเตือน', null];
    else if (Notification.permission === 'denied') state = ['ถูกบล็อกไว้ — เปิดสิทธิ์การแจ้งเตือนของเว็บนี้ในการตั้งค่าเบราว์เซอร์', null];
    else {
      const sub = await currentSub();
      const on = !!sub && (await serverSubs()).some((s) => s.endpoint === sub.endpoint);
      state = on ? ['✅ เปิดอยู่ — เด้งเตือนทุกครั้งที่ LINE ส่ง (ไม่กินโควตา LINE)', 'off'] : ['เด้งเตือนบนเครื่องนี้เมื่อมีจังหวะ ✅ เข้าไม้ ถึง TP โดน SL และข่าวแรง', 'on'];
      $('pwaTest').hidden = !on;
    }
    tx.textContent = state[0];
    btn.hidden = !state[1];
    btn.textContent = state[1] === 'off' ? 'ปิด' : '🔔 เปิดแจ้งเตือน';
    btn.dataset.action = state[1] || '';
    btn.classList.toggle('gold', state[1] === 'on');
  }

  async function busy(btn, fn) {
    btn.disabled = true;
    try { await fn(); } catch (e) { toast(`เปิดแจ้งเตือนไม่สำเร็จ: ${e.message}`); } finally { btn.disabled = false; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('pwaInstall').addEventListener('click', install);
    $('installBarBtn').addEventListener('click', () => (installEvent ? install() : (location.hash = '#account', setTimeout(() => { $('pwaHow').hidden = false; $('pwaCard').scrollIntoView({ behavior: 'smooth' }); }, 300))));
    $('installBarClose').addEventListener('click', () => { store.set('gs-install-bar', 'closed'); $('installBar').hidden = true; });
    $('pwaPush').addEventListener('click', (e) => busy(e.currentTarget, () => (e.currentTarget.dataset.action === 'off' ? disablePush() : enablePush())));
    $('pwaTest').addEventListener('click', testPush);
    render();
  });
  if (window.AUTH) AUTH.ready.then(render);
  matchMedia('(display-mode: standalone)').addEventListener('change', render);

  window.PWA = { render };
})();
