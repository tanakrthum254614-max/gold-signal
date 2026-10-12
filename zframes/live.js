// ===== Realtime engine =====
// รับราคาทุก tick ผ่าน Server-Sent Events (/api/stream) แล้วคำนวณทุกตัวชี้วัดใหม่จากราคาสด
const QS = {};                 // ราคาสดล่าสุด: สัญลักษณ์ Yahoo (NVDA, ^NDX, ^TNX), Hyperliquid (xyz:GOLD), mt5:gold, ea, spot:XAU
const LIVESTAT = { ticks: 0, last: 0, since: Date.now(), es: null, ok: false };

// ---------- ตัวชี้วัด (ต่อยอดจาก state ณ ราคาปิดล่าสุดที่ปิดแล้ว) ----------
const kE = n => 2 / (n + 1);
function liveTA(st, px) {
  if (!st || px == null) return null;
  const e20 = px * kE(20) + st.e20 * (1 - kE(20));
  const e50 = st.e50 != null ? px * kE(50) + st.e50 * (1 - kE(50)) : null;
  const e200 = st.e200 != null ? px * kE(200) + st.e200 * (1 - kE(200)) : null;
  const e12 = px * kE(12) + st.e12 * (1 - kE(12)), e26 = px * kE(26) + st.e26 * (1 - kE(26));
  const m = e12 - e26, sig = m * kE(9) + st.sig * (1 - kE(9)), h = m - sig;
  const d = px - st.prev, ag = (st.ag * 13 + Math.max(d, 0)) / 14, al = (st.al * 13 + Math.max(-d, 0)) / 14;
  const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  const score = (px > e20 ? 1 : -1) + (e50 != null ? (e20 > e50 ? 1 : -1) : 0) + (e200 != null ? (px > e200 ? 1 : -1) : 0) + (h > 0 ? 1 : -1) + (rsi > 55 ? 1 : rsi < 45 ? -1 : 0);
  return { e20, e50, e200, macd: m, hist: h, rsi, score, max: e200 != null ? 5 : 4 };
}
// คำนวณเต็มจากราคาปิดทั้งชุด (ใช้กับแท่ง 1H/4H ของ Hyperliquid)
function taFromCloses(cl) {
  if (cl.length < 30) return null;
  const ema = (n) => { let e = cl[0]; const k = kE(n); for (let i = 1; i < cl.length; i++) e = cl[i] * k + e * (1 - k); return e; };
  let e12 = cl[0], e26 = cl[0], sig = 0, ag = 0, al = 0;
  for (let i = 1; i < cl.length; i++) {
    e12 = cl[i] * kE(12) + e12 * (1 - kE(12)); e26 = cl[i] * kE(26) + e26 * (1 - kE(26));
    sig = i === 1 ? e12 - e26 : (e12 - e26) * kE(9) + sig * (1 - kE(9));
    const d = cl[i] - cl[i - 1];
    if (i <= 14) { ag += Math.max(d, 0) / 14; al += Math.max(-d, 0) / 14; } else { ag = (ag * 13 + Math.max(d, 0)) / 14; al = (al * 13 + Math.max(-d, 0)) / 14; }
  }
  const px = cl.at(-1), e20 = ema(20), e50 = cl.length >= 50 ? ema(50) : null, e200 = cl.length >= 200 ? ema(200) : null;
  const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al), h = e12 - e26 - sig;
  const score = (px > e20 ? 1 : -1) + (e50 != null ? (e20 > e50 ? 1 : -1) : 0) + (e200 != null ? (px > e200 ? 1 : -1) : 0) + (h > 0 ? 1 : -1) + (rsi > 55 ? 1 : rsi < 45 ? -1 : 0);
  return { e20, e50, e200, rsi, score, max: e200 != null ? 5 : 4 };
}
const signalOf = (s, r) => s >= 3 && r >= 70 ? 'ขาขึ้น · ร้อนแรง' : s >= 3 ? 'ขาขึ้น' : s <= -3 && r <= 30 ? 'ขาลง · ขายมากเกิน' : s <= -3 ? 'ขาลง' : r <= 30 ? 'ขายมากเกิน' : r >= 70 ? 'ซื้อมากเกิน' : 'ไซด์เวย์';
const chg = (a, b) => a != null && b ? (a / b - 1) * 100 : null;

