// Stats tab = US economic news and how gold moved after it (user, 9 Oct: "เว็บนี้ทำมาเพื่อดูสัญญาณในการเทรดแค่นั้น และ
// สถิติข่าวต่างๆ ของสหรัฐ" — the live-trade record left the page). Sources, both fetched by the browser:
// • investing.com's economic calendar (high-impact US releases: actual / forecast / previous, and whether the actual
//   beat the forecast — "positive" = good for the US dollar, which usually pushes gold down)
// • Binance PAXG 5-minute candles around each release time: how many $ gold moved 15 and 60 minutes after
// Needs main.js (state, $, f2, money, thaiTime, hhmm). Loaded once when the tab is first opened, refreshed every 10 min.
(function () {
  // importance (singular) — importances=high is ignored by the API (it returned medium / low releases too, 300 at most)
  const CAL = 'https://endpoints.investing.com/pd-instruments/v1/calendars/economic/events/occurrences?domain_id=1&country_ids=5&importance=high&limit=300';
  const KL = 'https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=5m';
  const DAYS_BACK = 60;
  const ns = { at: 0, past: [], next: [], loading: false, moves: new Map(), showPast: 10, showTable: 10 };
  // Thai names for the releases that move gold most (matched on investing.com's English name)
  const TH = [
    [/nonfarm payrolls/i, 'การจ้างงานนอกภาคเกษตร (NFP)'], [/unemployment rate/i, 'อัตราว่างงาน'], [/core cpi/i, 'เงินเฟ้อพื้นฐาน (Core CPI)'],
    [/\bcpi\b/i, 'เงินเฟ้อ (CPI)'], [/core pce/i, 'Core PCE (เงินเฟ้อที่ Fed ดู)'], [/\bpce\b/i, 'PCE'], [/\bppi\b/i, 'ราคาผู้ผลิต (PPI)'],
    [/interest rate decision|fed rate/i, 'ประชุมดอกเบี้ย Fed'], [/fomc/i, 'Fed (FOMC)'], [/powell|fed chair/i, 'ประธาน Fed แถลง'],
    [/\bgdp\b/i, 'GDP'], [/retail sales/i, 'ยอดค้าปลีก'], [/initial jobless/i, 'ผู้ขอสวัสดิการว่างงานรายสัปดาห์'],
    [/ism manufacturing/i, 'ISM ภาคการผลิต'], [/ism non-manufacturing|ism services/i, 'ISM ภาคบริการ'], [/jolts/i, 'ตำแหน่งงานว่าง (JOLTS)'],
    [/adp/i, 'การจ้างงานเอกชน ADP'], [/average hourly earnings/i, 'ค่าแรงเฉลี่ยรายชั่วโมง'], [/michigan/i, 'ความเชื่อมั่นผู้บริโภค Michigan'],
    [/cb consumer confidence/i, 'ความเชื่อมั่นผู้บริโภค CB'], [/durable goods/i, 'คำสั่งซื้อสินค้าคงทน'], [/existing home sales/i, 'ยอดขายบ้านมือสอง'],
    [/new home sales/i, 'ยอดขายบ้านใหม่'], [/crude oil inventories/i, 'สต็อกน้ำมันดิบ (EIA)'], [/\d+-year (note|bond) auction/i, 'ประมูลพันธบัตรรัฐบาล'],
    [/philadelphia fed/i, 'ดัชนีการผลิต Philadelphia Fed'], [/chicago pmi/i, 'PMI ชิคาโก'], [/meeting minutes/i, 'รายงานการประชุม Fed'], [/pmi/i, 'PMI'],
  ];
  const thName = (en) => { const m = TH.find(([re]) => re.test(en)); return m ? m[1] : ''; };
  const val = (v, o) => (v == null ? '—' : `${(+v).toLocaleString('en-US', { minimumFractionDigits: o.precision || 0, maximumFractionDigits: o.precision || 0 })}${o.unit || ''}`);
  const usd = (a) => (a === 'positive' ? { cls: 'pos', th: 'ดีกว่าคาด', gold: 'ดอลลาร์แข็ง → ทองมักลง' }
    : a === 'negative' ? { cls: 'neg', th: 'แย่กว่าคาด', gold: 'ดอลลาร์อ่อน → ทองมักขึ้น' } : { cls: 'neu', th: 'ตามคาด', gold: '' });
  const dayTime = (ms) => new Date(ms).toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const signed = (v) => (v == null ? '—' : `${v >= 0 ? '▲ +' : '▼ −'}$${f2(Math.abs(v))}`);

  async function calendar(from, to) {
    const r = await fetch(`${CAL}&start_date=${new Date(from).toISOString()}&end_date=${new Date(to).toISOString()}`);
    if (!r.ok) throw new Error(`calendar ${r.status}`);
    const j = await r.json();
    const ev = new Map((j.events || []).map((e) => [e.event_id, e]));
    return (j.occurrences || []).map((o) => ({ ...o, ev: ev.get(o.event_id) || {}, t: Date.parse(o.occurrence_time) }))
      .filter((o) => (o.ev.importance || 'high') === 'high');
  }
  // Gold around a release: price at the release, and the change 15 / 60 minutes later (5-minute PAXG candles)
  async function move(t) {
    if (ns.moves.has(t)) return ns.moves.get(t);
    const r = await fetch(`${KL}&startTime=${t - 5 * 60e3}&limit=15`);
    if (!r.ok) return null;
    const k = (await r.json()).map((b) => ({ time: b[0], open: +b[1], close: +b[4], high: +b[2], low: +b[3] }));
    const i0 = k.findIndex((b) => b.time >= t);
    if (i0 < 0) return null;
    const p0 = k[i0].open, at = (min) => k[i0 + min / 5 - 1];
    const m = { p0, m15: at(15) ? SIG.round(at(15).close - p0) : null, m60: at(60) ? SIG.round(at(60).close - p0) : null,
      range: SIG.round(Math.max(...k.slice(i0, i0 + 12).map((b) => b.high)) - Math.min(...k.slice(i0, i0 + 12).map((b) => b.low))) };
    ns.moves.set(t, m);
    return m;
  }
  // Releases at the same moment are one event for gold (NFP + unemployment + earnings at 19:30)
  const groupByTime = (list) => {
    const g = new Map();
    list.forEach((o) => g.set(o.t, [...(g.get(o.t) || []), o]));
    return [...g.entries()].map(([t, items]) => ({ t, items }));
  };

  async function load() {
    if (ns.loading || Date.now() - ns.at < 10 * 60e3) return;
    ns.loading = true;
    try {
      const now = Date.now();
      const [past, next] = await Promise.all([calendar(now - DAYS_BACK * 864e5, now), calendar(now, now + 8 * 864e5)]);
      ns.past = groupByTime(past.filter((o) => o.actual != null && o.t <= now)).sort((a, b) => b.t - a.t);
      ns.next = groupByTime(next.filter((o) => o.t > now)).sort((a, b) => a.t - b.t);
      ns.at = now;
      render();
      // gold moves, a few at a time (the latest first so the top of the list fills in quickly)
      const todo = ns.past.filter((g) => now - g.t > 60 * 60e3);
      for (let i = 0; i < todo.length; i += 4) {
        await Promise.all(todo.slice(i, i + 4).map((g) => move(g.t).then((m) => { g.move = m; }).catch(() => {})));
        render();
      }
      ns.past.forEach((g) => { if (!g.move && ns.moves.has(g.t)) g.move = ns.moves.get(g.t); });
      render();
    } catch (e) {
      $('nsNext').innerHTML = `<p class="muted">โหลดปฏิทินข่าวไม่ได้ (${e.message}) — ลองใหม่อีกครั้งภายหลัง</p>`;
    }
    ns.loading = false;
  }

  function itemLine(o, withActual) {
    const e = o.ev, a = usd(o.actual_to_forecast), th = thName(e.short_name || e.long_name || '');
    return `<div class="ns-item">
      <div class="ns-name"><b>${th || e.event_translated || e.short_name || 'US data'}</b>${th ? `<small>${e.event_translated || e.short_name}</small>` : ''}${o.reference_period ? `<span class="ns-per">${o.reference_period}</span>` : ''}</div>
      <div class="ns-nums">${withActual ? `<span class="ns-act ${a.cls}">จริง <b class="mono">${val(o.actual, o)}</b></span>` : ''}
        <span>คาด <b class="mono">${val(o.forecast, o)}</b></span><span>ก่อนหน้า <b class="mono">${val(o.previous, o)}</b></span>
        ${withActual ? `<span class="ns-chip ${a.cls}">${a.th}</span>` : ''}</div>
    </div>`;
  }

  function render() {
    if (!$('nsNext')) return;
    const now = Date.now();
    // 1) next release + countdown
    const n = ns.next[0];
    if (n) {
      const mins = Math.max(0, Math.round((n.t - now) / 60e3));
      const left = mins < 60 ? `${mins} นาที` : mins < 1440 ? `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที` : `${Math.floor(mins / 1440)} วัน ${Math.floor((mins % 1440) / 60)} ชม.`;
      $('nsNext').innerHTML = `<div class="ns-count"><span>ข่าวแรงถัดไป</span><b class="mono">${left}</b><small>${dayTime(n.t)} น.</small></div>
        <div class="ns-next-items">${n.items.map((o) => itemLine(o, false)).join('')}</div>
        <p class="ns-warn">⚠️ ราคาทองอาจวิ่งแรงในไม่กี่นาที · สัญญาณกรอบ ${window.CHARTSYS ? Object.entries(CHARTSYS.SYS).filter(([, s]) => s.news).map(([k]) => TF_LABEL[k]).join(' และ ') : '5 นาที และ 1 ชม.'} งดเปิดไม้ใหม่ ±30 นาทีรอบข่าวนี้ (กรอบอื่นทดสอบแล้วไม่ต้องหลบ)</p>`;
    } else $('nsNext').innerHTML = ns.at ? '<p class="muted">ไม่มีข่าวแรงของสหรัฐใน 8 วันข้างหน้า</p>' : '<p class="muted">กำลังโหลดปฏิทินข่าว…</p>';
    // 2) the coming week
    $('nsWeek').innerHTML = ns.next.length ? ns.next.map((g) => `<div class="ns-row">
        <div class="ns-when"><b>${new Date(g.t).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })}</b><span class="mono">${hhmm(g.t)} น.</span></div>
        <div class="ns-what">${g.items.map((o) => itemLine(o, false)).join('')}</div></div>`).join('') : '<p class="muted">—</p>';
    // 3) released: result vs forecast, and gold afterwards
    $('nsPast').innerHTML = ns.past.length ? ns.past.slice(0, ns.showPast).map((g) => {
      const m = g.move, a = usd((g.items.find((o) => o.actual_to_forecast !== 'neutral') || g.items[0]).actual_to_forecast);
      const cls = (v) => (v == null ? '' : v >= 0 ? 'up' : 'down');
      return `<div class="ns-row past">
        <div class="ns-when"><b>${new Date(g.t).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })}</b><span class="mono">${hhmm(g.t)} น.</span></div>
        <div class="ns-what">${g.items.map((o) => itemLine(o, true)).join('')}</div>
        <div class="ns-gold"><span class="ns-gl">ทองหลังข่าว</span>
          ${m ? `<span>15 นาที <b class="mono ${cls(m.m15)}">${signed(m.m15)}</b></span><span>1 ชม. <b class="mono ${cls(m.m60)}">${signed(m.m60)}</b></span><small>แกว่ง ${m.range != null ? `$${f2(m.range)}` : '—'} ใน 1 ชม.</small>`
            : now - g.t < 60 * 60e3 ? '<small>รอครบ 1 ชม.</small>' : '<small class="muted">กำลังโหลด…</small>'}
          ${a.gold ? `<small class="ns-hint ${a.cls}">${a.gold}</small>` : ''}</div></div>`;
    }).join('') + (ns.past.length > ns.showPast ? `<button type="button" class="btn ns-more" data-more="past">แสดงเพิ่ม (${ns.past.length - ns.showPast} ครั้ง)</button>` : '') : `<p class="muted">${ns.at ? 'ไม่มีข่าวแรงใน 60 วันที่ผ่านมา' : 'กำลังโหลด…'}</p>`;
    // 4) per release type: how big gold's move usually is, and whether it followed the textbook direction
    const by = new Map();
    ns.past.filter((g) => g.move && g.move.m60 != null).forEach((g) => g.items.forEach((o) => {
      // one row per release name (CPI MoM + YoY are one), each release time counted once
      const e = o.ev, key = thName(e.short_name || '') || e.event_translated || e.short_name, s = by.get(key) || { name: key, n: 0, sum: 0, max: 0, follow: 0, judged: 0, times: new Set() };
      if (s.times.has(g.t)) return;
      s.times.add(g.t); s.n++; s.sum += Math.abs(g.move.m60); s.max = Math.max(s.max, g.move.range || Math.abs(g.move.m60));
      if (o.actual_to_forecast === 'positive' || o.actual_to_forecast === 'negative') {
        s.judged++;
        if ((o.actual_to_forecast === 'positive') === (g.move.m60 < 0)) s.follow++;
      }
      by.set(key, s);
    }));
    const rows = [...by.values()].sort((a, b) => b.sum / b.n - a.sum / a.n);
    $('nsTable').innerHTML = rows.length ? `<div class="ns-trow head"><span>ข่าว</span><span>ครั้ง</span><span>ทองขยับเฉลี่ย 1 ชม.</span><span>แกว่งสูงสุด</span><span>ไปตามตำรา*</span></div>`
      + rows.slice(0, ns.showTable).map((s) => `<div class="ns-trow"><span>${s.name}</span><span class="mono">${s.n}</span>
        <span><i class="ns-bar" style="width:${Math.min(100, ((s.sum / s.n) / 20) * 100)}%"></i><b class="mono">$${f2(s.sum / s.n)}</b></span>
        <span class="mono">$${f2(s.max)}</span><span class="mono">${s.judged ? `${s.follow}/${s.judged}` : '—'}</span></div>`).join('') + (rows.length > ns.showTable ? `<button type="button" class="btn ns-more" data-more="table">ดูทั้งหมด (${rows.length} ข่าว)</button>` : '')
      : '<p class="muted">กำลังคำนวณจากข่าวที่ออกแล้ว…</p>';
    // headline numbers
    const moved = ns.past.filter((g) => g.move && g.move.m60 != null);
    const avg = moved.length ? moved.reduce((a, g) => a + Math.abs(g.move.m60), 0) / moved.length : null;
    const big = moved.reduce((m, g) => (!m || (g.move.range || 0) > (m.move.range || 0) ? g : m), null);
    $('nsKpis').innerHTML = [
      ['📅 ข่าวแรงสัปดาห์นี้', String(ns.next.filter((g) => g.t - now < 7 * 864e5).length), 'ครั้ง (นับตามเวลาออกข่าว)'],
      ['📰 ออกแล้ว 60 วัน', String(ns.past.length), 'ครั้ง · ข่าวสำคัญของสหรัฐ'],
      ['📏 ทองขยับเฉลี่ยหลังข่าว', avg != null ? `$${f2(avg)}` : '…', 'ภายใน 1 ชม. (ไม่ดูทิศ)'],
      ['🌪️ แกว่งแรงสุด', big ? `$${f2(big.move.range)}` : '…', big ? `${thName(big.items[0].ev.short_name || '') || big.items[0].ev.event_translated} · ${new Date(big.t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })}` : ''],
    ].map(([l, b, s]) => `<div class="st-kpi"><span class="st-kpi-l">${l}</span><b class="mono">${b}</b><small>${s}</small></div>`).join('');
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.ns-more');
    if (!b) return;
    if (b.dataset.more === 'past') ns.showPast += 20; else ns.showTable = 999;
    render();
  });
  window.renderNewsStats = function () { render(); load(); };
  setInterval(() => { if (!$('tab-stats') || $('tab-stats').hidden) return; render(); load(); }, 60e3); // countdown + refresh
})();
