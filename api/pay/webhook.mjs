// 💳 Stripe webhook — the only place PRO is granted from a payment ("Stripe Webhook คอยปลดล็อกสิทธิ์ PRO ให้ผู้ใช้แบบ
// Real-time ทันทีที่เงินเข้า"). Public (middleware.js lets /api/pay/webhook through without a cookie); every call must
// carry a valid Stripe-Signature for STRIPE_WEBHOOK_SECRET or it is refused. Each event id is handled once.
// checkout.session.completed / async_payment_succeeded → PromptPay: +30 / +365 days · card: until the subscription's
// period end · invoice.paid → renewal · customer.subscription.updated / deleted → follow the subscription.
import { json, fail } from '../../lib/gs.mjs';
import { stripe, verify, loadPro, savePro, extend, periodEnd } from '../../lib/stripe.mjs';

function fromSub(all, sub, why) {
  const uid = (sub.metadata || {}).uid || Object.keys(all.users).find((k) => all.users[k].sub === sub.id);
  if (!uid) return null;
  const u = all.users[uid] || {};
  const live = ['active', 'trialing', 'past_due'].includes(sub.status);
  const end = periodEnd(sub);
  all.users[uid] = { ...u, source: 'card', plan: (sub.metadata || {}).plan || u.plan, customer: sub.customer, sub: live ? sub.id : null,
    until: live ? Math.max(end, u.until || 0) : Math.min(u.until || 0, Date.now()) };
  all.history.push({ at: Date.now(), uid, type: why, sub: sub.id, status: sub.status });
  return uid;
}

export async function handle(event, all) {
  const o = event.data.object;
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const uid = o.client_reference_id || (o.metadata || {}).uid;
    if (!uid) return 'no uid';
    if (o.mode === 'subscription') {
      const sub = await stripe(`subscriptions/${o.subscription}`);
      sub.metadata = { ...(o.metadata || {}), ...(sub.metadata || {}) };
      fromSub(all, sub, 'subscribe');
      return 'subscription';
    }
    if (o.payment_status !== 'paid') return 'unpaid'; // PromptPay can confirm later: async_payment_succeeded
    const days = Math.min(400, +(o.metadata || {}).days || 30);
    extend(all, uid, days, { source: 'promptpay', plan: (o.metadata || {}).plan, customer: o.customer || (all.users[uid] || {}).customer });
    all.history.push({ at: Date.now(), uid, type: 'promptpay', days, amount: o.amount_total, currency: o.currency, session: o.id });
    return 'paid';
  }
  if (event.type === 'invoice.paid') {
    const subId = o.subscription || (o.parent && o.parent.subscription_details && o.parent.subscription_details.subscription);
    if (!subId) return 'no sub';
    fromSub(all, await stripe(`subscriptions/${subId}`), 'renew');
    return 'renew';
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    fromSub(all, o, event.type === 'customer.subscription.deleted' ? 'cancel' : 'update');
    return 'sub';
  }
  return 'ignored';
}

export async function POST(request) {
  const raw = await request.text();
  if (!(await verify(raw, request.headers.get('stripe-signature')))) return fail('bad signature', 400);
  let event;
  try { event = JSON.parse(raw); } catch (e) { return fail('bad json', 400); }
  let all;
  try { all = await loadPro(); } catch (e) { return fail('store', 503); } // Stripe retries
  all.users = all.users || {}; all.events = all.events || []; all.history = all.history || [];
  if (all.events.includes(event.id)) return json({ ok: true, dup: true });
  let what;
  try { what = await handle(event, all); } catch (e) { console.error('webhook', event.type, e.message); return fail('stripe', 502); }
  all.events.push(event.id);
  await savePro(all);
  return json({ ok: true, what });
}
