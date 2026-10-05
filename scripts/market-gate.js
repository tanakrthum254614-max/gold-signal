// Gate for the morning job. GitHub cron runs in UTC only, so the workflow is scheduled at both
// 00:05 and 01:05 UTC: the market opens at 07:00 Thai (00:00 UTC) in the US summer and 08:00 Thai
// (01:00 UTC) in the US winter. A scheduled run goes ahead only once the market is open and only if
// today's signal hasn't been made yet; manual runs always go. Writes GO=true|false to $GITHUB_ENV.
const fs = require('fs');
const path = require('path');
const SIG = require('../signals.js');

const now = Date.now();
const store = path.join(__dirname, '..', 'signals.json');
const today = SIG.thaiDate(now);
const open = Date.parse(`${today}T07:00:00+07:00`) + SIG.marketShift(now);
const done = fs.existsSync(store) && JSON.parse(fs.readFileSync(store, 'utf8')).signals.some((s) => s.id === today);

let go = true, why = 'manual run';
if (process.env.EVENT === 'schedule') {
  if (now < open) { go = false; why = `market opens at ${SIG.mt(now, '07:00')} Thai time — the later run will do it`; }
  else if (done) { go = false; why = `today's signal (${today}) is already out`; }
  else why = 'market is open and today has no signal yet';
}
console.log(`${go ? 'GO' : 'SKIP'}: ${why}`);
if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `GO=${go}\n`);
