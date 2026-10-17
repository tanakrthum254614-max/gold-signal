// frame ชุดที่ 2: กราฟเลือกช่วงเวลา, เกจ, yield curve, แท่งเปรียบเทียบ, การ์ดราคาสด (Hyperliquid)
const COLORS = ['#f0b90b', '#60a5fa', '#0ecb81', '#f472b6', '#fb923c', '#a78bfa', '#cbd5e1'];
const DAY = 86400000;
const fmtNum = (v, f = 'num', d) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const dd = d ?? (Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 100 ? 1 : 2);
  const s = Number(v).toLocaleString('en-US', { minimumFractionDigits: dd, maximumFractionDigits: dd });
  return f === 'usd' ? '$' + s : f === 'pct' ? s + '%' : f === 'bp' ? s + ' bp' : s;
};
const pxFmt = v => v == null ? '—' : v >= 1000 ? fmtNum(v, 'num', 2) : v >= 10 ? fmtNum(v, 'num', 2) : fmtNum(v, 'num', 4);
const chCls = v => v > 0 ? 'up' : v < 0 ? 'down' : 'tmuted';
const tLabel = (t, span) => {
  const d = new Date(t);
  if (span <= 2 * DAY) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  if (span <= 400 * DAY) return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
};

// กราฟเส้น: path ยืดตามกล่อง (preserveAspectRatio none) + ป้ายแกนเป็น HTML จึงไม่บิดเบี้ยว
function lineChart(lines, o = {}) {
  lines = lines.filter(l => l.points?.length > 1);
  if (!lines.length) return none;
  const h = o.h || 170, fmt = o.fmt || 'num';
  const ts = lines.flatMap(l => l.points.map(p => p.t));
  const x0 = o.x0 ?? Math.min(...ts), x1 = o.x1 ?? Math.max(...ts);
  const axes = {};
  for (const l of lines) {
    const a = l.axis || 'left', vs = l.points.map(p => p.v).concat(a === 'left' ? (o.refs || []).map(r => r.v) : []);
    axes[a] = axes[a] || { lo: Infinity, hi: -Infinity };
    axes[a].lo = Math.min(axes[a].lo, ...vs); axes[a].hi = Math.max(axes[a].hi, ...vs);
  }
  for (const a of Object.values(axes)) { const pad = (a.hi - a.lo || Math.abs(a.hi) || 1) * 0.08; a.lo -= pad; a.hi += pad; }
  const X = t => (t - x0) / (x1 - x0 || 1) * 1000, Y = (v, a = 'left') => 100 - (v - axes[a].lo) / (axes[a].hi - axes[a].lo) * 100;
  const yTop = (v, a) => Y(v, a).toFixed(2) + '%';
  let svg = '', html = '';
  for (let k = 0; k <= 4; k++) svg += `<line x1="0" x2="1000" y1="${k * 25}" y2="${k * 25}" class="grid"/>`;
  for (const r of o.refs || []) {
    svg += `<line x1="0" x2="1000" y1="${Y(r.v)}" y2="${Y(r.v)}" stroke="${r.color || 'var(--muted)'}" stroke-dasharray="6 5" vector-effect="non-scaling-stroke" opacity=".8"/>`;
    html += `<span class="ref" style="top:${yTop(r.v)};color:${r.color || 'var(--dim)'}">${esc(r.label)}</span>`;
  }
  lines.forEach((l, i) => {
    const c = l.color || COLORS[i % COLORS.length], a = l.axis || 'left';
    const d = l.points.map((p, j) => `${j ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v, a).toFixed(2)}`).join('');
    if (o.area !== false && i === 0) svg += `<path d="${d}L${X(l.points.at(-1).t)},100L${X(l.points[0].t)},100Z" fill="${c}" opacity=".12"/>`;
    svg += `<path d="${d}" fill="none" stroke="${c}" stroke-width="${l.width || 1.8}" vector-effect="non-scaling-stroke" ${l.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
  });
  for (const [a, ax] of Object.entries(axes)) {
    const f = a === 'right' ? (o.fmtR || fmt) : fmt;
    for (let k = 0; k <= 3; k++) {
      const v = ax.hi - (ax.hi - ax.lo) * k / 3;
      html += `<span class="yl ${a}" style="top:${k / 3 * 100}%">${fmtNum(v, f, o.dec)}</span>`;
    }
  }
  const span = x1 - x0, xl = [0, 1 / 3, 2 / 3, 1].map(q => `<span style="left:${q * 100}%">${tLabel(x0 + span * q, span)}</span>`).join('');
  return `<div class="lc ${axes.right ? 'dual' : ''}" style="--h:${h}px"><div class="plot"><svg viewBox="0 0 1000 100" preserveAspectRatio="none">${svg}</svg>${html}</div><div class="xl">${xl}</div></div>`;
}

const legend = lines => `<div class="legend">${lines.map((l, i) => `<span><i style="background:${l.color || COLORS[i % COLORS.length]}"></i>${esc(l.name)}</span>`).join('')}</div>`;

function seriesBody(f, label) {
  const r = (f.ranges || []).find(x => x.label === label);
  let lines = r?.lines || f.lines;
  let x0;
  if (r?.days && !r.lines) {
    const tmax = Math.max(...lines.flatMap(l => l.points.map(p => p.t)));
    x0 = tmax - r.days * DAY;
    lines = lines.map(l => ({ ...l, points: l.points.filter(p => p.t >= x0) }));
  }
  return lineChart(lines, { h: f.height, fmt: f.fmt, fmtR: f.fmtR, dec: f.decimals, refs: f.refs, area: f.area });
}

Object.assign(FRAMES, {
  series: f => {
    const def = f.defaultRange || f.ranges?.at(-1)?.label;
    return `<div class="sh"><div><div class="big ${tcls(f.tone)}">${esc(f.headline ?? '')}</div>${f.sub ? `<div class="muted">${esc(f.sub)}</div>` : ''}</div>
      ${f.change ? `<div class="chg2 ${tcls(f.change.tone)}">${esc(f.change.text)}</div>` : ''}</div>
      ${f.chips?.length ? `<div class="chips">${f.chips.map(c => `<span class="chip ${tcls(c.tone)}">${esc(c.label)} <b>${esc(c.value)}</b></span>`).join('')}</div>` : ''}
      ${f.ranges?.length ? `<div class="rngs">${f.ranges.map(r => `<button class="rng ${r.label === def ? 'on' : ''}" data-r="${esc(r.label)}">${esc(r.label)}</button>`).join('')}</div>` : ''}
      <div class="chartbox">${seriesBody(f, def)}</div>${f.lines.length > 1 ? legend(f.lines) : ''}`;
  },

  curve: f => {
    const toPts = arr => arr.map((p, i) => ({ t: i, v: p.v }));
    const lines = [{ name: f.nowLabel || 'ล่าสุด', points: toPts(f.now), color: '#f0b90b' }];
    if (f.prev) lines.push({ name: f.prev.label, points: toPts(f.prev.points), color: '#8b7fb0', dash: true, width: 1.4 });
    const chart = lineChart(lines, { h: f.height || 120, fmt: 'pct', dec: 2 }).replace(/<div class="xl">.*?<\/div><\/div>$/s, '</div>');
    return `<div class="sh"><div><div class="big ${tcls(f.tone)}">${esc(f.headline)}</div><div class="muted">${esc(f.sub || '')}</div></div></div>${chart}
      <div class="tiles t${f.now.length}">${f.now.map((p, i) => {
        const pv = f.prev?.points[i]?.v, d = pv != null ? Math.round((p.v - pv) * 100) : null;
        return `<div class="tile"><span>${esc(p.label)}</span><b>${p.v.toFixed(2)}%</b>${d != null ? `<small class="${chCls(d)}">${d > 0 ? '+' : ''}${d} bp</small>` : ''}</div>`;
      }).join('')}</div>${f.prev ? legend(lines) : ''}`;
  },

  gauge: f => {
    const a0 = -210, a1 = 30, R = 80, cx = 100, cy = 100;
    const ang = v => a0 + (Math.min(Math.max(v, f.min), f.max) - f.min) / (f.max - f.min) * (a1 - a0);
    const pt = a => [cx + R * Math.cos(a * Math.PI / 180), cy + R * Math.sin(a * Math.PI / 180)];
    const arc = (from, to, col, w) => { const [x0, y0] = pt(ang(from)), [x1, y1] = pt(ang(to)); return `<path d="M${x0},${y0}A${R},${R} 0 ${ang(to) - ang(from) > 180 ? 1 : 0} 1 ${x1},${y1}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`; };
    let lo = f.min, bands = '';
    for (const b of f.bands || []) { bands += arc(lo, b.to, b.color, 3); lo = b.to; }
    const band = (f.bands || []).find(b => f.value <= b.to) || f.bands?.at(-1);
    const col = band?.color || '#f0b90b';
    return `<div class="gauge"><svg viewBox="0 0 200 150">${arc(f.min, f.max, 'rgba(255,255,255,.08)', 14)}${arc(f.min, f.value, col, 14)}${bands.replace(/stroke-width="3"/g, 'stroke-width="3" opacity=".55" transform="translate(0,0)"')}
      <text x="100" y="98" text-anchor="middle" font-size="34" font-weight="700" fill="${col}">${esc(fmtNum(f.value, 'num', f.decimals ?? 2))}</text>
      <text x="100" y="120" text-anchor="middle" font-size="11" fill="var(--dim)" letter-spacing="1.5">${esc(band?.name || '')}</text></svg>
      ${f.sub ? `<div class="muted" style="text-align:center">${esc(f.sub)}</div>` : ''}</div>`;
  },

  bars: f => {
    const max = Math.max(...f.rows.map(r => Math.abs(r.value)), 1e-9), neg = f.rows.some(r => r.value < 0);
    return `<div class="bars">${f.rows.map(r => {
      const w = Math.abs(r.value) / max * (neg ? 50 : 100), col = r.color || (r.value >= 0 ? 'var(--up)' : 'var(--down)');
      const pos = !neg ? `left:0;width:${w}%` : r.value >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
      return `<div class="br"><span class="bl">${esc(r.label)}</span><div class="bt ${neg ? 'mid' : ''}"><span style="${pos};background:${col}"></span></div><span class="bv ${r.value >= 0 ? 'up' : 'down'}">${esc(r.display ?? fmtNum(r.value))}</span></div>`;
    }).join('')}</div>`;
  },

  board: f => `<div class="rows">${f.rows.map(r => `<div class="kv big2"><span>${esc(r.label)}${r.sub ? `<br><small class="muted">${esc(r.sub)}</small>` : ''}</span><span>${esc(r.value)}</span></div>`).join('')}</div>
    ${f.tiles?.length ? `<div class="tiles t${Math.min(f.tiles.length, 4)}">${f.tiles.map(t => `<div class="tile"><span>${esc(t.label)}</span><b class="${tcls(t.tone)}">${esc(t.value)}</b>${t.sub ? `<small class="muted">${esc(t.sub)}</small>` : ''}</div>`).join('')}</div>` : ''}`,

  profile: f => {
    const pos = (f.price - f.rangeLow) / (f.rangeHigh - f.rangeLow) * 100;
    return `<div class="pf"><b>${esc(f.name)}</b><span class="muted">${esc(f.sub || '')}</span></div>
      <div class="sh"><div class="big"><span data-live-px>${usd(f.price)}</span> <span class="chg2 ${chCls(f.change)}" data-live-ch>${pc(f.change, 2)}</span></div></div>
      <div class="muted" style="margin:10px 0 4px;display:flex;justify-content:space-between"><span>กรอบ 52 สัปดาห์</span><span data-live-pos>${pos.toFixed(0)}% ของกรอบ</span></div>
      <div class="rbar"><span data-live-bar style="width:${Math.max(0, Math.min(100, pos))}%"></span></div>
      <div class="muted" style="display:flex;justify-content:space-between;margin-top:3px"><span>${usd(f.rangeLow, 0)}</span><span>${usd(f.rangeHigh, 0)}</span></div>
      <div class="tiles t2">${(f.tiles || []).map(t => `<div class="tile"><span>${esc(t.label)}</span><b ${t.live ? `data-live-${esc(t.live)}` : ''}>${esc(t.value)}</b>${t.sub ? `<small class="muted">${esc(t.sub)}</small>` : ''}</div>`).join('')}</div>`;
  },

  // ---------- การ์ดสด: วาดโครงไว้ก่อน แล้ว LIVE เติมข้อมูล ----------
  quotes: f => `<div class="quotes">${f.coins.map((c, i) => `<div class="q" data-coin="${esc(c.coin)}"><i style="background:${c.color || COLORS[i % COLORS.length]}"></i><span>${esc(c.label)}</span><b>—</b><em class="tmuted">—</em></div>`).join('')}</div>`,
  liveline: f => `<div class="ll-legend">${f.coins.map((c, i) => `<div class="q" data-coin="${esc(c.coin)}"><i style="background:${c.color || COLORS[i % COLORS.length]}"></i><span>${esc(c.label)}</span><b>—</b><em class="tmuted">—</em></div>`).join('')}</div><div class="chartbox"><div class="empty">กำลังต่อราคาสด…</div></div>`,
  candles: f => `<div class="candle-head"><div><div class="candle-label">ราคาปิดแท่ง</div><div class="candle-price" data-candle-price>—</div><div class="candle-detail" data-candle-detail>กำลังโหลดแท่งเทียน…</div></div><span class="candle-state waiting" data-live-last>กำลังเชื่อมต่อ</span></div>
    <div class="rngs candle-ranges" aria-label="ช่วงเวลาแท่งเทียน">${(f.intervals || ['5m']).map(iv => `<button class="rng civ ${iv === (f.default || f.intervals?.[0] || '5m') ? 'on' : ''}" data-iv="${iv}">${iv}</button>`).join('')}</div>
    <div class="candle-ohlc" data-candle-ohlc aria-live="off"><span>เปิด <b>—</b></span><span>สูง <b>—</b></span><span>ต่ำ <b>—</b></span><span>ปิด <b>—</b></span></div>
    <div class="chartbox"><div class="empty">กำลังโหลดแท่งเทียน…</div></div><div class="candle-key"><span><i class="up-dot"></i>ราคาขึ้น</span><span><i class="down-dot"></i>ราคาลง</span><span class="muted">แตะ/ชี้เพื่อดูค่า · แท่งล่าสุดขยับตามราคา mid และซิงก์ OHLC ทุก 15 วิ</span></div>`,
});

