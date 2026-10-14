// Launch-day gift by hand (the back office's 🚀 go-live button does the same as part of launching — api/golive.mjs):
// every member gets N days of PRO (default 30), once each.
//   CLERK_SECRET_KEY=… BLOB_READ_WRITE_TOKEN=… ADMIN_EMAILS=… node scripts/grant-existing.mjs [--days 30]
import { loadPro, savePro, giftExisting } from '../lib/stripe.mjs';

const i = process.argv.indexOf('--days');
const days = Math.round(+(i > 0 ? process.argv[i + 1] : 30));
if (!process.env.CLERK_SECRET_KEY || !process.env.BLOB_READ_WRITE_TOKEN || !(days > 0)) { console.error('set CLERK_SECRET_KEY, BLOB_READ_WRITE_TOKEN; --days > 0'); process.exit(1); }
const admins = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
const all = await loadPro();
const g = await giftExisting(all, days, (email) => admins.includes(email.toLowerCase()));
await savePro(all);
console.log(`gave ${days} days PRO to ${g.given} members · skipped ${g.skipped} (admins / banned / already given) · of ${g.total}`);
