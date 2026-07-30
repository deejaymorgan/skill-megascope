# megascope-phases — working notes

Running record for the scope of **megascope's own phase model**: a discovery phase of open
questions, suggestions reframed as grounded rather than guessed, and a gate between scope and
design. Written so a fresh session can continue with nothing but this directory.

Started 2026-07-30. Branch `dev`. Nothing committed yet.

## Where this is up to

Round 2 has been built and handed over. **The next thing to happen is Daniel pasting back the
round 2 answers.**

| | |
|---|---|
| Round 1 | built, answered, `round-1.answers.md` saved verbatim |
| Round 2 | built and published; **awaiting paste-back** |
| Round 3 | planned: `verification` only |

On receiving the paste-back: **save it verbatim as `round-2.answers.md` before anything else**,
check line 2's `scope-id:` reads `megascope-phases · r2/3 rev 1`, then update the slots and either
write round 3 or close.

Published pages (round 1, round 2) — the artifacts are private to Daniel's account:

- <https://claude.ai/code/artifact/926b7739-fcda-43eb-9734-466ec008d586>
- <https://claude.ai/code/artifact/b170a9a8-c55e-489d-99c5-69e74a05c10f>

## The five slots as they stand

Authoritative version is `meta.scope` in `round-2.data.json`. Summarised:

- **goal** — settled (`r1:Q1`, `r1:Q2`, `r1:Q3`). Stop a run answering before it has listened.
- **deliverable** — settled (`r1:Q4`, `r1:Q5`, `r1:Q6`), kind `codebase-feature`. Two releases in
  one tool: open page + suggestion change first, then the gate + design loop.
- **boundary** — **open**, reopened. The design/scope line, and whether the tag fault below ships
  in release one.
- **verification** — settled by assumption. Deliberately deferred to round 3.
- **constraints** — **open**, reopened. Design depth, deferred features, done-test shape.

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
agreement from silence, and doctrine says bank it silently.** Round 2 Q2 asks whether to fix this in
release one; the recommendation is yes.

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
  unusually strong on Opus 5 — sweep down. Round 2 Q6 asks whether the hand-off names any of this.

## Gotchas for whoever continues

- **A closed round file is deliberately unbuildable.** Once every slot is settled, `build` refuses
  and points at the kick-off prompt. That refusal is the terminator working — see
  `skills/megascope/references/rounds.md`.
- **Never open a built page over `file://`** — the engine renders everything from its data block at
  run time, so the page looks broken when it is not. Serve it: `python3 -m http.server 8137`. See
  `docs/testing-the-engine.md`.
- **`.claude/launch.json` was added this session** (a `docs` entry running that server, so the
  Browser pane can manage it). Untracked, unrelated to the scope, delete freely.
- Round 2 Q2's recommendation argues for *widening* release one. Worth a second look rather than a
  reflex accept — its runner-up is deliberately the narrow option.
