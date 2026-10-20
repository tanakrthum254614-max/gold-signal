// 📣 Marketing agent (user, 17 Oct 2026: "อยากให้สร้าง AI agent ที่สามารถเอาคอร์สเราไปโฆษณาให้เราแทน หาเงินให้เราแทน"
// → channels LINE OA + Facebook Page + SEO articles + referrals · drafts approved in the back office · small AI budget ·
// "สร้างไว้ก่อน ค่อยโพสต์หลังจากเราซื้อโดเมน .com แล้ว"). Admins only.
// Each draft = one LINE text, one Facebook post and one SEO article, written from REAL numbers only (live record of the
// tested timeframes incl. losses, test win %, gold price) by the AI Gateway model, or by a plain template when the AI is
// unavailable. A compliance check blocks promises of profit; the risk line is always appended.
// Nothing leaves the site until the switch is on (Blob marketing/config.json { live }, button "🚀 เปิดใช้การตลาด") — meant
// for after the .com domain (SITE_URL) is set, so every link points at the final address.
// GET → { config, drafts, fb, site } · POST { action: generate | save | approve | discard | live, … }
//   approve channel 'line' → marketing/queue.json (sent by scripts/market-send.js in the 5-minute check, LINE quota-guarded)
//   approve channel 'facebook' → Graph API /{FB_PAGE_ID}/feed with FB_PAGE_TOKEN · channel 'seo' → content/blog.json (public /blog)
// Daily drafts: vercel.json cron → GET ?cron=1 with Authorization: Bearer CRON_SECRET (only while live).
import { member, isAdmin, readJson, writeJson, json, fail, body, clip, workersAI, WORKERS_AI_MODEL } from '../lib/gs.mjs';
import { blogGET } from '../lib/blog.mjs'; // public /blog pages ride on this function (12-function Hobby limit)

const CONFIG = 'marketing/config.json', DRAFTS = 'marketing/drafts.json', QUEUE = 'marketing/queue.json', BLOG = 'content/blog.json';
const RAW = 'https://raw.githubusercontent.com/tanakrthum254614-max/gold-signal';
const SITE = () => (process.env.SITE_URL || 'https://gold-signal.gold-signal.workers.dev').replace(/\/$/, '');
const MODEL = () => process.env.AI_MARKET_MODEL || process.env.AI_COACH_MODEL || 'google/gemini-2.5-flash';
const RISK = '⚠️ ผลในอดีตไม่รับประกันผลในอนาคต · การซื้อขายทองมีความเสี่ยงสูง อาจขาดทุนได้ · ไม่ใช่คำแนะนำการลงทุน';
const TFL = { '1h': '1 ชม.', '5h': '5 ชม.', '1d': '1 วัน' };
// words an ad for a trading service must not use (profit promises / pressure) — a draft with any of them can't be approved
export const BANNED = /การันตี|รับประกันกำไร|กำไรแน่|รวยแน่|รวยเร็ว|ไม่มีขาดทุน|ไม่ขาดทุน|ชนะ\s*100|100\s*%\s*(ชนะ|แม่น)|แม่นยำ\s*100|ถอนได้จริง|ปันผล|รายได้\s*passive|ลงทุนน้อย\s*กำไรมาก|เงินล้าน|รีบ.{0,8}ก่อนหมด/i;

const thDay = (t) => new Date(t).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
const money = (v) => `${v >= 0 ? '+' : '−'}$${Math.abs(Math.round(v * 100) / 100).toLocaleString('en-US')}`;
const slugOf = (t) => new Date(t + 7 * 3600e3).toISOString().slice(0, 10);

