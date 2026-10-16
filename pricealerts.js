// 🔔 Gold price alerts the member sets (account tab #paCard, 17 Oct 2026 — user: "ทำมา" after "ตั้งราคาแจ้งเตือนเอง").
// Saved on the server (/api/alerts, middleware.js); every 5-minute check (scripts/price-alerts-user.js) pushes a notification
// to the member's devices when gold reaches the price, then removes it. Direction comes from the price now: above → "up".
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$('paCard')) return;
  const f2 = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const live = () => { try { const g = window.GS_LIVE && window.GS_LIVE(); return g && g.px > 0 ? g.px : null; } catch (e) { return null; } };
  const enc = (o) => btoa(JSON.stringify(o));
  let list = [];
  const msg = (t, bad) => { $('paMsg').textContent = t; $('paMsg').className = `small ${bad ? 'down' : 'muted'}`; };
  function paint() {
    const px = live();
    $('paList').innerHTML = list.length ? list.slice().sort((a, b) => a.price - b.price).map((a) => {
      const gap = px ? a.price - px : null;
      return `<li><span class="pa-dir ${a.dir}">${a.dir === 'up' ? '▲ ขึ้นถึง' : '▼ ลงถึง'}</span><b class="mono">${f2(a.price)}</b>
        <small class="muted">${gap == null ? '' : `อีก ${gap >= 0 ? '+' : '−'}$${f2(Math.abs(gap))}`}</small><button type="button" class="pa-del" data-id="${a.id}" aria-label="ลบ">✕</button></li>`;
    }).join('') : '<li class="muted small">ยังไม่ได้ตั้ง</li>';
    $('paQuick').innerHTML = px ? [-30, -15, 15, 30].map((d) => `<button type="button" class="pa-q" data-p="${Math.round((px + d) * 2) / 2}">${d > 0 ? '+' : '−'}$${Math.abs(d)} (${f2(Math.round((px + d) * 2) / 2)})</button>`).join('') : '';
  }
  async function call(method, body) {
    const r = await fetch('/api/alerts', { method, headers: body ? { 'x-alert': enc(body) } : {}, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `ผิดพลาด (${r.status})`);
    list = j.alerts || [];
    paint();
  }
  async function add(price) {
    const px = live();
    if (!(price > 0)) return msg('ใส่ราคาก่อน', true);
    if (!px) return msg('ยังไม่มีราคาสด ลองอีกครั้งในไม่กี่วินาที', true);
    if (Math.abs(price - px) < 0.5) return msg('ราคานี้ใกล้ราคาตอนนี้มาก — ใส่ราคาที่ห่างออกไปอีกนิด', true);
    try {
      await call('POST', { price, dir: price > px ? 'up' : 'down' });
      $('paPrice').value = '';
      msg(`ตั้งแล้ว: เตือนเมื่อทอง${price > px ? 'ขึ้น' : 'ลง'}ถึง ${f2(price)}${'Notification' in window && Notification.permission !== 'granted' ? ' — อย่าลืมกด "🔔 เปิดแจ้งเตือน" ด้านบน' : ''}`);
    } catch (e) { msg(e.message, true); }
  }
  $('paAdd').addEventListener('click', () => add(Number($('paPrice').value)));
  $('paPrice').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(Number($('paPrice').value)); });
  $('paQuick').addEventListener('click', (e) => { const b = e.target.closest('.pa-q'); if (b) add(Number(b.dataset.p)); });
  $('paList').addEventListener('click', async (e) => {
    const b = e.target.closest('.pa-del'); if (!b) return;
    try { await call('DELETE', { id: b.dataset.id }); msg('ลบแล้ว'); } catch (err) { msg(err.message, true); }
  });
  call('GET').catch(() => { list = []; paint(); });
  setInterval(() => { if (!document.hidden && location.hash === '#account') paint(); }, 5000); // "อีก $x" follows the live price
  window.addEventListener('hashchange', () => { if (location.hash === '#account') call('GET').catch(() => {}); }); // fired ones disappear
})();