function candleChart(rows, marks = []) {
  if (!rows?.length) return none;
  const lo0 = Math.min(...rows.map(r => r.l)), hi0 = Math.max(...rows.map(r => r.h));
  const near = marks.filter(m => m.price > lo0 - (hi0 - lo0) * .5 && m.price < hi0 + (hi0 - lo0) * .5);
  const lo = Math.min(lo0, ...near.map(m => m.price)), hi = Math.max(hi0, ...near.map(m => m.price)), pad = (hi - lo) * .06;
  const Y = v => 100 - (v - (lo - pad)) / ((hi + pad) - (lo - pad)) * 100, n = rows.length, w = 1000 / n;
  let svg = '';
  for (let k = 0; k <= 4; k++) svg += `<line x1="0" x2="1000" y1="${k * 25}" y2="${k * 25}" class="grid"/>`;
  rows.forEach((r, i) => {
    const x = i * w + w / 2, up = r.c >= r.o, col = up ? '#34d399' : '#fb7185';
    svg += `<g class="candle-bar" data-ci="${i}" tabindex="0" role="img" aria-label="${esc(tLabel(r.t, DAY))}: เปิด ${pxFmt(r.o)} สูง ${pxFmt(r.h)} ต่ำ ${pxFmt(r.l)} ปิด ${pxFmt(r.c)}">
      <line x1="${x}" x2="${x}" y1="${Y(r.h)}" y2="${Y(r.l)}" stroke="${col}" vector-effect="non-scaling-stroke"/>
      <rect x="${x - w * .35}" width="${w * .7}" y="${Math.min(Y(r.o), Y(r.c))}" height="${Math.max(Math.abs(Y(r.o) - Y(r.c)), .4)}" fill="${col}"/>
      <rect class="candle-hit" x="${i * w}" width="${w}" y="0" height="100" fill="transparent"/></g>`;
  });
  const last = rows.at(-1).c;
  let html = '';
  const labs = [{ y: Y(last), cls: 'ref now', text: pxFmt(last) }];
  for (const m of near) {
    svg += `<line x1="0" x2="1000" y1="${Y(m.price)}" y2="${Y(m.price)}" stroke="${m.tone === 'up' ? '#34d399' : m.tone === 'down' ? '#fb7185' : '#8b7fb0'}" stroke-dasharray="6 5" vector-effect="non-scaling-stroke" opacity=".6"/>`;
    labs.push({ y: Y(m.price), cls: 'ref', text: `${m.label} ${fmtNum(m.price, 'num', 0)}` });
  }
  // กันป้ายทับกัน: ห่างกันอย่างน้อย ~7% ของความสูง
  labs.sort((a, b) => a.y - b.y).forEach((l, i) => { if (i && l.y - labs[i - 1].y < 7) l.y = labs[i - 1].y + 7; });
  html += labs.map(l => `<span class="${l.cls}" style="top:${l.y}%">${esc(l.text)}</span>`).join('');
  svg += `<line x1="0" x2="1000" y1="${Y(last)}" y2="${Y(last)}" stroke="#fff" stroke-dasharray="2 4" vector-effect="non-scaling-stroke" opacity=".5"/>`;
  for (let k = 0; k <= 3; k++) { const v = (hi + pad) - ((hi + pad) - (lo - pad)) * k / 3; html += `<span class="yl left" style="top:${k / 3 * 100}%">${pxFmt(v)}</span>`; }
  const span = rows.at(-1).t - rows[0].t, xl = [0, 1 / 3, 2 / 3, 1].map(q => `<span style="left:${q * 100}%">${tLabel(rows[0].t + span * q, span)}</span>`).join('');
  return `<div class="lc candle-chart" style="--h:260px"><div class="plot"><svg viewBox="0 0 1000 100" preserveAspectRatio="none">${svg}</svg>${html}</div><div class="xl">${xl}</div></div>`;
}

