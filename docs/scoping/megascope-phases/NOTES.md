# megascope-phases — working notes

**Tracking:** committed deliberately — a worked example of the tool on itself, sanitised 2026-07-31.
Public repository.

Running record for the scope of **megascope's own phase model**: a discovery phase of open
questions, suggestions reframed as grounded rather than guessed, and a gate between scope and
design. Written so a fresh session can continue with nothing but this directory.

Started 2026-07-30, closed 2026-07-30. Branch `dev`, pushed to `origin/dev`. `main` is untouched —
this is scoping work, not a release.

## Where this is up to

**The scope is closed.** Three rounds, 16 questions, none rejected. `ready` exits 0 on all six
conditions. [SCOPE.md](SCOPE.md) is the record and [KICKOFF.md](KICKOFF.md) is the deliverable.

| | |
|---|---|
| Round 1 | built, answered, `round-1.answers.md` saved verbatim |
| Round 2 | built, answered, `round-2.answers.md` saved verbatim |
| Round 3 | built, answered, `round-3.answers.md` saved verbatim; slots updated in place |
| Close | `SCOPE.md` + `KICKOFF.md` written; brief gate-tested (below) |

The two questions the gate test raised have been answered and folded in: a ground-opening question
carries **no options, free text only**, and ***Reviewed* alone does not release an unanswered open
question**. Both are recorded in `SCOPE.md` under decisions taken in conversation, and in
`KICKOFF.md` §1.1, §1.2 and section 6.

The three implementation choices have since been decided too, and are written up as **C**, **D** and
**E** in `KICKOFF.md` section 6: discovery is **round 0**; the two question kinds are told apart by an
explicit **`openEnded`** flag rather than by a missing `rec`; and `why`/`switchIf` are **dropped**
rather than replaced on an open question.

Checking the round-0 decision turned up one thing no earlier pass had: `megascope.mjs:480` guards the
previous-round chain on `round.n > 1`, so round 1 would never be checked against round 0's answers.
That guard needs widening to `> 0`. The one at `:615` (S9) has the same shape and should be left
alone — a round 1 that settles nothing after discovery is legitimate.

**Release one is ready to build.** Nothing is waiting on Daniel.

`build` now refuses `round-3.data.json` with S8 — every slot is settled and its answers are on disk,
so the file is the record of a finished scope rather than a round to ask. That refusal is the
terminator working. `validate` still passes, and has to.

Published pages (rounds 1–3) — the artifacts are private to Daniel's account:

- <https://claude.ai/code/artifact/926b7739-fcda-43eb-9734-466ec008d586>
- <https://claude.ai/code/artifact/b170a9a8-c55e-489d-99c5-69e74a05c10f>
- <https://claude.ai/code/artifact/fb2e955b-b98e-4b1a-b90f-fefea4416e17>

## The five slots as they stand

Authoritative version is `meta.scope` in `round-3.data.json`. Summarised:

- **goal** — settled (`r1:Q1`, `r1:Q2`, `r1:Q3`). Stop a run answering before it has listened.
- **deliverable** — settled (`r1:Q4`, `r1:Q5`, `r1:Q6`), kind `codebase-feature`. Two releases in
  one tool: open page + suggestion change first, then the gate + design loop.
- **boundary** — settled (`r2:Q1`, `r2:Q2`, `r2:Q3`). Design always produces an artifact; the page
  blocks its own export; chat questions stay but stay obvious.
- **verification** — settled (`r3:Q1`, `r3:Q2`, `r3:Q3`, `r3:Q4`). Carried as an assumption through
  rounds 1 and 2, then reopened and asked about properly in round 3 — the `reopened` reason is still
  on the slot. Each release finishes on its own; the listening half has no explicit test.
- **constraints** — settled (`r2:Q4`, `r2:Q5`, `r2:Q6`). Held-back work becomes the next scope; the
  done-test follows the kind of work; the hand-off names no model and no effort level.

### What round 2's answers actually decided

Three of six came back in the user's own words, and each superseded the options rather than picking
one. The wording matters, so it is recorded here rather than paraphrased away:

1. **Q1 — the skip test moved.** The recommendation was the published one-sentence-diff test *before*
   design. His words: *"produce the design artifact. make a jusgement call. if its small and simple,
   give the user a choice is further refinement needed or should we go ahead and build… If its clearly
   not small and simple then skip the option and go straight to further refinement."* So the design
   artifact is **always** produced, and the judgment call happens **after** it exists — deciding only
   whether the user is *offered* the shortcut. It is explicitly a judgment call, not a checkable test:
   the one-sentence rule survives as guidance for that judgment, not as a gate.