// Real numbers only: the recorder's trades (branch data, public repo), the monthly test stats, today's gold price
export async function facts() {
  const get = (u) => fetch(u, { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [cs, ts, spot] = await Promise.all([get(`${RAW}/data/chart-signals.json?t=${Date.now()}`), get(`${RAW}/main/test-stats.json?t=${Date.now()}`), get('https://api.gold-api.com/price/XAU')]);
  const trades = ((cs && cs.trades) || []).filter((t) => TFL[t.tf] && !t.risky && (t.status === 'win' || t.status === 'loss'));
  const per = Object.keys(TFL).map((tf) => {
    const d = trades.filter((t) => t.tf === tf && t.side !== 'SELL'), w = d.filter((t) => t.pnl > 0).length;
    const st = ts && ts.tf && ts.tf[tf] && ts.tf[tf].BUY;
    return { tf, name: TFL[tf], tested: st ? st.win : null, testN: st ? st.n : null, live: d.length, wins: w, pnl: Math.round(d.reduce((a, t) => a + (t.pnl || 0), 0) * 100) / 100 };
  });
  const last = trades.sort((a, b) => (b.exitAt || 0) - (a.exitAt || 0)).slice(0, 3).map((t) => ({ tf: TFL[t.tf], side: t.side, entry: t.entry, exit: t.exitPrice, pnl: t.pnl, at: t.exitAt }));
  return { at: Date.now(), day: thDay(Date.now()), price: spot && spot.price ? Math.round(spot.price * 100) / 100 : null, per, last, since: cs && cs.startedAt ? thDay(cs.startedAt) : '',
    site: SITE(), plans: 'รายเดือน 149 บาท · รายปี 1,290 บาท' };
}

// Plain template — always works (no AI)
function template(f) {
  const rows = f.per.map((p) => `• Buy ${p.name}: ทดสอบย้อนหลังชนะ ${p.tested ?? '—'}%${p.live ? ` · ผลจริง ${p.live} รายการ ชนะ ${p.wins} (${money(p.pnl)})` : ' · ผลจริง: ยังไม่มีรายการที่ปิด'}`).join('\n');
  const px = f.price ? `ทองคำ XAU/USD ตอนนี้ ~$${f.price.toLocaleString('en-US')} ต่อออนซ์\n` : '';
  const line = `📊 Gold Signal · ${f.day}\n${px}\nผลของระบบ (ตัวเลขจริง ทั้งรายการชนะและแพ้):\n${rows}\n\nดูจุดเข้า SL TP ทุกกรอบเวลา + แจ้งเตือน LINE\n${f.plans}\nทดลองดูกราฟฟรี: ${f.site}/demo.html`;
  const facebook = `${line}\nสมัคร: ${f.site}/login.html#signup\n\n#ทองคำ #XAUUSD #ซื้อขายทอง #GoldSignal`;
  const title = `สรุปทองคำและผลระบบ Gold Signal · ${f.day}`;
  const seo = { title, description: `ผลจริงของระบบสัญญาณทองคำ Gold Signal ณ ${f.day} — ทั้งรายการชนะและรายการแพ้ พร้อมผลทดสอบย้อนหลัง`,
    body: `## ราคาทองวันนี้\n${f.price ? `ทองคำ (XAU/USD) อยู่ที่ราว $${f.price.toLocaleString('en-US')} ต่อออนซ์` : 'ดูราคาสดได้ในเว็บ'}\n\n## ผลจริงของระบบ (ตั้งแต่ ${f.since})\n${rows}\n\nตัวเลขเหล่านี้นับทุกรายการที่ระบบบันทึกอัตโนมัติ ไม่ได้คัดเฉพาะรายการที่ชนะ\n\n## วิธีใช้สัญญาณอย่างปลอดภัย\n- เข้าเมื่อระบบขึ้น ✅ ควรเข้า และวาง SL ทุกรายการ\n- เสี่ยงไม่เกิน 1–2% ของทุนต่อรายการ\n- เลี่ยงช่วงข่าวเศรษฐกิจสหรัฐแรง ±30 นาที\n\n## สมัครสมาชิก\n${f.plans} — [ดูตัวอย่างกราฟ](/demo.html) · [สมัคร](/login.html#signup)` };
  return { line, facebook, seo, by: 'template' };
}

const PROMPT = `คุณคือนักเขียนการตลาดของ Gold Signal (เว็บสัญญาณซื้อขายทองคำ XAU/USD สำหรับสมาชิกที่ชำระเงิน) เขียนภาษาไทยที่สุภาพ เป็นทางการ กระชับ น่าอ่าน ตรงไปตรงมา (ใช้ "รายการ" ไม่ใช้ "ไม้" · "ซื้อขาย" ไม่ใช้ "เทรด")
กฎเหล็ก (ผิดข้อใดข้อหนึ่ง = ใช้ไม่ได้):
1. ใช้เฉพาะตัวเลขใน <facts> ห้ามแต่งตัวเลข ราคา หรือผลขึ้นเอง ถ้าผลจริงยังน้อยให้บอกตรง ๆ ว่ายังน้อย
2. ห้ามสัญญาหรือบอกเป็นนัยว่าได้กำไรแน่ / รวย / ไม่ขาดทุน / แม่น 100% / การันตี และห้ามเร่งเร้า เช่น "รีบก่อนหมด"
3. ถ้าพูดถึงผลจริง ต้องพูดทั้งรายการชนะและรายการแพ้ (เช่น "2 รายการ ชนะ 1") และบอกว่าเป็นผลในอดีต
4. ขายด้วยประโยชน์ที่เป็นจริง: เห็นจุดเข้า SL TP ชัด, แจ้งเตือน LINE, ผลจริงทุกรายการโปร่งใส, หยุดพักเองเมื่อขาดทุนติดต่อกัน, ข่าวแรงสหรัฐ, โค้ช AI
5. ลิงก์ใช้ได้เฉพาะ {SITE}/demo.html และ {SITE}/login.html#signup
ตอบเป็น JSON อย่างเดียว: {"line": "ข้อความ LINE ไม่เกิน 450 ตัวอักษร มีอีโมจิพอดี", "facebook": "โพสต์ Facebook 600–1,200 ตัวอักษร ท้ายมีแฮชแท็ก 3–5 อัน", "seo": {"title": "หัวข้อบทความไม่เกิน 70 ตัวอักษร มีคำว่า ทองคำ", "description": "คำอธิบายไม่เกิน 150 ตัวอักษร", "body": "บทความ Markdown 500–900 คำ มีหัวข้อ ## 3–5 หัวข้อ ให้ความรู้เรื่องการซื้อขายทอง/ข่าว/การบริหารความเสี่ยงที่เกี่ยวกับวันนี้ แล้วปิดด้วยการแนะนำ Gold Signal"}}`;

function tokenOf(request) { return process.env.AI_GATEWAY_API_KEY || (request && request.headers.get('x-vercel-oidc-token')) || process.env.VERCEL_OIDC_TOKEN || ''; }

async function writeWithAI(f, request) {
  const auth = tokenOf(request);
  const messages = [{ role: 'system', content: PROMPT.replaceAll('{SITE}', f.site) }, { role: 'user', content: `<facts>\n${JSON.stringify(f, null, 1)}\n</facts>` }];
  if (!auth && !globalThis.GS_AI) return null;
  try {
    let txt;
    if (!auth) txt = await workersAI(messages, { max_tokens: 2500, temperature: 0.7 }); // on Cloudflare (20 Oct 2026)
    else {
      const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(50000),
        headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL(), max_tokens: 2500, temperature: 0.7, response_format: { type: 'json_object' }, messages }),
      });
      if (!r.ok) { console.error('market ai', r.status, (await r.text().catch(() => '')).slice(0, 200)); return null; }
      const out = await r.json();
      txt = (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content) || '';
    }
    const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    if (!j.line || !j.facebook || !j.seo || !j.seo.title || !j.seo.body) return null;
    return { line: clip(j.line, 900), facebook: clip(j.facebook, 3000), seo: { title: clip(j.seo.title, 120), description: clip(j.seo.description || '', 200), body: clip(j.seo.body, 12000) }, by: auth ? MODEL() : WORKERS_AI_MODEL };
  } catch (e) { console.error('market ai', e.message); return null; }
}

