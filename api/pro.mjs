// ⭐ PRO status. GET → { enabled, features, pro, until, plan, sub, prices } for the account page.
// Admins: GET ?list=1 → every PRO member · POST { uid, days } → grant / extend by hand (e.g. a bank transfer) ·
// POST { uid, revoke: true } → end now. Payments themselves go through api/pay/webhook.mjs.
import { member, isAdmin, proOf, proEnabled, proFeatures, json, fail, body } from '../lib/gs.mjs';
import { prices, loadPro, savePro, extend } from '../lib/stripe.mjs';

export async function GET(request) {
  const m = await member(request);
  if (!m) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  if (new URL(request.url).searchParams.get('list') === '1') {
    if (!isAdmin(m)) return fail('เฉพาะแอดมิน', 403);
    const all = await loadPro().catch(() => ({ users: {}, history: [] }));
    return json({ ok: true, users: all.users || {}, history: (all.history || []).slice(-200).reverse() });
  }
  let p = {};
  try { p = await prices(); } catch (e) { /* Stripe not set up yet */ }
  return json({ ok: true, enabled: await proEnabled(), features: proFeatures(), ...(await proOf(m)), prices: p });
}

export async function POST(request) {
  const m = await member(request);
  if (!m) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  if (!isAdmin(m)) return fail('เฉพาะแอดมิน', 403);
  let q;
  try { q = await body(request, 2000); } catch (e) { return fail('ข้อมูลไม่ถูกต้อง'); }
  if (!/^user_[A-Za-z0-9]+$/.test(q.uid || '')) return fail('รหัสสมาชิกไม่ถูกต้อง');
  const all = await loadPro();
  all.users = all.users || {}; all.history = all.history || [];
  if (q.revoke) {
    if (all.users[q.uid]) all.users[q.uid].until = Date.now();
    all.history.push({ at: Date.now(), uid: q.uid, type: 'revoke', by: m.email });
  } else {
    const days = Math.round(+q.days);
    if (!(days >= 1 && days <= 3650)) return fail('จำนวนวัน 1–3650');
    extend(all, q.uid, days, { source: (all.users[q.uid] || {}).source || 'admin' });
    all.history.push({ at: Date.now(), uid: q.uid, type: 'grant', days, by: m.email });
  }
  await savePro(all);
  return json({ ok: true, user: all.users[q.uid] });
}
