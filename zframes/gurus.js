// 🧑‍💼 พอร์ตกูรู (Guru Portfolio + Guru Focus) — user, 16 Oct 2026: "อยากให้ทำเหมือนแอป Dime แบบเรียลไทม์ ที่มีผู้เชี่ยวชาญ",
// as a tab of หุ้นสหรัฐ, 20+ gurus. Holdings: SEC 13F filings (scripts/gurus-13f.js → dashboards/gurus.json, data branch,
// refreshed daily; a filing comes once a quarter, up to 45 days after it). Values are marked to the live price
// (QS from site-live.js: Yahoo stream + /api/zframes/quotes), so each portfolio moves in real time between filings.
(function () {
  let G = null; // gurus.json
  const Q = () => (typeof QS === 'object' ? QS : {}); // live.js keeps QS as a top-level const (not on window)
  const q = (s) => { const x = Q()[s]; return x && x.px > 0 ? x.px : null; };
  const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TH_UNITS = [[1e12, 'ล้านล้าน'], [1e11, 'แสนล้าน'], [1e10, 'หมื่นล้าน'], [1e9, 'พันล้าน'], [1e8, 'ร้อยล้าน'], [1e6, 'ล้าน']];
  const money = (v) => { if (!(v > 0)) return '—'; const u = TH_UNITS.find(([n]) => v >= n); return u ? `$${(v / u[0]).toFixed(2)} ${u[1]}` : `$${Math.round(v).toLocaleString('en-US')}`; };
  const pct = (v, d = 1) => (v == null || !isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`);
  const cls = (v) => (v == null || !isFinite(v) ? '' : v >= 0 ? 'up' : 'down');
  const qLabel = (p) => { const d = new Date(p); return `ไตรมาส ${Math.floor(d.getUTCMonth() / 3) + 1}/${d.getUTCFullYear() + 543}`; };
  const thDate = (s) => new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  const ACT = { new: ['ซื้อใหม่', 'up'], add: ['ซื้อเพิ่ม', 'up'], cut: ['ขายบางส่วน', 'down'], exit: ['ขายหมด', 'down'] };
  const initials = (g) => g.en.replace(/\(.*\)/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const stale = (g) => Date.now() - Date.parse(g.period) > 200 * 864e5; // a manager that stopped filing
  // every guru has a picture (user, 16 Oct 2026: "เอาให้มีทุกคน"): a freely licensed photo (Wikimedia Commons), else the
  // fund's logo (its site icon), else the fund's name as a gold wordmark — scripts/gurus-13f.js. A broken image → initials.
  const avatar = (g, big) => {
    const p = g.photo || {};
    if (p.mark) return `<span class="gu-av mark${big ? ' big' : ''}${p.mark.length > 8 ? ' xl' : p.mark.length > 6 ? ' long' : ''}"><i>${e(p.mark)}</i></span>`;
    return `<span class="gu-av${p.logo ? ' logo' : ''}${big ? ' big' : ''}">${p.url ? `<img src="${e(p.url)}"${p.pos ? ` style="object-position:${e(p.pos)};transform:scale(2);transform-origin:${e(p.pos)}"` : ""} alt="${e(p.logo ? g.fund : g.th)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<i>${e(initials(g))}</i></span>`;
  };
  const credit = (g) => { const p = g.photo || {};
    if (p.logo) return `โลโก้: ${e(g.fund)} (<a href="${e(p.page)}" target="_blank" rel="noopener">${e(p.by)}</a>)`;
    return p.url ? `รูป: <a href="${e(p.page)}" target="_blank" rel="noopener">${e(p.by)}</a> · ${e(p.lic)} · Wikimedia Commons` : ''; };

  // live value of one holding: shares × live price (falls back to the filing's own value)
  const liveOf = (h) => { const px = h.s && q(h.s); return px ? { v: px * h.shares, px, ch: px / (h.value / h.shares) - 1 } : { v: h.value, px: null, ch: null }; };
  function liveGuru(g) {
    let v = 0, base = 0, live = 0;
    for (const h of g.top) { const L = liveOf(h); v += L.v; base += h.value; if (L.px) live++; }
    const rest = g.total - base; // holdings beyond the top list keep their filed value
    return { value: v + rest, ch: base ? (v - base) / g.total : null, live, n: g.top.length };
  }

  // ⭐ followed gurus (user, 16 Oct 2026): saved on the server per member (/api/gurus/follow — guru alerts go only to
  // them), with this browser's copy as a fallback. Followed ones come first.
  let FOL = new Set();
  try { FOL = new Set(JSON.parse(localStorage.getItem('gs-guru-follow') || '[]')); } catch (err) { /* storage blocked */ }
  const saveFollows = () => {
    const ciks = [...FOL];
    try { localStorage.setItem('gs-guru-follow', JSON.stringify(ciks)); } catch (err) { /* ok */ }
    fetch('/api/gurus/follow', { method: 'POST', headers: { 'x-follow': btoa(JSON.stringify({ ciks })) } }).catch(() => {});
  };
  fetch('/api/gurus/follow', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (j && Array.isArray(j.ciks) && (j.ciks.length || !FOL.size)) { FOL = new Set(j.ciks.map(Number)); paint(); paintLive(); }
    else if (j && FOL.size) saveFollows(); // a follow list saved only in this browser → the server
  }).catch(() => {});
  const star = (g) => `<span class="gu-star${FOL.has(g.cik) ? ' on' : ''}" data-follow="${g.cik}" role="button" aria-label="${FOL.has(g.cik) ? 'เลิกติดตาม' : 'ติดตาม'} ${e(g.th)}" title="${FOL.has(g.cik) ? 'เลิกติดตาม' : 'ติดตาม — แจ้งเตือนเมื่อคนนี้ซื้อขาย'}">${FOL.has(g.cik) ? '★' : '☆'}</span>`;

  function guruCards() {
    const sort = document.querySelector('[data-gsort].on')?.dataset.gsort || 'value';
    const list = G.gurus.map((g) => ({ g, L: liveGuru(g) }));
    list.sort((a, b) => (FOL.has(b.g.cik) - FOL.has(a.g.cik)) || (sort === 'filed' ? b.g.filed.localeCompare(a.g.filed) : sort === 'ch' ? (b.L.ch ?? -9) - (a.L.ch ?? -9) : b.L.value - a.L.value));
    return list.map(({ g, L }) => `<button type="button" class="gu${FOL.has(g.cik) ? ' fol' : ''}" data-guru="${g.cik}">
      ${avatar(g)}
      <span class="gu-n"><b>${star(g)} ${e(g.th)}</b><small>${e(g.fund)} · ${e(g.style)}</small>
        <small>อันดับ 1: <b>${e(g.top[0]?.s || g.top[0]?.name || '—')}</b> ${g.top[0] ? `${g.top[0].w}%` : ''} · ${g.count} ตัว${stale(g) ? ' · <i class="gu-old">หยุดยื่นรายงาน</i>' : ''}</small></span>
      <span class="gu-v"><b class="mono" data-gv="${g.cik}">${money(L.value)}</b><small class="mono ${cls(L.ch)}" data-gc="${g.cik}">${pct(L.ch, 2)}</small><small>${qLabel(g.period)}</small></span>
    </button>`).join('');
  }
  function focusRows() {
    const f = document.querySelector('[data-gact].on')?.dataset.gact || 'all';
    const want = (m) => f === 'all' || (f === 'buy' ? m.act === 'new' || m.act === 'add' : m.act === 'cut' || m.act === 'exit');
    // the 3 biggest moves per guru, so one manager with hundreds of small trades doesn't fill the list
    const rows = G.gurus.filter((g) => !stale(g)).flatMap((g) => g.moves.filter(want).slice(0, 3).map((m) => ({ g, m })))
      .sort((a, b) => b.m.value - a.m.value).slice(0, 30);
    return rows.map(({ g, m }) => `<tr data-guru="${g.cik}"><td><b>${e(g.th)}</b><small>${thDate(g.filed)}</small></td>
      <td><span class="gact ${ACT[m.act][1]}">${ACT[m.act][0]}${m.pct != null && m.act !== 'exit' ? ` ${m.pct > 0 ? '+' : ''}${m.pct}%` : ''}</span></td>
      <td><b>${e(m.s || '—')}</b><small>${e(m.name)}</small></td><td class="mono r">${money(m.value)}</td></tr>`).join('');
  }
  function crowd() {
    const m = new Map();
    for (const g of G.gurus) if (!stale(g)) for (const h of g.top) if (h.s) { const x = m.get(h.s) || { s: h.s, name: h.name, n: 0, who: [] }; x.n++; x.who.push(g.th); m.set(h.s, x); }
    return [...m.values()].filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 15)
      .map((x) => { const px = q(x.s), c = Q()[x.s]?.ch; return `<tr data-stock="${e(x.s)}"><td><b>${e(x.s)}</b><small>${e(x.name)}</small></td><td class="r"><b>${x.n}</b> คน</td>
        <td class="mono r">${px ? px.toFixed(2) : '—'}</td><td class="mono r ${cls(c)}">${pct(c, 2)}</td><td><small>${e(x.who.slice(0, 4).join(', '))}${x.who.length > 4 ? ' …' : ''}</small></td></tr>`; }).join('');
  }

  function paint() {
    if (!G) return;
    const a = document.getElementById('guList'), b = document.getElementById('guFocus'), c = document.getElementById('guCrowd');
    if (a) a.innerHTML = guruCards();
    if (b) b.innerHTML = focusRows();
    if (c) c.innerHTML = crowd();
  }
  // live numbers only (no re-layout) every 2 s while the tab is on screen
  setInterval(() => {
    if (!G || document.hidden || document.getElementById('gurus')?.hidden !== false) return;
    for (const g of G.gurus) { const L = liveGuru(g), v = document.querySelector(`[data-gv="${g.cik}"]`), c = document.querySelector(`[data-gc="${g.cik}"]`);
      if (v) v.textContent = money(L.value); if (c) { c.textContent = pct(L.ch, 2); c.className = `mono ${cls(L.ch)}`; } }
    const m = document.querySelector('.modal [data-gpanel]'); if (m) fillHoldings(m, G.gurus.find((g) => String(g.cik) === m.dataset.gpanel));
  }, 2000);

  function fillHoldings(el, g) {
    const L = liveGuru(g);
    el.querySelector('[data-gtot]').textContent = money(L.value);
    const c = el.querySelector('[data-gtc]'); c.textContent = pct(L.ch, 2); c.className = `mono ${cls(L.ch)}`;
    el.querySelector('tbody').innerHTML = g.top.map((h, i) => { const x = liveOf(h);
      return `<tr${h.s && window.dash?.stockMap?.[h.s] ? ` data-stock="${e(h.s)}" class="click"` : ''}><td class="r">${i + 1}</td><td><b>${e(h.s || '—')}</b><small>${e(h.name)}</small></td>
        <td class="r"><span class="gw" style="--w:${Math.min(100, h.w * 2)}%"></span>${h.w}%</td><td class="mono r">${Math.round(h.shares).toLocaleString('en-US')}</td>
        <td class="mono r">${x.px ? x.px.toFixed(2) : '—'}</td><td class="mono r">${money(x.v)}</td><td class="mono r ${cls(x.ch)}">${pct(x.ch)}</td>
        <td class="r">${h.chg == null ? '<span class="gact up">ใหม่</span>' : h.chg === 0 ? '<small>เท่าเดิม</small>' : `<span class="${h.chg > 0 ? 'up' : 'down'}">${h.chg > 0 ? '+' : ''}${h.chg}%</span>`}</td></tr>`; }).join('');
  }
  function openGuru(cik) {
    const g = G.gurus.find((x) => String(x.cik) === String(cik)); if (!g) return;
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="mbox mfull" data-gpanel="${g.cik}"><button class="mx" type="button" aria-label="ปิด">✕</button>
      <div class="gu-hd">${avatar(g, true)}<div><h2>${star(g)} ${e(g.th)} <small>${e(g.en)}</small></h2>
        <p class="muted">${e(g.fund)} (${e(g.filer)}) · ${e(g.style)} · ${qLabel(g.period)} · ยื่น ${thDate(g.filed)}${stale(g) ? ' · <b class="down">หยุดยื่นรายงานแล้ว — ข้อมูลล่าสุดที่มี</b>' : ''}</p></div>
        <div class="gu-v"><b class="mono" data-gtot>—</b><small class="mono" data-gtc>—</small><small>${g.count} ตัว · ตั้งแต่สิ้นไตรมาส</small></div></div>
      <section class="card"><h3><span>หุ้นในพอร์ต (${Math.min(g.top.length, g.count)} อันดับแรก)</span><small>ราคาสด × จำนวนหุ้นที่รายงาน</small></h3>
        <div class="tbl"><table class="st gt"><thead><tr><th>#</th><th>หุ้น</th><th class="r">% พอร์ต</th><th class="r">จำนวนหุ้น</th><th class="r">ราคาสด</th><th class="r">มูลค่าสด</th><th class="r">ตั้งแต่สิ้นไตรมาส</th><th class="r">เทียบไตรมาสก่อน</th></tr></thead><tbody></tbody></table></div></section>
      ${(LV?.items || []).some((x) => x.cik === g.cik) ? `<section class="card"><h3><span>⚡ ล่าสุดจาก SEC</span><small>ฟอร์ม 4 · 13D/G ใน ${LV.days} วัน</small></h3><ul class="gu-live">${liveRows(LV.items.filter((x) => x.cik === g.cik).slice(0, 10))}</ul></section>` : ''}
      ${g.moves.length ? `<section class="card"><h3><span>เคลื่อนไหวไตรมาสนี้</span><small>เทียบ ${g.prevPeriod ? qLabel(g.prevPeriod) : 'ไตรมาสก่อน'}</small></h3><div class="gmv">${g.moves.slice(0, 20).map((x) => `<span class="gact ${ACT[x.act][1]}">${ACT[x.act][0]} <b>${e(x.s || x.name)}</b>${x.pct != null && x.act !== 'exit' ? ` ${x.pct > 0 ? '+' : ''}${x.pct}%` : ''}</span>`).join('')}</div></section>` : ''}
      <p class="foot">${credit(g) ? `${credit(g)}<br>` : ""}ที่มา: รายงาน 13F ต่อ SEC — ยื่นไตรมาสละครั้ง ช้าสุด 45 วันหลังจบไตรมาส จึงไม่ใช่พอร์ตปัจจุบันจริง · รวมเฉพาะหุ้น/ETF ที่จดทะเบียนในสหรัฐ ไม่รวมออปชัน · ไม่ใช่คำแนะนำการลงทุน</p></div>`;
    document.body.appendChild(m);
    fillHoldings(m.querySelector('[data-gpanel]'), g);
    m.addEventListener('click', (ev) => {
      if (ev.target === m || ev.target.closest('.mx')) return m.remove();
      const r = ev.target.closest('tr[data-stock]'); if (r && typeof openStock === 'function') openStock(r.dataset.stock);
    });
  }

  document.addEventListener('click', (ev) => {
    const fo = ev.target.closest('[data-follow]'); // ⭐ inside a guru card: follow / unfollow, don't open the card
    if (fo) { ev.preventDefault(); ev.stopPropagation(); const c = +fo.dataset.follow; if (FOL.has(c)) FOL.delete(c); else FOL.add(c); saveFollows(); paint(); paintLive(); return; }
    const s = ev.target.closest('[data-gsort], [data-gact], [data-glive]');
    if (s) { s.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === s)); paint(); paintLive(); return; }
    if (ev.target.closest('a')) return; // SEC links open in a new tab, not the guru page
    const g = ev.target.closest('#gurus [data-guru]'); if (g) return openGuru(g.dataset.guru);
    const st = ev.target.closest('#gurus tr[data-stock]'); if (st && window.dash?.stockMap?.[st.dataset.stock] && typeof openStock === 'function') openStock(st.dataset.stock);
  });

  FRAMES.gurus = () => `<div class="chips"><button type="button" data-gsort="value" class="on">มูลค่าพอร์ตสูงสุด</button><button type="button" data-gsort="filed">อัปเดตล่าสุด</button><button type="button" data-gsort="ch">กำไรตั้งแต่สิ้นไตรมาส</button></div><div class="gu-list" id="guList"><p class="muted">กำลังโหลด…</p></div><p class="gu-credit">รูปบุคคล: Wikimedia Commons (สัญญาอนุญาตเสรี — ชื่อผู้ถ่ายอยู่ในหน้าของแต่ละคน) · คนที่ไม่มีรูปเสรีใช้โลโก้หรือชื่อของกองทุน</p>`;
  FRAMES.guruFocus = () => `<div class="chips"><button type="button" data-gact="all" class="on">ทั้งหมด</button><button type="button" data-gact="buy">ซื้อ</button><button type="button" data-gact="sell">ขาย</button></div><div class="tbl"><table class="st gt"><thead><tr><th>กูรู</th><th>ทำอะไร</th><th>หุ้น</th><th class="r">มูลค่า</th></tr></thead><tbody id="guFocus"></tbody></table></div>`;
  FRAMES.guruCrowd = () => `<div class="tbl"><table class="st gt"><thead><tr><th>หุ้น</th><th class="r">กูรูที่ถือ</th><th class="r">ราคาสด</th><th class="r">วันนี้</th><th>ใครถือ</th></tr></thead><tbody id="guCrowd"></tbody></table></div>`;

  // ⚡ live SEC filings (scripts/gurus-live.js every 10 min → dashboards/gurus-live.json): Form 4 buys / sells,
  // 13D / 13G stakes, new 13F — user, 16 Oct 2026: "ขอทุกอย่างแบบเรียลไทม์". Re-read every 2 minutes.
  let LV = null;
  const KIND = { f4: 'ฟอร์ม 4 · ซื้อขายจริง', '13d': '13D · ถือเกิน 5% (เชิงรุก)', '13g': '13G · ถือเกิน 5%', '13f': '13F · พอร์ตไตรมาสใหม่', ark: 'ARK · ซื้อขายรายวัน' };
  const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60e3); return m < 60 ? `${m} นาทีที่แล้ว` : m < 1440 ? `${Math.round(m / 60)} ชม.ที่แล้ว` : `${Math.round(m / 1440)} วันที่แล้ว`; };
  const num = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)} ล้าน` : Math.round(v).toLocaleString('en-US'));
  function liveText(x) {
    if (x.kind === 'ark') { // ARK's own daily holdings, day over day (scripts/gurus-live.js arkTrades)
      const one = (m) => `<b>${e(m.s)}</b> ${m.d > 0 ? '+' : '−'}${num(Math.abs(m.d))} หุ้น${m.new ? ' (ใหม่)' : m.exit ? ' (ขายหมด)' : ''} <small>≈ ${money(m.usd)}</small>`;
      return `กองทุน <b>${e(x.fund)}</b> · ${thDate(x.filed)}${x.buys?.length ? `<br><span class="gact up">ซื้อ</span> ${x.buys.map(one).join(' · ')}` : ''}${x.sells?.length ? `<br><span class="gact down">ขาย</span> ${x.sells.map(one).join(' · ')}` : ''}`;
    }
    const s = x.symbol ? `<b>${e(x.symbol)}</b>` : `<b>${e(x.issuer || '—')}</b>`;
    if (x.kind === 'f4') {
      const parts = [];
      if (x.buy) parts.push(`<span class="gact up">ซื้อ</span> ${s} ${num(x.buy)} หุ้น ≈ ${money(x.buyUsd)}${x.buyUsd && x.buy ? ` @ $${(x.buyUsd / x.buy).toFixed(2)}` : ''}`);
      if (x.sell) parts.push(`<span class="gact down">ขาย</span> ${s} ${num(x.sell)} หุ้น ≈ ${money(x.sellUsd)}${x.sellUsd && x.sell ? ` @ $${(x.sellUsd / x.sell).toFixed(2)}` : ''}`);
      const px = x.symbol && q(x.symbol), avg = x.buy ? x.buyUsd / x.buy : x.sell ? x.sellUsd / x.sell : null;
      const since = px && avg ? ` · ราคาตอนนี้ $${px.toFixed(2)} <span class="${cls(px / avg - 1)}">${pct(px / avg - 1)}</span>` : '';
      return `${parts.join(' · ')}${x.after ? ` · ถือหลังทำรายการ ${num(x.after)} หุ้น` : ''}${since}${x.date ? ` · วันที่ซื้อขาย ${thDate(x.date)}` : ''}`;
    }
    if (x.kind === '13f') return 'ยื่นพอร์ตรายไตรมาสใหม่ — ระบบกำลังอัปเดตพอร์ตของคนนี้';
    if (x.pct === 0) return `<span class="gact down">ลดลงต่ำกว่า 5%</span> ${s}`;
    return `${s}${x.issuer && x.symbol ? ` <small>${e(x.issuer)}</small>` : ''}${x.pct != null ? ` · ถือ <b>${x.pct}%</b> ของบริษัท` : ''}${x.shares ? ` (${num(x.shares)} หุ้น)` : ''}`;
  }
  const liveRows = (list) => list.map((x) => { const g = G?.gurus.find((y) => y.cik === x.cik);
    return `<li data-guru="${x.cik}">${g ? avatar(g) : ''}<div><div class="lv-h"><b>${e(x.th)}</b><span class="lv-k ${x.kind}">${KIND[x.kind] || e(x.form)}</span><small>${ago(x.at)}</small></div>
      <div class="lv-t">${liveText(x)}</div><a class="lv-a" href="${e(x.url)}" target="_blank" rel="noopener">${x.kind === 'ark' ? 'หน้ากองทุน ARK ↗' : 'เอกสาร SEC ↗'}</a></div></li>`; }).join('');
  function paintLive() {
    const el = document.getElementById('guLive'); if (!el) return;
    if (!LV) { el.innerHTML = '<p class="muted">กำลังโหลด…</p>'; return; }
    const only = document.querySelector('[data-glive].on')?.dataset.glive === 'fol';
    const list = LV.items.filter((x) => !only || FOL.has(x.cik));
    el.innerHTML = list.length ? `<ul class="gu-live">${liveRows(list.slice(0, 20))}</ul>`
      : `<p class="muted">${only ? (FOL.size ? 'คนที่ติดตามยังไม่มีรายงานใหม่' : 'ยังไม่ได้ติดตามใคร — กด ☆ ที่การ์ดกูรูด้านล่าง') : `ยังไม่มีรายงานใหม่ใน ${LV.days} วัน`}</p>`;
    const st = document.getElementById('guLiveAt'); if (st) st.textContent = `ข้อมูล SEC ถึง ${new Date(LV.asOf).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })} · เช็กทุก 10 นาที`;
  }
  async function loadLive() {
    try { const r = await fetch('./dashboards/gurus-live.json', { cache: 'no-store' }); if (r.ok) { LV = await r.json(); paintLive(); } } catch (err) { /* keep the last copy */ }
  }
  setInterval(() => { if (!document.hidden && !window.zfPaused) loadLive(); }, 120e3);
  setInterval(() => { if (!document.hidden && document.getElementById('gurus')?.hidden === false) paintLive(); }, 30e3); // "x นาทีที่แล้ว" + live price
  FRAMES.guruLive = () => `<div class="chips"><button type="button" data-glive="all" class="on">ทั้งหมด</button><button type="button" data-glive="fol">⭐ เฉพาะที่ติดตาม</button></div>
    <div id="guLive"><p class="muted">กำลังโหลด…</p></div><p class="gu-credit" id="guLiveAt"></p>
    <p class="gu-credit">🔔 แจ้งเตือนบนเครื่องเมื่อกูรูซื้อขาย (ฟอร์ม 4 · ARK รายวัน): เปิด "แจ้งเตือน" ที่แท็บบัญชี · ถ้ากด ☆ ติดตามไว้ จะแจ้งเฉพาะคนที่ติดตาม</p>`;

  // 🧑‍💼 which gurus hold a stock — a card on every stock page (frames3.js openStock / openDiv, 17 Oct 2026). From each guru's
  // top 40 holdings in the latest 13F, plus their SEC filings on that stock in the last 45 days.
  function holdersHtml(s) {
    if (!G) return '';
    const rows = G.gurus.filter((g) => !stale(g)).map((g) => ({ g, h: g.top.find((x) => x.s === s), m: g.moves.find((x) => x.s === s) }))
      .filter((x) => x.h || (x.m && x.m.act === 'exit')).sort((a, b) => (b.h?.w || 0) - (a.h?.w || 0));
    const live = (LV?.items || []).filter((x) => x.symbol === s);
    if (!rows.length && !live.length) return `<section class="card gh"><h3><span>🧑‍💼 กูรูที่ถือหุ้นนี้</span><small>SEC 13F</small></h3><p class="muted small">ไม่อยู่ใน 40 อันดับแรกของพอร์ตกูรู ${G.gurus.length} คนที่เราติดตาม</p></section>`;
    const px = q(s);
    return `<section class="card gh"><h3><span>🧑‍💼 กูรูที่ถือหุ้นนี้ · ${rows.filter((x) => x.h).length} คน</span><small>SEC 13F ${qLabel(G.gurus[0].period)} · 40 อันดับแรกของแต่ละพอร์ต</small></h3>
      ${live.length ? `<ul class="gu-live">${liveRows(live.slice(0, 4))}</ul>` : ''}
      <div class="tbl"><table class="st gt"><thead><tr><th>กูรู</th><th class="r">% พอร์ต</th><th class="r">จำนวนหุ้น</th><th class="r">มูลค่าสด</th><th class="r">เทียบไตรมาสก่อน</th></tr></thead><tbody>
      ${rows.map(({ g, h, m }) => `<tr data-guru="${g.cik}" class="click"><td><span class="gh-who">${avatar(g)}<b>${e(g.th)}</b></span></td>
        <td class="r">${h ? `${h.w}%` : '—'}</td><td class="mono r">${h ? Math.round(h.shares).toLocaleString('en-US') : '—'}</td>
        <td class="mono r">${h ? money(px ? px * h.shares : h.value) : '—'}</td>
        <td class="r">${!h ? '<span class="gact down">ขายหมด</span>' : h.chg == null ? '<span class="gact up">ซื้อใหม่</span>' : h.chg === 0 ? '<small>เท่าเดิม</small>' : `<span class="${h.chg > 0 ? 'up' : 'down'}">${h.chg > 0 ? '+' : ''}${h.chg}%</span>`}</td></tr>`).join('')}
      </tbody></table></div></section>`;
  }
  async function attachHolders(m, s) {
    if (!G) { try { const r = await fetch('./dashboards/gurus.json', { cache: 'no-store' }); if (r.ok) G = await r.json(); } catch (err) { return; } }
    if (!LV) await loadLive();
    const box = m.querySelector('.mbox'); if (!box || !G) return;
    const html = holdersHtml(s); if (!html) return;
    const wrap = document.createElement('div'); wrap.className = 'grid'; wrap.innerHTML = html;
    const first = box.querySelector('.grid'); if (first) first.after(wrap); else box.appendChild(wrap);
    wrap.addEventListener('click', (ev) => { if (ev.target.closest('a')) return; const g = ev.target.closest('[data-guru]'); if (g) openGuru(g.dataset.guru); });
  }

  // app.js calls this after loading a dashboard: adds the tab and the gurus' tickers to the live price feed
  window.GURUS = {
    attachHolders,
    async inject(dash) {
      if (!dash || !['ndx', 'spx', 'div'].includes(dash.id || window.current)) { /* only the US stock sets */ }
      try { if (!G) { const r = await fetch('./dashboards/gurus.json', { cache: 'no-store' }); if (r.ok) G = await r.json(); } } catch (err) { G = null; }
      if (!G || !G.gurus?.length) return;
      if (!LV) await loadLive();
      const tickers = [...new Set([...G.gurus.flatMap((g) => g.top.map((h) => h.s)), ...(LV?.items || []).map((x) => x.symbol)].filter((s) => s && /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)))];
      dash.liveKeys = [...new Set([...(dash.liveKeys || []), ...tickers])];
      const asOf = G.gurus.map((g) => g.filed).sort().at(-1);
      dash.zones = [...dash.zones.filter((z) => z.id !== 'gurus'), { id: 'gurus', short: 'พอร์ตกูรู', title: 'พอร์ตกูรู',
        subtitle: `แกะพอร์ตนักลงทุนชั้นนำ ${G.gurus.length} คน จากรายงาน 13F ต่อ SEC (ล่าสุดยื่น ${thDate(asOf)}) · มูลค่าคิดด้วยราคาสดทุกวินาที · กดชื่อเพื่อดูหุ้นทั้งพอร์ต`,
        frames: [{ type: 'guruLive', span: 3, title: '⚡ ล่าสุดจาก SEC — กูรูซื้อขายอะไร (สด)', source: 'ฟอร์ม 4 · 13D/G · 13F · เช็กทุก 10 นาที' },
          { type: 'gurus', span: 3, title: 'Guru Portfolio — พอร์ตกูรู', source: 'SEC 13F · ราคาสด' },
          { type: 'guruFocus', span: 2, title: 'Guru Focus — เคลื่อนไหวล่าสุด', source: 'เทียบไตรมาสก่อน' },
          { type: 'guruCrowd', span: 1, title: 'หุ้นที่กูรูถือซ้ำกันมากสุด', source: 'ถือตั้งแต่ 3 คน' }] }];
      setTimeout(() => { paint(); paintLive(); }, 0);
    },
    paint,
  };
  // repaint once prices arrive (first quotes come a few seconds after the tab loads)
  setTimeout(paint, 4000); setTimeout(paint, 12000);
})();
