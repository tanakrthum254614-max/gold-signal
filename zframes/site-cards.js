// Cards that exist only inside the Gold Signal site (user, 12 Oct: "ทำมาหมดเลย" — the dashboard improvements):
//  • gs-signals (gold): Buy / Sell readiness of the site's tested systems on 5m / 15m / 30m / 1h, from the chart tab
//    itself (window.parent.GS_SIGNALS → chartchat.js) — the same numbers as the chart, the chat and the signals tab
//  • gs-news (every dashboard): the next high-impact US releases with a countdown, from the news tab (GS_NEWS)
//  • the gold "ผลจริงของ Gold Signal" card is recounted live from the recorded trades (GS_RECORD) instead of the morning snapshot
//  • the header says how old the written analysis is (notesAsOf) next to when the numbers were refreshed (generatedAt)
// Outside the site (the local /zframes runtime) none of the parent hooks exist and nothing changes.
(function () {
  const P = (() => { try { return window.parent !== window ? window.parent : null; } catch { return null; } })();
  const hook = (name) => { try { return P && typeof P[name] === 'function' ? P[name] : null; } catch { return null; } };
  const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (v) => (v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const hhmm = (ms) => new Date(ms).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const dayTh = (ms) => new Date(ms).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
  const until = (ms) => { const m = Math.round(ms / 60e3); if (m < 60) return `อีก ${m} นาที`; const h = Math.floor(m / 60); return h < 24 ? `อีก ${h} ชม. ${m % 60} นาที` : `อีก ${Math.floor(h / 24)} วัน ${h % 24} ชม.`; };
  const NEWS_WIN = 30 * 60e3; // the site skips entries ±30 min around these releases (5m / 1h)

  // ---------- renderers (registered next to frames.js's FRAMES) ----------
  const bar = (x, cls) => `<span class="gs-bar ${cls}${x.go ? ' go' : ''}${x.tested ? '' : ' untested'}"><i style="width:${Math.min(100, x.pct)}%"></i></span>`;
  FRAMES['gs-signals'] = (f) => {
    const rows = f.rows;
    if (!rows) return '<div class="empty">กำลังอ่านสัญญาณจากหน้ากราฟ…</div>';
    const go = rows.flatMap((r) => (r.loading || r.open ? [] : ['buy', 'sell'].filter((k) => r[k].go).map((k) => `${k === 'buy' ? '🟢 Buy' : '🔴 Sell'} กรอบ ${r.label}`)));
    const head = go.length ? `<div class="gs-call go">✅ ถึงจุดเข้า: ${e(go.join(' · '))}</div>`
      : `<div class="gs-call">⏸ ยังไม่มีกรอบไหนถึงจุดเข้า — รอให้ความพร้อมถึง 100%</div>`;
    return head + `<table class="gs-sig"><tr><th>กรอบ</th><th>ทิศ</th><th>Buy</th><th>Sell</th><th>สถานะ</th></tr>${rows.map((r) => {
      if (r.loading) return `<tr><td>${e(r.label)}</td><td colspan="4" class="muted">กำลังโหลด…</td></tr>`;
      const dir = r.dir > 0 ? '<span class="up">▲ ขึ้น</span>' : r.dir < 0 ? '<span class="down">▼ ลง</span>' : '<span class="muted">• ทรงตัว</span>';
      const st = r.open ? `📌 ถือ${r.open.side === 'SELL' ? 'ขาย' : 'ซื้อ'} ${f2(r.open.entry)}` : r.pause ? `⛔ พัก` : r.news ? '📰 งดช่วงข่าว' : r.buy.go || r.sell.go ? '✅ เข้าได้' : '⏸ รอ';
      const cell = (x, cls) => `<td>${bar(x, cls)}<b>${x.pct}%</b>${x.tested ? '' : ' <small class="muted">⚠️</small>'}</td>`;
      return `<tr><td><b>${e(r.label)}</b></td><td>${dir}</td>${cell(r.buy, 'b')}${cell(r.sell, 's')}<td>${st}</td></tr>`;
    }).join('')}</table><div class="gs-actions"><button type="button" class="gs-open" data-gs-tab="chart">เปิดหน้ากราฟ →</button><small class="muted">% = ความพร้อมเข้า · ⚠️ ฝั่งที่ทดสอบไม่ผ่าน ไม่ให้สัญญาณ · อัปเดตทุก 15 วิ</small></div>`;
  };
  FRAMES['gs-news'] = (f) => {
    const now = Date.now(), list = (f.items || []).filter((n) => n.time > now - NEWS_WIN && n.time < now + 8 * 864e5).slice(0, f.span === 3 ? 6 : 5);
    if (!f.items) return '<div class="empty">กำลังโหลดปฏิทินข่าว…</div>';
    if (!list.length) return '<div class="empty">ไม่มีข่าวแรงสหรัฐใน 8 วันข้างหน้า</div>';
    return `<ul class="gs-news${f.span === 3 ? ' wide' : ''}">${list.map((n) => {
      const d = n.time - now, live = Math.abs(d) <= NEWS_WIN;
      return `<li class="${live ? 'live' : d < 6 * 3600e3 ? 'soon' : ''}"><span class="t">${dayTh(n.time)} ${hhmm(n.time)}</span><b>${e(n.title)}</b><span class="c">${live ? '⚠️ ช่วงข่าวออก — ราคากระชากได้' : d > 0 ? until(d) : ''}</span></li>`;
    }).join('')}</ul>`;
  };

  // ---------- data ----------
  function recordRows() {
    const R = hook('GS_RECORD') && hook('GS_RECORD')();
    if (!R) return null;
    const rows = [];
    const done = (R.daily || []).filter((s) => s.status === 'win' || s.status === 'loss');
    if (R.daily && R.daily.length) rows.push({ system: 'สัญญาณรายวัน 07:00', closed: done.length, wins: done.filter((s) => s.status === 'win').length, losses: done.filter((s) => s.status === 'loss').length });
    const by = {};
    ((R.chart && R.chart.trades) || []).forEach((t) => {
      const d = by[t.tf || '?'] = by[t.tf || '?'] || { n: 0, wins: 0, losses: 0, open: 0, pnl: 0 };
      if (t.status === 'win' || t.status === 'loss') { d.n++; d[t.status === 'win' ? 'wins' : 'losses']++; d.pnl += +t.pnl || 0; } else d.open++;
    });
    Object.keys(by).sort().forEach((tf) => { const d = by[tf]; rows.push({ system: `สัญญาณกราฟ ${tf}`, closed: d.n, wins: d.wins, losses: d.losses, open: d.open, pnl: Math.round(d.pnl * 100) / 100 }); });
    return rows.length ? rows : null;
  }
  // Repaint one kind of card in place (only cards on the visible zone, and only when the html changed)
  function paint(type, patch) {
    document.querySelectorAll(`#app .zone:not([hidden]) .card[data-type="${type}"]`).forEach((card) => {
      const i = card.dataset.i, f = { ...FRAME_DATA[i], ...patch };
      FRAME_DATA[i] = f;
      const html = FRAMES[type](f), body = card.querySelector('.cbody');
      if (body && body.innerHTML !== html) body.innerHTML = html;
    });
  }

  let timers = [], refill = null;
  // a zone switch shows other cards: fill them right away (one listener for every dashboard loaded)
  document.addEventListener('click', (ev) => { if (refill && ev.target.closest('#app .zn button')) setTimeout(refill, 50); });
  window.SITE_CARDS = {
    // add the site cards to a freshly loaded dashboard (before it is drawn)
    inject(dash) {
      if (!P || !hook('GS_NEWS')) return;
      const live = dash.zones.find((z) => z.id === 'live') || dash.zones[0];
      if (!live) return;
      const add = [];
      if (dash.kind === 'gold' && hook('GS_SIGNALS')) add.push({ type: 'gs-signals', span: 2, title: 'สัญญาณ Gold Signal ตอนนี้', source: 'ระบบเดียวกับหน้ากราฟ · สด' });
      add.push({ type: 'gs-news', span: dash.kind === 'gold' ? 1 : 3, title: 'ข่าวแรงสหรัฐที่จะออก', source: 'ปฏิทิน investing.com · เวลาไทย' });
      live.frames = [...add, ...live.frames.filter((f) => !String(f.type).startsWith('gs-'))];
      if (dash.kind === 'gold' && hook('GS_RECORD')) dash.zones.forEach((z) => z.frames.forEach((f) => {
        if (f.type === 'record') { f.source = 'บันทึกจริง · อัปเดตสด'; const rows = recordRows(); if (rows) f.rows = rows; }
      }));
    },
    // header: when the numbers were refreshed, and how old the written analysis is
    stamp(dash) {
      const el = document.getElementById('stamp');
      if (!el) return;
      const at = new Date(dash.generatedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      if (!dash.notesAsOf) { el.textContent = 'ข้อมูลวิเคราะห์ ณ ' + at; return; }
      const days = Math.floor((Date.now() - Date.parse(dash.notesAsOf + 'T12:00:00+07:00')) / 864e5);
      const age = days <= 0 ? 'วันนี้' : `${days} วันก่อน`;
      el.innerHTML = `ตัวเลขอัปเดต ${e(at)} · <span class="notes-age${days > 3 ? ' old' : ''}" title="บทวิเคราะห์ (มุมมอง เหตุผล แผน ข่าว) เขียนโดย Claude — สั่งเขียนใหม่ได้ด้วย /zframes">บทวิเคราะห์ ${e(age)}${days > 3 ? ' ⚠️' : ''}</span>`;
    },
    // keep the site cards live while this dashboard is open
    start() {
      timers.forEach(clearInterval); timers = [];
      if (!P || !hook('GS_NEWS')) return;
      const news = () => paint('gs-news', { items: hook('GS_NEWS')() });
      const rec = () => { const rows = recordRows(); if (rows) paint('record', { rows }); };
      let busy = false;
      const sig = async () => {
        if (busy || !document.querySelector('#app .zone:not([hidden]) .card[data-type="gs-signals"]')) return;
        busy = true;
        try { paint('gs-signals', { rows: await hook('GS_SIGNALS')() }); } catch (err) { /* the chart tab is still loading */ } finally { busy = false; }
      };
      news(); rec(); sig();
      timers.push(setInterval(news, 1000), setInterval(rec, 60e3), setInterval(sig, 15e3));
      refill = () => { news(); rec(); sig(); };
    },
  };
  // "เปิดหน้ากราฟ →" switches the site's tab
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-gs-tab]');
    if (b && P) try { P.location.hash = b.dataset.gsTab; } catch { /* other origin */ }
  });
})();
