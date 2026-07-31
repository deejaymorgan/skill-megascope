# Rounds, slots, and the close

The old shape was one questionnaire of 31 questions, which front-loaded every detail before the
goal was even agreed. Rounds fix that: each one asks about a layer, and the next is written from
what came back.

## The five slots

`meta.scope` is an array of exactly five entries, always in this order. It does three jobs at
once — it is the running summary the user reads, the readiness checklist, and the thing every
question must point at.

| Slot | The question it answers |
|---|---|
| `goal` | What are we trying to achieve? |
| `deliverable` | What do we hand over, and what kind of work is this? |
| `boundary` | What's in, and what's explicitly out? |
| `verification` | How do we know it's done? |
| `constraints` | What fixed facts do we work inside? |

Each carries `state` (`settled` / `open`), plain-language `text` (25–240 characters — a real
sentence, not "ok"), and `evidence`: which answers earned it, as `r<n>:<qid>` or `r<n>:notes`.

**Evidence is checked, not trusted.** `validate` resolves every reference against the saved
paste-back on disk. A reference to a question that came back `REJECTED`, or that isn't in the
file at all, fails the build. This is the whole reason readiness is a check rather than a
self-report — the agent writing "settled" is the same agent writing the evidence for it.

### The deliverable is data

`deliverable` carries a `kind` once settled:

| `kind` | When |
|---|---|
| `new-project-plan` | something new; the hand-over is a plan to build it (a first-version boundary is one shape this takes) |
| `codebase-feature` | a feature inside an existing codebase |
| `experiment` | a small thing to learn from before committing to anything formal |
| `other` | anything else — then `kindOther` says what, in 20–120 characters |

Infer it from the goal. If the goal doesn't make it obvious, round 1 asks.

### Settling a slot you haven't asked about

Round 1 targets `goal` and `deliverable`. The other three still have to say something, and the
honest thing at that point is usually an assumption: `assumed: true` plus a written `assumption`,
with empty `evidence`. Say so in the round's lede.

A later round then **reopens** what it can now ask about properly: set `state: "open"` and give a
`reopened` reason. That is a normal, expected move, not a failure — you could not have asked about
`verification` before you knew what the thing was for.

`assumed` is also the escape hatch for a question rejected twice. Do not re-ask a third time:
settle it by assumption, say so out loud, and it appears under **"Decided by assumption, not
agreement"** in the kick-off brief. What it replaces is a slot quietly settled on nothing.

## Sizing a round

Hard caps, enforced by the schema: **8 questions, 4 sections, 4 options per question.**

The caps are the point. If a round doesn't fit, split it — do not compress the writing, which is
how you get a 186-character option label. Within a round, **no question may depend on another**:
they must be answerable in any order. Rounds build on each other; questions inside a round don't.

Doctrine stops at **4 rounds**. If the scope still isn't closed by then, stop writing rounds:
finish it in conversation and settle what's left by assumption. The schema allows up to 6 so an
honest fifth round isn't illegal, but reaching for it usually means the questions were wrong.

`build` enforces the loop's shape and refuses otherwise:

- every question targets a slot that is **open** — you cannot ask about something you declared settled
- every open slot is targeted by **at least one** question — together, exact cover
- **at least one** slot is open — otherwise the scope is complete and you owe a kick-off brief
- versus the previous round, **at least one** slot moved open → settled, and nothing regressed
  without a `reopened` reason

## Research per round

Round 1 is capped at `none` or `light` — up to 3 parallel readers, no synthesis agent, no dossier.
It must not make the user wait; that is the point of splitting rounds.

From round 2, size research off what the previous export actually opened, and record those triggers
in `research.trigger[]`: an open slot, a `REJECTED` id, an `OWN` answer, a note. One researcher per
planned `technical: true` question plus one per unresolved rejection, capped at 8; a dedicated
synthesis agent above 5. `mode: "deep"` must name at least 3 `sources`.

**Stop rule.** Research for a round stops when every planned question has a `why` you could defend
in under 200 characters and a `switchIf` naming a real condition. If you can't write those two
sentences, that is the thing to go and find out. If you still can't, the question isn't ready and
its slot stays open.