// risk line on every channel + the banned-word check (the reason shows in the back office)
export function finish(d) {
  const add = (t) => (t.includes('ไม่ใช่คำแนะนำการลงทุน') ? t : `${t.trim()}\n\n${RISK}`);
  const out = { ...d, line: add(d.line), facebook: add(d.facebook), seo: { ...d.seo, body: add(d.seo.body) } };
  const hit = [out.line, out.facebook, out.seo.title, out.seo.body].join('\n').match(BANNED);
  out.blocked = hit ? `มีคำต้องห้าม "${hit[0]}" — แก้ข้อความก่อนอนุมัติ` : '';
  return out;
}

async function generate(request, by) {
  const f = await facts();
  const d = finish((await writeWithAI(f, request)) || template(f));
  const all = await readJson(DRAFTS, { drafts: [] });
  const draft = { id: `d${Date.now().toString(36)}`, at: Date.now(), by, writer: d.by, facts: { price: f.price, per: f.per }, line: d.line, facebook: d.facebook, seo: d.seo, blocked: d.blocked, sent: {} };
  all.drafts = [draft, ...(all.drafts || [])].slice(0, 30);
  await writeJson(DRAFTS, all);
  return draft;
}

async function postFacebook(text) {
  const page = (process.env.FB_PAGE_ID || '').trim(), tok = (process.env.FB_PAGE_TOKEN || '').trim();
  if (!page || !tok) throw new Error('ยังไม่ได้เชื่อมเพจ Facebook (FB_PAGE_ID / FB_PAGE_TOKEN ใน Vercel)');
  const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(page)}/feed`, { method: 'POST', body: new URLSearchParams({ message: text, access_token: tok }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Facebook: ${(j.error && j.error.message) || r.status}`);
  return j.id;
}

