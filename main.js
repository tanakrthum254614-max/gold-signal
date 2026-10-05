// Gold Signal — live XAU/USD chart + recommendation based on investing.com technical analysis
const TFS = [
  { key: '5m', label: '5 นาที', inv: 'PT5M', bn: '5m' },
  { key: '15m', label: '15 นาที', inv: 'PT15M', bn: '15m' },
  { key: '30m', label: '30 นาที', inv: 'PT30M', bn: '30m' },
  { key: '1h', label: '1 ชม.', inv: 'PT1H', bn: '1h' },
  { key: '5h', label: '5 ชม.', inv: 'PT5H', bn: '4h' },
  { key: '1d', label: '1 วัน', inv: 'P1D', bn: '1d' },
  { key: '1w', label: '1 สัปดาห์', inv: 'P1W', bn: '1w' },
];
const TECH_TFS = ['5m', '15m', '30m', '1h', '5h', '1d', '1w', '1mo'];
const TF_LABEL = Object.fromEntries(TFS.map((t) => [t.key, t.label]));
TF_LABEL['1mo'] = '1 เดือน';
const HIGHER = { '5m': '1h', '15m': '1h', '30m': '5h', '1h': '5h', '5h': '1d', '1d': '1w', '1w': '1mo' };
const TZ = -new Date().getTimezoneOffset() * 60; // show candles in local time
const POLL_PRICE = 3000, POLL_TECH = 30000, POLL_DAILY = 60000;
// investing.com's data API allows cross-origin requests that carry its domain-id header,
// so the visitor's browser fetches it directly (server-side requests get Cloudflare-challenged)
const INVESTING_API = 'https://api.investing.com/api/financialdata';
const PAIR_ID = 68; // XAU/USD
const ACTION_TH = {
  BUY: ['ซื้อ', 'สถิติส่วนใหญ่บอกว่าราคามีแนวโน้มขึ้น'],
  SELL: ['ขาย', 'สถิติส่วนใหญ่บอกว่าราคามีแนวโน้มลง'],
  WAIT: ['รอก่อน', 'ยังไม่ใช่จังหวะดี ไม่ควรซื้อหรือขายตอนนี้'],
};

const state = {
  tf: '1h', bars: [], daily: [], tech: null, techAt: null, source: null,
  locked: null, lastPrice: null, chartKey: '', pivotKey: '', busy: false, thb: null, zoneKey: '',
};
// Simple-mode history ranges map onto chart timeframes (160 bars each)
const RANGES = [
  { tf: '15m', label: '2 วัน' }, { tf: '1h', label: '1 สัปดาห์' },
  { tf: '5h', label: '1 เดือน' }, { tf: '1d', label: '6 เดือน' },
];

const $ = (id) => document.getElementById(id);
const f2 = (v) => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const tfOf = (key) => TFS.find((t) => t.key === key);
const tagCls = (key) => String(key).replace('_', '-');

