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
const POLL_PRICE = 3000, POLL_TECH = 60000, POLL_DAILY = 60000;
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
  locked: null, lastPrice: null, chartKey: '', pivotKey: '', busy: false, zoneKey: '', signals: [], m15: [], backtest: null, intra: null, bt30: null, intraCandles: null, news: [], thb: null,
  tick: [], tickAt: 0, tickSrc: null, livePrice: null, livePrev: null, s15: null, bt15: null, stream: null,
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
  const last = bars[bars.length - 1].close;
  const off = streamFresh() ? state.livePrice - last : fresh ? spot.price - last : 0;
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
    patchChartBars(); // REST candles lag the stream: put the live price on the newest one
    if (!streamFresh()) setConn(source === 'investing' ? 'live' : 'backup',
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
  layout: { attributionLogo: logo, background: { color: 'transparent' }, textColor: '#5b6475', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 },
  grid: { vertLines: { color: '#f0f2f6' }, horzLines: { color: '#eceff4' } },
  rightPriceScale: { borderColor: '#e2e7ef', minimumWidth: 78 },
  timeScale: { borderColor: '#e2e7ef', timeVisible: true, secondsVisible: false, visible: showTime, rightOffset: 6 },
  crosshair: { mode: LC.CrosshairMode.Normal, vertLine: { color: '#9aa4b5', labelBackgroundColor: '#1c2433' }, horzLine: { color: '#9aa4b5', labelBackgroundColor: '#1c2433' } },
});

const mainChart = LC.createChart($('mainChart'), chartBase(false, true));
const rsiChart = LC.createChart($('rsiChart'), chartBase(false));
const macdChart = LC.createChart($('macdChart'), chartBase(true));

const candles = mainChart.addCandlestickSeries({
  upColor: '#0f9f6e', downColor: '#e0424f', borderVisible: false,
  wickUpColor: '#0f9f6e', wickDownColor: '#e0424f',
});
const lineOpts = (color, extra = {}) => ({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...extra });
const ema20S = mainChart.addLineSeries(lineOpts('#2f6fed', { lineWidth: 1.5 }));
const ema50S = mainChart.addLineSeries(lineOpts('#9b51e0', { lineWidth: 1.5 }));
const bbU = mainChart.addLineSeries(lineOpts('#a3acba', { lineWidth: 1, lineStyle: LC.LineStyle.Dashed }));
const bbL = mainChart.addLineSeries(lineOpts('#a3acba', { lineWidth: 1, lineStyle: LC.LineStyle.Dashed }));

const rsiS = rsiChart.addLineSeries(lineOpts('#d99a10', { lastValueVisible: true }));
rsiS.createPriceLine({ price: 70, color: '#e0424f', lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false });
rsiS.createPriceLine({ price: 30, color: '#0f9f6e', lineWidth: 1, lineStyle: LC.LineStyle.Dashed, axisLabelVisible: false });

const histS = macdChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
const macdS = macdChart.addLineSeries(lineOpts('#2f6fed', { lineWidth: 1.5 }));
const sigS = macdChart.addLineSeries(lineOpts('#f2a93b', { lineWidth: 1.5 }));

// Simple chart: a plain price line with the latest signal's entry / stop / target
const simpleChart = LC.createChart($('simpleChart'), {
  ...chartBase(true),
  handleScroll: false, handleScale: false,
  grid: { vertLines: { visible: false }, horzLines: { color: '#eceff4' } },
});
const areaS = simpleChart.addAreaSeries({
  lineColor: '#e6a100', topColor: 'rgba(240,180,41,.32)', bottomColor: 'rgba(240,180,41,.02)', lineWidth: 3,
  priceLineVisible: true, priceLineColor: '#e6a100', crosshairMarkerRadius: 5,
});
let zoneLines = [];
function drawSignalLines(s) {
  const key = `${s.id}|${s.entry}|${!!s.advisory}`;
  if (key === state.zoneKey) return;
  state.zoneKey = key;
  zoneLines.forEach((l) => areaS.removePriceLine(l));
  zoneLines = [];
  if (s.advisory) return; // overview days are not trades: no entry / stop / target lines
  const line = (price, color, title, style, width = 2) =>
    zoneLines.push(areaS.createPriceLine({ price, color, lineWidth: width, lineStyle: style, title }));
  line(s.entry, s.side === 'BUY' ? '#0f9f6e' : '#e0424f', s.side === 'BUY' ? '🎯 ซื้อ' : '🎯 ขาย', LC.LineStyle.Solid);
  line(s.sl, '#e0424f', '🛑 ตัดขาดทุน', LC.LineStyle.Dotted, 1);
  (s.tps || [s.tp]).forEach((tp, k, all) => line(tp, '#d99a10', all.length > 1 ? `💰 TP${k + 1}` : '💰 เป้าหมาย', LC.LineStyle.Dashed, 1));
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
    { price: plan.entry, color: '#d99a10', title: 'จุดเข้า', lineStyle: LC.LineStyle.Solid, lineWidth: 3 },
    { price: plan.sl, color: '#e0424f', title: 'ตัดขาดทุน', lineStyle: LC.LineStyle.Dashed },
    { price: plan.tp1, color: '#0f9f6e', title: 'เป้า 1', lineStyle: LC.LineStyle.Dashed },
    { price: plan.tp2, color: '#0f9f6e', title: 'เป้า 2', lineStyle: LC.LineStyle.Dashed },
  ]);
}

