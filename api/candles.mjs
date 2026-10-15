// 🕯️ Candlesticks for any stock on the US stocks tab (user, 15 Oct 2026: "ขอทุกหุ้นให้มีกราฟแท่งเทียน"). Yahoo's chart
// API (the browser can't call it — no CORS). Members only. GET ?s=NVDA&iv=5m|1h|1d|1wk → { ok, s, iv, rows: [{ t, o, h, l, c, v }] }
// Kept in memory for 60 s per symbol + interval (one warm function serves everyone looking at the same stock).
import { member, json, fail } from '../lib/gs.mjs';

const IV = { '5m': ['5m', '5d'], '1h': ['60m', '3mo'], '1d': ['1d', '1y'], '1wk': ['1wk', '5y'] };
const TTL = 60e3, cache = new Map();

export async function GET(request) {
  if (!(await member(request))) return fail('ต้องเข้าสู่ระบบก่อน', 401);
  const u = new URL(request.url), s = (u.searchParams.get('s') || '').toUpperCase(), iv = u.searchParams.get('iv') || '1d';
  if (!/^\^?[A-Z0-9.\-]{1,12}$/.test(s) || !IV[iv]) return fail('สัญลักษณ์หรือกรอบเวลาไม่ถูกต้อง');
  const key = `${s}:${iv}`, hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return json(hit.body);
  const [interval, range] = IV[iv];
  try {
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.replace('.', '-'))}?range=${range}&interval=${interval}&includePrePost=false`,
      { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return fail(`Yahoo ${r.status}`, 502);
    const x = (await r.json()).chart?.result?.[0], q = x?.indicators?.quote?.[0];
    if (!x?.timestamp || !q) return fail('ไม่มีข้อมูลแท่งเทียน', 404);
    let rows = x.timestamp.map((t, i) => ({ t: t * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i] || 0 }))
      .filter((b) => [b.o, b.h, b.l, b.c].every((v) => Number.isFinite(v)))
      .map((b) => ({ ...b, o: +b.o.toFixed(4), h: +b.h.toFixed(4), l: +b.l.toFixed(4), c: +b.c.toFixed(4) }));
    // intraday: Yahoo adds flat zero-volume placeholder bars outside trading hours — drop them
    if (iv === '5m' || iv === '1h') while (rows.length > 1 && !rows.at(-1).v && rows.at(-1).o === rows.at(-1).h && rows.at(-1).h === rows.at(-1).l) rows.pop();
    const body = { ok: true, s, iv, rows };
    cache.set(key, { at: Date.now(), body });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return json(body);
  } catch (e) {
    if (hit) return json(hit.body); // Yahoo slow / down: the last copy
    return fail('ดึงแท่งเทียนไม่ได้ ลองใหม่อีกครั้ง', 502);
  }
}
