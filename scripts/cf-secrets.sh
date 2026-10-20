#!/usr/bin/env bash
# One-off (20 Oct 2026): copy the site's secret keys from Vercel (production) + .env.local into the Cloudflare Worker,
# without printing any value. Run it yourself from the repo root:  bash scripts/cf-secrets.sh
# Prints only the names that were set / missing. The temporary file is deleted at the end.
set -uo pipefail
TMP="$(mktemp -d)/prod.env"
trap 'rm -f "$TMP"' EXIT
npx vercel env pull "$TMP" --environment=production --yes >/dev/null 2>&1 || echo "(Vercel env pull failed — using .env.local only)"
touch "$TMP"
val() { # last value of $1 from Vercel production, else .env.local
  local v
  v="$(grep -E "^$1=" "$TMP" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/')"
  [ -z "$v" ] && [ -f .env.local ] && v="$(grep -E "^$1=" .env.local | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' | tr -d '\r')"
  printf '%s' "$v"
}
for K in ACCESS_SECRET CLERK_SECRET_KEY SUPABASE_URL SUPABASE_SERVICE_KEY STRIPE_LIVE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_SECRET_KEY CRON_SECRET AI_GATEWAY_API_KEY PRO_ENABLED PRO_FEATURES REF_DAYS FB_PAGE_ID FB_PAGE_TOKEN; do
  V="$(val "$K")"
  if [ -z "$V" ]; then echo "  – $K: not found (skipped)"; continue; fi
  if printf '%s' "$V" | npx wrangler secret put "$K" >/dev/null 2>&1; then echo "  ✓ $K"; else echo "  ✗ $K: wrangler secret put failed"; fi
done
