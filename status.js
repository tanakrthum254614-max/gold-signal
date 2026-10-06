// Home summary. Reads recorded trades separately from the browser's candle calculation.
(function (root) {
  const INTRA = root.INTRA || require('./intraday.js');
  const SIG = root.SIG || require('./signals.js');
  const age = (at, now) => {
    if (!Number.isFinite(at) || at <= 0 || at > now + 60000) return 'ยังไม่มีข้อมูล';
    const s = Math.max(0, Math.floor((now - at) / 1000));
    return s < 60 ? `${s} วินาที` : s < 3600 ? `${Math.floor(s / 60)} นาที` : s < 86400 ? `${Math.floor(s / 3600)} ชม. ${Math.floor(s % 3600 / 60)} นาที` : `${Math.floor(s / 86400)} วัน`;
  };
  const time = (at) => new Date(at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
  const score = (d) => d ? `${d.score > 0 ? '+' : ''}${d.score} / 6` : '—';

  function model(s, now, official, current) {
    const market = INTRA.marketOpen(now), slot = INTRA.slotOf(now);
    const records = s.intra && Array.isArray(s.intra.trades) ? s.intra.trades : [];
    const active = records.find((t) => !SIG.isFinal(t));
    const last = records[records.length - 1];
    const exit = last && (last.exitAt || last.expiresAt);
    const cooldown = !active && last && (exit + 15 * 60e3 > slot || last.createdAt >= slot);
    const nextEligible = cooldown ? Math.max(Math.ceil((exit + 15 * 60e3) / INTRA.SLOT) * INTRA.SLOT, INTRA.slotOf(last.createdAt) + INTRA.SLOT) : null;
    const pause = INTRA.paused(s.intra, now) ? s.intra.pause : null;
    const nearby = INTRA.newsNear(s.news, now);
    const calendarOld = !s.newsAt || s.newsError || now - s.newsAt > 60 * 60e3;
    const recordOld = !s.signalsAt || s.signalsError || now - s.signalsAt > 6 * 60e3;
    const frames = INTRA.FRAMES.map(([key, duration, , label]) => {
      // Use downloaded bar times: stream patches must not make old history appear newly verified.
      const times = s.intraMeta && s.intraMeta.times[key] || [];
      const closed = times.filter((t) => t + duration <= now);
      const end = closed.length ? Math.max(...closed) + duration : null;
      return { label, end, lag: end ? now - end : null, stale: !end || now - end > duration + 90e3 };
    });
    const barsOld = !s.intraMeta || s.intraError || now - s.intraMeta.at > 3 * 60e3 || frames.some((f) => f.stale);
    const priceOld = !s.tickAt || now - s.tickAt > 20e3 || (s.tickSrc !== 'stream' && (!s.priceBarAt || now - s.priceBarAt > 2 * 60e3));
    let key = 'wait', title = 'รอคะแนนแท่งปิด', detail = `ระบบ 30 นาทีเข้าเฉพาะฝั่งซื้อ เมื่อคะแนนแท่งปิดถึง +${INTRA.RULE.threshold} และผ่านเงื่อนไขทั้งหมด`;
    if (active) {
      key = 'active'; title = `มีไม้${active.side === 'BUY' ? 'ซื้อ' : 'ขาย'}ในบันทึกระบบ`;
      detail = `เข้า ${Number(active.entry).toLocaleString('en-US', { minimumFractionDigits: 2 })} · ${time(active.createdAt)} น. · ${now >= active.expiresAt ? 'ครบเวลาปิดแล้ว รอระบบอัปเดตผล' : `ครบเวลาปิด ${time(active.expiresAt)} น.`}`;
    } else if (!market) {
      key = 'closed'; title = 'ตลาดปิด'; detail = `เปิดอีกครั้ง ${time(INTRA.nextOpen(now))} น. · เวลาไทย`;
    } else if (pause) {
      key = 'paused'; title = 'ระบบพักการเปิดไม้'; detail = `${pause.reason} · พักถึง ${time(pause.until)} น.`;
    } else if (!official || barsOld || priceOld || recordOld || calendarOld) {
      key = 'data'; title = 'รอข้อมูลให้ครบและเป็นปัจจุบัน';
      detail = [!official || barsOld ? 'กราฟสำหรับคำนวณ' : '', priceOld ? 'ราคา' : '', recordOld ? 'บันทึกสัญญาณ' : '', calendarOld ? 'ปฏิทินข่าว' : ''].filter(Boolean).join(' · ');
    } else if (nearby || official.news) {
      title = 'รอช่วงข่าวแรงผ่านไป'; detail = `${(nearby || official.news).title} · งดเปิดไม้ใหม่ ±${INTRA.RULE.newsMin} นาทีรอบข่าว`;
    } else if (official.lastHour) {
      title = 'งดเปิดไม้ใหม่ก่อนตลาดปิด'; detail = `ระบบหยุดเปิดไม้ใหม่ช่วง ${SIG.mt(now, '02:00')}–${SIG.mt(now, '03:00')} น.`;
    } else if (cooldown) {
      title = 'รอรอบใหม่หลังไม้ก่อนปิด'; detail = `ตรวจได้อีกครั้งตั้งแต่ ${time(nextEligible)} น. หากตลาดเปิดและเงื่อนไขครบ`;
    } else if (official.stretched) {
      title = 'รอราคากลับเข้ากรอบ'; detail = 'แท่งปิดยืดเกินขอบ Bollinger — ระบบยังไม่เปิดไม้ใหม่';
    } else if (official.dir) {
      key = 'candidate'; title = 'แท่งปิดผ่านเงื่อนไข — รอระบบยืนยัน'; detail = 'เว็บคำนวณผ่านแล้ว แต่ยังไม่มีไม้ใหม่ในบันทึกระบบ จึงยังยืนยันการส่งแจ้งเตือนไม่ได้';
    } else if (official.sellSkipped || official.score < 0) {
      title = 'แนวโน้มลง — ระบบรอ'; detail = 'ระบบ 30 นาทีเปิดเฉพาะฝั่งซื้อ คะแนนฝั่งขายเป็นข้อมูลประกอบ';
    } else if (current && current.dir) {
      title = 'คะแนนสดถึงเกณฑ์ — รอแท่งปิด'; detail = 'คะแนนจากแท่งที่กำลังวิ่งยังเปลี่ยนได้ รอยืนยันจากแท่งที่ปิดแล้ว';
    }
    let news = 'ยังโหลดปฏิทินข่าวไม่สำเร็จ';
    const upcoming = (s.news || []).find((n) => n.time > now);
    if (s.newsAt) news = nearby ? `ช่วงข่าว: ${nearby.title} · ${time(nearby.time)} น.` : upcoming ? `${time(upcoming.time)} น. · ${upcoming.title}` : 'ไม่พบข่าวถัดไปในข้อมูลที่โหลด';
    if (s.newsAt && calendarOld) news += ' · ข้อมูลข่าวอาจล่าช้า';
    return { key, title, detail, active, market, frames, barsOld, priceOld, recordOld, calendarOld, news,
      official: score(official), current: score(current), next: market ? slot + INTRA.SLOT : INTRA.nextOpen(now),
      warning: [market && priceOld ? 'ราคาล่าช้า' : '', market && barsOld ? 'ข้อมูลกราฟยังไม่พร้อม' : '', recordOld ? 'รอโหลดบันทึกล่าสุด' : '', calendarOld ? 'ข่าวยังไม่ยืนยัน' : ''].filter(Boolean).join(' · ') };
  }

  const api = { model, age };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HOME_STATUS = api;
})(typeof window !== 'undefined' ? window : globalThis);
