// Runs before every request (worker.js calls it first; next() → the static file or api/).
// 11 Nov 2026 (user: "เอาออกที่เชื่อมกับไลน์ ไม่เอาหน้าสมัครหน้าสมาชิกแล้ว"): the site is public — no sign-up, no sign-in,
// no paywall, no back office, no LINE / web push. What is left here:
//   • the old member pages (login, pay, welcome, demo, terms, privacy, admin) → 302 to the app
//   • signal records served fresh from the repo's `data` branch
//   • /api/zframes/quotes — Yahoo prices for the US-stocks tab (Yahoo blocks browser CORS)
//   • server code (lib/) hidden
// NO imports on purpose (kept from the Vercel days — plain fetch only).
const next = () => new Response(null, { headers: { 'x-middleware-next': '1' } });

export const config = { matcher: '/:path*', runtime: 'nodejs' };

const GONE = /^\/(login|pay|welcome|demo|terms|privacy|admin)\.html$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

// Signal records live on the repo's `data` branch (scripts/data-branch.sh), not main, so the 5-minute recorder doesn't
// redeploy the site. Served fresh from that branch; the copies deployed with the site are only a fallback if GitHub can't
// be reached. The query string busts GitHub's 5-minute CDN cache at most once per 10 s per file.
const DATA = /^\/(signals|intraday|chart-signals|backtest|backtest-30m|backtest-15m|zframes\/dashboards\/(?:gold|ndx|spx|div|gurus|gurus-live))\.json$/;
const RAW = 'https://raw.githubusercontent.com/tanakrthum254614-max/gold-signal/data';
const dataCache = new Map();
async function dataFile(path) {
  const now = Date.now(), hit = dataCache.get(path);
  let text = hit && now - hit.at < 10e3 ? hit.text : null;
  if (text == null) {
    const r = await fetch(`${RAW}${path}?t=${Math.floor(now / 10e3)}`, { cache: 'no-store' });
    if (!r.ok) return null;
    text = await r.text();
    dataCache.set(path, { at: now, text });
  }
  return new Response(text, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-gs-data': 'data-branch' } });
}

export default async function middleware(request) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/lib/')) return new Response('Not found', { status: 404 });
  if (GONE.test(path)) return new Response(null, { status: 302, headers: { location: '/', 'cache-control': 'no-store' } });
  if (path === '/api/zframes/quotes' && request.method === 'GET') return zframesQuotes(request);
  if (DATA.test(path)) {
    const r = await dataFile(path).catch(() => null);
    if (r) return r;
  }
  return next();
}

// Initial and fallback Yahoo prices for the US-stocks dashboard. Yahoo blocks browser HTTP CORS.
async function zframesQuotes(request) {
  const symbols = (new URL(request.url).searchParams.get('symbols') || '').split(',').filter(Boolean);
  if (!Array.isArray(symbols) || symbols.length > 100 || symbols.some(s => typeof s !== 'string' || !/^\^?[A-Z0-9.\-]{1,12}$/.test(s)))
    return json({ error: 'Invalid symbols' }, 400);
  const unique = [...new Set(symbols)].map(s => s.replace('.', '-'));
  const chunks = [];
  for (let i = 0; i < unique.length; i += 20) chunks.push(unique.slice(i, i + 20));
  const out = {};
  for (let i = 0; i < chunks.length; i += 5) {
    await Promise.all(chunks.slice(i, i + 5).map(async chunk => {
      try {
        const url = 'https://query1.finance.yahoo.com/v7/finance/spark?symbols=' + chunk.map(encodeURIComponent).join(',') + '&range=1d&interval=5m&includePrePost=true';
        const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
        if (!r.ok) return;
        const data = await r.json();
        for (const item of data.spark?.result || []) {
          const meta = item.response?.[0]?.meta;
          if (!meta) continue;
          const now = Date.now()/1000, p = meta.currentTradingPeriod;
          const hours = !p ? 'closed' : now >= p.regular.start && now < p.regular.end ? 'open' : now >= p.pre.start && now < p.pre.end ? 'pre' : now >= p.post.start && now < p.post.end ? 'post' : 'closed';
          const px = Number(meta.fulldayPrice && hours !== 'open' ? meta.fulldayPrice : meta.regularMarketPrice);
          const prev = Number(meta.chartPreviousClose ?? meta.previousClose);
          if (!Number.isFinite(px) || px <= 0) continue;
          const key = item.symbol.replace(/^([A-Z]+)-([A-Z])$/, '$1.$2');
          out[key] = { px, prev, ch: prev ? px/prev-1 : 0, t: meta.regularMarketTime*1000, hours, src: 'spark', hi: meta.regularMarketDayHigh, lo: meta.regularMarketDayLow, vol: meta.regularMarketVolume };
        }
      } catch {}
    }));
  }
  return json({ at: Date.now(), q: out });
}
