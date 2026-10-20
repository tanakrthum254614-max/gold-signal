// One-off (20 Oct 2026): copy every private file from the old Vercel Blob store (access/, journal/, content/, marketing/ …
// everything except backup/) into the Supabase kv table, then read each one back to check it matches. Prints paths and
// sizes only — never the contents. Safe to run again (overwrites with the Blob copy).
// Usage: node scripts/blob-to-supabase.js   Env (from .env.local): BLOB_READ_WRITE_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY
const fs = require('fs');
for (const l of (fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=\s*"?(.*?)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const vb = require('@vercel/blob');
const sb = require('./blob');

(async () => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN missing');
  if (!sb.ready()) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing in .env.local');
  const all = [];
  let cursor;
  do { const r = await vb.list({ cursor, limit: 1000 }); all.push(...r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  const files = all.filter((b) => !b.pathname.startsWith('backup/'));
  console.log(`Blob: ${all.length} files, copying ${files.length} (backup/ skipped)`);
  let ok = 0;
  for (const b of files) {
    const r = await vb.get(b.pathname, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) { console.log(`  ✗ ${b.pathname} — could not read`); continue; }
    const text = await new Response(r.stream).text();
    await sb.put(b.pathname, text);
    const back = await sb.get(b.pathname);
    const same = back && (await new Response(back.stream).text()) === text;
    console.log(`  ${same ? '✓' : '✗'} ${b.pathname} (${text.length} chars)`);
    if (same) ok++;
  }
  console.log(`done: ${ok}/${files.length} copied and checked`);
  if (ok !== files.length) process.exitCode = 1;
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
