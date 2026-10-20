#!/usr/bin/env bash
# Static files for the Cloudflare Worker (wrangler.toml [assets] → dist/): every file tracked in git, minus server code,
# scripts, research and repo files — what Vercel served from the repo root. Run from the repo root.
set -euo pipefail
rm -rf dist
mkdir -p dist
git ls-files -z | grep -zvE '^(api|lib|scripts|research|zframes-build|docs|\.github)/|^(worker\.js|middleware\.js|dev-server\.js|wrangler\.toml|vercel\.json|package(-lock)?\.json|requirements\.txt|\.gitignore)$|\.(md|py)$' \
  | xargs -0 -I{} cp --parents {} dist/
echo "dist: $(find dist -type f | wc -l) files, $(du -sh dist | cut -f1)"