// ---------- หุ้นรายตัวแบบสด (cache ต่อรอบวาด) ----------
let LSC = new Map(), LSV = 0;
function liveStock(x) {
  if (!x) return null;
  const q = QS[x.s], key = x.s + ':' + (q?.px ?? '') + ':' + LSV;
  const c = LSC.get(x.s); if (c && c._k === key) return c;
  const px = q?.px ?? x.px, prev = x.st?.prev ?? x.px;
  const o = { ...x, _k: key, px, q, hours: q?.hours, d: q ? chg(px, prev) : x.ch1d };
  if (x.refs) { o.ch1w = chg(px, x.refs['1w']); o.ch1m = chg(px, x.refs['1m']); o.ch3m = chg(px, x.refs['3m']); o.ytd = chg(px, x.refs.ytd); o.ch1y = chg(px, x.refs['1y']); }
  const ta = liveTA(x.st, px);
  if (ta) { o.rsi = ta.rsi; o.score = ta.score; o.aboveE50 = ta.e50 != null ? px > ta.e50 : null; o.aboveE200 = ta.e200 != null ? px > ta.e200 : null; o.signal = signalOf(ta.score, ta.rsi); }
  if (x.hi52) { const hi = Math.max(x.hi52, px), lo = Math.min(x.lo52 ?? px, px); o.fromHigh = chg(px, hi); o.pos52 = hi > lo ? (px - lo) / (hi - lo) * 100 : null; }
  if (x.fwd != null || x.yield != null) {   // หุ้นปันผล
    o.y = x.fwd ? x.fwd / px * 100 : (x.yield ?? 0) * (x.px / px);
    o.vsAvg = x.avg5 ? o.y - x.avg5 : null;
    let s = Math.min(o.y / 6, 1) * 30 + Math.min(Math.max(x.cagr5 || 0, 0) / 10, 1) * 25 + Math.min(x.streak / 10, 1) * 25;
    const p = x.gics === 'Real Estate' ? null : x.payout;
    s += p == null ? 8 : p <= 60 ? 20 : p <= 80 ? 12 : p <= 100 ? 5 : 0;
    if (p != null && p > 100) s -= 15; if ((x.cagr5 || 0) < 0) s -= 10;
    o.dscore = Math.max(0, Math.round(s));
  }
  LSC.set(x.s, o);
  return o;
}
const LS = s => liveStock(window.dash?.stockMap?.[s]);
const allLive = () => (window.dash?.stockSyms || []).map(LS).filter(Boolean);

function liveIndex() {
  const I = window.dash?.index; if (!I) return null;
  const q = QS[I.symbol], px = q?.px ?? I.px, ta = liveTA(I.st, px), hl = QS[I.hl];
  const hi = Math.max(I.hi52, px);
  return { px, q, hl, hours: q?.hours, d: chg(px, I.st?.prev ?? I.px), ch1m: chg(px, I.refs?.['1m']), ytd: chg(px, I.refs?.ytd), ch1y: chg(px, I.refs?.['1y']),
    fromHigh: chg(px, hi), rsi: ta?.rsi ?? I.rsi, score: ta?.score ?? I.score, ta };
}
function breadthLive() {
  const L = allLive(); let adv = 0, dec = 0, e50 = 0, n50 = 0, e200 = 0, n200 = 0, near = 0, ob = 0, os = 0; const sig = {};
  for (const x of L) {
    if (x.d > 0) adv++; else if (x.d < 0) dec++;
    if (x.aboveE50 != null) { n50++; e50 += x.aboveE50; } if (x.aboveE200 != null) { n200++; e200 += x.aboveE200; }
    if (x.fromHigh > -3) near++; if (x.rsi >= 70) ob++; if (x.rsi <= 30) os++;
    if (x.signal) sig[x.signal] = (sig[x.signal] || 0) + 1;
  }
  return { n: L.length, adv, dec, e50: n50 ? e50 / n50 * 100 : null, e200: n200 ? e200 / n200 * 100 : null, near, ob, os, sig };
}
function sectorsLive(metric) {
  const g = {};
  for (const x of allLive()) {
    const v = metric === 'ch1d' ? x.d : x[metric]; if (v == null || !x.cap) continue;
    const capL = x.cap * (x.px / (x.st?.prev ?? x.px));
    const a = g[x.sector] || (g[x.sector] = { s: 0, w: 0, n: 0 }); a.s += v * capL; a.w += capL; a.n++;
  }
  return Object.entries(g).map(([k, a]) => ({ sector: k, v: a.s / a.w, n: a.n })).sort((a, b) => b.v - a.v);
}

