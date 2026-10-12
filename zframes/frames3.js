// frame ชุดที่ 3: หุ้นหลายตัว — heatmap, ตารางหุ้นทุกตัว, ขึ้น/ลงแรง, หน้ารายละเอียด (ราคาสดจาก /api/stocks/quotes)
const SQ = {};  // ราคาสดล่าสุดของหุ้น
const pct2 = v => v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(Math.abs(v) >= 10 ? 1 : 2) + '%';  // v เป็น % อยู่แล้ว
const heat = (v, scale, seq) => {
  if (v == null) return 'rgb(38,44,56)';
  if (seq) { const a = Math.max(0, Math.min(1, v / scale)); return `rgb(${Math.round(38 + 213 * a)},${Math.round(44 + 147 * a)},${Math.round(56 - 20 * a)})`; }
  const k = Math.max(-1, Math.min(1, v / scale)), a = Math.abs(k);
  const [r, g, b] = k >= 0 ? [22, 163, 74] : [220, 38, 38];
  return `rgb(${Math.round(38 + (r - 38) * a)},${Math.round(44 + (g - 44) * a)},${Math.round(56 + (b - 56) * a)})`;
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

// ---------- หน้ารายละเอียดหุ้น ----------
function openStock(s) {
  const x = stockOf(s); if (!x) return;
  if (window.dash.kind === 'div') return openDiv(x);
  const D = window.dash, closes = D.closes[s] || [];
  const pts = D.dates.map((t, i) => ({ t, v: closes[i] })).filter(p => p.v != null);
  const e50 = []; let e; const k = 2 / 51;
  pts.forEach((p, i) => { e = i ? p.v * k + e * (1 - k) : p.v; if (i >= 49) e50.push({ t: p.t, v: +e.toFixed(2) }); });
  const q = SQ[s], note = D.stockNotes?.[s];
  const chart = renderFrame({ type: 'series', title: `${s} · ราคา 1 ปี`, source: 'Yahoo Finance', fmt: 'usd', headline: usd(q?.px ?? x.px),
    change: { text: `วันนี้ ${pct2(q ? q.ch * 100 : x.ch1d)}`, tone: (q ? q.ch : x.ch1d) >= 0 ? 'up' : 'down' },
    lines: [{ name: s, color: '#60a5fa', points: pts }, { name: 'EMA50', color: '#fbbf24', points: e50, width: 1.2 }],
    ranges: [{ label: '1M', days: 31 }, { label: '3M', days: 92 }, { label: '6M', days: 183 }, { label: '1Y', days: 366 }], defaultRange: '6M', area: false });
  const tiles = [['1 สัปดาห์', pct2(x.ch1w)], ['1 เดือน', pct2(x.ch1m)], ['3 เดือน', pct2(x.ch3m)], ['YTD', pct2(x.ytd)], ['1 ปี', pct2(x.ch1y)],
    ['RSI 14', x.rsi?.toFixed(0)], ['เทรนด์', `${x.score > 0 ? '+' : ''}${x.score}/5`], ['ผันผวน 30 วัน', x.vol30 ? x.vol30.toFixed(0) + '%/ปี' : '—'],
    ['จากจุดสูงสุด 52W', x.fromHigh?.toFixed(1) + '%'], ['น้ำหนักโดยประมาณ', x.w?.toFixed(2) + '%']];
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="mbox" role="dialog" aria-label="${esc(x.name)}"><button class="mx" aria-label="ปิด">✕</button>
    <div class="mh"><div><div class="big">${s} <span class="muted" style="font-size:14px">${esc(x.name)}</span></div>
    <div class="muted">${esc(x.sector)} · <span class="${sigCls(x.signal)}">${esc(x.signal)}</span>${x.hl ? ' · มีราคา 24 ชม. บน Hyperliquid' : ''}</div></div>
    <div class="mlive" data-s="${s}"></div></div>
    <div class="grid g2">${chart}<section class="card"><h3><span>สรุปรายตัว</span><small>Model${note ? ' + Claude' : ''}</small></h3>
      <div class="rows"><div class="row">${esc(x.reading)}</div>${note ? `<div class="row"><b>Claude:</b>${esc(note)}</div>` : ''}</div>
      <div class="muted" style="margin:10px 0 4px">กรอบ 52 สัปดาห์ ${usd(x.lo52)} – ${usd(x.hi52)}</div><div class="rbar"><span style="width:${Math.max(0, Math.min(100, x.pos52 ?? 0))}%"></span></div>
      <div class="tiles t5">${tiles.map(([l, v]) => `<div class="tile"><span>${l}</span><b>${v ?? '—'}</b></div>`).join('')}</div>
      <div class="muted" style="margin-top:10px">ระหว่างวัน (5 นาที)</div><div class="msp">${sparkSvg(q?.spark, 420, 60)}</div></section></div></div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.addEventListener('click', ev => { if (ev.target === m || ev.target.closest('.mx')) close(); });
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
  if (th) {
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
    <div class="grid g2">${chart}<section class="card"><h3><span>สรุปปันผล</span><small>Model${note ? ' + Claude' : ''}</small></h3>
      <div class="rows"><div class="row">${esc(x.reading)}</div>${note ? `<div class="row"><b>Claude:</b>${esc(note)}</div>` : ''}
      ${x.flags?.length ? `<div class="chips">${x.flags.map(f => `<span class="chip ${/เกิน|ลดลง/.test(f) ? 'down' : /Aristocrat|ต่อเนื่อง|สูงกว่า/.test(f) ? 'up' : ''}">${esc(f)}</span>`).join('')}</div>` : ''}</div>
      <div class="tiles t5">${tiles.map(([l, v]) => `<div class="tile"><span>${l}</span><b>${v ?? '—'}</b></div>`).join('')}</div></section>
      ${bars}<section class="card"><h3><span>ระหว่างวัน (5 นาที)</span><small>Yahoo · สด</small></h3><div class="msp">${sparkSvg(q?.spark, 420, 60)}</div></section></div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click', ev => { if (ev.target === m || ev.target.closest('.mx')) m.remove(); });
  document.addEventListener('keydown', function k(ev) { if (ev.key === 'Escape') { m.remove(); document.removeEventListener('keydown', k); } });
  STOCKS.paintModal();
}
