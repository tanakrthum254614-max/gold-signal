// Chart tab: where to enter, on the chart itself, for every timeframe.
// Timeframes with a backtested system get its entry zones (background), ▲ entries / ● exits replayed over the
// candles on screen, and the open trade's entry / SL / TP lines. Timeframes without a system that passed the
// test only get a direction tint, and the box above the chart says so. Uses main.js globals (state, candles, …).
(function () {
  const $ = (id) => document.getElementById(id);
  const M = 60e3;
  // One system per timeframe: the same 3-timeframe score (buy at +5, no chasing above the Bollinger band) with the
  // chart timeframe as the fast frame. bt = 2-year backtest after a $0.4 spread, half-years oldest → newest, $/oz
  // (scratchpad research 6 Oct 2026, Binance PAXG). mult scales the $15 stop and $15/20/30 targets.
  const BUY5 = { ...INTRA.RULE, threshold: 5, sides: 'buy', noChase: true };
  const SYS = {
    '5m': { frames: [['m5', 5 * M, 60, '5 นาที'], ['m30', 30 * M, 60, '30 นาที'], ['h1', 60 * M, 60, '1 ชม.']], rule: BUY5, mult: 1, bt: [90, 342, 352, -417] },
    '15m': { frames: INTRA.FRAMES15, rule: BUY5, mult: 1, bt: [61, 480, 305, -53] },
    '30m': { frames: INTRA.FRAMES, rule: BUY5, mult: 1, bt: [135, 429, 218, -31] },
    // the only one that made money in all four half-years (also with a 1.5× stop: +194/+220/+101/+58)
    '1h': { frames: [['h1', 60 * M, 60, '1 ชม.'], ['h4', 240 * M, 60, '4 ชม.'], ['h5', 300 * M, 40, '5 ชม.']], rule: BUY5, mult: 2, bt: [166, 145, 383, 57] },
    '5h': { note: 'กรอบใหญ่: แท่งน้อยเกินกว่าจะมีจุดเข้าระหว่างวัน' },
    '1d': { note: 'กรอบรายวัน: ใช้ดูทิศทางของสัปดาห์' },
    '1w': { note: 'กรอบรายสัปดาห์: ใช้ดูภาพใหญ่' },
  };
  // 4-hour candles (only the 1-hour system needs them): Binance PAXG shifted to spot, like the backtest
  async function refreshH4() {
    try { state.h4 = msBars(await backupBars('4h', 200)); } catch (e) { /* keep last */ }
  }
  refreshH4(); setInterval(refreshH4, 10 * 60e3);
  const levelsFor = (sys, price) => ({ sl: price - INTRA.RULE.slUsd * sys.mult, tps: INTRA.RULE.tpUsd.map((u) => price + u * sys.mult) });
  const ms = (bars) => bars.map((b) => ({ ...b, time: b.time < 1e12 ? b.time * 1000 : b.time }));
  // Candles for a frame key, all with times in ms
  function frameBars(key, chart) {
    const C = state.intraCandles || {};
    if (key === 'chart') return chart;
    if (key === 'm15') return state.m15;
    if (key === 'h4') return state.h4 || [];
    return C[key] || [];
  }

  // Replay the system over the candles on screen (same rules as the backtest: one trade at a time)
  const cache = new Map();
  function replay(tf, sys, chart) {
    const dur = sys.frames[0][1], now = Date.now();
    const data = Object.fromEntries(sys.frames.map(([k]) => [k, frameBars(k === sys.frames[0][0] ? 'chart' : k, chart)]));
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
      if (dec === undefined) { dec = INTRA.decideWith(sys.frames, sys.rule, data, t, state.news); if (t < last && dec) cache.set(key, dec); }
      decs.push({ t, dec });
      if (!dec || !dec.dir || t < busy) continue;
      const tr = INTRA.makeTrade(dec, chart[i - 1].close, t);
      if (sys.mult !== 1) { const L = levelsFor(sys, tr.entry); tr.sl = SIG.round(L.sl); tr.tps = L.tps.map(SIG.round); tr.tp = tr.tps[0]; }
      const r = SIG.evaluate(tr, chart.slice(i), now);
      trades.push(r);
      busy = SIG.isFinal(r) ? (r.exitAt || r.expiresAt) + dur : Infinity;
    }
    return { decs, trades, current: INTRA.decideWith(sys.frames, sys.rule, data, now, state.news, true) };
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
  function setBox(cls, html) {
    each((v) => {
      const el = $(v.box); if (!el) return;
      el.className = `cz-box ${cls}`; el.innerHTML = html;
      el.querySelectorAll('[data-tf]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setTf(a.dataset.tf); }));
    });
  }
  const sec = (t) => Math.floor(t / 1000) + TZ;
  const usd = (v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toLocaleString('en-US')}`;

  function markers(trades, from) {
    const out = [];
    trades.forEach((r) => {
      if (r.createdAt < from) return;
      out.push({ time: sec(r.createdAt), position: 'belowBar', color: '#0f9f6e', shape: 'arrowUp', text: 'ซื้อ' });
      if (SIG.isFinal(r) && r.exitAt) {
        const win = r.pnl > 0;
        out.push({ time: sec(r.exitAt), position: win ? 'aboveBar' : 'belowBar', color: win ? '#0f9f6e' : '#e0424f', shape: 'circle',
          text: r.closedBy === 'sl' ? 'SL' : r.closedBy === 'be' ? 'ทุน' : r.hit ? `TP${r.hit}` : 'ปิด' });
      }
    });
    return out.sort((a, b) => a.time - b.time);
  }

  // Draw for the current timeframe; key = what's drawn, so ticks don't redraw everything
  window.renderChartZones = function () {
    if (!state.bars.length) return;
    const tf = state.tf, sys = SYS[tf];
    const chart = ms(state.bars);
    each((v) => { v.lines.forEach((l) => v.series.removePriceLine(l)); v.lines = []; });
    if (!sys || !sys.frames) {
      // No tested system: direction tint from this timeframe's own indicators
      const an = TA.analyze(state.bars), k = an.label.key;
      const tint = k.includes('buy') ? 'rgba(15,159,110,.07)' : k.includes('sell') ? 'rgba(224,66,79,.07)' : 'rgba(0,0,0,0)';
      const zd = state.bars.map((b) => ({ time: b.time + TZ, value: 1, color: tint }));
      each((v) => { v.zone.setData(zd); v.series.setMarkers([]); });
      window.CZ_OPEN = null;
      if (window.drawPositionBoxes) drawPositionBoxes();
      setBox('none', `<b>🧭 กรอบ ${TF_LABEL[tf]}: ใช้ดูทิศทางเท่านั้น — ไม่มีจุดเข้า</b>
        <span>ตอนนี้ภาพรวม${an.label.th} (พื้นหลัง${k.includes('buy') ? 'เขียว' : k.includes('sell') ? 'แดง' : 'ใส'}) · ${sys && sys.note ? sys.note : 'ระบบจุดเข้ายังไม่ผ่านการทดสอบในกรอบนี้'} · ดูจุดเข้าที่ทดสอบแล้วในกรอบ <a href="#" data-tf="15m">15 นาที</a> / <a href="#" data-tf="30m">30 นาที</a> / <a href="#" data-tf="1h">1 ชม.</a></span>`);
      return;
    }
    const s = replay(tf, sys, chart);
    const byT = new Map(s.decs.map((d) => [d.t, d.dec]));
    const zd = state.bars.map((b) => {
      const d = byT.get(b.time * 1000);
      const color = !d || d.stale ? 'rgba(0,0,0,0)' : d.news ? 'rgba(240,180,41,.20)' : d.dir > 0 ? 'rgba(15,159,110,.20)'
        : d.score >= 3 ? 'rgba(15,159,110,.07)' : d.score <= -3 ? 'rgba(224,66,79,.06)' : 'rgba(0,0,0,0)';
      return { time: b.time + TZ, value: 1, color };
    });
    const mk = markers(s.trades, chart[0].time);
    each((v) => { v.zone.setData(zd); v.series.setMarkers(mk); });
    const open = s.trades.find((r) => r.status === 'active');
    window.CZ_OPEN = open || null;
    if (window.drawPositionBoxes) drawPositionBoxes();
    const line = (price, color, title, style) => each((v) => v.lines.push(v.series.createPriceLine({ price, color, title, lineStyle: style, lineWidth: 2, axisLabelVisible: true })));
    if (open) {
      line(open.entry, '#d99a10', 'เข้าซื้อ', LC.LineStyle.Solid);
      line(open.hit ? open.entry : open.sl, '#e0424f', open.hit ? 'SL→ทุน' : 'SL', LC.LineStyle.Dashed);
      open.tps.forEach((tp, k) => line(tp, '#0f9f6e', `TP${k + 1}`, LC.LineStyle.Dashed));
    }
    // Status box: what to do now on this timeframe
    const d = s.current, price = state.bars[state.bars.length - 1].close;
    const need = d ? sys.rule.threshold - d.score : null;
    let head, cls;
    if (open) { head = `📌 อยู่ในไม้ซื้อ — เข้า ${f2(open.entry)} · SL ${f2(open.hit ? open.entry : open.sl)} · TP ${open.tps.map(f2).join(' / ')}`; cls = 'hold'; }
    else if (!d) { head = 'กำลังคำนวณ…'; cls = 'wait'; }
    else if (d.stale) { head = '🌙 ตลาดปิด — ไม่มีจุดเข้า'; cls = 'wait'; }
    else if (d.dir > 0) { const L = levelsFor(sys, price); head = `✅ โซนเข้าซื้อ (พื้นหลังเขียวเข้ม) — ถ้าแท่งนี้ปิดแล้วยังได้ ${signedScore(d.score)} เข้าที่ ~${f2(price)} · SL ${f2(L.sl)} · TP ${L.tps.map(f2).join(' / ')}`; cls = 'go'; }
    else if (d.stretched) { head = `⏸ คะแนนถึง ${signedScore(d.score)} แต่ราคายืดเกินขอบบน Bollinger — รอราคาย่อกลับเข้ากรอบ แล้วจะเป็นโซนเข้า`; cls = 'near'; }
    else if (d.news) { head = '⏸ ช่วงข่าวแรง — งดเข้า (พื้นหลังเหลือง)'; cls = 'wait'; }
    else if (d.score >= 3) { head = `⏳ ใกล้โซนเข้า — คะแนน ${signedScore(d.score)} ขาดอีก ${need} (พื้นหลังเขียวอ่อน)`; cls = 'near'; }
    else if (d.score <= -3) { head = `❌ ไม่ใช่โซนซื้อ — แนวโน้มลง ${signedScore(d.score)} (ระบบไม่เข้าฝั่งขาย สถิติขายแพ้มากกว่า)`; cls = 'no'; }
    else { head = `⏸ ยังไม่มีโซนเข้า — คะแนน ${signedScore(d.score)} ต้อง +${sys.rule.threshold}`; cls = 'wait'; }
    const fin = s.trades.filter((r) => SIG.isFinal(r)), pnl = fin.reduce((a, r) => a + r.pnl, 0);
    setBox(cls, `<b>${head}</b>
      ${sys.bt.every((v) => v > 0) ? '<i class="cz-ok">✅ กำไรทุกครึ่งปีในการทดสอบ</i>' : '<i class="cz-warn">⚠️ ครึ่งปีล่าสุดขาดทุนในการทดสอบ</i>'}
      <span>ระบบกรอบ ${TF_LABEL[tf]}: ${sys.frames.map((f) => f[3]).join(' + ')} ชี้ขึ้นพร้อมกัน (คะแนน ≥ +${sys.rule.threshold}) · SL $${INTRA.RULE.slUsd * sys.mult} · TP $${INTRA.RULE.tpUsd.map((u) => u * sys.mult).join('/')} · บนกราฟนี้ ${fin.length} ไม้ ${fin.length ? `รวม ${usd(SIG.round(pnl))}` : ''}
      · <b>ทดสอบ 2 ปี</b> ${sys.bt.map(usd).join(' / ')} (ครึ่งปี เก่า→ใหม่, หลังสเปรด)</span>`);
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
    if (t) return { side: 1, entry: t.entry, sl: t.hit ? t.entry : t.sl, tps: t.tps, since: t.createdAt, who: 'ระบบที่ทดสอบแล้ว' };
    const L = state.locked;
    if (!L || L.action === 'WAIT' || L.entry == null) return null;
    return { side: L.action === 'BUY' ? 1 : -1, entry: L.entry, sl: L.sl, tps: [L.tp1, L.tp2].filter((v) => v != null), since: L.since, who: 'บทวิเคราะห์ investing.com' };
  }
  function draw(b) {
    const p = currentPlan();
    // Room on the right for the box while there is an entry (like a platform's position tool)
    const off = p ? 16 : 6;
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
      { y: ye, cls: `entry ${buy ? 'buy' : 'sell'}`, h: 30, html: `🎯 ${buy ? 'ซื้อ' : 'ขาย'} <b>${f2(p.entry)}</b> <small>${p.who}</small>` },
      { y: ys, cls: 'sl', h: 20, html: `SL ${f2(p.sl)} · −$${f2(risk)}` },
      ...p.tps.map((tp, i) => ({ y: y(tp), cls: 'tp', h: 20, html: `${p.tps.length > 1 ? `TP${i + 1}` : 'TP'} ${f2(tp)} · +$${f2(Math.abs(tp - p.entry))}${risk ? ` · ${(Math.abs(tp - p.entry) / risk).toFixed(1)}R` : ''}` })),
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
