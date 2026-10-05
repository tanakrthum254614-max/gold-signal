// App shell: tabs, first-time setup, account page, sharing
(function () {
  const $ = (id) => document.getElementById(id);
  const TABS = ['home', 'chart', 'learn', 'account'];
  const PERSONAS = {
    buy: { icon: '🛒', name: 'อยากซื้อทองเก็บ' },
    hold: { icon: '💰', name: 'มีทองอยู่แล้ว' },
    trade: { icon: '⚡', name: 'เทรดทำกำไรระยะสั้น' },
  };
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

  // ---------- Persona: saved on the Clerk account so it follows the user across devices ----------
  function persona() {
    const u = window.AUTH && AUTH.user;
    const fromAccount = u && u.unsafeMetadata && u.unsafeMetadata.goldPersona;
    return fromAccount || store.get('gs-persona');
  }
  async function setPersona(p) {
    store.set('gs-persona', p);
    markPersona();
    emit('persona');
    const u = window.AUTH && AUTH.user;
    if (u && u.update) {
      try { await u.update({ unsafeMetadata: { ...(u.unsafeMetadata || {}), goldPersona: p } }); } catch (e) { /* kept locally */ }
    }
  }
  function markPersona() {
    const p = persona();
    document.querySelectorAll('.persona-pick button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
  }
  $('accPick').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    setPersona(b.dataset.p);
    toast(`บันทึกแล้ว: ${PERSONAS[b.dataset.p].name}`);
  });
  $('obPick').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    setPersona(b.dataset.p);
    $('onboard').hidden = true;
    location.hash = '#home';
    toast('เรียบร้อย! ใช้เมนูด้านล่างเพื่อดูกราฟ เรียนรู้ หรือตั้งค่าบัญชี');
  });

  // ---------- Account + sharing ----------
  function fillAccount() {
    const u = window.AUTH && AUTH.user;
    const name = u ? (u.fullName || u.firstName || '') : 'ผู้ใช้';
    const email = u && u.primaryEmailAddress ? u.primaryEmailAddress.emailAddress : '';
    const img = u && u.imageUrl;
    $('accName').textContent = name || email;
    $('accEmail').textContent = email;
    [$('accAvatar'), $('hdrAvatar')].forEach((el) => {
      if (img) el.src = img; else el.hidden = true;
    });
    $('obName').textContent = u && u.firstName ? ` คุณ${u.firstName}` : '';
    $('signOut').hidden = !u;
  }

  const shareUrl = location.origin + location.pathname;
  const shareText = 'ลองใช้ Gold Signal ดูสิ — บอกว่าทองขึ้นหรือลง ควรซื้อหรือรอ เข้าใจง่ายมาก';
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
    markPersona();
    setChartMode(store.get('gs-chart') || 'simple');
    showTab(currentTab());
    if (!persona()) $('onboard').hidden = false;
  }

  window.UI = {
    PERSONAS, persona, start, toast,
    on(name, fn) { listeners.push([name, fn]); },
    isVisible: (id) => !!$(id) && $(id).offsetParent !== null,
  };
})();
