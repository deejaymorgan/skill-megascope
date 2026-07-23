# megascope — repo guide for Claude

This repo **is** the `/megascope` skill. It uses a **two-worktree workflow** so the skill can be
developed and dogfooded without disturbing the version relied on for real work. Follow it.

## Two checkouts, one deployed
- **Prod — `~/Dev/skill-megascope`:** always on `main`. The deployed skill: `~/.claude/skills/megascope`
  is a symlink into this checkout. This is the known-good version. **Never experiment on `main`.**
- **Dev — `~/Dev/skill-megascope-dev`:** branch `dev` (or a feature branch off it). The sandbox.
  **Do all skill iteration here.** Check `pwd` to know which worktree you're in.

## Rules
1. **Iterate in the dev worktree.** Never edit the skill on `main` expecting to experiment — `main` is
   what live sessions run.
2. **Never repoint the deployed symlink by hand.** Use `bash scripts/mega.sh {dogfood|restore|status}`
   (or `npm run dogfood|restore|deployed`). `mega status` shows which version is live.
3. **`npm test` is the gate** before promoting — run it from the dev worktree; it must pass. It covers
   the machinery (engine + schema) only, not Claude's judgment (that's what dogfooding is for).
4. **Keep `engine.html` data-less and never edited per run.** Personality comes from the questions-JSON
   `meta.theme`, never the shell. Validate every data file against `skills/megascope/assets/schema.json`.

## The loop
- **Iterate:** edit in the dev worktree → `npm run dev` (live engine preview) and `npm test`. Deployed
  `/megascope` is untouched throughout.
- **Dogfood:** `npm run dogfood` → open a **new** `claude` session → use `/megascope` for real. Skills
  load at session start, so a flip only affects new sessions.
- **Ship:** happy? `git -C ~/Dev/skill-megascope merge dev && npm run restore`. Not happy?
  `npm run restore` — deployed snaps back to known-good instantly.

## Layout
`skills/megascope/` — the skill (`SKILL.md`, `assets/{engine.html,schema.json}`, `references/`).
`scripts/` — dev helpers (`build-doc.mjs`, `inject.mjs`, `dev.mjs`, `mega.sh`).
`tests/` — machinery tests. `examples/paperclips/` — worked example. Full detail in [README.md](README.md).