2. **Q2 — the export fault is fixed, but not the way the option said.** Option (a) was to teach the
   export to distinguish untouched from agreed. His words: *"validate the form and prevent the json
   download or copy answers if all questions are not answered/reviewed."* Stronger: the page
   **refuses to export at all** until every question is answered or reviewed, so the tag vocabulary
   never has to express silence. This makes the review toggle load-bearing — reviewing a pre-filled
   pick is how a user clears it. Engine work, and `tests/smoke.mjs` can hold it (see below).
3. **Q3 — option (c), with a constraint attached.** Chat questions before the page **stay**, against
   the recommendation, but *"any questions that are presented to the user this way… should be simple
   enough to not require any clarification. So they should be non-technical and obvious."*

Q4 changed to (c): held-back work **becomes the next scope**, not a hand-off section. Q5 took the
default (c): done-test keyed to the kind of work. Q6 changed to (a): the hand-off **says nothing**
about model or effort — so the round-2 research on model selection informs *us*, and deliberately
does not reach the hand-off.

## Decisions taken in conversation, not in any answers file

These are load-bearing and are **not** recoverable from the round files:

1. **Four round 1 answers were banked on Daniel's explicit say-so.** Q2, Q3, Q4 and Q5 came back
   tagged `DEFAULT` but the export's own counter said `2/6 answered` — they were never opened.
   Asked directly; he chose "they stand — bank them." That is why `round-2.data.json` cites them as
   evidence. **The evidence chain for goal and deliverable rests on a chat confirmation, not on the
   saved paste-back.** If that ever needs re-deriving, it is not in the file.
2. **Four framing answers** from intake, now `meta.constraints` on both rounds: discovery is a
   round-zero open-question page; two kinds of question (narrowing pre-answered, ground-opening
   open); scope ends at the gate with design entered fresh; design gets its own rounds.
3. **Round 1's primary failure changed** from "it answers before it has listened" to **"you are
   cast as a reviewer"** — posture, not pre-filling. Everything downstream follows from that.

## The engine fault behind question Q2

Round 1's own export surfaced a real bug, and it is the mechanism behind the posture complaint.

`isAnswered` is `!!s.rev && !s.rej` (`skills/megascope/assets/engine.html:1229`). `rev` starts
`false` with the recommendation already selected (`:1105`), and is only set by an explicit
interaction — picking an option (`:1323`), typing a note (`:1333`) or own words (`:1337`), flagging
(`:1349`), or the review toggle (`:1357`).

So a question left completely alone still exports as `[DEFAULT]`, which `skills/megascope/SKILL.md:98`
defines as "took the recommendation → nothing — silent." **The tag vocabulary cannot distinguish
agreement from silence, and doctrine says bank it silently.** Round 2 Q2 asked whether to fix this in
release one. It does — and the answer went further than the recommendation: rather than teaching the
export to distinguish untouched from agreed, the page refuses to release answers at all until every
question is resolved, so the tag vocabulary never has to express silence.

## Research already done — do not redo it

`round-2.data.json` `meta.research.sources` has the citations. What they actually said, and what it
implies for this design:

- **The gate is documented practice.** "Once the spec is complete, start a fresh session to execute
  it. The new session has clean context focused entirely on implementation." Context is named as the
  governing constraint. → validates the gate outright.
  <https://code.claude.com/docs/en/best-practices>
- **A good brief is "self-contained: names the files and interfaces involved, states what is out of
  scope, and ends with an end-to-end verification step."** → maps onto deliverable / boundary /
  verification almost one-to-one. Same page.
- **Discovery is an interview.** "Have Claude interview you first… using the `AskUserQuestion`
  tool… then write a complete spec." Plus a prioritisation rule megascope currently lacks: *ask the
  questions whose answers would change the architecture first*, one at a time, and run a
  "blind spot pass" for unknown unknowns.
  <https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns>
- **There is a skip test for design depth.** "If you could describe the diff in one sentence, skip
  the plan." Planning earns its overhead on uncertainty, breadth across files, or unfamiliar code.
  → this is Daniel's complexity rule made checkable; it is round 2 Q1 option (a).
- **Do not ask an agent to verify.** Opus 5 self-verifies; explicit verification instructions cause
  over-checking with no quality gain — *remove* them. But do give it a check it can run. → the
  verification slot must carry a **runnable check**, never an instruction to double-check. Round 2
  Q5. Same page also: Opus 5 expands scope unless bounded (so `boundary` is load-bearing) and
  over-delegates to subagents unless capped.
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5>
- **Model selection.** Opus 5 (`claude-opus-5`, $5/$25 per MTok) for both phases — it "performs best
  given the complete task specification up front and left to run." Fable 5 (`claude-fable-5`,
  $10/$50) only when the problem is genuinely unsolved or the domain unfamiliar; its turns run
  minutes long. Effort: default `high`, `xhigh` for demanding implementation, and `low`/`medium` are
  unusually strong on Opus 5 — sweep down. Round 2 Q6 asked whether the hand-off names any of this.
  It does not: the hand-off says nothing about model or effort, so this research informs whoever does
  the work and deliberately never reaches the brief.

