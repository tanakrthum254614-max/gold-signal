// 🤝 Referral link for the signed-in member (17 Oct 2026, marketing agent). GET → { live, link, code, invited, paid, days }
// The code is made once per member (HMAC of the id) and stored in Blob access/referrals.json { codes: {code: uid},
// byUser: {newUid: {from, at, paidAt?}} }. middleware.js credits a new sign-up that came with the gs_ref cookie;
// api/pay/webhook.mjs gives the referrer REF_DAYS (default 7) when that account first pays. Hidden until marketing is live.
import { member, readJson, writeJson, json, fail, hmac } from '../lib/gs.mjs';

const FILE = 'access/referrals.json';
const SITE = () => (process.env.SITE_URL || 'https://gold-signal-ten.vercel.app').replace(/\/$/, '');
export const REF_DAYS = () => Math.max(1, Math.min(60, +process.env.REF_DAYS || 7));

export async function GET(request) {
  const m = await member(request);
  if (!m) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  const cfg = await readJson('marketing/config.json', {}).catch(() => ({}));
  if (!cfg.live) return json({ ok: true, live: false });
  const all = await readJson(FILE, { codes: {}, byUser: {} });
  all.codes = all.codes || {}; all.byUser = all.byUser || {};
  let code = Object.keys(all.codes).find((k) => all.codes[k] === m.id);
  if (!code) {
    code = (await hmac(process.env.ACCESS_SECRET || 'gs', `ref:${m.id}`)).slice(0, 8);
    all.codes[code] = m.id;
    await writeJson(FILE, all);
  }
  const mine = Object.values(all.byUser).filter((x) => x.from === m.id);
  return json({ ok: true, live: true, code, link: `${SITE()}/login.html?ref=${code}#signup`, invited: mine.length, paid: mine.filter((x) => x.paidAt).length, days: REF_DAYS() });
}
