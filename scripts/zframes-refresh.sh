#!/usr/bin/env bash
# Refresh the member dashboards (/zframes: gold, Nasdaq-100, S&P 500, dividend stocks) every morning — prices, returns,
# 52-week ranges, macro (FRED), breadth, dividends and the Gold Signal record — with the same models / builder as the
# /zframes skill (copied in zframes-build/). The written analysis (zframes-build/notes) only changes when Claude
# rewrites it; the page shows its age. Each dashboard is independent: one that fails keeps yesterday's file.
# Saved to the data branch (scripts/data-branch.sh) so it doesn't redeploy the site.
set -u
source scripts/data-branch.sh
git config user.name "tanakrthum254614-max"
git config user.email "$(gh api users/tanakrthum254614-max --jq '"\(.id)+\(.login)@users.noreply.github.com"')"
data_load || exit 1
export GOLD_SIGNAL_DIR="$PWD" PYTHONIOENCODING=utf-8   # gold_model reads signals.json / chart-signals.json from here
done_list=""
build() { # asset, model command…
  local a="$1"; shift
  echo "── $a ──"
  if (cd zframes-build && timeout 900 python "$@" && python build_dashboard.py "$a"); then
    # a source that failed today (FRED, Yahoo…) drops cards: then keep yesterday's complete dashboard
    if node -e 'const c=(f)=>{try{return JSON.parse(require("fs").readFileSync(f)).zones.reduce((n,z)=>n+z.frames.length,0)}catch(e){return 0}};const n=c(process.argv[1]),o=c(process.argv[2]);console.log("cards",n,"(was",o+")");process.exit(n>=o?0:1)' "zframes-build/dashboards/$a.json" "zframes/dashboards/$a.json"; then
      cp "zframes-build/dashboards/$a.json" "zframes/dashboards/$a.json" && done_list="$done_list $a"
    else
      echo "⚠️ $a came out with fewer cards — keeping the previous dashboard"
    fi
  else
    echo "⚠️ $a failed — keeping the previous dashboard"
  fi
}
# gold: removed from the site menu on 15 Oct 2026 (user: "ตัดในส่วนนี้ออก ทอง/Gold") — not built any more
build ndx models/stocks_model.py ndx
build spx models/stocks_model.py spx
build div models/div_model.py
[ -n "$done_list" ] || { echo "no dashboard refreshed"; exit 1; }
data_save "Dashboards refresh $(TZ=Asia/Bangkok date '+%F %H:%M'):$done_list"