function drawPivotLines(pv) {
  const key = state.tf + pv.map((p) => p.price).join();
  if (key === state.pivotKey) return;
  state.pivotKey = key;
  setLines(pivotLines, pv.map((p) => ({
    price: p.price, title: p.name, lineStyle: LC.LineStyle.Dotted, axisLabelVisible: false,
    color: p.name === 'P' ? 'rgba(217,154,16,.8)' : p.name[0] === 'R' ? 'rgba(224,66,79,.45)' : 'rgba(15,159,110,.45)',
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
    return { time: t[i], value: h, color: h >= 0 ? (rising ? '#0f9f6e' : '#7fcfb2') : (rising ? '#f0a0a7' : '#e0424f') };
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
  markChart15();
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
  const S = streamFresh() ? state.stream : null;
  if (d.length >= 2) {
    const today = d[d.length - 1], prev = prevClose() || d[d.length - 2];
    const chg = price - prev.close, pct = (chg / prev.close) * 100;
    const c = $('chg');
    c.textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${chg >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
    c.className = `chg mono ${chg >= 0 ? 'up' : 'down'}`;
    $('dOpen').textContent = f2(today.open);
    $('dHigh').textContent = f2(Math.max(S && num(S.high) ? num(S.high) : today.high, price));
    $('dLow').textContent = f2(Math.min(S && num(S.low) ? num(S.low) : today.low, price));
    $('dPrev').textContent = f2(prev.close);
  }
  $('updated').textContent = new Date().toLocaleTimeString('th-TH');
}

// The side card's headline is ALWAYS the main system on this timeframe (chartzones.js: window.CZ_GO / CZ_SIDES) — the
// same Buy / Sell / รอก่อน and % as the Buy | Sell columns (user, 9 Oct: "อยากให้ทุกส่วนสัมพันธ์กัน"). investing.com's
// own verdict is only a small "ความเห็นภายนอก" line, and its reasons sit lower down as background.
function renderSignalHead(plan = state.lastPlan) {
  if (!plan) return;
  const g = window.CZ_GO, S = window.CZ_SIDES, inv = ACTION_TH[plan.action];
  $('signalCard').className = `card signal ${g ? (g.side > 0 ? 'BUY' : 'SELL') : 'WAIT'}`;
  $('action').textContent = g ? `${g.open ? 'ถือ ' : ''}${g.side > 0 ? 'Buy' : 'Sell'}` : 'รอก่อน';
  const main = g ? (g.open ? 'ระบบถือไม้อยู่ — ไม่ต้องเปิดไม้ใหม่' : 'ระบบถึงจุดเข้า 100%')
    : S ? `ยังไม่ถึงจุดเข้า · Buy ${S[0].pct}% · Sell ${S[1].pct}%` : 'กำลังคำนวณ…';
  $('actionSub').textContent = `${main} · ความเห็นภายนอก (investing.com): ${inv[0]}`;
}
window.renderSignalHead = renderSignalHead;

function renderSignal(plan, htfKey) {
  state.lastPlan = plan;
  $('sigTf').textContent = TF_LABEL[state.tf];
  $('sigSource').textContent = `ความเห็นภายนอก: ${plan.basis}`;
  renderSignalHead(plan);
  $('meterFill').style.width = `${plan.confidence}%`;
  const htech = state.tech && state.tech[htfKey];
  const htf = htech ? ` · ${TF_LABEL[htfKey]}: ${INV.summaryTh(htech.summary)}` : '';
  // Named after its source, so it isn't mistaken for the chart system's "ความพร้อมเข้า" % above it
  $('confText').textContent = `ความมั่นใจของ investing.com ${plan.confidence}%${htf}`;

  const box = (label, value, cls = '', note = '') =>
    `<div class="${cls}"><label>${label}</label><span class="mono">${value}</span>${note ? `<small>${note}</small>` : ''}</div>`;
  let html = '';
  // investing.com's own entry / SL / TP are not shown (they contradicted the main system's levels): only the zones
  if (plan.buyZone) html += box('จุดรอซื้อ', f2(plan.buyZone.price), 'tp', `${plan.buyZone.name}: ราคามักเด้งขึ้นแถวนี้`);
  if (plan.sellZone) html += box('จุดรอขาย', f2(plan.sellZone.price), 'sl', `${plan.sellZone.name}: ราคามักถูกกดลงแถวนี้`);
  if (plan.atr) html += box('ราคาแกว่งเฉลี่ย (ATR)', `±${f2(plan.atr)}`, 'wide', 'ต่อ 1 แท่งเทียน');
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
    const [sig, bt, intra, bt30, quota, bt15, chartSig, testStats] = await Promise.all([
      getJson('signals.json'), state.backtest ? null : getJson('backtest.json').catch(() => null),
      getJson('intraday.json').catch(() => null), state.bt30 ? null : getJson('backtest-30m.json').catch(() => null),
      getJson('quota.json').catch(() => null), state.bt15 ? null : getJson('backtest-15m.json').catch(() => null),
      getJson('chart-signals.json').catch(() => null),
      state.testStats ? null : getJson('test-stats.json').catch(() => null),
    ]);
    // One set of "ทดสอบ" numbers for every card (monthly study → test-stats.json → CHARTSYS.applyStats)
    if (testStats) { state.testStats = testStats; CHARTSYS.applyStats(testStats); }
    if (bt15) state.bt15 = bt15;
    if (chartSig) state.chartSig = chartSig;
    renderQuota(quota);
    state.signals = sig.signals || [];
    if (bt) state.backtest = bt;
    if (intra) state.intra = intra;
    if (bt30) state.bt30 = bt30;
  } catch (e) { /* no signals recorded yet */ }
  renderSignalHome();
  renderIntra();
  renderStats();
}

// Is the 30-minute system actually checking? intraday.json only changes when a trade changes, so ask
// GitHub (public repo, no key) when the price-alerts run last started/finished. Each run checks every 5 min for ~28 min.
const RUNS_URL = 'https://api.github.com/repos/tanakrthum254614-max/gold-signal/actions/workflows/price-alerts.yml/runs?per_page=3';
async function refreshBeat() {
  try {
    const r = await fetch(RUNS_URL, { cache: 'no-store' });
    if (!r.ok) return;
    const run = ((await r.json()).workflow_runs || []).find((w) => w.status === 'in_progress' || w.status === 'completed');
    if (run) state.beat = { running: run.status === 'in_progress', ok: run.status === 'in_progress' || run.conclusion === 'success', at: Date.parse(run.status === 'in_progress' ? run.run_started_at : run.updated_at) };
  } catch (e) { /* GitHub unreachable: say nothing rather than guess */ }
  renderIntra();
  renderStats();
}
// { cls, text } for the system heartbeat, or null when unknown
function showBeat(id) {
  const el = $(id), info = beatInfo(INTRA.marketOpen(Date.now()));
  el.hidden = !info;
  if (info) { el.className = `small beat ${info.cls}`; el.textContent = info.text; }
}
function beatInfo(marketOpen) {
  const b = state.beat;
  if (!b) return null;
  if (marketOpen === false) return { cls: 'muted', text: '⏸ ตลาดปิด · ระบบพัก' };
  const age = Math.round((Date.now() - b.at) / 60e3);
  if (!b.ok) return { cls: 'down', text: `⚠️ ระบบเช็กรอบล่าสุดล้มเหลว (${hhmm(b.at)} น.)` };
  if (b.running) return { cls: 'up', text: `🟢 ระบบทำงานอยู่ · เช็กทุก 5 นาที (รอบนี้เริ่ม ${hhmm(b.at)} น.)` };
  if (age <= 45) return { cls: 'up', text: `🟢 ระบบทำงานอยู่ · เช็กล่าสุด ${hhmm(b.at)} น.` };
  return { cls: 'down', text: `⚠️ ระบบไม่ได้เช็กมา ${age} นาที (ล่าสุด ${hhmm(b.at)} น.)` };
}


// LINE messages used this month (checked every morning by scripts/line-quota.js)
function renderQuota(q) {
  if (!q || q.used == null) return;
  const pct = q.limit ? Math.round((q.used / q.limit) * 100) : null;
  $('lineQuota').textContent = q.limit
    ? `📊 โควตา LINE เดือนนี้ใช้ไป ${q.used} / ${q.limit} ข้อความ (${pct}%)${pct >= 80 ? ' — ใกล้หมด' : ''} · เช็กล่าสุด ${thaiTime(q.at)}`
    : `📊 LINE เดือนนี้ส่งไป ${q.used} ข้อความ (แพ็กเกจไม่จำกัด)`;
  $('lineQuota').style.color = pct >= 80 ? 'var(--down)' : '';
}

// 15-minute candles to follow today's signal live
async function refreshM15() {
  try {
    const j = await investing(`/${PAIR_ID}/historical/chart/?interval=PT15M&pointscount=160`, 2);
    state.m15 = j.data.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
  } catch (e) {
    // investing.com unreachable: Binance PAXG (shifted to spot), times in ms like investing's
    try { state.m15 = msBars(await backupBars('15m', 160)); } catch (e2) { /* keep last */ }
  }
  if (streamFresh()) patchIntraCandles();
  renderS15.drawn = null; // redraw the card chart with the downloaded candles
  renderSignalHome();
  refresh15();
}

// Recorded signals are final once scored by the morning job; until then score them live
const live = (s) => (SIG.isFinal(s) || !state.m15.length ? s : SIG.evaluate(s, state.m15, Date.now()));
const liveSignals = () => state.signals.map(live);

function nextSignalTime(now = Date.now()) {
  for (let d = 0; d < 8; d++) {
    const id = SIG.thaiDate(now + d * 864e5);
    let t = Date.parse(`${id}T07:00:00+07:00`);
    t += SIG.marketShift(t); // 08:00 in the US winter
    const wd = new Date(`${id}T12:00:00+07:00`).getUTCDay();
    if (t > now && wd !== 0 && wd !== 6) return t;
  }
  return null;
}

function renderSignalHome() {
  const price = nowPrice();
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
    $('sgAdv').hidden = true;
    $('sgHowBox').hidden = false;
    $('sgAlertNote').hidden = false;
    $('sgStars').textContent = '';
    $('sgSide').innerHTML = '⏸ วันนี้ไม่มีสัญญาณ';
    $('sgStatus').textContent = `ตลาดยังไม่ชัดพอ — ไม่เทรดดีกว่า · สัญญาณถัดไป ${thaiTime(nextSignalTime())}`;
    $('sgHow').innerHTML = `<li>วันที่ตลาดไม่ชัด การ “ไม่เทรด” ก็คือการรักษาเงินทุน</li><li>รอสัญญาณใหม่เช้าวันทำการถัดไป ${SIG.mt(Date.now(), '07:00')}</li>`;
    $('sgWhy').innerHTML = (s.why || []).map((l) => `<li>${l}</li>`).join('');
    renderMiniRecord();
    renderDailyVsMain();
    return;
  }
  // Advisory days: a market overview, not a trade to copy (the levels are tracked for the record only)
  const advisory = !!s.advisory;
  $('sgAdv').hidden = !advisory;
  $('sgHowBox').hidden = advisory;
  $('sgAlertNote').hidden = advisory;
  $('sgStars').textContent = '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars);
  $('sigCard').className = `card sig ${buy ? 'buy' : 'sell'} st-${s.status}${advisory ? ' advisory' : ''}`;
  $('sgSide').innerHTML = advisory
    ? `🧭 เอียง${buy ? 'ขึ้น' : 'ลง'} <small>แนวโน้มวันนี้</small>`
    : `${buy ? '🟢 ซื้อ' : '🔴 ขาย'}${s.market && !final ? 'ตอนนี้' : ''} <small>${buy ? 'BUY' : 'SELL'}</small>`;
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
  $('sgStatus').textContent = (advisory ? '📝 ผลสมมติ: ' : '') + status + (final ? ` · ${advisory ? 'ภาพรวม' : 'สัญญาณ'}ถัดไป ${thaiTime(nextSignalTime())}` : '');

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
    // Near either end the label hangs inward, so it is never cut off by the card edge
    $('trNow').className = `track-now${pct(nowPx) > 80 ? ' edge-r' : pct(nowPx) < 20 ? ' edge-l' : ''}`;
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
  $('sgLot').innerHTML = final || advisory ? '' : lotHtml(Math.abs(s.entry - s.sl));

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
  renderDailyVsMain();
  drawSignalLines(s);
}

// Home record box: the 30-minute system (the main signal)
// The daily 07:00 overview against the main system (state.mainNow from renderIntra): one line under its status, and a
// ⚠️ "ขัดกับระบบหลัก — ยึดระบบหลัก" when they point different ways (or the daily side is one the main system doesn't trade)
function renderDailyVsMain() {
  const el = $('sgMain'), m = state.mainNow, raw = state.signals[state.signals.length - 1];
  if (!el) return;
  if (!m || !raw || raw.status === 'skip') { el.innerHTML = ''; return; }
  const d = raw.side === 'BUY' ? 1 : -1, mine = m.sides.find((x) => x.side === d);
  const mainDir = m.open ? (m.open.side === 'BUY' ? 1 : -1) : (m.sides.find((x) => x.go) || {}).side || 0;
  const clash = (mainDir && mainDir !== d) || !mine.tested;
  const now = m.open ? `ถือไม้${m.open.side === 'BUY' ? 'ซื้อ' : 'ขาย'}อยู่` : mainDir ? `${mainDir > 0 ? 'Buy' : 'Sell'} ✅ ควรเข้า` : `รอก่อน · Buy ${m.sides[0].pct}% · Sell ${m.sides[1].pct}%`;
  el.className = `sig-main${clash ? ' clash' : ''}`;
  el.innerHTML = `${clash ? '⚠️ <b>ขัดกับระบบหลัก — ยึดระบบหลัก</b><br>' : '🔗 '}ระบบหลัก (30 นาที) ตอนนี้: ${now}`
    + `${!mine.tested ? ` · ระบบหลักไม่เปิดฝั่ง${d > 0 ? 'ซื้อ' : 'ขาย'} (ทดสอบแล้วขาดทุน)` : ''}`;
}

function renderMiniRecord() {
  const sum = SIG.summary(intraTrades(), userSpread());
  $('msWin').textContent = sum.wins;
  $('msLoss').textContent = sum.losses;
  $('msLine').textContent = sum.traded
    ? `อัตราชนะ ${sum.winRate}% · กำไรสะสม ${money(sum.pnl)}/ออนซ์`
    : 'เพิ่งเริ่มบันทึก — ผลจะขึ้นเมื่อไม้แรกของระบบ 30 นาทีจบ';
  $('msDots').innerHTML = sum.last.map(dot).join('');
}

const dot = (s) => `<span class="dot-r ${s.status}" title="${s.id} ${SIG.STATUS_TH[s.status]}">${s.status === 'win' ? '✓' : s.status === 'loss' ? '✕' : '–'}</span>`;

// The close every "change today" figure is measured from: investing.com's previous close (from the stream,
// the same figure th.investing.com shows), else the last full weekday session
function prevClose() {
  const S = streamFresh() ? state.stream : null;
  if (S && num(S.last_close)) return { close: num(S.last_close), label: 'ราคาปิดก่อนหน้า' };
  const p = PLAN.prevSession(state.daily);
  return p ? { close: p.close, label: `ราคาปิดวัน${p.dayTh}` } : null;
}

function renderMarket(chartPrice) {
  const price = nowPrice() != null ? nowPrice() : chartPrice;
  $('hdrPrice').textContent = f2(price);
  $('mkPrice').textContent = f2(price);
  $('hUpdated').textContent = new Date().toLocaleTimeString('th-TH');
  const prev = prevClose();
  if (prev) {
    const chg = price - prev.close, pct = (chg / prev.close) * 100;
    $('mkToday').textContent = `${chg >= 0 ? '▲' : '▼'} ${money(chg)} (${pct.toFixed(2)}%) จาก${prev.label}`;
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
    baseValue: { type: 'price', price: 0 }, lineWidth: 3, priceLineVisible: false,
    topLineColor: '#0f9f6e', topFillColor1: 'rgba(15,159,110,.25)', topFillColor2: 'rgba(15,159,110,0)',
    bottomLineColor: '#e0424f', bottomFillColor1: 'rgba(224,66,79,0)', bottomFillColor2: 'rgba(224,66,79,.25)',
  });
  fitWhenSized($(id), () => chart.timeScale().fitContent());
  eqCharts[id] = { chart, series };
  applyChartTheme();
  return eqCharts[id];
}
function plotEquity(id, signals) {
  let total = 0;
  const pts = [];
  const spread = userSpread();
  signals.filter((s) => s.status === 'win' || s.status === 'loss').forEach((s) => {
    total += s.pnl - spread;
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
    t('กำไรสะสม', s.traded ? money(s.pnl) : '—', s.pnl > 0 ? 'up' : s.pnl < 0 ? 'down' : '', s.spread ? `ต่อ 1 ออนซ์ · หักสเปรด $${s.spread}/ไม้` : 'ต่อ 1 ออนซ์'),
    t('ถึง TP1 · TP2 · TP3', `${s.tp1 || 0} · ${s.tp2 || 0} · ${s.tp3 || 0}`, '', 'ครั้ง'),
    t('เทรดทั้งหมด', s.traded, '', 'ครั้ง'),
  ].join('');
}

// ---------- Live record vs backtest: expected cumulative result after n trades ± 2 standard deviations ----------
function renderLiveCheck() {
  const bt = state.bt30;
  if (!bt || !bt.trades) return;
  const sp = userSpread();
  const fin = (t) => t.status === 'win' || t.status === 'loss' || t.status === 'expired';
  const B = bt.trades.filter(fin).map((t) => t.pnl - sp);
  const avg1y = B.reduce((a, v) => a + v, 0) / B.length;
  const sd = Math.sqrt(B.reduce((a, v) => a + (v - avg1y) ** 2, 0) / B.length); // spread of results per trade (1-year replay)
  // Expected result per trade = the main test (test-stats.json, the same number as every other card); stats are after $0.4
  const off = mainSys().buy, avg = off.n ? off.pnl / off.n - (sp - 0.4) : avg1y;
  const L = intraTrades().filter(fin).sort((x, y) => x.createdAt - y.createdAt);
  const n = L.length, act = L.reduce((a, t) => a + t.pnl - sp, 0), wins = L.filter((t) => t.pnl > 0).length;
  const exp = n * avg, band = 2 * sd * Math.sqrt(n), MIN = 20;
  let st, cls;
  if (n < MIN) { st = `⏳ ผลจริงยังมี ${n} ไม้ — ต้องมีอย่างน้อย ${MIN} ไม้ถึงจะบอกได้ว่าระบบยังใช้ได้ไหม (ระบบเข้าประมาณ ${bt.perDay} ไม้/วัน)`; cls = 'wait'; }
  else if (act < exp - band) { st = `🔴 ผลจริงแย่กว่าที่ทดสอบไว้ชัดเจน (${money(act)} vs คาด ${money(exp)}) — ระบบอาจใช้ไม่ได้ในตลาดตอนนี้ ควรหยุดหรือลดขนาดไม้`; cls = 'bad'; }
  else if (act > exp + band) { st = `🟢 ผลจริงดีกว่าที่ทดสอบไว้ (${money(act)} vs คาด ${money(exp)}) — อย่าเพิ่มขนาดไม้เพราะโชคช่วงสั้น`; cls = 'good'; }
  else { st = `🟡 ผลจริงอยู่ในช่วงปกติของผลทดสอบ (${money(act)} vs คาด ${money(exp)}) — ระบบยังทำงานตามที่คาด`; cls = 'ok'; }
  $('lvStatus').className = `lv-status ${cls}`;
  $('lvStatus').textContent = st;
  const tile = (k, v, s) => `<div><span>${k}</span><b class="mono">${v}</b><small>${s}</small></div>`;
  $('lvTiles').innerHTML = tile('ไม้จริง', n, n ? `ตั้งแต่ ${tradeDay(L[0])}` : 'ยังไม่มี')
    + tile('ชนะจริง', n ? `${Math.round((wins / n) * 100)}%` : '—', `ทดสอบ ${off.win}%`)
    + tile('ต่อไม้จริง', n ? money(act / n) : '—', `ทดสอบ ${money(avg)}`)
    + tile('รวมจริง', n ? money(act) : '—', n ? `ช่วงปกติ ${money(exp - band)} ถึง ${money(exp + band)}` : `หลัง 20 ไม้ ช่วงปกติ ${money(20 * avg - 2 * sd * Math.sqrt(20))} ถึง ${money(20 * avg + 2 * sd * Math.sqrt(20))}`);
  // Chart: expected line + ±2σ band over the next trades, live cumulative on top
  const N = Math.max(40, Math.ceil(n * 1.25)), W = 600, H = 220;
  const lo = Math.min(avg * N - 2 * sd * Math.sqrt(N), 0, act) - 5, hi = Math.max(avg * N + 2 * sd * Math.sqrt(N), 0, act) + 5;
  const X = (i) => (i / N) * W, Y = (v) => H - ((v - lo) / (hi - lo)) * H;
  const up = [], dn = [];
  for (let i = 0; i <= N; i++) { up.push(`${X(i).toFixed(1)},${Y(i * avg + 2 * sd * Math.sqrt(i)).toFixed(1)}`); dn.unshift(`${X(i).toFixed(1)},${Y(i * avg - 2 * sd * Math.sqrt(i)).toFixed(1)}`); }
  let cum = 0; const live = [`${X(0)},${Y(0)}`, ...L.map((t, i) => { cum += t.pnl - sp; return `${X(i + 1).toFixed(1)},${Y(cum).toFixed(1)}`; })];
  $('lvChart').innerHTML = `<polygon class="band" points="${up.join(' ')} ${dn.join(' ')}"/>
    <line class="zero" x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}"/>
    <line class="exp" x1="0" y1="${Y(0)}" x2="${W}" y2="${Y(N * avg)}"/>
    ${n ? `<polyline class="live" points="${live.join(' ')}"/><circle class="live-dot" r="4" cx="${X(n)}" cy="${Y(act)}"/>` : ''}`;
  $('lvChart').setAttribute('aria-label', `ไม้ที่ 0 ถึง ${N}: เส้นประ = คาด ${money(avg)} ต่อไม้, แถบ = ช่วงปกติ 95%`);
  // The market lately, in the backtest itself: the best warning we have before live data builds up
  const recent = (days) => { const from = Date.now() - days * 864e5, a = bt.trades.filter((t) => fin(t) && t.createdAt >= from);
    return { n: a.length, win: a.length ? Math.round((a.filter((t) => t.pnl > 0).length / a.length) * 100) : 0, pnl: a.reduce((s, t) => s + t.pnl - sp, 0) }; };
  const r30 = recent(30), r90 = recent(90);
  let streak = 0, worst = 0;
  bt.trades.filter(fin).forEach((t) => { streak = t.pnl < 0 ? streak + 1 : 0; worst = Math.max(worst, streak); });
  const cl = (v) => (v >= 0 ? 'up' : 'down');
  $('lvRecent').innerHTML = `<p class="muted small lv-legend">กราฟ: แกนนอน = ไม้ที่ 0 → ${N} · เส้นประ = คาด ${money(avg)}/ไม้ · แถบเทา = ช่วงปกติ (95%) · เส้นทอง = ผลจริงสะสม</p>
    <p class="lv-rec">📉 <b>ช่วงล่าสุดในผลทดสอบ</b> (ตลาดช่วงเดียวกัน): 30 วัน ${r30.n} ไม้ · ชนะ ${r30.win}% · <b class="${cl(r30.pnl)}">${money(r30.pnl)}</b> · 90 วัน ${r90.n} ไม้ · ชนะ ${r90.win}% · <b class="${cl(r90.pnl)}">${money(r90.pnl)}</b> · แพ้ติดกันยาวสุดในรอบปี ${worst} ไม้
    ${r90.pnl < 0 ? '<br>⚠️ ช่วง 90 วันล่าสุดระบบขาดทุนในการทดสอบ — ตลาดตอนนี้ไม่เข้าทางระบบ ถ้าจะเทรดตาม ใช้ขนาดไม้เล็กกว่าปกติ' : ''}</p>`;
  // Home: one line that links here
  $('lvStrip').hidden = false;
  $('lvStrip').className = `lv-strip ${cls}`;
  $('lvStrip').innerHTML = `🧪 <b>ระบบยังใช้ได้ไหม?</b> ${n < MIN ? `ผลจริง ${n}/${MIN} ไม้ — ยังสรุปไม่ได้` : cls === 'bad' ? 'แย่กว่าที่ทดสอบไว้ — ระวัง' : cls === 'good' ? 'ดีกว่าที่ทดสอบไว้' : 'อยู่ในช่วงปกติ'} · 90 วันล่าสุดในการทดสอบ <b class="${cl(r90.pnl)}">${money(r90.pnl)}</b> <span>ดูรายละเอียด →</span>`;
}

// ---------- Stats: every recorded trade on the price chart, drawn like the chart tab (user, 9 Oct: stats had numbers
// only; then "ดูธรรมดามาก"). Pick a timeframe (default 30m = the main system): each trade gets a "Buy 4,144.73" tag
// under its entry candle, gold / green / red segments for entry, TP, SL up to the exit with ✓ / ✗, and a result chip.
// Tap a trade card → the chart moves to it with its lines and a sentence on how it went. ----------
let tcView = null;
const tcBars = {}; // tf → { at, bars }
function tcTrades(tf) {
  return ((state.chartSig && state.chartSig.trades) || []).filter((t) => t.tf === tf).map(live).sort((a, b) => b.createdAt - a.createdAt);
}
// The candle a moment falls in (bars: UTC seconds, ascending) → its index, or -1 when before the loaded window
function tcBarAt(bars, ms) {
  const s = ms / 1000;
  let lo = 0, hi = bars.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m].time <= s) { k = m; lo = m + 1; } else hi = m - 1; }
  return k;
}
function tcHow(t) {
  if (t.status === 'active') return t.hit ? `ถึง TP${t.hit} แล้ว (SL ที่ทุน) — ยังถือ` : 'กำลังถือ';
  if (t.status === 'win') return t.closedBy === 'tp' || t.hit ? `✅ ถึง TP${t.hit || 1}` : '✅ หมดเวลา ปิดมีกำไร';
  if (t.status === 'loss') return t.closedBy === 'sl' ? '❌ โดน SL' : '❌ หมดเวลา ปิดขาดทุน';
  return SIG.STATUS_TH[t.status] || t.status;
}
const tcDur = (ms) => { const m = Math.round(ms / 60e3); return m < 60 ? `${m} นาที` : m < 2880 ? `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ''}` : `${Math.round(m / 1440)} วัน`; };
const tcWhen = (ms) => new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

