# megascope

**Interactive project scoping for Claude Code.** Point it at a fuzzy request and it drives the project to an agreed **phased plan with a detailed MVP** — by (1) clarifying up front, (2) researching in parallel, and (3) handing you a **polished, theme-aware interactive scoping document** where every decision is pre-set to a recommended default. You review, override, and flag; click **Copy answers for Claude**; paste back. Claude resolves follow-ups and delivers the plan.

It's general-purpose but build-optimized: strong defaults for technical and software builds (research fan-out, phased plans, a crisp MVP boundary).

## The idea: one engine, data per run

The scoping document is produced by a **data-driven engine** — a single static, self-contained, theme-aware HTML shell ([`skills/megascope/assets/engine.html`](skills/megascope/assets/engine.html)) fed a per-run **questions-JSON**. Each run generates *only the JSON*; the engine is never edited. That's the efficiency win and the thing the skill protects.

The engine renders everything from data — header, intro, constraint chips, a collapsible context panel, sectioned recommendation-first question cards, live counts, sticky nav with scroll-spy, a clean **Copy answers for Claude** export, JSON download, `localStorage` persistence, and full light/dark theming — offline and CSP-safe, so the same file works as a standalone `.html` **and** as a published Artifact.

## What makes it work (preserved by design)

- **Recommendation-first, not a blank form** — every question ships pre-answered with a ★ default and a one-line *why*. You review, not author.
- **Rationale travels with every question** — the `why` names the tradeoff and often the runner-up condition.
- **Defaults are earned by research** — concrete, grounded options, not generic filler.
- **One-click disagreement** — change / note / **flag-for-follow-up** / reviewed per question; a flag means "let's talk," so the round-trip never stalls.
- **A clean, parseable export** closes the human→Claude loop reliably.
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

…and describe the project you want to scope. The skill ([`skills/megascope/SKILL.md`](skills/megascope/SKILL.md)) also triggers on natural requests like "help me plan X", "turn this idea into a build plan", or "what should the MVP be".

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

0. **Intake & clarify** — pin the subject/goal/constraints; ask 2–4 high-leverage `AskUserQuestion` clarifications only where they change research direction.
1. **Research fan-out** — a `Workflow` of parallel researchers → a synthesis pass producing a master dossier, a decision-oriented open-questions list, and a proposed phase plan (auto-scaled to complexity; degrades to parallel agents or inline research).
2. **Build the doc** — transform the synthesis into the questions-JSON, inject it into the engine, save the HTML, and publish it as an Artifact.
3. **Round-trip** — you fill it in and paste the export back.
4. **Follow-up loop** — Claude resolves flagged/ambiguous items.
5. **Deliver** — a phased build plan + detailed Phase-1/MVP requirements.

## Repo layout

```
skill-megascope/
├── skills/megascope/                  # the skill (symlink this into ~/.claude/skills/)
│   ├── SKILL.md                       # the skill: trigger + the pipeline
│   ├── assets/
│   │   ├── engine.html                # the static, data-driven shell (never edited per run)
│   │   └── schema.json                # questions-JSON JSON Schema
│   └── references/                    # playbook
│       ├── engine-data.md             #   the exact data contract
│       ├── writing-questions.md       #   recommendation-first question doctrine
│       ├── research-fanout.md         #   workflow patterns, dossier → synthesis
│       └── theming.md                 #   subject-grounded accent + theme tokens
├── examples/paperclips/               # one full worked example
│   ├── request.md                     #   the fuzzy input request
│   ├── scoping.data.json              #   the generated questions-JSON (the real per-run artifact)
│   └── scoping.html                   #   engine + injected data (what gets published)
├── scripts/
│   ├── build-doc.mjs                  # inject a data.json into the shell → standalone HTML
│   ├── inject.mjs                     # the one injection operation
│   ├── dev.mjs                        # live preview: watch engine + sample data → scratch/preview.html
│   └── mega.sh                        # flip the deployed skill between the prod/dev worktrees
├── tests/
│   ├── smoke.mjs                      # schema-validate + headless render + round-trip assertions
│   └── fixtures/minimal.data.json     # a tiny second case (incl. a multi-select question)
├── CLAUDE.md                          # repo workflow rules for Claude sessions
├── package.json
├── LICENSE
└── README.md
```

## Build & test

```bash
npm install            # ajv + jsdom (dev only)
npm test               # validate schema + render both cases headless + assert invariants
npm run dev            # live engine preview — watch + rebuild scratch/preview.html on save
npm run build:example  # rebuild examples/paperclips/scoping.html from its data
```

Build any scoping doc from a data file:

```bash
node scripts/build-doc.mjs path/to/scoping.data.json path/to/scoping.html
```

The smoke test asserts, for both the paperclips example and the minimal fixture: schema validity, zero render errors, correct card count, **every default pre-selected to its recommendation**, correct live counts, and a clean export round-trip.

## Authoring a questions-JSON

See [`skills/megascope/assets/schema.json`](skills/megascope/assets/schema.json) for the contract, [`references/engine-data.md`](skills/megascope/references/engine-data.md) for how each field renders, and [`references/writing-questions.md`](skills/megascope/references/writing-questions.md) for how to write questions that are worth pre-answering. [`examples/paperclips/scoping.data.json`](examples/paperclips/scoping.data.json) is a complete, real example.

## License

MIT © Daniel Morgan. See [LICENSE](LICENSE).