// ---------- Data: investing.com direct, Binance + gold-api as backup ----------
async function getJson(url, headers) {
  const r = await fetch(url, { cache: 'no-store', headers });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

const investing = (path) => getJson(`${INVESTING_API}${path}`, { 'domain-id': 'th' });
const investingChart = (interval) => investing(`/${PAIR_ID}/historical/chart/?interval=${interval}&pointscount=160`);

const fromInvesting = (rows) => rows.map((b) => ({ time: b[0] / 1000, open: b[1], high: b[2], low: b[3], close: b[4] }));

async function backupBars(bnInterval, limit) {
  const [k, spot] = await Promise.all([
    getJson(`https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${bnInterval}&limit=${limit}`),
    getJson('https://api.gold-api.com/price/XAU').catch(() => null),
  ]);
  const bars = k.map((x) => ({ time: x[0] / 1000, open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
  // PAXG trades at a small premium to spot; shift so prices line up with XAU/USD
  const fresh = spot && Date.now() - Date.parse(spot.updatedAt) < 10 * 60e3;
  const off = fresh ? spot.price - bars[bars.length - 1].close : 0;
  return bars.map((b) => ({ ...b, open: b.open + off, high: b.high + off, low: b.low + off, close: b.close + off }));
}

async function loadBars(tf) {
  const t = tfOf(tf);
  try {
    const j = await investingChart(t.inv);
    if (!j.data || !j.data.length) throw new Error('empty');
    return { bars: fromInvesting(j.data), source: 'investing' };
  } catch (e) {
    return { bars: await backupBars(t.bn, 300), source: 'backup' };
  }
}

async function refreshPrice() {
  const tf = state.tf;
  try {
    const { bars, source } = await loadBars(tf);
    if (tf !== state.tf) return; // timeframe switched while loading
    state.bars = bars;
    state.source = source;
    setConn(source === 'investing' ? 'live' : 'backup',
      source === 'investing' ? 'เรียลไทม์ · investing.com' : 'สำรอง · Binance PAXG');
    render();
  } catch (e) {
    setConn('down', 'โหลดข้อมูลไม่สำเร็จ กำลังลองใหม่…');
  }
}

async function refreshTech() {
  try {
    const results = await Promise.allSettled(TECH_TFS.map((tf) => investing(`/technical/analysis/${PAIR_ID}/${tf}`)));
    const tfs = {};
    results.forEach((r, i) => { if (r.status === 'fulfilled' && r.value.summary) tfs[TECH_TFS[i]] = r.value; });
    if (!Object.keys(tfs).length) throw new Error('no technical data');
    state.tech = tfs;
    state.techAt = new Date().toISOString();
  } catch (e) {
    state.tech = null;
  }
  renderTechTables();
  render();
}

async function refreshThb() {
  try {
    const j = await getJson('https://open.er-api.com/v6/latest/USD');
    if (j.rates && j.rates.THB) state.thb = j.rates.THB;
  } catch (e) { /* baht estimate is optional */ }
}

async function refreshDaily() {
  try {
    const j = await investingChart('P1D');
    state.daily = fromInvesting(j.data);
  } catch (e) {
    try { state.daily = await backupBars('1d', 5); } catch (e2) { /* keep old */ }
  }
}

// ---------- Charts ----------
const LC = LightweightCharts;
const chartBase = (showTime, logo = false) => ({
  autoSize: true,
  layout: { attributionLogo: logo, background: { color: 'transparent' }, textColor: '#8a93a3', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
  grid: { vertLines: { color: '#1b212c' }, horzLines: { color: '#1b212c' } },
  rightPriceScale: { borderColor: '#262e3b', minimumWidth: 78 },
  timeScale: { borderColor: '#262e3b', timeVisible: true, secondsVisible: false, visible: showTime, rightOffset: 6 },
  crosshair: { mode: LC.CrosshairMode.Normal },
});

const mainChart = LC.createChart($('mainChart'), chartBase(false, true));
const rsiChart = LC.createChart($('rsiChart'), chartBase(false));
const macdChart = LC.createChart($('macdChart'), chartBase(true));

const candles = mainChart.addCandlestickSeries({
  upColor: '#22c58b', downColor: '#f0506e', borderVisible: false,
  wickUpColor: '#22c58b', wickDownColor: '#f0506e',
});
const lineOpts = (color, extra = {}) => ({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...extra });
const ema20S = mainChart.addLineSeries(lineOpts('#4ea1ff', { lineWidth: 1.5 }));
const ema50S = mainChart.addLineSeries(lineOpts('#c77dff', { lineWidth: 1.5 }));
const bbU = mainChart.addLineSeries(lineOpts('#6b7686', { lineWidth: 1, lineStyle: LC.LineStyle.Dashed }));
const bbL = mainChart.addLineSeries(lineOpts('#6b7686', { lineWidth: 1, lineStyle: LC.LineStyle.Dashed }));

const rsiS = rsiChart.addLineSeries(lineOpts('#e8b64c', { lastValueVisible: true }));
rsiS.createPriceLine({ price: 70, color: '#f0506e', lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false });
rsiS.createPriceLine({ price: 30, color: '#22c58b', lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false });

const histS = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
const macdS = macdChart.addLineSeries(lineOpts('#4ea1ff', { lineWidth: 1.5 }));
const sigS = macdChart.addLineSeries(lineOpts('#f2a93b', { lineWidth: 1.5 }));

// Simple-mode chart: a plain price line with "good to buy / good to sell" levels
const simpleChart = LC.createChart($('simpleChart'), {
  ...chartBase(true),
  handleScroll: false, handleScale: false,
  grid: { vertLines: { visible: false }, horzLines: { color: '#1b212c' } },
});
const areaS = simpleChart.addAreaSeries({
  lineColor: '#e8b64c', topColor: 'rgba(232,182,76,.35)', bottomColor: 'rgba(232,182,76,0)', lineWidth: 2,
  priceLineVisible: false,
});
let zoneLines = [];
function drawZones(buy, sell) {
  const key = `${buy && buy.price}|${sell && sell.price}`;
  if (key === state.zoneKey) return;
  state.zoneKey = key;
  zoneLines.forEach((l) => areaS.removePriceLine(l));
  zoneLines = [];
  if (buy) zoneLines.push(areaS.createPriceLine({ price: buy.price, color: '#22c58b', lineWidth: 2, lineStyle: LC.LineStyle.Dashed, title: 'น่าซื้อแถวนี้' }));
  if (sell) zoneLines.push(areaS.createPriceLine({ price: sell.price, color: '#f0506e', lineWidth: 2, lineStyle: LC.LineStyle.Dashed, title: 'น่าขายแถวนี้' }));
}

// Keep the three panes scrolled/zoomed together
const charts = [mainChart, rsiChart, macdChart];
let syncing = false;
charts.forEach((c) => c.timeScale().subscribeVisibleLogicalRangeChange((range) => {
  if (syncing || !range) return;
  syncing = true;
  charts.forEach((o) => o !== c && o.timeScale().setVisibleLogicalRange(range));
  syncing = false;
}));

let planLines = [], pivotLines = [];
function setLines(store, defs) {
  store.forEach((l) => candles.removePriceLine(l));
  store.length = 0;
  defs.forEach((d) => store.push(candles.createPriceLine({ lineWidth: 1, axisLabelVisible: true, ...d })));
}

function drawPlanLines(plan) {
  if (plan.action === 'WAIT' || plan.entry == null) return setLines(planLines, []);
  setLines(planLines, [
    { price: plan.entry, color: '#e8b64c', title: 'จุดเข้า', lineStyle: LC.LineStyle.Solid },
    { price: plan.sl, color: '#f0506e', title: 'ตัดขาดทุน', lineStyle: LC.LineStyle.Dashed },
    { price: plan.tp1, color: '#22c58b', title: 'เป้า 1', lineStyle: LC.LineStyle.Dashed },
    { price: plan.tp2, color: '#22c58b', title: 'เป้า 2', lineStyle: LC.LineStyle.Dashed },
  ]);
}

function drawPivotLines(pv) {
  const key = state.tf + pv.map((p) => p.price).join();
  if (key === state.pivotKey) return;
  state.pivotKey = key;
  setLines(pivotLines, pv.map((p) => ({
    price: p.price, title: p.name, lineStyle: LC.LineStyle.Dotted, axisLabelVisible: false,
    color: p.name === 'P' ? 'rgba(232,182,76,.7)' : p.name[0] === 'R' ? 'rgba(240,80,110,.45)' : 'rgba(34,197,139,.45)',
  })));
}

// ---------- Rendering ----------
function render() {
  const cs = state.bars;
  if (!cs.length) return;
  const n = cs.length;
  const t = cs.map((c) => c.time + TZ);
  const ind = TA.computeAll(cs);
  const pt = (arr, i) => (arr[i] == null ? { time: t[i] } : { time: t[i], value: arr[i] });
  const histPt = (i) => {
    const h = ind.macd.hist[i];
    if (h == null) return { time: t[i] };
    const rising = i > 0 && ind.macd.hist[i - 1] != null && h > ind.macd.hist[i - 1];
    return { time: t[i], value: h, color: h >= 0 ? (rising ? '#22c58b' : '#1d7a59') : (rising ? '#9b3a4c' : '#f0506e') };
  };
  const lines = [[ema20S, ind.ema20], [ema50S, ind.ema50], [bbU, ind.bb.upper], [bbL, ind.bb.lower],
    [rsiS, ind.rsi], [macdS, ind.macd.line], [sigS, ind.macd.signal]];

  // Full redraw when the window of bars moved (new candle / new timeframe), else just patch the live bar
  const key = `${state.tf}|${cs[0].time}|${n}`;
  if (key !== state.chartKey) {
    const tfChanged = !state.chartKey.startsWith(`${state.tf}|`);
    state.chartKey = key;
    candles.setData(cs.map((c, i) => ({ time: t[i], open: c.open, high: c.high, low: c.low, close: c.close })));
    lines.forEach(([s, arr]) => s.setData(arr.map((_, i) => pt(arr, i))));
    histS.setData(cs.map((_, i) => histPt(i)));
    areaS.setData(cs.map((c, i) => ({ time: t[i], value: c.close })));
    simpleChart.timeScale().fitContent();
    if (tfChanged) mainChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 6 });
  } else {
    const i = n - 1, c = cs[i];
    candles.update({ time: t[i], open: c.open, high: c.high, low: c.low, close: c.close });
    lines.forEach(([s, arr]) => s.update(pt(arr, i)));
    histS.update(histPt(i));
    areaS.update({ time: t[i], value: c.close });
  }

  const price = cs[n - 1].close;
  renderQuote(price);

  const tech = state.tech && state.tech[state.tf];
  const htfKey = HIGHER[state.tf];
  let plan;
  if (tech) {
    const htech = state.tech[htfKey];
    plan = INV.decide(tech, htech, price, TF_LABEL[state.tf], TF_LABEL[htfKey]);
    plan.basis = 'investing.com';
    drawPivotLines(plan.pivots);
    renderLevels(plan.pivots, price);
  } else {
    // investing.com unavailable: fall back to our own indicator engine
    const main = TA.analyze(cs);
    const lv = TA.levels(cs, null, (ind.atr[n - 1] || 0) * 0.3);
    plan = TA.decide(main, null, price, lv);
    plan.basis = 'คำนวณเอง (สำรอง)';
    if (plan.buyZone != null) plan.buyZone = { name: plan.support ? plan.support.name : 'แนวรับ', price: plan.buyZone };
    if (plan.sellZone != null) plan.sellZone = { name: plan.resistance ? plan.resistance.name : 'แนวต้าน', price: plan.sellZone };
    drawPivotLines([]);
    renderLevels(lv.map((x) => ({ name: x.name, price: x.price })), price);
  }

  // Freeze entry/SL/TP while the call stays the same, so the levels don't drift every tick
  const L = state.locked;
  if (L && L.action === plan.action && L.tf === state.tf) {
    if (plan.action !== 'WAIT') Object.assign(plan, { entry: L.entry, sl: L.sl, tp1: L.tp1, tp2: L.tp2, tp1Name: L.tp1Name, tp2Name: L.tp2Name });
    plan.since = L.since;
  } else {
    state.locked = { ...plan, tf: state.tf, since: Date.now() };
    plan.since = state.locked.since;
    drawPlanLines(plan);
  }

  renderSignal(plan, htfKey);
  renderBrief(plan, price);
  renderSimple(plan, price);
  document.title = `${f2(price)} · ${ACTION_TH[plan.action][0]} | Gold Signal`;
}

function renderQuote(price) {
  const el = $('price');
  if (state.lastPrice != null && price !== state.lastPrice) {
    el.classList.remove('tick-up', 'tick-down');
    void el.offsetWidth;
    el.classList.add(price > state.lastPrice ? 'tick-up' : 'tick-down');
    clearTimeout(renderQuote.t);
    renderQuote.t = setTimeout(() => el.classList.remove('tick-up', 'tick-down'), 900);
  }
  state.lastPrice = price;
  el.textContent = f2(price);

  const d = state.daily;
  if (d.length >= 2) {
    const today = d[d.length - 1], prev = d[d.length - 2];
    const chg = price - prev.close, pct = (chg / prev.close) * 100;
    const c = $('chg');
    c.textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${chg >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
    c.className = `chg mono ${chg >= 0 ? 'up' : 'down'}`;
    $('dOpen').textContent = f2(today.open);
    $('dHigh').textContent = f2(Math.max(today.high, price));
    $('dLow').textContent = f2(Math.min(today.low, price));
    $('dPrev').textContent = f2(prev.close);
  }
  $('updated').textContent = new Date().toLocaleTimeString('th-TH');
}

function renderSignal(plan, htfKey) {
  $('signalCard').className = `card signal ${plan.action}`;
  $('sigTf').textContent = TF_LABEL[state.tf];
  $('sigSource').textContent = `อิง ${plan.basis}`;
  $('action').textContent = ACTION_TH[plan.action][0];
  $('actionSub').textContent = ACTION_TH[plan.action][1];
  $('meterFill').style.width = `${plan.confidence}%`;
  const htech = state.tech && state.tech[htfKey];
  const htf = htech ? ` · ${TF_LABEL[htfKey]}: ${INV.summaryTh(htech.summary)}` : '';
  $('confText').textContent = `ความมั่นใจ ${plan.confidence}%${htf}`;

  const box = (label, value, cls = '', note = '') =>
    `<div class="${cls}"><label>${label}</label><span class="mono">${value}</span>${note ? `<small>${note}</small>` : ''}</div>`;
  let html = '';
  if (plan.action !== 'WAIT') {
    const buy = plan.action === 'BUY';
    html += box(buy ? 'ซื้อที่ราคา' : 'ขายที่ราคา', f2(plan.entry), '', 'ราคาที่แนะนำให้เข้า');
    html += box('จุดตัดขาดทุน (SL)', f2(plan.sl), 'sl', buy ? 'ถ้าราคาลงถึงจุดนี้ ให้ขายออกทันที' : 'ถ้าราคาขึ้นถึงจุดนี้ ให้ปิดออเดอร์ทันที');
    html += box('เป้ากำไร 1 (TP1)', f2(plan.tp1), 'tp', plan.tp1Name ? `ที่${plan.tp1Name}` : '');
    html += box('เป้ากำไร 2 (TP2)', f2(plan.tp2), 'tp', plan.tp2Name ? `ที่${plan.tp2Name}` : '');
    html += box('ถ้าผิดทาง จะเสียสูงสุด', `${Math.abs(plan.entry - plan.sl).toFixed(2)} / ออนซ์`, 'wide', 'ตั้งจุดตัดขาดทุนไว้เสมอ เพื่อไม่ให้ขาดทุนบานปลาย');
  } else {
    if (plan.buyZone) html += box('จุดรอซื้อ', f2(plan.buyZone.price), 'tp', `${plan.buyZone.name}: ราคามักเด้งขึ้นแถวนี้`);
    if (plan.sellZone) html += box('จุดรอขาย', f2(plan.sellZone.price), 'sl', `${plan.sellZone.name}: ราคามักถูกกดลงแถวนี้`);
  }
  if (plan.atr) html += box('ราคาแกว่งเฉลี่ย (ATR)', `±${f2(plan.atr)}`, plan.since ? '' : 'wide', 'ต่อ 1 แท่งเทียน');
  if (plan.since) html += box('สัญญาณนี้เริ่มเมื่อ', new Date(plan.since).toLocaleTimeString('th-TH'));
  $('plan').innerHTML = html;

  $('reasons').innerHTML = plan.reasons.map((r) => `<li>${r}</li>`).join('') ||
    '<li class="muted">ไม่มีสัญญาณเด่นชัด</li>';
  $('warns').innerHTML = plan.warn.map((r) => `<li>${r}</li>`).join('');
}

function renderBrief(plan, price) {
  const horizon = state.tech ? EXPLAIN.horizons(state.tech, INV) : null;
  const b = EXPLAIN.brief({ plan, price, daily: state.daily, tfLabel: TF_LABEL[state.tf], horizon });
  $('briefIcon').textContent = b.icon;
  $('briefTitle').textContent = b.title;
  $('briefBasis').textContent = b.basis;
  $('briefLines').innerHTML = b.lines.map((l) => `<li>${l}</li>`).join('');
  $('horizons').innerHTML = horizon ? horizon.map((h) =>
    `<div class="horizon"><label>${h.name} (${h.hint})</label>${tag(h.key, h.th)}</div>`).join('') : '';
}

function renderSimple(plan, price) {
  const horizon = state.tech ? EXPLAIN.horizons(state.tech, INV) : null;
  if (!horizon) return;
  const s = SIMPLE.analyze({
    tech: state.tech, plan, price, daily: state.daily, thb: state.thb, horizons: horizon, INV, tfLabel: TF_LABEL[state.tf],
  });
  $('sHero').className = `card s-hero ${s.mood}`;
  $('sLight').textContent = s.light;
  $('sTrend').textContent = s.trend;
  $('sWhy').innerHTML = s.why.map((w) => `<li>${w}</li>`).join('');
  $('sUsd').textContent = f2(price);
  $('sThbRow').hidden = !s.thaiPrice;
  if (s.thaiPrice) $('sThb').textContent = (Math.round(s.thaiPrice / 50) * 50).toLocaleString('en-US');
  if (s.today) {
    $('sToday').textContent = s.today.text + (s.today.thbText ? ` (${s.today.thbText})` : '');
    $('sToday').className = `s-today ${s.today.chg >= 0 ? 'up' : 'down'}`;
  }
  $('gMarker').style.left = `${Math.max(2, Math.min(98, s.gauge))}%`;
  $('sSure').textContent = s.sure;
  for (const [id, p] of [['pBuy', s.personas.buy], ['pHold', s.personas.hold], ['pTrade', s.personas.trade]]) {
    const el = $(id);
    el.className = `card persona ${p.tone}`;
    el.querySelector('.p-answer').textContent = p.answer;
    el.querySelector('p').textContent = p.text;
  }
  drawZones(plan.buyZone, plan.sellZone);
}

function renderLevels(lv, price) {
  $('pvTf').textContent = TF_LABEL[state.tf];
  const items = lv.slice().sort((a, b) => b.price - a.price);
  const rows = items.map((x) => `<li class="${x.price > price ? 'res' : 'sup'}"><span>${x.label || x.name}</span><span class="mono">${f2(x.price)}</span></li>`);
  const nowIdx = items.findIndex((x) => x.price < price);
  rows.splice(nowIdx < 0 ? rows.length : nowIdx, 0, `<li class="now"><span>ราคาปัจจุบัน</span><span class="mono">${f2(price)}</span></li>`);
  $('levels').innerHTML = rows.join('');
}

const tag = (key, text) => `<span class="tag ${tagCls(key)}">${text}</span>`;
const actTag = (a) => tag(`s${INV.actionDir(a)}`, INV.actionTh(a));

function renderTechTables() {
  document.querySelectorAll('.tfName').forEach((el) => { el.textContent = TF_LABEL[state.tf]; });
  const T = state.tech;
  $('techTime').textContent = T && state.techAt ? `อัปเดต ${new Date(state.techAt).toLocaleTimeString('th-TH')}` : 'ไม่สามารถเชื่อมต่อได้';

  $('mtf').querySelector('tbody').innerHTML = TECH_TFS.map((tf) => {
    const t = T && T[tf];
    if (!t) return `<tr><td>${TF_LABEL[tf]}</td><td colspan="3" class="muted">—</td></tr>`;
    const o = INV.overview(t);
    return `<tr class="${tf === state.tf ? 'sel' : ''}"><td>${TF_LABEL[tf]}</td>
      <td>${tag(o.summary, o.summaryTh)}</td>
      <td>${tag(o.ma.key, o.ma.th)}<small>ซื้อ ${o.ma.buy} · ขาย ${o.ma.sell}</small></td>
      <td>${tag(o.ind.key, o.ind.th)}<small>ซื้อ ${o.ind.buy} · ขาย ${o.ind.sell} · กลาง ${o.ind.neutral}</small></td></tr>`;
  }).join('');

  const t = T && T[state.tf];
  if (!t) {
    $('ind').querySelector('tbody').innerHTML = '<tr><td colspan="3" class="muted">ไม่มีข้อมูลจาก investing.com</td></tr>';
    $('ma').querySelector('tbody').innerHTML = '<tr><td colspan="3" class="muted">ไม่มีข้อมูลจาก investing.com</td></tr>';
    $('indSum').textContent = ''; $('maSum').textContent = '';
    return;
  }
  const o = INV.overview(t);
  $('indSum').className = `tag ${tagCls(o.ind.key)}`; $('indSum').textContent = o.ind.th;
  $('maSum').className = `tag ${tagCls(o.ma.key)}`; $('maSum').textContent = o.ma.th;
  $('ind').querySelector('tbody').innerHTML = INV.indicators(t).map((x) =>
    `<tr><td><b>${x.name}</b> <span class="muted small">${x.about}</span><span class="why">→ ${x.meaning}</span></td><td class="mono">${x.value}</td><td>${actTag(x.action)}</td></tr>`).join('');
  $('ma').querySelector('tbody').innerHTML = INV.movingAverages(t).map((m) =>
    `<tr><td>${m.period} แท่ง</td><td><span class="mono">${m.sma}</span><small>${actTag(m.smaAction)}</small></td>
      <td><span class="mono">${m.ema}</span><small>${actTag(m.emaAction)}</small></td></tr>`).join('');
}

function setConn(cls, text) {
  $('conn').className = `conn ${cls}`;
  $('connText').textContent = text;
}

// ---------- Init ----------
$('tfs').innerHTML = TFS.map((t) => `<button data-tf="${t.key}">${t.label}</button>`).join('');
$('sRange').innerHTML = RANGES.map((r) => `<button data-tf="${r.tf}">${r.label}</button>`).join('');
function markTf() {
  document.querySelectorAll('#tfs button, #sRange button').forEach((b) => b.classList.toggle('on', b.dataset.tf === state.tf));
}
function setTf(tf) {
  if (!tf || tf === state.tf) return;
  state.tf = tf;
  state.locked = null;
  markTf();
  renderTechTables();
  refreshPrice();
}
['tfs', 'sRange'].forEach((id) => $(id).addEventListener('click', (e) => setTf(e.target.dataset && e.target.dataset.tf)));
markTf();

// Simple / detailed mode (remembered per browser)
function setMode(mode) {
  $('simpleView').hidden = mode !== 'simple';
  $('proView').hidden = mode !== 'pro';
  document.querySelectorAll('#modeSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  try { localStorage.setItem('gs-mode', mode); } catch (e) { /* storage unavailable */ }
}
$('modeSwitch').addEventListener('click', (e) => { if (e.target.dataset.mode) setMode(e.target.dataset.mode); });
let savedMode = 'simple';
try { savedMode = localStorage.getItem('gs-mode') || 'simple'; } catch (e) { /* storage unavailable */ }
setMode(savedMode);

// Poll only while the tab is visible; catch up immediately when it becomes visible again
function every(ms, fn) {
  setInterval(() => { if (!document.hidden) fn(); }, ms);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshTech(); refreshPrice(); } });

(async function init() {
  await AUTH.ready;
  renderTechTables();
  SPLASH.step('กำลังดึงราคาทองจาก investing.com…', 45);
  const pending = [refreshThb(), refreshDaily(), refreshTech().then(() => SPLASH.step('กำลังวิเคราะห์สถิติทุกกรอบเวลา…', 75)), refreshPrice()];
  await Promise.all(pending);
  render();
  SPLASH.hide();
  every(POLL_PRICE, refreshPrice);
  every(POLL_TECH, refreshTech);
  every(POLL_DAILY, refreshDaily);
  every(60 * 60e3, refreshThb);
})();
