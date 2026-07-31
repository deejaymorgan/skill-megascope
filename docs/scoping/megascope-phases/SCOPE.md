# SCOPE — megascope's phase model

**Tracking:** committed deliberately — a worked example of the tool on itself, sanitised 2026-07-31.
Public repository.

The agreed scope, as recorded. Three rounds, 16 questions, none rejected. Closed 2026-07-30.

Readiness: `node skills/megascope/assets/megascope.mjs ready docs/scoping/megascope-phases/` — exit 0,
all six conditions met.

The deliverable a fresh session acts on is [KICKOFF.md](KICKOFF.md). This file is the record behind
it: where each slot came from, and what was decided but never written into a round.

---

## The five slots

Each `text` below is verbatim from `meta.scope` in [round-3.data.json](round-3.data.json), which is
the authoritative record. Evidence is cited as `r<round>:<question>` and resolves against the saved
paste-backs.

### What we're trying to achieve — settled

> Stop a run answering before it has listened. Discovery opens with real open questions, later rounds
> narrow with grounded suggestions, and the scope phase ends at a gate so design starts in a fresh
> session.

Evidence: `r1:Q1` · `r1:Q2` · `r1:Q3`

### What we hand over — settled · kind: `codebase-feature`

> Two releases inside this one tool: first the open page and the suggestion change, then the gate and
> a design loop whose depth follows the size of the job. A brief plus a frozen list of decisions
> crosses the gate.

Evidence: `r1:Q4` · `r1:Q5` · `r1:Q6`

### What's in, and what's out — settled

> A design pass always produces an artifact; the size of the job only decides whether you get offered
> the shortcut. The page refuses to release answers until every question is answered or reviewed.
> Chat questions stay, but stay obvious.

Evidence: `r2:Q1` · `r2:Q2` · `r2:Q3`

### How we know it's done — settled

> Each release finishes on its own: the suite green, plus one real run of the tool. The hand-off is
> proved when a fresh session acts on it unaided. The listening half has no explicit test — discovery
> must reach the why before any solution.

Evidence: `r3:Q1` · `r3:Q2` · `r3:Q3` · `r3:Q4`

### What we work inside — settled

> Work held back becomes the next scope rather than a section in the hand-off. The done-test follows
> the kind of work: a command for code, a stated test for a plan. The hand-off names no model and no
> effort level.

Evidence: `r2:Q4` · `r2:Q5` · `r2:Q6`

**Nothing was settled by assumption.** All five slots rest on answers that resolve against a saved
paste-back. `verification` was carried as an assumption through rounds 1 and 2 and then reopened and
asked about properly in round 3 — that reopening is recorded in the slot's `reopened` field.

---

## The rounds

| Round | Asked about | Answers | Page |
|---|---|---|---|
| 1 · asking before answering | goal, deliverable | [round-1.answers.md](round-1.answers.md) — 4 default, 1 changed, 1 own words | [round-1.data.json](round-1.data.json) |
| 2 · where the line is | boundary, constraints | [round-2.answers.md](round-2.answers.md) — 1 default, 2 changed, 3 own words | [round-2.data.json](round-2.data.json) |
| 3 · how we know it's done | verification | [round-3.answers.md](round-3.answers.md) — 3 default, 1 own words | [round-3.data.json](round-3.data.json) |

### Round 1 — the goal and the deliverable

- **Q1 `CHANGED`** → *You are cast as a reviewer.* The recommendation was "it answers before it has
  listened". The change matters: the failure is **posture**, not pre-filling. Everything downstream
  follows from it.
- **Q2 `DEFAULT`** → Both, in two visible parts.
- **Q3 `DEFAULT`** → Two phases, one tool.
- **Q4 `DEFAULT`** → The open page first, then the rest.
- **Q5 `DEFAULT`** → A brief plus a frozen decision log.
- **Q6 `OWN`** → *"the goal of the design depends on the complexity. if its simple and small then just
  produce a prompt to build it. if its larger, than a design following best practice. Designs that
  aren't simple and small should prioritise MVP with all other features being captured for future
  iterations. presumably design may need to be split into phases… I am open to feedback on sdlc and
  ai dev best practice. especially claude code specific recommendations from anthropic, especially
  those referring to Opus 5 and Fable 5 models."*

