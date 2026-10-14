// 📝 Articles from the back office, live without a deploy (user, 14 Oct 2026 — "Hybrid CMS เขียนบทความผ่านหลังบ้าน
// แล้วขึ้นหน้าเว็บทันที"). Stored in the private Blob store, content/articles.json.
// GET → published articles (members) · GET ?all=1 → drafts too (admins) · POST { article } → new · PUT { article } → edit
// DELETE ?id=… — writes are admins only (ADMIN_EMAILS). Bodies are plain text with a few marks the page renders
// itself (**bold**, ## heading, - list, links) — never HTML, so nothing an admin types can run as script.
import { member, isAdmin, readJson, writeJson, json, fail, body, clip } from '../lib/gs.mjs';

const FILE = 'content/articles.json';
const TAGS = ['analysis', 'lesson', 'news', 'update'];

async function handle(request) {
  const m = await member(request);
  if (!m) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  const admin = isAdmin(m);
  const url = new URL(request.url);
  let data;
  try { data = await readJson(FILE, { items: [] }); } catch (e) { return fail('อ่านบทความไม่ได้', 503); }
  const items = data.items || [];
  const sorted = () => items.slice().sort((a, b) => (b.pinned - a.pinned) || (b.at - a.at));

  if (request.method === 'GET') {
    const all = admin && url.searchParams.get('all') === '1';
    return json({ ok: true, items: sorted().filter((a) => all || a.published) });
  }
  if (!admin) return fail('เฉพาะแอดมิน', 403);
  if (request.method === 'DELETE') {
    const i = items.findIndex((a) => a.id === url.searchParams.get('id'));
    if (i < 0) return fail('ไม่พบบทความ', 404);
    items.splice(i, 1);
    await writeJson(FILE, { items });
    return json({ ok: true, items: sorted() });
  }
  if (request.method !== 'POST' && request.method !== 'PUT') return fail('method', 405);
  let raw;
  try { raw = (await body(request, 60000)).article || {}; } catch (e) { return fail('ข้อมูลไม่ถูกต้อง'); }
  const title = clip(raw.title, 140).trim(), text = clip(raw.body, 20000).trim();
  if (!title || !text) return fail('ใส่หัวข้อและเนื้อหา');
  const old = request.method === 'PUT' ? items.find((a) => a.id === raw.id) : null;
  if (request.method === 'PUT' && !old) return fail('ไม่พบบทความ', 404);
  const a = {
    id: old ? old.id : `a${Date.now().toString(36)}`,
    title, body: text, tag: TAGS.includes(raw.tag) ? raw.tag : 'analysis',
    published: !!raw.published, pinned: !!raw.pinned,
    at: old ? old.at : Date.now(), updated: Date.now(), author: m.name || m.email,
  };
  if (old) items[items.indexOf(old)] = a; else items.push(a);
  if (items.length > 300) return fail('บทความเต็ม 300 เรื่อง ลบเรื่องเก่าก่อน');
  await writeJson(FILE, { items });
  return json({ ok: true, article: a, items: sorted() });
}

export const GET = handle, POST = handle, PUT = handle, DELETE = handle;
