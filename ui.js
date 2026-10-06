// App shell: tabs, account page, sharing
(function () {
  const $ = (id) => document.getElementById(id);
  const TABS = ['home', 'stats', 'chart', 'learn', 'account'];
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
    const name = u ? (u.fullName || u.firstName || '') : 'ผู้เยี่ยมชม (โหมดดูตัวอย่าง)';
    const email = u && u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : '';
    const img = u && u.imageUrl;
    $('accName').textContent = name || email;
    $('accEmail').textContent = email;
    [$('accAvatar'), $('hdrAvatar')].forEach((el) => {
      if (img) el.src = img; else el.hidden = true;
    });
    $('signOut').hidden = !u;
    $('accSignIn').hidden = !!u;
  }

  const shareUrl = location.origin + location.pathname;
  const shareText = 'Gold Signal — ราคาทอง กราฟ และสัญญาณซื้อระบบ 30 นาที พร้อมผลสัญญาณที่บันทึกจริง';
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
  $('signOut').addEventListener('click', () => window.Clerk && Clerk.signOut());

  // ---------- Trading settings (capital / risk / spread) — saved on the account + this browser ----------
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

  // ---------- Light / dark theme (light = theme.css on; dark = the original look) ----------
  const theme = () => (store.get('gs-theme') === 'dark' ? 'dark' : 'light');
  function applyTheme(t, save) {
    if (save) store.set('gs-theme', t);
    $('themeLight').disabled = t === 'dark';
    document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0d1016' : '#f3f5f9';
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
    setChartMode(store.get('gs-chart') || 'pro');
    showTab(currentTab());
  }

  window.UI = {
    start, toast, settings, theme,
    on(name, fn) { listeners.push([name, fn]); },
  };
})();
