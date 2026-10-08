// Bundles access/middleware.src.js (+ @vercel/blob, @vercel/functions) into /middleware.js — the file Vercel runs.
// Run after every change to the source: npm run build:middleware
import { build } from 'esbuild';

await build({
  entryPoints: ['access/middleware.src.js'],
  outfile: 'middleware.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'warning',
  // CommonJS dependencies call require() for Node built-ins; give the ES module a real require
  banner: { js: "// GENERATED from access/middleware.src.js by `npm run build:middleware` — do not edit\nimport { createRequire as __createRequire } from 'module';\nconst require = __createRequire(import.meta.url);" },
});
console.log('✓ middleware.js built');
