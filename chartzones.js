// Chart tab: where to enter, on the chart itself, for every timeframe.
// Every timeframe has its own backtested settings: a small up / down arrow on each closed candle, entry zones,
// big labelled ▲ buy / ▼ sell entries and exits replayed over the candles on screen, and the open trade's entry / SL / TP
// lines. A side that failed its test gives no entries. Uses main.js globals (state, candles, …).
// Thai clock time + how long ago, so an hours-old entry never reads like "buy now"
const clock = (ms) => new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
function ago(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60e3));
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${m} นาทีก่อน`;
  if (m < 24 * 60) return `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ''}ก่อน`;
  return `${Math.floor(m / 1440)} วันก่อน`;
}
(function () {
  const $ = (id) => document.getElementById(id);
  const M = 60e3, H = 60 * M, DAY = 24 * H;
  const { SYS, usdList, levelsFor, maxScore, dirOf, stretched } = CHARTSYS;
  // Slower candles the systems need: Binance PAXG shifted to spot, like the backtest
  async function refreshSlow() {
    for (const [k, iv] of [['h4', '4h'], ['d1', '1d'], ['w1', '1w']]) {
      try { state[k] = msBars(await backupBars(iv, 200)); } catch (e) { /* keep last */ }
    }
  }
  refreshSlow(); setInterval(refreshSlow, 10 * 60e3);
  const ms = (bars) => bars.map((b) => ({ ...b, time: b.time < 1e12 ? b.time * 1000 : b.time }));
  function frameBars(key) {
    const C = state.intraCandles || {};
    if (key === 'm15') return state.m15;
    if (['h4', 'd1', 'w1'].includes(key)) return state[key] || [];
    return C[key] || [];
  }
  const when = (sys, t) => (sys.frames[0][1] >= DAY
    ? new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })
    : sys.long ? new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : clock(t));

  // Replay over the candles on screen (same rules as the backtest: one trade at a time)
  const cache = new Map();
  function replay(tf, sys, chart) {
    const dur = sys.frames[0][1], now = Date.now();
    const data = Object.fromEntries(sys.frames.map(([k]) => [k, frameBars(k)]));
    data[sys.frames[0][0]] = chart;
    const decs = [], trades = [];
    let busy = 0;
    const last = Math.floor(now / dur) * dur;
    for (let i = 60; i < chart.length; i++) {
      const t = chart[i].time; // decision at the open of candle i = on candles closed before it
      if (t > last) break;
      const key = `${tf}|${t}`;
      let dec = cache.get(key);
      // empty result = data still loading: don't cache it, try again next time
      if (dec === undefined) { dec = CHARTSYS.decide(sys, data, t, state.news); if (t < last && dec) cache.set(key, dec); }
      decs.push({ t, dec });
      const dir = dirOf(sys, dec);
      if (!dir || t < busy) continue;
      const r = SIG.evaluate(CHARTSYS.trade(sys, dec, dir, chart[i - 1].close, t), chart.slice(i), now);
      trades.push(r);
      busy = SIG.isFinal(r) ? (r.exitAt || r.expiresAt) + dur : Infinity;
    }
    return { decs, trades, current: CHARTSYS.decide(sys, data, now, state.news, true) };
  }

  // Drawn on both chart views: trader (candles) and simple (price area)
  const views = [];
  function getViews() {
    if (!views.length) [[mainChart, candles, 'czBox'], [simpleChart, areaS, 'czBoxS']].forEach(([chart, series, box]) => {
      const zone = chart.addHistogramSeries({ priceScaleId: 'cz', priceLineVisible: false, lastValueVisible: false, base: 0 });
      chart.priceScale('cz').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
      views.push({ series, zone, box, lines: [] });
    });
    return views;
  }
  const each = (fn) => getViews().forEach(fn);
  // Accuracy / details under the status: folded on phones, open on wider screens; the reader's choice is kept
  let moreOpen = window.innerWidth > 640;
  function setBox(cls, html) {
    each((v) => {
      const el = $(v.box); if (!el) return;
      el.className = `cz-box ${cls}`; el.innerHTML = html;
      const more = el.querySelector('.cz-more');
      if (more) more.addEventListener('toggle', () => { moreOpen = more.open; });
      el.querySelectorAll('[data-tf]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setTf(a.dataset.tf); }));
      // 🧮 → the lot calculator on the signals tab, filled with this signal's entry / SL / TP1
      el.querySelectorAll('[data-calc]').forEach((b) => b.addEventListener('click', () => {
        const [side, entry, sl, tp] = b.dataset.calc.split(',').map(Number);
        if (!window.fillCalc) return;
        fillCalc(side, entry, sl, tp);
        location.hash = 'home';
        setTimeout(() => { const c = $('tpCalc'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250);
      }));
    });
  }
  const sec = (t) => Math.floor(t / 1000) + TZ;
  const usd = (v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toLocaleString('en-US')}`;

  function markers(sys, trades, from, decs) {
    const out = [];
    // every closed candle: small up / down arrow from the score's lean (no text; entries get the big labelled ones)
    const taken = new Set(trades.map((r) => r.createdAt));
    decs.forEach(({ t, dec }) => {
      if (t < from || !dec || (!sys.long && dec.stale) || !dec.lean || taken.has(t)) return;
      const up = dec.lean > 0;
      out.push({ time: sec(t), position: up ? 'belowBar' : 'aboveBar', shape: up ? 'arrowUp' : 'arrowDown', size: 0.5,
        color: up ? 'rgba(15,159,110,.55)' : 'rgba(224,66,79,.55)' });
    });
    trades.forEach((r) => {
      if (r.createdAt < from) return;
      const buy = r.side !== 'SELL';
      out.push({ time: sec(r.createdAt), position: buy ? 'belowBar' : 'aboveBar', color: buy ? '#0f9f6e' : '#e0424f', shape: buy ? 'arrowUp' : 'arrowDown', text: `${buy ? 'ซื้อ' : 'ขาย'} ${when(sys, r.createdAt)}` });
      if (SIG.isFinal(r) && r.exitAt) {
        const win = r.pnl > 0;
        out.push({ time: sec(r.exitAt), position: win ? 'aboveBar' : 'belowBar', color: win ? '#0f9f6e' : '#e0424f', shape: 'circle',
          text: r.closedBy === 'sl' ? 'SL' : r.closedBy === 'be' ? 'ทุน' : r.hit ? `TP${r.hit}` : 'ปิด' });
      }
    });
    return out.sort((a, b) => a.time - b.time);
  }
  const sideText = (c) => `SL $${Math.round(15 * c.mult)} · ${c.tp1 ? 'TP1' : 'TP'} $${usdList(c).join('/')}`;

  // Draw for the current timeframe
  window.renderChartZones = function () {
    if (!state.bars.length) return;
    const tf = state.tf, sys = SYS[tf];
    if (!sys) return;
    const chart = ms(state.bars), dur = sys.frames[0][1], max = maxScore(sys);
    each((v) => { v.lines.forEach((l) => v.series.removePriceLine(l)); v.lines = []; });
    const s = replay(tf, sys, chart);
    const byT = new Map(s.decs.map((d) => [d.t, d.dec]));
    const zd = state.bars.map((b) => {
      const d = byT.get(b.time * 1000), dir = dirOf(sys, d);
      const color = !d || (!sys.long && d.stale) ? 'rgba(0,0,0,0)' : !sys.long && d.news ? 'rgba(240,180,41,.20)' : dir > 0 ? 'rgba(15,159,110,.20)' : dir < 0 ? 'rgba(224,66,79,.20)'
        : d.score >= max / 2 ? 'rgba(15,159,110,.07)' : d.score <= -max / 2 ? 'rgba(224,66,79,.06)' : 'rgba(0,0,0,0)';
      return { time: b.time + TZ, value: 1, color };
    });
    const mk = markers(sys, s.trades, chart[0].time, s.decs);
    each((v) => { v.zone.setData(zd); v.series.setMarkers(mk); });
    const open = s.trades.find((r) => r.status === 'active');
    window.CZ_OPEN = open || null;
    if (window.drawPositionBoxes) drawPositionBoxes();
    const line = (price, color, title, style) => each((v) => v.lines.push(v.series.createPriceLine({ price, color, title, lineStyle: style, lineWidth: 2, axisLabelVisible: true })));
    if (open) {
      line(open.entry, '#d99a10', open.side === 'SELL' ? 'เข้าขาย' : 'เข้าซื้อ', LC.LineStyle.Solid);
      line(open.hit ? open.entry : open.sl, '#e0424f', open.hit ? 'SL→ทุน' : 'SL', LC.LineStyle.Dashed);
      open.tps.forEach((tp, k) => line(tp, '#0f9f6e', `TP${k + 1}`, LC.LineStyle.Dashed));
    }

    // 1) the latest closed candle's direction  2) what to do now  3) how accurate each side tested
    const d = s.current, price = state.bars[state.bars.length - 1].close, dir = dirOf(sys, d);
    const B = sys.buy, S = sys.sell;
    const lastC = s.decs.slice().reverse().find((x) => x.dec && (sys.long || !x.dec.stale));
    let pill = '';
    if (lastC && (sys.long || !(d && d.stale))) {
      const up = lastC.dec.lean > 0, dn = lastC.dec.lean < 0;
      pill = `<span class="cz-5m ${up ? 'up' : dn ? 'down' : 'flat'}">${up ? '▲ ขึ้น' : dn ? '▼ ลง' : '• ทรงตัว'}</span> ทิศกรอบ ${TF_LABEL[tf]} (แท่ง ${when(sys, lastC.t - dur)} ปิดแล้ว · คะแนน ${signedScore(lastC.dec.score)}/±${max}) · รอบถัดไป ${when(sys, lastC.t + dur)}<br>`;
    }
    const live = ((state.chartSig && state.chartSig.trades) || []).filter((x) => x.tf === tf);
    const br = CHARTSYS.brake(sys, live, Date.now());
    let head, cls, calcArgs = null;
    const sellNo = !S && d && B && d.score <= -B.th;
    if (open) { const sell = open.side === 'SELL'; head = `📌 อยู่ในไม้${sell ? 'ขาย (SELL)' : 'ซื้อ (BUY)'} ตั้งแต่ ${when(sys, open.createdAt)} — เข้า ${f2(open.entry)} · SL ${f2(open.hit ? open.entry : open.sl)}${open.hit ? ' (ที่ทุน)' : ''} · ${open.tps.map((v, k) => `TP${k + 1} ${f2(v)}`).join(' · ')}`; cls = sell ? 'hold sell' : 'hold'; calcArgs = [sell ? -1 : 1, open.entry, open.hit ? open.entry : open.sl, open.tps[0]]; }
    else if (!d) { head = 'กำลังคำนวณ… (รอกราฟกรอบใหญ่)'; cls = 'wait'; }
    else if (!sys.long && d.stale) { head = '🌙 ตลาดปิด — ไม่มีจุดเข้า'; cls = 'wait'; }
    else if (dir) {
      const c = dir > 0 ? B : S, L = levelsFor(c, price, dir);
      head = `${dir > 0 ? '🟢 สัญญาณ BUY (ซื้อ)' : '🔴 สัญญาณ SELL (ขาย)'} — ถ้าแท่งนี้ปิดแล้วยังได้ ${signedScore(d.score)} เข้าที่ ~${f2(price)} · SL ${f2(L.sl)} · ${L.tps.map((v, k) => `TP${k + 1} ${f2(v)}`).join(' · ')}`;
      cls = dir > 0 ? 'go' : 'no sell';
      calcArgs = [dir, price, L.sl, L.tps[0]];
      if (br) { head = `⛔ (พักอยู่ — ไม่แนะนำเข้า) ${head}`; cls = 'wait'; calcArgs = null; }
    }
    else if (stretched(sys, d)) { head = `⏸ คะแนนถึง ${signedScore(d.score)} แต่ราคายืดเกินขอบ${d.score > 0 ? 'บน' : 'ล่าง'} Bollinger — รอราคากลับเข้ากรอบก่อน`; cls = 'near'; }
    else if (!sys.long && d.news) { head = '⏸ ช่วงข่าวแรง — งดเข้า (พื้นหลังเหลือง)'; cls = 'wait'; }
    else if (!sys.long && d.lastHour) { head = '⏸ ใกล้ตลาดปิด — งดเปิดไม้ใหม่'; cls = 'wait'; }
    else if (sellNo) { head = `⚠️ แนวโน้มลง ${signedScore(d.score)} แต่กรอบนี้ไม่ให้สัญญาณ SELL — ฝั่งขายทดสอบไม่ผ่าน · ใช้ดูทิศเท่านั้น (SELL ที่ทดสอบผ่าน: <a href="#" data-tf="5m">กรอบ 5 นาที</a>)`; cls = 'no'; }
    else if (B && d.score > 0 && d.score >= B.th - 2) { head = `⏳ ใกล้สัญญาณ BUY — คะแนน ${signedScore(d.score)} ขาดอีก ${B.th - d.score}`; cls = 'near'; }
    else if (S && d.score < 0 && d.score <= -(S.th - 2)) { head = `⏳ ใกล้สัญญาณ SELL — คะแนน ${signedScore(d.score)} ขาดอีก ${S.th + d.score}`; cls = 'near'; }
    else { head = `⏸ รอก่อน — คะแนน ${signedScore(d.score)} · BUY ต้อง +${B.th}${S ? ` · SELL ต้อง −${S.th}` : ''}`; cls = 'wait'; }
    const note = $('sigNote');
    if (note) note.innerHTML = open
      ? `📌 <b>ระบบบนกราฟถือไม้${open.side === 'SELL' ? 'ขาย' : 'ซื้อ'}อยู่</b> ตั้งแต่ ${when(sys, open.createdAt)} — ไม่ต้องเปิดไม้ใหม่ · การ์ดนี้คือบทวิเคราะห์ภาพรวม คนละระบบกับจุดเข้าบนกราฟ`
      : 'การ์ดนี้คือบทวิเคราะห์ภาพรวม — คนละระบบกับจุดเข้าบนกราฟ (กล่องด้านซ้าย)';
    const acc = (name, c, q) => {
      if (!c) return `<i class="cz-warn">${name}: ทดสอบไม่ผ่าน${q ? ` (${q.map(usd).join(' / ')})` : ''} — ไม่ให้สัญญาณ</i>`;
      const pos = c.q.filter((v) => v > 0).length;
      return `<i class="${pos === 4 ? 'cz-ok' : 'cz-warn'}">${pos === 4 ? '✅' : '⚠️'} ${name}: ชนะ ${c.win}% · กำไร ${pos}/4 ช่วง (${c.q.map(usd).join(' / ')})</i>`;
    };
    const fin = s.trades.filter((r) => SIG.isFinal(r)), pnl = fin.reduce((a, r) => a + r.pnl, 0);
    if (br) head = `<span class="cz-brake">⛔ พักสัญญาณกรอบนี้: ${br.why} — ${br.until ? `ถึง ${when(SYS['1d'], br.until)}` : 'จนกว่าผล 20 ไม้ล่าสุดจะดีขึ้น'} · ระบบยังบันทึกต่อ</span><br>${head}`;
    const calcBtn = calcArgs ? `<button type="button" class="btn cz-calc" data-calc="${calcArgs.map((v) => SIG.round(v)).join(',')}">🧮 คำนวณ lot จากสัญญาณนี้</button>` : '';
    setBox(cls, `<b>${pill}${pill ? `<small>${head}</small>` : head}</b>${calcBtn}
      <details class="cz-more"${moreOpen ? ' open' : ''}><summary>ความแม่นยำ: BUY ชนะ ${B.win}%${S ? ` · SELL ${S.win}%` : ' · SELL ไม่ให้สัญญาณ'} · รายละเอียด</summary>
      ${acc('BUY', B, null)} ${acc('SELL', S, sys.sellQ)}
      <span>ระบบกรอบ ${TF_LABEL[tf]}: ${sys.frames.map((f) => f[3]).join(' + ')} · BUY ≥ +${B.th} (${sideText(B)})${S ? ` · SELL ≤ −${S.th} (${sideText(S)})` : ''}
      · ทดสอบย้อนหลัง ${sys.span} แบ่ง 4 ช่วงเท่ากัน เก่า→ใหม่ หลังสเปรด ต่อ 1 ออนซ์${sys.few ? ` · ตัวอย่างน้อย (${sys.few} ไม้)` : ''}${sys.long ? ' · ช่วงทดสอบทองเป็นขาขึ้นเกือบตลอด ไม่รับประกันอนาคต' : ''}
      · บนกราฟนี้ ${fin.length} ไม้ปิดแล้ว${fin.length ? ` รวม ${usd(SIG.round(pnl))}` : ''}${open ? ' + 1 ไม้ที่ถืออยู่' : ''}
      · <b>ลูกศรเล็ก</b> = ทิศทุกแท่ง ใช้ดูทิศเท่านั้น${sys.every ? ` (เข้าทุกลูกศร 2 ปี ${usd(sys.every)} ชนะ ~50%)` : ''} · <b>ลูกศรใหญ่มีคำว่าซื้อ/ขาย</b> = สัญญาณเข้า</span></details>`);
  };
})();

