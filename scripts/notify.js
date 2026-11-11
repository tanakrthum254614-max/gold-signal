// 11 Nov 2026 (user: "เอาออกที่เชื่อมกับไลน์"): LINE and web push are removed — nothing is sent anywhere any more.
// The recorders (chart-run.js, alerts.js, morning-plan.js, weekly.js) still call send() / sendFlex() where they used to
// announce something; these only write the text to the run log, so the signal records keep being saved as before.
const pack = (texts) => [(texts || []).filter(Boolean).map((x) => (typeof x === 'string' ? x : x.text)).join('\n\n')];
async function send(texts) {
  const items = (texts || []).filter(Boolean);
  items.forEach((x) => console.log(`(log only) ${typeof x === 'string' ? x : x.text}`));
}
async function sendFlex(flex) { console.log(`(log only) ${(flex && flex.altText) || 'flex message'}`); }
async function quotaShare() { return null; }
module.exports = { send, sendFlex, pack, quotaShare };