// ---------- ทองแบบสด ----------
const GOLDTF = { '1H': null, '4H': null };
async function loadGoldTF() {
  for (const [tf, iv] of [['1H', '1h'], ['4H', '4h']]) {
    const rows = await siteCandles('xyz:GOLD', iv).catch(() => null);
    if (Array.isArray(rows) && rows.length > 30) GOLDTF[tf] = rows.map(r => r.c);
  }
}
function goldPx() { const G = window.dash?.gold; return QS[G?.key]?.px ?? QS['spot:XAU']?.px ?? QS['mt5:gold']?.px ?? window.dash?.basePrice; }
function goldTrend() {
  const G = window.dash.gold, px = goldPx(), rows = [];
  const d1 = liveTA(G.state1d, px);
  if (d1) rows.push({ tf: '1D', ...d1 });
  for (const tf of ['4H', '1H']) {
    const cl = GOLDTF[tf]; if (!cl) continue;
    const t = taFromCloses([...cl.slice(0, -1), px]); if (t) rows.push({ tf, ...t });
  }
  return rows;
}

// ---------- เงื่อนไข action ----------
function condState(c, px) {
  if (!c) return null;
  const v = c.key ? QS[c.key]?.px : px;
  if (c.op === 'before') { const ms = Date.parse(c.t) - Date.now(); return { on: ms > 0 && ms < (c.within || 36) * 3600e3, text: ms > 0 ? `อีก ${ms > 864e5 ? Math.floor(ms / 864e5) + ' วัน ' : ''}${Math.floor(ms % 864e5 / 36e5)} ชม. ${Math.floor(ms % 36e5 / 6e4)} นาที` : 'ผ่านไปแล้ว' }; }
  if (v == null) return null;
  const on = c.op === '<' ? v < c.v : c.op === '>' ? v > c.v : c.op === 'between' ? v >= c.lo && v <= c.hi : false;
  const tgt = c.op === 'between' ? (v < c.lo ? c.lo : v > c.hi ? c.hi : v) : c.v;
  return { on, text: on ? 'เข้าเงื่อนไขแล้ว' : `ห่าง ${fmtNum(Math.abs(v - tgt), 'num', v > 1000 ? 0 : 2)} (${pct2(Math.abs(v / tgt - 1) * 100)})` };
}

