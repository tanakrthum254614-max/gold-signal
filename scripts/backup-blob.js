// 🗄️ Daily backup of the site's private Blob data (17 Oct 2026 — user: "ทำมา"). Who paid and until when (access/pro.json),
// the paywall / Stripe settings, push devices, price alerts, guru follows, bans, the access log, every member's trade
// journal (journal/) and the articles (content/) are copied once a day to backup/<YYYY-MM-DD>/<same path> in the same
// private store; copies older than KEEP days are deleted. Guards against a bad write or a bug wiping a file — Stripe stays
// the record of the payments themselves. Runs in every 5-minute check (scripts/check-loop.sh) but only does the work once
// a day (it looks for today's folder first); never fails the check.
// Restore one file: copy backup/<date>/access/pro.json back to access/pro.json (Vercel → Storage → Blob, or @vercel/blob put).
// Usage: node scripts/backup-blob.js   Env: BLOB_READ_WRITE_TOKEN   (BACKUP_FORCE=1 = run even if today's exists)
const PREFIXES = ['access/', 'journal/', 'content/'];
const KEEP = 30;

(async () => {
  if (!require('./blob').ready()) return console.log('backup: no Blob token — skipped');
  const { list, get, put, del } = require('./blob');
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // Thai date
  const listAll = async (prefix) => { const out = []; let cursor; do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor); return out; };
  if (!process.env.BACKUP_FORCE && (await list({ prefix: `backup/${day}/`, limit: 1 })).blobs.length) return console.log(`backup: ${day} done already`);
  let n = 0, bytes = 0;
  for (const prefix of PREFIXES) {
    for (const b of await listAll(prefix)) {
      const r = await get(b.pathname, { access: 'private', useCache: false });
      if (!r || r.statusCode !== 200) continue;
      const text = await new Response(r.stream).text();
      await put(`backup/${day}/${b.pathname}`, text, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
      n++; bytes += text.length;
    }
  }
  // drop old days
  const cut = new Date(Date.parse(`${day}T00:00:00Z`) - KEEP * 864e5).toISOString().slice(0, 10);
  const old = (await listAll('backup/')).filter((b) => b.pathname.slice(7, 17) < cut);
  for (let i = 0; i < old.length; i += 100) await del(old.slice(i, i + 100).map((b) => b.url));
  console.log(`backup: ${day} · ${n} files · ${Math.round(bytes / 1024)} KB · removed ${old.length} older than ${cut}`);
})().catch((e) => console.log(`⚠️ backup failed: ${e.message}`));
