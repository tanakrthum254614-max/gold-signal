// 📰 Real news with pictures for the US news tab (user, 15 Oct 2026: wanted it like a news site — "ให้รูปและข้อความ …
// ดูน่าดูและน่าเชื่อถือ" → chose "ดึงข่าวจริงจากสำนักข่าว"). investing.com's Thai RSS feeds (meant for syndication):
// headline, picture, time and link only — the page shows them with the source and links to the full article there.
// Members only (same cookie as the rest of the site). GET → { ok, at, items: [{ id, cat, title, link, img, t }] }
// The browser can't read these feeds itself (no CORS); a plain server fetch works (no Cloudflare check on /rss/).
import { member, json, fail } from '../lib/gs.mjs';

const FEEDS = [
  ['gold', 'ทองคำ · สินค้าโภคภัณฑ์', 'https://th.investing.com/rss/news_11.rss'],
  ['econ', 'เศรษฐกิจ', 'https://th.investing.com/rss/news_14.rss'],
  ['data', 'ตัวเลขเศรษฐกิจ', 'https://th.investing.com/rss/news_95.rss'],
];
const TTL = 60e3; // 1 minute (user, 15 Oct: "ขอทุกอย่างอัพแบบเรียลไทม์")
let cache = { at: 0, items: null };

const unent = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const tag = (x, name) => { const m = x.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? unent(m[1]) : ''; };
// only links / pictures on investing.com's own hosts end up in the page
const safe = (u, host) => { try { const p = new URL(u); return p.protocol === 'https:' && host.test(p.hostname) ? p.href : ''; } catch (e) { return ''; } };

async function feed([cat, label, url]) {
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GoldSignal/1.0; +https://gold-signal.gold-signal.workers.dev)' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${cat} ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, x]) => {
    const link = safe(tag(x, 'link'), /(^|\.)investing\.com$/), img = safe((x.match(/<enclosure[^>]*url="([^"]+)"/) || [])[1] || '', /(^|\.)investing\.com$/);
    const t = Date.parse(`${tag(x, 'pubDate').replace(' ', 'T')}Z`); // the feed's times are UTC
    // id = the whole article key (article-801554, article-93CH-798426 — the digits alone repeat across articles)
    return { id: (link.match(/article-([\w-]+)$/) || [])[1] || link, cat, label, title: tag(x, 'title').slice(0, 300), link, img, t: Number.isFinite(t) ? t : null };
  }).filter((x) => x.title && x.link);
}

// All feeds, newest first; the same article can sit in two feeds — keep the first (gold first). Exported for local tests.
export async function collect() {
  const got = await Promise.allSettled(FEEDS.map(feed));
  const items = got.flatMap((g) => (g.status === 'fulfilled' ? g.value : []));
  const seen = new Set();
  return items.filter((x) => !seen.has(x.id) && seen.add(x.id)).sort((a, b) => (b.t || 0) - (a.t || 0));
}

export async function GET(request) {
  if (!(await member(request))) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  if (!cache.items || Date.now() - cache.at > TTL) {
    const uniq = await collect();
    if (uniq.length) cache = { at: Date.now(), items: uniq };
    else if (!cache.items) return fail('ดึงข่าวไม่ได้ ลองใหม่อีกครั้ง', 502);
  }
  return json({ ok: true, at: cache.at, source: 'Investing.com ภาษาไทย', items: cache.items });
}
