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
  const ns = { at: 0, past: [], next: [], loading: false, moves: new Map(), showPast: 10, showTable: 10, openItems: new Set() };
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
  // What each release is, in plain Thai, and how gold usually reacts (opened by tapping a news item)
  const ABOUT = [
    [/nonfarm payrolls/i, 'จำนวนคนที่ได้งานใหม่ในสหรัฐเดือนที่แล้ว (ไม่นับภาคเกษตร) — ตัวเลขเศรษฐกิจที่ตลาดจับตามากที่สุด ออกวันศุกร์แรกของเดือน', 'มากกว่าคาด = เศรษฐกิจแข็ง ดอลลาร์แข็ง → ทองมักลง · น้อยกว่าคาด → ทองมักขึ้น · ทองวิ่งแรงมากใน 1–2 นาทีแรก'],
    [/unemployment rate/i, 'สัดส่วนคนว่างงานต่อกำลังแรงงานทั้งหมดของสหรัฐ ออกพร้อม NFP', 'ว่างงานสูงกว่าคาด = เศรษฐกิจอ่อน Fed อาจลดดอกเบี้ย → ทองมักขึ้น'],
    [/average hourly earnings/i, 'ค่าแรงเฉลี่ยต่อชั่วโมงของลูกจ้าง — บอกแรงกดดันเงินเฟ้อจากค่าจ้าง ออกพร้อม NFP', 'ค่าแรงขึ้นมากกว่าคาด = เงินเฟ้อสูง Fed อาจคงดอกเบี้ยสูง → ทองมักลง'],
    [/core cpi/i, 'เงินเฟ้อพื้นฐาน: ราคาสินค้าและบริการที่ผู้บริโภคจ่าย ไม่รวมอาหารและพลังงานที่ผันผวน — ตัวที่ Fed ใช้ดูแนวโน้มเงินเฟ้อ', 'สูงกว่าคาด = Fed อาจคงหรือขึ้นดอกเบี้ย ดอลลาร์แข็ง → ทองมักลง · ต่ำกว่าคาด → ทองมักขึ้น'],
    [/\bcpi\b/i, 'ดัชนีราคาผู้บริโภค: เงินเฟ้อทั่วไปของสหรัฐ (ราคาสินค้าและบริการเทียบเดือน/ปีก่อน)', 'เงินเฟ้อสูงกว่าคาด → ดอกเบี้ยอาจสูงนาน ทองมักลงในระยะสั้น · ต่ำกว่าคาด → ทองมักขึ้น'],
    [/core pce/i, 'เงินเฟ้อจากการใช้จ่ายส่วนบุคคล ไม่รวมอาหารและพลังงาน — ตัวชี้วัดเงินเฟ้อที่ Fed ใช้ตั้งเป้า 2%', 'สูงกว่าคาด → ทองมักลง · ต่ำกว่าคาด → ทองมักขึ้น'],
    [/\bpce\b/i, 'ดัชนีราคาการใช้จ่ายส่วนบุคคล (เงินเฟ้ออีกตัวที่ Fed ดู)', 'สูงกว่าคาด → ทองมักลง · ต่ำกว่าคาด → ทองมักขึ้น'],
    [/\bppi\b/i, 'ดัชนีราคาผู้ผลิต: ราคาที่ผู้ผลิตขายสินค้า — มักส่งต่อเป็นเงินเฟ้อผู้บริโภคในเดือนถัดไป', 'สูงกว่าคาด = เงินเฟ้อกำลังมา → ทองมักลง'],
    [/interest rate decision|fed rate/i, 'การประชุมคณะกรรมการ Fed ตัดสินอัตราดอกเบี้ยนโยบายของสหรัฐ (ประชุมปีละ 8 ครั้ง) ตามด้วยแถลงข่าวของประธาน Fed', 'ลดดอกเบี้ย / ส่งสัญญาณผ่อนคลาย → ทองมักขึ้นแรง · คงสูง / ส่งสัญญาณเข้ม → ทองมักลง · เป็นข่าวที่ทองวิ่งแรงที่สุด'],
    [/meeting minutes|fomc/i, 'รายงานการประชุม Fed ครั้งก่อน (ออกหลังประชุม 3 สัปดาห์) — บอกว่ากรรมการคิดอย่างไรเรื่องดอกเบี้ย', 'ถ้าส่วนใหญ่อยากลดดอกเบี้ย → ทองมักขึ้น · อยากคงสูง → ทองมักลง'],
    [/fed chair|powell|warsh/i, 'ประธาน Fed กล่าวสุนทรพจน์ / ตอบคำถาม — ตลาดฟังว่ามีสัญญาณเรื่องดอกเบี้ยไหม', 'พูดถึงการลดดอกเบี้ย → ทองมักขึ้น · เน้นคุมเงินเฟ้อ → ทองมักลง · ไม่มีตัวเลขคาด ทองอาจแกว่งทั้งสองทาง'],
    [/\bgdp\b/i, 'ผลิตภัณฑ์มวลรวมในประเทศ: การเติบโตของเศรษฐกิจสหรัฐทั้งไตรมาส (ต่อปี)', 'โตมากกว่าคาด → ดอลลาร์แข็ง ทองมักลง · โตน้อย/หดตัว → ทองมักขึ้น'],
    [/core retail sales/i, 'ยอดค้าปลีกไม่รวมรถยนต์ — ดูการใช้จ่ายของผู้บริโภคจริง ๆ (ผู้บริโภคคือ 2 ใน 3 ของเศรษฐกิจสหรัฐ)', 'มากกว่าคาด → ทองมักลง · น้อยกว่าคาด → ทองมักขึ้น'],
    [/retail sales/i, 'ยอดขายของร้านค้าปลีกทั้งหมดในเดือนที่แล้ว — บอกกำลังซื้อของคนอเมริกัน', 'มากกว่าคาด → ทองมักลง · น้อยกว่าคาด → ทองมักขึ้น'],
    [/initial jobless/i, 'จำนวนคนยื่นขอสวัสดิการว่างงานครั้งแรกในสัปดาห์ที่แล้ว (ออกทุกพฤหัส) — ดูตลาดแรงงานแบบรายสัปดาห์', 'คนขอมากกว่าคาด = ตลาดแรงงานอ่อน → ทองมักขึ้น'],
    [/ism manufacturing prices|ism non-manufacturing prices|prices paid/i, 'ราคาวัตถุดิบที่ผู้จัดซื้อจ่าย (ส่วนหนึ่งของรายงาน ISM) — บอกแรงกดดันเงินเฟ้อ', 'สูงกว่าคาด → ทองมักลง'],
    [/ism manufacturing/i, 'ดัชนีผู้จัดซื้อภาคการผลิตของ ISM — เกิน 50 = ภาคการผลิตขยายตัว ต่ำกว่า 50 = หดตัว', 'ดีกว่าคาด → ทองมักลง · แย่กว่าคาด → ทองมักขึ้น'],
    [/ism non-manufacturing|ism services/i, 'ดัชนีผู้จัดซื้อภาคบริการของ ISM (ภาคบริการคือส่วนใหญ่ของเศรษฐกิจสหรัฐ) — เกิน 50 = ขยายตัว', 'ดีกว่าคาด → ทองมักลง · แย่กว่าคาด → ทองมักขึ้น'],
    [/jolts/i, 'จำนวนตำแหน่งงานที่เปิดรับในสหรัฐ — บอกว่าบริษัทยังอยากจ้างคนแค่ไหน', 'ตำแหน่งงานมากกว่าคาด → ทองมักลง'],
    [/adp/i, 'การจ้างงานภาคเอกชนจากบริษัท ADP (ออกก่อน NFP 2 วัน) — ใช้เดาทิศของ NFP', 'จ้างมากกว่าคาด → ทองมักลง'],
    [/michigan/i, 'ความเชื่อมั่นผู้บริโภคจากผลสำรวจมหาวิทยาลัยมิชิแกน รวมถึงเงินเฟ้อที่คนคาดไว้', 'เชื่อมั่นสูง → ทองมักลงเล็กน้อย · คาดเงินเฟ้อสูง → ทองแกว่ง'],
    [/cb consumer confidence/i, 'ความเชื่อมั่นผู้บริโภคจาก Conference Board — คนมั่นใจจะใช้จ่ายแค่ไหน', 'สูงกว่าคาด → ทองมักลงเล็กน้อย'],
    [/durable goods/i, 'คำสั่งซื้อสินค้าคงทน (ใช้นานเกิน 3 ปี เช่น เครื่องจักร รถยนต์ เครื่องบิน) — บอกการลงทุนของธุรกิจ', 'มากกว่าคาด → ทองมักลง'],
    [/existing home sales/i, 'ยอดขายบ้านมือสองในสหรัฐ — สะท้อนตลาดอสังหาฯ และผลของดอกเบี้ยเงินกู้', 'ผลต่อทองมักน้อย · แย่กว่าคาดมาก → ทองขึ้นเล็กน้อย'],
    [/new home sales/i, 'ยอดขายบ้านสร้างใหม่ในสหรัฐ', 'ผลต่อทองมักน้อย'],
    [/crude oil inventories/i, 'สต็อกน้ำมันดิบของสหรัฐรายสัปดาห์ (EIA, ทุกพุธ) — มีผลกับราคาน้ำมันโดยตรง', 'มีผลกับทองไม่มาก ส่วนใหญ่ผ่านมุมมองเงินเฟ้อ'],
    [/auction/i, 'การประมูลพันธบัตรรัฐบาลสหรัฐ — ดูความต้องการซื้อหนี้สหรัฐ และผลตอบแทน (yield) ที่ได้', 'yield สูงขึ้น → ทองมักลง (ทองไม่มีดอกเบี้ย) · yield ลง → ทองมักขึ้น'],
    [/philadelphia fed/i, 'ดัชนีภาคการผลิตเขต Philadelphia — เกิน 0 = ขยายตัว', 'ดีกว่าคาด → ทองมักลงเล็กน้อย'],
    [/chicago pmi/i, 'ดัชนีผู้จัดซื้อเขตชิคาโก — เกิน 50 = ขยายตัว', 'ผลต่อทองมักน้อย'],
    [/pmi/i, 'ดัชนีผู้จัดซื้อ (PMI) จาก S&P Global — เกิน 50 = ธุรกิจขยายตัว', 'ดีกว่าคาด → ทองมักลงเล็กน้อย'],
  ];
  const about = (en) => { const m = ABOUT.find(([re]) => re.test(en || '')); return m ? { what: m[1], gold: m[2] } : null; };
  // investing.com's own description: HTML-escaped text with <BR/> tags
  const plain = (s) => { const d = document.createElement('textarea'); d.innerHTML = s || ''; return d.value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim(); };
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
    // Tap to read what the release is (plain Thai + how gold usually reacts + investing.com's own description and link)
    const ab = about(e.short_name || e.long_name || e.event_translated), desc = plain(e.description);
    const key = `${o.event_id}-${o.t}`, open = ns.openItems.has(key);
    return `<details class="ns-item" data-key="${key}"${open ? ' open' : ''}><summary>
      <div class="ns-name"><b>${th || e.event_translated || e.short_name || 'US data'}</b>${th ? `<small>${e.event_translated || e.short_name}</small>` : ''}${o.reference_period ? `<span class="ns-per">${o.reference_period}</span>` : ''}<span class="ns-open">อ่าน</span></div>
      <div class="ns-nums">${withActual ? `<span class="ns-act ${a.cls}">จริง <b class="mono">${val(o.actual, o)}</b></span>` : ''}
        <span>คาด <b class="mono">${val(o.forecast, o)}</b></span><span>ก่อนหน้า <b class="mono">${val(o.previous, o)}</b></span>
        ${withActual ? `<span class="ns-chip ${a.cls}">${a.th}</span>` : ''}</div></summary>
      <div class="ns-about">
        ${ab ? `<p>📖 <b>คืออะไร:</b> ${ab.what}</p><p>🪙 <b>ผลกับทอง:</b> ${ab.gold}</p>` : ''}
        ${desc ? `<p class="ns-en">${desc.length > 600 ? `${desc.slice(0, 600)}…` : desc}</p>` : ''}
        <p class="ns-src">${e.source ? `แหล่งข้อมูล: ${e.source} · ` : ''}${e.page_link ? `<a href="https://www.investing.com${e.page_link}" target="_blank" rel="noopener noreferrer">อ่านต่อ / ดูประวัติที่ investing.com ↗</a>` : ''}</p>
      </div>
    </details>`;
  }

  // Time left to a release: days / hours, then minutes:seconds in the last hour (ticks every second)
  function leftText(t) {
    const s = Math.max(0, Math.round((t - Date.now()) / 1000)), m = Math.floor(s / 60);
    if (s === 0) return 'กำลังออก…';
    return m < 60 ? `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
      : m < 1440 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${Math.floor(m / 1440)} วัน ${Math.floor((m % 1440) / 60)} ชม.`;
  }
  function countdown() { const el = $('nsLeft'); if (el) el.textContent = leftText(+el.dataset.t); }

  // Per release type from the 60 days released: how far gold usually moves in the hour after, and whether it followed
  // the textbook direction. Key = the Thai name (CPI MoM + YoY are one), each release time counted once.
  const keyOf = (o) => thName(o.ev.short_name || '') || o.ev.event_translated || o.ev.short_name;
  function statsByName() {
    const by = new Map();
    ns.past.filter((g) => g.move && g.move.m60 != null).forEach((g) => g.items.forEach((o) => {
      const key = keyOf(o), s = by.get(key) || { name: key, n: 0, sum: 0, max: 0, follow: 0, judged: 0, times: new Set() };
      if (s.times.has(g.t)) return;
      s.times.add(g.t); s.n++; s.sum += Math.abs(g.move.m60); s.max = Math.max(s.max, g.move.range || Math.abs(g.move.m60));
      if (o.actual_to_forecast === 'positive' || o.actual_to_forecast === 'negative') {
        s.judged++;
        if ((o.actual_to_forecast === 'positive') === (g.move.m60 < 0)) s.follow++;
      }
      by.set(key, s);
    }));
    return by;
  }
  // Impact badge for a group of releases at one time: the biggest usual 1-hour move among them
  // (🔥 ≥ $15 · ⚡ ≥ $8 · otherwise light; no history yet = no badge)
  function impactOf(g, by) {
    const avgs = g.items.map((o) => by.get(keyOf(o))).filter((s) => s && s.n).map((s) => s.sum / s.n);
    if (!avgs.length) return null;
    const v = Math.max(...avgs);
    return v >= 15 ? { cls: 'hi', th: '🔥 แรง', v } : v >= 8 ? { cls: 'mid', th: '⚡ ปานกลาง', v } : { cls: 'lo', th: 'เบา', v };
  }
  const impHtml = (im) => (im ? `<span class="nc-imp ${im.cls}">${im.th} · ทองมักขยับ ~$${Math.round(im.v)}</span>` : '<span class="nc-imp none">ยังไม่มีสถิติ</span>');
  const dayLabel = (t, now) => {
    const d = SIG.thaiDate(t);
    if (d === SIG.thaiDate(now)) return 'วันนี้';
    if (d === SIG.thaiDate(now + 864e5)) return 'พรุ่งนี้';
    return new Date(t).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
  };
  // the first plain sentence of "how gold reacts" (ABOUT table) for the big card
  const goldRule = (g) => { for (const o of g.items) { const ab = about(o.ev.short_name || o.ev.long_name || o.ev.event_translated); if (ab) return ab.gold.split(' · ').slice(0, 2).join(' · '); } return ''; };

  function render() {
    if (!$('nsNext')) return;
    const now = Date.now(), by = statsByName();
    // 1) the next release, in plain words
    const n = ns.next[0];
    if (n) {
      const im = impactOf(n, by), rule = goldRule(n);
      const names = n.items.map((o) => thName(o.ev.short_name || o.ev.long_name || '') || o.ev.event_translated || o.ev.short_name);
      $('nsNext').innerHTML = `<div class="nc-hero-top"><span class="nc-eyebrow">⏰ ข่าวแรงถัดไป</span>${impHtml(im)}</div>
        <div class="nc-hero-main"><b class="nc-hero-name">${[...new Set(names)].slice(0, 2).join(' + ')}${names.length > 2 ? ` และอีก ${names.length - 2} ข่าว` : ''}</b>
          <div class="ns-count"><b class="mono" id="nsLeft" data-t="${n.t}">${leftText(n.t)}</b><small>${dayTime(n.t)} น.</small></div></div>
        ${rule ? `<p class="nc-rule">🪙 ${rule}</p>` : ''}
        <div class="ns-next-items">${n.items.map((o) => itemLine(o, false)).join('')}</div>
        <p class="ns-warn">⚠️ ราคาทองอาจวิ่งแรงในไม่กี่นาที · สัญญาณกรอบ ${window.CHARTSYS ? Object.entries(CHARTSYS.SYS).filter(([, s]) => s.news).map(([k]) => TF_LABEL[k]).join(' และ ') : '5 นาที และ 1 ชม.'} งดเปิดรายการใหม่ ±30 นาทีรอบข่าวนี้</p>`;
    } else $('nsNext').innerHTML = ns.at ? '<p class="muted">ไม่มีข่าวแรงของสหรัฐใน 8 วันข้างหน้า</p>' : '<p class="muted">กำลังโหลดปฏิทินข่าว…</p>';
    // 2) the coming days: one card per release time, grouped by day
    const days = new Map();
    ns.next.forEach((g) => { const k = dayLabel(g.t, now); days.set(k, [...(days.get(k) || []), g]); });
    $('nsWeek').innerHTML = ns.next.length ? [...days.entries()].map(([label, list]) => `<div class="nc-day"><h4 class="nc-dayh">${label}<small>${list.length} ช่วงเวลา</small></h4>
      ${list.map((g) => { const im = impactOf(g, by); return `<div class="nc ${im ? im.cls : ''}">
        <div class="nc-time mono">${hhmm(g.t)}</div>
        <div class="nc-body">${g.items.map((o) => itemLine(o, false)).join('')}</div>
        <div class="nc-side">${impHtml(im)}</div></div>`; }).join('')}</div>`).join('') : '<p class="muted">—</p>';
    // 3) released: one card each — result vs forecast, and where gold went
    $('nsPast').innerHTML = ns.past.length ? ns.past.slice(0, ns.showPast).map((g) => {
      const m = g.move, judged = g.items.find((o) => o.actual_to_forecast !== 'neutral') || g.items[0], a = usd(judged.actual_to_forecast);
      const dir = m && m.m60 != null ? (m.m60 >= 0 ? 'up' : 'down') : '';
      const follow = m && m.m60 != null && a.cls !== 'neu' ? ((a.cls === 'pos') === (m.m60 < 0)) : null;
      const cls = (v) => (v == null ? '' : v >= 0 ? 'up' : 'down');
      return `<div class="nc past ${dir}">
        <div class="nc-time"><b>${new Date(g.t).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })}</b><span class="mono">${hhmm(g.t)} น.</span></div>
        <div class="nc-body">${g.items.map((o) => itemLine(o, true)).join('')}</div>
        <div class="nc-gold ${dir}"><span class="nc-gl">ทอง 1 ชม. หลังข่าว</span>
          ${m && m.m60 != null ? `<b class="mono">${signed(m.m60)}</b><small>15 นาที <b class="mono ${cls(m.m15)}">${signed(m.m15)}</b> · แกว่ง ${m.range != null ? `$${f2(m.range)}` : '—'}</small>`
            : now - g.t < 60 * 60e3 ? '<small>รอครบ 1 ชม.</small>' : '<small class="muted">กำลังโหลด…</small>'}
          ${follow == null ? (a.gold ? `<small class="ns-hint ${a.cls}">${a.gold}</small>` : '') : `<small class="nc-follow ${follow ? 'yes' : 'no'}">${follow ? '✓ ไปตามตำรา' : '✗ สวนตำรา'} (${a.th})</small>`}</div></div>`;
    }).join('') + (ns.past.length > ns.showPast ? `<button type="button" class="btn ns-more" data-more="past">แสดงเพิ่ม (${ns.past.length - ns.showPast} ครั้ง)</button>` : '') : `<p class="muted">${ns.at ? 'ไม่มีข่าวแรงใน 60 วันที่ผ่านมา' : 'กำลังโหลด…'}</p>`;
    // 4) per release type (folded): how big gold's move usually is, and whether it followed the textbook direction
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

  // ---------- Real news with pictures (api/news.mjs ← investing.com Thai RSS), shown like a news site ----------
  // user, 15 Oct 2026: "อยากให้หน้าข่าวเป็นแบบนี้ ให้รูปและข้อความ … น่าดูและน่าเชื่อถือ" (sent news-site screenshots).
  // A lead story with a big picture + 2 beside it, then a 3-column grid; each links to the full article at the source.
  const nf = { items: null, at: 0, err: '', cat: 'all', show: 9, loading: false };
  const NF_CATS = [['all', 'ทั้งหมด'], ['gold', 'ทองคำ'], ['econ', 'เศรษฐกิจ'], ['data', 'ตัวเลขเศรษฐกิจ']];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function ago(t) {
    if (!t) return '';
    const m = Math.max(0, Math.round((Date.now() - t) / 60e3));
    if (m < 1) return 'เมื่อสักครู่';
    if (m < 60) return `${m} นาทีที่ผ่านมา`;
    if (m < 24 * 60) return `${Math.floor(m / 60)} ชั่วโมงที่ผ่านมา`;
    return new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
  }
  // Pictures (16 Oct 2026, user: "เครื่องอื่นรูปภาพไม่ขึ้น … 403"): investing.com's image host sits behind Cloudflare, which
  // answers 403 to some devices / browsers and not others. They load through wsrv.nl, a free image relay that fetches them
  // server-side (and caches); then straight from investing as before; then the category cover (.nf-img background).
  // The lead story asks for the bigger picture (_L) first.
  const relay = (u, w) => `https://wsrv.nl/?url=${encodeURIComponent(u.replace(/^https?:\/\//, ''))}&w=${w}&output=webp`;
  const pic = (x, big) => {
    if (!x.img) return '';
    const tries = [...(big ? [relay(x.img.replace(/_M\.jpg$/, '_L.jpg'), 960)] : []), relay(x.img, 640), x.img];
    return `<img loading="lazy" alt="" referrerpolicy="no-referrer" src="${esc(tries[0])}" data-tries="${esc(tries.slice(1).join(' '))}" onerror="var t=(this.dataset.tries||'').split(' ').filter(Boolean);if(t.length){this.dataset.tries=t.slice(1).join(' ');this.src=t[0]}else{this.remove()}">`;
  };
  // investing.com can answer 403 to the article page on those devices too: a second way in — the headline on Google News
  const alt = (x) => `https://news.google.com/search?q=${encodeURIComponent(x.title)}&hl=th&gl=TH&ceid=TH:th`;
  const src = (x) => `<span class="nf-src"><i class="nf-logo">I</i>Investing.com · ${esc(x.label)}</span>`;
  const story = (x, kind) => `<a class="nf-${kind}" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">
      <div class="nf-img" data-cat="${x.cat}">${pic(x, kind !== 'card')}<span class="nf-cat ${x.cat}">${esc(x.label)}</span></div>
      <div class="nf-txt">${src(x)}<h3>${esc(x.title)}</h3><small class="nf-ago" data-t="${x.t || ''}">${ago(x.t)}</small><span class="nf-alt" role="link" data-alt="${esc(alt(x))}">เปิดไม่ได้? หาข่าวนี้จากแหล่งอื่น ›</span></div></a>`;
  // the second link sits inside the card's <a>: open it without following the card
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('.nf-alt'); if (!a) return;
    ev.preventDefault(); ev.stopPropagation(); window.open(a.dataset.alt, '_blank', 'noopener');
  }, true);
  function renderFeed() {
    const box = $('nfBody'); if (!box) return;
    $('nfChips').innerHTML = NF_CATS.map(([k, l]) => `<button type="button" data-nf="${k}" class="${nf.cat === k ? 'on' : ''}">${l}</button>`).join('');
    if (!nf.items) { nf.html = ''; box.innerHTML = `<p class="muted">${nf.err ? `โหลดข่าวไม่ได้ (${esc(nf.err)}) — ลองใหม่อีกครั้งภายหลัง` : 'กำลังโหลดข่าว…'}</p>`; return; }
    const list = nf.items.filter((x) => nf.cat === 'all' || x.cat === nf.cat);
    if (!list.length) { nf.html = ''; box.innerHTML = '<p class="muted">ยังไม่มีข่าวในหมวดนี้</p>'; return; }
    const [lead, ...rest] = list, side = rest.slice(0, 2), grid = rest.slice(2, 2 + nf.show); // top row: 3 stories the same size (user, 15 Oct: the big lead was "ใหญ่ไป")
    const html = `<div class="nf-top">${[lead, ...side].map((x) => story(x, 'hd')).join('')}</div>
      ${grid.length ? `<div class="nf-grid">${grid.map((x) => story(x, 'card')).join('')}</div>` : ''}
      ${rest.length > 2 + nf.show ? `<button type="button" class="btn nf-more" data-nfmore="1">ดูข่าวเพิ่ม (${rest.length - 2 - nf.show})</button>` : ''}
      <p class="nf-note">ข่าวจาก Investing.com ภาษาไทย · กดที่ข่าวเพื่ออ่านฉบับเต็มที่เว็บต้นทาง · ข่าวไม่ใช่คำแนะนำการลงทุน</p>`;
    if (nf.html !== html) { nf.html = html; box.innerHTML = html; } // only when something changed: no picture flicker
  }
  async function loadFeed(force) {
    if (nf.loading || (!force && Date.now() - nf.at < 55e3)) return; // every minute while the tab is open (user: "เรียลไทม์")
    nf.loading = true;
    try {
      const r = await fetch('/api/news', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      nf.items = j.items; nf.err = ''; nf.at = Date.now();
    } catch (e) { nf.err = e.message; }
    nf.loading = false;
    renderFeed();
  }
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-nf]');
    if (c) { nf.cat = c.dataset.nf; nf.show = 9; renderFeed(); return; }
    if (e.target.closest('[data-nfmore]')) { nf.show += 9; renderFeed(); }
  });
  // "x นาทีที่ผ่านมา" stays true while the tab is open; new stories every 5 minutes
  setInterval(() => {
    document.querySelectorAll('.nf-ago[data-t]').forEach((el) => { if (+el.dataset.t) el.textContent = ago(+el.dataset.t); });
    if ($('tab-stats') && !$('tab-stats').hidden && !document.hidden) loadFeed();
  }, 60e3);

  // keep opened news items open when the lists re-render (every 15 s around a release)
  document.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.classList || !d.classList.contains('ns-item')) return;
    if (d.open) ns.openItems.add(d.dataset.key); else ns.openItems.delete(d.dataset.key);
  }, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.ns-more');
    if (!b) return;
    if (b.dataset.more === 'past') ns.showPast += 20; else ns.showTable = 999;
    render();
  });
  window.renderNewsStats = function () { render(); load(); renderFeed(); loadFeed(); };

  // ---------- Live (user, 9 Oct: "อยากให้เรียลไทม์ทุกอย่าง เช่นข่าวของสหรัฐเรียลไทม์") ----------
  // • every second: the countdowns (news tab + the strip on every tab)
  // • around a release (2 min before → 20 min after, until the actual is out): the calendar every 15 s
  // • otherwise: the calendar every 5 minutes; the 60-day history every 10 minutes
  // The strip (#newsLive, top of every tab): 15 minutes before → countdown; released → actual vs forecast and how far
  // gold has moved since the release (live price − the 1-minute open at the release, Binance PAXG for that open)
  const live = { at: 0, polling: false, open: new Map() };
  async function releaseOpen(t) {
    if (live.open.has(t)) return live.open.get(t);
    live.open.set(t, null);
    try {
      const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=1m&startTime=${t}&limit=1`);
      const k = await r.json();
      if (k[0] && k[0][0] >= t && k[0][0] < t + 60e3) {
        // PAXG trades a few dollars off spot: line it up with the live price via the latest 1-minute candle
        const r2 = await fetch('https://data-api.binance.vision/api/v3/klines?symbol=PAXGUSDT&interval=1m&limit=1');
        const k2 = await r2.json();
        const off = state.livePrice != null && k2[0] ? state.livePrice - +k2[0][4] : 0;
        live.open.set(t, +k[0][1] + off);
      }
    } catch (e) { live.open.delete(t); }
    return live.open.get(t);
  }
  const hot = (now) => [...ns.next, ...ns.past.slice(0, 3)].some((g) => now > g.t - 2 * 60e3 && now < g.t + 20 * 60e3 && g.items.some((o) => o.actual == null));
  async function pollNow() {
    if (live.polling) return;
    live.polling = true;
    try {
      const now = Date.now();
      const list = await calendar(now - 864e5, now + 8 * 864e5);
      const released = groupByTime(list.filter((o) => o.t <= now && o.actual != null));
      const pending = groupByTime(list.filter((o) => o.t > now || o.actual == null)).filter((g) => g.t > now - 30 * 60e3).sort((a, b) => a.t - b.t);
      // newly released groups go to the top of the history; groups still waiting for the actual stay "next"
      released.forEach((g) => { const i = ns.past.findIndex((p) => p.t === g.t); if (i >= 0) ns.past[i].items = g.items; else ns.past.unshift(g); });
      ns.past.sort((a, b) => b.t - a.t);
      ns.next = pending;
      live.at = now;
      // the signal system skips trades around these (main.js state.news, same shape as refreshNews)
      state.news = [...ns.next, ...released].filter((g) => g.t > now - 3 * 3600e3)
        .map((g) => ({ time: g.t, title: [...new Set(g.items.map((o) => o.ev.short_name || 'US data'))].join(' · ').slice(0, 120) }))
        .sort((a, b) => a.time - b.time);
      render();
    } catch (e) { /* keep what we have */ }
    live.polling = false;
  }
  function strip() {
    const el = $('newsLive');
    if (!el) return;
    const now = Date.now();
    const soon = ns.next.find((g) => g.t > now && g.t - now <= 15 * 60e3);
    const just = ns.past.find((g) => now - g.t >= 0 && now - g.t <= 30 * 60e3)
      || ns.next.find((g) => g.t <= now && now - g.t <= 30 * 60e3); // released, actual not out yet
    const g = just || soon;
    if (!g) { el.hidden = true; return; }
    const names = [...new Set(g.items.map((o) => thName(o.ev.short_name || '') || o.ev.event_translated || o.ev.short_name))].join(' · ');
    el.hidden = false;
    if (g === soon && !just) {
      const s = Math.max(0, Math.round((g.t - now) / 1000));
      el.className = 'news-live soon';
      el.innerHTML = `<span class="nl-tag">⏰ ข่าวแรงกำลังมา</span><b class="mono">${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}</b><span class="nl-name">${names}</span>`
        + `<span class="nl-nums">${g.items.slice(0, 3).map((o) => `คาด ${val(o.forecast, o)}`).join(' · ')}</span><a href="#stats">ดูข่าว ›</a>`;
      return;
    }
    const out = g.items.filter((o) => o.actual != null);
    const a = usd((out.find((o) => o.actual_to_forecast !== 'neutral') || out[0] || {}).actual_to_forecast);
    const p0 = live.open.get(g.t), px = state.livePrice;
    if (p0 === undefined) releaseOpen(g.t).then(strip);
    const mv = p0 != null && px != null ? SIG.round(px - p0) : null;
    el.className = `news-live out ${a.cls}`;
    el.innerHTML = `<span class="nl-tag">🔴 ข่าวออกแล้ว ${hhmm(g.t)} น.</span><span class="nl-name">${names}</span>`
      + (out.length ? `<span class="nl-nums">${out.slice(0, 3).map((o) => `จริง <b class="mono">${val(o.actual, o)}</b> / คาด ${val(o.forecast, o)}`).join(' · ')}</span><span class="ns-chip ${a.cls}">${a.th}</span>`
        : '<span class="nl-nums">รอตัวเลขจริง… (เช็กทุก 15 วินาที)</span>')
      + `<span class="nl-gold">ทองตั้งแต่ข่าวออก <b class="mono ${mv == null ? '' : mv >= 0 ? 'up' : 'down'}">${mv == null ? '…' : signed(mv)}</b></span><a href="#stats">ดูข่าว ›</a>`;
  }
  // Seconds: countdowns + the strip; the calendar on its own schedule
  setInterval(() => {
    const now = Date.now();
    strip();
    if (!$('tab-stats').hidden) countdown();
    if (now - live.at > (hot(now) ? 15e3 : 5 * 60e3)) pollNow();
    if (!$('tab-stats').hidden && now - ns.at > 10 * 60e3) load();
  }, 1000);
  // first load right away (the strip needs the calendar on every tab)
  load().then(pollNow);
})();
