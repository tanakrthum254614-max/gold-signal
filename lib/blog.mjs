// 📰 Public articles for Google (SEO) — /blog, /blog/<slug>, /sitemap.xml (vercel.json rewrites → /api/market?blog=1;
// middleware.js PUBLIC). Lives in lib/ and is served by api/market.mjs: the Hobby plan allows 12 functions per deployment.
// Articles come from the marketing agent's approved drafts (api/market.mjs → Blob content/blog.json). Until the marketing
// switch is on (marketing/config.json live — after the .com domain) every page answers 404, so nothing is indexed early.
import { readJson } from './gs.mjs';

const SITE = () => (process.env.SITE_URL || 'https://gold-signal-ten.vercel.app').replace(/\/$/, '');
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (t) => new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
// small Markdown: ## / ### headings, - lists, **bold**, [text](/path or https://…), paragraphs
function md(src) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g, '<a href="$2">$1</a>');
  const out = []; let list = false;
  for (const raw of String(src || '').split(/\r?\n/)) {
    const l = raw.trim();
    if (/^[-•]\s+/.test(l)) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(l.replace(/^[-•]\s+/, ''))}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if (!l) continue;
    if (l.startsWith('### ')) out.push(`<h3>${inline(l.slice(4))}</h3>`);
    else if (l.startsWith('## ')) out.push(`<h2>${inline(l.slice(3))}</h2>`);
    else out.push(`<p>${inline(l)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('\n');
}
const page = (title, desc, inner, canon) => `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canon)}"><link rel="icon" href="/logo.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
<style>:root{--bg:#f3f5f9;--panel:#fff;--line:#e2e7ef;--text:#1c2433;--muted:#697386;--gold:#b9800c}@media (prefers-color-scheme:dark){:root{--bg:#0d1016;--panel:#151a23;--line:#262e3b;--text:#e6e9ef;--muted:#8a93a3;--gold:#e8b64c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:"IBM Plex Sans Thai",system-ui,sans-serif;line-height:1.8}main{max-width:760px;margin:0 auto;padding:24px 16px 60px}
.brand{display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit;margin-bottom:16px}.brand img{width:36px;height:36px}.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:14px}
h1{font-size:24px;line-height:1.4;margin:0 0 6px}h2{font-size:18px;margin:22px 0 6px}a{color:var(--gold)}.muted{color:var(--muted);font-size:14px}.cta{display:inline-block;margin:6px 8px 0 0;padding:10px 18px;border-radius:12px;background:#f0b90b;color:#1c2433;font-weight:700;text-decoration:none}
ul{padding-left:22px}li{margin:4px 0}.list a{display:block;padding:12px 0;border-bottom:1px solid var(--line);text-decoration:none}.list b{color:var(--text)}</style></head>
<body><main><a class="brand" href="/blog"><img src="/logo.svg" alt=""><b>Gold Signal · บทความ</b></a>${inner}
<div class="card"><b>Gold Signal — สัญญาณเทรดทองคำ XAU/USD</b><p class="muted">จุดเข้า SL TP ทุกกรอบเวลา · แจ้งเตือน LINE · ผลจริงทุกไม้ทั้งชนะและแพ้ · รายเดือน 149 บาท · รายปี 1,290 บาท</p>
<a class="cta" href="/demo.html">ทดลองดูกราฟ</a><a class="cta" href="/login.html#signup">สมัครสมาชิก</a><p class="muted">ไม่ใช่คำแนะนำการลงทุน · <a href="/terms.html">เงื่อนไข</a> · <a href="/privacy.html">ความเป็นส่วนตัว</a></p></div></main></body></html>`;
const html = (s, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });

export async function blogGET(request) {
  const url = new URL(request.url), slug = url.searchParams.get('slug') || '', site = SITE();
  const cfg = await readJson('marketing/config.json', {}).catch(() => ({}));
  if (!cfg.live) return html(page('ไม่พบหน้านี้ · Gold Signal', '', '<div class="card"><h1>ไม่พบหน้านี้</h1></div>', `${site}/blog`), 404);
  const items = ((await readJson('content/blog.json', { items: [] }).catch(() => ({ items: [] }))).items || []);
  if (url.searchParams.get('sitemap') === '1') {
    const pages = ['/demo.html', '/login.html', '/terms.html', '/blog', ...items.map((a) => `/blog/${a.slug}`)];
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `<url><loc>${site}${p}</loc></url>`).join('\n')}\n</urlset>`,
      { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  }
  if (!slug) return html(page('บทความทองคำ · Gold Signal', 'บทความ ข่าว และผลจริงของระบบสัญญาณทองคำ Gold Signal',
    `<div class="card"><h1>บทความทองคำ</h1><div class="list">${items.map((a) => `<a href="/blog/${esc(a.slug)}"><b>${esc(a.title)}</b><br><span class="muted">${day(a.at)}</span></a>`).join('') || '<p class="muted">ยังไม่มีบทความ</p>'}</div></div>`, `${site}/blog`));
  const a = items.find((x) => x.slug === slug);
  if (!a) return html(page('ไม่พบบทความ · Gold Signal', '', '<div class="card"><h1>ไม่พบบทความ</h1><p><a href="/blog">← บทความทั้งหมด</a></p></div>', `${site}/blog`), 404);
  return html(page(`${a.title} · Gold Signal`, a.description || a.title, `<article class="card"><h1>${esc(a.title)}</h1><p class="muted">${day(a.at)}</p>${md(a.body)}</article><p><a href="/blog">← บทความทั้งหมด</a></p>`, `${site}/blog/${a.slug}`));
}
