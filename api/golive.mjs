// 🚀 Go live with real money from the back office (user, 14 Oct 2026: "พร้อมเก็บเงินจริง" → "ทำมาให้ก่อน บัญชียังไม่พร้อม").
// Admins only. The owner puts their own Thai Stripe key in Vercel (STRIPE_LIVE_SECRET_KEY, sensitive) — nobody else
// sees it. This endpoint:
// GET  → readiness: live key? Thai account? charges enabled? PromptPay? already configured? paywall on?
// POST { action: 'launch', month, year, giftDays } → (only when ready) creates the PRO product + THB prices + the webhook
//       endpoint in the live account (once; saved in access/stripe-live.json), gives existing members `giftDays` of PRO,
//       then switches the paywall on (access/pro-config.json). Safe to press again: each step is skipped when done.
// POST { action: 'off' } → paywall off again (everyone free), nothing else changes.
import { member, isAdmin, readJson, writeJson, json, fail, body, PRO_CONFIG, clearProCache, proEnabled } from '../lib/gs.mjs';
import { stripe, hasLiveKey, liveConfig, clearLiveCache, LIVE_FILE, loadPro, savePro, giftExisting } from '../lib/stripe.mjs';

const SITE = () => (process.env.SITE_URL || 'https://gold-signal-ten.vercel.app').replace(/\/$/, '');
const EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'invoice.paid', 'customer.subscription.updated', 'customer.subscription.deleted'];

export async function status() {
  const key = (process.env.STRIPE_LIVE_SECRET_KEY || '').trim();
  const s = { liveKey: !!key, keyKind: key ? key.slice(0, key.indexOf('_', 3) + 1) || '?' : '', problems: [], account: null };
  if (!key) s.problems.push('ยังไม่มี STRIPE_LIVE_SECRET_KEY ใน Vercel');
  else if (!/^(sk|rk)_live_/.test(key)) s.problems.push('key ที่ใส่ไว้ไม่ใช่ key โหมดจริง (ต้องขึ้นต้น sk_live_ หรือ rk_live_)');
  if (key) {
    try {
      const a = await stripe('account');
      s.account = { country: a.country, currency: a.default_currency, name: (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) || (a.business_profile && a.business_profile.name) || '',
        charges: !!a.charges_enabled, payouts: !!a.payouts_enabled, details: !!a.details_submitted, promptpay: (a.capabilities || {}).promptpay_payments || 'ไม่มี' };
      if (a.country !== 'TH') s.problems.push(`บัญชีเป็นประเทศ ${a.country} — PromptPay ต้องเป็นบัญชีไทย (TH)`);
      if (!a.charges_enabled) s.problems.push('Stripe ยังไม่เปิดให้รับเงิน (รอยืนยันธุรกิจ)');
      if (!a.payouts_enabled) s.problems.push('ยังโอนเงินออกไม่ได้ (เพิ่มบัญชีธนาคารใน Stripe) — รับเงินได้แต่จะค้างใน Stripe');
    } catch (e) { s.problems.push(`ตรวจบัญชีไม่ได้: ${e.message}${e.status === 403 ? ' (restricted key ต้องมีสิทธิ์ Accounts: Read)' : ''}`); }
  }
  const cfg = hasLiveKey() ? await liveConfig(true) : null;
  s.configured = cfg ? { priceMonth: cfg.priceMonth, priceYear: cfg.priceYear, amounts: cfg.amounts, webhook: cfg.webhookId, at: cfg.at } : null;
  s.enabled = await proEnabled();
  // payouts are a warning, not a blocker
  s.ready = s.liveKey && /^(sk|rk)_live_/.test(key) && !!s.account && s.account.country === 'TH' && s.account.charges;
  return s;
}

export async function GET(request) {
  const m = await member(request);
  if (!m || !isAdmin(m)) return fail('เฉพาะแอดมิน', 403);
  return json({ ok: true, ...(await status()) });
}

export async function POST(request) {
  const m = await member(request);
  if (!m || !isAdmin(m)) return fail('เฉพาะแอดมิน', 403);
  let q;
  try { q = await body(request, 2000); } catch (e) { return fail('ข้อมูลไม่ถูกต้อง'); }
  const by = m.email;
  if (q.action === 'off') {
    await writeJson(PRO_CONFIG, { enabled: false, at: Date.now(), by });
    clearProCache();
    return json({ ok: true, enabled: false });
  }
  if (q.action !== 'launch') return fail('action');
  const month = Math.round(+q.month), year = Math.round(+q.year), giftDays = Math.round(+(q.giftDays ?? 30));
  if (!(month >= 20 && year >= 20) || !(giftDays >= 0 && giftDays <= 365)) return fail('ราคา/จำนวนวันไม่ถูกต้อง');
  const s = await status();
  if (!s.ready) return json({ ok: false, error: 'ยังเปิดไม่ได้', problems: s.problems }, 409);
  const steps = [];

  // 1) product + prices + webhook in the live account (once)
  let cfg = await liveConfig(true);
  if (!cfg || !cfg.priceMonth || !cfg.priceYear || !cfg.webhookSecret) {
    cfg = { ...(cfg || {}) };
    if (!cfg.product) cfg.product = (await stripe('products', { name: 'Gold Signal PRO', description: 'โค้ช AI ส่วนตัว + แดชบอร์ดทองคำและหุ้น' })).id;
    const price = (amount, interval) => stripe('prices', { product: cfg.product, currency: 'thb', unit_amount: amount * 100, recurring: { interval }, nickname: interval === 'month' ? 'รายเดือน' : 'รายปี' });
    if (!cfg.priceMonth) cfg.priceMonth = (await price(month, 'month')).id;
    if (!cfg.priceYear) cfg.priceYear = (await price(year, 'year')).id;
    cfg.amounts = { month, year };
    await writeJson(LIVE_FILE, { ...cfg, at: Date.now(), by }); // save progress before the webhook
    if (!cfg.webhookSecret) {
      const hook = await stripe('webhook_endpoints', { url: `${SITE()}/api/pay/webhook`, enabled_events: Object.fromEntries(EVENTS.map((e, i) => [i, e])), description: 'Gold Signal PRO', api_version: '2026-09-30.endive' });
      cfg.webhookId = hook.id; cfg.webhookSecret = hook.secret;
    }
    await writeJson(LIVE_FILE, { ...cfg, at: Date.now(), by });
    clearLiveCache();
    steps.push(`สร้างราคา ${month} / ${year} บาท และ webhook แล้ว`);
  } else steps.push('ราคาและ webhook มีอยู่แล้ว (ข้าม)');

  // 2) launch gift for existing members (each member once)
  if (giftDays > 0) {
    const all = await loadPro();
    const g = await giftExisting(all, giftDays, (email) => isAdmin({ email }));
    await savePro(all);
    steps.push(`ให้ PRO ฟรี ${giftDays} วัน ${g.given} คน (ข้าม ${g.skipped})`);
  }

  // 3) paywall on
  await writeJson(PRO_CONFIG, { enabled: true, at: Date.now(), by });
  clearProCache();
  steps.push('เปิดระบบเก็บเงินแล้ว');
  return json({ ok: true, steps });
}
