// Presentation only: distinguish a replayed entry from a new closed-candle signal.
(function (root) {
  function model({ now, duration, open, latest, closed, live, marketOpen, fresh, paused, cooldown = 0 }) {
    const slot = Math.floor(now / duration) * duration;
    const recent = !!open && open.createdAt >= slot && open.createdAt <= now;
    const base = { recent, next: slot + duration, latest: latest || open || null };
    const result = (key, title, detail) => ({ ...base, key, title, detail });
    if (!marketOpen) return result('wait', 'ตลาดปิด · ยังไม่มีจุดเข้าใหม่', 'รอรอบตลาดเปิดก่อนประเมินสัญญาณ');
    if (!fresh || !closed || closed.stale) return result('wait', 'ข้อมูลยังไม่พร้อม · รอยืนยันจุดเข้า', 'กำลังตรวจราคาล่าสุด กราฟ และปฏิทินข่าว');
    if (paused) return result('wait', 'ระบบ 30 นาทีพักอยู่', 'รอให้ครบช่วงพักก่อนประเมินการเปิดไม้ใหม่');
    if (closed.news || live?.news) return result('wait', 'ช่วงข่าวแรง · งดเข้าใหม่', 'จุดที่เห็นบนกราฟเป็นข้อมูลเดิม รอพ้นช่วงข่าวก่อน');
    if (closed.lastHour) return result('wait', 'ใกล้ปิดตลาด · งดเข้าใหม่', 'ระบบไม่เปิดไม้เพิ่มในชั่วโมงสุดท้าย');
    if (recent) return result('go', 'มีจุดซื้อรอบล่าสุด · แบบจำลอง', 'ดูเวลาและราคาที่เกิดสัญญาณด้านล่าง ราคาปัจจุบันอาจเปลี่ยนไปแล้ว');
    if (open) return result('hold', 'รอจุดเข้าใหม่ · จุดเดิมผ่านไปแล้ว', 'แบบจำลองยังติดตามไม้เดิม จึงยังไม่สร้างจุดซื้อซ้ำ');
    if (cooldown > now) return result('wait', 'พักหลังจบไม้ · รอรอบถัดไป', 'แบบจำลองยังอยู่ในช่วงพักหลังปิดไม้');
    if (closed.stretched) return result('near', 'ราคายืดเกินไป · รอจังหวะใหม่', 'คะแนนผ่าน แต่ราคายังอยู่นอกกรอบ Bollinger');
    if (closed.dir > 0) return result('near', 'คะแนนแท่งปิดผ่าน · ยังไม่มีจุดใหม่ในแบบจำลอง', 'รอผลประเมินรอบถัดไป ไม่ใช้ราคาไม้เก่าเป็นจุดเข้าใหม่');
    if (live?.dir > 0) return result('near', 'รอแท่งปิด · ยังไม่ยืนยันจุดซื้อ', 'คะแนนแท่งที่กำลังวิ่งผ่านแล้ว แต่ยังเปลี่ยนได้');
    return result('wait', 'ยังไม่มีจุดเข้าใหม่', `คะแนนแท่งปิด ${closed.score > 0 ? '+' : ''}${closed.score} / 6 · ต้องถึง +5 และผ่านเงื่อนไขก่อน`);
  }
  const api = { model };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CHART_ENTRY = api;
})(typeof window !== 'undefined' ? window : globalThis);
