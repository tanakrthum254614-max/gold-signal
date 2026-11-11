// Cloudflare Worker for the whole site (20 Oct 2026 — moved off Vercel). middleware.js first on every request, then the
// functions in api/ (same GET/POST exports), else the static file from the assets folder (dist/, built by
// scripts/cf-build.sh). 11 Nov 2026: public site — the member, payment, journal, coach, articles and marketing routes are gone.
import middleware from './middleware.js';
import * as candles from './api/candles.mjs';
import * as news from './api/news.mjs';

const API = { '/api/candles': candles, '/api/news': news };
// vercel.json "headers": never cache the app shell, the service worker or the fallback data files
const NO_STORE = new Set(['/', '/index.html', '/zframes/index.html', '/signals.json', '/backtest.json', '/intraday.json', '/backtest-30m.json', '/quota.json', '/backtest-15m.json', '/sw.js']);

async function api(mod, request) {
  const fn = mod[request.method] || (request.method === 'HEAD' && mod.GET);
  return fn ? fn(request) : new Response('Method Not Allowed', { status: 405 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const gate = await middleware(request);
    if (gate.headers.get('x-middleware-next') !== '1') return gate;
    const path = url.pathname;
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
};
