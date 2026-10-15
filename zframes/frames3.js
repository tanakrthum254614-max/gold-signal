// frame ชุดที่ 3: หุ้นหลายตัว — heatmap, ตารางหุ้นทุกตัว, ขึ้น/ลงแรง, หน้ารายละเอียด (ราคาสดจาก /api/stocks/quotes)
const SQ = {};  // ราคาสดล่าสุดของหุ้น
const pct2 = v => v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(Math.abs(v) >= 10 ? 1 : 2) + '%';  // v เป็น % อยู่แล้ว
const heat = (v, scale, seq) => {
  if (v == null) return 'rgb(40,36,58)';
  if (seq) { const a = Math.max(0, Math.min(1, v / scale)); return `rgb(${Math.round(40 + 211 * a)},${Math.round(36 + 155 * a)},${Math.round(58 - 22 * a)})`; }
  const k = Math.max(-1, Math.min(1, v / scale)), a = Math.abs(k);
  const [r, g, b] = k >= 0 ? [22, 163, 74] : [220, 38, 38];
  return `rgb(${Math.round(40 + (r - 40) * a)},${Math.round(36 + (g - 36) * a)},${Math.round(58 + (b - 58) * a)})`;
};
const liveCh = s => SQ[s] ? SQ[s].ch * 100 : null;
const stockOf = s => window.dash?.stockMap?.[s];

function sparkSvg(vals, w = 90, h = 24) {
  vals = (vals || []).filter(v => v != null);
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), up = vals.at(-1) >= vals[0];
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / (hi - lo || 1) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${up ? '#34d399' : '#fb7185'}" stroke-width="1.4"/></svg>`;
}

// squarified treemap → [{...item, x, y, w, h}] ในหน่วยเดียวกับกล่อง
function treemap(items, x, y, w, h) {
  const tot = items.reduce((a, b) => a + b.v, 0), out = [];
  let rest = items.filter(i => i.v > 0).map(i => ({ ...i, a: i.v / tot * w * h }));
  while (rest.length) {
    const side = Math.min(w, h);
    const worst = row => { const s = row.reduce((a, b) => a + b.a, 0), mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
    let row = [rest[0]], i = 1;
    while (i < rest.length && worst([...row, rest[i]]) <= worst(row)) row.push(rest[i++]);
    rest = rest.slice(i);
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) { const cw = s / h; let yy = y; for (const r of row) { const rh = r.a / cw; out.push({ ...r, x, y: yy, w: cw, h: rh }); yy += rh; } x += cw; w -= cw; }
    else { const rh = s / w; let xx = x; for (const r of row) { const rw = r.a / rh; out.push({ ...r, x: xx, y, w: rw, h: rh }); xx += rw; } y += rh; h -= rh; }
  }
  return out;
}

const HEAT_METRICS = { d: { label: 'วันนี้', scale: 3 }, ch1w: { label: '1 สัปดาห์', scale: 6 }, ch1m: { label: '1 เดือน', scale: 15 }, ytd: { label: 'YTD', scale: 40 },
  y: { label: 'ยิลด์ปันผล', scale: 6, seq: true }, cagr5: { label: 'ปันผลโต 5 ปี', scale: 12 } };
function heatVal(s, k) { const x = LS(s); return x ? x[k] : null; }

function heatmapBody(f, metric) {
  const W = 1300, H = f.height || 560, items = f.items.map(i => stockOf(i)).filter(Boolean);
  const secs = {};
  for (const x of items) (secs[x.sector] = secs[x.sector] || []).push(x);
  const sr = treemap(Object.entries(secs).map(([k, v]) => ({ k, v: v.reduce((a, b) => a + (b.cap || 0), 0), list: v })).sort((a, b) => b.v - a.v), 0, 0, W, H);
  let html = '';
  for (const g of sr) {
    html += `<div class="hm-sec" style="left:${g.x / W * 100}%;top:${g.y / H * 100}%;width:${g.w / W * 100}%;height:${g.h / H * 100}%"><span>${esc(g.k)}</span></div>`;
    for (const t of treemap(g.list.map(x => ({ s: x.s, v: x.cap || 0 })).sort((a, b) => b.v - a.v), g.x, g.y + 14, g.w, Math.max(g.h - 14, 1))) {
      const v = heatVal(t.s, metric), big = t.w * t.h;
      const fs = Math.max(9, Math.min(22, Math.sqrt(big) / 5));
      html += `<div class="hm-t" data-s="${t.s}" title="${esc(stockOf(t.s)?.name)}" style="left:${t.x / W * 100}%;top:${t.y / H * 100}%;width:${t.w / W * 100}%;height:${t.h / H * 100}%;background:${heat(v, HEAT_METRICS[metric].scale, HEAT_METRICS[metric].seq)};font-size:${fs}px">
        ${big > 900 ? `<b>${t.s}</b>${big > 2200 ? `<em>${HEAT_METRICS[metric].seq ? (v == null ? '—' : v.toFixed(2) + '%') : pct2(v)}</em>` : ''}` : ''}</div>`;
    }
  }
  return `<div class="hm" style="height:${H}px">${html}</div>`;
}

