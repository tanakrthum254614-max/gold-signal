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
  locked: null, lastPrice: null, chartKey: '', pivotKey: '', busy: false, zoneKey: '', signals: [], m15: [], backtest: null, intra: null, bt30: null, intraCandles: null,
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// investing.com occasionally rejects a request (Cloudflare); retry with a short backoff
async function investing(path, tries = 3) {
  for (let i = 0; ; i++) {
    try { return await getJson(`${INVESTING_API}${path}`, { 'domain-id': 'th' }); }
    catch (e) { if (i >= tries - 1) throw e; await sleep(800 * (i + 1)); }
  }
}
const investingChart = (interval, tries) => investing(`/${PAIR_ID}/historical/chart/?interval=${interval}&pointscount=160`, tries);

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
    const j = await investingChart(t.inv, 2);
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
  // Small batches instead of 8 parallel requests, and never throw away data we already have
  const tfs = {};
  for (let i = 0; i < TECH_TFS.length; i += 3) {
    const batch = TECH_TFS.slice(i, i + 3);
    const rs = await Promise.allSettled(batch.map((tf) => investing(`/technical/analysis/${PAIR_ID}/${tf}`)));
    rs.forEach((r, j) => { if (r.status === 'fulfilled' && r.value.summary) tfs[batch[j]] = r.value; });
  }
  if (Object.keys(tfs).length) {
    state.tech = { ...(state.tech || {}), ...tfs };
    state.techAt = new Date().toISOString();
  } else if (!state.tech) {
    setTimeout(refreshTech, 5000); // nothing yet: try again soon rather than in 30 s
  }
  renderTechTables();
  render();
}

