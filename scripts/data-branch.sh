# Signal data lives on the `data` branch, not main (12 Oct 2026): every 5-minute "Signal update" commit on main made Vercel
# redeploy the whole site, and Vercel Hobby allows 100 deployments a day — the recorder used them all and website changes
# stopped going live. vercel.json turns deployments off for the `data` branch; the website reads these files fresh from it
# through middleware.js (members only). Code always comes from main.
#   source scripts/data-branch.sh
#   data_load            → the data branch's files into the working tree (call right after checkout / before each check)
#   data_save "message"  → commit the changed data files onto the data branch (rebased on newer data commits, as before)
DATA_FILES="signals.json intraday.json chart-signals.json quota.json backtest.json backtest-30m.json backtest-15m.json zframes/dashboards/gold.json zframes/dashboards/ndx.json zframes/dashboards/spx.json zframes/dashboards/div.json zframes/dashboards/gurus.json zframes/dashboards/gurus-cusip.json"  # + member dashboards, guru portfolios (scripts/gurus-13f.js) (scripts/zframes-refresh.sh)

data_load() {
  git fetch -q --depth=50 origin +refs/heads/data:refs/remotes/origin/data || return 1  # actions/checkout clones main only, shallow
  local f
  for f in $DATA_FILES; do
    if git cat-file -e "origin/data:$f" 2>/dev/null; then git show "origin/data:$f" > "$f"; fi
  done
  DATA_BASE=$(git rev-parse origin/data)
  # later steps of the same job (morning / weekly workflows) save on top of this commit
  if [ -n "${GITHUB_ENV:-}" ]; then echo "DATA_BASE=$DATA_BASE" >> "$GITHUB_ENV"; fi
  return 0
}

data_save() {
  local msg="$1" dir rc=0 f
  [ -n "${DATA_BASE:-}" ] || { echo "data_save: data_load first" >&2; return 1; }
  dir=$(mktemp -d)
  git worktree add -q --detach "$dir" "$DATA_BASE" || return 1
  for f in $DATA_FILES; do if [ -f "$f" ]; then cp "$f" "$dir/$f"; fi; done
  (
    cd "$dir" || exit 1
    for f in $DATA_FILES; do if [ -f "$f" ]; then git add "$f"; fi; done
    git diff --cached --quiet && exit 0
    git commit -q -m "$msg" || exit 1
    for i in 1 2 3; do
      git fetch -q --depth=50 origin +refs/heads/data:refs/remotes/origin/data && git rebase -q origin/data && git push -q origin HEAD:data && exit 0
      git rebase --abort 2>/dev/null
      sleep 5
    done
    exit 1
  ) || rc=1
  git worktree remove --force "$dir"
  git fetch -q --depth=50 origin +refs/heads/data:refs/remotes/origin/data && DATA_BASE=$(git rev-parse origin/data)
  return $rc
}
