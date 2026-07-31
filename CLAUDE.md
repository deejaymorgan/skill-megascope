# megascope — repo guide for Claude

This repo **is** the `/megascope` plugin. [README.md](README.md) covers what this file doesn't: what
the skill does, how to install it, and why the engine is data-driven.
[CONTRIBUTING.md](CONTRIBUTING.md) covers the development workflow and how a release is cut.

## The invariants

These are the things a change must not break. The suite enforces the mechanical ones; the rest are
judgment.

1. **`engine.html` is data-less and never edited per run.** Personality comes from the questions-JSON
   `meta.theme`, never the shell. A run generates *only* the JSON. This is the core efficiency win and
   the thing the design exists to protect.
2. **The deployed plugin is `skills/megascope/` and nothing above it.** On install it is copied to a
   cache directory, so a command that reaches `../scripts` or `../tests` resolves to nothing at run
   time. `tests/docs.mjs` fails the build if a shipped doc names one.
3. **Every data file validates.** `node skills/megascope/assets/megascope.mjs validate <file>` checks
   the schema *and* the cross-references the schema cannot express. `build` refuses to write an
   invalid round, so a broken document cannot reach a user.
4. **The user is never boxed in.** Every question gets *in my own words* and *this doesn't make sense*
   from the engine, so a run cannot forget them. A rejection opens a dialogue; it never counts as an
   answer.
5. **Both manifests move together.** `skills/megascope/.claude-plugin/plugin.json` and `package.json`
   must carry the same version — Claude Code caches an installed plugin by version and skips the
   update when it matches, so an unbumped release ships nothing at all. `tests/manifest.mjs` catches
   this; `npm run ship` handles it for you.

## `npm test` is the gate

It covers the machinery — engine, schema, readiness, manifests — not Claude's judgment about what
makes a good question. That is what dogfooding is for. Run it before calling anything finished.

## Read

- **`skills/megascope/references/engine-data.md`**
  - The data format — every field and how it appears on the page.
  - Start here for anything about the questions-JSON.
- **`skills/megascope/references/rounds.md`**
  - The five scope slots, how a round is sized, and how the loop terminates.
  - Read it before changing anything about rounds, readiness, or the close.
- **`skills/megascope/references/artifacts.md`**
  - Where a run's artifacts live, why they are untracked by default, and what committing them costs.
  - Read it before changing `env`, the status header, or anything about where files land.
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

## Working here

- **The default branch is the release channel.** Users install from this repository, so whatever lands
  there is what they get. Develop on a branch; let `npm run ship` do the merge, the version bump and
  the tag.
- **If a two-worktree checkout is in use, iterate in the dev one.** `bash scripts/mega.sh status` says
  which version is currently deployed, and both worktrees are discovered from git rather than from any
  fixed path, so no directory layout is assumed. See [CONTRIBUTING.md](CONTRIBUTING.md). Claude Code
  keys its project state to the directory path, so two checkouts are two separate Claude Code projects
  and nothing carries between them except what is committed — which is why working notes belong in
  tracked files, not in memory.
- **Never repoint the deployed symlink by hand.** Use `bash scripts/mega.sh {dogfood|restore|status}`
  (or `npm run dogfood|restore|deployed`).

## Active scoping briefs

The pointer convention from `references/artifacts.md`, kept here because this repo runs the tool on
itself. A real run's artifacts are untracked, which is exactly why the pointer to them is not.

- [megascope's phase model](docs/scoping/megascope-phases/KICKOFF.md) — the discovery phase, grounded
  suggestions, and the gate between scope and design. Release one. **Tracked** as a worked example.
