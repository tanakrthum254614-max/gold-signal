// One-time Stripe setup for PRO, run when the prices are decided:
//   STRIPE_SECRET_KEY=sk_... node scripts/stripe-setup.mjs --month 199 --year 1990 [--url https://gold-signal.gold-signal.workers.dev]
// Creates the "Gold Signal PRO" product with two recurring THB prices (PromptPay charges the same amounts once) and the
// webhook endpoint for api/pay/webhook.mjs. Prints the price ids; the webhook signing secret is written to
// .vercel/stripe-webhook-secret.txt (git-ignored), never printed. Then:
//   npx vercel env add STRIPE_PRICE_MONTH production   (paste the id)  · same for STRIPE_PRICE_YEAR
//   npx vercel env add STRIPE_WEBHOOK_SECRET production < .vercel/stripe-webhook-secret.txt
//   npx vercel env add PRO_ENABLED production  (1)  → redeploy
// Run once per Stripe mode (test keys first, live keys when going live). Re-running creates new prices/endpoints.
import { writeFileSync, mkdirSync } from 'node:fs';
import { stripe } from '../lib/stripe.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const month = +arg('month'), year = +arg('year'), url = arg('url', 'https://gold-signal.gold-signal.workers.dev'), tag = arg('label', '');
if (!(month > 0 && year > 0)) { console.error('usage: --month <baht> --year <baht> [--url <site>]'); process.exit(1); }
const k = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
if (!k) { console.error('set STRIPE_LIVE_SECRET_KEY or STRIPE_SECRET_KEY'); process.exit(1); }
console.log(/_live_/.test(k) ? '⚠️ LIVE mode' : 'test mode');

const product = await stripe('products', { name: `Gold Signal PRO${tag ? ` (${tag})` : ''}`, description: 'โค้ช AI ส่วนตัว + แดชบอร์ดทองคำและหุ้น' });
const price = (amount, interval) => stripe('prices', { product: product.id, currency: 'thb', unit_amount: Math.round(amount * 100), recurring: { interval }, nickname: interval === 'month' ? 'รายเดือน' : 'รายปี' });
const pm = await price(month, 'month'), py = await price(year, 'year');
const events = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'invoice.paid', 'customer.subscription.updated', 'customer.subscription.deleted'];
const hook = await stripe('webhook_endpoints', { url: `${url.replace(/\/$/, '')}/api/pay/webhook`, enabled_events: Object.fromEntries(events.map((e, i) => [i, e])), description: 'Gold Signal PRO', api_version: '2026-09-30.endive' }); // same version as lib/stripe.mjs
mkdirSync('.vercel', { recursive: true });
writeFileSync('.vercel/stripe-webhook-secret.txt', hook.secret, { mode: 0o600 });
console.log(`STRIPE_PRICE_MONTH=${pm.id}\nSTRIPE_PRICE_YEAR=${py.id}\nwebhook ${hook.id} → ${hook.url}\nsigning secret saved to .vercel/stripe-webhook-secret.txt`);