const COLDEF = {
  idx: { l: 'ดัชนี' }, y: { l: 'ยิลด์', n: 1 }, payout: { l: 'Payout', n: 1 }, cagr5: { l: 'โต 5 ปี', n: 1 }, streak: { l: 'เพิ่มต่อเนื่อง', n: 1 },
  exNext: { l: 'XD ถัดไป', n: 1 }, tr1: { l: 'รวม 1 ปี', n: 1 }, dscore: { l: 'Div score', n: 1 },
};
const COLS = [
  { k: 'rank', l: '#' }, { k: 's', l: 'หุ้น' }, { k: 'px', l: 'ราคา', live: 1, n: 1 }, { k: 'd', l: 'วันนี้', live: 1, n: 1 },
  { k: 'spark', l: 'ระหว่างวัน' }, { k: 'h24', l: '24 ชม.', live: 1, n: 1 }, { k: 'ch1w', l: '1W', n: 1 }, { k: 'ch1m', l: '1M', n: 1 },
  { k: 'ytd', l: 'YTD', n: 1 }, { k: 'rsi', l: 'RSI', n: 1 }, { k: 'score', l: 'เทรนด์', n: 1 }, { k: 'signal', l: 'สัญญาณ' },
  { k: 'fromHigh', l: 'จากจุดสูงสุด', n: 1 }, { k: 'w', l: 'น้ำหนัก', n: 1 },
];
const sigCls = s => /ขึ้น/.test(s) ? (/ร้อน/.test(s) ? 'warn' : 'up') : /ลง|ขายมาก/.test(s) ? 'down' : /ซื้อมาก/.test(s) ? 'warn' : 'tmuted';
const colsOf = f => (f.cols || COLS.map(c => c.k)).map(k => ({ k, ...(COLS.find(c => c.k === k) || {}), ...(COLDEF[k] || {}) }));
function sortVal(x, k) {
  const q = SQ[x.s];
  if (k === 'px') return x.px;
  if (k === 'd') return x.d;
  if (k === 'h24') return q?.hl ? q.hl.ch * 100 : -1e9;
  if (k === 'rank') return -(x.cap || 0);
  if (k === 'idx') return x.idx?.join();
  return x[k];
}
function cell(x, k) {
  const q = SQ[x.s];
  switch (k) {
    case 'rank': return x.rank;
    case 's': return `<b>${x.s}</b><small>${esc(x.name)}</small>`;
    case 'px': return pxFmt(x.px) + (x.hours && x.hours !== 'open' && x.hours !== 'closed' ? `<small class="muted">${{ pre: 'ก่อนเปิด', post: 'หลังปิด', overnight: 'กลางคืน' }[x.hours] || ''}</small>` : '');
    case 'd': return `<span class="${chCls(x.d)}">${pct2(x.d)}</span>`;
    case 'spark': return sparkSvg(q?.spark);
    case 'h24': return q?.hl ? `${pxFmt(q.hl.px)} <span class="${chCls(q.hl.ch)}">${pct2(q.hl.ch * 100)}</span>` : '<span class="muted">—</span>';
    case 'rsi': return `<span class="${x.rsi >= 70 ? 'warn' : x.rsi <= 30 ? 'up' : ''}">${x.rsi?.toFixed(0) ?? '—'}</span>`;
    case 'score': return `<span class="${chCls(x.score)}">${x.score > 0 ? '+' : ''}${x.score}</span>`;
    case 'signal': return `<span class="${sigCls(x.signal)}">${esc(x.signal)}</span>`;
    case 'fromHigh': return x.fromHigh == null ? '—' : x.fromHigh.toFixed(1) + '%';
    case 'w': return x.w == null ? '—' : x.w.toFixed(2) + '%';
    case 'idx': return (x.idx || []).map(i => `<span class="badge">${i === 'SPX' ? 'S&P' : 'NDX'}</span>`).join(' ');
    case 'y': return `<b class="warn">${x.y?.toFixed(2) ?? '—'}%</b>${x.special ? ' <small class="muted" title="มีปันผลพิเศษ">+พิเศษ</small>' : ''}`;
    case 'payout': return x.gics === 'Real Estate' ? '<span class="muted" title="REIT ควรดู FFO">REIT</span>' : x.payout == null ? '—' : `<span class="${x.payout > 100 ? 'down' : x.payout > 80 ? 'warn' : ''}">${x.payout.toFixed(0)}%</span>`;
    case 'cagr5': return x.cagr5 == null ? '—' : `<span class="${chCls(x.cagr5)}">${pct2(x.cagr5)}</span>`;
    case 'streak': return `<span class="${x.streak >= 25 ? 'warn' : x.streak >= 10 ? 'up' : ''}">${x.streak} ปี</span>`;
    case 'exNext': return x.exNext ? `${x.exEst ? '<span class="muted" title="ประมาณจากรอบจ่าย">~</span>' : ''}${x.exNext.slice(8)}/${x.exNext.slice(5, 7)}/${x.exNext.slice(2, 4)}` : '—';
    case 'tr1': return x.tr1 == null ? '—' : `<span class="${chCls(x.tr1)}">${pct2(x.tr1)}</span>`;
    case 'dscore': return `<span class="dsc"><i style="width:${x.dscore}%"></i></span> ${x.dscore}`;
    default: return `<span class="${chCls(x[k])}">${pct2(x[k])}</span>`;
  }
}

function tableRows(f, el) {
  const st = el._st || (el._st = { k: 'rank', dir: 1, q: '', sec: '', idx: '' });
  const cols = colsOf(f);
  const items = f.items.map(LS).filter(Boolean).filter(x =>
    (!st.sec || x.sector === st.sec) && (!st.idx || x.idx?.includes(st.idx)) && (!st.q || (x.s + ' ' + x.name).toLowerCase().includes(st.q.toLowerCase())));
  items.sort((a, b) => { const va = sortVal(a, st.k), vb = sortVal(b, st.k); return (va == null) - (vb == null) || (va < vb ? -1 : va > vb ? 1 : 0) * st.dir * (['s', 'signal', 'rank', 'exNext', 'idx'].includes(st.k) ? 1 : -1); });
  el.querySelector('tbody').innerHTML = items.map(x => `<tr data-s="${x.s}">${cols.map(c => `<td data-k="${c.k}" class="${c.n ? 'r' : ''}">${cell(x, c.k)}</td>`).join('')}</tr>`).join('');
  el.querySelector('.cnt').textContent = `${items.length} ตัว`;
  el.querySelectorAll('th').forEach(th => th.classList.toggle('on', th.dataset.k === st.k));
}

Object.assign(FRAMES, {
  heatmap: f => `<div class="rngs">${Object.entries(HEAT_METRICS).filter(([k]) => (f.metrics || ['d', 'ch1w', 'ch1m', 'ytd']).includes(k)).map(([k, m]) => `<button class="rng hmk ${k === (f.metric || 'd') ? 'on' : ''}" data-m="${k}">${m.label}</button>`).join('')}<span class="muted">ขนาด = market cap · สีตามปุ่มที่เลือก · คลิกดูรายตัว</span></div><div class="hmbox">${heatmapBody(f, f.metric || 'd')}</div>`,
  stocktable: f => {
    const secs = [...new Set(f.items.map(s => stockOf(s)?.sector).filter(Boolean))];
    return `<div class="tbar"><input class="tq" placeholder="ค้นหา เช่น NVDA, Apple" aria-label="ค้นหาหุ้น"><select class="tsec" aria-label="กลุ่ม"><option value="">ทุกกลุ่ม</option>${secs.map(s => `<option>${esc(s)}</option>`).join('')}</select>${f.items.some(s => stockOf(s)?.idx) ? '<select class="tidx" aria-label="ดัชนี"><option value="">ทุกดัชนี</option><option value="SPX">S&P 500</option><option value="NDX">Nasdaq-100</option></select>' : ''}<span class="cnt muted"></span><span class="mstate muted right"></span></div>
      <div class="tscroll"><table class="st"><thead><tr>${colsOf(f).map(c => `<th data-k="${c.k}" class="${c.n ? 'r' : ''}">${c.l}</th>`).join('')}</tr></thead><tbody></tbody></table></div>`;
  },
  movers: f => `<div class="mv"><div><div class="muted">ขึ้นแรงสุด</div><div class="mvl up-l"></div></div><div><div class="muted">ลงแรงสุด</div><div class="mvl dn-l"></div></div></div>`,
});

