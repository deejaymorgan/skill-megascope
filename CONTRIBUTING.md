# Contributing to megascope

Issues and pull requests are welcome. This file covers how to develop the plugin without breaking the
copy you rely on for real work, and how a release is cut.

## Getting set up

```bash
git clone https://github.com/deejaymorgan/skill-megascope
cd skill-megascope
npm install     # ajv + jsdom, dev only — the shipped plugin has zero dependencies
npm test
```

That is enough to change the engine, the schema or the tests. If you also want to *use* your working
copy as a live plugin, read on.

## The two-worktree workflow

The problem: the plugin you're editing and the plugin you're using are the same plugin. Change it
mid-session and your next real scoping run is the experiment.

The fix is two checkouts of one repository, and a symlink that decides which is live:

```
<prod worktree>   default branch    ← known-good; the deployed version by default
<dev worktree>    dev, or a feature branch off it   ← the sandbox
~/.claude/skills/megascope → one of the two
```

Because that symlink target contains `.claude-plugin/plugin.json`, Claude Code loads it as a
[skills-directory plugin](https://code.claude.com/docs/en/plugins-reference#skills-directory-plugins) —
discovered in place, not copied to the plugin cache. So a flip takes effect with no install step, and
your edits are live in the next session with nothing to rebuild.

**One-time setup**, from your clone:

```bash
git worktree add ../skill-megascope-dev -b dev
( cd ../skill-megascope-dev && npm install )      # node_modules isn't shared between worktrees
bash scripts/mega.sh restore                      # deploy the known-good version
```

Optionally, add the helper so each operation is one word:

```bash
echo 'mega() { bash "$HOME/path/to/skill-megascope/scripts/mega.sh" "$@"; }' >> ~/.zshrc
```

`mega` takes no fixed paths of its own — it finds both worktrees with `git worktree list`, so any
directory names anywhere on disk work, and it reads the default branch from `origin` rather than
assuming `main`.

**The loop:**

| Step | What you do |
|---|---|
| **Iterate** | Edit in the dev worktree. `npm run dev` for a live engine preview; `npm test` to check the machinery. The deployed plugin is untouched the whole time. |
| **Dogfood** | `mega dogfood` → open a **new** `claude` session → use `/megascope` for real. Plugins load at session start, so only new sessions see the flip. |
| **Abort** | `mega restore`. The deployed plugin snaps back to known-good instantly; keep iterating in the dev worktree. |
| **Ship** | `mega ship 0.2.0` — see below. |

Each branch is bound to its own worktree directory, so don't try to switch branches inside one; git
will refuse.

## Cutting a release

Publishing is a push. Users install from this repository, so whatever lands on the default branch is
what they get on `/plugin marketplace update`.

```bash
mega ship 0.2.0        # or: npm run ship 0.2.0
```

That runs the whole sequence, refusing at the first thing that isn't right:

1. `npm test` must be green, and the working tree clean
2. bumps `version` in **both** `plugin.json` and `package.json`, and commits
3. fast-forward merges your branch into the default branch
4. tags `v0.2.0` and pushes with `--follow-tags`
5. restores the deployed symlink to the known-good version

**Why the bump is not optional.** Claude Code caches an installed plugin at
`plugins/cache/<marketplace>/<plugin>/<version>/` and resolves the version from `plugin.json` first.
`/plugin update` skips a plugin whose resolved version already matches what is cached — so pushing
without a bump leaves every existing user on the old code, with no error on either side. That is why
`tests/manifest.mjs` fails when the two manifests disagree, and why the release script does the bump
rather than trusting anyone to remember it.

After a release, users get it with:

```
/plugin marketplace update skill-megascope
/plugin update megascope
```

## Testing

`npm test` runs six suites, and covers the machinery only — not Claude's judgment about what makes a
good question. That is what dogfooding is for.

| Suite | What it asserts |
|---|---|
| `tests/schema.mjs` | the schema compiles, and stays inside the vocabulary its walker implements |
| `tests/validate.mjs` | ~56 single-mutation invalid files each fail on their *intended* keyword or check id, and the shipped walker agrees with ajv case by case |
| `tests/ready.mjs` | the six readiness conditions each fail for their own reason |
| `tests/smoke.mjs` | the engine renders headless, isolates rounds by storage key, and writes an export the tool can parse back |
| `tests/docs.mjs` | every command in the docs resolves, and no shipped command reaches outside the deployed plugin directory |
| `tests/manifest.mjs` | the plugin ships, at the version it claims |

Changing the engine's *appearance* needs a real browser — headless rendering will not tell you that a
contrast ratio is wrong or that a breakpoint drops a gutter. See
[docs/testing-the-engine.md](docs/testing-the-engine.md), and read it **before** opening a built
document: over `file://` the page's JS never runs, so the engine looks broken when it isn't.

## The README images

`docs/images/` is generated, not curated. If you change the engine's appearance, regenerate it:

```bash
npm i --no-save playwright     # not a dependency: a heavy install only this script needs
npm run screenshot
```

That builds round 1 of the worked example through the shipped tool, serves it, and captures two frames
in light and dark — refusing to write anything if the page logs an error or renders the wrong number of
cards, so a broken engine can't quietly become the picture at the top of the README. The four files are
wired in as `<picture>` elements, so they follow the reader's own GitHub theme.

## Conventions

- **Never edit `engine.html` to change how one run looks.** Personality arrives through the
  questions-JSON `meta.theme`. If you want to change the shell for a run, the answer is in the data.
- **Anything the plugin needs lives inside `skills/megascope/`.** On install that directory is copied
  to a cache location; a reference to `../scripts` resolves to nothing at run time.
- **Validate data files** with `node skills/megascope/assets/megascope.mjs validate <file>` — it checks
  the schema *and* the cross-references the schema cannot express.
- Working notes belong in tracked files, not in session memory: the two worktrees are two separate
  Claude Code projects and nothing carries between them except what is committed.
