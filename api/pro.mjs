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
    return json({ ok: true, users: all.users || {}, history: (all.history || []).slice(-200).reverse(), summary: summary(all) });
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

// 💰 Back-office summary (17 Oct 2026): money in (PromptPay payments + card invoices, satang → baht), paying members now,
// and who runs out within 7 days without auto-renewal (the expiry reminder, scripts/pro-expiry.js, writes `reminded`)
function summary(all) {
  const now = Date.now(), th = (t) => new Date(t + 7 * 3600e3).toISOString().slice(0, 7), month = th(now);
  const paid = (all.history || []).filter((h) => h.amount); // payments (+) and refunds (−) → net
  const baht = (list) => Math.round(list.reduce((a, h) => a + h.amount, 0) / 100);
  const users = Object.entries(all.users || {});
  const paying = users.filter(([, u]) => u.until > now && (u.source === 'card' || u.source === 'promptpay'));
  return {
    month: baht(paid.filter((h) => th(h.at) === month)), d30: baht(paid.filter((h) => h.at > now - 30 * 864e5)), total: baht(paid),
    payments: paid.filter((h) => h.amount > 0).length, refunds: paid.filter((h) => h.amount < 0).length,
    paying: paying.length, auto: paying.filter(([, u]) => u.sub).length,
    expiring: users.filter(([, u]) => u.until > now && u.until < now + 7 * 864e5 && !u.sub).map(([uid, u]) => ({ uid, until: u.until, reminded: !!u.reminded })),
  };
}
