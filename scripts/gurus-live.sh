#!/usr/bin/env bash
# Every 10 minutes (.github/workflows/gurus-live.yml): the gurus' new SEC filings → zframes/dashboards/gurus-live.json; a new
# quarterly 13F → rebuild zframes/dashboards/gurus.json too. Saved to the data branch only when something changed.
set -u
source scripts/data-branch.sh
git config user.name "tanakrthum254614-max"
git config user.email "$(gh api users/tanakrthum254614-max --jq '"\(.id)+\(.login)@users.noreply.github.com"')"
data_load || exit 1
before=$(cat zframes/dashboards/gurus-live.json 2>/dev/null | md5sum)
out=$(node scripts/gurus-live.js zframes/dashboards/gurus-live.json zframes/dashboards/gurus.json) || exit 1
echo "$out"
msg="Guru filings $(TZ=Asia/Bangkok date '+%F %H:%M')"
if echo "$out" | grep -q "NEW 13F"; then
  echo "── new 13F: rebuilding the portfolios ──"
  if timeout 900 node scripts/gurus-13f.js /tmp/gurus.json zframes/dashboards/gurus-cusip.json \
     && node -e 'process.exit(JSON.parse(require("fs").readFileSync("/tmp/gurus.json")).gurus.length >= 20 ? 0 : 1)'; then
    cp /tmp/gurus.json zframes/dashboards/gurus.json && msg="$msg + new 13F portfolios"
  fi
fi
after=$(cat zframes/dashboards/gurus-live.json 2>/dev/null | md5sum)
if [ "$before" = "$after" ] && ! echo "$msg" | grep -q "new 13F"; then echo "no change"; exit 0; fi
data_save "$msg"