const candleMs = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 };
const quoteTime = q => {
  if (!q?.t) return 0;
  const raw = typeof q.t === 'number' ? q.t : Date.parse(q.t);
  if (!Number.isFinite(raw)) return 0;
  return raw < 1e12 ? raw * 1000 : raw;
};
const quoteSource = q => ({ site: 'investing.com (ราคาเดียวกับหัวเว็บ Gold Signal)', hl: 'Hyperliquid', 'hl-ws': 'Hyperliquid WebSocket', 'hl-poll': 'Hyperliquid', stream: 'Yahoo stream', spark: 'Yahoo', mt5: 'Exness MT5', 'gold-api': 'gold-api.com' }[q?.src] || q?.src || 'ราคาอ้างอิง');

function candleReadout(el, row, detail) {
  if (!row) return;
  const cells = el.querySelectorAll('[data-candle-ohlc] b');
  [row.o, row.h, row.l, row.c].forEach((v, i) => { cells[i].textContent = pxFmt(v); });
  el.querySelector('[data-candle-price]').textContent = pxFmt(row.c);
  el.querySelector('[data-candle-detail]').textContent = detail;
}

function candleLatestReadout(el, f) {
  const row = el._rows?.at(-1); if (!row) return;
  candleReadout(el, row, `แท่ง ${el._iv} · ${new Date(row.t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${f.source || 'Hyperliquid'}`);
}