// Tags and segments over the chart (same classes as the chart tab: cz-tag / cz-seg / cz-lv)
function tcDraw() {
  if (!tcView) return;
  const v = tcView, ts = v.chart.timeScale(), W = v.el.clientWidth - v.chart.priceScale('right').width();
  if (W <= 0) return;
  const y = (p) => v.series.priceToCoordinate(p), sp = userSpread();
  const html = v.items.map((g) => {
    const x = ts.timeToCoordinate(g.t);
    if (x == null || x < 0 || x > W) return '';
    const py = y(g.price);
    const tag = py == null ? '' : `<div class="cz-tag ${g.buy ? 'buy' : 'sell'}${g.sel ? ' tc-sel' : ''}" style="left:${x}px;top:${g.buy ? py + 26 : py - 26}px">${g.buy ? 'Buy' : 'Sell'} ${f2(g.entry)}</div>`;
    if (g.t1 == null) return tag;
    let x1 = ts.timeToCoordinate(g.t1);
    if (x1 == null) return tag;
    const x0 = Math.max(0, x), xe = Math.min(W, Math.max(x1, x0 + 28));
    const ln = (p, cls, label) => { const yy = y(p); return yy == null ? '' : `<div class="cz-seg ${cls}" style="left:${x0}px;width:${xe - x0}px;top:${yy}px"></div>${label ? `<span class="cz-lv ${cls}" style="left:${xe + 3}px;top:${yy}px">${label}</span>` : ''}`; };
    const res = `<span class="tc-res ${g.pnl >= 0 ? 'up' : 'down'}" style="left:${xe + 3}px;top:${y(g.exitPx) ?? py}px">${g.pnl >= 0 ? '✅' : '❌'} ${money(g.pnl - sp)}</span>`;
    return ln(g.entry, 'en', '') + ln(g.sl, 'sl', g.closedBy === 'sl' ? `SL ${f2(g.sl)} ✗` : '') + g.tps.map((p, k) => ln(p, 'tp', g.hit > k ? `TP${k + 1} ${f2(p)} ✓` : '')).join('') + res + tag;
  }).join('');
  if (html !== v.html) { v.html = html; v.el.innerHTML = html; }
}

// The view a timeframe opens on, applied once the chart has a width: set while the stats tab is hidden (width 0) the
// chart fell back to its smallest bar spacing and kept it, so the candles showed as a thin strip on the right (9 Oct)
function tcApplyRange() {
  if (!tcView || !tcView.want || !$('tcChart').clientWidth) return;
  tcView.chart.timeScale().setVisibleLogicalRange(tcView.want);
  tcView.want = null;
}

async function renderTradeChart() {
  if (!$('tcCard') || !window.CHARTSYS) return;
  state.tc = state.tc || { tf: MAIN_TF, sel: null };
  const tf = state.tc.tf, sys = CHARTSYS.SYS[tf], sp = userSpread();
  const all = (state.chartSig && state.chartSig.trades) || [];
  $('tcTfs').innerHTML = Object.keys(CHARTSYS.SYS).map((k) => {
    const n = all.filter((t) => t.tf === k).length;
    return `<button type="button" class="tc-tf${k === tf ? ' on' : ''}" data-tf="${k}">${TF_LABEL[k]}${k === MAIN_TF ? ' ⭐' : ''}<small>${n} ไม้</small></button>`;
  }).join('');
  document.querySelectorAll('#csTable .st-tf').forEach((c) => c.classList.toggle('on', c.dataset.tf === tf));
  const trades = tcTrades(tf), s = SIG.summary(trades, sp);
  const test = [sys.buy && `BUY ${sys.buy.win}%`, sys.sell && `SELL ${sys.sell.win}%`].filter(Boolean).join(' · ');
  const old = tf === MAIN_TF ? SIG.summary(oldIntraTrades(), sp) : null;
  $('tcSum').innerHTML = `<b>${TF_LABEL[tf]}${tf === MAIN_TF ? ' (ระบบหลัก)' : ''}</b> · ${s.traded ? `ปิดแล้ว ${s.traded} ไม้ · ชนะ ${s.wins} แพ้ ${s.losses} (${s.winRate}%) · <b class="${s.pnl >= 0 ? 'up' : 'down'}">${money(s.pnl)}</b>/ออนซ์` : 'ยังไม่มีไม้ที่ปิดแล้ว'}`
    + ` · ทดสอบ ${test}${s.traded && s.traded < 20 ? ' · <span class="muted">ยังน้อยกว่า 20 ไม้</span>' : ''}`
    + (old && old.traded ? `<br><small class="muted">ระบบ 30 นาทีแบบเดิม (TP $15/20/30 · ถึง 9 ต.ค. 2569): ${old.traded} ไม้ · ชนะ ${old.wins}–${old.losses} (${old.winRate}%) · ${money(old.pnl)} — ไม่นับรวม</small>` : '');
  $('tcListTf').textContent = `· ${TF_LABEL[tf]}`;

  // Candles of that timeframe (cached 2 minutes)
  const c = tcBars[tf];
  if (!c || Date.now() - c.at > 120e3) {
    try { tcBars[tf] = { at: Date.now(), bars: (await loadBars(tf)).bars }; } catch (e) { tcBars[tf] = { at: Date.now(), bars: (c && c.bars) || [] }; }
    if (state.tc.tf !== tf) return; // switched while loading
  }
  const bars = tcBars[tf].bars;
  if (!tcView) {
    const host = $('tcChart');
    const chart = LC.createChart(host, chartBase(true));
    const series = chart.addCandlestickSeries({ upColor: '#0f9f6e', downColor: '#e0424f', borderVisible: false, wickUpColor: '#0f9f6e', wickDownColor: '#e0424f' });
    host.style.position = 'relative';
    const el = document.createElement('div'); el.className = 'pbox-layer cz-decor'; host.appendChild(el);
    tcView = { chart, series, el, lines: [], key: '', items: [] };
    chart.timeScale().subscribeVisibleLogicalRangeChange(tcDraw);
    new ResizeObserver(() => { tcApplyRange(); tcDraw(); }).observe(host);
    applyChartTheme();
  }
  const key = `${tf}|${bars.length}|${bars.length ? bars[bars.length - 1].time : 0}`;
  if (key !== tcView.key) {
    tcView.series.setData(bars.map((b) => ({ time: b.time + TZ, open: b.open, high: b.high, low: b.low, close: b.close })));
    // A new timeframe opens on the latest ~120 candles (all of them squeezed the trade tags into a pile)
    if (!tcView.key.startsWith(`${tf}|`)) { tcView.want = { from: Math.max(0, bars.length - 120), to: bars.length + 4 }; tcApplyRange(); }
    tcView.key = key;
  }
  // What to draw: every trade inside the loaded candles
  tcView.items = trades.map((t) => {
    const i = tcBarAt(bars, t.createdAt);
    if (i < 0) return null;
    const buy = t.side === 'BUY', done = SIG.isFinal(t) && t.exitAt, j = done ? tcBarAt(bars, t.exitAt) : -1;
    return { id: t.id, t: bars[i].time + TZ, t1: done && j >= 0 ? bars[j].time + TZ : null, buy, entry: t.entry, sl: t.sl, tps: t.tps || [], hit: t.hit || 0,
      closedBy: t.closedBy, pnl: t.pnl, exitPx: t.closedBy === 'sl' ? t.sl : t.hit ? t.tps[t.hit - 1] : t.entry, price: buy ? bars[i].low : bars[i].high, sel: t.id === state.tc.sel };
  }).filter(Boolean);
  tcView.html = null;
  tcDraw();
  const shown = tcView.items.length;

  // Trade cards: newest first, tap → show on the chart
  $('tcList').innerHTML = trades.length ? trades.slice(0, 40).map((t) => {
    const buy = t.side === 'BUY', fin = SIG.isFinal(t), pnl = fin ? t.pnl - sp : null;
    return `<button type="button" class="tc-card ${fin ? (pnl >= 0 ? 'win' : 'loss') : 'open'}${state.tc.sel === t.id ? ' sel' : ''}" data-id="${t.id}">
      <span class="tc-side ${buy ? 'buy' : 'sell'}">${buy ? '▲ BUY' : '▼ SELL'}</span>
      <span class="tc-px mono">${f2(t.entry)}</span>
      <b class="tc-pnl mono">${fin ? money(pnl) : 'ถืออยู่'}</b>
      <span class="tc-when">${tcWhen(t.createdAt)}</span>
      <span class="tc-how">${tcHow(t)}</span>
    </button>`;
  }).join('') : `<p class="muted tc-empty">ยังไม่มีไม้ในกรอบ ${TF_LABEL[tf]}<br><small>ระบบเข้าเมื่อคะแนนถึงเกณฑ์${sys.buy && sys.buy.confirm ? ` และ ${CHARTSYS.CONFIRM[sys.buy.confirm].name} ยืนยัน` : ''} · ไม่มีไม้ไม่ได้แปลว่าระบบหยุด</small></p>`;
  $('tcNote').textContent = trades.length && shown < trades.length
    ? `กราฟแสดงช่วงล่าสุด ${bars.length} แท่ง — เห็นบนกราฟ ${shown} จาก ${trades.length} ไม้ (ไม้เก่ากว่านั้นดูในรายการ)` : '';
  tcSelect(state.tc.sel && trades.find((t) => t.id === state.tc.sel));
}

// Show one trade: its lines, the chart moved to it, and a sentence on how it went
function tcSelect(t) {
  if (!tcView) return;
  tcView.lines.forEach((l) => tcView.series.removePriceLine(l));
  tcView.lines = [];
  tcView.items.forEach((g) => { g.sel = !!t && g.id === t.id; });
  tcView.html = null; tcDraw();
  if (!t) { $('tcDetail').innerHTML = '<span class="muted">👉 กดไม้ในรายการ เพื่อดูจุดเข้า SL และ TP บนกราฟ และดูว่าไม้นั้นจบยังไง</span>'; return; }
  const buy = t.side === 'BUY', sp = userSpread(), hit = t.hit || 0;
  const line = (price, color, title, style) => tcView.lines.push(tcView.series.createPriceLine({ price, color, title, lineWidth: 2, lineStyle: style, axisLabelVisible: true }));
  line(t.entry, '#d99a10', buy ? 'เข้าซื้อ' : 'เข้าขาย', LC.LineStyle.Solid);
  line(t.sl, '#e0424f', 'SL', LC.LineStyle.Dashed);
  t.tps.forEach((v, k) => line(v, '#0f9f6e', `TP${k + 1}`, LC.LineStyle.Dashed));
  const bars = tcBars[t.tf] ? tcBars[t.tf].bars : [];
  const i = tcBarAt(bars, t.createdAt), j = SIG.isFinal(t) && t.exitAt ? tcBarAt(bars, t.exitAt) : bars.length - 1;
  if (i >= 0) tcView.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, i - 30), to: Math.max(j, i) + 12 });
  const risk = Math.abs(t.entry - t.sl);
  const now = nowPrice(), open = !SIG.isFinal(t) && now != null ? SIG.round((buy ? 1 : -1) * (now - t.entry)) : null;
  $('tcDetail').innerHTML = `${buy ? '🟢 ซื้อ' : '🔴 ขาย'} <b class="mono">${f2(t.entry)}</b> เมื่อ ${tcWhen(t.createdAt)}`
    + ` · SL <b class="mono">${f2(t.sl)}</b> (−$${f2(risk)}) · ${t.tps.map((v, k) => `TP${k + 1} <b class="mono">${f2(v)}</b>`).join(' · ')}`
    + (t.score != null ? ` · คะแนนตอนเข้า ${t.score > 0 ? '+' : ''}${t.score}` : '')
    + `<br>${SIG.isFinal(t)
      ? `${tcHow(t)} เมื่อ ${tcWhen(t.exitAt || t.expiresAt)} (ถือ ${tcDur((t.exitAt || t.expiresAt) - t.createdAt)}) → <b class="${t.pnl >= 0 ? 'up' : 'down'}">${money(t.pnl - sp)}</b>/ออนซ์ หักสเปรดแล้ว${hit ? ` · ถึง TP${hit}` : ''}`
      : `${tcHow(t)}${open != null ? ` · ตอนนี้ <b class="${open >= 0 ? 'up' : 'down'}">${money(open)}</b>/ออนซ์` : ''} · ปิดเองไม่เกิน ${tcWhen(t.expiresAt)}`}`
    + `${t.paused ? '<br><span class="muted">ไม้นี้เข้าตอนระบบพักแจ้ง — บันทึกไว้แต่ไม่ได้ส่ง LINE</span>' : ''}`;
}

