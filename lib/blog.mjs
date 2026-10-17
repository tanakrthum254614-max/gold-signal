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
const page = (title, desc, inner, canon) => `<!doctype html><html lang="th" class="pm-page"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canon)}"><link rel="icon" href="/logo.svg" type="image/svg+xml">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="article">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@500;600;700&family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/premium.css?v=202610171410">
<style>:root{--bg:var(--pm-bg);--panel:var(--pm-panel);--line:var(--pm-line);--text:var(--pm-text);--muted:var(--pm-muted);--gold:var(--pm-gold-hi)}
*{box-sizing:border-box}body{margin:0;color:var(--text);font-family:"IBM Plex Sans Thai",system-ui,sans-serif;line-height:1.8}main{max-width:760px;margin:0 auto;padding:24px 16px 60px}
.brand{display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit;margin-bottom:16px}.brand img{width:36px;height:36px}.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:14px}
h1{font-size:24px;line-height:1.4;margin:0 0 6px}h2{font-size:18px;margin:22px 0 6px}a{color:var(--gold)}.muted{color:var(--muted);font-size:14px}.cta{display:inline-block;margin:6px 8px 0 0;padding:11px 20px;border-radius:12px;background:var(--pm-grad);color:#1b1407;font-weight:700;text-decoration:none}.brand b{font-family:var(--pm-serif);letter-spacing:1.5px;color:var(--pm-ivory)}
ul{padding-left:22px}li{margin:4px 0}.list a{display:block;padding:12px 0;border-bottom:1px solid var(--line);text-decoration:none}.list b{color:var(--text)}</style></head>
<body class="pm"><main><a class="brand" href="/blog"><img src="/logo.svg" alt=""><b>Gold Signal · บทความ</b></a>${inner}
<div class="card"><b>Gold Signal — สัญญาณเทรดทองคำ XAU/USD</b><p class="muted">จุดเข้า SL TP ทุกกรอบเวลา · แจ้งเตือน LINE · ผลจริงทุกไม้ทั้งชนะและแพ้ · รายเดือน 149 บาท · รายปี 1,290 บาท</p>
<a class="cta" href="/demo.html">ทดลองดูกราฟ</a><a class="cta" href="/login.html#signup">สมัครสมาชิก</a><p class="muted">ไม่ใช่คำแนะนำการลงทุน · <a href="/terms.html">เงื่อนไข</a> · <a href="/privacy.html">ความเป็นส่วนตัว</a></p></div></main></body></html>`;
// 📊 Live record of the timeframes that passed every test period (1h / 5h / 1d BUY, risky trades excluded) + test win % —
// aggregates only, for welcome.html. The recorder's file is public on GitHub anyway (branch data).
const RAW = 'https://raw.githubusercontent.com/tanakrthum254614-max/gold-signal';
async function statsJSON() {
  const get = (u) => fetch(u, { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [cs, ts] = await Promise.all([get(`${RAW}/data/chart-signals.json?t=${Math.floor(Date.now() / 20e3)}`), get(`${RAW}/main/test-stats.json?t=${Math.floor(Date.now() / 3600e3)}`)]);
  const closed = ((cs && cs.trades) || []).filter((t) => t.status === 'win' || t.status === 'loss');
  const main = (t) => ['1h', '5h', '1d'].includes(t.tf) && !t.risky && t.side !== 'SELL';
  const done = closed.filter(main);
  // everything else the recorder closed (⚠️ risky timeframes / sides) — shown too, so the page hides nothing (17 Oct 2026)
  const rest = closed.filter((t) => !main(t)), sum = (a) => Math.round(a.reduce((x, t) => x + (t.pnl || 0), 0) * 100) / 100;
  const others = { live: rest.length, wins: rest.filter((t) => t.pnl > 0).length, pnl: sum(rest) };
  // trades the system holds right now (main timeframes) — the landing page prices them with the live gold price
  const open = ((cs && cs.trades) || []).filter((t) => t.status === 'active' && main(t)).map((t) => ({ tf: t.tf, side: t.side, entry: t.entry, sl: t.hit ? t.entry : t.sl, tp: t.tps ? t.tps[Math.min(t.hit || 0, t.tps.length - 1)] : t.tp, at: t.createdAt }));
  const tfs = ['1h', '5h', '1d'].map((tf) => { const d = done.filter((t) => t.tf === tf), st = ts && ts.tf && ts.tf[tf] && ts.tf[tf].BUY;
    return { tf, tested: st ? st.win : null, testN: st ? st.n : null, live: d.length, wins: d.filter((t) => t.pnl > 0).length, pnl: Math.round(d.reduce((a, t) => a + (t.pnl || 0), 0) * 100) / 100 }; });
  return new Response(JSON.stringify({ ok: true, since: cs && cs.startedAt, updated: cs && cs.updatedAt, tfs, others, open, all: { live: closed.length, wins: closed.filter((t) => t.pnl > 0).length, pnl: sum(closed) } }),
    { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=15' } }); // near real time (17 Oct 2026)
}
const html = (s, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });

export async function blogGET(request) {
  const url = new URL(request.url), slug = url.searchParams.get('slug') || '', site = SITE();
  if (url.searchParams.get('stats') === '1') return statsJSON(); // landing page numbers (public, any time)
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
