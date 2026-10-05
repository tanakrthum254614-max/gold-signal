// One-time setup for push notifications. Run it yourself from the repo folder:
//   node scripts/setup-push.js
// 1. makes a VAPID key pair (identifies our server to the browsers' push services)
// 2. GitHub: secret VAPID_PRIVATE_KEY, variable VAPID_PUBLIC_KEY
// 3. GitHub: secret CLERK_SECRET_KEY, copied from the Vercel project's env (to find who subscribed)
// 4. writes the public key into config.js (public by design) — then commit + push config.js
// Secrets go straight from here to `gh` through stdin; nothing secret is printed or written to the repo.
// Needs: gh (logged in), npx vercel (logged in to scope thander1). Run again with --new to replace the keys
// (everyone then has to switch notifications on again).
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = 'tanakrthum254614-max/gold-signal';
const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'config.js');
const win = process.platform === 'win32';
const run = (cmd, args, input) => execFileSync(cmd, args, { input, cwd: ROOT, stdio: [input == null ? 'inherit' : 'pipe', 'pipe', 'pipe'], shell: win }).toString();
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const config = fs.readFileSync(CONFIG, 'utf8');
const existing = (config.match(/vapidPublicKey: '([^']*)'/) || [])[1];

// 1–2. VAPID keys (P-256): public = uncompressed point 04|x|y, private = d — both base64url
if (existing && !process.argv.includes('--new')) {
  console.log('• VAPID keys already set up (config.js has the public key) — keeping them (use --new to replace)');
} else {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const pub = b64url(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]));
  void publicKey;
  run('gh', ['secret', 'set', 'VAPID_PRIVATE_KEY', '-R', REPO], jwk.d);
  console.log('✓ GitHub secret VAPID_PRIVATE_KEY');
  run('gh', ['variable', 'set', 'VAPID_PUBLIC_KEY', '-R', REPO, '--body', pub]);
  console.log('✓ GitHub variable VAPID_PUBLIC_KEY');
  fs.writeFileSync(CONFIG, config.replace(/vapidPublicKey: '[^']*'/, `vapidPublicKey: '${pub}'`));
  console.log('✓ config.js — public key added (commit + push it)');
}

// 3. Clerk secret key from Vercel → GitHub secret
const tmp = path.join(os.tmpdir(), `gs-env-${process.pid}`);
try {
  run('npx', ['-y', 'vercel', 'env', 'pull', tmp, '--environment=production', '--yes']);
  const m = fs.readFileSync(tmp, 'utf8').match(/^CLERK_SECRET_KEY="?([^"\r\n]+)"?/m);
  if (!m) throw new Error('CLERK_SECRET_KEY not found in the Vercel project env');
  run('gh', ['secret', 'set', 'CLERK_SECRET_KEY', '-R', REPO], m[1]);
  console.log('✓ GitHub secret CLERK_SECRET_KEY (from Vercel)');
} catch (e) {
  console.log(`⚠️ CLERK_SECRET_KEY not set: ${e.message.split('\n')[0]}`);
  console.log('   Copy it from the Clerk dashboard → API keys, then run:  gh secret set CLERK_SECRET_KEY -R ' + REPO);
} finally {
  fs.rmSync(tmp, { force: true });
}
console.log('\nDone. Next: commit + push config.js, open the app → บัญชี → 🔔 เปิดแจ้งเตือน');