export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get('blog') === '1') return blogGET(request);
  if (url.searchParams.get('cron') === '1') { // Vercel cron, daily — only while the switch is on
    const secret = (process.env.CRON_SECRET || '').trim();
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return fail('cron', 401);
    const cfg = await readJson(CONFIG, {});
    if (!cfg.live) return json({ ok: true, skipped: 'marketing off' });
    const d = await generate(request, 'cron');
    return json({ ok: true, id: d.id });
  }
  const m = await member(request);
  if (!m || !isAdmin(m)) return fail('เฉพาะแอดมิน', 403);
  const [cfg, all, q] = await Promise.all([readJson(CONFIG, {}), readJson(DRAFTS, { drafts: [] }), readJson(QUEUE, { items: [] })]);
  return json({ ok: true, config: { live: !!cfg.live, at: cfg.at || 0 }, drafts: all.drafts || [], queue: (q.items || []).slice(-10).reverse(),
    fb: !!((process.env.FB_PAGE_ID || '').trim() && (process.env.FB_PAGE_TOKEN || '').trim()), site: SITE(), siteFinal: !/vercel\.app|workers\.dev/.test(SITE()), cron: !!(process.env.CRON_SECRET || '').trim() });
}

export async function POST(request) {
  const m = await member(request);
  if (!m || !isAdmin(m)) return fail('เฉพาะแอดมิน', 403);
  let q;
  try { q = await body(request, 40000); } catch (e) { return fail('ข้อมูลไม่ถูกต้อง'); }
  if (q.action === 'generate') return json({ ok: true, draft: await generate(request, m.email) });
  if (q.action === 'live') {
    if (q.on && /vercel\.app/.test(SITE()) && !q.force) return fail('ยังไม่ได้ตั้งโดเมน .com (SITE_URL) — ซื้อโดเมนแล้วให้ระบบย้ายก่อน', 409);
    await writeJson(CONFIG, { live: !!q.on, at: Date.now(), by: m.email });
    return json({ ok: true, live: !!q.on });
  }
  const all = await readJson(DRAFTS, { drafts: [] });
  const d = (all.drafts || []).find((x) => x.id === q.id);
  if (!d) return fail('ไม่พบร่างนี้', 404);
  if (q.action === 'discard') { all.drafts = all.drafts.filter((x) => x !== d); await writeJson(DRAFTS, all); return json({ ok: true }); }
  if (q.action === 'save' || q.action === 'approve') { // the admin's edits first
    if (typeof q.line === 'string') d.line = clip(q.line, 900);
    if (typeof q.facebook === 'string') d.facebook = clip(q.facebook, 3000);
    if (q.seo && typeof q.seo.title === 'string') d.seo = { title: clip(q.seo.title, 120), description: clip(q.seo.description || '', 200), body: clip(q.seo.body || '', 12000) };
    const f = finish({ line: d.line, facebook: d.facebook, seo: d.seo });
    Object.assign(d, { line: f.line, facebook: f.facebook, seo: f.seo, blocked: f.blocked });
  }
  if (q.action === 'save') { await writeJson(DRAFTS, all); return json({ ok: true, draft: d }); }
  if (q.action !== 'approve') return fail('action');
  if (d.blocked) { await writeJson(DRAFTS, all); return fail(d.blocked, 422); }
  const cfg = await readJson(CONFIG, {});
  if (!cfg.live) { await writeJson(DRAFTS, all); return fail('ยังปิดการโพสต์อยู่ — เปิดหลังซื้อโดเมน .com (ปุ่ม 🚀 เปิดใช้การตลาด)', 409); }
  const ch = q.channel;
  if (d.sent[ch]) return fail('ช่องทางนี้ส่งไปแล้ว', 409);
  if (ch === 'line') {
    const qq = await readJson(QUEUE, { items: [] });
    qq.items = [...(qq.items || []), { id: `${d.id}-line`, draft: d.id, text: d.line, at: Date.now(), status: 'queued' }].slice(-50);
    await writeJson(QUEUE, qq);
    d.sent.line = { at: Date.now(), status: 'queued' };
  } else if (ch === 'facebook') {
    try { d.sent.facebook = { at: Date.now(), id: await postFacebook(d.facebook) }; } catch (e) { await writeJson(DRAFTS, all); return fail(e.message, 502); }
  } else if (ch === 'seo') {
    const blog = await readJson(BLOG, { items: [] });
    let slug = slugOf(d.at); if ((blog.items || []).some((x) => x.slug === slug)) slug += `-${d.id.slice(-4)}`;
    blog.items = [{ slug, title: d.seo.title, description: d.seo.description, body: d.seo.body, at: Date.now() }, ...(blog.items || [])].slice(0, 500);
    await writeJson(BLOG, blog);
    d.sent.seo = { at: Date.now(), slug };
  } else return fail('channel');
  await writeJson(DRAFTS, all);
  return json({ ok: true, draft: d });
}