// ---------- กราฟแท่งเทียนของหุ้นทุกตัว (ผู้ใช้ 15 ต.ค. 2026: "ขอทุกหุ้นให้มีกราฟแท่งเทียน") ----------
// /api/candles (Yahoo ผ่านเซิร์ฟเวอร์ของเว็บ) · 5 นาที / 1 ชม. / 1 วัน / 1 สัปดาห์ · EMA20/50 (+EMA200 รายวัน) · volume ·
// ชี้/แตะดูราคาแต่ละแท่ง · แท่งล่าสุดขยับตามราคาสด · โหลดใหม่ทุก 1 นาทีระหว่างเปิดหน้า
const SC_IV = { '5m': ['5 นาที', 156, 300000], '1h': ['1 ชม.', 140, 3600000], '1d': ['1 วัน', 250, 86400000], '1wk': ['1 สัปดาห์', 156, 604800000] };
const scFmtT = (t, iv) => new Date(t).toLocaleString('th-TH', iv === '5m' || iv === '1h' ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: '2-digit' });
const scVol = v => (v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(v || 0));
function stockCandleCard(s) {
  return `<section class="card span2 scard" data-scs="${esc(s)}"><h3><span>${esc(s)} · กราฟแท่งเทียน</span><small>Yahoo · อัปเดตทุก 1 นาที</small></h3><div class="cbody">
    <div class="sh"><div><div class="big" data-sc-px>—</div><div class="muted sc-read" data-sc-read>กำลังโหลด…</div></div>
    <div class="rngs">${Object.entries(SC_IV).map(([k, [l]]) => `<button class="rng sciv ${k === '1d' ? 'on' : ''}" data-iv="${k}">${l}</button>`).join('')}</div></div>
    <div class="scbox"><div class="empty">กำลังโหลดแท่งเทียน…</div></div>
    <div class="legend sc-leg"><span><i style="background:#34d399"></i>EMA20</span><span><i style="background:#fbbf24"></i>EMA50</span><span class="sc-e200"><i style="background:#f472b6"></i>EMA200</span><span><i style="background:rgba(240,185,11,.45)"></i>Volume</span></div></div></section>`;
}
async function loadStockCandles(el) {
  const s = el.dataset.scs, iv = el.querySelector('.sciv.on')?.dataset.iv || '1d', seq = el._seq = (el._seq || 0) + 1;
  try {
    const r = await fetch(`/api/candles?s=${encodeURIComponent(s)}&iv=${iv}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (seq !== el._seq || !el.isConnected) return;
    if (!r.ok || !j.ok || !j.rows?.length) throw new Error(j.error || `HTTP ${r.status}`);
    el._rows = j.rows; el._iv = iv; el._hover = null;
    drawStockCandles(el);
  } catch (e) {
    if (seq !== el._seq || !el.isConnected) return;
    if (!el._rows) el.querySelector('.scbox').innerHTML = `<div class="empty">โหลดแท่งเทียนไม่ได้ (${esc(e.message)}) — กำลังลองใหม่</div>`;
  }
}
function scEma(vals, p) { const k = 2 / (p + 1); let e; return vals.map((v, i) => (e = i ? v * k + e * (1 - k) : v)); }
function drawStockCandles(el) {
  const all = el._rows, iv = el._iv, [, N, ms] = SC_IV[iv]; if (!all?.length) return;
  // the last candle follows the live price (same bucket only — a new bucket waits for the next load)
  const q = SQ[el.dataset.scs], last = all.at(-1);
  if (q && Number.isFinite(q.px) && q.t && Math.floor(q.t / ms) * ms <= last.t + ms - 1 && q.t >= last.t && iv !== '1wk') {
    last.c = q.px; last.h = Math.max(last.h, q.px); last.l = Math.min(last.l, q.px);
  }
  const C = all.map(r => r.c), e20 = scEma(C, 20), e50 = scEma(C, 50), e200 = all.length >= 200 ? scEma(C, 200) : null;
  const off = Math.max(0, all.length - N), rows = all.slice(off), n = rows.length, w = 1000 / n;
  const hi = Math.max(...rows.map(r => r.h)), lo = Math.min(...rows.map(r => r.l)), pad = (hi - lo) * 0.06 || 1;
  const Y = v => 2 + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * 74; // price: 2–76 · volume: 80–100
  const vmax = Math.max(...rows.map(r => r.v || 0), 1);
  let svg = '';
  for (let k = 0; k <= 3; k++) svg += `<line x1="0" x2="1000" y1="${2 + k * 74 / 3}" y2="${2 + k * 74 / 3}" class="grid"/>`;
  rows.forEach((r, i) => {
    const x = i * w + w / 2, up = r.c >= r.o, col = up ? '#34d399' : '#fb7185';
    if (r.v) svg += `<rect x="${i * w + w * .15}" width="${w * .7}" y="${100 - r.v / vmax * 20}" height="${r.v / vmax * 20}" fill="${col}" opacity=".28"/>`;
    svg += `<line x1="${x}" x2="${x}" y1="${Y(r.h)}" y2="${Y(r.l)}" stroke="${col}" vector-effect="non-scaling-stroke"/>`;
    svg += `<rect x="${x - w * .34}" width="${w * .68}" y="${Math.min(Y(r.o), Y(r.c))}" height="${Math.max(Math.abs(Y(r.o) - Y(r.c)), .35)}" fill="${col}"/>`;
  });
  const path = (arr, col, wd) => arr ? `<polyline fill="none" stroke="${col}" stroke-width="${wd}" vector-effect="non-scaling-stroke" points="${arr.slice(off).map((v, i) => `${(i * w + w / 2).toFixed(1)},${Y(v).toFixed(2)}`).join(' ')}"/>` : '';
  svg += path(e20, '#34d399', 1.2) + path(e50, '#fbbf24', 1.3) + (iv === '1d' ? path(e200, '#f472b6', 1.3) : '');
  const lp = rows.at(-1).c;
  svg += `<line x1="0" x2="1000" y1="${Y(lp)}" y2="${Y(lp)}" stroke="#fff" stroke-dasharray="2 4" vector-effect="non-scaling-stroke" opacity=".5"/>`;
  svg += `<line class="sc-cross" x1="0" x2="0" y1="0" y2="100" stroke="rgba(255,255,255,.35)" vector-effect="non-scaling-stroke" style="display:none"/>`;
  const yl = [0, 1, 2, 3].map(k => { const v = (hi + pad) - (hi - lo + 2 * pad) * k / 3; return `<span class="yl left" style="top:${(2 + k * 74 / 3)}%">${pxFmt(v)}</span>`; }).join('');
  const span = rows.at(-1).t - rows[0].t, xl = [0, 1 / 3, 2 / 3, 1].map(f => `<span style="left:${f * 100}%">${scFmtT(rows[0].t + span * f, iv)}</span>`).join('');
  el.querySelector('.scbox').innerHTML = `<div class="lc candle-chart sc-chart" style="--h:300px"><div class="plot"><svg viewBox="0 0 1000 100" preserveAspectRatio="none">${svg}</svg>${yl}<span class="ref now" style="top:${Y(lp)}%">${pxFmt(lp)}</span></div><div class="xl">${xl}</div></div>`;
  el.querySelector('.sc-e200').style.display = iv === '1d' && e200 ? '' : 'none';
  el._view = { rows, w, e20: e20.slice(off), e50: e50.slice(off) };
  scReadout(el, el._hover ?? n - 1);
  const first = rows[0].c, chg = (lp / first - 1) * 100;
  el.querySelector('[data-sc-px]').innerHTML = `${usd(lp)} <span class="chg2 ${chCls(chg)}" style="font-size:14px">${pct2(chg)} ใน ${n} แท่ง</span>`;
}
function scReadout(el, i) {
  const v = el._view; if (!v) return;
  const r = v.rows[Math.max(0, Math.min(v.rows.length - 1, i))];
  el.querySelector('[data-sc-read]').innerHTML = `${scFmtT(r.t, el._iv)} · เปิด <b>${pxFmt(r.o)}</b> สูง <b>${pxFmt(r.h)}</b> ต่ำ <b>${pxFmt(r.l)}</b> ปิด <b class="${r.c >= r.o ? 'up' : 'down'}">${pxFmt(r.c)}</b> · Vol ${scVol(r.v)}`;
}
function startStockCandles(root) {
  root.querySelectorAll('.scard').forEach(el => {
    loadStockCandles(el);
    const tm = setInterval(() => { if (!el.isConnected) return clearInterval(tm); loadStockCandles(el); }, 60000);
    el.addEventListener('click', e => { const b = e.target.closest('.sciv'); if (!b) return; el.querySelectorAll('.sciv').forEach(x => x.classList.toggle('on', x === b)); el._rows = null; el.querySelector('.scbox').innerHTML = '<div class="empty">กำลังโหลด…</div>'; loadStockCandles(el); });
    const move = e => {
      const v = el._view, plot = el.querySelector('.sc-chart .plot'); if (!v || !plot) return;
      const box = plot.getBoundingClientRect(), x = ((e.touches ? e.touches[0].clientX : e.clientX) - box.left) / box.width;
      if (x < 0 || x > 1) return;
      const i = Math.floor(x * v.rows.length); el._hover = i; scReadout(el, i);
      const cr = plot.querySelector('.sc-cross'); if (cr) { const cx = (i + .5) * v.w; cr.setAttribute('x1', cx); cr.setAttribute('x2', cx); cr.style.display = ''; }
    };
    el.addEventListener('mousemove', move); el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('mouseleave', () => { el._hover = null; scReadout(el, (el._view?.rows.length || 1) - 1); const cr = el.querySelector('.sc-cross'); if (cr) cr.style.display = 'none'; });
  });
}

// ---------- หน้ารายละเอียดหุ้น = แดชบอร์ดเต็มของหุ้นตัวนั้น ----------
// (ผู้ใช้ 15 ต.ค. 2026: "อยากให้แต่ละหุ้นทำแดชบอร์ดขึ้นมา มันดูน้อยไป") — ทุกอย่างคำนวณในหน้าจากราคาปิดรายวัน 1 ปี
// (D.closes) + ราคาสด: ราคา + EMA20/50/200 · RSI · MACD · เทียบดัชนี · ผลตอบแทนช่วง/รายเดือน · drawdown ·
// ความเสี่ยง (beta, ผันผวน, วันดี/แย่สุด) · เช็กลิสต์เทคนิค · หุ้นกลุ่มเดียวกัน
function stockSeries(pts) {
  const C = pts.map(p => p.v);
  const ema = (vals, p) => { const k = 2 / (p + 1); let e; return vals.map((v, i) => (e = i ? v * k + e * (1 - k) : v)); };
  const line = (vals, from = 0) => pts.map((p, i) => ({ t: p.t, v: vals[i] })).slice(from).filter(p => p.v != null && isFinite(p.v)).map(p => ({ t: p.t, v: +p.v.toFixed(2) }));
  const e20 = ema(C, 20), e50 = ema(C, 50), e200 = ema(C, 200);
  // RSI 14 (Wilder)
  const rsi = []; let ag = 0, al = 0;
  C.forEach((v, i) => { if (!i) { rsi.push(null); return; } const ch = v - C[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
    if (i <= 14) { ag += up / 14; al += dn / 14; rsi.push(i < 14 ? null : al ? 100 - 100 / (1 + ag / al) : 100); }
    else { ag = (ag * 13 + up) / 14; al = (al * 13 + dn) / 14; rsi.push(al ? 100 - 100 / (1 + ag / al) : 100); } });
  const m12 = ema(C, 12), m26 = ema(C, 26), macd = C.map((_, i) => m12[i] - m26[i]), sig = ema(macd, 9);
  let peak = -Infinity; const dd = C.map(v => { peak = Math.max(peak, v); return (v / peak - 1) * 100; });
  return { C, e20, e50, e200, rsi, macd, sig, dd, line };
}
function openStock(s) {
  const x = stockOf(s); if (!x) return;
  if (window.dash.kind === 'div') return openDiv(x);
  const D = window.dash, closes = D.closes[s] || [];
  const pts = D.dates.map((t, i) => ({ t, v: closes[i] })).filter(p => p.v != null);
  const q = SQ[s], note = D.stockNotes?.[s], L = LS(s) || x;
  const S = stockSeries(pts), last = S.C.at(-1), n = S.C.length;
  const day = t => new Date(t).toISOString().slice(0, 10);
  // the index: the dashboard's own index chart (calc idx.price)
  const idxF = D.zones.flatMap(z => z.frames).find(f => f.calc === 'idx.price');
  const idxName = idxF ? idxF.title.replace(/\s*\(.*\)$/, '') : 'ดัชนี', idxPts = idxF?.lines?.[0]?.points || [];
  const idxBy = new Map(idxPts.map(p => [day(p.t), p.v]));
  const common = pts.filter(p => idxBy.has(day(p.t)));
  const rel = common.length > 20 ? [
    { name: s, color: '#60a5fa', points: common.map(p => ({ t: p.t, v: +(p.v / common[0].v * 100).toFixed(2) })) },
    { name: idxName, color: '#848e9c', points: common.map(p => ({ t: p.t, v: +(idxBy.get(day(p.t)) / idxBy.get(day(common[0].t)) * 100).toFixed(2) })) }] : null;
  // risk: daily returns, beta / correlation vs the index, best / worst day, up days, max drawdown
  const ret = S.C.slice(1).map((v, i) => v / S.C[i] - 1);
  const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  let beta = null, corr = null;
  if (common.length > 40) {
    const a = [], b = [];
    for (let i = 1; i < common.length; i++) { a.push(common[i].v / common[i - 1].v - 1); b.push(idxBy.get(day(common[i].t)) / idxBy.get(day(common[i - 1].t)) - 1); }
    const ma = a.reduce((p, c) => p + c, 0) / a.length, mb = b.reduce((p, c) => p + c, 0) / b.length;
    const cov = a.reduce((p, c, i) => p + (c - ma) * (b[i] - mb), 0) / a.length, vb = sd(b) ** 2;
    beta = vb ? cov / vb : null; corr = sd(a) && sd(b) ? cov / (sd(a) * sd(b)) : null;
  }
  const bestI = ret.indexOf(Math.max(...ret)), worstI = ret.indexOf(Math.min(...ret));
  const maxDD = Math.min(...S.dd), up = ret.filter(r => r > 0).length;
  const thDay = i => new Date(pts[i + 1].t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  // monthly returns (last 12 calendar months, month-end closes)
  const mEnd = new Map(); pts.forEach(p => mEnd.set(new Date(p.t).toISOString().slice(0, 7), p.v));
  const months = [...mEnd.entries()], mrows = months.slice(1).map(([k, v], i) => ({ k, r: (v / months[i][1] - 1) * 100 })).slice(-12);
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  // returns vs the index over the same windows
  const idxRet = (days) => { if (idxPts.length < 2) return null; const t1 = idxPts.at(-1).t, p0 = idxPts.filter(p => p.t <= t1 - days * DAY).at(-1); return p0 ? (idxPts.at(-1).v / p0.v - 1) * 100 : null; };
  const idxYtd = (() => { if (idxPts.length < 2) return null; const y = new Date(idxPts.at(-1).t).getUTCFullYear(), p0 = idxPts.filter(p => new Date(p.t).getUTCFullYear() < y).at(-1); return p0 ? (idxPts.at(-1).v / p0.v - 1) * 100 : null; })();
  const winRows = [['1 สัปดาห์', x.ch1w, idxRet(7)], ['1 เดือน', x.ch1m, idxRet(30)], ['3 เดือน', x.ch3m, idxRet(91)], ['ตั้งแต่ต้นปี', x.ytd, idxYtd], ['1 ปี', x.ch1y, idxRet(365)]];
  // technical checklist, plain Thai
  const rsiNow = S.rsi.at(-1), macdNow = S.macd.at(-1), sigNow = S.sig.at(-1);
  const chk = [
    [last > S.e20.at(-1), `ราคาปิด${last > S.e20.at(-1) ? 'อยู่เหนือ' : 'ต่ำกว่า'} EMA20 (${usd(S.e20.at(-1))}) — ${last > S.e20.at(-1) ? 'ระยะสั้นยังแข็ง' : 'ระยะสั้นอ่อนแรง'}`],
    [last > S.e50.at(-1), `ราคาปิด${last > S.e50.at(-1) ? 'อยู่เหนือ' : 'ต่ำกว่า'} EMA50 (${usd(S.e50.at(-1))}) — แนวโน้มระยะกลาง${last > S.e50.at(-1) ? 'ขึ้น' : 'ลง'}`],
    [n >= 200 ? last > S.e200.at(-1) : null, n >= 200 ? `ราคาปิด${last > S.e200.at(-1) ? 'อยู่เหนือ' : 'ต่ำกว่า'} EMA200 (${usd(S.e200.at(-1))}) — แนวโน้มใหญ่${last > S.e200.at(-1) ? 'ขาขึ้น' : 'ขาลง'}` : 'ข้อมูลยังไม่ถึง 200 วัน'],
    [S.e50.at(-1) > S.e200.at(-1), `EMA50 ${S.e50.at(-1) > S.e200.at(-1) ? 'อยู่เหนือ' : 'อยู่ใต้'} EMA200 (${S.e50.at(-1) > S.e200.at(-1) ? 'golden cross — โครงสร้างขาขึ้น' : 'death cross — โครงสร้างขาลง'})`],
    [rsiNow == null ? null : rsiNow >= 70 ? false : rsiNow <= 30 ? null : rsiNow >= 50, `RSI 14 = ${rsiNow?.toFixed(0)} — ${rsiNow >= 70 ? 'ซื้อมากเกิน ระวังย่อ' : rsiNow <= 30 ? 'ขายมากเกิน รอสัญญาณกลับตัว' : rsiNow >= 50 ? 'แรงซื้อนำ' : 'แรงขายนำ'}`],
    [macdNow > sigNow, `MACD ${macdNow > sigNow ? 'อยู่เหนือ' : 'อยู่ใต้'}เส้นสัญญาณ — โมเมนตัม${macdNow > sigNow ? 'ขึ้น' : 'ลง'}`],
    [x.fromHigh > -10, `ห่างจุดสูงสุด 52 สัปดาห์ ${x.fromHigh?.toFixed(1)}% · อยู่ที่ ${Math.round(x.pos52 ?? 0)}% ของกรอบปี`],
  ];
  const passed = chk.filter(c => c[0] === true).length, counted = chk.filter(c => c[0] != null).length;
  // peers: the same sector in this dashboard
  const peers = D.stocks.filter(p => p.sector === x.sector && p.s !== s).sort((a, b) => (b.cap || 0) - (a.cap || 0)).slice(0, 10);
  const rankBy = k => { const arr = D.stocks.filter(p => p[k] != null).sort((a, b) => b[k] - a[k]); return `${arr.findIndex(p => p.s === s) + 1}/${arr.length}`; };
  const cur = v => (v == null ? '—' : `<span class="${chCls(v)}">${pct2(v)}</span>`);

  const rsiF = renderFrame({ type: 'series', title: 'RSI 14', source: 'คำนวณจากราคาปิด', headline: rsiNow?.toFixed(0), sub: rsiNow >= 70 ? 'ซื้อมากเกิน' : rsiNow <= 30 ? 'ขายมากเกิน' : 'ปกติ', fmt: 'num', decimals: 0,
    lines: [{ name: 'RSI', color: '#f0b90b', points: S.line(S.rsi, 14) }], refs: [{ v: 70, label: '70' }, { v: 30, label: '30' }],
    ranges: [{ label: '3M', days: 92 }, { label: '6M', days: 183 }, { label: '1Y', days: 366 }], defaultRange: '6M', area: false, height: 140 });
  const macdF = renderFrame({ type: 'series', title: 'MACD 12/26/9', source: 'คำนวณจากราคาปิด', headline: macdNow?.toFixed(2), sub: macdNow > sigNow ? 'เหนือเส้นสัญญาณ (โมเมนตัมขึ้น)' : 'ใต้เส้นสัญญาณ (โมเมนตัมลง)', fmt: 'num', decimals: 2,
    lines: [{ name: 'MACD', color: '#60a5fa', points: S.line(S.macd, 26) }, { name: 'Signal', color: '#fbbf24', points: S.line(S.sig, 34), width: 1.1 }], refs: [{ v: 0, label: '0' }],
    ranges: [{ label: '3M', days: 92 }, { label: '6M', days: 183 }, { label: '1Y', days: 366 }], defaultRange: '6M', area: false, height: 140 });
  const relF = rel ? renderFrame({ type: 'series', title: `เทียบกับ ${idxName}`, source: 'เริ่มที่ 100 · 1 ปี', headline: `${(rel[0].points.at(-1).v - rel[1].points.at(-1).v >= 0 ? '+' : '')}${(rel[0].points.at(-1).v - rel[1].points.at(-1).v).toFixed(1)} จุด`,
    sub: rel[0].points.at(-1).v >= rel[1].points.at(-1).v ? `ชนะ${idxName}ใน 1 ปี` : `แพ้${idxName}ใน 1 ปี`, tone: rel[0].points.at(-1).v >= rel[1].points.at(-1).v ? 'up' : 'down', fmt: 'num', decimals: 0,
    lines: rel, area: false, height: 140 }) : '';
  const winF = renderFrame({ type: 'bars', title: `ผลตอบแทน ${s} (เทียบ ${idxName})`, source: 'แท่ง = หุ้น · ตัวเลขในวงเล็บ = ดัชนี',
    rows: winRows.filter(r => r[1] != null).map(([l, v, iv]) => ({ label: l, value: v, display: `${pct2(v)}${iv != null ? ` (${pct2(iv)})` : ''}` })) });
  const monF = renderFrame({ type: 'bars', title: 'ผลตอบแทนรายเดือน', source: '12 เดือนล่าสุด · เดือนนี้ยังไม่จบ',
    rows: mrows.map(m => ({ label: `${TH_M[+m.k.slice(5) - 1]} ${m.k.slice(2, 4)}`, value: m.r, display: pct2(m.r) })) });
  const ddF = renderFrame({ type: 'series', title: 'ย่อตัวจากจุดสูงสุด (drawdown)', source: '1 ปี', headline: `${S.dd.at(-1).toFixed(1)}%`, sub: `ลึกสุดในปี ${maxDD.toFixed(1)}%`, tone: 'down', fmt: 'pct', decimals: 1,
    lines: [{ name: 'Drawdown', color: '#fb7185', points: S.line(S.dd) }], area: true, height: 140 });
  const riskTiles = [['ผันผวน (ต่อปี)', `${(sd(ret) * Math.sqrt(252) * 100).toFixed(0)}%`], ['Beta เทียบดัชนี', beta == null ? '—' : beta.toFixed(2)], ['สหสัมพันธ์', corr == null ? '—' : corr.toFixed(2)],
    ['วันที่ดีที่สุด', `${pct2(ret[bestI] * 100)} (${thDay(bestI)})`], ['วันที่แย่ที่สุด', `${pct2(ret[worstI] * 100)} (${thDay(worstI)})`], ['วันที่ปิดบวก', `${Math.round(up / ret.length * 100)}%`],
    ['ย่อลึกสุดในปี', `${maxDD.toFixed(1)}%`], ['อันดับ 1 เดือน', rankBy('ch1m')], ['อันดับ YTD', rankBy('ytd')], ['น้ำหนักในดัชนี', x.w ? x.w.toFixed(2) + '%' : '—']];
  const tiles = [['1 สัปดาห์', pct2(x.ch1w)], ['1 เดือน', pct2(x.ch1m)], ['3 เดือน', pct2(x.ch3m)], ['YTD', pct2(x.ytd)], ['1 ปี', pct2(x.ch1y)],
    ['RSI 14', x.rsi?.toFixed(0)], ['เทรนด์', `${x.score > 0 ? '+' : ''}${x.score}/5`], ['ผันผวน 30 วัน', x.vol30 ? x.vol30.toFixed(0) + '%/ปี' : '—'],
    ['จากจุดสูงสุด 52W', x.fromHigh?.toFixed(1) + '%'], ['น้ำหนักโดยประมาณ', x.w?.toFixed(2) + '%']];
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="mbox mfull" role="dialog" aria-label="${esc(x.name)}"><button class="mx" aria-label="ปิด">✕</button>
    <div class="mh"><div><div class="big">${s} <span class="muted" style="font-size:14px">${esc(x.name)}</span></div>
    <div class="muted">${esc(x.sector)} · <span class="${sigCls(x.signal)}">${esc(x.signal)}</span> · เช็กลิสต์เทคนิคผ่าน ${passed}/${counted}${x.hl ? ' · มีราคา 24 ชม. บน Hyperliquid' : ''}</div></div>
    <div class="mlive" data-s="${s}"></div></div>
    <div class="grid">${stockCandleCard(s)}<section class="card"><h3><span>สรุปรายตัว</span><small>Model${note ? ' + Claude' : ''}</small></h3>
      <div class="rows"><div class="row">${esc(x.reading)}</div>${note ? `<div class="row"><b>Claude:</b>${esc(note)}</div>` : ''}</div>
      <div class="muted" style="margin:10px 0 4px">กรอบ 52 สัปดาห์ ${usd(x.lo52)} – ${usd(x.hi52)}</div><div class="rbar"><span style="width:${Math.max(0, Math.min(100, x.pos52 ?? 0))}%"></span></div>
      <div class="tiles t5">${tiles.map(([l, v]) => `<div class="tile"><span>${l}</span><b>${v ?? '—'}</b></div>`).join('')}</div>
      <div class="muted" style="margin-top:10px">ระหว่างวัน (5 นาที)</div><div class="msp">${sparkSvg(q?.spark, 420, 60)}</div></section></div>
    <div class="grid">${rsiF}${macdF}${relF || ddF}</div>
    <div class="grid">${winF}${monF}${relF ? ddF : ''}</div>
    <div class="grid g2"><section class="card"><h3><span>เช็กลิสต์เทคนิค · ผ่าน ${passed}/${counted}</span><small>คำนวณจากราคาปิด</small></h3>
      <div class="rows">${chk.map(([ok, t]) => `<div class="row chk"><b class="${ok === true ? 'up' : ok === false ? 'down' : 'muted'}">${ok === true ? '✓' : ok === false ? '✗' : '•'}</b> ${esc(t)}</div>`).join('')}</div></section>
      <section class="card"><h3><span>ความเสี่ยงและสถิติ</span><small>1 ปี · รายวัน</small></h3>
      <div class="tiles t5">${riskTiles.map(([l, v]) => `<div class="tile"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
      <div class="muted" style="margin-top:8px;font-size:12px">Beta 1.2 = ขยับแรงกว่าดัชนีราว 20% · สหสัมพันธ์ใกล้ 1 = ขึ้นลงตามดัชนี</div></section></div>
    ${peers.length ? `<section class="card"><h3><span>หุ้นกลุ่มเดียวกัน · ${esc(x.sector)}</span><small>กดเพื่อเปิดดู</small></h3><div class="tscroll"><table class="st peers"><thead><tr><th>หุ้น</th><th class="r">ราคา</th><th class="r">วันนี้</th><th class="r">1 เดือน</th><th class="r">YTD</th><th class="r">RSI</th><th>สัญญาณ</th></tr></thead><tbody>
      ${[x, ...peers].map(p => { const lp = LS(p.s) || p; return `<tr data-peer="${p.s}"${p.s === s ? ' class="me"' : ''}><td><b>${p.s}</b> <small class="muted">${esc(p.name)}</small></td><td class="r">${usd(lp.px ?? p.px)}</td><td class="r">${cur(lp.d ?? p.ch1d)}</td><td class="r">${cur(p.ch1m)}</td><td class="r">${cur(p.ytd)}</td><td class="r">${p.rsi?.toFixed(0) ?? '—'}</td><td class="${sigCls(p.signal)}">${esc(p.signal || '')}</td></tr>`; }).join('')}
      </tbody></table></div></section>` : ''}</div>`;
  document.body.appendChild(m);
  startStockCandles(m);
  const close = () => m.remove();
  m.addEventListener('click', ev => {
    const pr = ev.target.closest('tr[data-peer]');
    if (pr && pr.dataset.peer !== s) { ev.stopPropagation(); close(); openStock(pr.dataset.peer); return; }
    if (ev.target === m || ev.target.closest('.mx')) close();
  });
  document.addEventListener('keydown', function esc_(ev) { if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc_); } });
  STOCKS.paintModal();
}

// ---------- ตัวควบคุมราคาสดหุ้น ----------
const STOCKS = {
  timer: null,
  syms() { return window.dash?.stockSyms || []; },
  start() {
    clearInterval(this.timer);
    document.querySelectorAll('.card[data-type="stocktable"]').forEach(el => tableRows(FRAME_DATA[el.dataset.i], el));
    if (!this.syms().length) return;
    // ราคามาจาก stream (live.js) — ไม่ต้อง poll
  },
  paint() {
    // ตาราง: อัปเดตเฉพาะช่องสด ไม่จัดเรียงใหม่ (กดหัวคอลัมน์เพื่อเรียงตามค่าล่าสุด)
    // ตาราง: ทุกคอลัมน์ที่ขึ้นกับราคาคำนวณใหม่ + กระพริบเมื่อราคาเปลี่ยน
    const STATIC = new Set(['rank', 's', 'idx', 'w', 'streak', 'exNext', 'payout', 'cagr5', 'tr1']);
    document.querySelectorAll('table.st tbody tr').forEach(tr => {
      const x = LS(tr.dataset.s); if (!x) return;
      tr.querySelectorAll('td[data-k]').forEach(td => {
        const k = td.dataset.k; if (STATIC.has(k)) return;
        const h = cell(x, k);
        if (td._h !== h) {
          if (k === 'px' && td._px != null && x.px !== td._px) { td.classList.remove('fu', 'fd'); void td.offsetWidth; td.classList.add(x.px > td._px ? 'fu' : 'fd'); }
          td.innerHTML = h; td._h = h; td._px = x.px;
        }
      });
    });
    const syms = this.syms(), any = SQ[syms[0]], tLast = Math.max(0, ...syms.map(s => SQ[s]?.t || 0));
    document.querySelectorAll('.mstate').forEach(el => el.textContent = any ? `${hoursTH(any.hours)} · tick ล่าสุด ${new Date(tLast).toLocaleTimeString('th-TH')} · สดทุก tick` : '');
    document.querySelectorAll('.card[data-type="heatmap"]').forEach(el => {
      const mk = el.querySelector('.hmk.on')?.dataset.m || 'd', M = HEAT_METRICS[mk];
      el.querySelectorAll('.hm-t').forEach(t => {
        const v = heatVal(t.dataset.s, mk); if (v == null) return;
        const bg = heat(v, M.scale, M.seq); if (t._bg !== bg) { t.style.background = bg; t._bg = bg; }
        const em = t.querySelector('em'); if (em) em.textContent = M.seq ? v.toFixed(2) + '%' : pct2(v);
      });
    });
    document.querySelectorAll('.card[data-type="movers"]').forEach(el => {
      const f = FRAME_DATA[el.dataset.i], n = f.count || 6;
      const list = this.syms().map(LS).filter(x => x && x.d != null).map(x => ({ s: x.s, v: x.d, px: x.px })).sort((a, b) => b.v - a.v);
      const row = r => `<div class="q" data-open="${r.s}"><i style="background:${r.v >= 0 ? '#34d399' : '#fb7185'}"></i><span><b>${r.s}</b> <small class="muted">${esc(stockOf(r.s)?.name || '')}</small></span><b>${pxFmt(r.px)}</b><em class="${chCls(r.v)}">${pct2(r.v)}</em></div>`;
      el.querySelector('.up-l').innerHTML = list.slice(0, n).map(row).join('');
      el.querySelector('.dn-l').innerHTML = list.slice(-n).reverse().map(row).join('');
    });
    this.paintModal();
  },
  paintModal() {
    const el = document.querySelector('.mlive'); if (!el) return;
    const q = SQ[el.dataset.s], x = LS(el.dataset.s); if (!q || !x) return;
    // % เทียบราคาปิดล่าสุดที่ปิดแล้ว (ตรงกับตาราง)
    el.innerHTML = `<div class="big">${usd(x.px)} <span class="chg2 ${chCls(x.d)}">${pct2(x.d)}</span></div>
      <div class="muted">${hoursTH(q.hours)} · tick ${new Date(q.t).toLocaleTimeString('th-TH')}${q.hl ? ` · 24 ชม. ${usd(q.hl.px)}` : ''} · ช่วงวันล่าสุด ${usd(q.lo)}–${usd(q.hi)}</div>`;
    const sp = document.querySelector('.msp'); if (sp && q.spark) sp.innerHTML = sparkSvg(q.spark, 420, 60);
  },
};

// คลิก: ปุ่ม heatmap, หัวตาราง, แถว/ไทล์ → หน้ารายละเอียด
document.addEventListener('click', e => {
  const hk = e.target.closest('.hmk');
  if (hk) {
    const card = hk.closest('.card'), f = FRAME_DATA[card.dataset.i];
    card.querySelectorAll('.hmk').forEach(b => b.classList.toggle('on', b === hk));
    card.querySelector('.hmbox').innerHTML = heatmapBody(f, hk.dataset.m);
    return;
  }
  const th = e.target.closest('table.st th');
  if (th && th.closest('.card')?._st) {
    const card = th.closest('.card'), st = card._st;
    if (st.k === th.dataset.k) st.dir *= -1; else { st.k = th.dataset.k; st.dir = 1; }
    tableRows(FRAME_DATA[card.dataset.i], card); return;
  }
  const t = e.target.closest('.hm-t, table.st tbody tr, [data-open]');
  if (t) openStock(t.dataset.s || t.dataset.open);
});
document.addEventListener('input', e => {
  const card = e.target.closest('.card[data-type="stocktable"]'); if (!card) return;
  if (e.target.classList.contains('tq')) card._st.q = e.target.value;
  if (e.target.classList.contains('tsec')) card._st.sec = e.target.value;
  if (e.target.classList.contains('tidx')) card._st.idx = e.target.value;
  tableRows(FRAME_DATA[card.dataset.i], card);
});


// หน้ารายละเอียดหุ้นปันผล: ราคา 10 ปี + ปันผลรายปี + ตัวเลขปันผล
function openDiv(x) {
  const s = x.s, q = SQ[s], note = window.dash.stockNotes?.[s];
  const pts = (window.dash.monthly[s] || []).map(([t, v]) => ({ t, v }));
  const chart = renderFrame({ type: 'series', title: `${s} · ราคา 10 ปี (รายเดือน)`, source: 'Yahoo Finance', fmt: 'usd', headline: usd(q?.px ?? x.px),
    change: { text: `ผลตอบแทนรวม 1 ปี ${pct2(x.tr1)}`, tone: (x.tr1 || 0) >= 0 ? 'up' : 'down' },
    lines: [{ name: s, color: '#60a5fa', points: pts }],
    ranges: [{ label: '1Y', days: 366 }, { label: '3Y', days: 1096 }, { label: '5Y', days: 1827 }, { label: '10Y', days: 3653 }], defaultRange: '5Y' });
  const yr = Object.entries(x.yearly || {}).slice(-10);
  const bars = renderFrame({ type: 'bars', title: 'ปันผลรวมรายปี (ต่อหุ้น)', source: 'ไม่รวมปันผลพิเศษ', rows: yr.map(([k, v]) => ({ label: k, value: v, display: '$' + v.toFixed(2), color: '#fbbf24' })) });
  const tiles = [['ยิลด์ (ประกาศ)', x.y?.toFixed(2) + '%'], ['ยิลด์ 12 เดือนจริง', x.yield?.toFixed(2) + '%'], ['เฉลี่ย 5 ปี', x.avg5 ? x.avg5.toFixed(2) + '%' : '—'],
    ['ปันผล/ปี', x.fwd ? usd(x.fwd) : usd(x.ttm)], ['ความถี่', x.freq + ' ครั้ง/ปี'], ['โต 5 ปี', pct2(x.cagr5)], ['เพิ่มต่อเนื่อง', x.streak + ' ปี'],
    ['Payout', x.gics === 'Real Estate' ? 'REIT' : x.payout == null ? '—' : x.payout.toFixed(0) + '%'], ['P/E', x.pe?.toFixed(1) ?? '—'], ['Div score', x.dscore + '/100'],
    ['XD ถัดไป', (x.exEst ? '~' : '') + (x.exNext || '—')], ['วันจ่าย', x.payDate || '—'], ['รวม 3 ปี/ปี', pct2(x.tr3)], ['รวม 5 ปี/ปี', pct2(x.tr5)], ['จากจุดสูงสุด 52W', pct2(x.fromHigh)]];
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="mbox" role="dialog" aria-label="${esc(x.name)}"><button class="mx" aria-label="ปิด">✕</button>
    <div class="mh"><div><div class="big">${s} <span class="muted" style="font-size:14px">${esc(x.name)}</span></div>
    <div class="muted">${esc(x.sector)} · ${(x.idx || []).map(i => i === 'SPX' ? 'S&P 500' : 'Nasdaq-100').join(' + ')}</div></div><div class="mlive" data-s="${s}"></div></div>
    <div class="grid">${stockCandleCard(s)}</div>
    <div class="grid g2">${chart}<section class="card"><h3><span>สรุปปันผล</span><small>Model${note ? ' + Claude' : ''}</small></h3>
      <div class="rows"><div class="row">${esc(x.reading)}</div>${note ? `<div class="row"><b>Claude:</b>${esc(note)}</div>` : ''}
      ${x.flags?.length ? `<div class="chips">${x.flags.map(f => `<span class="chip ${/เกิน|ลดลง/.test(f) ? 'down' : /Aristocrat|ต่อเนื่อง|สูงกว่า/.test(f) ? 'up' : ''}">${esc(f)}</span>`).join('')}</div>` : ''}</div>
      <div class="tiles t5">${tiles.map(([l, v]) => `<div class="tile"><span>${l}</span><b>${v ?? '—'}</b></div>`).join('')}</div></section>
      ${bars}<section class="card"><h3><span>ระหว่างวัน (5 นาที)</span><small>Yahoo · สด</small></h3><div class="msp">${sparkSvg(q?.spark, 420, 60)}</div></section></div></div>`;
  document.body.appendChild(m);
  startStockCandles(m);
  m.addEventListener('click', ev => { if (ev.target === m || ev.target.closest('.mx')) m.remove(); });
  document.addEventListener('keydown', function k(ev) { if (ev.key === 'Escape') { m.remove(); document.removeEventListener('keydown', k); } });
  STOCKS.paintModal();
}
