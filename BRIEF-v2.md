# megascope — progressive scoping

## Before anything else

This work happens in the dev worktree, never on `main`. Confirm where you are:

    pwd                                                     # → /Users/daniel/Dev/skill-megascope-dev
    git -C ~/Dev/skill-megascope-dev branch --show-current  # → dev
    bash ~/Dev/skill-megascope/scripts/mega.sh status       # → DEPLOYED · prod worktree (main, known-good)

If `pwd` is `~/Dev/skill-megascope`, stop and say so — don't edit anything there. That checkout
stays on `main`, and `~/.claude/skills/megascope` symlinks into it, so live sessions run whatever
it holds. I'll restart the session in the dev worktree.

If `mega status` says DOGFOOD, a previous session left the flip on. Tell me — don't silently restore.

The dev worktree's CLAUDE.md — auto-loaded when the session starts there — has the reading guide
and the two-worktree rules. Follow them.

Now continue below.

## The problem

megascope works, but the experience has three faults:

1. Questions are verbose and jargon-heavy — they ask too much of the reader.
2. Questions don't carry enough context to answer on their own, yet are still too long.
   Structure should fix both at once.
3. Everything is crammed into one questionnaire — 31 questions in the current example.
   That front-loads detail before the goal is even agreed.

## What to build

**This changes the skill itself, not only its supporting files.** `SKILL.md` describes a
five-step pipeline ending in a phased build plan. Sections 2, 3, 4 and 6 below replace
that pipeline. Rewrite it — don't layer new behaviour on top of the old, or the skill
will contradict itself.

### 1. Structured questions (schema change)

Add fields to the questions-JSON so every question has the same shape: concise context,
the decision broken down as simply as possible, an optional example for genuinely
technical questions, and the question itself stated plainly.

Engine, schema, `references/writing-questions.md`, `SKILL.md` and tests all change.
Structure must be guaranteed by the format, not left to judgment each run — prose
doctrine alone is what produced the current questions.

### 2. Multiple questionnaires, scaled to complexity

Round 1 establishes the goal and what kind of work this is. Each later round takes
what's settled and scopes the next layer. Small jobs may need one round, large ones
several — scale to complexity and say which you chose.

Within a questionnaire, no question may depend on another; they must be answerable in
any order. Rounds build on each other, questions within a round don't.

Each round is a separate document, and the engine keys `localStorage` off `meta.project`.
Vary the slug per round or round 2 will silently load round 1's answers. `SKILL.md`
already hints at this with its `-followup` suffix note.

### 3. Deliverable type is a scoping decision, not a fixed output

**Don't assume the output is a phased plan with an MVP** — that is what the skill does
today, and it is what's changing. Infer from the goal and known context what kind of work
this is: a new project wanting a plan and MVP, a feature of an existing codebase, a small
experiment to learn from before committing to something formal, or something else. If the
goal doesn't make it clear, round 1 establishes it. The deliverable follows from the
answer.

### 4. A running scope panel

Each round opens with a plain-language summary of where the scope stands, so the user
sees what's settled without re-reading earlier questionnaires. Minimal jargon; whatever
is unavoidable gets explained on first use.

### 5. Never box the user in

Every question gets two escapes alongside the existing note field:

- **Other** — the user answers in their own words via the notes. The engine adds this to
  every question automatically so it can't be forgotten. Define how a selected "Other"
  appears in the copy-for-Claude export; that string is the paste-back contract and is
  what gets parsed, so it shouldn't be improvised per run.
- **Reject question** — "this doesn't make sense to me." The user should never have to
  pick an option they don't understand. On paste-back, open a dialogue: explain it more
  simply, use examples and analogies, and continue until they confirm they understand.

Keep **flag** as well, with a distinct purpose: a bookmark for the user's own workflow.
Mark a question needing minor clarification, fork a session to ask about it, carry on
answering the rest, return when the answer arrives. Consider making a flagged question
easy to copy out on its own as a standalone clarifying prompt.

### 6. Readiness checklist and the close

Define what a complete scope needs — goal, deliverable type, boundary, verification
criteria, known constraints — and loop until each is filled. Then present a scope
summary a person can read without effort. From there:

- User approves → save the scope and produce a kick-off prompt an agent can execute.
- User questions it → make it simpler, use examples and analogies, refine from their
  feedback, or run another questionnaire until they're satisfied.

The **kick-off prompt** is a new artifact: a self-contained brief that a fresh agent
session can act on with no other context — what to build, what's already decided, what's
out of scope, and how to verify it's done. This document is an example of one.

## Also in scope

From an earlier review, deliberately folded into this branch:

- **No run-time injection tool.** `SKILL.md` tells Claude to read `engine.html` (53 KB)
  and write the combined file — expensive and error-prone. `scripts/inject.mjs` already
  does this; ship it inside the skill so a run can call it.
- **Stale path.** `references/engine-data.md` points at `node tests/build-doc.mjs`, which
  exists at neither that path nor at run time.
- **No visible keyboard focus.** Option inputs are hidden at opacity 0, and the only
  focus rule paints an outline on an invisible 1px element. Tabbing shows nothing.
- **Artifact sandbox risks.** Reset uses `confirm()`, which silently no-ops in a sandboxed
  iframe; the JSON download may be blocked too. Verify in a real Artifact.
- **Weak schema guarantees.** `why` isn't required, ids aren't checked for uniqueness,
  options have no maximum. The tests check these for two fixtures; the schema doesn't.

The first three converge: one small script shipped inside the skill that validates *and*
injects closes the hand-copying, the dead command, and the unchecked cross-references
that plain JSON Schema can't express.

## Example and tests

The paperclips example can't demonstrate a multi-round loop. Write a new, smaller example
built for it — showing rounds building on each other — and **delete `examples/paperclips/`
entirely**.

Deleting it breaks live references that must be updated in the same commit:

- `CLAUDE.md` — cites `scoping.data.json` under **Read** and `scoping.html` under
  **Don't read**, plus the Layout section. That reading guide is new, so don't assume
  it's stale for other reasons.
- `README.md` — the layout tree, the "Authoring a questions-JSON" section, and the
  `build:example` script in `package.json`.
- `tests/smoke.mjs` — paperclips is one of its two cases.

Update `tests/smoke.mjs` for the new schema, and add checks for whatever the new fields
guarantee.

## Constraints

- **The engine stays data-less.** One static shell, JSON per run, never edited per run.
  Personality comes from `meta.theme`. This is the core bet — protect it.
- **`npm test` is the gate**, and it must pass before anything is promoted.
- Work in the dev worktree; never edit the skill on `main`.
- Dogfood before shipping. The tests can't tell you whether the questions got better —
  only a real run can.

## Open questions the plan must answer

- **When does research happen?** The current pipeline researches once up front, and that
  research is what makes the defaults trustworthy. With rounds, does it run once before
  round 1, or per round as each layer opens? Round 1 is goal-level and needs little;
  a later round scoping technical detail needs a lot.
- **How is a round represented in the data?** Does one file hold all rounds, or does each
  round get its own questions-JSON? This decides how the running scope panel is fed.
- **What does the readiness checklist check against?** It needs to be inspectable enough
  that the loop terminates predictably rather than on vibes.

## Start by

Proposing a plan: the schema shape you'd add, how rounds are represented in the data, your
answers to the open questions above, and what order you'd build in. Don't start editing
until the schema is agreed — everything else depends on it.
