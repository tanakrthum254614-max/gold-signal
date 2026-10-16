// 💳 Start a Stripe Checkout for PRO (user, 14 Oct 2026 — "Stripe … Subscription ต่ออายุอัตโนมัติ … PromptPay QR").
// POST { plan: 'month'|'year', method: 'card'|'promptpay' } → { url } of Stripe's hosted page.
// card = subscription that renews itself · promptpay = one payment for 30 / 365 days. Stripe picks the methods shown on
// that one-time page from the Dashboard settings (dynamic payment methods — `payment_method_types` is no longer
// accepted): PromptPay QR appears when the account is Thai and the price is THB, cards always.
// PRO is switched on by api/pay/webhook.mjs when Stripe reports the money — never by this request.
import { member, json, fail, body } from '../../lib/gs.mjs';
import { stripe, prices, PLANS, loadPro } from '../../lib/stripe.mjs';

export async function POST(request) {
  const m = await member(request);
  if (!m) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  let q;
  try { q = await body(request, 2000); } catch (e) { return fail('ข้อมูลไม่ถูกต้อง'); }
  const plan = PLANS[q.plan] ? q.plan : 'month', method = q.method === 'promptpay' ? 'promptpay' : 'card';
  let p;
  try { p = (await prices())[plan]; } catch (e) { p = null; }
  if (!p) return fail('ยังไม่เปิดขายแพ็กเกจนี้', 503);
  const origin = new URL(request.url).origin;
  const all = await loadPro().catch(() => ({ users: {} }));
  const customer = (all.users[m.id] || {}).customer;
  const meta = { uid: m.id, plan, days: PLANS[plan].days, method };
  const common = {
    client_reference_id: m.id, metadata: meta, locale: 'th', integration_identifier: 'gold-signal-pro-qmtkrbzx',
    success_url: `${origin}/?pay=ok#account`, cancel_url: `${origin}/?pay=cancel#account`,
    ...(customer ? { customer } : { customer_email: m.email || undefined }),
  };
  try {
    const s = method === 'card'
      ? await stripe('checkout/sessions', { ...common, mode: 'subscription', line_items: { 0: { price: p.id, quantity: 1 } }, subscription_data: { metadata: meta } })
      : await stripe('checkout/sessions', {
        ...common, mode: 'payment',
        ...(customer ? {} : { customer_creation: 'always' }),
        line_items: { 0: { quantity: 1, price_data: { currency: p.currency, unit_amount: p.amount, product_data: { name: `Gold Signal PRO ${PLANS[plan].days} วัน` } } } },
        payment_intent_data: { metadata: meta },
      });
    return json({ ok: true, url: s.url });
  } catch (e) {
    console.error('checkout', e.message);
    return fail('เปิดหน้าชำระเงินไม่ได้ ลองใหม่อีกครั้ง', 502);
  }
}
