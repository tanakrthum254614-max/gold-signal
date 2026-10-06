const { test } = require('node:test');
const assert = require('node:assert/strict');
const { model } = require('../chartentry.js');
const now = Date.parse('2026-10-06T12:02:00Z'), duration = 5 * 60e3;
const good = { dir: 1, score: 5, open: true };
const base = { now, duration, closed: good, live: good, marketOpen: true, fresh: true };
test('hours-old active replay cannot become a new entry from a strong live score', () => {
  const m = model({ ...base, open: { createdAt: now - 2 * 3600e3 } });
  assert.equal(m.key, 'hold'); assert.equal(m.recent, false);
});
test('new replay entry expires as a new signal at the next timeframe boundary', () => {
  const open = { createdAt: Date.parse('2026-10-06T12:00:00Z') };
  assert.equal(model({ ...base, open }).key, 'go');
  assert.equal(model({ ...base, open, now: open.createdAt + duration }).key, 'hold');
});
test('forming candle never confirms an entry', () => {
  assert.equal(model({ ...base, closed: { score: 4, dir: 0 } }).key, 'near');
  assert.match(model({ ...base, closed: { score: 4, dir: 0 } }).title, /รอแท่งปิด/);
  assert.notEqual(model(base).key, 'go');
});
test('data, calendar, pause and market restrictions take priority over a recent replay', () => {
  const open = { createdAt: now - 2 * 60e3 };
  for (const change of [{ fresh: false }, { marketOpen: false }, { paused: true }, { closed: null },
    { closed: { ...good, stale: true } }, { closed: { ...good, news: {} } }, { closed: { ...good, lastHour: true } }]) {
    assert.equal(model({ ...base, open, ...change }).key, 'wait');
  }
});
test('no fabricated entry during cooldown or when no trade exists', () => {
  assert.equal(model({ ...base, cooldown: now + duration }).key, 'wait');
  assert.equal(model(base).latest, null);
  assert.equal(model({ ...base, open: { createdAt: now + duration } }).recent, false);
});
