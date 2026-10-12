const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
let current = params.get('d') || 'gold', mtime = 0, dash = null, extra = '';

async function j(url) { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); }

async function loadList() {
  const list = [
    {id:'gold', title:'ทองคำ / GOLD'},
    {id:'ndx', title:'Nasdaq 100'},
    {id:'spx', title:'S&P 500'},
    {id:'div', title:'หุ้นปันผล'}
  ];
  if (list.length && !list.some(d => d.id === current)) current = list[0].id;
  $('#pick').innerHTML = list.map(d => `<option value="${d.id}" ${d.id === current ? 'selected' : ''}>${esc(d.title)}</option>`).join('');
}

async function load() {
  try {
    dash = await j(`./dashboards/${current}.json`);
  } catch {
    $('#app').innerHTML = `<p class="pad muted">ยังไม่มี dashboard "${esc(current)}" — พิมพ์ <b>/zframes วิเคราะห์ทองคำ</b> ใน Claude Code</p>`;
    return;
  }
  window.dash = dash;
  dash.stockMap = Object.fromEntries((dash.stocks || []).map(x => [x.s, x]));
  FRAME_DATA.length = 0;
  document.title = `zframes · ${dash.title}`;
  $('#stamp').textContent = 'ข้อมูลวิเคราะห์ ณ ' + new Date(dash.generatedAt).toLocaleString('th-TH');
  $('#app').innerHTML = `<h1 class="dash">${esc(dash.title)}</h1><div class="dsub">${esc(dash.subtitle || '')}</div><div class="data-note">ราคาที่มีฟีดจะอัปเดตอัตโนมัติ · วันที่วิเคราะห์และข้อมูลพื้นฐานเป็นภาพรวม ณ เวลาที่ระบุ · ดูสถานะราคาสดที่แถบด้านบน</div>` +
    `<nav class="zn">${dash.zones.map(z => `<button type="button" data-zone="${esc(z.id)}">${esc(z.short || z.title)}</button>`).join('')}</nav>` +
    dash.zones.map(z => `<div class="zone" id="${esc(z.id)}" hidden><h2>${esc(z.title)}</h2><div class="zsub">${esc(z.subtitle || '')}</div>
      <div class="grid">${z.frames.map(renderFrame).join('')}</div></div>`).join('');
  showZone(params.get('z') || zoneMem()[current] || dash.zones[0]?.id);
  $('#ticker').innerHTML = `<div class="track"></div>`;
  LIVE.start();
  STOCKS.start();
  connectLive(current);
  if (dash.kind === 'gold') loadGoldTF();
  tick();
  if (params.get('s') && !document.querySelector('.modal')) openStock(params.get('s').toUpperCase());  // ?d=ndx&s=NVDA
}

// รีเฟรชเองเมื่อ Claude สร้าง dashboard ใหม่
async function watch() {
  // The published research snapshot is versioned with the deployment.
}

const ago = ms => { const s = Math.round((Date.now() - ms) / 1000); return s < 60 ? `${s} วิ` : s < 3600 ? `${Math.round(s / 60)} นาที` : `${Math.round(s / 3600)} ชม.`; };

// ข้อมูลโบรกเกอร์/EA (ไฟล์ในเครื่อง) — ต่อท้ายแถบวิ่ง
async function tick() {
  if (!dash?.live) { extra = ''; return; }
  const l = { broker: QS['mt5:gold'], ea: QS['ea'] };
  const parts = [];
  if (l.broker) parts.push(`<span class="tk"><b>Exness ${esc(l.broker.symbol)}</b>${l.broker.bid.toFixed(2)} / ${l.broker.ask.toFixed(2)} <small class="muted">${l.broker.open ? '' : 'ตลาดปิด · '}${ago(l.broker.t)}</small></span>`);
  if (l.ea) parts.push(`<span class="tk"><b>EA</b><span class="${l.ea.phase === 'blocked' ? 'down' : 'up'}">${esc(l.ea.phase)}</span> · equity ${usd(l.ea.equity)}${l.ea.position ? ' · มีไม้เปิด' : ''}</span>`);
  extra = parts.join('');
}

window.paintTicker = Q => {
  const t = $('#ticker .track'); if (!t || !dash?.ticker) return;
  const items = dash.ticker.map(c => {
    const q = Q[c.coin]; if (!q) return '';
    return `<span class="tk"><b>${esc(c.label)}</b>${pxFmt(q.px)} <span class="${chCls(q.ch)}">${pc(q.ch, 2)}</span></span>`;
  }).join('') + extra;
  t.innerHTML = items + items;  // ซ้ำ 2 รอบเพื่อให้วิ่งต่อเนื่อง
};

// One zone (Live / Cockpit / Technicals / …) on screen at a time — the buttons switch pages instead of scrolling.
// The last zone per dashboard is remembered (?z= in the URL, and this browser's storage).
function zoneMem() { try { return JSON.parse(localStorage.getItem('zf-zone') || '{}'); } catch { return {}; } }
function showZone(id) {
  if (!dash?.zones?.length) return;
  if (!dash.zones.some(z => z.id === id)) id = dash.zones[0].id;
  document.querySelectorAll('#app .zone').forEach(el => { el.hidden = el.id !== id; });
  document.querySelectorAll('#app .zn button').forEach(b => b.classList.toggle('on', b.dataset.zone === id));
  params.set('z', id); history.replaceState(null, '', '?' + params);
  try { localStorage.setItem('zf-zone', JSON.stringify({ ...zoneMem(), [current]: id })); } catch {}
  // charts drawn while hidden measure 0 px: let them re-measure now that the page is visible
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}
$('#app').addEventListener('click', e => {
  const b = e.target.closest('.zn button'); if (!b) return;
  showZone(b.dataset.zone);
  const nav = document.querySelector('#app .zn');
  if (nav && nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: 'start' });
});
$('#pick').addEventListener('change', e => { current = e.target.value; params.set('d', current); params.delete('z'); history.replaceState(null, '', '?' + params); load(); });
$('#ver').textContent = 'เว็บสมาชิก';
loadList().then(load);
setInterval(tick, 1000);