That last request for best-practice feedback is what made round 2 a researched round. Its findings
are below.

### Round 2 — the line and the rules

Three of six came back in Daniel's own words, and each superseded the options rather than picking
one. The wording is load-bearing, so it is kept:

- **Q1 `OWN`** → *"produce the design artifact. make a jusgement call. if its small and simple, give
  the user a choice is further refinement needed or should we go ahead and build (something like
  that). If itsclearly not small and simple then skip the option and go straight to further
  refinement."*
  The recommendation was the published one-sentence-diff skip test, applied **before** design. This
  moves it: the design artifact is **always** produced, and the judgement happens **after** it
  exists, deciding only whether the user is *offered* the shortcut. It is explicitly a judgement
  call, not a checkable gate — the one-sentence rule survives as guidance for making it.
- **Q2 `OWN`** → *"validate the form and prevent the json download or copy answers if all questions
  are not answered/reviewed."*
  Stronger than the recommendation, which was to teach the export to distinguish untouched from
  agreed. Instead the page refuses to export at all, so the tag vocabulary never has to express
  silence. This makes the review toggle load-bearing.
- **Q3 `OWN`** → *"It stays as it is but any questions that are presented to the user this way (i.e.
  questions that aren't on the questionnaire) should be simple enough to not require any
  clarification. So they should be non-technical and obvious. The kind of thing anyone would have
  some idea about at the initial phase of defining their work."*
  Against the recommendation: the opening conversation stays, with a bar attached.
- **Q4 `CHANGED`** → Held-back work becomes the next scope, not a section in the hand-off.
- **Q5 `DEFAULT`** → The done-test is keyed to the kind of work.
- **Q6 `CHANGED`** → The hand-off says nothing about model or effort. So the model research below
  informs the people doing the work and deliberately **never reaches the brief**.

### Round 3 — the done-test

- **Q1 `DEFAULT`** → Each release finishes on its own.
- **Q2 `DEFAULT`** → The suite, plus one real run.
- **Q3 `OWN`** → *"this requriement was more conceptual and abstract and difficult to test
  explicitly. essentiallly it just means that the discovery phase is asking the open questions up
  front, and spending time in a proper discovery using best practice e.g. not just understanding what
  the person wants but why they want it. recommendations just skip ahead to a solution, we need to
  start with a premise."*
  The recommendation was to compare the open page's answers against what the old flow would have
  guessed. Declined as untestable. What replaces it is a **stated requirement rather than a check**:
  discovery asks its open questions up front and reaches the *why*, starting from a premise instead
  of skipping to a solution.
- **Q4 `DEFAULT`** → A fresh session acts on the hand-off unaided.

---

## Decided in conversation, not in any round

These are load-bearing and are **not** recoverable from the round files.

1. **Four round-1 answers were banked on an explicit say-so.** Q2, Q3, Q4 and Q5 came back tagged
   `DEFAULT`, but the export's own counter said `2/6 answered` — they had never been opened. Asked
   directly, Daniel chose "they stand — bank them." **The evidence chain for `goal` and `deliverable`
   therefore rests partly on a chat confirmation, not on the saved paste-back.** This is precisely
   the fault release one fixes: the export could not tell agreement from silence, and doctrine says
   bank a `DEFAULT` silently.
2. **Four framing answers from intake** became the constraint chips carried on every round page:
   discovery is a round-zero page of open questions; two kinds of question exist (narrowing
   pre-answered, ground-opening open); the scope phase ends at the gate with design entered fresh;
   design gets its own rounds.
3. **The primary failure changed in round 1** from "it answers before it has listened" to "you are
   cast as a reviewer" — posture, not pre-filling.
