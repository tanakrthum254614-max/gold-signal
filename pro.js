// ⭐ Membership state for the page: GET /api/pro → { enabled, pro, until, sub, admin } → the expiry bar and the welcome guide.
(function () {
  // (17 Oct 2026) the free-member locks (gsLocked / pro-wall) are gone: membership is paid-only (middleware.js paidOk), so
  // everyone who reaches this page has everything. Left here: the membership state for the expiry bar and the welcome guide.
  const S = { enabled: false, pro: true, features: [] };
  window.GS_PRO = S;
  const apply = () => { window.dispatchEvent(new Event('gs-pro')); };
  fetch('/api/pro', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (!j) return;
    Object.assign(S, { enabled: !!j.enabled, pro: !!j.pro, features: j.features || [], until: j.until || 0, sub: !!j.sub, admin: !!j.admin });
    apply();
    expiryBar();
  }).catch(() => {});

  // ⏰ Ends within 3 days and doesn't renew by itself → a bar on every tab with a renew link (17 Oct 2026; the same
  // reminder also goes out as a web push, scripts/pro-expiry.js). Closed for this tab with ✕.
  function expiryBar() {
    const left = S.until - Date.now();
    if (!S.enabled || S.admin || S.sub || !S.pro || !(left > 0) || left > 3 * 864e5) return;
    try { if (sessionStorage.getItem('gs-exp-bar') === String(S.until)) return; } catch (e) { /* ok */ }
    const bar = document.createElement('div');
    bar.className = 'exp-bar';
    const day = new Date(S.until).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
    bar.innerHTML = `<span>⏰ สมาชิกของคุณหมดอายุ <b>${day}</b> (อีก ${Math.max(1, Math.ceil(left / 864e5))} วัน)</span><a class="btn gold" href="#account">ต่ออายุ</a><button type="button" aria-label="ปิด">✕</button>`;
    bar.querySelector('button').onclick = () => { bar.remove(); try { sessionStorage.setItem('gs-exp-bar', String(S.until)); } catch (e) { /* ok */ } };
    bar.querySelector('a').onclick = () => bar.remove();
    document.body.prepend(bar);
  }

  // 📘 Getting started (17 Oct 2026): shown once right after the first payment (pay.html sets gs-welcome), and any time
  // from the account tab (window.gsWelcome). Three steps: which signals to use, lot size, alerts.
  window.gsWelcome = function () {
    if (document.getElementById('welcome')) return;
    const w = document.createElement('div');
    w.id = 'welcome'; w.className = 'welcome'; w.setAttribute('role', 'dialog');
    w.innerHTML = `<div class="wl-box">
      <h2>ยินดีต้อนรับสู่ Gold Signal 🎉</h2><p class="muted">เริ่มใช้ใน 3 ขั้น</p>
      <ol class="wl-steps">
        <li><b>📈 ดูสัญญาณ</b><span>หน้า <a href="#home">สัญญาณ</a> = ระบบหลัก 1 ชม. · ในหน้า <a href="#chart">กราฟ</a> กรอบ <b>1 ชม. / 5 ชม. / 1 วัน</b> ผ่านการทดสอบทุกช่วง — ป้าย ⚠️ = สัญญาณเสี่ยง ใช้ขนาดเล็ก · เข้าเมื่อขึ้น ✅ ควรเข้า และวาง SL / TP ตามที่บอกทุกครั้ง</span></li>
        <li><b>🧮 ขนาดการซื้อขาย</b><span>เสี่ยงไม่เกิน 1–2% ของทุนต่อรายการ — กดปุ่ม 🧮 คำนวณ lot บนการ์ดสัญญาณ ใส่ทุนแล้วได้ขนาดการซื้อขายทันที</span></li>
        <li><b>🔔 แจ้งเตือน</b><span>แท็บ <a href="#account">บัญชี</a> → เพิ่มเพื่อน LINE และเปิดแจ้งเตือนบนเครื่อง ระบบจะส่งให้เมื่อมีจุดเข้า</span></li>
      </ol>
      <p class="muted small">ดูผลจริงทุกรายการ (ทั้งชนะและแพ้) ได้ที่การ์ด 📒 หน้าสัญญาณ · ผลในอดีตไม่รับประกันอนาคต ไม่ใช่คำแนะนำการลงทุน</p>
      <button type="button" class="btn gold wide">เริ่มใช้งาน</button></div>`;
    const close = () => w.remove();
    w.addEventListener('click', (e) => { if (e.target === w || e.target.closest('button') || e.target.closest('a')) close(); });
    document.body.appendChild(w);
  };
  try { if (localStorage.getItem('gs-welcome') === '1') { localStorage.removeItem('gs-welcome'); setTimeout(window.gsWelcome, 800); } } catch (e) { /* ok */ }
})();
