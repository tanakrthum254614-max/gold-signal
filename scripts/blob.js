// Stand-in for the parts of @vercel/blob the scripts use (get / put / list / del), backed by Supabase (20 Oct 2026: the
// Vercel Blob read quota ran out and Vercel blocked the whole team). Same table as lib/gs.mjs and middleware.js:
// kv (path text primary key, body text, updated_at timestamptz). A blob's "url" here is just its path.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY.
const base = () => `${(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')}/rest/v1/kv`;
const headers = (extra = {}) => {
  const k = (process.env.SUPABASE_SERVICE_KEY || '').trim();
  return { apikey: k, ...(k.startsWith('eyJ') ? { authorization: `Bearer ${k}` } : {}), ...extra };
};
const ready = () => !!((process.env.SUPABASE_URL || '').trim() && (process.env.SUPABASE_SERVICE_KEY || '').trim());

// → { statusCode: 200, stream } like @vercel/blob get(), or null when the file isn't there
async function get(path) {
  const r = await fetch(`${base()}?select=body&path=eq.${encodeURIComponent(path)}`, { headers: headers() });
  if (!r.ok) throw new Error(`store get ${r.status}`);
  const rows = await r.json();
  return rows.length ? { statusCode: 200, stream: new Response(rows[0].body).body } : null;
}
async function put(path, text) {
  const r = await fetch(`${base()}?on_conflict=path`, {
    method: 'POST', body: JSON.stringify({ path, body: String(text), updated_at: new Date().toISOString() }),
    headers: headers({ 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' }),
  });
  if (!r.ok) throw new Error(`store put ${r.status}`);
  return { pathname: path, url: path };
}
// { prefix, limit, cursor } → { blobs: [{ pathname, url, size }], hasMore, cursor } (cursor = row offset)
async function list({ prefix = '', limit = 1000, cursor } = {}) {
  const from = +cursor || 0;
  const like = encodeURIComponent(`${prefix.replace(/[%_\\]/g, '\\$&')}%`);
  const r = await fetch(`${base()}?select=path,size:body&path=like.${like}&order=path&limit=${limit + 1}&offset=${from}`, { headers: headers() });
  if (!r.ok) throw new Error(`store list ${r.status}`);
  const rows = await r.json();
  const blobs = rows.slice(0, limit).map((x) => ({ pathname: x.path, url: x.path, size: String(x.size || '').length }));
  return { blobs, hasMore: rows.length > limit, cursor: rows.length > limit ? String(from + limit) : undefined };
}
async function del(urls) {
  const list = [].concat(urls);
  if (!list.length) return;
  const inList = list.map((p) => `"${String(p).replace(/"/g, '\\"')}"`).join(',');
  const r = await fetch(`${base()}?path=in.(${encodeURIComponent(inList)})`, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error(`store del ${r.status}`);
}

module.exports = { get, put, list, del, ready };
