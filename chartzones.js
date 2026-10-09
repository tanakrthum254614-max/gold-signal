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
  // Accuracy / details under the status: folded by default (less text), the reader's choice is kept
  let moreOpen = false;
  function setBox(cls, html) {
    each((v) => {
      const el = $(v.box); if (!el) return;
      el.className = `cz-box ${cls}`; el.innerHTML = html;
      const more = el.querySelector('.cz-more');
      if (more) more.addEventListener('toggle', () => { moreOpen = more.open; });
      el.querySelectorAll('[data-tf]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); setTf(a.dataset.tf); }));
      // 🧮 → the lot calculator under the chart, filled with this signal's entry / SL / TP1
      el.querySelectorAll('[data-calc]').forEach((b) => b.addEventListener('click', () => {
        const [side, entry, sl, tp] = b.dataset.calc.split(',').map(Number);
        if (!window.fillCalc) return;
        fillCalc(side, entry, sl, tp);
        const c = $('tpCalc'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
    });
  }
  const sec = (t) => Math.floor(t / 1000) + TZ;
  const usd = (v) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toLocaleString('en-US')}`;

  function markers(sys, trades, from, decs) {
    const out = [];
    // every closed candle: small up / down arrow from the score's lean (no text; entries get the big labelled ones)
    const taken = new Set(trades.map((r) => r.createdAt));
    const quiet = window.CZ_CLEAN && CZ_CLEAN();
    decs.forEach(({ t, dec }) => {
      if (quiet) return;
      if (t < from || !dec || (!sys.long && dec.stale) || !dec.lean || taken.has(t)) return;
      const up = dec.lean > 0;
      out.push({ time: sec(t), position: up ? 'belowBar' : 'aboveBar', shape: up ? 'arrowUp' : 'arrowDown', size: 0.5,
        color: up ? 'rgba(15,159,110,.55)' : 'rgba(224,66,79,.55)' });
    });
    trades.forEach((r) => {
      if (r.createdAt < from) return;
      // entry: a big ▲ / ▼ on the candle (always shown, also in the clean view) — the Buy / Sell price tag sits past it
      const buy = r.side !== 'SELL';
      out.push({ time: sec(r.createdAt), position: buy ? 'belowBar' : 'aboveBar', shape: buy ? 'arrowUp' : 'arrowDown', size: 1.6, color: buy ? '#18a058' : '#e0424f' });
      if (SIG.isFinal(r) && r.exitAt) {
        const win = r.pnl > 0;
        out.push({ time: sec(r.exitAt), position: win ? 'aboveBar' : 'belowBar', color: win ? '#0f9f6e' : '#e0424f', shape: 'circle',
          text: r.closedBy === 'sl' ? 'SL' : r.closedBy === 'be' ? 'ทุน' : r.hit ? `TP${r.hit}` : 'ปิด' });
      }
    });
    return out.sort((a, b) => a.time - b.time);
  }
  const sideText = (c) => `SL $${Math.round(15 * c.mult)} · ${c.tp1 ? 'TP1' : 'TP'} $${usdList(c).join('/')}${c.confirm ? ` · ต้องมี ${CHARTSYS.CONFIRM[c.confirm].name} ยืนยัน` : ''}`;

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
    const quiet = window.CZ_CLEAN && CZ_CLEAN();
    each((v) => { v.zone.applyOptions({ visible: !quiet }); v.zone.setData(zd); v.series.setMarkers(mk); });
    if (window.setChartDecor) setChartDecor(s.trades.filter((r) => r.createdAt >= chart[0].time));
    // The recorded live trade (chart-signals.json — what LINE and the signals tab show) wins over this chart's own replay,
    // so every part of the site agrees on whether the system is holding a trade
    const rec = ((state.chartSig && state.chartSig.trades) || []).find((r) => r.tf === tf && !SIG.isFinal(r) && (r.expiresAt || Infinity) > Date.now());
    const open = rec || s.trades.find((r) => r.status === 'active');
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
    // Kept short on purpose (user, 8 Oct: "คำเยอะไป"): direction · % to an entry · the one plan; the rest is folded
    let pill = '', pillFull = '';
    if (lastC && (sys.long || !(d && d.stale))) {
      const up = lastC.dec.lean > 0, dn = lastC.dec.lean < 0;
      pill = `<span class="cz-5m ${up ? 'up' : dn ? 'down' : 'flat'}">${up ? '▲ ขึ้น' : dn ? '▼ ลง' : '• ทรงตัว'}</span> ${TF_LABEL[tf]} · รอบถัดไป ${when(sys, lastC.t + dur)}`;
      pillFull = `ทิศกรอบ ${TF_LABEL[tf]}: แท่ง ${when(sys, lastC.t - dur)} ปิดแล้ว · คะแนน ${signedScore(lastC.dec.score)}/±${max}`;
    }
    const live = ((state.chartSig && state.chartSig.trades) || []).filter((x) => x.tf === tf);
    const br = CHARTSYS.brake(sys, live, Date.now());
    let head, cls, calcArgs = null, waitOnly = false;
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
    else if (CHARTSYS.unconfirmed(sys, d)) { const c = CHARTSYS.CONFIRM[(d.score > 0 ? B : S).confirm]; head = `⏸ คะแนนถึง ${signedScore(d.score)} แต่ ${c.name} ยังไม่ยืนยัน${d.score > 0 ? 'ขาขึ้น' : 'ขาลง'} — รอ${c.wait}`; cls = 'near'; }
    else if (!sys.long && d.news) { head = '⏸ ช่วงข่าวแรง — งดเข้า (พื้นหลังเหลือง)'; cls = 'wait'; }
    else if (!sys.long && d.lastHour) { head = '⏸ ใกล้ตลาดปิด — งดเปิดไม้ใหม่'; cls = 'wait'; }
    else if (sellNo) { head = `⚠️ แนวโน้มลง ${signedScore(d.score)} แต่กรอบนี้ไม่ให้สัญญาณ SELL — ฝั่งขายทดสอบไม่ผ่าน · ใช้ดูทิศเท่านั้น (SELL ที่ทดสอบผ่าน: <a href="#" data-tf="5m">กรอบ 5 นาที</a>)`; cls = 'no'; waitOnly = true; }
    else if (B && d.score > 0 && d.score >= B.th - 2) { head = `⏳ ใกล้สัญญาณ BUY — คะแนน ${signedScore(d.score)} ขาดอีก ${B.th - d.score}`; cls = 'near'; waitOnly = true; }
    else if (S && d.score < 0 && d.score <= -(S.th - 2)) { head = `⏳ ใกล้สัญญาณ SELL — คะแนน ${signedScore(d.score)} ขาดอีก ${S.th + d.score}`; cls = 'near'; waitOnly = true; }
    else { head = `⏸ รอก่อน — คะแนน ${signedScore(d.score)} · BUY ต้อง +${B.th}${S ? ` · SELL ต้อง −${S.th}` : ''}`; cls = 'wait'; waitOnly = true; }
    const note = $('sigNote');
    if (note) note.innerHTML = open
      ? `📌 <b>ระบบบนกราฟถือไม้${open.side === 'SELL' ? 'ขาย' : 'ซื้อ'}อยู่</b> ตั้งแต่ ${when(sys, open.createdAt)} — ไม่ต้องเปิดไม้ใหม่`
      : 'ตัวเลขเดียวกับช่อง Buy | Sell ทางซ้าย';
    const acc = (name, c, q) => {
      if (!c) return `<i class="cz-warn">${name}: ทดสอบไม่ผ่าน${q ? ` (${q.map(usd).join(' / ')})` : ''} — ไม่ให้สัญญาณ</i>`;
      const pos = c.q.filter((v) => v > 0).length;
      return `<i class="${pos === 4 ? 'cz-ok' : 'cz-warn'}">${pos === 4 ? '✅' : '⚠️'} ${name}: ชนะ ${c.win}% · กำไร ${pos}/4 ช่วง (${c.q.map(usd).join(' / ')})</i>`;
    };
    const fin = s.trades.filter((r) => SIG.isFinal(r)), pnl = fin.reduce((a, r) => a + r.pnl, 0);
    if (br) head = `<span class="cz-brake">⛔ พักสัญญาณกรอบนี้: ${br.why} — ${br.until ? `ถึง ${when(SYS['1d'], br.until)}` : 'จนกว่าผล 20 ไม้ล่าสุดจะดีขึ้น'} · ระบบยังบันทึกต่อ</span><br>${head}`;
    // BOTH sides, each in its own column with its own % and verdict (user, 8 Oct: "อยากให้มี 2 ตัว Buy และ Sell คนละช่อง
    // และบอกเปอร์เซ็นต์ของแต่ละอันว่าควรเข้าไหม"). % = how far the score has come toward that side's threshold
    // (100 = signal). A side that failed its backtest uses the Buy threshold mirrored, is labelled ⚠️ and is never
    // "ควรเข้า" — not recorded, no LINE.
    // Shared with the signals tab (main.js) so both always say the same: CHARTSYS.sideInfo
    const sideInfo = (side) => ({ ...CHARTSYS.sideInfo(sys, d, side, br), L: levelsFor((side > 0 ? B : S) || B, price, side) });
    const sides = [sideInfo(1), sideInfo(-1)];
    const col = (x) => `<div class="cz-col ${x.side > 0 ? 'buy' : 'sell'}${x.go ? ' go' : ''}${x.tested ? '' : ' untested'}">
      <div class="cz-col-h"><b>${x.side > 0 ? '🟢 Buy' : '🔴 Sell'}</b><span class="cz-verdict">${x.verdict}</span></div>
      <div class="cz-prog"><span>ความพร้อมเข้า <b>${x.pct}%</b></span><i><em style="width:${x.pct}%"></em></i></div>
      <div class="cz-col-px">เข้า ~<b>${f2(price)}</b> · SL <b>${f2(x.L.sl)}</b><br>${x.L.tps.map((v, k) => `TP${k + 1} <b>${f2(v)}</b>`).join(' · ')}</div>
      <small>${x.tested ? `ทดสอบชนะ ${x.c.win}% · ต้องได้คะแนน ${x.side > 0 ? '+' : '−'}${x.c.th}` : 'ฝั่งนี้ทดสอบขาดทุนในกรอบนี้ — เสี่ยง'}</small></div>`;
    const showPlans = !open && (sys.long || !(d && d.stale));
    const plan = showPlans ? `<div class="cz-two">${sides.map(col).join('')}</div>` : '';
    const mini = (x) => `<div class="cz-prog ${x.side > 0 ? 'buy' : 'sell'}${x.go ? ' live' : ''}${x.tested ? '' : ' untested'}"><span>${x.side > 0 ? 'Buy' : 'Sell'} <b>${x.pct}%</b> · ${x.verdict}</span><i><em style="width:${x.pct}%"></em></i></div>`;
    if (note && !open) note.innerHTML = showPlans ? `${sides.map(mini).join('')}<small>ตัวเลขเดียวกับช่อง Buy | Sell ทางซ้าย${tf === '30m' ? ' และหน้าสัญญาณ (ระบบหลัก)' : ''}</small>` : note.innerHTML;
    const goSide = sides.find((x) => x.go);
    window.CZ_GO = open ? { side: open.side === 'SELL' ? -1 : 1, open: true } : goSide ? { side: goSide.side } : null;
    window.CZ_SIDES = showPlans ? sides.map(({ side, pct, verdict, go, tested }) => ({ side, pct, verdict, go, tested })) : null; // side card (main.js)
    if (window.renderSignalHead) renderSignalHead();
    // On the chart only ONE box (user, 9 Oct: two boxes "ยังงง ต้องซื้อตรงไหน เอาแค่อันเดียวพอ"): the side that is
    // nearer its signal — a live signal first, then the higher %, then the side that passed its test. Both % stay in the card.
    const best = [...sides].sort((a, b) => (b.go - a.go) || (b.pct - a.pct) || (b.tested - a.tested))[0];
    window.CZ_PLANS = showPlans ? [best].map((x) => ({ side: x.side, entry: price, sl: x.L.sl, tps: x.L.tps, ok: x.go, note: `${x.side > 0 ? 'Buy' : 'Sell'} ${x.pct}% ${x.go ? '✅ เข้า' : br && x.tested ? '⛔' : x.tested ? '⏸' : '⚠️'}` })) : null;
    if (window.drawPositionBoxes) drawPositionBoxes();
    const calcBtn = calcArgs ? `<button type="button" class="btn cz-calc" data-calc="${calcArgs.map((v) => SIG.round(v)).join(',')}">🧮 คำนวณ lot จากสัญญาณนี้</button>` : '';
    const top = pill ? `${pill}${waitOnly ? '' : `<br><small>${head}</small>`}` : head;
    setBox(cls, `<b>${top}</b>${plan}${calcBtn}
      <details class="cz-more"${moreOpen ? ' open' : ''}><summary>รายละเอียด (ความแม่นยำ · วิธีอ่าน)</summary>
      <span class="cz-more-now">${pillFull}${waitOnly ? ` · ${head}` : ''}</span>
      ${acc('BUY', B, null)} ${acc('SELL', S, sys.sellQ)}
      <span>ระบบกรอบ ${TF_LABEL[tf]}: ${sys.frames.map((f) => f[3]).join(' + ')} · BUY ≥ +${B.th} (${sideText(B)})${S ? ` · SELL ≤ −${S.th} (${sideText(S)})` : ''}
      · ทดสอบย้อนหลัง ${sys.span} แบ่ง 4 ช่วงเท่ากัน เก่า→ใหม่ หลังสเปรด ต่อ 1 ออนซ์${sys.few ? ` · ตัวอย่างน้อย (${sys.few} ไม้)` : ''}${sys.long ? ' · ช่วงทดสอบทองเป็นขาขึ้นเกือบตลอด ไม่รับประกันอนาคต' : ''}
      · บนกราฟนี้ ${fin.length} ไม้ปิดแล้ว${fin.length ? ` รวม ${usd(SIG.round(pnl))}` : ''}${open ? ' + 1 ไม้ที่ถืออยู่' : ''}
      · <b>ลูกศรเล็ก</b> = ทิศทุกแท่ง ใช้ดูทิศเท่านั้น${sys.every ? ` (เข้าทุกลูกศร 2 ปี ${usd(sys.every)} ชนะ ~50%)` : ''} · <b>ป้าย Buy / Sell</b> = สัญญาณเข้า · เส้นโค้งสีทอง = กรอบราคา (ดูประกอบ — ทดสอบแล้วการเข้าเมื่อแตะขอบขาดทุนเกือบทุกกรอบ) · แถบแดง/เขียว = แนวต้าน/แนวรับจากจุดกลับตัวที่ยังไม่ถูกทะลุ</span></details>`);
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
    return null;
  }
  // No open trade: where the nearer side (Buy or Sell) would go in right now (window.CZ_PLANS from renderChartZones), drawn as a
  // long / short box in the empty space right of the last candle, with the entry, SL and TP prices written on them
  function drawPlans(b, plans) {
    const ts = b.chart.timeScale(), y = (v) => b.series.priceToCoordinate(v);
    const right = b.chart.priceScale('right').width(), W = b.el.clientWidth - right;
    const bars = state.bars, lastX = ts.timeToCoordinate(bars[bars.length - 1].time + TZ);
    if (lastX == null || !W) return '';
    const x0 = Math.max(0, Math.min(W - 132, lastX + 6)), colW = Math.max(126, Math.min(220, (W - x0 - 6) / plans.length));
    return plans.map((p, i) => {
      const x = x0 + i * (colW + 6), ye = y(p.entry), ys = y(p.sl), yt = y(p.tps[p.tps.length - 1]);
      if (ye == null || ys == null || yt == null) return '';
      const box = (ya, yb, cls) => `<div class="pbox ${cls}" style="left:${x}px;width:${colW}px;top:${Math.min(ya, yb)}px;height:${Math.max(2, Math.abs(ya - yb))}px"></div>`;
      const lab = (yy, cls, txt) => `<div class="pp-lab ${cls}" style="left:${x + 3}px;width:${colW - 6}px;top:${yy}px">${txt}</div>`;
      const buy = p.side > 0;
      const tpLines = p.tps.map((v, k) => { const yy = y(v); return yy == null ? '' : `<div class="pp-line tp" style="left:${x}px;width:${colW}px;top:${yy}px"></div>` + lab(yy + (buy ? 8 : -8), 'tp', `TP${k + 1} ${f2(v)}`); }).join('');
      const top = Math.min(ye, ys, yt), note = `<div class="pp-status ${p.ok ? 'live' : ''}" style="left:${x}px;width:${colW}px;top:${top - 4}px">${p.note}</div>`;
      return `<div class="pp ${buy ? 'buy' : 'sell'} ${p.ok ? '' : 'off'}">${box(ye, ys, 'loss')}${box(ye, yt, 'win')}
        <div class="pentry" style="left:${x}px;width:${colW}px;top:${ye}px"></div>${tpLines}
        ${lab(ye, `en ${buy ? 'buy' : 'sell'}`, `${p.ok ? '' : 'ถ้าเข้า '}${buy ? 'Buy' : 'Sell'} ${f2(p.entry)}`)}${lab(ys + (buy ? -8 : 8), 'sl', `SL ${f2(p.sl)}`)}${note}</div>`;
    }).join('');
  }
  function draw(b) {
    const p = currentPlan(), plans = !p && window.CZ_PLANS;
    // Room on the right for the box while there is an entry (like a platform's position tool); the plan box
    // needs ~170px whatever the zoom
    const sp = b.chart.timeScale().options().barSpacing || 6;
    const plotW = b.el.clientWidth - b.chart.priceScale('right').width();
    const need = plotW < 520 ? Math.max(136, Math.round(plotW * 0.5)) : 170; // one plan box, wide enough for "ถ้าเข้า Sell 4,125.45"
    const off = p ? 8 : plans ? Math.min(240, Math.ceil(need / sp) + 1) : 6;
    if (b.off !== off) { b.off = off; b.chart.timeScale().applyOptions({ rightOffset: off }); }
    if (plans && state.bars.length) {
      // Showing the latest candles but without room for the boxes (a zoom or tab switch set the range): make room
      const ts = b.chart.timeScale(), r = ts.getVisibleLogicalRange(), n = state.bars.length;
      // at most every half second, so a clamped range can't loop; always draw afterwards
      // (a range set by a timeframe switch right after ours used to win — try once more after the half second)
      // (at most 3 tries in a row, so a range the chart clamps can't loop)
      if (r && r.to >= n - 2 && r.to < n - 1 + off - 1) {
        if (Date.now() - (b.roomAt || 0) > 500) { b.roomAt = Date.now(); b.retry = 0; ts.setVisibleLogicalRange({ from: r.from, to: n - 1 + off }); }
        else if (!b.retry && (b.tries = (b.tries || 0) + 1) <= 3) b.retry = setTimeout(() => draw(b), 600);
      } else b.tries = 0;
      const html = drawPlans(b, plans);
      if (html !== b.html) { b.html = html; b.el.innerHTML = html; }
      return;
    }
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
  // Keep every drawn entry / SL / TP inside the price scale, so no label sits off the chart
  function fitPlans(series) {
    series.applyOptions({ autoscaleInfoProvider: (orig) => {
      const r = orig(); if (!r || !r.priceRange) return r;
      const t = window.CZ_OPEN, ps = [...(window.CZ_PLANS || []).flatMap((p) => [p.sl, ...p.tps]), ...(t ? [t.sl, ...t.tps] : [])].filter(Number.isFinite);
      if (!ps.length) return r;
      return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...ps), maxValue: Math.max(r.priceRange.maxValue, ...ps) } };
    } });
  }
  window.drawPositionBoxes = function () {
    if (!boxes.length && typeof mainChart !== 'undefined') { overlay(mainChart, candles, 'mainChart'); overlay(simpleChart, areaS, 'simpleChart'); fitPlans(candles); fitPlans(areaS); }
    boxes.forEach(draw);
  };
})();

// ---------- Chart decor (user's reference picture, 8 Oct): smooth envelope, supply / demand zones, Buy / Sell tags ----------
// Envelope = Nadaraya-Watson kernel regression of the close (endpoint version: never redrawn afterwards) ± 3 × mean
// absolute error. Shown for context only: touching a band as a signal LOST in the 2-year backtest on every timeframe
// except 1d (scratchpad nwe.js), so the Buy / Sell tags stay the tested systems' entries. Zones = the latest swing highs /
// lows (5 candles each side) that price hasn't closed through since, drawn from the swing to the right edge.
(function () {
  const $ = (id) => document.getElementById(id);
  const H = 8, WIN = 30, MULT = 3, MAE = 100, SWING = 5, KEEP = 5;
  let tags = [];
  const views = [];
  // Clean view (like the reference picture): hide EMA / Bollinger, the entry-zone background and the small arrows.
  // On by default; the choice is remembered on this device.
  let clean = true;
  try { clean = localStorage.getItem('gs-clean') !== '0'; } catch (e) { /* storage blocked: default */ }
  window.CZ_CLEAN = () => clean;
  function applyClean() {
    if (typeof ema20S !== 'undefined') [ema20S, ema50S, bbU, bbL].forEach((x) => x.applyOptions({ visible: !clean }));
    document.body.classList.toggle('cz-clean', clean);
    const b = $('czClean'); if (b) { b.textContent = clean ? '📊 แสดงเส้นอินดิเคเตอร์' : '✨ มุมมองสะอาด'; b.setAttribute('aria-pressed', String(clean)); }
  }
  const btn = $('czClean');
  if (btn) btn.addEventListener('click', () => {
    clean = !clean;
    try { localStorage.setItem('gs-clean', clean ? '1' : '0'); } catch (e) { /* not remembered */ }
    applyClean();
    if (window.renderChartZones) renderChartZones();
  });
  applyClean();
  function envelope(bars) {
    const w = Array.from({ length: WIN }, (_, i) => Math.exp(-(i * i) / (2 * H * H))), ws = w.reduce((a, b) => a + b, 0);
    const mid = bars.map((_, k) => { if (k < WIN) return null; let s = 0; for (let i = 0; i < WIN; i++) s += bars[k - i].close * w[i]; return s / ws; });
    const out = [];
    let errSum = 0, errs = [];
    bars.forEach((b, k) => {
      if (mid[k] == null) return;
      const e = Math.abs(b.close - mid[k]); errs.push(e); errSum += e;
      if (errs.length > MAE) errSum -= errs.shift();
      if (errs.length < 20) return;
      const band = (errSum / errs.length) * MULT, t = b.time + TZ;
      out.push({ t, mid: mid[k], up: mid[k] + band, lo: mid[k] - band });
    });
    return out;
  }
  function zones(bars) {
    if (bars.length < 2 * SWING + 2) return [];
    const atr = bars.slice(-50).reduce((a, b) => a + b.high - b.low, 0) / Math.min(50, bars.length);
    const out = [];
    for (let k = SWING; k < bars.length - SWING; k++) {
      const b = bars[k], around = [...bars.slice(k - SWING, k), ...bars.slice(k + 1, k + 1 + SWING)];
      const later = bars.slice(k + 1);
      if (around.every((x) => x.high < b.high) && !later.some((x) => x.close > b.high)) {
        const depth = Math.min(atr * 1.2, Math.max(atr * 0.6, b.high - Math.max(b.open, b.close)));
        out.push({ side: 'sell', t: b.time + TZ, top: b.high, bottom: b.high - depth });
      }
      if (around.every((x) => x.low > b.low) && !later.some((x) => x.close < b.low)) {
        const depth = Math.min(atr * 1.2, Math.max(atr * 0.6, Math.min(b.open, b.close) - b.low));
        out.push({ side: 'buy', t: b.time + TZ, top: b.low + depth, bottom: b.low });
      }
    }
    return [...out.filter((z) => z.side === 'sell').slice(-KEEP), ...out.filter((z) => z.side === 'buy').slice(-KEEP)];
  }
  function view(chart, series, hostId, lines) {
    const host = $(hostId); if (!host) return null;
    host.style.position = 'relative';
    const el = document.createElement('div'); el.className = 'pbox-layer cz-decor'; host.appendChild(el);
    const v = { chart, series, el, lines, zones: [] };
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => draw(v));
    new ResizeObserver(() => draw(v)).observe(host);
    views.push(v); return v;
  }
  function init() {
    if (views.length || typeof mainChart === 'undefined') return;
    const ln = (color, style) => mainChart.addLineSeries({ color, lineWidth: 1.5, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    view(mainChart, candles, 'mainChart', { up: ln('rgba(216,190,120,.85)', 0), mid: ln('rgba(216,190,120,.55)', 2), lo: ln('rgba(216,190,120,.85)', 0) });
    view(simpleChart, areaS, 'simpleChart', null);
  }
  function draw(v) {
    const ts = v.chart.timeScale(), W = v.el.clientWidth - v.chart.priceScale('right').width();
    if (!W) return;
    const y = (p) => v.series.priceToCoordinate(p);
    const z = v.zones.map((zn) => {
      const yt = y(zn.top), yb = y(zn.bottom); if (yt == null || yb == null) return '';
      let x = ts.timeToCoordinate(zn.t); if (x == null || x < 0) x = 0; if (x >= W) return '';
      return `<div class="cz-zone ${zn.side}" style="left:${x}px;width:${W - x}px;top:${Math.min(yt, yb)}px;height:${Math.max(3, Math.abs(yb - yt))}px"></div>`;
    }).join('');
    const tg = tags.map((g) => {
      const x = ts.timeToCoordinate(g.t), py = y(g.price); if (x == null || py == null || x < 0 || x > W) return '';
      return `<div class="cz-tag ${g.side}" style="left:${x}px;top:${g.side === 'buy' ? py + 26 : py - 26}px" title="${g.title}">${g.side === 'buy' ? 'Buy' : 'Sell'} ${f2(g.entry)}</div>`;
    }).join('');
    // Entry (gold) / TP (green) / SL (red) segments from the entry candle to the exit, last 8 closed trades on screen
    const seg = tags.filter((g) => !g.open && g.t1 != null).slice(-8).map((g) => {
      let x0 = ts.timeToCoordinate(g.t), x1 = ts.timeToCoordinate(g.t1);
      if (x0 == null || x1 == null || x1 < 0 || x0 > W) return '';
      x0 = Math.max(0, x0); x1 = Math.min(W, Math.max(x1, x0 + 24));
      const ln = (p, cls, label) => { const yy = y(p); return yy == null ? '' : `<div class="cz-seg ${cls}" style="left:${x0}px;width:${x1 - x0}px;top:${yy}px"></div><span class="cz-lv ${cls}" style="left:${x1 + 3}px;top:${yy}px">${label}</span>`; };
      return ln(g.entry, 'en', '') + ln(g.sl, 'sl', `SL ${f2(g.sl)}${g.closedBy === 'sl' ? ' ✗' : ''}`)
        + g.tps.map((v, k) => ln(v, 'tp', `TP${g.tps.length > 1 ? k + 1 : 1} ${f2(v)}${g.hit > k ? ' ✓' : ''}`)).join('');
    }).join('');
    const html = z + seg + tg;
    if (html !== v.html) { v.html = html; v.el.innerHTML = html; }
  }
  // Called by renderChartZones with the tested systems' entries: [{ createdAt, side: 'BUY' | 'SELL' }]
  window.setChartDecor = function (trades) {
    init();
    const bars = state.bars;
    if (!bars.length) return;
    const env = envelope(bars), zn = zones(bars);
    const at = new Map(bars.map((b) => [b.time * 1000, b]));
    tags = trades.map((r) => {
      // tag on the candle the entry was decided on (the one that just closed), under its low / over its high
      const b = at.get(r.createdAt) || bars.find((x) => x.time * 1000 >= r.createdAt);
      if (!b) return null;
      const buy = r.side !== 'SELL';
      // where the trade ended (the candle holding the exit), for the entry / TP / SL segments; open trades: none
      // (the position box draws those)
      const done = SIG.isFinal(r) && r.exitAt;
      const xb = done ? bars.filter((x) => x.time * 1000 <= r.exitAt).pop() : null;
      return { t: b.time + TZ, t1: xb ? xb.time + TZ : null, open: !done, entry: r.entry, sl: r.sl, tps: r.tps || [], hit: r.hit || 0, closedBy: r.closedBy,
        side: buy ? 'buy' : 'sell', price: buy ? b.low : b.high, title: `${buy ? 'ซื้อ' : 'ขาย'} ${f2(r.entry)} · ${new Date(r.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })}` };
    }).filter(Boolean);
    views.forEach((v) => {
      v.zones = zn;
      if (v.lines) ['up', 'mid', 'lo'].forEach((k) => v.lines[k].setData(env.map((e) => ({ time: e.t, value: e[k] }))));
      draw(v);
    });
  };
})();