// ---------- การ์ดที่คำนวณสด ----------
const pad = v => v == null ? '—' : pct2(v);
const CALC = {
  'gold.kpis': f => {
    const G = window.dash.gold, px = goldPx(), mt = QS['mt5:gold'], tr = goldTrend();
    const tot = tr.reduce((a, r) => a + r.score, 0), mx = tr.reduce((a, r) => a + r.max, 0);
    const items = [
      { label: 'XAU/USD สด', value: usd(px), sub: `วันนี้ ${pad(chg(px, G.prev))}`, tone: chg(px, G.prev) >= 0 ? 'up' : 'down' },
      ...(mt ? [{ label: `Exness ${mt.symbol}`, value: mt.bid?.toFixed(2), sub: `spread ${(mt.ask - mt.bid).toFixed(2)} · ${mt.open ? 'ตลาดเปิด' : 'ตลาดปิด'}`, tone: 'muted' }] : []),
      { label: '1 สัปดาห์', value: pad(chg(px, G.refs['1w'])), tone: chg(px, G.refs['1w']) >= 0 ? 'up' : 'down' },
      { label: '1 เดือน', value: pad(chg(px, G.refs['1m'])), tone: chg(px, G.refs['1m']) >= 0 ? 'up' : 'down' },
      { label: 'ตั้งแต่ต้นปี', value: pad(chg(px, G.refs.ytd)), tone: chg(px, G.refs.ytd) >= 0 ? 'up' : 'down' },
      { label: 'ห่างจุดสูงสุด 52 สัปดาห์', value: pad(chg(px, Math.max(G.hi52, px))), sub: `สูง ${usd(G.hi52, 0)} · ต่ำ ${usd(G.lo52, 0)}`, tone: 'warn' },
      { label: 'แนวโน้มรวม (สด)', value: `${tot > 0 ? '+' : ''}${tot}/${mx}`, sub: tr.map(r => `${r.tf} ${r.score > 0 ? '+' : ''}${r.score}`).join(' · '), tone: tot > 0 ? 'up' : tot < 0 ? 'down' : 'muted' },
    ];
    return { ...f, items };
  },
  'gold.snapshot': f => {
    const G = window.dash.gold, px = goldPx(), tr = goldTrend(), tot = tr.reduce((a, r) => a + r.score, 0), mx = tr.reduce((a, r) => a + r.max, 0);
    const lines = f.lines.filter(l => !/แนวโน้มสด|กรอบ 5 วัน/.test(l.label)).concat([
      { label: 'แนวโน้มสด', text: `${tot > 0 ? '+' : ''}${tot} จาก ±${mx} (${tr.map(r => `${r.tf} ${r.score > 0 ? '+' : ''}${r.score} RSI ${r.rsi.toFixed(0)}`).join(' · ')})` },
      { label: 'กรอบ 5 วัน', text: `${usd(px * (1 + G.q5.bear), 0)} – ${usd(px * (1 + G.q5.bull), 0)} (คำนวณจากราคาสด ${usd(px)})` }]);
    return { ...f, lines };
  },
  'gold.scen': f => { const G = window.dash.gold, px = goldPx(); return { ...f, cases: f.cases.map(c => ({ ...c, price: px * (1 + G.q5[c.name.toLowerCase()]) })) }; },
  'gold.levels': f => ({ ...f, current: goldPx() }),
  'gold.trend': f => ({ ...f, rows: goldTrend().map(r => ({ tf: r.tf, score: r.score, max: r.max, rsi: +r.rsi.toFixed(1), note: `EMA20 ${fmtNum(r.e20, 'num', 0)}${r.e50 ? ' · EMA50 ' + fmtNum(r.e50, 'num', 0) : ''}${r.e200 ? ' · EMA200 ' + fmtNum(r.e200, 'num', 0) : ''}` })) }),
  'gold.rsi': f => {
    const r = liveTA(window.dash.gold.state1d, goldPx())?.rsi; if (r == null) return f;
    return { ...f, headline: r.toFixed(0), sub: (r >= 70 ? 'ซื้อมากเกิน (Overbought)' : r <= 30 ? 'ขายมากเกิน (Oversold)' : 'กลาง ๆ') + ' · สด', lines: withLast(f.lines, r) };
  },
  'gold.price': f => { const px = goldPx(); return { ...f, headline: usd(px), lines: withLast(f.lines, px), ranges: f.ranges.map(r => r.lines ? { ...r, lines: withLast(r.lines, px) } : r) }; },
  'gold.peers': f => {
    const G = window.dash.gold, px = goldPx();
    const rows = [{ label: 'ทองคำ', value: chg(px, G.refs['1m']), color: '#fbbf24' }, ...G.peers.map(p => ({ label: p.label, value: chg(QS[p.coin]?.px, p.ref) }))]
      .filter(r => r.value != null).map(r => ({ ...r, display: pct2(r.value) }));
    return { ...f, rows };
  },
  'actions': f => {
    const px = window.dash.kind === 'gold' ? goldPx() : liveIndex()?.px;
    return { ...f, rows: f.rows.map(r => ({ ...r, live: condState(r.cond, px) })) };
  },
  // ---------- ดัชนีหุ้น ----------
  'idx.kpis': f => {
    const I = liveIndex(), B = breadthLive(), name = window.dash.title.split(' — ')[0];
    const tone = v => v > 0 ? 'up' : v < 0 ? 'down' : 'muted';
    return { ...f, items: [
      { label: `${name} · ${hoursTH(I.hours)}`, value: fmtNum(I.px, 'num', 2), sub: `วันนี้ ${pad(I.d)}${I.hl ? ` · 24 ชม. ${pad(I.hl.ch * 100)}` : ''}`, tone: tone(I.d) },
      { label: '1 เดือน', value: pad(I.ch1m), tone: tone(I.ch1m) },
      { label: 'ตั้งแต่ต้นปี', value: pad(I.ytd), tone: tone(I.ytd) },
      { label: 'ห่างจุดสูงสุด 52 สัปดาห์', value: pad(I.fromHigh), tone: I.fromHigh < -5 ? 'warn' : 'muted' },
      { label: 'หุ้นขึ้น / ลง (สด)', value: `${B.adv} / ${B.dec}`, sub: `จาก ${B.n} ตัว`, tone: B.adv > B.dec ? 'up' : 'down' },
      { label: 'เหนือ EMA50 / EMA200', value: `${B.e50?.toFixed(0)}% / ${B.e200?.toFixed(0)}%`, sub: `RSI ดัชนี ${I.rsi.toFixed(0)} · เทรนด์ ${I.score > 0 ? '+' : ''}${I.score}/5`, tone: 'muted' },
    ] };
  },
  'idx.snapshot': f => {
    const I = liveIndex(), B = breadthLive();
    return { ...f, lines: f.lines.filter(l => !/สด/.test(l.label)).concat([
      { label: 'แนวโน้มดัชนี (สด)', text: `คะแนน ${I.score > 0 ? '+' : ''}${I.score}/5 · RSI ${I.rsi.toFixed(0)} · วันนี้ ${pad(I.d)} · ${hoursTH(I.hours)}` },
      { label: 'สัญญาณรายตัว (สด)', text: Object.entries(B.sig).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') }]) };
  },
  'idx.price': f => { const I = liveIndex(); return { ...f, headline: fmtNum(I.px, 'num', 2), change: { text: `วันนี้ ${pad(I.d)} · 1 ปี ${pad(I.ch1y)}`, tone: I.d >= 0 ? 'up' : 'down' }, lines: withLast(f.lines, I.px) }; },
  'idx.rsi': f => { const I = liveIndex(); return { ...f, headline: I.rsi.toFixed(0), sub: (I.rsi >= 70 ? 'ซื้อมากเกิน (Overbought)' : I.rsi <= 30 ? 'ขายมากเกิน (Oversold)' : 'กลาง ๆ') + ' · สด', lines: withLast(f.lines, I.rsi) }; },
  'idx.breadth': f => { const B = breadthLive(); return { ...f, headline: `${B.e50?.toFixed(0)}%`, sub: `เหนือ EMA200 ${B.e200?.toFixed(0)}% · ใกล้จุดสูงสุด ${B.near} ตัว · RSI≥70 ${B.ob} · ≤30 ${B.os}`, lines: withLast(f.lines, B.e50) }; },
  'idx.sectors': f => ({ ...f, rows: sectorsLive(f.metric).map(g => ({ label: `${g.sector} (${g.n})`, value: g.v, display: pct2(g.v) })) }),
  'idx.signals': f => ({ ...f, rows: Object.entries(breadthLive().sig).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, display: String(v), color: '#c4b5fd' })) }),
  // ---------- มหภาค ----------
  'macro.board': f => {
    const M = window.dash.macroLive || {}, y10 = QS['^TNX'];
    if (!y10) return f;
    const real = M.be10 != null ? y10.px - M.be10 : null;
    return { ...f, tiles: [
      { label: '10Y (สด)', value: y10.px.toFixed(3) + '%', sub: `${((y10.px - (y10.prev ?? y10.px)) * 100).toFixed(1)} bp วันนี้`, tone: y10.px > (y10.prev ?? y10.px) ? 'down' : 'up' },
      { label: 'Real 10Y (≈ สด)', value: real != null ? real.toFixed(2) + '%' : '—', sub: `10Y สด − เงินเฟ้อคาด ${M.be10?.toFixed(2)}%` },
      { label: '13 สัปดาห์ (สด)', value: QS['^IRX'] ? QS['^IRX'].px.toFixed(3) + '%' : '—', sub: '≈ ดอกเบี้ยระยะสั้น' }] };
  },
  'macro.curve': f => {
    const M = window.dash.macroLive || {}, map = { '3M': '^IRX', '5Y': '^FVX', '10Y': '^TNX', '30Y': '^TYX' };
    const now = f.now.map(p => map[p.label] && QS[map[p.label]] ? { label: p.label, v: QS[map[p.label]].px } : p);
    const y10 = now.find(p => p.label === '10Y')?.v, y2 = now.find(p => p.label === '2Y')?.v ?? M.y2;
    const bp = y10 != null && y2 != null ? Math.round((y10 - y2) * 100) : null;
    return { ...f, now, headline: bp != null ? `${bp > 0 ? '+' : ''}${bp} bps` : f.headline, sub: `2s10s · ${bp > 0 ? 'ปกติ (ชัน)' : 'กลับหัว'} · 3M/5Y/10Y/30Y สด · 2Y รายวัน`, tone: bp > 0 ? 'up' : 'down' };
  },
  'macro.real': f => {
    const M = window.dash.macroLive || {}, y10 = QS['^TNX']; if (!y10 || M.be10 == null) return f;
    const r = y10.px - M.be10;
    return { ...f, headline: r.toFixed(2) + '%', sub: `real yield 10 ปี ≈ สด (10Y ${y10.px.toFixed(3)}% − เงินเฟ้อคาด ${M.be10.toFixed(2)}%)`,
      change: M.real10Fred != null ? { text: `${((r - M.real10Fred) * 100).toFixed(0)} bp จากค่าทางการล่าสุด`, tone: r > M.real10Fred ? 'down' : 'up' } : f.change };
  },
  'macro.dxy': f => { const q = QS['DX-Y.NYB']; return q ? { ...f, headline: q.px.toFixed(3), change: { text: `วันนี้ ${pad(q.ch * 100)}`, tone: q.ch > 0 ? 'down' : 'up' }, lines: withLast(f.lines, q.px) } : f; },
  'macro.vix': f => { const q = QS['^VIX']; return q ? { ...f, value: q.px, sub: `วันนี้ ${pad(q.ch * 100)} · ${hoursTH(q.hours)}` } : f; },
  'macro.spx': f => { const q = QS['^GSPC']; return q ? { ...f, headline: fmtNum(q.px, 'num', 2), change: { text: `วันนี้ ${pad(q.ch * 100)}`, tone: q.ch >= 0 ? 'up' : 'down' }, lines: withLast(f.lines, q.px) } : f; },
};
function withLast(lines, v) {
  if (v == null || !lines?.length) return lines;
  const l = lines[0], p = l.points, last = p.at(-1), now = Date.now();
  const pts = now - last.t < 20 * 3600e3 ? [...p.slice(0, -1), { t: last.t, v }] : [...p, { t: now, v }];
  return [{ ...l, points: pts }, ...lines.slice(1)];
}
const hoursTH = h => ({ open: '🟢 ตลาดเปิด', pre: '🟡 ก่อนเปิด', post: '🟡 หลังปิด', overnight: '🌙 ช่วงกลางคืน', closed: '⚪ ตลาดปิด', '24/7': '24 ชม.' }[h] || '');

// ---------- Screen (คัดหุ้นสด) ----------
const SCREEN_FILTERS = {
  ob: x => x.rsi >= 70, os: x => x.rsi <= 30, nearHigh: x => x.fromHigh > -3,
  safeHigh: x => x.y >= 4 && (x.gics === 'Real Estate' || (x.payout != null && x.payout <= 80)) && (x.cagr5 || 0) >= 0,
  growers: x => (x.cagr5 || 0) >= 10 && x.streak >= 5,
  traps: x => x.y >= 4 && ((x.payout > 100 && x.gics !== 'Real Estate') || (x.cagr5 || 0) < 0),
  cheap: x => x.vsAvg != null && x.streak >= 5, ndx: x => x.idx?.includes('NDX'), monthly: x => x.freq >= 12, cuts: x => x.cagr5 != null && x.cagr5 < 0,
};
const SCREEN_FMT = { rsi: v => v.toFixed(0), y: v => v.toFixed(2) + '%', dscore: v => String(v), streak: v => v + ' ปี', vsAvg: v => (v > 0 ? '+' : '') + v.toFixed(2) + ' จุด', payout: v => v.toFixed(0) + '%' };
const SCREEN_LBL = { y: 'ยิลด์', cagr5: 'โต', streak: 'ต่อเนื่อง', payout: 'payout' };
function screenRows(f) {
  const L = allLive().filter(x => x[f.metric] != null && (!f.filter || SCREEN_FILTERS[f.filter](x)));
  L.sort((a, b) => f.asc ? a[f.metric] - b[f.metric] : b[f.metric] - a[f.metric]);
  return { list: L.slice(0, f.n || 10), total: L.length };
}
FRAMES.screen = f => {
  const { list, total } = screenRows(f), fm = SCREEN_FMT[f.metric] || pct2;
  if (!list.length) return '<div class="empty">ไม่มีหุ้นเข้าเงื่อนไขตอนนี้</div>';
  if (f.mode === 'list') return `<div class="muted" style="margin-bottom:6px">${total} ตัว</div><ul class="plain">${list.map(x => `<li data-open="${x.s}" style="cursor:pointer"><b>${x.s}</b> — ${fm(x[f.metric])}${f.extra ? ' · ' + f.extra.map(k => `${SCREEN_LBL[k] || k} ${x[k] == null ? '—' : (SCREEN_FMT[k] || pct2)(x[k])}`).join(' · ') : ` · วันนี้ ${pct2(x.d)}`}</li>`).join('')}</ul>`;
  const max = Math.max(...list.map(x => Math.abs(x[f.metric]))) || 1, neg = list.some(x => x[f.metric] < 0);
  return `<div class="bars">${list.map(x => {
    const v = x[f.metric], w = Math.abs(v) / max * (neg ? 50 : 100), col = f.color || (v >= 0 ? 'var(--up)' : 'var(--down)');
    const pos = !neg ? `left:0;width:${w}%` : v >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
    return `<div class="br" data-open="${x.s}" style="cursor:pointer"><span class="bl">${x.s}</span><div class="bt ${neg ? 'mid' : ''}"><span style="${pos};background:${col}"></span></div><span class="bv ${v >= 0 ? 'up' : 'down'}">${fm(v)}</span></div>`;
  }).join('')}</div>`;
};
// action แสดงสถานะเงื่อนไขสด
const _action = FRAMES.action;
FRAMES.action = f => !f.rows.some(r => r.live) ? _action(f) : f.rows.map(r => `<div class="act ${r.live?.on ? 'hit' : ''}"><span class="w">ถ้า ${esc(r.when)}${r.live ? `<br><small class="${r.live.on ? 'warn' : 'muted'}">${r.live.on ? '● ' : ''}${esc(r.live.text)}</small>` : ''}</span><span class="${tcls(r.tone)}">→ ${esc(r.do)}</span></div>`).join('');

// ---------- รับข้อมูลสด + วาด ----------
let dirty = false, lastHeavy = 0;
function connectLive(id) {
  LIVESTAT.es?.close();
  LIVESTAT.ticks = 0; LIVESTAT.last = 0; LIVESTAT.since = Date.now(); LIVESTAT.ok = false;
  const es = LIVESTAT.es = new EventSource('/api/stream?d=' + encodeURIComponent(id));
  const take = e => {
    const j = JSON.parse(e.data);
    for (const [k, v] of Object.entries(j.q || {})) {
      QS[k] = v; LIVESTAT.ticks++;
      const rawTime = typeof v.t === 'number' ? v.t : Date.parse(v.t);
      const qt = rawTime < 1e12 ? rawTime * 1000 : rawTime;
      if (Number.isFinite(qt) && qt <= Date.now() + 5000) LIVESTAT.last = Math.max(LIVESTAT.last, qt);
      if (k.startsWith('xyz:')) LIVE.push?.(k, v);
      if (!k.includes(':') && window.dash?.stockMap?.[k]) SQ[k] = { ...v, hl: QS['xyz:' + k] && { px: QS['xyz:' + k].px, ch: QS['xyz:' + k].ch } };
    }
    LIVESTAT.ok = true; dirty = true;
  };
  es.onopen = () => { LIVESTAT.ok = true; badge(); };
  es.addEventListener('snapshot', take);
  es.onmessage = take;
  es.onerror = () => { LIVESTAT.ok = false; badge(); };
}
function badge() {
  const el = document.getElementById('livebadge'); if (!el) return;
  const age = LIVESTAT.last ? Math.max(0, (Date.now() - LIVESTAT.last) / 1000) : Infinity;
  const rate = LIVESTAT.ticks / Math.max(1, (Date.now() - LIVESTAT.since) / 1000);
  const fresh = LIVESTAT.ok && age < 15;
  el.className = 'livebadge ' + (fresh ? 'on' : LIVESTAT.ok ? 'idle' : 'off');
  el.innerHTML = `<i></i>${fresh ? 'รับราคาสด' : LIVESTAT.ok ? 'เชื่อมต่อ · รอราคาใหม่' : 'กำลังเชื่อมต่อ…'} · ${rate.toFixed(1)} อัปเดต/วิ · ราคาล่าสุด ${LIVESTAT.last ? new Date(LIVESTAT.last).toLocaleTimeString('th-TH') : '—'}`;
  document.querySelectorAll('.card[data-type="candles"]').forEach(card => {
    const coin = FRAME_DATA[card.dataset.i]?.coin;
    if (coin) candleStatus(card, QS[coin]);
  });
}
function paintCalc() {
  document.querySelectorAll('.card[data-calc], .card[data-type="screen"]').forEach(card => {
    const cur = FRAME_DATA[card.dataset.i], f = cur._base || cur, fn = CALC[f.calc];
    let f2 = fn ? fn(f) : f;
    if (f2.type === 'series') { const on = card.querySelector('.rng.on')?.dataset.r; if (on) f2 = { ...f2, defaultRange: on }; }
    FRAME_DATA[card.dataset.i] = { ...f2, calc: f.calc, _base: f };
    const html = FRAMES[f2.type](f2);
    const body = card.querySelector('.cbody');
    if (body && body.innerHTML !== html) body.innerHTML = html;
  });
}
function liveLoop() {
  const now = Date.now();
  if (dirty) {
    dirty = false; LSV++;
    LIVE.paint?.();
    if (now - lastHeavy > 1000) { lastHeavy = now; STOCKS.paint?.(); paintCalc(); }
    else dirty = true;   // ส่วนหนัก (ตาราง/การ์ดคำนวณ) วาดไม่เกินวินาทีละครั้ง
  }
  requestAnimationFrame(liveLoop);
}
requestAnimationFrame(liveLoop);
setInterval(badge, 1000);
setInterval(() => { if (window.dash?.kind === 'gold') loadGoldTF().then(() => { dirty = true; }); }, 60000);
