#!/usr/bin/env bash
# mega — control which megascope version the /megascope skill runs.
#
#   mega dogfood   point the deployed skill at the DEV worktree (try a candidate)
#   mega restore   point it back at the PROD worktree (known-good, default branch)
#   mega status    show which one is currently live   (default)
#   mega ship X.Y.Z  release: test, bump, merge to the default branch, tag, push
#
# Only NEW claude sessions pick up a dogfood/restore — skills load at session start.
#
# Nothing here is hardcoded to one machine: both worktrees are discovered from git,
# so the two-worktree layout works under any directory names, anywhere on disk.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/megascope"

die() { echo "mega: $*" >&2; exit 1; }

git -C "$SCRIPT_DIR" rev-parse --git-dir >/dev/null 2>&1 \
  || die "not inside a git checkout of the megascope repo ($SCRIPT_DIR)"

# The branch the prod worktree is expected to sit on. Read from origin's HEAD so a
# repo whose default is `master` (or anything else) works untouched; `main` is only
# the fallback when there is no origin to ask.
default_branch() {
  local ref
  ref="$(git -C "$SCRIPT_DIR" symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null || true)"
  [ -n "$ref" ] && { echo "${ref#refs/remotes/origin/}"; return; }
  echo main
}
MAIN="$(default_branch)"

# Walk `git worktree list --porcelain` once, pairing each worktree path with its
# branch. The worktree on the default branch is prod; the first other one is dev.
PROD=''; DEV=''
_path=''
while IFS= read -r line; do
  case "$line" in
    'worktree '*) _path="${line#worktree }" ;;
    'branch '*)
      _branch="${line#branch refs/heads/}"
      if [ "$_branch" = "$MAIN" ]; then PROD="$_path"
      elif [ -z "$DEV" ]; then DEV="$_path"
      fi
      ;;
  esac
done < <(git -C "$SCRIPT_DIR" worktree list --porcelain)

SKILL_SUBDIR='skills/megascope'
# A missing worktree gets a sentinel rather than an empty string, so that an absent
# symlink can never accidentally match it below.
PROD_SKILL="${PROD:+$PROD/$SKILL_SUBDIR}"; PROD_SKILL="${PROD_SKILL:-//none}"
DEV_SKILL="${DEV:+$DEV/$SKILL_SUBDIR}";    DEV_SKILL="${DEV_SKILL:-//none}"

cmd="${1:-status}"
case "$cmd" in
  dogfood)
    [ -n "$DEV" ] || die "no dev worktree found (every worktree is on $MAIN).
  create one:  git worktree add ../${PWD##*/}-dev -b dev"
    mkdir -p "$(dirname "$DEPLOY")"
    ln -sfn "$DEV_SKILL" "$DEPLOY"
    ;;
  restore)
    [ -n "$PROD" ] || die "no worktree is on $MAIN, so there is no known-good version to restore to"
    mkdir -p "$(dirname "$DEPLOY")"
    ln -sfn "$PROD_SKILL" "$DEPLOY"
    ;;
  status) ;;
  ship)
    exec "$SCRIPT_DIR/release.sh" "${2:-}"
    ;;
  *) echo "usage: mega {dogfood|restore|status|ship <version>}" >&2; exit 2 ;;
esac

target="$(readlink "$DEPLOY" 2>/dev/null || true)"
case "$target" in
  "$DEV_SKILL")  label="DOGFOOD · dev worktree (candidate)" ;;
  "$PROD_SKILL") label="DEPLOYED · prod worktree ($MAIN, known-good)" ;;
  "")            label="MISSING · no symlink at $DEPLOY" ;;
  *)             label="OTHER · $target" ;;
esac
printf '/megascope → %s\n' "${target:-<none>}"
printf 'state: %s\n' "$label"
if [ "$cmd" != status ]; then
  echo 'reminder: open a NEW claude session to pick this up.'
fi