function candleStatus(el, q) {
  const out = el.querySelector('[data-live-last]'); if (!out) return;
  const t = quoteTime(q), age = t ? Math.max(0, Math.floor((Date.now() - t) / 1000)) : Infinity;
  const fresh = age < 15;
  out.className = 'candle-state ' + (fresh ? 'fresh' : age < 120 ? 'delayed' : 'waiting');
  out.textContent = fresh ? `สด · ${age} วิ` : age < 120 ? `ช้า ${age} วิ` : t ? `ข้อมูลเก่า ${Math.floor(age / 60)} นาที` : 'รอราคาสด';
  out.title = t ? `ราคาจาก ${quoteSource(q)} เวลา ${new Date(t).toLocaleString('th-TH')}` : 'ยังไม่มีข้อมูลราคาสด';
}

// ---------- ตัวควบคุมราคาสด ----------
const LIVE = {
  timers: [], buf: {}, quotes: {},
  coins() {
    const s = new Set();
    for (const f of FRAME_DATA) {
      if (f.coins) f.coins.forEach(c => s.add(c.coin));
      if (f.coin && f.type === 'profile') s.add(f.coin);
    }
    (window.dash?.ticker || []).forEach(c => s.add(c.coin));
    return [...s];
  },
  stop() { this.timers.forEach(clearInterval); this.timers = []; },
  async start() {
    this.stop();
    const coins = this.coins();
    // เริ่มเส้นสดด้วยแท่ง 1 นาที ย้อนหลัง ~3 ชม. จะได้ไม่ว่าง
    for (const f of FRAME_DATA.filter(f => f.type === 'liveline'))
      await Promise.all(f.coins.map(async c => {
        if (this.buf[c.coin]?.length) return;
        const rows = await siteCandles(c.coin, '1m').catch(() => []);
        this.buf[c.coin] = Array.isArray(rows) ? rows.map(r => ({ t: r.t, v: r.c })) : [];
      }));
    this.quotes = QS;   // ราคามาจาก stream (live.js) — ไม่ต้อง poll
    for (const el of document.querySelectorAll('.card[data-type="candles"]')) {
      const f = FRAME_DATA[el.dataset.i];
      const load = async () => {
        if (window.zfPaused) return; // dashboard not on screen (site-live.js)
        const iv = el.querySelector('.civ.on')?.dataset.iv || '5m';
        const seq = el._loadSeq = (el._loadSeq || 0) + 1, started = Date.now();
        const rows = await siteCandles(f.coin, iv).catch(() => null);
        if (seq !== el._loadSeq || !el.isConnected || iv !== el.querySelector('.civ.on')?.dataset.iv) return;
        if (Array.isArray(rows) && rows.length) {
          const previous = el._rows?.at(-1);
          el._rows = rows.slice(-(f.bars || 72)); el._iv = iv; el._drawn = 0; el._lastAppliedTs = started;
          if (previous && el._lastTickTime > started && previous.t >= el._rows.at(-1).t) el._rows[el._rows.length - 1] = previous;
          this.drawCandles(el, f);
        } else if (!el._rows?.length) el.querySelector('.chartbox').innerHTML = '<div class="empty">โหลดแท่งเทียนไม่สำเร็จ กำลังลองใหม่…</div>';
      };
      el._load = load; load(); this.timers.push(setInterval(load, 15000));
    }
  },
  // รับ tick จาก stream: ต่อเส้นสด
  push(k, q) {
    const b = (this.buf[k] = this.buf[k] || []), t = quoteTime(q);
    if (!t || !Number.isFinite(q.px) || t > Date.now() + 5000 || (b.length && t < b.at(-1).t)) return;
    if (!b.length || t - b.at(-1).t > 1000) b.push({ t, v: q.px }); else b.at(-1).v = q.px;
    if (b.length > 900) b.splice(0, b.length - 900);
  },
  // แท่งเทียนสด: รับเฉพาะราคาที่ใหม่กว่าแท่งล่าสุด ไม่สร้างแท่งจากราคาค้าง
  drawCandles(el, f) {
    const rows = el._rows; if (!rows?.length) return;
    const q = QS[f.coin], px = q?.px, t = quoteTime(q), ms = candleMs[el._iv] || 300000;
    if (Number.isFinite(px) && t > (el._lastAppliedTs || 0) && t <= Date.now() + 5000) {
      const bucket = Math.floor(t / ms) * ms, last = rows.at(-1);
      if (bucket > last.t) rows.push({ t: bucket, o: px, h: px, l: px, c: px });
      else if (bucket === last.t) { last.c = px; last.h = Math.max(last.h, px); last.l = Math.min(last.l, px); }
      el._lastAppliedTs = t; el._lastTickTime = t;
      if (rows.length > (f.bars || 72)) rows.shift();
    }
    candleStatus(el, q);
    if (Date.now() - (el._drawn || 0) < 900) return;
    el._drawn = Date.now();
    el.querySelector('.chartbox').innerHTML = candleChart(rows, f.marks);
    candleLatestReadout(el, f);
  },
  paint() {
    const Q = this.quotes;
    document.querySelectorAll('.card[data-type="candles"]').forEach(el => this.drawCandles(el, FRAME_DATA[el.dataset.i]));
    document.querySelectorAll('.q[data-coin]').forEach(el => {
      const q = Q[el.dataset.coin]; if (!q) return;
      el.querySelector('b').textContent = pxFmt(q.px);
      const e = el.querySelector('em'); e.textContent = pc(q.ch, 2); e.className = chCls(q.ch);
    });
    for (const el of document.querySelectorAll('.card[data-type="liveline"]')) {
      const f = FRAME_DATA[el.dataset.i];
      const lines = f.coins.map((c, i) => {
        const b = this.buf[c.coin] || []; if (b.length < 2) return null;
        return { name: c.label, color: c.color || COLORS[i % COLORS.length], points: b.map(p => ({ t: p.t, v: (p.v / b[0].v - 1) * 100 })) };
      }).filter(Boolean);
      if (Date.now() - (el._drawn || 0) < 700) continue;
      el._drawn = Date.now();
      if (lines.length) el.querySelector('.chartbox').innerHTML = lineChart(lines, { h: f.height || 150, fmt: 'pct', dec: 2, area: false, refs: [{ v: 0, label: '0%' }] });
    }
    for (const el of document.querySelectorAll('.card[data-type="profile"]')) {
      const f = FRAME_DATA[el.dataset.i], q = Q[f.coin]; if (!q) continue;
      el.querySelector('[data-live-px]').textContent = usd(q.px);
      const c = el.querySelector('[data-live-ch]'); c.textContent = pc(q.ch, 2) + ' วันนี้'; c.className = 'chg2 ' + chCls(q.ch);
      const pos = (q.px - f.rangeLow) / (f.rangeHigh - f.rangeLow) * 100;
      el.querySelector('[data-live-pos]').textContent = pos.toFixed(0) + '% ของกรอบ';
      el.querySelector('[data-live-bar]').style.width = Math.max(0, Math.min(100, pos)) + '%';
      const oi = el.querySelector('[data-live-oi]'); if (oi) oi.textContent = '$' + fmtNum(q.oi / 1e6, 'num', 1) + 'M';
      const vol = el.querySelector('[data-live-vol]'); if (vol) vol.textContent = '$' + fmtNum(q.vol / 1e6, 'num', 1) + 'M';
      const fu = el.querySelector('[data-live-funding]'); if (fu) fu.textContent = (q.funding * 100).toFixed(4) + '%/ชม.';
    }
    if (window.paintTicker) window.paintTicker(Q);
  },
};