4. **Two decisions taken after the rounds closed.** Gate-testing the kick-off brief against fresh
   readers surfaced two collisions no round had caught. Both were put to Daniel and answered:
   - **A ground-opening question carries no options — free text only.** The alternative was 2–4
     options with nothing pre-selected. Rejected because putting candidate answers on the page is the
     posture the change removes. Consequence: every answered discovery question exports as `OWN`,
     through export grammar that already exists, so no fifth tag is needed.
   - ***Reviewed* alone does not release an unanswered open question.** `resolved` is kind-dependent:
     `rev || rej` for a narrowing question, answered-or-rejected for an open one. A tick means "I read
     the recommendation and accept it", so it means nothing where no recommendation exists. The
     alternatives all let an open question release as `[DEFAULT]` with an empty payload, which the
     validator accepts as evidence — the original fault in a new form.

---

## The engine fault behind round 2's Q2

Round 1's own export surfaced the bug, and it is the mechanism behind the posture complaint.

`isAnswered` is `!!s.rev && !s.rej` ([engine.html:1229](../../../skills/megascope/assets/engine.html)).
`rev` starts `false` with the recommendation already selected, and is set only by an explicit
interaction — picking an option, typing a note or own words, flagging, or the review toggle. So a
question left completely alone still exports as `[DEFAULT]`, which
[SKILL.md](../../../skills/megascope/SKILL.md) defines as "took the recommendation → nothing —
silent". **The tag vocabulary cannot distinguish agreement from silence, and doctrine says bank it.**

---

## Research behind the scope

Round 2 ran deep, prompted by Daniel's request for best practice. Round 3 ran light and local. None
of this needs redoing.

**Published guidance (round 2).**

- **The gate is documented practice.** Finish the specification, then start a fresh session to
  execute it, so the new session carries clean context. Context is named as the governing
  constraint. → validates the gate outright.
  <https://code.claude.com/docs/en/best-practices>
- **A good brief is self-contained** — names the files and interfaces involved, states what is out of
  scope, and ends with an end-to-end verification step. → maps onto deliverable / boundary /
  verification almost one-to-one. Same page.
- **Discovery is an interview.** Interview first, then write the spec. Plus a prioritisation rule
  megascope lacks: ask the questions whose answers would change the architecture first, one at a
  time, and run a blind-spot pass for unknown unknowns.
  <https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns>
- **There is a skip test for design depth.** If you could describe the diff in one sentence, skip the
  plan. Planning earns its overhead on uncertainty, breadth, or unfamiliar code. → demoted by r2:Q1
  from a gate to guidance.
- **Do not ask an agent to verify.** Current models self-verify; explicit verification instructions
  cause over-checking with no quality gain. But do give a check that can be run. Also: scope expands
  unless bounded, and subagent delegation needs capping.
  <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5>
- **Model selection**, answering Daniel's r1:Q6 request directly: Opus 5 (`claude-opus-5`, $5/$25 per
  MTok) for both phases — it performs best given a complete specification up front and left to run.
  Fable 5 (`claude-fable-5`, $10/$50) only when the problem is genuinely unsolved or the domain
  unfamiliar. Effort: default `high`, `xhigh` for demanding implementation; `low`/`medium` are
  unusually strong on Opus 5, so sweep down. **By r2:Q6 none of this enters the hand-off** — it is
  recorded here for the people doing the work.

**Local (round 3).**

- The engine is already testable unattended: `tests/smoke.mjs` injects a data file into the shell,
  renders it under `jsdom`, drives all four answer states and round-trips the export. So the export
  block is a check the existing suite can hold.
- `npm test` is six node scripts, none touching a real browser. Layout still needs a served page —
  see [docs/testing-the-engine.md](../../testing-the-engine.md).
- `ready` is the nearest thing to a done-test the repo has, and it checks the **record** — five slots
  settled, evidenced, real sentences — not whether a stranger could act on the brief. That gap is
  what r3:Q4 closes.
