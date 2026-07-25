# megascope

**Interactive project scoping for Claude Code.** Point it at a fuzzy request and it drives the project to an **agreed, checkable scope** — then to a kick-off brief a fresh agent session can execute. It works in **short rounds**: each one is a polished, theme-aware interactive document where every decision is pre-set to a recommended default. You review, override, reject and flag; click **Copy answers for Claude**; paste back. The next round is written from your answers.

What gets handed over is itself a scoping decision — a build plan, a feature spec, an experiment, or something else. The skill infers it, and asks if the goal doesn't make it obvious.

## The idea: one engine, data per run

The scoping document is produced by a **data-driven engine** — a single static, self-contained, theme-aware HTML shell ([`skills/megascope/assets/engine.html`](skills/megascope/assets/engine.html)) fed a per-run **questions-JSON**. Each run generates *only the JSON*; the engine is never edited. That's the efficiency win and the thing the skill protects.

The engine renders everything from data — header, intro, constraint chips, a collapsible context panel, sectioned recommendation-first question cards, live counts, sticky nav with scroll-spy, a clean **Copy answers for Claude** export, JSON download, `localStorage` persistence, and full light/dark theming — offline and CSP-safe, so the same file works as a standalone `.html` **and** as a published Artifact.

## What makes it work (preserved by design)

- **Recommendation-first, not a blank form** — every question ships pre-answered with a ★ default and a one-line *why*. You review, not author.
- **Rationale travels with every question** — the `why` names the tradeoff and often the runner-up condition.
- **Defaults are earned by research** — concrete, grounded options, not generic filler.
- **Nobody gets boxed in** — every question also offers *in my own words* and *this doesn't make sense*, added by the engine so a run can't forget them. A rejection opens a dialogue; it never counts as an answer.
- **A flag is a bookmark, not an objection** — copy a question out on its own, ask about it elsewhere, come back. The answer still stands and the round doesn't wait.
- **A clean, parseable export** closes the human→Claude loop — and is parsed back by the tool, so a later round's claims are checked against what you actually said.
- **Readiness is a check, not a self-report** — five scope slots, each settled only on evidence that resolves. The loop terminates on a tool refusal.
- **Constraints as chips** — already-decided facts are shown and therefore *not re-asked*.
- **Tasteful, subject-grounded, theme-aware craft** — personality via `meta.theme`, not by touching the shell.

## Setup

megascope runs as a personal Claude Code skill: `~/.claude/skills/megascope` is a **symlink** into this repo, so a new session loads whatever the symlink points at. First-time install:

```bash
ln -s "$PWD/skills/megascope" ~/.claude/skills/megascope
```

Skills load at session start, so open a **new** `claude` session, then invoke:

```
/megascope
```

…and describe the project you want to scope. The skill ([`skills/megascope/SKILL.md`](skills/megascope/SKILL.md)) also triggers on natural requests like "help me plan X", "turn this idea into a build plan", or "what should the first version be".

## Development workflow

The whole point: **iterate on the skill without touching the version you actually rely on.** Deployed and in-progress live in two separate git worktrees; one command flips which is live, and the known-good version is always one command away.

```
~/Dev/skill-megascope        prod worktree · always `main`   ← known-good, deployed
~/Dev/skill-megascope-dev    dev worktree  · branch `dev`    ← your sandbox
~/.claude/skills/megascope → prod worktree                   (default; flip to dev to dogfood)
```

**One-time setup** (from the prod checkout):

```bash
git worktree add ../skill-megascope-dev -b dev    # create the dev sandbox
( cd ../skill-megascope-dev && npm install )      # its own dev deps (node_modules isn't shared)
```

Add the `mega` helper so promote / revert / status are one word each (and you can always *see* which version is live):

```bash
echo 'mega() { bash "$HOME/Dev/skill-megascope/scripts/mega.sh" "$@"; }' >> ~/.zshrc
```

**The loop:**

| Step | What you do |
|---|---|
| **Iterate** | Edit in `~/Dev/skill-megascope-dev` (on `dev` or a feature branch). `npm run dev` for a live engine preview; `npm test` to check the machinery. Deployed `/megascope` is untouched the whole time. |
| **Dogfood** | `mega dogfood` → open a **new** `claude` session → use `/megascope` for real. The live skill is now your candidate. |
| **Ship** | Happy? `git -C ~/Dev/skill-megascope merge dev && mega restore`. Known-good now includes your changes. |
| **Abort** | Not happy? `mega restore`. Deployed snaps back to the known-good instantly; keep iterating in the dev worktree. |