## Round 3 research — local, and cheap to re-verify

`mode: light`. Only the repository was read; the published guidance from round 2 was **not** re-read.

- **The engine is already testable headlessly.** `tests/smoke.mjs` injects a data file into the shell
  and renders it under `jsdom`, then drives all four answer states and round-trips the export
  (`tests/smoke.mjs:190`, `:224`). So Q2's export block is a check the existing suite can hold — that
  is what makes round 3's Q2 an honest question rather than a wish.
- **`npm test` is seven node scripts**, none of which touch a real browser. A simulated browser is not
  a real one; layout still needs `docs/testing-the-engine.md`.
- **`ready` is the nearest thing to a done-test the repo has**, and it checks the *record* — five
  slots settled, evidenced, real sentences — not whether a stranger could act on the brief. That gap
  is exactly what round 3's Q4 asks about.

## The brief was gate-tested against its own done-test

`r3:Q4` settled that the hand-off is proved when **a fresh session acts on it unaided**, so that test
was run rather than asserted. Four fresh readers were given `KICKOFF.md` and the code, and explicitly
forbidden from reading anything else in this directory.

**Three of four could start with zero blocking questions.** The fourth — a skeptic hunting for
decisions the brief only appeared to have made — could not, and was right. It found two genuine
collisions, both since answered by Daniel and folded into the brief:

1. **Does an open question carry options at all?** The brief pointed both ways. → **No: free text
   only.** This is why every answered discovery question is tagged `OWN`, and why the four-tag
   contract survives untouched.
2. **Does a bare *Reviewed* tick release an unanswered open question?** `resolved = rev || rej` plus
   "no fifth export tag" together let an open question ticked *Reviewed* with nothing selected export
   as `[DEFAULT]` with an empty payload — which `EVIDENTIAL` accepts as evidence. → **No:** `resolved`
   is kind-dependent, and an open question needs a real answer or a rejection.

The same pass found ~20 factual errors in the first draft, all now fixed and independently re-checked.
The ones worth remembering as traps:

- **`stateOf`'s return value IS the export tag** (printed raw at `engine.html:1472`, tallied against a
  four-key object at `:1446`/`:1448`). The first draft asked for "a fifth reading in `stateOf`" while
  also banning a fifth tag — a straight contradiction that would have shipped `[OPEN]` lines the
  parser drops and a `NaN` summary.
- **`flag-toggle` sets `rev = true`** (`engine.html:1349`), so flagging *resolves* a question. The
  gate therefore does not make "read but not agreed" unrepresentable, only "untouched".
- **`schema.json:339` and `:375` are byte-identical `"minItems": 2` lines** for `breakdown` and
  `options`. Citing the wrong one is self-camouflaging — you open it and see what you expected.
- **`tests/schema.mjs:101` pins `why` into `question.required`.** Making `why` conditional turns it
  red; it is a deliberate pin, not an accident.
- **Only `S9` needs a discovery exemption**, and it already has one (`megascope.mjs:615` guards on
  `round.n > 1`). Exact cover (`S6`/`S7`) applies to a discovery round and must not be weakened.
- **`npm run dogfood` runs nothing** — it repoints a symlink and prints a reminder. The real run needs
  a new session, because skills load at session start.

Also worth noting: the first draft of `KICKOFF.md` **failed `npm test`** by quoting a command as
`node` plus a bare `assets/…` path — which only resolves inside the deployed skill, the exact
invariant the brief itself warns about. `tests/docs.mjs` walks every markdown file in the repo, so a
scope document is not exempt from the command checks. Writing *about* such a command trips it too:
drop the `node` prefix when quoting one, or the extractor treats it as a command to resolve.

## Gotchas for whoever continues

- **A closed round file is deliberately unbuildable.** Once every slot is settled, `build` refuses
  and points at the kick-off prompt. That refusal is the terminator working — see
  `skills/megascope/references/rounds.md`.
- **Never open a built page over `file://`** — the engine renders everything from its data block at
  run time, so the page looks broken when it is not. Serve it: `python3 -m http.server 8137`. See
  `docs/testing-the-engine.md`.
- **`.claude/launch.json` is committed** — a `docs` entry running that same server on that same port,
  so the Browser pane can manage it rather than each contributor re-deriving the command.
  `.claude/settings.local.json` is gitignored: it is per-user, and this repository is public.
- **Built pages are gitignored** (`docs/scoping/**/round-*.html`). They are output, not source —
  `build` regenerates any of them from its data file in one command. The repository ships the engine
  and the data that feeds it, never a built scoping document.
