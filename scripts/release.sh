#!/usr/bin/env bash
# release.sh — publish a new version of the megascope plugin. Invoked as `mega ship X.Y.Z`.
#
# Publishing is a push: users install from this repository, so whatever lands on the
# default branch is what they get on `/plugin marketplace update`.
#
# The one failure this exists to prevent: Claude Code caches an installed plugin at
# plugins/cache/<marketplace>/<plugin>/<version>/ and skips the update when the
# resolved version already matches. Push without bumping `version` in plugin.json and
# users silently stay on the old code — no error, anywhere. So the bump is not a step
# you remember, it is a step the tool performs.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
PLUGIN_JSON="$REPO/skills/megascope/.claude-plugin/plugin.json"
PKG_JSON="$REPO/package.json"

die() { echo "release: $*" >&2; exit 1; }
step() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }

VERSION="${1:-}"
[ -n "$VERSION" ] || die "usage: mega ship <version>   e.g. mega ship 0.2.0"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version must be X.Y.Z, got '$VERSION'"

CURRENT="$(node -p "require('$PLUGIN_JSON').version")"
[ "$VERSION" != "$CURRENT" ] || die "version $VERSION is already published — users on $CURRENT would get nothing"

BRANCH="$(git -C "$REPO" branch --show-current)"
MAIN_REF="$(git -C "$REPO" symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null || true)"
MAIN="${MAIN_REF#refs/remotes/origin/}"; MAIN="${MAIN:-main}"
[ "$BRANCH" != "$MAIN" ] || die "run this from the dev worktree, not $MAIN — $MAIN is what gets published"

git -C "$REPO" diff --quiet && git -C "$REPO" diff --cached --quiet \
  || die "working tree is dirty — commit or stash first"

step "Gate: npm test"
( cd "$REPO" && npm test >/dev/null ) || die "tests fail — nothing ships red"
echo "  ✓ suite green"

step "Bump $CURRENT → $VERSION"
node -e '
  const fs = require("fs");
  for (const [p, v] of [["'"$PLUGIN_JSON"'", "'"$VERSION"'"], ["'"$PKG_JSON"'", "'"$VERSION"'"]]) {
    const raw = fs.readFileSync(p, "utf8");
    const bumped = raw.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${v}"`);
    if (bumped === raw) { console.error(`no version field in ${p}`); process.exit(1); }
    fs.writeFileSync(p, bumped);
  }
'
# The lockfile carries the version too, and CI runs `npm ci`, which refuses a lockfile
# that disagrees with package.json.
( cd "$REPO" && npm install --package-lock-only --silent )
echo "  ✓ plugin.json, package.json and the lockfile all at $VERSION"

git -C "$REPO" commit -aqm "Release v$VERSION"

step "Merge $BRANCH → $MAIN"
PROD="$(git -C "$REPO" worktree list --porcelain \
  | awk -v m="branch refs/heads/$MAIN" '/^worktree /{p=substr($0,10)} $0==m{print p; exit}')"
[ -n "$PROD" ] || die "no worktree is on $MAIN — cannot publish without one"
git -C "$PROD" merge --ff-only "$BRANCH" -q || die "$MAIN has diverged — merge it into $BRANCH first"

step "Tag and push"
git -C "$PROD" tag "v$VERSION"
for attempt in 1 2 3 4; do
  if git -C "$PROD" push -u origin "$MAIN" --follow-tags; then break; fi
  [ "$attempt" -lt 4 ] || die "push failed after 4 attempts"
  sleep $((2 ** attempt))
done

step "Restore the deployed symlink to $MAIN"
bash "$SCRIPT_DIR/mega.sh" restore

cat <<EOF

Released v$VERSION.

  Users get it with:  /plugin marketplace update skill-megascope
                      /plugin update megascope
EOF