// ---------- Position box: the entry drawn like a trading platform's long / short tool ----------
// Red block entry → stop, green block entry → targets, a big entry tag, $ distances. HTML overlay on top of
// the chart, placed with priceToCoordinate / timeToCoordinate; redrawn on every render and scroll / zoom.
(function () {
  const $ = (id) => document.getElementById(id);
  const boxes = [];
  function overlay(chart, series, hostId) {
    const host = $(hostId);
    if (!host) return null;
    host.style.position = 'relative';
    const el = document.createElement('div');
    el.className = 'pbox-layer';
    host.appendChild(el);
    const b = { chart, series, el, plan: null };
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => draw(b));
    new ResizeObserver(() => draw(b)).observe(host);
    boxes.push(b);
    return b;
  }
  // The trade to show: the tested system's open trade first, else the investing.com plan's entry
  function currentPlan() {
    const t = window.CZ_OPEN;
    if (t) return { be: !!t.hit, side: t.side === 'SELL' ? -1 : 1, entry: t.entry, sl: t.hit ? t.entry : t.sl, tps: t.tps, since: t.createdAt, who: 'ระบบที่ทดสอบแล้ว' };
    const L = state.locked;
    if (!L || L.action === 'WAIT' || L.entry == null) return null;
    return { side: L.action === 'BUY' ? 1 : -1, entry: L.entry, sl: L.sl, tps: [L.tp1].filter((v) => v != null), since: L.since, who: 'บทวิเคราะห์ investing.com' };
  }
  function draw(b) {
    const p = currentPlan();
    // Room on the right for the box while there is an entry (like a platform's position tool)
    const off = p ? 8 : 6;
    if (b.off !== off) { b.off = off; b.chart.timeScale().applyOptions({ rightOffset: off }); }
    if (!p || !state.bars.length) { b.html = b.el.innerHTML = ''; return; }
    const ts = b.chart.timeScale(), y = (v) => b.series.priceToCoordinate(v);
    // Plot width = chart width − right price scale (timeScale().width() is 0 when the time axis is hidden)
    const right = b.chart.priceScale('right').width(), W = b.el.clientWidth - right;
    // Start at the candle the call was made in (snapped to a candle time), or the left edge if it is off screen
    const bars = state.bars, since = p.since / 1000;
    let k = bars.length - 1; while (k > 0 && bars[k].time > since) k--;
    let x0 = since < bars[0].time ? 0 : ts.timeToCoordinate(bars[k].time + TZ);
    if (x0 == null) x0 = 0;
    x0 = Math.max(0, Math.min(W - 170, x0)); // a fresh entry still gets a box wide enough to read
    const ye = y(p.entry), ys = y(p.sl), yt = y(p.tps[p.tps.length - 1]);
    if (ye == null || ys == null || yt == null || !W) { b.html = b.el.innerHTML = ''; return; }
    const rect = (ya, yb, cls) => `<div class="pbox ${cls}" style="left:${x0}px;width:${W - x0}px;top:${Math.min(ya, yb)}px;height:${Math.max(2, Math.abs(ya - yb))}px"></div>`;
    const buy = p.side > 0, risk = Math.abs(p.entry - p.sl);
    // Tags sit at the right edge next to the price scale; spread apart vertically when prices are close
    const tags = [
      { y: ye, cls: `entry ${buy ? 'buy' : 'sell'}`, h: 30, html: `🎯 ${buy ? 'ซื้อ' : 'ขาย'} <b>${f2(p.entry)}</b> <small>${p.who}${p.since ? ` · ตั้งแต่ ${clock(p.since)} (${ago(p.since)})` : ''}</small>` },
      { y: ys, cls: 'sl', h: 20, html: p.be ? `SL ที่ทุน ${f2(p.sl)} · ถึง TP1 แล้ว ไม่มีทางขาดทุน` : `SL ${f2(p.sl)} · −${f2(risk)}` },
      ...p.tps.map((tp, i) => ({ y: y(tp), cls: 'tp', h: 20, html: `TP${i + 1} ${f2(tp)} · +$${f2(Math.abs(tp - p.entry))}${risk ? ` · ${(Math.abs(tp - p.entry) / risk).toFixed(1)}R` : ''}` })),
    ].filter((t) => t.y != null).sort((a, b2) => a.y - b2.y);
    for (let i = 1; i < tags.length; i++) {
      const prev = tags[i - 1], min = prev.y + (prev.h + tags[i].h) / 2 + 2;
      if (tags[i].y < min) tags[i].y = min;
    }
    const html = rect(ye, ys, 'loss') + rect(ye, yt, 'win')
      + `<div class="pentry" style="left:${x0}px;width:${W - x0}px;top:${ye}px"></div>`
      + (x0 > 0 ? `<div class="pstart" style="left:${x0}px;top:${ye}px">${buy ? '▲' : '▼'}</div>` : '')
      + tags.map((t) => `<div class="ptag ${t.cls}" style="right:${right + 6}px;top:${t.y}px">${t.html}</div>`).join('');
    if (html !== b.html) { b.html = html; b.el.innerHTML = html; } // only when something moved: no flicker
  }
  window.drawPositionBoxes = function () {
    if (!boxes.length && typeof mainChart !== 'undefined') { overlay(mainChart, candles, 'mainChart'); overlay(simpleChart, areaS, 'simpleChart'); }
    boxes.forEach(draw);
  };
})();
