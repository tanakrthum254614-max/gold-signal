// App shell: tabs, account page, sharing
(function () {
  const $ = (id) => document.getElementById(id);
  const TABS = ['home', 'stats', 'chart', 'zframes', 'journal', 'account']; // 📓 journal added 14 Oct (journal.js) // วิธีใช้ tab removed (user, 12 Oct: "เอาวิธีใช้ออก")
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };
  const listeners = [];
  const emit = (name) => listeners.forEach(([n, fn]) => n === name && fn());

  // ---------- Tabs (hash based, so the back button and shared links work) ----------
  function currentTab() {
    const t = location.hash.replace('#', '');
    return TABS.includes(t) ? t : 'home';
  }
  function showTab(tab) {
    TABS.forEach((t) => { $(`tab-${t}`).hidden = t !== tab; });
    document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    document.querySelector('.content').classList.toggle('zframes-view', tab === 'zframes');
    if (tab === 'zframes' && !$('zframesFrame').hasAttribute('src')) $('zframesFrame').src = $('zframesFrame').dataset.src;
    window.scrollTo(0, 0);
    emit(`tab:${tab}`);
  }
  window.addEventListener('hashchange', () => showTab(currentTab()));

  // ---------- Chart: simple vs trader view ----------
  function setChartMode(mode) {
    $('chartSimple').hidden = mode !== 'simple';
    $('chartPro').hidden = mode !== 'pro';
    document.querySelectorAll('#chartMode button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    store.set('gs-chart', mode);
    emit('tab:chart');
  }
  $('chartMode').addEventListener('click', (e) => e.target.dataset.mode && setChartMode(e.target.dataset.mode));

  // ---------- Account + sharing ----------
  function fillAccount() {
    const u = window.AUTH && AUTH.user;
    const name = u ? (u.fullName || u.email || 'สมาชิก') : 'ผู้ใช้งาน';
    const email = u ? (u.email || '') : '';
    const img = u && u.imageUrl;
    $('accName').textContent = name || email;
    $('accEmail').textContent = email;
    [$('accAvatar'), $('hdrAvatar')].forEach((el) => {
      if (img) el.src = img; else el.hidden = true;
    });
    $('signOut').hidden = !u;
    $('accSignIn').hidden = true;
    if ($('adminLink')) $('adminLink').hidden = !(u && u.admin);
  }

  const shareUrl = location.origin + location.pathname;
  const shareText = 'ลองใช้ Gold Signal — สัญญาณเทรดทองคำ Buy/Sell ทุกกรอบเวลา พร้อมจุดเข้า SL TP ที่ทดสอบย้อนหลังแล้ว และสถิติข่าวเศรษฐกิจสหรัฐที่ทำให้ทองวิ่ง (สมัครสมาชิกฟรี)';
  $('shareLine').href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
  $('shareCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย'); }
    catch (e) { toast(shareUrl); }
  });
  if (navigator.share) {
    $('shareNative').hidden = false;
    $('shareNative').addEventListener('click', () => navigator.share({ title: 'Gold Signal', text: shareText, url: shareUrl }).catch(() => {}));
  }
  const lineUrl = window.GOLD_CONFIG && GOLD_CONFIG.lineAddFriendUrl;
  if (lineUrl) { $('lineAdd').href = lineUrl; $('lineAdd').hidden = false; $('lineSoon').hidden = true; }
  $('signOut').addEventListener('click', () => { location.href = '/api/logout'; });

  // ---------- Trading settings (capital / risk / spread) — saved in this browser ----------
  const DEFAULTS = { capital: 0, currency: 'USD', risk: 1, spread: 0.4 };
  function settings() {
    const u = window.AUTH && AUTH.user;
    const fromAccount = u && u.unsafeMetadata && u.unsafeMetadata.goldSettings;
    let local = null;
    try { local = JSON.parse(store.get('gs-settings') || 'null'); } catch (e) { /* ignore */ }
    return { ...DEFAULTS, ...(local || {}), ...(fromAccount || {}) };
  }
  function fillSettings() {
    const s = settings();
    $('setCap').value = s.capital || '';
    $('setCur').value = s.currency;
    $('setRisk').value = String(s.risk);
    $('setSpread').value = s.spread;
    previewSettings();
  }
  function readForm() {
    return {
      capital: Math.max(0, +$('setCap').value || 0), currency: $('setCur').value,
      risk: +$('setRisk').value || 1, spread: Math.max(0, +$('setSpread').value || 0),
    };
  }
  function previewSettings() {
    const s = readForm();
    const lot = window.lotFor ? window.lotFor(15, s) : null;
    $('setPreview').textContent = lot ? `ตัวอย่าง: SL $15 → ${lot.text}` : 'ใส่ทุนเพื่อให้ระบบคำนวณขนาดไม้ให้';
  }
  ['setCap', 'setCur', 'setRisk', 'setSpread'].forEach((id) => $(id).addEventListener('input', previewSettings));
  $('setSave').addEventListener('click', async () => {
    const s = readForm();
    store.set('gs-settings', JSON.stringify(s));
    const u = window.AUTH && AUTH.user;
    if (u && u.update) {
      try { await u.update({ unsafeMetadata: { ...(u.unsafeMetadata || {}), goldSettings: s } }); } catch (e) { /* kept locally */ }
    }
    toast('บันทึกการตั้งค่าแล้ว');
    emit('settings');
  });

  // ---------- Light / dark theme (light = theme.css on; dark = trading terminal, terminal.css — default since 14 Oct 2026) ----------
  const theme = () => (store.get('gs-theme') === 'light' ? 'light' : 'dark');
  function applyTheme(t, save) {
    if (save) store.set('gs-theme', t);
    $('themeLight').disabled = t === 'dark';
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0b0e11' : '#faf8f3';
    $('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
    document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.theme === t));
    emit('theme');
  }
  $('themeBtn').addEventListener('click', () => {
    applyTheme(theme() === 'dark' ? 'light' : 'dark', true);
    toast(theme() === 'dark' ? '🌙 เปลี่ยนเป็นโหมดมืดแล้ว' : '☀️ เปลี่ยนเป็นโหมดสว่างแล้ว');
  });
  $('themeSeg').addEventListener('click', (e) => e.target.dataset.theme && applyTheme(e.target.dataset.theme, true));
  applyTheme(theme());

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  // Called by main.js once the user is signed in and the first data has loaded
  function start() {
    fillAccount();
    fillSettings();
    setChartMode(store.get('gs-chart') || 'simple');
    showTab(currentTab());
  }

  window.UI = {
    start, toast, settings, theme,
    on(name, fn) { listeners.push([name, fn]); },
  };
})();

