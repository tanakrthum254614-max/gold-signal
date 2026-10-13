// Watchdog for the signal recorder (user, 13 Oct: "แจ้งเตือนแอดมินเมื่อระบบบันทึกสัญญาณหยุด"). Runs every 15 minutes with
// the new-member alerts. While the market is open it looks at the price-alerts workflow (scripts/check-loop.sh, a check
// every 5 minutes) and tells the ADMINS ONLY — web push to devices marked admin, and LINE to the owner when
// LINE_OWNER_ID is set (never a broadcast) — when:
//   • stopped: no run in progress and the last one ended over 30 minutes ago
//   • stuck:   a run has been in progress for over 50 minutes (each run lasts ~28)
//   • failing: the last 3 finished runs failed (check-loop fails a run when every check failed, or 3 saves in a row)
// One message per problem (state in the private Blob store, access/watchdog.json) and one when it is working again.
// Usage: node scripts/watchdog.js   Env: GH_TOKEN, GITHUB_REPOSITORY, BLOB_READ_WRITE_TOKEN, VAPID_*, SEND=true,
//        LINE_CHANNEL_ACCESS_TOKEN + LINE_OWNER_ID (optional), WATCHDOG_NOW (tests)
const INTRA = require('../intraday.js');
const { push } = require('./push.js');
const STATE = 'access/watchdog.json';
const REPO = process.env.GITHUB_REPOSITORY || 'tanakrthum254614-max/gold-signal';
const M = 60e3;

async function runs() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/price-alerts.yml/runs?per_page=6`, {
    headers: { accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return (await r.json()).workflow_runs || [];
}
// What is wrong right now: null when fine, else { kind, text }
function diagnose(list, now) {
  const active = list.filter((x) => x.status === 'in_progress' || x.status === 'queued' || x.status === 'waiting');
  const running = active.find((x) => x.status === 'in_progress');
  if (running && now - Date.parse(running.run_started_at || running.created_at) > 50 * M) {
    return { kind: 'stuck', text: `รอบเช็กสัญญาณค้างมา ${Math.round((now - Date.parse(running.run_started_at)) / M)} นาที (ปกติ ~28 นาที)`, url: running.html_url };
  }
  const done = list.filter((x) => x.status === 'completed');
  if (!active.length) {
    const last = done[0], end = last ? Date.parse(last.updated_at) : 0;
    if (now - end > 30 * M) return { kind: 'stopped', text: `ไม่มีการเช็กสัญญาณมา ${last ? Math.round((now - end) / M) : '?'} นาที ทั้งที่ตลาดเปิดอยู่`, url: last && last.html_url };
  }
  const fin = done.filter((x) => x.conclusion !== 'cancelled').slice(0, 3);
  if (fin.length === 3 && fin.every((x) => x.conclusion === 'failure')) {
    return { kind: 'failing', text: 'รอบเช็กสัญญาณล้มเหลว 3 รอบติดกัน (ดึงราคาไม่ได้ หรือบันทึกข้อมูลไม่ได้)', url: fin[0].html_url };
  }
  return null;
}

async function readState() {
  const { get } = require('@vercel/blob');
  const r = await get(STATE, { access: 'private', useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200) return { problem: null };
  return JSON.parse(await new Response(r.stream).text());
}
async function writeState(s) {
  const { put } = require('@vercel/blob');
  await put(STATE, JSON.stringify(s), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}
async function line(text) {
  const token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim(), to = (process.env.LINE_OWNER_ID || '').trim();
  if (!token || !to) return console.log('LINE: LINE_OWNER_ID not set — push notification only');
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
  console.log(r.ok ? '✓ LINE sent to the owner' : `⚠️ LINE ${r.status}`);
}
const thai = (ms) => new Date(ms).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

async function main() {
  const now = +(process.env.WATCHDOG_NOW || Date.now());
  // market hours only, and not in the first 25 minutes after the open (the first run of the day is still starting)
  if (!INTRA.marketOpen(now) || !INTRA.marketOpen(now - 25 * M)) return console.log('watchdog: market closed (or just opened) — nothing to check');
  const problem = diagnose(await runs(), now);
  console.log('watchdog:', problem ? `${problem.kind} — ${problem.text}` : 'recorder OK');
  if (!process.env.BLOB_READ_WRITE_TOKEN) return console.log('watchdog: BLOB_READ_WRITE_TOKEN missing — no alerts');
  const st = await readState();
  const was = st.problem && st.problem.kind;
  let text = null;
  if (problem && problem.kind !== was) text = `⚠️ Gold Signal: ระบบบันทึกสัญญาณมีปัญหา\n${problem.text}\nเวลา ${thai(now)}${problem.url ? `\nดู: ${problem.url}` : ''}\n(ข้อความนี้ส่งถึงแอดมินเท่านั้น)`;
  if (!problem && was) text = `✅ Gold Signal: ระบบบันทึกสัญญาณกลับมาทำงานแล้ว\n(มีปัญหาตั้งแต่ ${thai(st.problem.at)} — ${st.problem.text})`;
  if (!text) return console.log('watchdog: nothing new to tell');
  console.log(`---\n${text}`);
  if (process.env.SEND !== 'true') return console.log('watchdog: SEND is not true — not sent');
  await push([text], { adminsOnly: true });
  await line(text).catch((e) => console.log(`⚠️ LINE failed: ${e.message}`));
  await writeState({ problem: problem ? { ...problem, at: was ? st.problem.at : now } : null, updatedAt: now });
}
if (require.main === module) main().catch((e) => { console.log(`⚠️ watchdog failed: ${e.message}`); });
module.exports = { diagnose };
