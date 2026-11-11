// Install as an app (PWA). 11 Nov 2026: push notifications removed together with LINE.
(function () {
  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const mobile = ios || /android/i.test(ua);
  const toast = (t) => window.UI && UI.toast(t);
  let installEvent = null;

  // ---------- Service worker ----------
  const swReady = 'serviceWorker' in navigator
    ? navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).catch(() => null)
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

  // ---------- Push: removed 11 Nov 2026 (no LINE / web push any more) ----------
  // A device that had notifications switched on drops its old subscription, so nothing is left behind
  swReady.then((r) => r && r.pushManager && r.pushManager.getSubscription()).then((sub) => sub && sub.unsubscribe()).catch(() => {});

  // ---------- UI (settings tab card + install banner on home) ----------
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

  }

  document.addEventListener('DOMContentLoaded', () => {
    $('pwaInstall').addEventListener('click', install);
    $('installBarBtn').addEventListener('click', () => (installEvent ? install() : (location.hash = '#account', setTimeout(() => { $('pwaHow').hidden = false; $('pwaCard').scrollIntoView({ behavior: 'smooth' }); }, 300))));
    $('installBarClose').addEventListener('click', () => { store.set('gs-install-bar', 'closed'); $('installBar').hidden = true; });
    render();
  });
  matchMedia('(display-mode: standalone)').addEventListener('change', render);

  window.PWA = { render };
})();