## Jargon

Identifier-shaped terms — `ALLCAPS`, `camelCase`, `dotted.names` — are allowed in exactly two
fields: a question's `example` and an option's `detail`. Everywhere else they are a build failure.
Where they do appear, each needs a `meta.glossary` entry, and every glossary entry must be used.

This is deliberately the inverse of a backtick lint. On the corpus that motivated the rewrite, a
backtick check scored 0 of 31 — none of its 18 unexplained acronyms was backticked, and making
backticks the one thing that hard-fails a build only teaches you to stop typing them.

## The close

`node assets/megascope.mjs ready docs/scoping/<project>/` exits 0 only when all six hold:

| | |
|---|---|
| **R1** | all five slots `settled` |
| **R2** | each slot's `text` is a real sentence |
| **R3** | each rests on evidence that resolves, or on a written assumption |
| **R4** | `deliverable` names a `kind` (and `kindOther` when it is `other`) |
| **R5** | nothing in the latest paste-back is still `REJECTED` |
| **R6** | every round has its saved `round-N.answers.md` |

Exit 1 names the first unmet condition and its slot. **That message is the spec for what to do
next** — it distinguishes a slot that was asked about and left unresolved from one no round has
reached.

It also reprints the rows from `env`: where the directory sits, whether the repository is public,
whether the artifacts are ignored, tracked or loose, and whether this repository already scopes
somewhere else. Those are advisory
and never move the exit code — see `artifacts.md`. They are here because the close is the moment a
scope stops being working notes and starts being something someone wants to share.

Before running it, update the final round's data file in place: set the slots its answers settled,
`evidence` citing that round. Don't bump `revision` — the questions didn't change, the scope did.

### A closed round file is deliberately not buildable

That update is one-way. Once it lands, `build` refuses the file: every slot is settled, so S8 fires
and points at the kick-off prompt. **That refusal is the terminator working, not a fault to fix.**
The round's page was built and answered *before* the update; the file now records the scope those
answers produced, not the questions it asked. `validate` still passes, and has to — the record of
an agreed scope cannot itself be malformed. `examples/reading-log/round-2.data.json` is a real
example sitting in exactly this state.

S6 and S7 stop applying at the same moment and for the same reason. On a closed round every
question targets a slot that is now settled, because the answers to those very questions are what
settled it — and cite it as evidence. Left switched on, S6 reports one fault per question that the
file does not have, and buries the one line that says what to do next. The signal for both is
`round-N.answers.md` on disk for this round's own N: the same signal S13 uses to let a slot cite
its own round.

## `SCOPE.md` and the kick-off brief

`SCOPE.md` is the record: the five slots with their text verbatim, their evidence, and the rounds
that produced them.

`KICKOFF.md` is the deliverable — a brief a **fresh agent session can act on with nothing else**.
No "as we discussed", no references to this conversation. It holds:

1. **What to build** — the goal and the deliverable kind, in plain language.
2. **What's already decided** — every settled slot, and the constraints, as fixed facts.
3. **What's out of scope** — explicitly, from the boundary slot. As useful as what's in.
4. **How to verify it's done** — from the verification slot, concrete enough to check.
5. **Decided by assumption, not agreement** — every `assumed: true` slot with its assumption. A
   fresh session needs to know which ground is firm and which is inferred.
6. **Where this came from** — the scope directory, so the rounds and answers can be re-read. Give
   the path as it exists on the machine that ran the scope; by default that directory is untracked,
   so a reader who cloned the repository will not have it.

Write it in the reader's language, not the scoping document's. If someone would have to open a
round file to understand a line in it, that line isn't finished.

Both files open with a title and then a `**Tracking:**` line, so a session that opens one learns
its status from the file rather than from the directory. And because untracked files are invisible
to git, the close adds one pointer line under `## Active scoping briefs` in the repository's
`CLAUDE.md`. `artifacts.md` has both formats, and what a request to commit either file costs.
