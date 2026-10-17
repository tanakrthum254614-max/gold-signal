#!/usr/bin/env bash
# One scheduled run of the price-alerts workflow. GitHub starts scheduled runs late and irregularly
# (10–20 minutes apart instead of 5), so each run stays up for LOOP_MINUTES and checks at every
# 5-minute mark itself. A new run is queued every 15 minutes, so the next one takes over as soon as
# this one ends. LOOP_MINUTES=0 runs a single check (manual runs).
# Env: LOOP_MINUTES, plus everything the scripts need (LINE token, SEND, RECORD, STATE_DIR, OUTBOX…)
set -u
END=$(( $(date +%s) + ${LOOP_MINUTES:-0} * 60 ))
runs=0; fails=0; savefails=0; worstsave=0

# Signal data is read from / saved to the data branch (scripts/data-branch.sh), so these commits don't redeploy the site
source scripts/data-branch.sh
git config user.name "tanakrthum254614-max"
git config user.email "$(gh api users/tanakrthum254614-max --jq '"\(.id)+\(.login)@users.noreply.github.com"')"

check() {
  data_load || return 1   # the latest records (other runs / the morning job may have saved since)
  python scripts/fetch_data.py data.json --m15-only || return 1
  local rc=0
  # First 30 minutes after the open (07:00–07:30 Thai, 08:00–08:30 in the US winter): the morning job
  # owns signals.json (no daily signal is open then)
  if node -e 'const S = require("./signals.js"), n = Date.now(), o = Date.parse(S.thaiDate(n) + "T07:00:00+07:00") + S.marketShift(n); process.exit(n >= o && n < o + 30 * 60e3 ? 1 : 0)'; then
    node scripts/alerts.js data.json || rc=1
  fi
  node scripts/intraday-run.js data.json || rc=1
  node scripts/chart-run.js data.json || rc=1   # every chart-timeframe signal → chart-signals.json
  node scripts/price-alerts-user.js data.json   # members' own price alerts → web push (never fails the check)
  node scripts/pro-expiry.js                     # ⏰ membership ends in ≤ 3 days → web push to that member (never fails the check)
  node scripts/backup-blob.js                    # 🗄️ once a day: copy private Blob data to backup/<date>/ (30 days kept, never fails the check)
  node scripts/flush.js   # everything from this check as one LINE request
  # Save results onto the data branch (no website deployment)
  if data_save "Signal update $(TZ=Asia/Bangkok date '+%F %H:%M')"; then savefails=0; else
    rc=1; savefails=$((savefails + 1)); [ "$savefails" -gt "$worstsave" ] && worstsave=$savefails
    echo "⚠️ saving to the data branch failed ($savefails in a row)"
  fi
  return $rc
}

while :; do
  runs=$((runs + 1))
  echo "── check $runs at $(TZ=Asia/Bangkok date '+%H:%M:%S') ──"
  check || { fails=$((fails + 1)); echo "⚠️ check $runs failed"; }
  next=$(( ($(date +%s) / 300 + 1) * 300 ))   # the next 5-minute mark
  [ "$next" -ge "$END" ] && break
  sleep $(( next - $(date +%s) + 20 ))          # +20 s: let the 15-minute candle settle
done
echo "done: $runs checks, $fails failed"
# Fail the run (→ LINE notice) only when every check in it failed
# …or when saving failed 3 checks in a row (records would be lost) — the watchdog (scripts/watchdog.js) tells the admins
[ "$fails" -lt "$runs" ] && [ "$worstsave" -lt 3 ]