// ปุ่มช่วงเวลา (series) และ interval (candles)
document.addEventListener('click', e => {
  const b = e.target.closest('.rng'); if (!b || b.classList.contains('hmk') || b.classList.contains('sciv')) return;   // ปุ่ม heatmap จัดการใน frames3
  const card = b.closest('.card'), f = FRAME_DATA[card.dataset.i];
  card.querySelectorAll('.rng').forEach(x => x.classList.toggle('on', x === b));
  if (b.classList.contains('civ')) {
    card._rows = []; card._lastAppliedTs = 0;
    card.querySelector('.chartbox').innerHTML = '<div class="empty">กำลังโหลดช่วงเวลาใหม่…</div>';
    card._load?.();
  }
  else card.querySelector('.chartbox').innerHTML = seriesBody(f, b.dataset.r);
});

document.addEventListener('mouseover', e => {
  const bar = e.target.closest?.('.candle-bar'); if (!bar) return;
  const card = bar.closest('.card'), row = card?._rows?.[Number(bar.dataset.ci)];
  if (row) candleReadout(card, row, `แท่ง ${card._iv} · ${new Date(row.t).toLocaleString('th-TH')}`);
});
document.addEventListener('focusin', e => {
  const bar = e.target.closest?.('.candle-bar'); if (!bar) return;
  const card = bar.closest('.card'), row = card?._rows?.[Number(bar.dataset.ci)];
  if (row) candleReadout(card, row, `แท่ง ${card._iv} · ${new Date(row.t).toLocaleString('th-TH')}`);
});
document.addEventListener('mouseout', e => {
  const bar = e.target.closest?.('.candle-bar'); if (!bar) return;
  if (e.relatedTarget?.closest?.('.candle-bar')) return;
  const card = bar.closest('.card');
  candleLatestReadout(card, FRAME_DATA[card.dataset.i]);
});
document.addEventListener('focusout', e => {
  const bar = e.target.closest?.('.candle-bar'); if (!bar) return;
  const card = bar.closest('.card');
  candleLatestReadout(card, FRAME_DATA[card.dataset.i]);
});
