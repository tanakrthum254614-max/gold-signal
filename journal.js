// 📓 Journal tab — the member's private trade journal (api/journal.mjs; one file per member, only they can read it).
// Plus: back-office articles on the news tab (api/articles.mjs) and the PRO card on the account tab (api/pro.mjs,
// api/pay/*). All text from the server is escaped before it goes on the page.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (t) => (window.UI ? UI.toast(t) : alert(t));
  async function api(path, opt = {}) {
    const r = await fetch(path, { ...opt, headers: { 'content-type': 'application/json', ...(opt.headers || {}) }, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({ ok: false, error: 'เชื่อมต่อไม่ได้' }));
    if (!r.ok || j.ok === false) { const e = new Error(j.error || `ผิดพลาด ${r.status}`); e.status = r.status; e.data = j; throw e; }
    return j;
  }
  window.GS_API = api;
  const MOODS = { calm: '😌 สงบ', fear: '😨 กลัว', greed: '🤑 โลภ', revenge: '😤 อยากเอาคืน', tired: '😵 เหนื่อย', fomo: '🏃 กลัวตกรถ' };
  const TFL = { '5m': '5 นาที', '15m': '15 นาที', '30m': '30 นาที', '1h': '1 ชม.', '5h': '5 ชม.', '1d': '1 วัน', '1w': '1 สัปดาห์', other: 'อื่น ๆ' };
  const money = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(+v).toFixed(2)}`);
  const when = (t) => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const localInput = (t) => { const d = new Date(t - new Date().getTimezoneOffset() * 60e3); return d.toISOString().slice(0, 16); };

  // ================= 📓 Journal =================
  const tab = $('tab-journal');
  let entries = [], loaded = false, editing = null;
  function stats() {
    const done = entries.filter((e) => e.result != null);
    const wins = done.filter((e) => e.result > 0).length;
    const sum = done.reduce((s, e) => s + e.result, 0);
    const sys = done.filter((e) => e.system), own = done.filter((e) => !e.system);
    const wr = (a) => (a.length ? `${Math.round((a.filter((e) => e.result > 0).length / a.length) * 100)}%` : '—');
    const net = (a) => money(a.reduce((s, e) => s + e.result, 0));
    const moodRows = Object.keys(MOODS).map((k) => { const a = done.filter((e) => e.mood === k); return a.length ? `<li><span>${MOODS[k]}</span><b>${a.length} ไม้ · ชนะ ${wr(a)} · <span class="${a.reduce((s, e) => s + e.result, 0) >= 0 ? 'up' : 'down'}">${net(a)}</span></b></li>` : ''; }).join('');
    $('jrSum').innerHTML = `
      <div class="jr-kpis">
        <div><small>ไม้ทั้งหมด</small><b>${entries.length}</b></div>
        <div><small>ชนะ</small><b>${done.length ? Math.round((wins / done.length) * 100) : 0}%</b></div>
        <div><small>กำไร/ขาดทุนรวม (USD)</small><b class="${sum >= 0 ? 'up' : 'down'}">${money(sum)}</b></div>
        <div><small>ตามระบบ vs เข้าเอง</small><b>${wr(sys)} <span class="muted">/</span> ${wr(own)}</b></div>
      </div>
      ${moodRows ? `<ul class="jr-moods"><li class="muted small">ผลตามอารมณ์ตอนเข้า</li>${moodRows}</ul>` : ''}`;
  }
  function list() {
    $('jrList').innerHTML = entries.length ? entries.map((e) => `
      <li class="jr-item" data-id="${esc(e.id)}">
        <div class="jr-row"><span class="jr-side ${e.side === 'SELL' ? 'sell' : 'buy'}">${e.side === 'SELL' ? 'Sell' : 'Buy'}</span>
          <b class="mono">${esc(e.entry)}${e.exit != null ? ` → ${esc(e.exit)}` : ''}</b>
          <span class="muted small">${when(e.at)} · ${TFL[e.tf] || ''}${e.lots ? ` · ${e.lots} lot` : ''}</span>
          <b class="mono jr-res ${e.result > 0 ? 'up' : e.result < 0 ? 'down' : ''}">${e.result == null ? 'ยังถือ' : money(e.result)}</b></div>
        <div class="muted small">${e.system ? '🎯 ตามสัญญาณ' : '🙋 เข้าเอง'}${e.mood ? ` · ${MOODS[e.mood]}` : ''}${e.sl == null ? ' · ⚠️ ไม่มี SL' : ` · SL ${esc(e.sl)}`}${e.tp != null ? ` · TP ${esc(e.tp)}` : ''}</div>
        ${e.note ? `<p class="jr-note">${esc(e.note)}</p>` : ''}${e.lesson ? `<p class="jr-note jr-lesson">💡 ${esc(e.lesson)}</p>` : ''}
        <div class="jr-acts"><button type="button" class="btn act" data-act="edit">แก้ไข</button><button type="button" class="btn act danger" data-act="del">ลบ</button></div>
      </li>`).join('') : '<li class="muted center jr-empty">ยังไม่มีบันทึก — เริ่มจดไม้แรกด้านบน แล้วโค้ช AI จะช่วยดูนิสัยการเทรดให้</li>';
  }
  function render() { stats(); list(); }
  async function load() {
    try { entries = (await api('/api/journal')).entries; loaded = true; render(); }
    catch (e) { $('jrList').innerHTML = `<li class="muted center">โหลดบันทึกไม่ได้: ${esc(e.message)}</li>`; }
  }
  function formData() {
    const f = $('jrForm');
    const v = (n) => f.elements[n].value.trim();
    return { id: editing || undefined, at: v('at') ? new Date(v('at')).getTime() : Date.now(), side: v('side'), tf: v('tf'),
      entry: v('entry'), sl: v('sl'), tp: v('tp'), exit: v('exit'), lots: v('lots'), result: v('result'),
      system: f.elements.system.checked, mood: v('mood'), note: v('note'), lesson: v('lesson') };
  }
  function fill(e) {
    const f = $('jrForm');
    f.reset();
    editing = e ? e.id : null;
    f.elements.at.value = localInput(e ? e.at : Date.now());
    if (e) {
      ['side', 'tf', 'entry', 'sl', 'tp', 'exit', 'lots', 'mood', 'note', 'lesson'].forEach((k) => { f.elements[k].value = e[k] == null ? '' : e[k]; });
      f.elements.result.value = '';
      f.elements.system.checked = !!e.system;
    }
    $('jrSave').textContent = e ? 'บันทึกการแก้ไข' : 'บันทึกไม้นี้';
    $('jrCancel').hidden = !e;
  }
  if (tab) {
    $('jrForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = $('jrSave');
      btn.disabled = true;
      try {
        const j = await api('/api/journal', { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ entry: formData() }) });
        entries = j.entries; render(); fill(null);
        toast('บันทึกแล้ว');
      } catch (e) { toast(e.message); }
      btn.disabled = false;
    });
    $('jrCancel').addEventListener('click', () => fill(null));
    // Fill from the signal on screen: the first timeframe with a ✅ entry, else the one held, from window.GS_SIGNALS
    $('jrFromSig').addEventListener('click', async () => {
      if (!window.GS_SIGNALS) return toast('เปิดหน้ากราฟก่อนสักครั้ง');
      const all = await GS_SIGNALS().catch(() => []);
      const go = all.find((s) => s.buy && s.buy.go) || all.find((s) => s.sell && s.sell.go);
      const held = all.find((s) => s.open);
      const f = $('jrForm');
      if (go) { const sell = !(go.buy && go.buy.go); f.elements.side.value = sell ? 'SELL' : 'BUY'; f.elements.tf.value = go.tf; f.elements.entry.value = go.price ? go.price.toFixed(2) : ''; }
      else if (held) { f.elements.side.value = held.open.side === 'SELL' ? 'SELL' : 'BUY'; f.elements.tf.value = held.tf; f.elements.entry.value = held.open.entry; f.elements.sl.value = held.open.sl || ''; f.elements.tp.value = (held.open.tps || [])[0] || ''; }
      else return toast('ตอนนี้ระบบยังไม่มีจุดเข้า');
      f.elements.system.checked = true;
      toast('เติมจากสัญญาณแล้ว ตรวจราคาที่เข้าจริงอีกครั้ง');
    });
    $('jrList').addEventListener('click', async (ev) => {
      const b = ev.target.closest('button[data-act]');
      if (!b) return;
      const id = b.closest('[data-id]').dataset.id;
      const e = entries.find((x) => x.id === id);
      if (b.dataset.act === 'edit') { fill(e); $('jrForm').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (!confirm('ลบไม้นี้ออกจากสมุด?')) return;
      try { entries = (await api(`/api/journal?id=${encodeURIComponent(id)}`, { method: 'DELETE' })).entries; render(); } catch (err) { toast(err.message); }
    });
    $('jrWipe').addEventListener('click', async () => {
      if (!entries.length) return;
      if (!confirm(`ลบสมุดบันทึกทั้งหมด ${entries.length} ไม้? ลบแล้วกู้คืนไม่ได้`)) return;
      try { entries = (await api('/api/journal?all=1', { method: 'DELETE' })).entries; render(); toast('ลบสมุดบันทึกแล้ว'); } catch (err) { toast(err.message); }
    });
    $('jrCoach').addEventListener('click', () => {
      location.hash = '#chart';
      setTimeout(() => window.CC_COACH && CC_COACH('ช่วยดูสมุดบันทึกเทรดของผมหน่อย ผมควรปรับอะไรก่อน'), 400);
    });
    fill(null);
    if (window.UI) UI.on('tab:journal', () => { if (!loaded) load(); });
  }

  // ================= 📝 Articles (news tab) =================
  // Plain text with a few marks → safe HTML (escape first, then format)
  function md(text) {
    const lines = esc(text).split('\n');
    let html = '', inList = false;
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    for (const l of lines) {
      const li = l.match(/^\s*[-•]\s+(.*)/);
      if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
      if (inList) { html += '</ul>'; inList = false; }
      const h = l.match(/^#{1,3}\s+(.*)/);
      if (h) html += `<h4>${inline(h[1])}</h4>`;
      else if (l.trim()) html += `<p>${inline(l)}</p>`;
    }
    return html + (inList ? '</ul>' : '');
  }
  window.GS_MD = md;
  const TAG = { analysis: '📈 บทวิเคราะห์', lesson: '🎓 ความรู้', news: '📰 ข่าว', update: '🔔 อัปเดตระบบ' };
  async function loadArticles() {
    const box = $('artList');
    if (!box) return;
    try {
      const items = (await api('/api/articles')).items;
      $('artCard').hidden = !items.length;
      box.innerHTML = items.slice(0, 10).map((a, i) => `
        <details class="art" ${i === 0 ? 'open' : ''}><summary><span class="art-tag">${TAG[a.tag] || ''}</span>${a.pinned ? '📌 ' : ''}<b>${esc(a.title)}</b><small class="muted">${when(a.updated || a.at)}</small></summary>
          <div class="art-body">${md(a.body)}</div></details>`).join('');
    } catch (e) { $('artCard').hidden = true; }
  }
  if (window.UI) UI.on('tab:stats', loadArticles);

  // ================= ⭐ PRO (account tab) =================
  const baht = (p) => (p ? `${(p.amount / 100).toLocaleString('th-TH')} ${p.currency === 'thb' ? 'บาท' : p.currency.toUpperCase()}` : '');
  async function loadPro() {
    const card = $('proCard');
    if (!card) return;
    let s;
    try { s = await api('/api/pro'); } catch (e) { card.hidden = true; return; }
    window.GS_PRO = s;
    const feats = s.features.map((f) => ({ ai: '🤖 โค้ช AI ส่วนตัว (อ่านสัญญาณทุกกรอบ + สมุดเทรดของคุณ)', dashboard: '📊 หุ้นสหรัฐ Nasdaq 100 · S&P 500 · ปันผล + พอร์ตกูรู 28 คน + แจ้งเตือนกูรูซื้อขาย', signals: '📈 สัญญาณ Buy/Sell ทุกกรอบเวลา 5 นาที – 1 สัปดาห์ + แชทถามจุดเข้าทุกกรอบ (ฟรี: ระบบหลัก 1 ชม.)', alerts: '🔔 แจ้งเตือนราคาทอง 10 รายการ (ฟรี: 1 รายการ)' }[f] || f));
    const p = s.prices || {};
    const status = s.admin ? '⭐ แอดมิน — ใช้ได้ทุกอย่าง'
      : s.pro ? `⭐ สมาชิก PRO ถึง ${new Date(s.until).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}${s.sub ? ' · ต่ออายุอัตโนมัติ' : ''}`
        : s.enabled ? 'สมาชิกฟรี' : '🎁 ช่วงทดลอง: ตอนนี้ทุกคนใช้ฟีเจอร์ PRO ได้ฟรี';
    // no selling while everyone has PRO free · admins see the same plans as a preview (16 Oct: "ไม่เห็นมีให้เก็บตังเลย")
    const preview = s.enabled && s.admin && (p.month || p.year);
    const canBuy = s.enabled && (!s.admin || preview) && (p.month || p.year);
    const dis = preview ? ' disabled' : '';
    card.hidden = false;
    card.innerHTML = `<h3>สมาชิก PRO ⭐</h3>
      <p class="pro-status">${esc(status)}</p>
      <ul class="pro-feats">${feats.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      ${preview ? '<p class="muted small">👀 ตัวอย่าง — สมาชิกฟรีจะเห็นปุ่มจ่ายเงินแบบนี้ (บัญชีแอดมินกดซื้อไม่ได้)</p>' : ''}
      ${canBuy ? `<div class="pro-plans">${['month', 'year'].filter((k) => p[k]).map((k) => `<div class="pro-plan"><b>${k === 'month' ? 'รายเดือน' : 'รายปี'}</b><span class="mono">${baht(p[k])}</span>
        <button class="btn gold" type="button" data-plan="${k}" data-method="card"${dis}>💳 บัตร (ต่ออายุอัตโนมัติ)</button>
        <button class="btn" type="button" data-plan="${k}" data-method="promptpay"${dis}>📱 จ่ายครั้งเดียว ${k === 'month' ? '30' : '365'} วัน${p[k].currency === 'thb' ? ' (PromptPay / บัตร)' : ''}</button></div>`).join('')}</div>
        <p class="muted small">ชำระผ่าน Stripe — เว็บนี้ไม่เห็นและไม่เก็บเลขบัตร · <a href="/terms.html" target="_blank" rel="noopener">เงื่อนไข ยกเลิก และคืนเงิน</a> · สิทธิ์ PRO เปิดทันทีที่ชำระสำเร็จ · ไม่ใช่คำแนะนำการลงทุน</p>` : ''}
      ${s.sub ? '<button class="btn" type="button" id="proPortal">จัดการ / ยกเลิกการต่ออายุ</button>' : ''}
      <button class="btn" type="button" onclick="window.gsWelcome && gsWelcome()">📘 วิธีเริ่มใช้งาน (3 ขั้น)</button>`;
  }
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('#proCard button[data-plan], #proPortal');
    if (!b) return;
    b.disabled = true;
    try {
      const j = b.id === 'proPortal' ? await api('/api/pay/portal', { method: 'POST' }) : await api('/api/pay/checkout', { method: 'POST', body: JSON.stringify({ plan: b.dataset.plan, method: b.dataset.method }) });
      location.href = j.url;
    } catch (e) { toast(e.message); b.disabled = false; }
  });
  if (window.UI) UI.on('tab:account', loadPro);
  // If the app already opened on one of these tabs before this file loaded
  setTimeout(() => { const t = location.hash.slice(1); if (t === 'journal' && !loaded && tab) load(); if (t === 'stats') loadArticles(); if (t === 'account') loadPro(); }, 0);
  const pay = new URLSearchParams(location.search).get('pay');
  if (pay) {
    setTimeout(() => toast(pay === 'ok' ? '✅ ชำระเงินสำเร็จ — เปิดสิทธิ์ PRO ภายในไม่กี่วินาที' : 'ยกเลิกการชำระเงินแล้ว'), 1500);
    if (pay === 'ok') setTimeout(loadPro, 5000);
    history.replaceState(null, '', location.pathname + location.hash);
  }
})();
