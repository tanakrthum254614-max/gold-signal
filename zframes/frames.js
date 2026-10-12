// ตัววาด frame แต่ละชนิด — ต้องตรงกับ catalogue.json
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (v, d = 2) => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (v, d = 1) => v == null ? '—' : (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%';
const tcls = t => ({ up: 'up', down: 'down', warn: 'warn', muted: 'tmuted' }[t] || '');
const none = '<div class="empty">ยังไม่มีข้อมูล</div>';

const FRAMES = {
  kpis: f => `<div class="kpis">${f.items.map(i => `<div class="kpi"><div class="l">${esc(i.label)}</div><div class="v ${tcls(i.tone)}">${esc(i.value)}</div>${i.sub ? `<div class="s">${esc(i.sub)}</div>` : ''}</div>`).join('')}</div>`,

  snapshot: f => `<div class="rows">${f.lines.filter(l => l.text).map(l => `<div class="row"><b>${esc(l.label)}</b>${esc(l.text)}</div>`).join('') || none}</div>`,

  scorecard: f => !f.rows.length ? none :
    f.rows.map(r => `<div class="score"><span>${esc(r.label)}</span><span class="dots">${'●'.repeat(r.score)}<i>${'●'.repeat(5 - r.score)}</i> ${r.score}</span>${r.note ? `<span class="n">${esc(r.note)}</span>` : ''}</div>`).join('') +
    `<div style="margin-top:8px">รวม <b>${(f.rows.reduce((a, r) => a + r.score, 0) / f.rows.length).toFixed(1)}/5</b> <span class="badge">ความมั่นใจ: ${esc(f.confidence || '—')}</span></div>`,

  thesis: f => (f.items.length ? `<ol>${f.items.map(i => `<li><b>${esc(i.title)}:</b> ${esc(i.text)}</li>`).join('')}</ol>` : none) +
    (f.changeIf?.length ? `<div class="chg"><b>เปลี่ยนใจเมื่อ:</b> ${f.changeIf.map(esc).join(' · ')}</div>` : ''),

  trend: f => f.rows.map(r => {
    const w = Math.abs(r.score) / r.max * 50, col = r.score > 0 ? 'var(--up)' : r.score < 0 ? 'var(--down)' : 'var(--muted)';
    const pos = r.score >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
    return `<div class="tr"><b>${esc(r.tf)}</b><div class="bar"><span style="${pos};background:${col}"></span></div><span style="text-align:right;color:${col}">${r.score > 0 ? '+' : ''}${r.score}/${r.max}</span>
      <span class="n">RSI ${r.rsi ?? '—'}${r.note ? ' · ' + esc(r.note) : ''}</span></div>`;
  }).join(''),

  levels: f => [...f.resistance].reverse().map(l => `<div class="lv"><span class="down">R · ${usd(l.price)}</span><small>${esc(l.label || '')} · ${pc(l.price / f.current - 1, 2)}</small></div>`).join('') +
    `<div class="lv now"><span>ราคาตอนนี้ ${usd(f.current)}</span><small></small></div>` +
    f.support.map(l => `<div class="lv"><span class="up">S · ${usd(l.price)}</span><small>${esc(l.label || '')} · ${pc(l.price / f.current - 1, 2)}</small></div>`).join(''),

  scenarios: f => `<div class="sc">${f.cases.map(c => {
    const t = /bear/i.test(c.name) ? 'down' : /bull/i.test(c.name) ? 'up' : 'tmuted';
    return `<div class="case"><div class="nm ${t}">${esc(c.name)}${c.prob != null ? ` · ${Math.round(c.prob * 100)}%` : ''}</div>
      <div class="px">${usd(c.price, 0)}</div><div class="${t}" style="font-size:12px">${pc(c.ret, 1)}${f.horizon ? ' / ' + esc(f.horizon) : ''}</div>
      ${c.drivers?.length ? `<ul>${c.drivers.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</div>`;
  }).join('')}</div>`,

  action: f => f.rows.length ? f.rows.map(r => `<div class="act"><span class="w">ถ้า ${esc(r.when)}</span><span class="${tcls(r.tone)}">→ ${esc(r.do)}</span></div>`).join('') : none,

  chart: f => {
    const P = f.points; if (!P.length) return none;
    const W = 600, H = 190, pad = 6;
    const ys = P.map(p => p.c).concat((f.marks || []).map(m => m.price));
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const x = i => pad + i / (P.length - 1) * (W - pad * 2 - 60), y = v => H - pad - (v - lo) / (hi - lo || 1) * (H - pad * 2);
    const d = P.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join('');
    const last = P[P.length - 1];
    // ป้ายราคาด้านขวา: กันไม่ให้ทับกัน (ห่างกันอย่างน้อย 13px)
    const labels = [{ v: last.c, text: String(Math.round(last.c)), fill: '#fff' },
      ...(f.marks || []).map(m => ({ v: m.price, text: `${m.label} ${Math.round(m.price)}`, fill: 'var(--dim)' }))]
      .map(l => ({ ...l, ly: y(l.v) + 4 })).sort((a, b) => a.ly - b.ly);
    labels.forEach((l, i) => { if (i && l.ly - labels[i - 1].ly < 13) l.ly = labels[i - 1].ly + 13; });
    const marks = (f.marks || []).map(m => `<line x1="${pad}" x2="${W - 60}" y1="${y(m.price)}" y2="${y(m.price)}" stroke="var(--${m.tone === 'up' ? 'up' : m.tone === 'down' ? 'down' : 'muted'})" stroke-dasharray="4 4" opacity=".7"/>`).join('') +
      labels.map(l => `<text x="${W - 56}" y="${l.ly}" fill="${l.fill}" font-size="11">${esc(l.text)}</text>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(f.title)}">
      <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e8b64c" stop-opacity=".35"/><stop offset="1" stop-color="#e8b64c" stop-opacity="0"/></linearGradient></defs>
      <path d="${d}L${x(P.length - 1)},${H}L${x(0)},${H}Z" fill="url(#g)"/><path d="${d}" fill="none" stroke="#e8b64c" stroke-width="1.8"/>${marks}
      <circle cx="${x(P.length - 1)}" cy="${y(last.c)}" r="3.5" fill="#fff"/></svg>
      <div class="muted">${new Date(P[0].t).toLocaleDateString('th-TH')} – ${new Date(last.t).toLocaleDateString('th-TH')}</div>`;
  },

  record: f => `<table><tr><th>ระบบ</th><th class="r">ปิดแล้ว</th><th class="r">ชนะ</th><th class="r">แพ้</th><th class="r">ชนะ %</th><th class="r">P/L $</th></tr>
    ${f.rows.map(r => `<tr><td>${esc(r.system)}${r.open ? ` <small class="muted">(+${r.open} เปิดอยู่)</small>` : ''}</td><td class="r">${r.closed}</td><td class="r up">${r.wins}</td><td class="r down">${r.losses}</td>
      <td class="r">${r.closed ? Math.round(r.wins / r.closed * 100) + '%' : '—'}</td><td class="r ${r.pnl > 0 ? 'up' : r.pnl < 0 ? 'down' : ''}">${r.pnl ?? '—'}</td></tr>`).join('')}</table>`,

  status: f => `<div class="rows">${f.rows.map(r => `<div class="kv"><span>${esc(r.label)}</span><span class="${tcls(r.tone)}">${esc(r.value)}</span></div>`).join('')}</div>`,

  list: f => f.items.length ? `<ul class="plain">${f.items.map(i => typeof i === 'string' ? `<li>${esc(i)}</li>` : `<li><b>${esc(i.title)}:</b> ${esc(i.text)}</li>`).join('')}</ul>` : none,

  sources: f => `<div class="rows">${f.items.map(s => `<div class="kv"><span>${esc(s.name)}<br><small class="muted">${esc(s.what)}</small></span><span class="muted">${esc(s.at || '')}</span></div>`).join('')}</div>`,

  note: f => `<div style="font-size:13px;line-height:1.55;white-space:pre-wrap">${esc(f.text)}</div>`,
};

const FRAME_DATA = [];  // เก็บ spec ของแต่ละการ์ด ให้ปุ่มช่วงเวลา/ราคาสดใช้ต่อ
function renderFrame(f) {
  const fn = FRAMES[f.type];
  let body;
  try { body = fn ? fn(f) : `<div class="empty">ไม่รู้จัก frame "${esc(f.type)}"</div>`; }
  catch (e) { body = `<div class="empty down">วาดไม่สำเร็จ: ${esc(e.message)}</div>`; }
  const i = FRAME_DATA.push(f) - 1;
  return `<section class="card ${f.span === 2 ? 'span2' : f.span === 3 ? 'span3' : ''}" data-i="${i}" data-type="${esc(f.type)}"${f.calc ? ` data-calc="${esc(f.calc)}"` : ''}>
    <h3><span>${esc(f.title || f.type)}</span>${f.source ? `<small>${esc(f.source)}</small>` : ''}</h3><div class="cbody">${body}</div>${f.footnote ? `<div class="foot">${esc(f.footnote)}</div>` : ''}</section>`;
}
