// 💳 Stripe customer portal for card subscribers: change card, see receipts, cancel. POST → { url }
import { member, json, fail } from '../../lib/gs.mjs';
import { stripe, loadPro } from '../../lib/stripe.mjs';

export async function POST(request) {
  const m = await member(request);
  if (!m) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  const u = (await loadPro().catch(() => ({ users: {} }))).users[m.id];
  if (!u || !u.customer) return fail('ยังไม่มีประวัติการชำระเงิน', 404);
  try {
    const s = await stripe('billing_portal/sessions', { customer: u.customer, return_url: `${new URL(request.url).origin}/#account`, locale: 'th' });
    return json({ ok: true, url: s.url });
  } catch (e) { console.error('portal', e.message); return fail('เปิดหน้าจัดการไม่ได้ ลองใหม่อีกครั้ง', 502); }
}
