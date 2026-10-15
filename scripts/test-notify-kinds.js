// Offline check of notify.js message kinds + the LINE quota guard (fake LINE API, nothing is sent).
// node scripts/test-notify-kinds.js
const assert = require('assert');
process.env.SEND = 'true';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test';
delete process.env.OUTBOX; delete process.env.LINE_OWNER_ID; delete process.env.BLOB_READ_WRITE_TOKEN;
let world, calls;
global.fetch = async (url, opts = {}) => {
  const u = String(url), j = (x) => ({ ok: true, status: 200, json: async () => x, text: async () => JSON.stringify(x) });
  if (u.endsWith('/message/quota')) return j({ type: 'limited', value: 300 });
  if (u.endsWith('/quota/consumption')) return j({ totalUsage: world.used });
  if (u.includes('/insight/followers')) return world.friends == null ? j({ status: 'unready' }) : j({ status: 'ready', followers: world.friends, targetedReaches: world.friends });
  if (u.endsWith('/message/broadcast')) { calls.push(JSON.parse(opts.body).messages.map((m) => m.text || m.altText || m.type).join(' | ')); return j({}); }
  return j({});
};
const { send, sendFlex } = require('./notify.js');
const run = async (w, fn) => { world = w; calls = []; await fn(); return calls; };
(async () => {
  // 1 friend, 51 used: everything still goes to LINE
  let c = await run({ used: 51, friends: 1 }, () => send(['SIG'], {}).then(() => send(['NEWS'], { kind: 'extra' })));
  assert.deepStrictEqual(c, ['SIG', 'NEWS']); console.log('1 friend → signal + news on LINE ✓');
  // 10 friends, 200 used: left 100 < 10 + 150 → extras web-push only, signal still LINE
  c = await run({ used: 200, friends: 10 }, () => send(['SIG', { text: 'NEWS', kind: 'extra' }]));
  assert.deepStrictEqual(c, ['SIG']); console.log('10 friends, 200/300 → news skipped on LINE, signal sent ✓');
  c = await run({ used: 200, friends: 10 }, () => sendFlex({ type: 'flex', altText: 'MORNING' }, { kind: 'extra' }));
  assert.deepStrictEqual(c, []); console.log('10 friends → morning flex skipped on LINE ✓');
  c = await run({ used: 10, friends: 10 }, () => sendFlex({ type: 'flex', altText: 'MORNING' }, { kind: 'extra' }));
  assert.deepStrictEqual(c, ['MORNING']); console.log('10 friends, 10/300 → morning flex sent ✓');
  // admin messages never broadcast
  c = await run({ used: 0, friends: 1 }, () => send(['FAIL'], { kind: 'admin' }));
  assert.deepStrictEqual(c, []); console.log('admin → no broadcast ✓');
  // friends unknown → 50% rule
  c = await run({ used: 100, friends: null }, () => send(['NEWS'], { kind: 'extra' }));
  assert.deepStrictEqual(c, ['NEWS']);
  c = await run({ used: 160, friends: null }, () => send(['NEWS'], { kind: 'extra' }));
  assert.deepStrictEqual(c, []); console.log('friends unknown → under 50% send, over 50% skip ✓');
  // LINE_EXTRAS override
  process.env.LINE_EXTRAS = 'off';
  c = await run({ used: 0, friends: 1 }, () => send(['NEWS'], { kind: 'extra' }));
  assert.deepStrictEqual(c, []); console.log('LINE_EXTRAS=off ✓');
  delete process.env.LINE_EXTRAS;
  // OUTBOX keeps kinds, flush-style mixed list
  c = await run({ used: 200, friends: 10 }, () => send([{ text: 'SIG', kind: 'signal' }, { text: 'NEWS', kind: 'extra' }, 'OLD-STRING']));
  assert.deepStrictEqual(c, ['SIG | OLD-STRING']); console.log('mixed queue (old strings = signal) ✓');
  console.log('all notify kind checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
