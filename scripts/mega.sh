#!/usr/bin/env bash
# mega — control which megascope version the /megascope skill runs.
#
#   mega dogfood   point the deployed skill at the DEV worktree (try a candidate)
#   mega restore   point it back at the PROD worktree (known-good, `main`)
#   mega status    show which one is currently live   (default)
#
# Only NEW claude sessions pick up a change — skills load at session start.
set -euo pipefail

DEPLOY="$HOME/.claude/skills/megascope"
PROD="$HOME/Dev/skill-megascope/skills/megascope"      # prod worktree · always `main`
DEV="$HOME/Dev/skill-megascope-dev/skills/megascope"   # dev worktree  · branch `dev`

cmd="${1:-status}"
case "$cmd" in
  dogfood) ln -sfn "$DEV"  "$DEPLOY" ;;
  restore) ln -sfn "$PROD" "$DEPLOY" ;;
  status)  ;;
  *) echo "usage: mega {dogfood|restore|status}" >&2; exit 2 ;;
esac

target="$(readlink "$DEPLOY" 2>/dev/null || true)"
case "$target" in
  "$DEV")  label="DOGFOOD · dev worktree (candidate)" ;;
  "$PROD") label="DEPLOYED · prod worktree (main, known-good)" ;;
  "")      label="MISSING · no symlink at $DEPLOY" ;;
  *)       label="OTHER · $target" ;;
esac
printf '/megascope → %s\n' "${target:-<none>}"
printf 'state: %s\n' "$label"
if [ "$cmd" != status ]; then
  echo 'reminder: open a NEW claude session to pick this up.'
fi