`mega` with no argument (or `mega status`) prints which version is currently deployed. Only **new** sessions pick up a flip — skills load at session start. Equivalent npm scripts exist: `npm run dogfood` / `npm run restore` / `npm run deployed`.

> **Why two worktrees?** A plain symlink makes "dev" and "prod" the same folder, so switching branches to experiment silently changes what your next session runs. Separate checkouts make that impossible: nothing you do in the sandbox reaches the deployed skill until you deliberately `mega dogfood` or merge.

## How a run works

0. **Intake** — pin the subject, the goal, and the facts already fixed; 2–4 `AskUserQuestion` clarifications only where the answer changes what gets researched.
1. **Round 1** — the goal and what kind of work this is. Research is capped light here on purpose: a first round must not make you wait.
2. **Round-trip** — you fill it in and paste the export back. It's saved verbatim; later rounds are checked against it.
3. **Round N** — written from your answers, scoping the next layer. Research is sized off what the last paste-back actually opened. `build` refuses a round that advances nothing, asks about something settled, or leaves an open slot untargeted.
4. **Close** — when every slot is settled, `build` refuses and `ready` checks the six conditions. Then a scope summary you approve, and a **kick-off brief** a fresh session can act on with no other context.

## Repo layout

```
skill-megascope/
├── skills/megascope/                  # the skill (symlink this into ~/.claude/skills/)
│   ├── SKILL.md                       # the skill: trigger + the round loop
│   ├── assets/
│   │   ├── engine.html                # the static, data-driven shell (never edited per run)
│   │   ├── megascope.mjs              # validate · build · ready — zero deps, ships with the skill
│   │   └── schema.json                # questions-JSON JSON Schema
│   └── references/                    # playbook
│       ├── rounds.md                  #   the five slots, round sizing, the close
│       ├── engine-data.md             #   the exact data contract
│       ├── writing-questions.md       #   what the schema can't enforce
│       ├── research-fanout.md         #   per-round research patterns
│       └── theming.md                 #   subject-grounded accent + theme tokens
├── examples/reading-log/              # one worked two-round scope, request → kick-off brief
├── scripts/
│   ├── build-doc.mjs                  # inject a data.json into the shell → standalone HTML
│   ├── inject.mjs                     # the one injection operation
│   ├── dev.mjs                        # live preview: watch engine + sample data → scratch/preview.html
│   └── mega.sh                        # flip the deployed skill between the prod/dev worktrees
├── tests/
│   ├── schema.mjs                     # the schema compiles, and stays inside the walker's vocabulary
│   ├── validate.mjs                   # the invalid corpus + walker-vs-ajv differential
│   ├── ready.mjs                      # the close: R1–R6, one failure per condition
│   ├── smoke.mjs                      # headless render, export contract, round isolation
│   ├── docs.mjs                       # every documented command resolves
│   └── fixtures/
│       ├── scope/                     #   a valid two-round scope, on disk as a run leaves it
│       ├── answers/                   #   paste-backs a valid scope can't contain
│       └── mutations.mjs              #   one single mutation per guarantee
├── CLAUDE.md                          # repo workflow rules for Claude sessions
├── package.json
├── LICENSE
└── README.md
```

## Build & test

```bash
npm install            # ajv + jsdom (dev only)
npm test               # schema + invalid corpus + readiness + headless render + docs
npm run dev            # live engine preview — watch + rebuild scratch/preview.html on save
```

Build any round from its data file — this is what a run actually calls, and it **refuses to write**
an invalid round:

```bash
node skills/megascope/assets/megascope.mjs build path/to/round-1.data.json path/to/round-1.html
node skills/megascope/assets/megascope.mjs ready docs/scoping/my-project/
```

The suite covers the machinery, not Claude's judgment — that's what dogfooding is for. It asserts: the schema stays inside the vocabulary its walker implements; ~56 single-mutation invalid files each fail on their *intended* keyword or check id; the shipped walker agrees with ajv case by case; the six readiness conditions each fail for their own reason; the engine renders, isolates rounds by storage key, and writes an export the tool can parse back; and every command in the docs resolves.

## Authoring a questions-JSON

[`references/engine-data.md`](skills/megascope/references/engine-data.md) is the field-by-field contract, [`references/rounds.md`](skills/megascope/references/rounds.md) covers the five slots and the close, and [`references/writing-questions.md`](skills/megascope/references/writing-questions.md) covers what the schema can't enforce. [`examples/reading-log/`](examples/reading-log/) is a complete worked scope, from the user's original request to the kick-off brief.

## License

MIT © Daniel Morgan. See [LICENSE](LICENSE).
