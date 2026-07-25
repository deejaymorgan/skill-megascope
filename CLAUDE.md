# megascope — repo guide for Claude

This repo **is** the `/megascope` skill. It uses a **two-worktree workflow** so the skill can be
developed and dogfooded without disturbing the version relied on for real work. Follow it.

[README.md](README.md) covers what this file doesn't: why the engine is data-driven, the design
invariants that follow from that, and first-time setup.

## Two checkouts, one deployed
- **Prod — `~/Dev/skill-megascope`:** always on `main`. The deployed skill: `~/.claude/skills/megascope`
  is a symlink into this checkout. This is the known-good version. **Never experiment on `main`.**
- **Dev — `~/Dev/skill-megascope-dev`:** branch `dev` (or a feature branch off it). The sandbox.
  **Do all skill iteration here.** Check `pwd` to know which worktree you're in.

One git repo, two directories — the dev worktree's `.git` is a pointer file into the prod checkout's
`.git`, so history, branches and `origin` are shared. But Claude Code keys its project state (memory,
session history) to the **directory path**, so the two checkouts are two separate Claude Code
projects. Nothing carries between them except what is committed. That is why working notes belong in
tracked files, not in memory.

## Rules
1. **Open the session in the dev worktree, and iterate there.** Never edit the skill on `main`
   expecting to experiment — `main` is what live sessions run. Prod is a directory that scripts
   touch, not one to sit in: `scripts/mega.sh` uses `$HOME`-absolute paths and `git -C` takes a
   path, so promoting and restoring both work from a dev session. **Never switch branches** — each
   branch is bound to its own directory, and git will refuse.
2. **Never repoint the deployed symlink by hand.** Use `bash scripts/mega.sh {dogfood|restore|status}`
   (or `npm run dogfood|restore|deployed`). `mega status` shows which version is live.
3. **`npm test` is the gate** before promoting — run it from the dev worktree; it must pass. It covers
   the machinery (engine + schema) only, not Claude's judgment (that's what dogfooding is for).
4. **Keep `engine.html` data-less and never edited per run.** Personality comes from the questions-JSON
   `meta.theme`, never the shell. Validate every data file with
   `node skills/megascope/assets/megascope.mjs validate <file>` — it checks the schema *and* the
   cross-references the schema cannot express.

## The loop
- **Iterate:** edit in the dev worktree → `npm run dev` (live engine preview) and `npm test`. Deployed
  `/megascope` is untouched throughout.
- **Dogfood:** `npm run dogfood` → open a **new** `claude` session → use `/megascope` for real. Skills
  load at session start, so a flip only affects new sessions.
- **Ship:** happy? `git -C ~/Dev/skill-megascope merge dev && npm run restore`. Not happy?
  `npm run restore` — deployed snaps back to known-good instantly.

## Read
- **`skills/megascope/references/engine-data.md`**
  - The data format — every field and how it appears on the page.
  - Start here for anything about the questions-JSON.
- **`skills/megascope/references/rounds.md`**
  - The five scope slots, how a round is sized, and how the loop terminates.
  - Read it before changing anything about rounds, readiness, or the close.
- **`examples/reading-log/round-1.data.json`**
  - A complete example data file.
  - Read it to see the shape and quality to aim for; its siblings show the whole loop.
- **`skills/megascope/assets/engine.html`**
  - The page that renders the document.
  - Read only the part you need: the code is in the `<script>` at the bottom, and the long styling
    block above it rarely changes. Search it rather than reading top to bottom.
- **`docs/testing-the-engine.md`**
  - How to check the engine in a real browser, and what only a browser can tell you.
  - Read it **before** opening any built document: over `file://` the page's JS never runs, so the
    engine looks broken when it isn't.

## Don't read
- **Any built `.html` scoping document** (e.g. `scratch/preview.html`)
  - A script builds it by combining the engine with a data file; read the data file instead.
  - The repo deliberately ships none of these — only the engine and the data that feeds it.
- **`skills/megascope/assets/schema.json`**
  - The same format, machine-checkable.
  - Written for a program to check rather than a person to read.
