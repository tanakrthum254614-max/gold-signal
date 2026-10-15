const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
// phones (also inside the site's iframe): compact sizes — style.css html.phone (user, 15 Oct: "ข้อมูลดูใหญ่ไปหมด มันล้น")
// (not when embedded in the site on a phone: the site already scales the whole page down — index.html vp-scaled)
const siteScaled = (() => { try { return parent !== window && parent.document.documentElement.classList.contains('vp-scaled'); } catch (e) { return false; } })();
if (!siteScaled && Math.min(screen.width, screen.height) <= 600 && matchMedia('(pointer: coarse)').matches) document.documentElement.classList.add('phone');
let current = params.get('d') || 'ndx', mtime = 0, dash = null, extra = '';

// ---------- ภาษาไทย (ผู้ใช้ 12 ต.ค.: "ขอภาษาไทย") ----------
const ZONE_TH = { live: 'ราคาสด', cockpit: 'ภาพรวม', tech: 'เทคนิค', macro: 'เศรษฐกิจมหภาค', context: 'ข่าวและข้อมูล', heatmap: 'แผนที่ตลาด', stocks: 'หุ้นทุกตัว', screens: 'คัดหุ้น' };
const TH_WORDS = [
  ['Fund Manager Research Terminal', 'ห้องวิเคราะห์แบบผู้จัดการกองทุน'], ['Fund manager cockpit', 'ภาพรวมแบบผู้จัดการกองทุน'],
  ['Dividend cockpit', 'ภาพรวมหุ้นปันผล'], ['Dividend heatmap', 'แผนที่ตลาดหุ้นปันผล'], ['DIVIDEND', 'หุ้นปันผล'], ['GOLD —', 'ทองคำ —'],
  ['Live market', 'ตลาดสด'], ['Live —', 'ราคาสด —'], ['Price & technicals', 'ราคาและเทคนิค'], ['Macro backdrop', 'ภาพเศรษฐกิจมหภาค'],
  ['Context & systems', 'ข่าว ผลงาน และระบบ'], ['Heatmap —', 'แผนที่ตลาด —'], [' heatmap', ' แผนที่ตลาด'], ['Screens —', 'คัดหุ้น —'],
  ['Price liveline', 'เส้นราคาสด'], ['Price ticker', 'กระดานราคา'], ['Asset profile', 'ข้อมูลสินทรัพย์'], ['Snapshot', 'ภาพรวมตอนนี้'],
  ['Cockpit —', 'ภาพรวม —'], ['Investment view', 'มุมมองการลงทุน'], ['Scenarios', 'ฉากทัศน์ราคา'], ['Thesis', 'เหตุผลหลัก'],
  ['Action matrix', 'แผนปฏิบัติ'], ['Rates board', 'กระดานอัตราดอกเบี้ย'], ['Yield curve', 'เส้นผลตอบแทนพันธบัตร'],
  ['Real yield', 'ดอกเบี้ยแท้จริง'], ['Credit spread', 'ส่วนต่างดอกเบี้ยหุ้นกู้'], ['Inflation pulse', 'ชีพจรเงินเฟ้อ'],
  ['Index level', 'ระดับดัชนี'], ['VIX gauge', 'มาตรวัดความกลัว VIX'], ['Breadth:', 'ความกว้างตลาด:'], ['Div score', 'คะแนนปันผล'],
  ['tick-by-tick', 'ทุก tick'], ['Neutral', 'กลาง'], [' vs ', ' เทียบ '], ['Context', 'ข่าวและข้อมูล'],
];
const thText = (s) => (typeof s !== 'string' ? s : TH_WORDS.reduce((t, [en, th]) => t.split(en).join(th), s));
function thDash(d) {
  d.title = thText(d.title); d.subtitle = thText(d.subtitle);
  (d.zones || []).forEach((z) => {
    z.short = ZONE_TH[z.id] || thText(z.short); z.title = thText(z.title); z.subtitle = thText(z.subtitle);
    (z.frames || []).forEach((f) => {
      ['title', 'subtitle', 'sub'].forEach((k) => { if (typeof f[k] === 'string') f[k] = thText(f[k]); });
      if (f.source === 'realized') f.source = 'คำนวณจากราคาจริง';
    });
  });
}

// dashboards JSON (zframes-refresh) still names the old purple accent for some series → the site's gold (16 Oct 2026)
async function j(url) { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return JSON.parse((await r.text()).replace(/#c4b5fd/gi, '#f0b90b')); }

async function loadList() {
  const list = [
    // ทองคำ / GOLD removed from the site menu (user, 15 Oct 2026: "ตัดในส่วนนี้ออก ทอง/Gold ส่วนที่เหลือเอาไว้") — ?d=gold falls back to the first
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
  thDash(dash); // Thai labels
  window.SITE_CARDS?.inject(dash); // inside the Gold Signal site: signals / news / live record cards (site-cards.js)
  window.dash = dash;
  dash.stockMap = Object.fromEntries((dash.stocks || []).map(x => [x.s, x]));
  FRAME_DATA.length = 0;
  document.title = `zframes · ${dash.title}`;
  if (window.SITE_CARDS) SITE_CARDS.stamp(dash); else $('#stamp').textContent = 'ข้อมูลวิเคราะห์ ณ ' + new Date(dash.generatedAt).toLocaleString('th-TH');
  // header trimmed (user, 16 Oct 2026: "แถบไหนไม่สำคัญเอาออก") — name is in the top-bar picker, the tab shows the zone
  $('#app').innerHTML =
    `<nav class="zn">${dash.zones.map(z => `<button type="button" data-zone="${esc(z.id)}">${esc(z.short || z.title)}</button>`).join('')}</nav>` +
    dash.zones.map(z => `<div class="zone" id="${esc(z.id)}" hidden><div class="zsub">${esc(z.subtitle || '')}</div>
      <div class="grid">${z.frames.map(renderFrame).join('')}</div></div>`).join('');
  showZone(params.get('z') || zoneMem()[current] || dash.zones[0]?.id);
  $('#ticker').innerHTML = `<div class="track"></div>`;
  LIVE.start();
  STOCKS.start();
  connectLive(current);
  if (dash.kind === 'gold') loadGoldTF();
  tick();
  window.SITE_CARDS?.start();
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
  const on = document.querySelector('#app .zn button.on'); if (on && on.parentElement.scrollWidth > on.parentElement.clientWidth) on.parentElement.scrollTo({ left: on.offsetLeft - (on.parentElement.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
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
