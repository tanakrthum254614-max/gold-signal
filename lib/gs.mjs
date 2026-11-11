// Shared by the functions in api/ (candles, news). 11 Nov 2026: the public site has no members, store or payments any more —
// only the JSON response helpers are left.
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export const fail = (error, status = 400) => json({ ok: false, error }, status);