function bindTradeChart() {
  if (!$('tcCard') || bindTradeChart.done) return;
  bindTradeChart.done = true;
  const pick = (tf) => { state.tc = { tf, sel: null }; renderTradeChart(); };
  $('tcTfs').addEventListener('click', (e) => { const b = e.target.closest('[data-tf]'); if (b) pick(b.dataset.tf); });
  $('tcList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    state.tc.sel = b.dataset.id;
    document.querySelectorAll('#tcList .tc-card').forEach((r) => r.classList.toggle('sel', r.dataset.id === b.dataset.id));
    tcSelect(tcTrades(state.tc.tf).find((t) => t.id === b.dataset.id));
    if (innerWidth < 900) $('tcChart').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('tcOpen').addEventListener('click', () => { location.hash = 'chart'; setTf(state.tc.tf); });
  // Timeframe cards: the card → its trades on the chart above; "กราฟ ›" → the chart tab
  $('csTable').addEventListener('click', (e) => {
    const go = e.target.closest('[data-chart]');
    if (go) { location.hash = 'chart'; setTf(go.dataset.chart); return; }
    const c = e.target.closest('[data-tf]');
    if (!c) return;
    pick(c.dataset.tf);
    $('tcCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// Live record of every chart timeframe (scripts/chart-run.js) as cards: real win rate on a bar next to the test,
// trades, result, holding, brake. Tap a card → its trades on the stats chart above; "กราฟ ›" → the chart tab.
function renderChartSignals() {
  const el = $('csTable'), cs = state.chartSig;
  if (!el || !window.CHARTSYS) return;
  if (!cs) { el.innerHTML = '<p class="muted">ยังโหลดบันทึกไม่ได้</p>'; return; }
  const sp = userSpread(), sel = state.tc ? state.tc.tf : MAIN_TF;
  el.innerHTML = Object.entries(CHARTSYS.SYS).map(([tf, sys]) => {
    const tr = cs.trades.filter((t) => t.tf === tf).map(live), s = SIG.summary(tr, sp), open = tr.find((t) => !SIG.isFinal(t)); // live: same as the hero + chart
    const br = CHARTSYS.brake(sys, tr, Date.now());
    const sides = [['BUY', sys.buy], ['SELL', sys.sell]].filter(([, c]) => c);
    const test = Math.round(sides.reduce((a, [, c]) => a + c.win, 0) / sides.length);
    const conf = sides.filter(([, c]) => c.confirm).map(([side, c]) => `${side} + ${CHARTSYS.CONFIRM[c.confirm].name}`).join(' · ');
    const tone = !s.traded ? '' : s.traded < 20 ? 'few' : s.winRate >= test - 5 ? 'good' : 'bad';
    return `<button type="button" class="st-tf ${tone}${tf === sel ? ' on' : ''}${tf === MAIN_TF ? ' main' : ''}" data-tf="${tf}">
      <div class="st-tf-head"><b>${TF_LABEL[tf]}${tf === MAIN_TF ? ' ⭐' : ''}</b><span class="${br ? 'down' : 'up'}">${br ? '⛔ พัก' : '✅ ทำงาน'}</span></div>
      <div class="st-tf-win"><b class="mono">${s.traded ? `${s.winRate}%` : '—'}</b><small>ชนะจริง</small></div>
      <div class="st-bar" title="ชนะจริง ${s.traded ? s.winRate : 0}% · ทดสอบ ${test}%"><i style="width:${s.traded ? s.winRate : 0}%"></i><em style="left:${test}%"></em></div>
      <div class="st-tf-meta"><span>ทดสอบ ${sides.map(([k, c]) => `${k} ${c.win}%`).join(' · ')}</span></div>
      <div class="st-tf-foot"><span>${s.traded} ไม้ · ${s.wins}–${s.losses}</span><b class="mono ${s.pnl > 0 ? 'up' : s.pnl < 0 ? 'down' : ''}">${s.traded ? money(s.pnl) : '—'}</b></div>
      ${open ? `<div class="st-tf-open">📌 ถือ${open.side === 'BUY' ? 'ซื้อ' : 'ขาย'} ${f2(open.entry)}</div>` : ''}
      ${conf ? `<div class="st-tf-conf">+ ตัวยืนยัน: ${conf}</div>` : ''}
      <span class="st-tf-go" data-chart="${tf}">กราฟ ›</span>
    </button>`;
  }).join('');
  $('csFoot').textContent = `เริ่มบันทึก ${new Date(cs.startedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })} · หักสเปรด $${sp}/ไม้ · แถบ = ชนะจริง, ขีด = ผลทดสอบ · แจ้ง LINE กรอบ 30 นาที (ระบบหลัก) · 1 ชม. · 5 ชม. · 1 วัน · 1 สัปดาห์ · ⛔ พัก = แพ้ติดกัน 5 ไม้ หรือ 20 ไม้ล่าสุดชนะน้อยกว่าผลทดสอบเกิน 12% → หยุดแจ้ง แต่ยังบันทึกต่อ`;
}

// Headline numbers of the main system (30m): result, win rate vs test, trades, holding, status
function renderStatsHero() {
  const el = $('stKpis');
  if (!el || !window.CHARTSYS) return;
  const sp = userSpread(), trades = intraTrades(), s = SIG.summary(trades, sp), sys = mainSys(), test = sys.buy.win;
  const open = trades.find((t) => t.status === 'active'), br = CHARTSYS.brake(sys, trades, Date.now());
  const price = nowPrice(), openPnl = open && price != null ? SIG.round((open.side === 'BUY' ? 1 : -1) * (price - open.entry)) : null;
  // cumulative result for the sparkline
  let cum = 0; const pts = [0, ...trades.filter((t) => SIG.isFinal(t)).sort((a, b) => a.createdAt - b.createdAt).map((t) => (cum += t.pnl - sp))];
  const lo = Math.min(...pts, 0), hi = Math.max(...pts, 0) || 1, X = (i) => (i / Math.max(1, pts.length - 1)) * 120, Y = (v) => 34 - ((v - lo) / (hi - lo || 1)) * 30;
  const spark = pts.length > 1 ? `<svg class="st-spark" viewBox="0 0 120 36" preserveAspectRatio="none"><polyline points="${pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/></svg>` : '';
  const R = 26, C = 2 * Math.PI * R, w = s.traded ? s.winRate : 0;
  const ring = `<svg class="st-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" class="bg"/><circle cx="32" cy="32" r="${R}" class="fg ${!s.traded ? '' : w >= test - 5 ? 'up' : 'down'}" stroke-dasharray="${(w / 100) * C} ${C}"/><line x1="32" y1="2" x2="32" y2="10" class="mark" transform="rotate(${(test / 100) * 360} 32 32)"/></svg>`;
  const kpi = (cls, label, big, sub, extra = '') => `<div class="st-kpi ${cls}"><span class="st-kpi-l">${label}</span><b class="mono">${big}</b><small>${sub}</small>${extra}</div>`;
  el.innerHTML = [
    kpi(`big ${s.pnl > 0 ? 'up' : s.pnl < 0 ? 'down' : ''}`, '💰 กำไรสะสม (หักสเปรด)', s.traded ? money(s.pnl) : '$0.00', s.traded ? `ต่อ 1 ออนซ์ (0.01 lot) · 0.10 lot = ${money(s.pnl * 10)}` : 'ยังไม่มีไม้ที่ปิด — ระบบหลักเพิ่งเริ่มบันทึก 9 ต.ค.', spark),
    kpi('ringk', '🎯 อัตราชนะจริง', s.traded ? `${s.winRate}%` : '—', `ผลทดสอบ ${test}% (ขีดบนวง)${s.traded && s.traded < 20 ? ' · ยังน้อย' : ''}`, ring),
    kpi('', '🧾 ไม้ที่ปิดแล้ว', String(s.traded), `ชนะ ${s.wins} · แพ้ ${s.losses}${s.traded < 20 ? ` · อีก ${20 - s.traded} ไม้ถึงสรุปได้` : ''}`),
    kpi(open ? (open.side === 'BUY' ? 'up' : 'down') : '', '📌 ไม้ที่ถืออยู่', open ? `${open.side === 'BUY' ? 'ซื้อ' : 'ขาย'} ${f2(open.entry)}` : 'ไม่มี', open ? `ตอนนี้ ${openPnl != null ? money(openPnl) : '—'} · SL ${f2(open.sl)} · TP ${f2(open.tps[0])}` : 'รอสัญญาณถัดไป'),
    kpi(br ? 'down' : 'up', '🛡️ สถานะระบบ', br ? '⛔ พัก' : '✅ ทำงาน', br ? br.why : 'แจ้ง LINE ทุกไม้ · เช็กทุก 5 นาที'),
  ].join('');
}

function renderStats() {
  renderLiveCheck();
  const list = liveSignals();
  const sum = SIG.summary(list, userSpread());
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
    const b = SIG.summary(bt.signals, userSpread());
    $('btTiles').innerHTML = tilesHtml(b);
    $('btNote').innerHTML = b.pnl < 0
      ? `⚠️ ผลย้อนหลัง 1 ปี <b>ขาดทุน ${money(b.pnl)}</b>/ออนซ์ หลังหักสเปรด (ชนะ ${b.winRate}%) — ไม่มีระบบไหนชนะทุกช่วง ควรบริหารความเสี่ยงทุกครั้ง`
      : `ผลย้อนหลัง 1 ปี กำไร ${money(b.pnl)}/ออนซ์ หลังหักสเปรด (ชนะ ${b.winRate}%) — ผลในอดีตไม่รับประกันอนาคต`;
    $('btNote').className = `bt-note ${b.pnl < 0 ? 'down' : 'up'}`;
    plotEquity('btChart', bt.signals);
  }
  renderIntraStats();
  renderStatsHero();
  bindTradeChart();
  renderTradeChart();
}

// ---------- Live stream: investing.com's own price stream (SockJS, ~1 tick a second) ----------
// The same feed th.investing.com uses for its live quote. Not behind the Cloudflare check that sometimes
// blocks the REST API, so it keeps the price live even when the candles come from the backup source.
const STREAM = { ws: null, lastTick: 0, retry: 0, timer: 0 };
const streamFresh = () => Date.now() - STREAM.lastTick < 10e3;

function startStream() {
  if (STREAM.ws && STREAM.ws.readyState <= 1) return;
  let ws;
  try {
    ws = new WebSocket(`wss://streaming.forexpros.com/echo/${Math.floor(Math.random() * 1000)}/${Math.random().toString(36).slice(2, 10)}/websocket`);
  } catch (e) { return retryStream(); }
  STREAM.ws = ws;
  const send = (obj) => ws.send(JSON.stringify([JSON.stringify(obj)]));
  ws.onmessage = (e) => {
    const d = String(e.data);
    if (d === 'o') { send({ _event: 'bulk-subscribe', tzID: 8, message: `pid-${PAIR_ID}:` }); STREAM.retry = 0; return; }
    if (d[0] !== 'a') return; // 'h' = server heartbeat
    JSON.parse(d.slice(1)).forEach((m) => {
      try {
        const msg = JSON.parse(m).message || '';
        if (msg.startsWith(`pid-${PAIR_ID}::`)) onStreamTick(JSON.parse(msg.slice(msg.indexOf('::') + 2)));
      } catch (err) { /* ignore a malformed frame */ }
    });
  };
  ws.onclose = retryStream;
  ws.onerror = () => ws.close();
}
function retryStream() {
  STREAM.ws = null;
  clearTimeout(STREAM.timer);
  STREAM.timer = setTimeout(startStream, Math.min(30e3, 2000 * 2 ** STREAM.retry++));
}
// Keep-alive, as investing.com's own page does
setInterval(() => {
  if (STREAM.ws && STREAM.ws.readyState === 1) STREAM.ws.send(JSON.stringify([JSON.stringify({ _event: 'heartbeat', data: 'h' })]));
}, 25e3);

const num = (s) => (s == null ? null : +String(s).replace(/,/g, ''));

// Put the live price on the chart's newest candle (a new candle when its period has rolled over)
const TF_MS = { '5m': 5 * 60e3, '15m': 15 * 60e3, '30m': 30 * 60e3, '1h': 3600e3, '5h': 5 * 3600e3, '1d': 864e5, '1w': 7 * 864e5 };
function patchChartBars(now = Date.now()) {
  const bars = state.bars, price = state.livePrice;
  if (!bars.length || price == null || !streamFresh()) return false;
  const dur = TF_MS[state.tf], last = bars[bars.length - 1];
  const start = last.time * 1000; // chart candles are in seconds
  if (now < start + dur || state.tf === '1d' || state.tf === '1w') {
    last.close = price; last.high = Math.max(last.high, price); last.low = Math.min(last.low, price);
  } else if (now < start + 2 * dur) {
    bars.push({ time: (start + dur) / 1000, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price });
    bars.shift();
    return 'new';
  } else return false; // candles too old (market closed / data gap): wait for the next download
  return true;
}

// Cheap per-tick chart update: only the newest candle and the trader-view price
function chartTick() {
  const c = state.bars[state.bars.length - 1], t = c.time + TZ;
  candles.update({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
  areaS.update({ time: t, value: c.close });
  renderQuote(c.close);
  $('mkPrice').textContent = f2(c.close);
}

function onStreamTick(p) {
  const price = p.last_numeric;
  if (!(price > 0)) return;
  const now = Date.now();
  STREAM.lastTick = now;
  state.stream = p;
  state.livePrice = price;
  state.tickAt = now;
  state.tickSrc = 'stream';
  // Fold the tick into the 1-minute bars behind the sparkline (times in seconds, like investing's)
  const t = Math.floor(now / 60e3) * 60, bars = state.tick, last = bars[bars.length - 1];
  if (last && last.time === t) {
    last.close = price; last.high = Math.max(last.high, price); last.low = Math.min(last.low, price);
  } else if (!last || t > last.time) {
    bars.push({ time: t, open: price, high: price, low: price, close: price });
    if (bars.length > 90) bars.shift();
  }
  patchIntraCandles(now);
  s15Tick();
  renderLive();
  // Every tick: the chart's newest candle and the trader-view price, so every number on the page matches
  const patched = patchChartBars(now);
  if (patched === 'new') render();
  else if (patched) chartTick();
  // The heavier panels (indicators, gauge, donuts, signal cards) at most once a second
  if (now - (onStreamTick.heavy || 0) >= 1000) {
    onStreamTick.heavy = now;
    if (patched) render();
    else { renderIntra(); renderSignalHome(); }
    // Panels below the fold only while visible (saves battery on phones); they catch up as soon as they scroll in
    if (onScreen('s15Card')) renderS15();
    if (window.renderPlan && onScreen('calcCard')) renderPlan();
  }
}
function onScreen(id) {
  const el = $(id);
  if (!el || document.hidden || el.closest('.tab[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > -200 && r.top < innerHeight + 200;
}

// ---------- Live price fallback / history (1-minute candles) ----------
const nowPrice = () => (state.livePrice != null ? state.livePrice : state.lastPrice);

async function refreshTick() {
  try {
    let bars, src = 'investing';
    try {
      const j = await investingChart('PT1M', 1);
      if (!j.data || !j.data.length) throw new Error('empty');
      bars = fromInvesting(j.data);
    } catch (e) {
      bars = await backupBars('1m', 90);
      src = 'backup';
    }
    if (streamFresh()) {
      // The stream is the live price: take the candle history, keep the stream's latest bars and price
      const lastT = bars[bars.length - 1].time;
      const newer = state.tick.filter((b) => b.time > lastT);
      bars[bars.length - 1].close = state.livePrice;
      state.tick = [...bars, ...newer].slice(-90);
    } else {
      state.tick = bars.slice(-90);
      state.tickSrc = src;
      state.tickAt = Date.now();
      state.livePrice = bars[bars.length - 1].close;
    }
    patchIntraCandles();
    renderLive();
    renderIntra();
    renderSignalHome();
    renderS15();
  } catch (e) {
    $('lvAgo').textContent = 'ดึงราคาสดไม่สำเร็จ กำลังลองใหม่…';
  }
}

function renderLive() {
  const bars = state.tick;
  if (!bars.length) return;
  const price = state.livePrice != null ? state.livePrice : bars[bars.length - 1].close;
  const el = $('lvPrice');
  if (state.livePrev != null && price !== state.livePrev) {
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth; // restart the flash animation
    el.classList.add(price > state.livePrev ? 'flash-up' : 'flash-down');
  }
  state.livePrev = price;
  el.textContent = f2(price);
  $('hdrPrice').textContent = f2(price);

  const prev = prevClose();
  if (prev) {
    const chg = price - prev.close, pct = (chg / prev.close) * 100;
    $('lvChg').textContent = `${chg >= 0 ? '▲' : '▼'} ${money(chg)} (${chg >= 0 ? '+' : ''}${pct.toFixed(2)}%) จาก${prev.label}`;
    $('lvChg').className = `lv-chg mono ${chg >= 0 ? 'up' : 'down'}`;
  }
  const today = state.daily[state.daily.length - 1];
  const S = streamFresh() ? state.stream : null; // the stream carries today's high / low
  if (S && num(S.high)) {
    $('lvHigh').textContent = f2(Math.max(num(S.high), price));
    $('lvLow').textContent = f2(Math.min(num(S.low), price));
  } else if (today) {
    $('lvHigh').textContent = f2(Math.max(today.high, price));
    $('lvLow').textContent = f2(Math.min(today.low, price));
  }
  const hourAgo = bars.slice().reverse().find((b) => b.time <= bars[bars.length - 1].time - 3600);
  if (hourAgo) {
    const d = price - hourAgo.close;
    $('lvH1').textContent = money(d);
    $('lvH1').className = `mono ${d >= 0 ? 'up' : 'down'}`;
  }

  // Sparkline of the last hour
  const pts = bars.slice(-60).map((b) => b.close);
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * 240, 74 - ((v - lo) / span) * 68]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  $('lvLine').setAttribute('d', line);
  $('lvArea').setAttribute('d', `${line} L240 80 L0 80 Z`);
  const [lx, ly] = xy[xy.length - 1];
  $('lvDot').setAttribute('cx', lx);
  $('lvDot').setAttribute('cy', ly);
  renderLiveStatus();
}

// Market pill + clock + "updated N s ago" (also runs every second)
function renderLiveStatus() {
  const now = Date.now();
  if (streamFresh()) setConn('live', 'เรียลไทม์ · investing.com');
  $('lvClock').textContent = `${new Date(now).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })} น.`;
  const open = INTRA.marketOpen(now);
  const last = state.tick.length ? state.tick[state.tick.length - 1].time * 1000 : 0;
  const quiet = open && last && now - last > 15 * 60e3; // market hours but no new prices (holiday)
  const pill = $('lvMarket');
  if (!state.tickAt) return;
  if (!open || quiet) {
    pill.className = 'lv-pill closed';
    $('lvMarketText').textContent = open ? 'ราคาไม่ขยับ · ตลาดอาจหยุด' : `ตลาดปิด · เปิด ${hhmm(INTRA.nextOpen(now))} น.`;
  } else if (state.tickSrc === 'backup' && !streamFresh()) {
    pill.className = 'lv-pill backup';
    $('lvMarketText').textContent = 'สด · แหล่งสำรอง';
  } else {
    pill.className = 'lv-pill open';
    $('lvMarketText').textContent = 'LIVE · ตลาดเปิด';
  }
  const age = Math.round((now - state.tickAt) / 1000);
  $('lvAgo').textContent = age > 20
    ? `⚠️ ไม่ได้อัปเดตมา ${age} วินาที — กำลังเชื่อมต่อใหม่…`
    : streamFresh()
      ? `อัปเดตเมื่อ ${age} วินาทีที่แล้ว · สตรีมสดจาก investing.com (ราคาเปลี่ยนทันทีที่ตลาดขยับ ~ทุก 1 วินาที)`
      : `อัปเดตเมื่อ ${age} วินาทีที่แล้ว · ราคาจาก ${state.tickSrc === 'backup' ? 'Binance PAXG (สำรอง)' : 'investing.com'} · ดึงใหม่ทุก 3 วินาที (กำลังต่อสตรีมสด…)`;
}

// ---------- 30-minute signals ----------
const msBars = (bars) => bars.map((b) => ({ ...b, time: b.time * 1000 }));
function group5h(bars) {
  const out = [];
  bars.forEach((b) => {
    const t = Math.floor(b.time / (5 * 3600e3)) * 5 * 3600e3, last = out[out.length - 1];
    if (last && last.time === t) { last.high = Math.max(last.high, b.high); last.low = Math.min(last.low, b.low); last.close = b.close; }
    else out.push({ ...b, time: t });
  });
  return out;
}
const toBars = (rows) => rows.map((x) => ({ time: x[0], open: x[1], high: x[2], low: x[3], close: x[4] }));
const hhmm = (ms) => new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const signedScore = (s) => `${s > 0 ? '+' : ''}${s}`;
const INTRA_DUR = { m30: 30 * 60e3, h1: 3600e3, h5: 5 * 3600e3 };

async function refreshIntraCandles() {
  try {
    const [a, b, c] = await Promise.all(['PT30M', 'PT1H', 'PT5H'].map((iv) =>
      investing(`/${PAIR_ID}/historical/chart/?interval=${iv}&pointscount=160`, 2)));
    state.intraCandles = { m30: toBars(a.data), h1: toBars(b.data), h5: toBars(c.data) };
    patchIntraCandles();
  } catch (e) {
    // Backup: Binance 30m + 1h, and 5-hour candles built from 1-hour ones (as in the backtest)
    try {
      const [m30, h1] = await Promise.all([backupBars('30m', 200), backupBars('1h', 1000)]);
      state.intraCandles = { m30: msBars(m30), h1: msBars(h1).slice(-200), h5: group5h(msBars(h1)) };
      patchIntraCandles();
    } catch (e2) { /* keep last */ }
  }
  renderIntra();
  refresh15();
}

// Move the still-forming 30m / 1h / 5h candles to the live price, so the trend score follows every tick
function patchIntraCandles(now = Date.now()) {
  const price = state.livePrice, C = state.intraCandles;
  if (price == null) return;
  const fresh = streamFresh() && INTRA.marketOpen(now);
  // The forming 15-minute candle too (15-minute card / open trade); a new one opens from the stream at :00/:15/:30/:45
  let f = state.m15[state.m15.length - 1];
  if (f && fresh && now >= f.time + M15 && now < f.time + 2 * M15) {
    f = { time: f.time + M15, open: f.close, high: Math.max(f.close, price), low: Math.min(f.close, price), close: price };
    state.m15.push(f);
    if (state.m15.length > 200) state.m15.shift();
  }
  if (f && now < f.time + M15) { f.close = price; f.high = Math.max(f.high, price); f.low = Math.min(f.low, price); }
  if (!C) return;
  Object.entries(INTRA_DUR).forEach(([k, dur]) => {
    let last = C[k] && C[k][C[k].length - 1];
    if (!last) return;
    // A new period started before the next fetch: open its candle from the stream right away, so the
    // live score (and the "market open" check) never waits on the REST API. The fetch replaces it.
    if (fresh && now >= last.time + dur && now < last.time + 2 * dur) {
      last = { time: last.time + dur, open: price, high: price, low: price, close: price };
      C[k].push(last);
    }
    if (now >= last.time + dur) return;
    last.close = price;
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
  });
}

// The main system = the chart tab's 30m system (chartsys.js, recorded in chart-signals.json) since 9 Oct 2026, when
// the old 30-minute system (intraday.json, TP $15/20/30) was merged into it — so the signals tab, the chart tab, the
// stats and LINE all show one system (user: "อยากให้ทุกส่วนสัมพันธ์กัน").
const MAIN_TF = '30m';
const mainSys = () => CHARTSYS.SYS[MAIN_TF];
const intraTrades = () => ((state.chartSig && state.chartSig.trades) || []).filter((t) => t.tf === MAIN_TF).map(live);
const oldIntraTrades = () => ((state.intra && state.intra.trades) || []).map(live);
const tradeDay = (t) => thaiDay(SIG.thaiDate(t.createdAt));

// ----- Trend strength meter: 13 segments for scores −6 … +6, and a card per voting timeframe -----
const SM_FRAMES = [['m30', '30 นาที'], ['h1', '1 ชม.'], ['h5', '5 ชม.']];
const SM_VOTE = { strong_buy: 2, buy: 1, neutral: 0, sell: -1, strong_sell: -2 };
const smMood = (s) => (s >= 5 ? 'ซื้อแรง · ถึงเกณฑ์ +5' : s >= 3 ? 'เอียงขึ้นชัด' : s >= 1 ? 'เอียงขึ้นเล็กน้อย'
  : s === 0 ? 'สมดุล ยังไม่มีทิศ' : s >= -2 ? 'เอียงลงเล็กน้อย' : s >= -4 ? 'เอียงลงชัด' : 'ขายแรง');
const sm = { shown: null, key: '' };

function buildMeter() {
  $('smSegs').innerHTML = Array.from({ length: 13 }, (_, i) => `<i${i === 6 ? ' class="mid"' : ''}></i>`).join('');
  $('inParts').innerHTML = SM_FRAMES.map(([k, label]) => `<div class="smf" id="smf-${k}">
    <div class="smf-top"><span>${label}</span><span class="smf-vote"></span></div>
    <svg class="smf-candles" viewBox="0 0 240 44" preserveAspectRatio="none" aria-hidden="true"><g class="cs"></g><line class="lp"/></svg>
    <div class="smf-foot"><span class="smf-trend"><span class="tag neutral">—</span></span><span class="smf-chg mono" title="ราคาแท่งนี้เทียบราคาเปิดแท่ง"></span></div></div>`).join('');
}

// Count the big number up/down to the new score so changes are easy to follow
function smCount(to) {
  const el = $('gScore');
  if (to == null) { el.textContent = '—'; sm.shown = null; return; }
  if (sm.shown === to) return;
  const from = sm.shown == null ? 0 : sm.shown;
  sm.shown = to;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  const t0 = performance.now(), dur = 600;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = signedScore(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
    if (p < 1 && sm.shown === to) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderMeter(dec, off) {
  const score = dec ? dec.score : 0;
  const lean = dec && !off ? Math.sign(score) : 0;
  $('sm').className = `sm ${off ? 'off' : lean > 0 ? 'buy' : lean < 0 ? 'sell' : ''}`;
  $('sm').style.setProperty('--glow-x', `${((score + 6.5) / 13) * 100}%`);
  $('smDot').className = `sm-dot${off ? ' off' : ''}`;
  smCount(dec ? score : null);
  $('smMood').textContent = !dec ? 'กำลังวิเคราะห์…' : off === 'closed' ? '🌙 ตลาดปิด' : off ? '⏳ รอข้อมูลกราฟ' : smMood(score);
  [...$('smSegs').children].forEach((el, i) => {
    const s = i - 6, lit = !off && dec && score !== 0 && Math.sign(s) === Math.sign(score) && Math.abs(s) <= Math.abs(score);
    el.className = `${i === 6 ? 'mid ' : ''}${lit ? `on ${s > 0 ? 'b' : 's'}${s === score ? ' peak' : ''}` : ''}`;
    el.style.setProperty('--k', Math.abs(s));
  });
  // centre of segment i with 13 columns and 4px (3px on phones) gaps
  const gap = innerWidth <= 520 ? 3 : 4, i = score + 6;
  $('smCursor').style.left = `calc((100% - ${12 * gap}px) / 13 * ${i + 0.5} + ${gap * i}px)`;

  // One card per voting timeframe: mini candlestick chart + its trend and vote
  const C = state.intraCandles;
  SM_FRAMES.forEach(([k]) => {
    const card = $(`smf-${k}`), trend = dec && dec.keys[k];
    const v = trend ? SM_VOTE[trend] : 0;
    card.className = `smf ${v > 0 ? 'up' : v < 0 ? 'down' : ''}`;
    card.querySelector('.smf-vote').innerHTML = !trend ? '' : v > 0 ? `${'▲'.repeat(v)} <b>+${v}</b>` : v < 0 ? `${'▼'.repeat(-v)} <b>${v}</b>` : '— <b>0</b>';
    card.querySelector('.smf-trend').innerHTML = trend ? tag(trend, INTRA.TREND_TH[trend]) : '<span class="tag neutral">—</span>';
    // Mini candlestick chart: the last 30 candles (14 on phones), the last one still forming with the live price
    const bars = ((C && C[k]) || []).filter((b) => b.time <= Date.now()).slice(innerWidth <= 520 ? -14 : -30);
    if (bars.length < 2) return;
    const svg = card.querySelector('svg'), cs = svg.querySelector('.cs'), W = 10;
    // rebuild (and replay the grow-in) only when a new candle starts; otherwise just move the shapes
    const key = `${k}:${bars[bars.length - 1].time}:${bars.length}`;
    if (svg.dataset.key !== key) {
      svg.dataset.key = key;
      svg.setAttribute('viewBox', `0 0 ${bars.length * W} 44`);
      cs.innerHTML = bars.map((_, j) => `<g style="--i:${j}"><line/><rect/></g>`).join('');
      svg.classList.remove('draw'); void svg.getBoundingClientRect(); svg.classList.add('draw');
    }
    const lo = Math.min(...bars.map((b) => b.low)), hi = Math.max(...bars.map((b) => b.high)), span = hi - lo || 1;
    const y = (p) => 3 + (1 - (p - lo) / span) * 38;
    [...cs.children].forEach((g, j) => {
      const b = bars[j], x = j * W, [wick, body] = g.children;
      g.setAttribute('class', `${b.close >= b.open ? 'cu' : 'cd'}${j === bars.length - 1 ? ' live' : ''}`);
      wick.setAttribute('x1', x + W / 2); wick.setAttribute('x2', x + W / 2);
      wick.setAttribute('y1', y(b.high).toFixed(2)); wick.setAttribute('y2', y(b.low).toFixed(2));
      body.setAttribute('x', x + 1.8); body.setAttribute('width', W - 3.6);
      body.setAttribute('y', y(Math.max(b.open, b.close)).toFixed(2));
      body.setAttribute('height', Math.max(0.8, Math.abs(y(b.open) - y(b.close))).toFixed(2));
    });
    const last = bars[bars.length - 1], ly = y(last.close).toFixed(2), chg = last.close - last.open;
    const lp = svg.querySelector('.lp');
    lp.setAttribute('x1', 0); lp.setAttribute('x2', bars.length * W); lp.setAttribute('y1', ly); lp.setAttribute('y2', ly);
    const ce = card.querySelector('.smf-chg');
    ce.textContent = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}`;
    ce.className = `smf-chg mono ${chg >= 0 ? 'up' : 'down'}`;
  });
  renderCycle();
}

// Progress to the next official half-hourly check (the candle close the system decides on)
function renderCycle() {
  const now = Date.now(), start = INTRA.slotOf(now), left = start + INTRA.SLOT - now;
  const bar = $('smCycle'), p = ((now - start) / INTRA.SLOT) * 100;
  bar.style.transition = p < (bar.dataset.p || 0) ? 'none' : ''; // jump back to 0 when a new half hour starts
  bar.dataset.p = p;
  bar.style.width = `${p}%`;
  const mm = Math.floor(left / 60e3), ss = Math.floor((left % 60e3) / 1000);
  $('smCycleTx').textContent = `แท่ง 30 นาทีปิดในอีก ${mm}:${String(ss).padStart(2, '0')}`;
}

// ----- Donuts: what happened historically to trades opened at this score -----
const RING_R = 46, RING_C = 2 * Math.PI * RING_R;
// Donut = one side of the main system: the ring fills to its readiness % (100 = entry), the center shows it, and the
// legend shows that side's tested win rate — the same numbers as the chart tab's Buy | Sell columns
function buildDonut(el, dir) {
  el.innerHTML = `
    <div class="dn-head"><span>${dir > 0 ? '🟢 ฝั่งซื้อ (BUY)' : '🔴 ฝั่งขาย (SELL)'}</span><span class="dn-verdict" data-k="verdict">—</span></div>
    <div class="dn-body">
      <div class="dn-ring">
        <svg viewBox="0 0 120 120"><circle class="dn-bg" cx="60" cy="60" r="${RING_R}"/>
          <circle class="dn-seg ${dir > 0 ? 's2' : 's0'}" cx="60" cy="60" r="${RING_R}" stroke-dasharray="0 ${RING_C}" stroke-dashoffset="0"><title></title></circle>
        </svg>
        <div class="dn-center"><b class="mono" data-k="win">—</b><small>ความพร้อมเข้า</small></div>
      </div>
      <ul class="dn-legend">
        <li><span data-k="testL">ผลทดสอบ</span><b data-k="test">—</b></li>
        <li><span>เกณฑ์เข้า</span><b data-k="th">—</b></li>
      </ul>
    </div>
    <div class="dn-lv" data-k="lv"></div>`;
  el.dataset.win = '0';
}

// Count a number up/down to its new value
function countTo(el, to, fmt) {
  const from = +el.dataset.v || 0;
  el.dataset.v = to;
  const t0 = performance.now(), dur = 900;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// x = CHARTSYS.sideInfo(…) for this side (or null while loading), v = { key, th } verdict
function updateDonut(el, dir, x, v, price) {
  if (!el.firstElementChild) buildDonut(el, dir);
  el.className = `card dn ${dir > 0 ? 'buy' : 'sell'} ${v.key}`;
  el.querySelector('[data-k="verdict"]').textContent = v.th;
  const seg = el.querySelector('.dn-seg'), len = ((x ? x.pct : 0) / 100) * RING_C;
  seg.setAttribute('stroke-dasharray', `${len} ${RING_C}`);
  seg.style.opacity = x ? '' : '.25';
  seg.querySelector('title').textContent = `ความพร้อมเข้า ${x ? x.pct : '—'}%`;
  const win = el.querySelector('[data-k="win"]');
  if (x) { if (+win.dataset.v !== x.pct) countTo(win, x.pct, (n) => `${Math.round(n)}%`); } else { win.dataset.v = 'none'; win.textContent = '—'; }
  const sys = mainSys(), c = dir > 0 ? sys.buy : sys.sell, cc = c || sys.buy;
  el.querySelector('[data-k="test"]').textContent = c ? `ชนะ ${c.win}%` : 'ขาดทุน — ไม่ใช้';
  el.querySelector('[data-k="testL"]').textContent = `ผลทดสอบ ${sys.span}`;
  el.querySelector('[data-k="th"]').textContent = `คะแนน ${dir > 0 ? '+' : '−'}${cc.th}${c && c.confirm ? ` + ${CHARTSYS.CONFIRM[c.confirm].name}` : ''}`;
  const L = price != null ? CHARTSYS.levelsFor(cc, price, dir) : null, r = (n) => SIG.round(n);
  el.querySelector('[data-k="lv"]').innerHTML = L ? [
    `<div class="sl"><label>🛑 SL</label><b class="mono">${f2(r(L.sl))}</b><small>−$${Math.round(15 * cc.mult)}</small></div>`,
    ...L.tps.map((tp, k) => `<div class="tp"><label>TP${k + 1}</label><b class="mono">${f2(r(tp))}</b><small>+$${CHARTSYS.usdList(cc)[k]}</small></div>`),
  ].join('') : '';
}

// ----- Open trade, updated in place so the price marker slides -----
function renderOpenTrade(open, price) {
  const box = $('inTrade');
  if (!open) { box.innerHTML = ''; box.dataset.id = ''; return; }
  const buy = open.side === 'BUY', d = buy ? 1 : -1, hit = open.hit || 0;
  const far = open.tps[open.tps.length - 1];
  const pct = (v) => Math.max(0, Math.min(100, ((v - open.sl) / (far - open.sl)) * 100));
  if (box.dataset.id !== `${open.id}|${hit}`) {
    box.dataset.id = `${open.id}|${hit}`;
    box.innerHTML = `<div class="card lt ${buy ? 'buy' : 'sell'}">
      <div class="sig-top"><span class="muted">📌 ไม้ที่เปิดอยู่ · ระบบ 30 นาที <span class="lv-tag">สด</span></span><span class="muted small">เข้า ${hhmm(open.createdAt)} น. · ปิดเองไม่เกิน ${hhmm(open.expiresAt)} น.</span></div>
      <div class="lt-head"><b style="font-size:20px">${buy ? '🟢 ซื้อ' : '🔴 ขาย'}ที่ <span class="mono">${f2(open.entry)}</span></b><span class="lt-pnl mono" id="ltPnl">—</span></div>
      <small class="muted">กำไร/ขาดทุนตอนนี้ ต่อทอง 1 ออนซ์ (0.01 lot)${hit ? ` · ถึง TP${hit} แล้ว SL เลื่อนมาที่ทุน` : ''}</small>
      <div class="lt-bar" style="--entry:${pct(open.entry)}%">
        <i class="mk" style="left:0"><span>🛑 ${f2(hit ? open.entry : open.sl)}</span></i>
        <i class="mk" style="left:${pct(open.entry)}%"><span>เข้า</span></i>
        ${open.tps.map((tp, k) => `<i class="mk${hit > k ? ' done' : ''}" style="left:${pct(tp)}%"><span>TP${k + 1}${hit > k ? '✓' : ''}</span></i>`).join('')}
        <i class="now" id="ltNow"><span id="ltNowTx"></span></i>
      </div>
      ${lotHtml(INTRA.RULE.slUsd)}
    </div>`;
  }
  if (price == null) return;
  const pnl = SIG.round((open.realized || 0) + ((open.tps.length - hit) / open.tps.length) * d * (price - open.entry));
  $('ltPnl').textContent = money(pnl);
  $('ltPnl').className = `lt-pnl mono ${pnl >= 0 ? 'up' : 'down'}`;
  $('ltNow').style.left = `${pct(price)}%`;
  $('ltNowTx').textContent = f2(price);
}

function renderIntra() {
  const now = Date.now();
  const trades = intraTrades();
  const open = trades.find((t) => t.status === 'active');
  const C = state.intraCandles;
  const dec = C ? INTRA.decide(C, now, state.news, true) : null; // live: includes the forming candles
  const official = C ? INTRA.decide(C, now, state.news) : null; // what the half-hourly check sees
  const price = nowPrice();
  const next = INTRA.slotOf(now) + INTRA.SLOT;
  $('inNext').textContent = `เช็กทางการรอบถัดไป ${hhmm(next)} น.`;
  showBeat('inBeat');

  // Closed market (by the clock) vs. an open market whose candles are late (fetch failed / tab asleep)
  const off = !dec ? '' : !dec.open ? 'closed' : dec.stale ? 'late' : '';
  if (off === 'late' && now - (state.intraRetry || 0) > 20e3) { state.intraRetry = now; refreshIntraCandles(); }
  renderMeter(dec, off);
  $('gScoreSub').textContent = official && dec && official.score !== dec.score
    ? `คะแนนสดจากแท่งที่กำลังวิ่ง · รอบล่าสุดแท่งปิดได้ ${signedScore(official.score)}`
    : `คะแนนสดจาก 3 กรอบเวลา · ระบบเข้าซื้อเมื่อแท่งปิดได้ +${INTRA.RULE.threshold}`;

  // Everything below comes from the main system (CHARTSYS 30m) — the same verdicts and % as the chart tab
  const sys = mainSys(), br = CHARTSYS.brake(sys, trades, now);
  const pause = br ? { reason: br.why, until: br.until } : null;
  const offDir = official ? CHARTSYS.dirOf(sys, official) : 0;
  const sides = [1, -1].map((s) => CHARTSYS.sideInfo(sys, dec, s, br));
  state.mainNow = dec ? { sides, open } : null;
  renderDailyVsMain();
  let call, cls;
  if (pause && !open) {
    call = `⛔ ระบบพัก — ${pause.reason}`; cls = 'wait';
  } else if (open) {
    call = `📌 มีไม้${open.side === 'BUY' ? 'ซื้อ' : 'ขาย'}เปิดอยู่ — ถือต่อตามแผน`;
    cls = open.side === 'BUY' ? 'buy' : 'sell';
  } else if (!dec) {
    call = 'กำลังวิเคราะห์…'; cls = 'wait';
  } else if (off === 'closed') {
    const at = INTRA.nextOpen(now), day = SIG.thaiDate(at) === SIG.thaiDate(now) ? ''
      : `วัน${new Date(at).toLocaleDateString('th-TH', { weekday: 'long', timeZone: 'Asia/Bangkok' }).replace(/^วัน/, '')} `;
    call = `🌙 ตลาดปิดอยู่ — เปิดอีกครั้ง${day ? ` ${day}` : ' '}${hhmm(at)} น.`; cls = 'wait';
  } else if (off === 'late') {
    call = '⏳ กำลังดึงข้อมูลกราฟล่าสุด…'; cls = 'wait';
  } else if (offDir) {
    call = `${offDir > 0 ? '🟢 Buy' : '🔴 Sell'} ✅ ควรเข้า — ระบบกำลังส่งสัญญาณ`; cls = offDir > 0 ? 'buy' : 'sell';
  } else if (dec.news) {
    call = '⏸ ช่วงข่าวแรง — รอให้ข่าวผ่านไปก่อน'; cls = 'wait';
  } else if (CHARTSYS.dirOf(sys, dec)) {
    call = `⚡ ใกล้เข้า — ถ้าแท่งปิด ${hhmm(next)} น. ยังได้ ${signedScore(dec.score)} ระบบจะส่งสัญญาณ`; cls = 'wait';
  } else {
    call = `⏸ รอก่อน — Buy ${sides[0].pct}% · Sell ${sides[1].pct}%`; cls = 'wait';
  }
  $('intraCard').className = `card intra ${cls}`;
  $('inCall').textContent = call;

  if (pause && !open) {
    $('inWhy').textContent = `ไม่แนะนำเปิดไม้ใหม่${pause.until ? ` จนถึง ${thaiTime(pause.until)} น.` : ' จนกว่าผล 20 ไม้ล่าสุดจะกลับมาใกล้ผลทดสอบ'} — ระบบยังบันทึกต่อ`;
  } else if (dec) {
    const why = INTRA.reasons(dec);
    $('inWhy').textContent = why.slice(1).join(' · ') || (dec.dir ? 'ทั้ง 3 ช่วงเวลาชี้ไปทางเดียวกันชัดเจน' : '');
    renderWhy('in', dec, 'คะแนนสด: รวมแท่งที่ยังไม่ปิด ขยับตามราคาทุกวินาที (สัญญาณจริงใช้แท่งที่ปิดแล้ว)');
  } else {
    $('inWhy').textContent = 'กำลังโหลดข้อมูลกราฟ…';
  }

  renderOpenTrade(open, price);

  // Donuts: each side's readiness and verdict from the main system (same as the chart tab's Buy | Sell columns)
  sides.forEach((x) => {
    const v = off === 'closed' ? { key: 'unknown', th: '🌙 ตลาดปิด' }
      : off === 'late' ? { key: 'unknown', th: '⏳ รอข้อมูลกราฟ' }
      : dec && dec.news && x.tested ? { key: 'bad', th: '⏸ งดเข้า (ช่วงข่าว)' } : { key: x.key, th: x.verdict };
    updateDonut($(x.side > 0 ? 'dnBuy' : 'dnSell'), x.side, dec ? x : null, v, price);
  });
  $('dnNote').innerHTML = dec
    ? `วงกลม = <b>ความพร้อมเข้า</b> ของระบบหลัก (กรอบ 30 นาที — ตัวเดียวกับหน้ากราฟ) · 100% = ถึงจุดเข้า · <b>ผลทดสอบ</b> = ชนะกี่ % ใน 2 ปีที่ผ่านมา หลังหักสเปรด · ฝั่งที่ทดสอบแล้วขาดทุนขึ้น ⚠️ ไม่แนะนำ · ราคาเปลี่ยนตามตลาดสดทุก 3 วินาที`
    : '';

  $('inNews').innerHTML = newsTimelineHtml(now);

  // Today's trades
  const todayId = SIG.thaiDate(now);
  const today = trades.filter((t) => t.id.startsWith(todayId));
  const done = today.filter((t) => t.status === 'win' || t.status === 'loss');
  const sum = done.reduce((a, t) => a + (t.pnl || 0), 0);
  $('inToday').innerHTML = `<h4>⏱️ ไม้วันนี้ (ระบบ 30 นาที)</h4>` + (today.length
    ? `<p class="muted small">${today.length} ไม้ · ปิดแล้ว ${done.length} · ${money(SIG.round(sum))}/ออนซ์</p>
       <div class="in-chips">${today.map((t) => `<span class="chip-r ${t.status}">${hhmm(t.createdAt)} ${t.side === 'BUY' ? 'ซื้อ' : 'ขาย'} ${t.status === 'active' ? '…' : money(t.pnl)}</span>`).join('')}</div>`
    : '<p class="muted small">ยังไม่มีไม้ — ระบบจะเข้าเมื่อทั้ง 3 ช่วงเวลาชี้ขึ้นชัดเจน (คะแนน +5)</p>');
}

// ---------- Detailed reasons: every indicator vote in every timeframe behind a score ----------
const LEVELS = [[-0.5, 'ขาลง'], [-0.15, 'ไซด์เวย์'], [0.15, 'ขาขึ้น'], [0.5, 'ขาขึ้นแรง']]; // avg needed for the next level up
const voteTag = (s) => (s > 0 ? '<i class="vb">▲ ซื้อ</i>' : s < 0 ? '<i class="vs">▼ ขาย</i>' : '<i class="vn">• กลาง</i>');
function whyDetail(dec, note) {
  if (!dec || !dec.frames || !dec.frames[0].votes) return null;
  const rule = dec.rule || INTRA.RULE;
  let buys = 0, sells = 0, neutral = 0;
  const cols = dec.frames.map((f) => {
    const n = f.votes.length, sum = f.votes.reduce((a, v) => a + v.signal, 0);
    const b = f.votes.filter((v) => v.signal > 0).length, s = f.votes.filter((v) => v.signal < 0).length;
    buys += b; sells += s; neutral += n - b - s;
    const pts = SM_VOTE[f.trend];
    const up = LEVELS.find(([th]) => f.avg < th);
    const need = up ? Math.ceil(up[0] * n - sum - 1e-9) : 0;
    const next = !up ? 'อยู่ระดับสูงสุดแล้ว'
      : `ขึ้นเป็น "${up[1]}" ต้องได้เพิ่มอีก ${need} แต้ม (≈ ตัวชี้วัดขายเปลี่ยนเป็นซื้อ ${Math.ceil(need / 2)} ตัว)`;
    return `<div class="why-col ${pts > 0 ? 'up' : pts < 0 ? 'down' : ''}">
      <div class="why-head"><b>${f.label}</b><span>${INTRA.TREND_TH[f.trend]} · <b class="mono">${pts > 0 ? '+' : ''}${pts}</b> คะแนน</span></div>
      <div class="why-bar" title="ซื้อ ${b} · กลาง ${n - b - s} · ขาย ${s}"><i class="vb" style="flex:${b}"></i><i class="vn" style="flex:${n - b - s}"></i><i class="vs" style="flex:${s}"></i></div>
      <div class="why-avg muted small">ซื้อ ${b} · กลาง ${n - b - s} · ขาย ${s} จาก ${n} ตัว → ค่าเฉลี่ย <b class="mono">${f.avg >= 0 ? '+' : ''}${f.avg.toFixed(2)}</b></div>
      <table class="why-tbl">${f.votes.map((v) => `<tr><td>${v.name}</td><td class="mono">${v.value}</td><td>${voteTag(v.signal)}</td></tr><tr class="w"><td colspan="3">${v.why}</td></tr>`).join('')}</table>
      <p class="why-next small">${next}</p></div>`;
  });
  const gap = rule.threshold - dec.score;
  const body = `<div class="why-grid">${cols.join('')}</div>
    <p class="why-sum">รวม 3 กรอบเวลา = <b class="mono">${signedScore(dec.score)}</b> จาก ±6 · ${gap > 0 ? `ยังขาดอีก <b>${gap}</b> คะแนนถึงจุดเข้าซื้อ +${rule.threshold}` : `<b>ถึงเกณฑ์เข้าซื้อ +${rule.threshold} แล้ว</b>`}</p>
    <p class="muted small why-how">วิธีคิด: ในแต่ละกรอบเวลา ตัวชี้วัดทุกตัวโหวต (ซื้อ +1 · กลาง 0 · ขาย −1) แล้วเฉลี่ย → ≥ +0.50 ขาขึ้นแรง (+2) · ≥ +0.15 ขาขึ้น (+1) · −0.15…+0.15 ไซด์เวย์ (0) · ≤ −0.15 ขาลง (−1) · ≤ −0.50 ขาลงแรง (−2) · รวม 3 กรอบเวลาเป็นคะแนน −6…+6${note ? ` · ${note}` : ''}</p>`;
  return { sum: `🔍 ดูเหตุผลละเอียด — ตัวชี้วัด ${buys + sells + neutral} ตัวใน 3 กรอบเวลา: <b class="up">ซื้อ ${buys}</b> · <b class="down">ขาย ${sells}</b> · กลาง ${neutral}`, body };
}
// Only touch the DOM when the text changed, so an open panel keeps its place
function renderWhy(prefix, dec, note) {
  const d = whyDetail(dec, note), box = $(`${prefix}Detail`);
  box.hidden = !d;
  if (!d) return;
  if ($(`${prefix}DetailSum`).innerHTML !== d.sum) $(`${prefix}DetailSum`).innerHTML = d.sum;
  if (renderWhy[prefix] !== d.body) { renderWhy[prefix] = d.body; $(`${prefix}DetailBody`).innerHTML = d.body; }
}

// ---------- 15-minute signal (website only, nothing sent to LINE) ----------
// Re-checked every time a 15-minute candle closes (INTRA.decide15 on closed candles only), replayed over
// the candles on screen with the backtest's rules: one trade at a time, next trade 15 minutes after an exit.
const M15 = 15 * 60e3;
const s15Cache = new Map(); // decision time → decision (past decisions never change)

function run15(now = Date.now()) {
  const C = state.intraCandles, m15 = state.m15;
  if (!C || m15.length < 80) return null;
  const candles = { m15, h1: C.h1, h5: C.h5 };
  const last = Math.floor(now / M15) * M15; // the latest 15-minute close
  const decs = [], trades = [];
  let busyUntil = 0;
  for (let t = m15[60].time + M15; t <= last; t += M15) {
    let dec = s15Cache.get(t);
    if (dec === undefined) {
      dec = INTRA.decide15(candles, t, state.news);
      if (t < last) s15Cache.set(t, dec); // the newest one may still change as data arrives
    }
    decs.push({ t, dec });
    if (!dec || !dec.dir || t < busyUntil) continue;
    const bar = m15.find((b) => b.time === t - M15);
    if (!bar) continue;
    const r = SIG.evaluate(INTRA.makeTrade(dec, bar.close, t), m15.filter((b) => b.time >= t - M15), now);
    trades.push(r);
    busyUntil = SIG.isFinal(r) ? (r.exitAt || r.expiresAt) + M15 : Infinity;
  }
  state.s15 = { decs, trades, at: last, current: decs.length ? decs[decs.length - 1].dec : null };
  return state.s15;
}

// Candle chart in the card: 15-minute candles, a background band where entering is allowed / news, markers
let s15Chart = null;
function s15ChartParts() {
  if (s15Chart) return s15Chart;
  // Drag to scroll back, drag an axis / pinch to zoom (the mouse wheel stays with the page)
  const chart = LC.createChart($('s15Chart'), { ...chartBase(true),
    handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true, axisDoubleClickReset: true } });
  const zone = chart.addHistogramSeries({ priceScaleId: 'zone', priceLineVisible: false, lastValueVisible: false, base: 0 });
  chart.priceScale('zone').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
  const candles15 = chart.addCandlestickSeries({
    upColor: '#0f9f6e', downColor: '#e0424f', borderVisible: false, wickUpColor: '#0f9f6e', wickDownColor: '#e0424f',
  });
  fitWhenSized($('s15Chart'), () => s15View());
  s15Chart = { chart, zone, candles15, lines: [], user: false, hover: null, decAt: new Map() };
  // Once the viewer moves the chart, redraws keep their view until "ดูล่าสุด"
  const touched = () => { s15Chart.user = true; $('s15Reset').hidden = false; };
  ['pointerdown', 'touchstart'].forEach((ev) => $('s15Chart').addEventListener(ev, touched, { passive: true }));
  $('s15Reset').addEventListener('click', () => { s15Chart.user = false; $('s15Reset').hidden = true; s15View(); });
  chart.subscribeCrosshairMove((p) => { s15Chart.hover = p && p.time != null ? p.time : null; s15Ohlc(); });
  applyChartTheme();
  return s15Chart;
}

// Markers for a list of trades on a series whose times are seconds + TZ
function s15Markers(trades, from = 0) {
  const sec = (ms) => Math.floor(ms / 1000) + TZ;
  const out = [];
  trades.forEach((r) => {
    if (r.createdAt - M15 < from) return;
    out.push({ time: sec(r.createdAt - M15), position: 'belowBar', color: '#0f9f6e', shape: 'arrowUp', text: 'ซื้อ' });
    if (SIG.isFinal(r) && r.exitAt) {
      const win = r.pnl > 0;
      out.push({ time: sec(Math.floor(r.exitAt / M15) * M15), position: win ? 'aboveBar' : 'belowBar', color: win ? '#0f9f6e' : '#e0424f',
        shape: 'circle', text: r.closedBy === 'sl' ? 'SL' : r.closedBy === 'be' ? 'ทุน' : r.hit ? `TP${r.hit}` : 'ปิด' });
    }
  });
  return out.sort((a, b) => a.time - b.time);
}

// The latest 24 hours (96 candles) unless the viewer has scrolled / zoomed
const S15_VIEW = 96;
function s15View() {
  if (!s15Chart || s15Chart.user) return;
  const n = state.m15.length;
  s15Chart.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - S15_VIEW) - 0.5, to: n + 2 });
}

// Open / high / low / close of the candle under the pointer (or the newest one), and the score when it closed
function s15Ohlc() {
  if (!s15Chart) return;
  const bars = state.m15;
  const t = s15Chart.hover, b = t != null ? bars.find((x) => Math.floor(x.time / 1000) + TZ === t) : bars[bars.length - 1];
  if (!b) { $('s15Ohlc').innerHTML = ''; return; }
  const forming = b === bars[bars.length - 1] && Date.now() < b.time + M15;
  const chg = b.close - b.open, pct = (chg / b.open) * 100, cls = chg >= 0 ? 'up' : 'down';
  const dec = s15Chart.decAt.get(b.time + M15);
  $('s15Ohlc').innerHTML = `<b>${hhmm(b.time)}–${hhmm(b.time + M15)}</b>${forming ? ' <span class="lv-tag">กำลังวิ่ง</span>' : ''}
    <span>เปิด ${f2(b.open)}</span><span class="up">สูง ${f2(b.high)}</span><span class="down">ต่ำ ${f2(b.low)}</span><span>ปิด <b>${f2(b.close)}</b></span>
    <span class="${cls}">${chg >= 0 ? '+' : ''}${f2(chg)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)</span><span>ช่วงแกว่ง ${f2(b.high - b.low)}</span>${dec ? `<span>คะแนนตอนปิด <b>${signedScore(dec.score)}</b>${dec.dir > 0 ? ' ✅ เข้าได้' : dec.stretched ? ' · ยืดเกิน BB' : ''}</span>` : ''}`;
}

function drawS15Chart(s) {
  const P = s15ChartParts();
  const sec = (ms) => Math.floor(ms / 1000) + TZ;
  const bars = state.m15; // every downloaded candle (~40 hours): the last 24 hours are shown, drag to see more
  P.decAt = new Map(s.decs.map((d) => [d.t, d.dec]));
  P.candles15.setData(bars.map((b) => ({ time: sec(b.time), open: b.open, high: b.high, low: b.low, close: b.close })));
  // Background: the decision made when each candle closed applies to the next candle
  const byT = new Map(s.decs.map((d) => [d.t, d.dec]));
  P.zone.setData(bars.map((b) => {
    const d = byT.get(b.time);
    const color = !d || d.stale ? 'rgba(0,0,0,0)' : d.news ? 'rgba(240,180,41,.22)' : d.dir > 0 ? 'rgba(15,159,110,.16)' : 'rgba(0,0,0,0)';
    return { time: sec(b.time), value: 1, color };
  }));
  P.candles15.setMarkers(s15Markers(s.trades, bars[0].time));
  P.lines.forEach((l) => P.candles15.removePriceLine(l));
  P.lines = [];
  const open = s.trades.find((r) => r.status === 'active');
  if (open) {
    const line = (price, color, title, style) => P.lines.push(P.candles15.createPriceLine({ price, color, title, lineStyle: style, lineWidth: 1 }));
    line(open.entry, '#d99a10', 'เข้า', LC.LineStyle.Solid);
    line(open.hit ? open.entry : open.sl, '#e0424f', open.hit ? 'SL→ทุน' : 'SL', LC.LineStyle.Dashed);
    open.tps.forEach((tp, k) => line(tp, '#0f9f6e', `TP${k + 1}`, LC.LineStyle.Dashed));
  }
  s15View();
  s15Ohlc();
}

// Every stream tick: the forming candle on the card chart follows the live price (a new candle when one opens)
function s15Tick() {
  const b = state.m15[state.m15.length - 1];
  if (!s15Chart || !b || renderS15.drawn == null) return;
  try {
    s15Chart.candles15.update({ time: Math.floor(b.time / 1000) + TZ, open: b.open, high: b.high, low: b.low, close: b.close });
    if (s15Chart.hover == null) s15Ohlc();
  } catch (e) { renderS15.drawn = null; } // out of order (data replaced): full redraw on the next render
}

// Light update (every tick): countdown, call, live profit; the chart only when a candle closed
function renderS15() {
  if (!$('s15Card')) return; // card removed from the signals tab (user, 8 Oct)
  const now = Date.now();
  const s = state.s15;
  const next = Math.floor(now / M15) * M15 + M15;
  const left = Math.max(0, next - now);
  $('s15Next').textContent = `แท่งปิด ${hhmm(next)} น. (อีก ${Math.floor(left / 60e3)}:${String(Math.floor((left % 60e3) / 1000)).padStart(2, '0')})`;
  if (!s) return;
  const dec = s.current;
  const open = s.trades.find((r) => r.status === 'active');
  const price = nowPrice();
  let call, cls;
  if (open) {
    call = `📌 ถือไม้ซื้ออยู่ — เข้า ${hhmm(open.createdAt)} น. ที่ ${f2(open.entry)}`; cls = 'hold';
  } else if (!dec) {
    call = 'กำลังคำนวณ…'; cls = 'wait';
  } else if (dec.stale) {
    call = '🌙 ตลาดปิด — ไม่เข้า'; cls = 'wait';
  } else if (dec.dir > 0) {
    call = '⏸ เพิ่งปิดไม้ — รอแท่งถัดไป'; cls = 'wait';
  } else if (dec.news) {
    call = '⏸ ไม่เข้า — ช่วงข่าวแรง'; cls = 'wait';
  } else if (dec.stretched) {
    call = '⏸ ไม่เข้า — คะแนนถึงแล้ว แต่ราคายืดเกินขอบบน Bollinger (รอย่อ)'; cls = 'wait';
  } else {
    call = `⏸ ไม่เข้า — คะแนน ${signedScore(dec.score)} (ต้อง +${INTRA.RULE15.threshold})`; cls = 'wait';
  }
  $('s15Card').className = `card s15 ${cls}`;
  $('s15Call').textContent = call;
  $('s15Why').textContent = dec ? INTRA.reasons(dec).join(' · ') : '';
  renderWhy('s15', dec, dec ? `คิดจากแท่งที่ปิดแล้วเมื่อ ${hhmm(s.at)} น. (คิดใหม่ทุกครั้งที่แท่ง 15 นาทีปิด)` : '');

  const calib = state.bt15 && state.bt15.calibration;
  const side = (dir) => {
    const o = dec ? INTRA.odds(dec.score, calib, dir > 0 ? 'buy' : 'sell') : null;
    if (dir < 0) return `<div class="no"><b>🔴 ฝั่งขาย: ไม่เข้า</b>สถิติย้อนหลังฝั่งขายแพ้มากกว่าชนะ${o ? ` (จบกำไร ${o.winRate}%)` : ''}</div>`;
    const ok = dec && dec.dir > 0;
    return `<div class="${ok ? 'ok' : 'no'}"><b>🟢 ฝั่งซื้อ: ${ok ? 'เข้าได้' : 'ยังไม่เข้า'}</b>${ok ? 'คะแนนถึง +5 แล้ว' : `เข้าเมื่อคะแนน +${INTRA.RULE15.threshold} (ตอนนี้ ${dec ? signedScore(dec.score) : '—'})`}${o ? ` · จบกำไร ${o.winRate}%` : ''}</div>`;
  };
  if (open) {
    const hit = open.hit || 0;
    const pnl = price != null ? SIG.round((open.realized || 0) + ((open.tps.length - hit) / open.tps.length) * (price - open.entry)) : open.pnl;
    $('s15Trade').innerHTML = `<div class="sig-tps n3 mini">
        <div class="n sl"><label>🛑 SL${hit ? ' → ทุน' : ''}</label><b class="mono">${f2(hit ? open.entry : open.sl)}</b></div>
        ${open.tps.map((tp, k) => `<div class="n tp${hit > k ? ' done' : ''}"><label>TP${k + 1}${hit > k ? ' ✓' : ''}</label><b class="mono">${f2(tp)}</b></div>`).join('')}
      </div>
      <p class="sig-pnl ${pnl >= 0 ? 'up' : 'down'}">กำไร/ขาดทุนตอนนี้ ${money(pnl)} ต่อ 1 ออนซ์ · ปิดเองไม่เกิน ${hhmm(open.expiresAt)} น.</p>${lotHtml(INTRA.RULE.slUsd)}`;
  } else {
    $('s15Trade').innerHTML = `<div class="s15-sides">${side(1)}${side(-1)}</div>`;
  }

  if (s.at !== renderS15.drawn) { renderS15.drawn = s.at; drawS15Chart(s); }

  const todayId = SIG.thaiDate(now);
  const today = s.trades.filter((r) => r.id.startsWith(todayId));
  $('s15Today').innerHTML = today.length
    ? `<div class="in-chips">${today.map((r) => `<span class="chip-r ${r.status}">${hhmm(r.createdAt)} ซื้อ ${r.status === 'active' ? '…' : money(r.pnl)}</span>`).join('')}</div>`
    : `<p class="muted small" style="margin:0">วันนี้ยังไม่มีจุดเข้า${s.trades.length ? '' : ` · ในกราฟ ${Math.round((s.decs.length * 15) / 60)} ชม. ที่ผ่านมาก็ยังไม่มีจังหวะที่ผ่านเกณฑ์ (เฉลี่ย ~${state.bt15 ? state.bt15.perDay : 1.4} ไม้/วัน บางวันไม่มีเลย — การไม่เข้าตอนตลาดไม่ชัดก็คือการรักษาเงิน)`}</p>`;
  const bt = state.bt15;
  if (bt) {
    const b = SIG.summary(bt.trades, userSpread());
    $('s15Stats').innerHTML = `📊 ทดสอบย้อนหลัง 1 ปี (กติกาเดียวกัน): ${b.traded} ไม้ (~${bt.perDay}/วัน) · ชนะ ${b.winRate}% · <b>${money(b.pnl)}</b>/ออนซ์ หลังหักสเปรด $${b.spread}/ไม้ — ไม่มีระบบไหนแม่นทุกครั้ง ตั้ง SL ทุกไม้`;
  }
}

function refresh15() {
  run15();
  renderS15();
  markChart15();
}

// Chart tab: show the same entry / exit markers when the 15-minute view is open
// Chart tab markers / entry zones / trade lines come from chartzones.js (every timeframe)
function markChart15() {
  if (window.renderChartZones) return renderChartZones();
  const s = state.s15;
  const on = state.tf === '15m' && s && state.bars.length;
  const from = on ? state.bars[0].time * 1000 : 0;
  const marks = on ? s15Markers(s.trades, from) : [];
  candles.setMarkers(marks);
  areaS.setMarkers(marks);
}

function renderIntraStats() {
  // The main system's trades and the old 30-minute record are listed in the 📈 card (renderTradeChart)
  showBeat('statsBeat');
  renderChartSignals();
  const bt = state.bt30;
  if (bt) {
    const b = SIG.summary(bt.trades, userSpread());
    $('inBtTiles').innerHTML = tilesHtml(b);
    const off = mainSys().buy;
    $('inBtNote').innerHTML = `ผลทดสอบหลัก (${mainSys().span}): ชนะ <b>${off.win}%</b>${off.n ? ` · ${off.n} ไม้ · ${money(off.pnl)}/ออนซ์` : ''} — ด้านล่างคือเฉพาะ<b>ช่วง 1 ปีล่าสุด</b> (เข้มกว่า: หลบข่าวด้วย) · ประมาณ <b>${bt.perDay} ไม้/วัน</b> · ${INTRA.RULE.sides === 'buy' ? 'เฉพาะฝั่งซื้อ · ' : ''}หักสเปรด $${b.spread}/ไม้แล้วเหลือ <b>${money(b.pnl)}</b>/ออนซ์ ใน ${bt.days} วัน`;
    plotEquity('inBtChart', bt.trades);
  }
}

// ---------- Position size, spread, news ----------
const userSpread = () => (window.UI && UI.settings ? UI.settings().spread : 0.4);

// Lot size for a stop of `sl` dollars per ounce (0.01 lot = 1 oz) from the user's capital and risk %
window.lotFor = function lotFor(sl, s = window.UI && UI.settings ? UI.settings() : null) {
  if (!s || !s.capital) return null;
  const cap = s.currency === 'THB' ? (state.thb ? s.capital / state.thb : null) : s.capital;
  if (!cap) return null;
  const riskUsd = (cap * s.risk) / 100;
  const lot = Math.floor((riskUsd / (sl * 100)) * 100) / 100;
  if (lot < 0.01) {
    return { lot: 0, text: `ทุนนี้เสี่ยง ${s.risk}% ได้ $${f2(riskUsd)} — น้อยกว่าขั้นต่ำ 0.01 lot (เสี่ยง $${f2(sl)} = ${f2((sl / cap) * 100)}% ของทุน)` };
  }
  return { lot, text: `ขนาดไม้แนะนำ ${lot.toFixed(2)} lot · ถ้าโดน SL เสีย ~$${f2(lot * 100 * sl)} (${s.risk}% ของทุน)` };
};

function lotHtml(sl) {
  const l = window.lotFor(sl);
  return l ? `<p class="lot">📏 <b>${l.text}</b></p>`
    : `<p class="lot">📏 0.01 lot เสี่ยง ~$${f2(sl)} · <a href="#account">ใส่ทุนของคุณ</a> แล้วระบบจะคำนวณขนาดไม้ให้</p>`;
}

async function refreshThb() {
  try {
    const j = await getJson('https://open.er-api.com/v6/latest/USD');
    if (j.rates && j.rates.THB) state.thb = j.rates.THB;
  } catch (e) { /* only needed for capital in baht */ }
}

// High-impact US news from investing.com's economic calendar (grouped by release time)
async function refreshNews() {
  try {
    const j = await getJson('https://endpoints.investing.com/pd-instruments/v1/calendars/economic/events/occurrences?domain_id=1&limit=60&country_ids=5&importances=high');
    const names = Object.fromEntries((j.events || []).map((e) => [e.event_id, e.short_name || e.long_name]));
    const byTime = new Map();
    (j.occurrences || []).forEach((o) => {
      const t = Date.parse(o.occurrence_time);
      byTime.set(t, [...(byTime.get(t) || []), names[o.event_id] || 'US data']);
    });
    state.news = [...byTime.entries()].sort((a, b) => a[0] - b[0])
      .map(([time, ts]) => ({ time, title: [...new Set(ts)].join(' · ').slice(0, 120) }));
  } catch (e) { /* calendar is optional */ }
  s15Cache.clear(); // news blackouts change past decisions
  renderIntra();
  refresh15();
}

// Today's high-impact news as a timeline (passed / happening now / coming)
function newsTimelineHtml(now) {
  const w = INTRA.RULE.newsMin * 60e3;
  const close = INTRA.nextClose(now);
  const list = (state.news || []).filter((n) => n.time >= now - 3 * 3600e3 && n.time <= close);
  const head = `<h4>📰 ข่าวแรงสหรัฐ <span class="muted small">(งดเปิดไม้ใหม่ ±${INTRA.RULE.newsMin} นาทีรอบข่าว)</span></h4>`;
  if (!list.length) return `${head}<p class="muted small">ไม่มีข่าวแรงจนถึงตลาดปิด ${SIG.mt(now, '03:00')} น.</p>`;
  return `${head}<ul class="tl">${list.map((n) => {
    const cls = Math.abs(n.time - now) <= w ? 'now' : n.time < now ? 'past' : '';
    const mins = Math.round((n.time - now) / 60e3);
    const when = cls === 'now' ? ' · ⚠️ ช่วงงดเทรด' : mins > 0 ? ` · อีก ${mins >= 60 ? `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที` : `${mins} นาที`}` : '';
    return `<li class="${cls}"><span class="mono">${hhmm(n.time)}</span>${n.title}${when}</li>`;
  }).join('')}</ul>`;
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

// Chart colours follow the light / dark theme
function applyChartTheme() {
  const dark = UI.theme() === 'dark';
  const c = dark
    ? { text: '#8a93a3', grid: '#1b212c', border: '#262e3b', cross: '#6b7686', label: '#2a3140' }
    : { text: '#5b6475', grid: '#eceff4', border: '#e2e7ef', cross: '#9aa4b5', label: '#1c2433' };
  const opts = {
    layout: { textColor: c.text },
    grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
    rightPriceScale: { borderColor: c.border }, timeScale: { borderColor: c.border },
    crosshair: { vertLine: { color: c.cross, labelBackgroundColor: c.label }, horzLine: { color: c.cross, labelBackgroundColor: c.label } },
  };
  [mainChart, rsiChart, macdChart, ...Object.values(eqCharts).map((e) => e.chart), ...(s15Chart ? [s15Chart.chart] : []), ...(tcView ? [tcView.chart] : [])].forEach((ch) => ch.applyOptions(opts));
  simpleChart.applyOptions({ ...opts, grid: { vertLines: { visible: false }, horzLines: { color: c.grid } } });
}
UI.on('theme', applyChartTheme);
applyChartTheme();

// Refit charts when their tab becomes visible
UI.on('tab:stats', () => setTimeout(renderStats, 50));
UI.on('settings', () => { renderSignalHome(); renderIntra(); renderStats(); });
UI.on('tab:chart', () => setTimeout(() => {
  simpleChart.timeScale().fitContent();
  const n = state.bars.length;
  if (n) mainChart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 6 });
}, 50));

// Poll only while the tab is visible; catch up immediately when it becomes visible again
function every(ms, fn) {
  setInterval(() => { if (!document.hidden) fn(); }, ms);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { startStream(); refreshTick(); refreshTech(); refreshPrice(); refreshIntraCandles(); } });

(async function init() {
  await AUTH.ready;
  renderTechTables();
  SPLASH.step('กำลังดึงราคาทองจาก investing.com…', 45);
  buildMeter();
  const pending = [
    refreshThb(), refreshNews(), refreshM15(), refreshDaily(), refreshPrice(),
    refreshTick().then(() => SPLASH.step('ได้ราคาสดแล้ว · กำลังโหลดสถิติ 2 ปี…', 60)),
    refreshSignals().then(refreshIntraCandles).then(() => SPLASH.step('กำลังคำนวณโอกาสแต่ละจุด…', 80)),
    refreshTech().then(() => SPLASH.step('กำลังวิเคราะห์ทุกกรอบเวลา…', 90)),
  ];
  await Promise.all(pending);
  render();
  UI.start();
  SPLASH.hide();
  // Home is real time: live price every 3 s, trend candles every 30 s. The trader chart reloads
  // every 3 s only while it's on screen.
  // Live price: investing.com's stream (~1 tick a second). 1-minute candles every 3 s only while the
  // stream is down, otherwise every ~21 s for the sparkline history. Fewer REST calls also keeps
  // investing.com from rate-limiting the visitor (it blocked us at ~1 request a second).
  startStream();
  let ticks = 0, prices = 0;
  every(POLL_PRICE, () => { if (!streamFresh() || ++ticks % 7 === 0) refreshTick(); });
  every(POLL_PRICE, () => { if (location.hash === '#chart' || ++prices % 20 === 0) refreshPrice(); });
  setInterval(() => { if (state.tickAt) renderLiveStatus(); renderCycle(); }, 1000);
  every(POLL_TECH, refreshTech);
  every(POLL_DAILY, refreshDaily);
  every(60e3, refreshM15);
  every(60e3, refreshIntraCandles);
  every(30 * 60e3, refreshNews);
  every(60 * 60e3, refreshThb);
  every(5 * 60e3, refreshSignals);
  refreshBeat();
  every(5 * 60e3, refreshBeat);
})();
