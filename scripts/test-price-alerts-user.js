// Offline check of scripts/price-alerts-user.js with a fake Blob store and a fake push (nothing is sent).
// node scripts/test-price-alerts-user.js
const assert = require('assert'), fs = require('fs'), path = require('path'), Module = require('module');
const now = Date.now(), m15 = 15 * 60e3;
let store = { alerts: [
  { id: 'a', who: 'u1', price: 4200, dir: 'up', at: now - 3 * m15 },   // high reached 4205 after it was set → fires
  { id: 'b', who: 'u2', price: 4100, dir: 'down', at: now - 3 * m15 }, // low only 4140 → stays
  { id: 'c', who: 'u1', price: 4300, dir: 'up', at: now - 3 * m15 },   // not reached → stays
  { id: 'd', who: 'u3', price: 4150, dir: 'down', at: now - m15 / 3 }, // only the last candle counts: low 4148 → fires
] };
const pushed = [];
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === './blob') return { ready: () => true,
    get: async () => ({ statusCode: 200, stream: new Response(JSON.stringify(store)).body }),
    put: async (p, body) => { store = JSON.parse(body); },
  };
  if (req === './push.js') return { push: async (texts, opts) => { for (const sub of [{ who: 'u1' }, { who: 'u2' }, { who: 'u3' }]) texts.forEach((t, i) => { if (opts.pick(sub, i)) pushed.push([sub.who, t.split('\n')[0]]); }); } };
  return realLoad.call(this, req, ...rest);
};
process.env.SUPABASE_URL = 'test'; process.env.SUPABASE_SERVICE_KEY = 'test';
const data = { m15: [[now - 3 * m15, 4180, 4205, 4170, 4190], [now - 2 * m15, 4190, 4195, 4160, 4165], [now - m15, 4165, 4170, 4140, 4160], [now, 4160, 4162, 4148, 4150]] };
const tmp = path.join(require('os').tmpdir(), 'pa-data.json');
fs.writeFileSync(tmp, JSON.stringify(data));
process.argv[2] = tmp;
require('./price-alerts-user.js');
setTimeout(() => {
  assert.deepStrictEqual(store.alerts.map((a) => a.id).sort(), ['b', 'c'], 'fired alerts removed, others kept');
  assert.deepStrictEqual(pushed.map((x) => x[0]).sort(), ['u1', 'u3'], 'only the owners get their alert');
  assert.ok(pushed.every((x) => /^🔔 ทองถึง/.test(x[1])));
  console.log('price alerts: fired a + d to their owners only, kept b + c ✓');
  console.log(pushed);
}, 500);