// Phones: landscape only (user, 15 Oct 2026: "เปิดในโทรศัพท์เป็นแนวนอน ไม่เอาแนวตั้ง มันแคบไป").
// A web page can't rotate the phone by itself: the installed app opens in landscape (manifest "orientation"), and
// Android browsers can lock landscape in full screen (screen.orientation.lock). In portrait a cover asks to turn the
// phone — "ดูแนวตั้งชั่วคราว" hides it for this visit (for phones with rotation lock on). iPhone: rotate by hand.
(function () {
  const phone = Math.min(screen.width, screen.height) <= 600 && matchMedia('(pointer: coarse)').matches;
  if (!phone) return;
  const html = document.documentElement;
  let skip = false;
  try { skip = sessionStorage.getItem('gs-portrait-ok') === '1'; } catch (e) { /* storage blocked */ }
  if (!skip) html.classList.add('need-landscape');
  const canLock = !!(screen.orientation && screen.orientation.lock && html.requestFullscreen);
  // iPhone (user's phone, 16 Oct): no full-screen lock in Safari → the button stays hidden, the hint says where the rotation lock is
  const iOS = /iPhone|iPod/.test(navigator.userAgent);
  const el = document.createElement('div');
  el.id = 'rotateCover';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="rot-box"><div class="rot-phone" aria-hidden="true"><i></i></div>
    <b>หมุนโทรศัพท์เป็นแนวนอน</b><p>Gold Signal ออกแบบให้ดูแนวนอนบนมือถือ กราฟ ตาราง และแดชบอร์ดจะกว้างขึ้น</p>
    ${canLock && !iOS ? '<button type="button" class="btn gold" id="rotGo">เปิดแนวนอนเต็มจอ</button>' : ''}
    <button type="button" class="rot-skip" id="rotSkip">ดูแนวตั้งชั่วคราว</button>
    <small>${iOS ? 'iPhone: ถ้าหมุนแล้วจอไม่หมุน ปัดลงจากมุมขวาบน → แตะไอคอนแม่กุญแจ (ล็อกการหมุนจอ) ให้ปิด แล้วหมุนเครื่องอีกครั้ง' : 'ถ้าหมุนแล้วจอไม่หมุน ให้ปิด “ล็อกการหมุนจอ” ของโทรศัพท์ก่อน'}</small></div>`;
  document.body.appendChild(el);
  const lock = async () => {
    try {
      if (!document.fullscreenElement) await html.requestFullscreen({ navigationUI: 'hide' });
      await screen.orientation.lock('landscape');
    } catch (e) { /* not allowed here — the cover still asks to rotate */ }
  };
  const go = document.getElementById('rotGo');
  if (go) go.addEventListener('click', lock);
  document.getElementById('rotSkip').addEventListener('click', () => {
    html.classList.remove('need-landscape');
    try { sessionStorage.setItem('gs-portrait-ok', '1'); } catch (e) { /* ok */ }
  });
  // installed app (standalone): ask for landscape right away
  if (matchMedia('(display-mode: standalone)').matches && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
})();
