const assert = require('node:assert/strict');
const { test } = require('node:test');
const INTRA = require('../intraday.js');
const STATUS = require('../status.js');
const now = Date.parse('2026-10-06T10:10:00Z');
const candidate = { score: 6, dir: 1, open: true };
const fresh = () => ({
  intra: { trades: [] }, signalsAt: now, newsAt: now, news: [], tickAt: now, tickSrc: 'stream',
  intraMeta: { at: now, source: 'investing', times: Object.fromEntries(INTRA.FRAMES.map(([k, dur]) => [k, [Math.floor(now / dur) * dur - dur, Math.floor(now / dur) * dur]])) },
});
const view = (s, d = candidate, live = candidate, at = now) => STATUS.model(s, at, d, live);

test('passing browser score waits for a recorded trade and never claims delivery', () => {
  assert.equal(view(fresh()).key, 'candidate');
  assert.match(view(fresh()).detail, /ยังยืนยันการส่งแจ้งเตือนไม่ได้/);
});
test('live score cannot confirm a closed-candle signal', () => {
  const m = view(fresh(), { score: 4, dir: 0 });
  assert.match(m.title, /รอแท่งปิด/);
  assert.equal(m.official, '+4 / 6');
  assert.equal(m.current, '+6 / 6');
});
test('missing and stale dependencies prevent ready status', () => {
  for (const field of ['signalsAt', 'newsAt', 'tickAt', 'intraMeta']) {
    const s = fresh(); delete s[field];
    assert.equal(view(s).key, 'data', field);
  }
  for (const field of ['signalsError', 'newsError', 'intraError']) {
    const s = fresh(); s[field] = true;
    assert.equal(view(s).key, 'data', field);
  }
});
test('newly downloaded stale price candle is still marked stale', () => {
  const s = fresh(); s.tickSrc = 'investing'; s.priceBarAt = now - 10 * 60e3;
  assert.equal(view(s).priceOld, true);
  assert.equal(view(s).key, 'data');
});
test('fresh fast candles cannot hide stale higher timeframe', () => {
  const s = fresh(); s.intraMeta.times.h5 = [now - 20 * 3600e3];
  assert.equal(view(s).barsOld, true);
  assert.equal(view(s).key, 'data');
});
test('unknown calendar differs from a successfully loaded empty calendar', () => {
  const s = fresh(); delete s.newsAt;
  assert.match(view(s).news, /ไม่สำเร็จ/);
  assert.match(view(fresh()).news, /ไม่พบข่าวถัดไปในข้อมูลที่โหลด/);
});
test('recorded active trade remains visible with stale price and overdue expiry', () => {
  const s = fresh(); s.tickAt = now - 60e3;
  s.intra.trades = [{ status: 'active', side: 'BUY', entry: 4000, createdAt: now - 3600e3, expiresAt: now - 1 }];
  const m = view(s);
  assert.equal(m.key, 'active');
  assert.match(m.detail, /รอระบบอัปเดตผล/);
  assert.match(m.warning, /ราคาล่าช้า/);
});
test('pause takes precedence over candidate', () => {
  const s = fresh(); s.intra.pause = { until: now + 864e5, reason: 'แพ้ติดกัน 5 ไม้' };
  assert.equal(view(s).key, 'paused');
});
test('cooldown waits for the first half hour at least 15 minutes after exit', () => {
  const s = fresh(); s.intra.trades = [{ status: 'win', createdAt: now - 3600e3, exitAt: now - 5 * 60e3 }];
  assert.match(view(s).title, /รอรอบใหม่/);
  assert.match(view(s).detail, /17:30/);
});
test('news, no-chase and sell-only conditions explain why the user waits', () => {
  assert.match(view(fresh(), { ...candidate, dir: 0, news: { title: 'CPI' } }).title, /ข่าวแรง/);
  assert.match(view(fresh(), { ...candidate, dir: 0, stretched: true }).title, /กลับเข้ากรอบ/);
  assert.match(view(fresh(), { score: -6, dir: 0, sellSkipped: true }).title, /แนวโน้มลง/);
});
test('weekend status is closed even without loaded prices', () => {
  assert.equal(view({}, null, null, Date.parse('2026-10-10T10:00:00Z')).key, 'closed');
});
test('age is honest about missing and invalid timestamps', () => {
  assert.equal(STATUS.age(null, now), 'ยังไม่มีข้อมูล');
  assert.equal(STATUS.age(now + 864e5, now), 'ยังไม่มีข้อมูล');
  assert.equal(STATUS.age(now - 61000, now), '1 นาที');
});
