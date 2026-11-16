// 📅 High-impact US economic calendar (16 Nov 2026). investing.com's calendar API now answers 403 to every outside caller
// (browser CORS error on the site, `news=0` in the recorder), so the upcoming-news card said "no news" while the week had
// Fed / retail-sales releases, and the ±30-minute news blackout stopped working. Two public feeds instead:
//   • ForexFactory's weekly JSON export (nfs.faireconomy.media) — this week's events with impact / forecast / previous
//   • Myfxbook's calendar RSS — today's events with impact, consensus, previous and the ACTUAL once it is out
// Merged by release time + name. The answer keeps investing.com's shape ({ events, occurrences }) so main.js and
// newsstats.js barely change. History beyond this week: scripts/calendar-save.js stores released items in calendar.json
// on the data branch every 5 minutes.
import { json, fail } from '../lib/gs.mjs';

const FF = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const MFX = 'https://www.myfxbook.com/rss/forex-economic-calendar-events';
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; GoldSignal/1.0; +https://gold-signal.gold-signal.workers.dev)' };
const TTL = { [FF]: 10 * 60e3, [MFX]: 60e3 }; // ForexFactory asks for gentle polling; Myfxbook carries the live actuals
const mem = new Map();

// Shared across worker instances via the Cloudflare cache (ForexFactory answers 429 when polled too often); the
// in-memory copy is the fast path and the stale fallback.
const edge = () => (typeof caches !== 'undefined' && caches.default) || null;
async function get(url) {
  const hit = mem.get(url);
  if (hit && Date.now() - hit.at < TTL[url]) return hit.text;
  const key = new Request(`${url}${url.includes('?') ? '&' : '?'}gs-cache=1`);
  try {
    const c = edge() && (await edge().match(key));
    if (c && Date.now() - +(c.headers.get('x-at') || 0) < TTL[url]) {
      const text = await c.text();
      mem.set(url, { at: +c.headers.get('x-at'), text });
      return text;
    }
  } catch (e) { /* no edge cache (local tests) */ }
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
    const text = await r.text(), at = Date.now();
    mem.set(url, { at, text });
    try { await edge()?.put(key, new Response(text, { headers: { 'x-at': String(at), 'cache-control': 'max-age=86400' } })); } catch (e) { /* optional */ }
    return text;
  } catch (e) {
    if (hit) return hit.text; // stale beats nothing
    try { const c = edge() && (await edge().match(key)); if (c) return await c.text(); } catch (e2) { /* none */ }
    throw e;
  }
}

const unent = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const words = (s) => new Set(String(s).toLowerCase().replace(/\b(m\/m|y\/y|q\/q|mom|yoy|qoq)\b/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1));
const score = (a, b) => { const A = words(a), B = words(b); let n = 0; A.forEach((w) => B.has(w) && n++); return n / Math.max(1, Math.min(A.size, B.size)); };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// "0.4%" → 0.4 / "%" · "1,697K" → 1697 / "K" · "" → null
function num(s) {
  const m = String(s || '').replace(/,/g, '').trim().match(/^(-?\d+(?:\.\d+)?)\s*([%KMBT]?)/i);
  return m ? { v: +m[1], unit: m[2].toUpperCase(), dec: (m[1].split('.')[1] || '').length } : null;
}
// investing.com's meaning: "positive" = better for the US dollar (gold usually falls). Higher unemployment / jobless
// claims is worse for the dollar.
const INVERTED = /unemployment|jobless|claims/i;
function judge(name, actual, forecast) {
  if (!actual || !forecast || actual.v === forecast.v) return 'neutral';
  return (actual.v > forecast.v) !== INVERTED.test(name) ? 'positive' : 'negative';
}

function forexFactory(text) {
  return JSON.parse(text).filter((e) => e.country === 'USD' && e.impact === 'High')
    .map((e) => ({ name: e.title, t: Date.parse(e.date), forecast: e.forecast, previous: e.previous, actual: '' }))
    .filter((e) => Number.isFinite(e.t));
}
function myfxbook(text) {
  return [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, x]) => {
    const title = unent((x.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
    if (!/^United States /.test(title)) return null;
    const desc = unent((x.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '');
    const cells = [...desc.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    // columns: time left · impact · previous · consensus · actual
    return { name: title.replace(/^United States /, ''), t: Date.parse((x.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || ''),
      high: /sprite-high-impact/.test(desc), previous: cells[2] || '', forecast: cells[3] || '', actual: cells[4] || '' };
  }).filter((e) => e && Number.isFinite(e.t));
}

export async function collect() {
  const [ff, mx] = await Promise.allSettled([get(FF).then(forexFactory), get(MFX).then(myfxbook)]);
  if (ff.status === 'rejected' && mx.status === 'rejected') throw new Error(`${ff.reason.message} · ${mx.reason.message}`);
  const list = ff.status === 'fulfilled' ? ff.value : [];
  const today = mx.status === 'fulfilled' ? mx.value : [];
  // Myfxbook rows at the same minute → the best name match fills in the actual (and a missing forecast / previous)
  const used = new Set();
  for (const e of list) {
    let best = null, bs = 0;
    today.forEach((m, i) => { if (!used.has(i) && m.t === e.t) { const s = score(e.name, m.name); if (s > bs) { bs = s; best = i; } } });
    if (best == null || bs < 0.5) continue;
    used.add(best);
    const m = today[best];
    e.actual = m.actual; e.forecast = e.forecast || m.forecast; e.previous = e.previous || m.previous;
  }
  // high-impact rows ForexFactory didn't list
  today.forEach((m, i) => { if (!used.has(i) && m.high && !list.some((e) => e.t === m.t && score(e.name, m.name) >= 0.5)) list.push(m); });

  const events = [], occurrences = [];
  for (const e of list.sort((a, b) => a.t - b.t)) {
    const id = `${e.t}-${slug(e.name)}`;
    const a = num(e.actual), f = num(e.forecast), p = num(e.previous);
    const any = a || f || p;
    events.push({ event_id: id, short_name: e.name, long_name: e.name, importance: 'high' });
    occurrences.push({ event_id: id, occurrence_time: new Date(e.t).toISOString(), actual: a ? a.v : null, forecast: f ? f.v : null,
      previous: p ? p.v : null, unit: any ? any.unit : '', precision: Math.max(a ? a.dec : 0, f ? f.dec : 0, p ? p.dec : 0),
      actual_to_forecast: judge(e.name, a, f) });
  }
  return { source: 'forexfactory+myfxbook', at: Date.now(), events, occurrences };
}

export async function GET() {
  try { return json(await collect()); } catch (e) { return fail(e.message, 502); }
}