async function refreshDaily() {
  try {
    const j = await investingChart('P1D');
    state.daily = fromInvesting(j.data);
  } catch (e) {
    if (!state.daily.length) {
      try { state.daily = await backupBars('1d', 60); } catch (e2) { /* keep old */ }
    }
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

// Simple chart: a plain price line with the latest signal's entry / stop / target
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
function drawSignalLines(s) {
  const key = `${s.id}|${s.entry}`;
  if (key === state.zoneKey) return;
  state.zoneKey = key;
  zoneLines.forEach((l) => areaS.removePriceLine(l));
  zoneLines = [];
  const line = (price, color, title, style, width = 2) =>
    zoneLines.push(areaS.createPriceLine({ price, color, lineWidth: width, lineStyle: style, title }));
  line(s.entry, s.side === 'BUY' ? '#22c58b' : '#f0506e', s.side === 'BUY' ? '🎯 ซื้อ' : '🎯 ขาย', LC.LineStyle.Solid);
  line(s.sl, '#f0506e', '🛑 ตัดขาดทุน', LC.LineStyle.Dotted, 1);
  (s.tps || [s.tp]).forEach((tp, k, all) => line(tp, '#e8b64c', all.length > 1 ? `💰 TP${k + 1}` : '💰 เป้าหมาย', LC.LineStyle.Dashed, 1));
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
  renderMarket(price);
  renderSignalHome();
  renderIntra();
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

// Short/mid/long trend from our own indicators, used only when investing.com's analysis is missing
function ownHorizons() {
  const key = (cs) => TA.analyze(cs).label.key.replace('-', '_');
  const mid = key(state.bars);
  const long = state.daily.length >= 30 ? key(state.daily) : mid;
  const h = (k, name) => ({ key: k, th: INV.trendTh(k), name });
  return [h(mid, 'ระยะสั้น'), h(mid, 'ระยะกลาง'), h(long, 'ระยะยาว')];
}

// ---------- Signals (recorded each weekday morning in signals.json) ----------
const money = (v) => `${v >= 0 ? '+' : '−'}$${f2(Math.abs(v))}`;
const thaiTime = (ms) => new Date(ms).toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const thaiDay = (id) => new Date(`${id}T12:00:00+07:00`).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });

async function refreshSignals() {
  try {
    const [sig, bt, intra, bt30] = await Promise.all([
      getJson('signals.json'), state.backtest ? null : getJson('backtest.json').catch(() => null),
      getJson('intraday.json').catch(() => null), state.bt30 ? null : getJson('backtest-30m.json').catch(() => null),
    ]);
    state.signals = sig.signals || [];
    if (bt) state.backtest = bt;
    if (intra) state.intra = intra;
    if (bt30) state.bt30 = bt30;
  } catch (e) { /* no signals recorded yet */ }
  renderSignalHome();
  renderIntra();
  renderStats();
}

// 15-minute candles to follow today's signal live
async function refreshM15() {
  try {
    const j = await investing(`/${PAIR_ID}/historical/chart/?interval=PT15M&pointscount=160`, 2);
    state.m15 = j.data.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
  } catch (e) { /* keep last */ }
  renderSignalHome();
}

// Recorded signals are final once scored by the morning job; until then score them live
const live = (s) => (SIG.isFinal(s) || !state.m15.length ? s : SIG.evaluate(s, state.m15, Date.now()));
const liveSignals = () => state.signals.map(live);

function nextSignalTime(now = Date.now()) {
  for (let d = 0; d < 8; d++) {
    const id = SIG.thaiDate(now + d * 864e5);
    const t = Date.parse(`${id}T07:00:00+07:00`);
    const wd = new Date(`${id}T12:00:00+07:00`).getUTCDay();
    if (t > now && wd !== 0 && wd !== 6) return t;
  }
  return null;
}

function renderSignalHome() {
  const price = state.lastPrice;
  const raw = state.signals[state.signals.length - 1];
  if (!raw) {
    $('sgSide').textContent = 'ยังไม่มีสัญญาณ';
    $('sgStatus').textContent = `สัญญาณแรกจะออก ${thaiTime(nextSignalTime())}`;
    return;
  }
  const s = live(raw);
  const buy = s.side === 'BUY';
  const final = SIG.isFinal(s);
  const isToday = s.id === SIG.thaiDate(Date.now());
  $('sgDate').textContent = `${isToday ? 'สัญญาณวันนี้' : 'สัญญาณล่าสุด'} · ${thaiDay(s.id)}`;
  if (s.status === 'skip') {
    $('sigCard').className = 'card sig skip';
    $('sgStars').textContent = '';
    $('sgSide').innerHTML = '⏸ วันนี้ไม่มีสัญญาณ';
    $('sgStatus').textContent = `ตลาดยังไม่ชัดพอ — ไม่เทรดดีกว่า · สัญญาณถัดไป ${thaiTime(nextSignalTime())}`;
    $('sgHow').innerHTML = '<li>วันที่ตลาดไม่ชัด การ “ไม่เทรด” ก็คือการรักษาเงินทุน</li><li>รอสัญญาณใหม่เช้าวันทำการถัดไป 07:00</li>';
    $('sgWhy').innerHTML = (s.why || []).map((l) => `<li>${l}</li>`).join('');
    renderMiniRecord();
    return;
  }
  $('sgStars').textContent = '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars);
  $('sigCard').className = `card sig ${buy ? 'buy' : 'sell'} st-${s.status}`;
  $('sgSide').innerHTML = `${buy ? '🟢 ซื้อ' : '🔴 ขาย'}${s.market && !final ? 'ตอนนี้' : ''} <small>${buy ? 'BUY' : 'SELL'}</small>`;
  $('sgEntry').textContent = f2(s.entry);
  $('sgSl').textContent = f2(s.sl);

  // Targets: one (older signals) or three (TP1/TP2/TP3); a tick when reached
  const tps = s.tps || [s.tp];
  const hit = s.hit || (s.closedBy === 'tp' ? tps.length : 0);
  const multi = tps.length > 1;
  $('sgTps').className = `sig-tps n${tps.length}`;
  $('sgTps').innerHTML = tps.map((tp, k) => `<div class="n tp${hit > k ? ' done' : ''}">
      <label>💰 ${multi ? `TP${k + 1}` : 'เป้าหมาย'}${hit > k ? ' ✓' : ''}</label><b class="mono">${f2(tp)}</b>
      <small>+$${f2(Math.abs(tp - s.entry))}</small></div>`).join('');

  const away = price != null ? Math.abs(price - s.entry) : null;
  const status = {
    pending: `${SIG.STATUS_TH.pending} — ต้อง${buy ? 'ลง' : 'ขึ้น'}อีก $${f2(away)} · หมดอายุ ${thaiTime(s.expiresAt)}`,
    active: hit
      ? `✅ ถึง TP${hit} แล้ว · SL เลื่อนไปที่ทุน ${f2(s.entry)} — ไม้นี้ไม่ขาดทุนแล้ว`
      : s.market
        ? `🟦 เข้าแล้วที่ ${f2(s.entry)} (${thaiTime(s.createdAt)}) · ปิดเองถ้าถึง ${thaiTime(s.expiresAt)}`
        : `${SIG.STATUS_TH.active} — เข้าที่ ${f2(s.entry)} แล้ว`,
    win: s.closedBy === 'tp' ? (multi ? '🏆 ชนะ — ครบทั้ง 3 เป้า' : `${SIG.STATUS_TH.win} — ราคาถึงเป้าหมาย`)
      : s.closedBy === 'be' ? `${SIG.STATUS_TH.win} — ถึง TP${hit} แล้วราคากลับมาที่ทุน`
        : `${SIG.STATUS_TH.win} — ปิดสิ้นวันมีกำไร${hit ? ` (ถึง TP${hit})` : ''}`,
    loss: `${SIG.STATUS_TH.loss} — ${s.closedBy === 'eod' ? 'ปิดสิ้นวันขาดทุน' : 'โดนตัดขาดทุน'}`,
    expired: `${SIG.STATUS_TH.expired} — วันนั้นไม่ได้เทรด`,
  }[s.status];
  $('sgStatus').textContent = status + (final ? ` · สัญญาณถัดไป ${thaiTime(nextSignalTime())}` : '');

  // Track: stop-loss on the left, last target on the right, entry / targets / price in between
  const far = tps[tps.length - 1];
  const pct = (v) => Math.max(0, Math.min(100, ((v - s.sl) / (far - s.sl)) * 100));
  const ePct = pct(s.entry);
  $('track').style.setProperty('--entry', `${ePct}%`);
  $('trEntry').style.left = `${ePct}%`;
  $('trTicks').innerHTML = multi ? tps.slice(0, -1).map((tp, k) => `<i class="${hit > k ? 'done' : ''}" style="left:${pct(tp)}%"><span>TP${k + 1}</span></i>`).join('') : '';
  const nowPx = final ? s.exitPrice : price;
  $('trNow').hidden = nowPx == null;
  if (nowPx != null) {
    $('trNow').style.left = `${pct(nowPx)}%`;
    $('trNowLabel').textContent = `${final ? 'ปิดที่' : 'ตอนนี้'} ${f2(nowPx)}`;
  }
  $('trLeft').textContent = `🛑 ${f2(s.sl)}`;
  $('trRight').textContent = `💰 ${multi ? `TP${tps.length} ` : ''}${f2(far)}`;

  // Open trade: profit/loss from the live price (the 15-minute candles can lag a few minutes)
  const d = buy ? 1 : -1;
  const openPart = (tps.length - hit) / tps.length;
  const pnl = s.status === 'active' && price != null ? SIG.round((s.realized || 0) + openPart * d * (price - s.entry)) : s.pnl;
  if (s.status === 'active') $('sgPnl').textContent = `กำไร/ขาดทุนตอนนี้: ${money(pnl)} ต่อ 1 ออนซ์${hit ? ` (เก็บแล้ว ${money(s.realized || 0)})` : ''}`;
  else if (s.status === 'win' || s.status === 'loss') $('sgPnl').textContent = `ผลลัพธ์: ${money(pnl)} ต่อ 1 ออนซ์`;
  else $('sgPnl').textContent = `ถ้าถึงเป้า ได้ ${money(Math.abs(s.tp - s.entry))} · ถ้าโดนตัดขาดทุน เสีย ${money(-Math.abs(s.entry - s.sl))} (ต่อ 1 ออนซ์)`;
  $('sgPnl').className = `sig-pnl ${pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}`;

  const order = s.market ? `${buy ? 'Buy' : 'Sell'} ทันที (Market)` : `${buy ? 'Buy' : 'Sell'} Limit`;
  const late = s.market && !final && price != null ? ` — ราคาตอนนี้ ${f2(price)} (ห่างจากจุดเข้า $${f2(Math.abs(price - s.entry))})` : '';
  const close = s.market ? `ถ้าถึง ${thaiTime(s.expiresAt)} ยังไม่ปิด ให้ปิดเอง` : `ถ้าถึง ${thaiTime(s.expiresAt)} ยังไม่เข้า ให้ยกเลิกคำสั่ง`;
  $('sgHow').innerHTML = [
    `เปิดออเดอร์ <b>${order}</b>${s.market ? ' ที่ราคาประมาณ' : ' ที่'} <b class="mono">${f2(s.entry)}</b>${late}`,
    `ตั้ง <b>Stop Loss</b> ที่ <b class="mono">${f2(s.sl)}</b> — เสียไม่เกิน $${f2(Math.abs(s.entry - s.sl))}/ออนซ์`,
    multi
      ? `แบ่งปิด ⅓ ที่ <b>TP1</b> <b class="mono">${f2(tps[0])}</b> · <b>TP2</b> <b class="mono">${f2(tps[1])}</b> · <b>TP3</b> <b class="mono">${f2(tps[2])}</b> — ถึง TP1 แล้วเลื่อน SL ไปที่ทุน · ${close}`
      : `ตั้ง <b>Take Profit</b> ที่ <b class="mono">${f2(s.tp)}</b> — ${close}`,
  ].map((l) => `<li>${l}</li>`).join('');
  $('sgWhy').innerHTML = (s.why || []).map((l) => `<li>${l}</li>`).join('') || '<li class="muted">—</li>';

  renderMiniRecord();
  drawSignalLines(s);
}

function renderMiniRecord() {
  const sum = SIG.summary(liveSignals());
  $('msWin').textContent = sum.wins;
  $('msLoss').textContent = sum.losses;
  $('msLine').textContent = sum.traded
    ? `อัตราชนะ ${sum.winRate}% · กำไรสะสม ${money(sum.pnl)}/ออนซ์`
    : 'เพิ่งเริ่มบันทึก — ผลจะขึ้นเมื่อสัญญาณแรกจบ';
  $('msDots').innerHTML = sum.last.map(dot).join('');
}

const dot = (s) => `<span class="dot-r ${s.status}" title="${s.id} ${SIG.STATUS_TH[s.status]}">${s.status === 'win' ? '✓' : s.status === 'loss' ? '✕' : '–'}</span>`;

function renderMarket(price) {
  $('hdrPrice').textContent = f2(price);
  $('mkPrice').textContent = f2(price);
  $('hUpdated').textContent = new Date().toLocaleTimeString('th-TH');
  const d = state.daily;
  const prev = PLAN.prevSession(d);
  if (prev) {
    const chg = price - prev.close, pct = (chg / prev.close) * 100;
    $('mkToday').textContent = `${chg >= 0 ? '▲' : '▼'} ${money(chg)} (${pct.toFixed(2)}%) จากราคาปิดวัน${prev.dayTh}`;
    $('mkToday').className = `today ${chg >= 0 ? 'up' : 'down'}`;
  }
  const h = state.tech ? EXPLAIN.horizons(state.tech, INV) : state.bars.length ? ownHorizons() : null;
  if (h) $('mkTrend').innerHTML = h.map((x) => `${x.name} ${tag(x.key, x.th)}`).join(' ');
}

// ---------- Stats tab ----------
const eqCharts = {};
function equityChart(id) {
  if (eqCharts[id]) return eqCharts[id];
  const chart = LC.createChart($(id), { ...chartBase(true), handleScroll: false, handleScale: false });
  const series = chart.addBaselineSeries({
    baseValue: { type: 'price', price: 0 }, lineWidth: 2, priceLineVisible: false,
    topLineColor: '#22c58b', topFillColor1: 'rgba(34,197,139,.25)', topFillColor2: 'rgba(34,197,139,0)',
    bottomLineColor: '#f0506e', bottomFillColor1: 'rgba(240,80,110,0)', bottomFillColor2: 'rgba(240,80,110,.25)',
  });
  fitWhenSized($(id), () => chart.timeScale().fitContent());
  return (eqCharts[id] = { chart, series });
}
function plotEquity(id, signals) {
  let total = 0;
  const pts = [];
  signals.filter((s) => s.status === 'win' || s.status === 'loss').forEach((s) => {
    total += s.pnl;
    const time = Math.floor(s.createdAt / 1000) + TZ;
    if (pts.length && pts[pts.length - 1].time >= time) return;
    pts.push({ time, value: SIG.round(total) });
  });
  $(id).hidden = pts.length < 2;
  if (pts.length < 2) return;
  const { chart, series } = equityChart(id);
  series.setData(pts);
  chart.timeScale().fitContent();
}

function tilesHtml(s) {
  const t = (label, value, cls = '', note = '') => `<div class="tile ${cls}"><label>${label}</label><b class="mono">${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;
  return [
    t('ชนะ', s.wins, 'up'),
    t('แพ้', s.losses, 'down'),
    t('อัตราชนะ', s.winRate == null ? '—' : `${s.winRate}%`),
    t('กำไรสะสม', s.traded ? money(s.pnl) : '—', s.pnl > 0 ? 'up' : s.pnl < 0 ? 'down' : '', 'ต่อ 1 ออนซ์'),
    t('ถึง TP1 · TP2 · TP3', `${s.tp1 || 0} · ${s.tp2 || 0} · ${s.tp3 || 0}`, '', 'ครั้ง'),
    t('เทรดทั้งหมด', s.traded, '', 'ครั้ง'),
  ].join('');
}

function renderStats() {
  const list = liveSignals();
  const sum = SIG.summary(list);
  $('liveTiles').innerHTML = tilesHtml(sum);
  if (list.length) $('liveSince').textContent = `บันทึกทุกสัญญาณตั้งแต่ ${thaiDay(list[0].id)} — ไม่ตัดทิ้ง ไม่แก้ย้อนหลัง`;
  plotEquity('liveChart', list);
  $('history').innerHTML = list.length ? list.slice().reverse().map((s) => {
    if (s.status === 'skip') {
      return `<div class="h-row skip"><span class="h-date">${thaiDay(s.id)}</span><span class="h-side">—</span><span class="h-px"></span><span class="h-st">${SIG.STATUS_TH.skip}</span><b class="h-pnl"></b></div>`;
    }
    const buy = s.side === 'BUY';
    const res = s.status === 'win' || s.status === 'loss' ? money(s.pnl) : '';
    return `<div class="h-row ${s.status}">
      <span class="h-date">${thaiDay(s.id)}</span>
      <span class="h-side ${buy ? 'buy' : 'sell'}">${buy ? 'ซื้อ' : 'ขาย'}</span>
      <span class="h-px mono">${f2(s.entry)}</span>
      <span class="h-st">${SIG.STATUS_TH[s.status]}${s.hit ? ` (TP${s.hit})` : ''}</span>
      <b class="h-pnl mono">${res}</b>
    </div>`;
  }).join('') : '<p class="muted">ยังไม่มีสัญญาณ</p>';

  const bt = state.backtest;
  if (bt) {
    $('btTiles').innerHTML = tilesHtml(bt.summary);
    $('btNote').innerHTML = bt.summary.pnl < 0
      ? `⚠️ ผลย้อนหลัง 1 ปี <b>ขาดทุน ${money(bt.summary.pnl)}</b>/ออนซ์ (ชนะ ${bt.summary.winRate}%) — ไม่มีระบบไหนชนะทุกช่วง ควรบริหารความเสี่ยงทุกครั้ง`
      : `ผลย้อนหลัง 1 ปี กำไร ${money(bt.summary.pnl)}/ออนซ์ (ชนะ ${bt.summary.winRate}%) — ผลในอดีตไม่รับประกันอนาคต`;
    $('btNote').className = `bt-note ${bt.summary.pnl < 0 ? 'down' : 'up'}`;
    plotEquity('btChart', bt.signals);
  }
  renderIntraStats();
}

// ---------- 30-minute signals ----------
const toBars = (rows) => rows.map((x) => ({ time: x[0], open: x[1], high: x[2], low: x[3], close: x[4] }));
const hhmm = (ms) => new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

async function refreshIntraCandles() {
  try {
    const [a, b, c] = await Promise.all(['PT30M', 'PT1H', 'PT5H'].map((iv) =>
      investing(`/${PAIR_ID}/historical/chart/?interval=${iv}&pointscount=160`, 2)));
    state.intraCandles = { m30: toBars(a.data), h1: toBars(b.data), h5: toBars(c.data) };
  } catch (e) { /* keep last */ }
  renderIntra();
}

const intraTrades = () => ((state.intra && state.intra.trades) || []).map(live);

function renderIntra() {
  const now = Date.now();
  const trades = intraTrades();
  const open = trades.find((t) => t.status === 'active');
  const dec = state.intraCandles ? INTRA.decide(state.intraCandles, now) : null;
  const next = INTRA.slotOf(now) + INTRA.SLOT;
  $('inNext').textContent = `วิเคราะห์ครั้งถัดไป ${hhmm(next)} น.`;

  let call, cls;
  if (open) {
    const buy = open.side === 'BUY';
    call = `📌 มีไม้${buy ? 'ซื้อ' : 'ขาย'}อยู่ — ถือต่อตามแผน`;
    cls = buy ? 'buy' : 'sell';
  } else if (dec && dec.dir) {
    call = `${dec.dir > 0 ? '🟢 ซื้อ' : '🔴 ขาย'}ได้ — ระบบกำลังส่งสัญญาณ (ภายในไม่กี่นาที)`;
    cls = dec.dir > 0 ? 'buy' : 'sell';
  } else {
    call = '⏸ ตอนนี้ยังไม่ควรเข้า';
    cls = 'wait';
  }
  $('intraCard').className = `card intra ${cls}`;
  $('inCall').textContent = call;

  if (dec) {
    const why = INTRA.reasons(dec);
    $('inWhy').textContent = why.slice(1).join(' · ') || (dec.dir ? 'ทั้ง 3 ช่วงเวลาชี้ไปทางเดียวกันชัดเจน' : '');
    $('inParts').innerHTML = [['30 นาที', dec.keys.m30], ['1 ชม.', dec.keys.h1], ['5 ชม.', dec.keys.h5]]
      .map(([n, k]) => `<span>${n} ${tag(k, INTRA.TREND_TH[k])}</span>`).join('')
      + `<div class="score"><div class="score-bar"><i style="left:${((dec.score + 6) / 12) * 100}%"></i><b style="left:${((INTRA.RULE.threshold + 6) / 12) * 100}%"></b><b style="left:${((6 - INTRA.RULE.threshold) / 12) * 100}%"></b></div>
          <small>คะแนน ${dec.score > 0 ? '+' : ''}${dec.score} · เข้าเมื่อถึง ±${INTRA.RULE.threshold} (ขีดขาว)</small></div>`;
  } else {
    $('inWhy').textContent = 'กำลังโหลดข้อมูลกราฟ…';
    $('inParts').innerHTML = '';
  }

  // Open trade details
  if (open) {
    const buy = open.side === 'BUY', d = buy ? 1 : -1;
    const price = state.lastPrice;
    const hit = open.hit || 0;
    const pnl = price != null ? SIG.round((open.realized || 0) + ((3 - hit) / 3) * d * (price - open.entry)) : open.pnl;
    $('inTrade').innerHTML = `<div class="in-trade">
      <div class="in-row"><span>${buy ? '🟢 ซื้อ' : '🔴 ขาย'}ที่ <b class="mono">${f2(open.entry)}</b> (${hhmm(open.createdAt)} น.)</span>
        <b class="mono ${pnl >= 0 ? 'up' : 'down'}">${money(pnl)}</b></div>
      <div class="sig-tps n3 mini">
        <div class="n sl"><label>🛑 SL${hit ? ' → ทุน' : ''}</label><b class="mono">${f2(hit ? open.entry : open.sl)}</b></div>
        ${open.tps.map((tp, k) => `<div class="n tp${hit > k ? ' done' : ''}"><label>TP${k + 1}${hit > k ? ' ✓' : ''}</label><b class="mono">${f2(tp)}</b></div>`).join('')}
      </div></div>`;
  } else $('inTrade').innerHTML = '';

  // Today's trades
  const todayId = SIG.thaiDate(now);
  const today = trades.filter((t) => t.id.startsWith(todayId));
  const done = today.filter((t) => t.status === 'win' || t.status === 'loss');
  const sum = done.reduce((a, t) => a + (t.pnl || 0), 0);
  $('inToday').innerHTML = today.length
    ? `<p class="muted small">วันนี้ ${today.length} ไม้ · ปิดแล้ว ${done.length} · ${money(SIG.round(sum))}/ออนซ์</p>
       <div class="in-chips">${today.map((t) => `<span class="chip-r ${t.status}">${hhmm(t.createdAt)} ${t.side === 'BUY' ? 'ซื้อ' : 'ขาย'} ${t.status === 'active' ? '…' : money(t.pnl)}</span>`).join('')}</div>`
    : '<p class="muted small">วันนี้ยังไม่มีไม้ — ระบบจะเข้าเมื่อทั้ง 3 ช่วงเวลาชี้ทางเดียวกันชัดเจน</p>';
}

function renderIntraStats() {
  const trades = intraTrades();
  const sum = SIG.summary(trades);
  $('inLiveTiles').innerHTML = tilesHtml(sum);
  plotEquity('inLiveChart', trades);
  $('inHistory').innerHTML = trades.length ? trades.slice().reverse().slice(0, 50).map((t) => {
    const buy = t.side === 'BUY';
    const res = t.status === 'win' || t.status === 'loss' ? money(t.pnl) : '';
    return `<div class="h-row ${t.status}">
      <span class="h-date">${thaiDay(t.id.slice(0, 10))} ${hhmm(t.createdAt)}</span>
      <span class="h-side ${buy ? 'buy' : 'sell'}">${buy ? 'ซื้อ' : 'ขาย'}</span>
      <span class="h-px mono">${f2(t.entry)}</span>
      <span class="h-st">${SIG.STATUS_TH[t.status]}${t.hit ? ` (TP${t.hit})` : ''}</span>
      <b class="h-pnl mono">${res}</b></div>`;
  }).join('') : '<p class="muted">ยังไม่มีไม้ — จะเริ่มบันทึกเมื่อสัญญาณ 30 นาทีไม้แรกออก</p>';
  const bt = state.bt30;
  if (bt) {
    $('inBtTiles').innerHTML = tilesHtml(bt.summary);
    $('inBtNote').innerHTML = `ประมาณ <b>${bt.perDay} ไม้/วัน</b> · หักสเปรด ~$0.4/ไม้ แล้วเหลือประมาณ <b>${money(SIG.round(bt.summary.pnl - 0.4 * bt.summary.traded))}</b>/ออนซ์ ใน ${bt.days} วัน`;
    plotEquity('inBtChart', bt.trades);
  }
}

function renderLevels(lv, price) {
  $('pvTf').textContent = TF_LABEL[state.tf];
  const items = lv.slice().sort((a, b) => b.price - a.price);
  const rows = items.map((x) => `<li class="${x.price > price ? 'res' : 'sup'}"><span>${INV.levelLabel(x, price)}</span><span class="mono">${f2(x.price)}</span></li>`);
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



function fitWhenSized(el, fit) {
  let lastW = 0;
  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w > 0 && w !== lastW) { lastW = w; requestAnimationFrame(fit); }
  }).observe(el);
}
fitWhenSized($('simpleChart'), () => simpleChart.timeScale().fitContent());
fitWhenSized($('mainChart'), () => {
  const n = state.bars.length;
  if (n) mainChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 6 });
});

// Refit charts when their tab becomes visible
UI.on('tab:stats', () => setTimeout(renderStats, 50));
UI.on('tab:chart', () => setTimeout(() => {
  simpleChart.timeScale().fitContent();
  const n = state.bars.length;
  if (n) mainChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 6 });
}, 50));

// Poll only while the tab is visible; catch up immediately when it becomes visible again
function every(ms, fn) {
  setInterval(() => { if (!document.hidden) fn(); }, ms);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshTech(); refreshPrice(); } });

(async function init() {
  await AUTH.ready;
  renderTechTables();
  SPLASH.step('กำลังดึงราคาทองจาก investing.com…', 45);
  const pending = [refreshSignals(), refreshM15(), refreshIntraCandles(), refreshDaily(), refreshTech().then(() => SPLASH.step('กำลังวิเคราะห์สถิติทุกกรอบเวลา…', 75)), refreshPrice()];
  await Promise.all(pending);
  render();
  UI.start();
  SPLASH.hide();
  every(POLL_PRICE, refreshPrice);
  every(POLL_TECH, refreshTech);
  every(POLL_DAILY, refreshDaily);
  every(30e3, refreshM15);
  every(5 * 60e3, refreshIntraCandles);
  every(5 * 60e3, refreshSignals);
})();
