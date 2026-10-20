// Cloudflare Worker for the whole site (20 Oct 2026 — moved off Vercel after its Hobby Blob quota ran out and the team was
// blocked). Does what Vercel did: middleware.js first on every request (members only, paywall, /api/session …), then the
// functions in api/ (same files, same GET/POST/… exports), the vercel.json rewrites / headers / cron, else the static file
// from the assets folder (dist/, built by scripts/cf-build.sh). wrangler.toml: run_worker_first, html_handling "none"
// (no .html → pretty-URL redirects — login.html etc. keep their names).
import middleware from './middleware.js';
import * as articles from './api/articles.mjs';
import * as candles from './api/candles.mjs';
import * as coach from './api/coach.mjs';
import * as golive from './api/golive.mjs';
import * as journal from './api/journal.mjs';
import * as market from './api/market.mjs';
import * as news from './api/news.mjs';
import * as pro from './api/pro.mjs';
import * as checkout from './api/pay/checkout.mjs';
import * as portal from './api/pay/portal.mjs';
import * as webhook from './api/pay/webhook.mjs';

const API = {
  '/api/articles': articles, '/api/candles': candles, '/api/coach': coach, '/api/golive': golive, '/api/journal': journal,
  '/api/market': market, '/api/news': news, '/api/pro': pro,
  '/api/pay/checkout': checkout, '/api/pay/portal': portal, '/api/pay/webhook': webhook,
};
// vercel.json "headers": never cache the app shell, the service worker or the fallback data files
const NO_STORE = new Set(['/', '/index.html', '/zframes/index.html', '/signals.json', '/backtest.json', '/intraday.json', '/backtest-30m.json', '/quota.json', '/backtest-15m.json', '/sw.js']);

async function api(mod, request) {
  const fn = mod[request.method] || (request.method === 'HEAD' && mod.GET);
  return fn ? fn(request) : new Response('Method Not Allowed', { status: 405 });
}

export default {
  async fetch(request, env) {
    globalThis.GS_AI = env.AI; // Workers AI for the coach / marketing writer (lib/gs.mjs workersAI)
    const url = new URL(request.url);
    const gate = await middleware(request);
    if (gate.headers.get('x-middleware-next') !== '1') return gate;
    const path = url.pathname;
    // vercel.json "rewrites": /blog, /blog/<slug>, /sitemap.xml → /api/market?blog=1…
    const blog = path === '/blog' ? '' : (path.match(/^\/blog\/([a-z0-9-]+)$/) || [])[1];
    if (blog !== undefined || path === '/sitemap.xml') {
      const u = new URL('/api/market', url);
      u.searchParams.set('blog', '1');
      if (blog) u.searchParams.set('slug', blog);
      if (path === '/sitemap.xml') u.searchParams.set('sitemap', '1');
      return market.GET(new Request(u, request));
    }
    if (API[path]) return api(API[path], request);
    if (path.startsWith('/api/')) return new Response('Not found', { status: 404 });
    // html_handling "none" serves exact names only: / and /zframes/ → their index.html
    const res = await env.ASSETS.fetch(path.endsWith('/') ? new Request(new URL(`${path}index.html${url.search}`, url), request) : request);
    if (!NO_STORE.has(path) && path !== '/manifest.webmanifest') return res;
    const out = new Response(res.body, res);
    if (path === '/manifest.webmanifest') { out.headers.set('content-type', 'application/manifest+json'); out.headers.set('cache-control', 'no-cache'); return out; }
    out.headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    if (path === '/sw.js') out.headers.set('service-worker-allowed', '/');
    return out;
  },
  // vercel.json "crons": the marketing agent's daily draft (30 1 * * 1-5 UTC) — skips itself while marketing is off
  async scheduled(event, env, ctx) {
    const secret = (env.CRON_SECRET || '').trim();
    if (!secret) return;
    ctx.waitUntil(market.GET(new Request('https://cron.local/api/market?cron=1', { headers: { authorization: `Bearer ${secret}` } })));
  },
};
