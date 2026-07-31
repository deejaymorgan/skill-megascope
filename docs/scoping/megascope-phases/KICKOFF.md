# Kick-off — megascope's phase model, release one

**Tracking:** committed deliberately — a worked example of the tool on itself, sanitised 2026-07-31.
Public repository.

Everything needed to start is in this file. It assumes no prior conversation.

You are working in the `skill-megascope` dev worktree, on branch `dev`. This repository **is** the
`megascope` Claude Code plugin: a scoping tool that turns a vague request into an agreed scope by
asking questions in rounds. Each round is a static HTML page (`skills/megascope/assets/engine.html`)
fed a per-round JSON data file. The page is data-less and is never edited per run.

**Build release one. Release two is agreed but is its own job — see section 7.**

Everything in this brief is decided. Three implementation choices are left to your judgement; they are
listed in section 6. Make them, and say which you chose.

---

## 1 · What to build

Today every question on a megascope page arrives **pre-answered** with a recommended option. The user
reviews; they never author. That casts the user as a reviewer of the tool's guesses at the exact
moment when only the user knows the answer. Release one fixes the posture in three parts.

### 1.1 · A discovery page of open questions

Add a **discovery page** — a round of genuinely open questions with **nothing pre-selected**, built
by the same engine from the same kind of data file. It comes before the existing narrowing rounds.

Two kinds of question must be able to coexist in the format:

| Kind | Arrives | Carries |
|---|---|---|
| **narrowing** | pre-answered, with a recommendation | `rec`, `why`, `switchIf`, `options` |
| **ground-opening** | open, **free text only** | `openEnded: true`, and none of those four |

The kinds are told apart by an explicit flag, not by a missing `rec` — see decision **D** in
section 6 for the shape, and **E** for why `why` and `switchIf` are dropped rather than replaced.

**A ground-opening question offers no options at all.** This is decided, and it is stronger than
"nothing pre-selected": the page must not put candidate answers in front of the user, because
offering four guesses is the posture this change exists to remove. The only input is the reserved
*In my own words* free-text escape, which the engine already appends to every question
(`engine.html:786`).

That has a consequence worth planning for rather than discovering: **every answered discovery
question exports as `OWN`**, through the existing `OWN_EXPORT` literal (`:1427`) and the four-space
`own words:` continuation (`:1474`). This is a good outcome — the answer flows through export grammar
that already exists, so the four-tag contract holds without strain. Two details follow from it:

- `payloadOf` (`:1441`) appends `   (rec was …)` to an `OWN` answer. For a question that never had a
  recommendation this must be suppressed, or every discovery answer carries the literal `(rec was )`.
- `normalizeQ` appends `__own` to every question's options, so an options-less question still
  normalises to exactly one option. Decide how that renders — a lone radio the user must select
  before typing is a worse form than a textarea that is simply there.

Discovery must reach the **why**, not just the what. It starts from a premise and must never skip to
a solution. That is a requirement on the questions themselves, and it is the point of the whole
change — a page of open questions that still asks "which of these three solutions?" has not done it.

### 1.2 · The page must refuse to release unfinished answers

A user copies their answers out with **Copy answers for Claude** or **Download JSON**. Both must be
**blocked until every question has been resolved**.

**Resolved is a new, weaker predicate than the engine's existing "answered".** Do not collapse them:

- `isAnswered(q)` is `!!s.rev && !s.rej` (`engine.html:1229`).
- Rejecting a question **clears** `rev` (`engine.html:1353`), on purpose — the comment there says
  "rejection is NOT review", and a rejected question must never count as an answer.
- So **`every(isAnswered)` is the wrong gate.** A user who rejected a question could only get their
  answers out by withdrawing a rejection they meant (via the *Reviewed* toggle at `:1357`, which
  clears `rej`). The document could never be exported while faithfully carrying "this question made
  no sense to me" — and the user is never to be boxed in.
- The gate is therefore **resolved**, not answered. For a **narrowing** question that is
  `s.rev || s.rej`: a rejection resolves a question without answering it.
- For a **ground-opening** question, *Reviewed* is not enough. This is decided: a tick means "I read
  the recommendation and accept it", so it means nothing where no recommendation exists. An open
  question is resolved only by **actually answering it, or rejecting it**. A user cannot tick past a
  question that was asked precisely because only they know the answer.

Why any of this matters: a question left completely untouched **still exports as `[DEFAULT]`**, and
the tool's own doctrine defines `[DEFAULT]` as "took the recommendation → nothing — silent". Silence
is currently indistinguishable from agreement, and gets banked as evidence for later rounds.

**Be precise about how much the gate fixes.** Together with the rule above it closes the case that
motivated the change: an unanswered discovery question can never be released, so a discovery page
cannot emit a `[DEFAULT]` at all. One narrower hole stays open by design, and you should know it is
there rather than trip over it: `flag-toggle` sets `s.rev = true` (`engine.html:1349`), so one click
on *Flag for follow-up* — an explicit "come back to this" — resolves a **narrowing** question and
releases it as `[DEFAULT · FLAGGED]`. That is read-but-not-agreed, and it is acceptable: the user
made a deliberate mark, which is the opposite of silence.

**Do not add a fifth export tag.** The parser hard-codes exactly `DEFAULT|CHANGED|OWN|REJECTED`
(`megascope.mjs:296`); `buildExport` prints the tag raw (`engine.html:1472`) and tallies it against a
four-key object (`:1446`, `:1448`), so a fifth value produces an unparseable line and a `NaN` in the
summary. Nothing in release one needs one: an answered discovery question is `OWN`, a rejected one is
`REJECTED`, and no other state can reach an export. If the open state needs to show on the *page*,
that is a **display-only** predicate beside `stateOf` — `stateOf`'s return value **is** the export
tag, so it must stay four-valued.

### 1.3 · The opening conversation stays, but gets a bar

Before any page is built, a run asks the user a few questions in chat. **Keep that.** But constrain
it: any question asked that way must be **non-technical, obvious on sight, and answerable without
clarification** — the kind of thing anyone would have some idea about at the very start of defining
their work. Anything needing explanation belongs on a page, not in the chat opening.

---

## 2 · The code this touches

Line numbers verified against the working tree. Read the anchor before editing it.

### The engine — `skills/megascope/assets/engine.html`

The logic is in the `<script>` at the bottom; the long styling block above it rarely matters. Search
rather than reading top to bottom.

| Anchor | What is there | What release one needs |
|---|---|---|
| `normalizeQ` :780, `recArr` :788 | `recArr` is built from `q.rec` unconditionally | a rec-less question yields `[undefined]`; make it empty, and carry the openness flag |
| `blank()` :1104-1105 | `choice: q.recArr[0]` — where pre-selection is *decided* | seed empty for an open question, keeping `rev:false` |
| `coerceChoice` :1122-1124 | the *second* place a choice can be re-seeded: `optByKey(q,c) ? c : q.recArr[0]` | with no `rec` this already yields `undefined`, so it may need no change; it bites only for a single-select question that **has** a rec |
| `isChanged` :1129 | compares choice against `recArr` | today a rec-less single-select reads `undefined !== undefined` → false → `DEFAULT`. It misreports only for `multi` now, and for singles **after** the `blank()` change. Needs work either way |
| `card()` :1168, ★ badge :1173 | emits the ★ Recommended badge | suppress it when there is no recommendation |
| `stateOf` :1221 | the four-way `REJECTED / OWN / CHANGED / DEFAULT` partition — **this is the export tag** | leave four-valued; put any new reading in a display-only predicate |
| `isAnswered` :1229 | `!!s.rev && !s.rej` | keep as-is; add `resolved` beside it |
| `.rev-toggle` :1203, handler :1356-1357 | the *Reviewed* button; sets `rev`, clears `rej` | the control the gate rests on |
| `flag-toggle` :1200, handler :1349 | flagging sets `rev = true` | so flagging resolves a question — see §1.2 |
| `recLabelText` :826 | `k.toUpperCase()` on the rec key | throws for a rec-less question; reached from `payloadOf` :1441 |
| `questionPrompt` :1365, call site :1379 | builds the copy-this-question text | same throw, which breaks a parse-contract escape |
| `updateSummary` :1286, `refresh()` :1307 | called after every mutation | the render hook where the lock state belongs |
| `#copyBtn` :1521 → `openModal` :1508-1512 | builds the text, writes `#exportText`, shows the modal, **and copies to the clipboard** | guard the top of the listener |
| `#downloadBtn` :1528 | builds its own JSON payload; its `catch` at :1546 **opens a filled modal without `openModal`** | guard the top of this listener too |
| `#modalCopyBtn` :1522 | copies whatever `#exportText` already holds | a third escape — `#exportText` must never be filled while blocked |

**Guard the listeners, not `openModal`.** A guard inside `openModal` alone leaves the download's
fallback path filling the modal, and `#modalCopyBtn` then copies it. And a guard that only hides the
modal is not a block: `openModal` writes `#exportText` **and** copies to the clipboard, so the answers
are already out. Return before the text is built.

**A live bug you will meet immediately.** With `rec` absent, `buildExport` throws a `TypeError` from
`recLabelText` as soon as the user picks anything. `openModal:1509` calls `buildExport()` *first*, so
the throw precedes writing `#exportText` and showing the modal — the first click silently does
nothing. Stale text surfaces later, via `#modalCopyBtn` (:1522) or the download's `catch` (:1546).
Nothing notices any of it, because `tests/smoke.mjs` asserts `errors.length === 0` exactly once, at
`:121`, before any interaction. Add an end-of-case error assertion or this stays invisible.

**Preserve the per-question escapes** the engine always adds. There are **six**: the reserved `__own`
"In my own words" option (`:786`) plus five foot buttons — note (`:1199`), flag (`:1200`), *This
doesn't make sense* (`:1201`), copy-question (`:1202`) and *Reviewed* (`:1203`). They are a parse
contract, not styling. Two comments miscount them: `:773` says "the two escapes", and the shipped
list at `SKILL.md:35` names five, omitting *Reviewed* — which this change makes load-bearing, so
reconcile that list rather than copying it.

### The format — `skills/megascope/assets/schema.json` and `megascope.mjs`

- `rec` is in `question.required` (`schema.json:325`) and `additionalProperties` is `false` (`:326`),
  so an open question is **currently unexpressible**: `rec` can neither be omitted nor replaced by a
  flag. Declare `openEnded` as a property, move `rec`/`why`/`switchIf`/`options` out of `required`,
  and hinge them on it with the `if`/`then`/`else` shape at `:380`. Full spec in decision **D**,
  section 6.
- `options` sits at `:372` with `minItems: 2` at **`:375`** (max 4 at `:376`). A ground-opening
  question carries none, so `options` must become absent-able on that branch of the same hinge. Note
  `:339` is `breakdown`'s `minItems: 2` — a byte-identical line for a different field. Do not relax
  the wrong one.
- Because options-less questions now genuinely exist, the `megascope.mjs:448` guard below is
  load-bearing rather than defensive.
- **`tests/schema.mjs:101` asserts `why` is in `definitions/question/required`**, with the message
  "why is required (it was optional in v1)". Moving it out turns that assertion red. Rewrite it to
  assert the conditional instead — it is a deliberate pin, not an accident.
- `tests/schema.mjs:72` asserts every keyword in the schema is one the hand-written walker
  implements, and `tests/validate.mjs:131` asserts the walker and `ajv` agree on every mutation. The
  vocabulary is closed: `if`/`then`/`else`/`const` are already in use, so the shape above is
  satisfiable — but `dependentRequired` and `discriminator` are not available to you.
- `megascope.mjs:448` does `q.options.map(...)` unguarded — an options-less question throws a
  `TypeError`, and `ready` reaches it without a structural pass, so it crashes rather than reports.
- `S4` emits `recommends "undefined"` at `:451` for an open question; make it skip. (`:449` is a
  different failure sharing the same id.)
- Decide `EVIDENTIAL` (`:349`) deliberately rather than leaving it. It currently includes `DEFAULT`.
- Fix the stale banners naming "S1 to S15" (`megascope.mjs:352`, `schema.json:5`) — `S16` exists.

### The shipped prose — this *is* the product

The prose is what makes a run behave, so these are changes, not documentation chores. **Note that
`npm test` cannot check any of them**: `tests/docs.mjs` validates the *commands* inside docs, never
the claims. This is the largest unverifiable part of release one — review it by reading.

- **`SKILL.md:39`** — "Every question ships pre-answered with a `rec`, a `why` and a `switchIf`. The
  user reviews; they do not author. **A blank-looking question is a bug.**" This is the sentence a run
  will cite to refuse to write an open question. It must become the two-kind contract.
- **`SKILL.md:98`** — the `DEFAULT` row: "took the recommendation | nothing — silent". This is the
  doctrine that banks silence as agreement.
- **`SKILL.md:56`** — the intake step. Keep its four moves and the 2–4 question cap; replace the sole
  test ("only where the answer changes what you would research") with: non-technical, obvious on
  sight, answerable without clarification.
- **`SKILL.md:84`** — the hand-over line tells the user to "review the defaults", which is false for a
  discovery page, and it must also say the copy and download buttons stay locked until every question
  is resolved.
- **`SKILL.md:158` and `:163`** — the `## Edge cases` section has **four** bullets; the two that
  restate recommendation-first are "A one-round job" (`:158`) and "The user wants to skip research"
  (`:163`–`:164`). The other two need no edit.
- **`references/writing-questions.md`** — "Recommend, don't survey" (`:10`), and especially "If you
  genuinely have no view, you have not researched enough to ask yet" (`:13`), is the exact rule
  discovery breaks. It must stay a hard rule for narrowing rounds and route to an open question for
  discovery. The file's title names only one of the two kinds.
- **`references/engine-data.md`** — the `questions[]` table starts at `:134`; the rows to change are
  `why` (`:144`), `switchIf` (`:145`) and `rec` (`:146`), each marked required. The export sample
  opens at `:171` and `:195` states outright that it is a parse contract.
- **`references/rounds.md:70`–`:74`** — the four loop rules. Be exact about which one bites, because
  the obvious reading is wrong:
  - Exact cover — every question targets an open slot, every open slot is targeted (`S6`/`S7`,
    `megascope.mjs:601`–`:612`) — **applies to a discovery round and needs no exemption.** But it is
    a real constraint on discovery's shape: slots come from a closed five-name enum
    (`schema.json:322`), questions cap at 8, so a discovery round must declare which slots are open
    and cover each with at least one question — the round-1 pattern of marking the rest
    `assumed: true` (`rounds.md:44`).
  - "At least one slot moved open → settled" is the only rule a discovery page cannot satisfy, and
    `S9` **already** exempts it: the guard is `round.n > 1 && dir && round.prev`
    (`megascope.mjs:615`). So the prose exemption to write is one rule, not the rule set. Do not
    weaken exact cover.
- **`references/research-fanout.md:92`** — "Verify anything load-bearing" is the one bare
  instruct-to-verify in shipped prose. The agreed rule is to give a runnable check, never an
  instruction to verify.
- **`references/theming.md:41`** — "your eye confirms it looks right" is also an instruct-to-verify,
  and it names `npm test`, which does not exist where the deployed skill runs.
- **`README.md`** — "every decision is pre-set to a researched recommendation" (`:9`), "Every question
  looks like this — already answered" (`:51`), and the recommendation-first bullet (`:58`) all become
  false.

### Hard invariants — do not break them

**The deployed plugin is `skills/megascope/` and nothing above it.** On install it is copied to a
cache directory, so a shipped command reaching `../scripts` or `../tests` resolves to nothing at run
time. `tests/docs.mjs:129` fails the build for any `node` target matching `^(\.\./|scripts/|tests/)`
inside a doc under `skills/megascope/`, with "points outside the deployed skill". New prose there may
name only the skill's own assets — a command like `assets/megascope.mjs validate` — never `../scripts`
or `tests/`. (This brief lives outside the deployed skill, so it is free to name repository paths; a
doc inside it is not.)

**Both manifests move together.** `skills/megascope/.claude-plugin/plugin.json` and `package.json`
must carry the same version, or an installed plugin is cached at the old version and the update ships
nothing. `tests/manifest.mjs` catches it; `npm run ship` handles it.

---

## 3 · What is out of scope

- **The gate and the design loop.** Release two. See section 7.
- **Removing the opening chat questions.** They stay, with a bar on them.
- **Making the design-depth decision a checkable test.** It is a judgement call, on purpose.
- **Naming a model or an effort level anywhere in a hand-off.** Decided explicitly: a hand-off says
  nothing about which model to use or how hard to think.
- **Editing `engine.html` per run.** The shell is data-less; personality arrives only through the data
  file's `meta.theme`. Structural engine changes for the two question kinds are in scope; per-run
  edits never are.

---

## 4 · How to verify it's done

Release one **finishes on its own** — it does not wait for release two.

**The runnable check.** From the repository root:

```bash
npm test
```

That is the gate: six node scripts — schema, validate, ready, smoke, docs, manifest. It must be green
**with new assertions that hold the new behaviour**, not merely still green.

The suite can hold nearly all of it without a browser: `tests/smoke.mjs:44` renders the real built
document under `jsdom` and drives it. Assert at least:

- A blocked copy leaves `#exportText` **empty** and the modal unshown, and **zero** clipboard writes
  happened. The clipboard stub at `tests/smoke.mjs:75` is a no-op — replace it with a recorder, or
  this cannot be asserted at all.
- `#downloadBtn` produces no blob and opens no modal while blocked.
- Still blocked one question short; released on the last one.
- An **all-rejected** document releases. This is the never-boxed-in case, and the one a naive
  `every(isAnswered)` gate fails.
- An open question renders with **zero** checked inputs and no ★ badge, while a narrowing question in
  the same file is still pre-selected to its recommendation.
- `errors.length === 0` at the **end** of each case, not only at `:121`.

Three traps in the existing suite:

1. **Six existing export sites break the moment the gate exists** (`tests/smoke.mjs` 223, 375, 389,
   414, 430, 452). Three drive a completely untouched document (375, 389, 430); three are partially
   touched (223, 414, 452). Add a resolve-all helper rather than weakening the gate. Note `readyLine`
   (`:340`) is a shared helper whose `#copyBtn` click runs three times (`:344`, `:351`, `:354`).
2. **`tests/smoke.mjs:344` deliberately exports a zero-answer document** to prove "nothing is ✓
   before a single question is answered". Do not delete that assertion to make the gate pass. But
   note the obvious remedy does not work either: rejecting every question leaves them `REJECTED`, so
   the very next check (`:351`, "exactly the two slots this round targets go ✓") fails, and once the
   gate leaves `#exportText` empty, `readyLine` throws a `TypeError` instead of failing a check —
   because the change handler sets `rev` but never clears `rej` (`:1323`); only the reject button
   toggles it off (`:1353`). This case needs restructuring, with an un-reject step.
3. **Mind where a discovery fixture lives.** The readiness glob (`megascope.mjs:713`) already matches
   `round-0.data.json`, and `tests/ready.mjs:36` copies the whole of `tests/fixtures/scope` into a
   temp directory, so dropping one in there makes R6 demand a `round-0.answers.md` and changes the
   row counts the existing cases assert. Now that round 0 is legal that demand is *correct* — so
   either add the answers file alongside it and update those cases deliberately, or give the fixture
   a name outside the glob and keep it out of the readiness path.

**Plus one real run.** A green suite says nothing about whether a page asks the right things, so run
the tool on something real, end to end, and confirm a usable scope comes out. Note what the commands
do and do not do:

```bash
npm run dogfood
```

That only repoints the deployed skill symlink (`scripts/mega.sh:58`) and prints a reminder — **it runs
nothing.** Skills load at session start, so the real run is: dogfood, then invoke `/megascope` in a
**new** session, take a real request through discovery and at least one narrowing round, then
`npm run restore`. `npm run deployed` reports which version is currently deployed. Never repoint the
symlink by hand.

To look at a built document, `npm run dev` writes `scratch/preview.html` — but do **not** open it over
`file://`. The page renders everything from its data block at run time, so over `file://` the engine
looks broken when it is not. Serve it instead (`python3 -m http.server 8137`) and open the localhost
URL. See `docs/testing-the-engine.md`.

**The half with no test.** Whether a run *listened before it answered* is not mechanically checkable,
and no check was invented for it. The standard is stated instead: discovery asks its open questions up
front and reaches the **why**, starting from a premise rather than skipping to a solution. Judge it by
reading a real discovery page. The fifteen prose edits in section 2 are likewise unchecked by the
suite.

---

## 5 · Every decision, beside its answer

The frozen record. Nothing here is open for re-litigation; if one of these is wrong, that is a new
scope, not an edit to this brief.

| Decision | Answer |
|---|---|
| What the primary failure is | You are cast as a reviewer — posture, not pre-filling |
| Whether discovery is a page or a conversation | Its own page, a round of open questions, nothing pre-selected |
| How the two phases relate | Two phases, one tool |
| What ships first | The open page and the suggestion change; the gate and design loop follow |
| What crosses the gate | A brief plus a frozen list of decisions beside their answers |
| What decides design depth | A judgement call, made **after** a design artifact exists — it only decides whether the user is offered "refine further, or go build". Clearly-large jobs skip the offer |
| Whether the agreement-vs-silence fault ships in release one | Yes — the page validates itself and blocks both exits until every question is resolved |
| Whether a ground-opening question offers options | No — free text only. Offering candidate answers is the posture being removed |
| Whether *Reviewed* alone releases an open question | No — an open question is resolved only by answering or rejecting it |
| What happens to the opening chat questions | They stay, but must be non-technical, obvious, and need no clarification |
| Where deferred work is recorded | It becomes the next scope, not a section in the hand-off |
| What shape a done-test takes | Keyed to the kind of work: a command when the hand-over is code, a stated test when it is a plan |
| Whether a hand-off names a model or effort level | No — it says nothing; whoever runs the work chooses |
| When release one is finished | On its own: the suite green, plus one real run |
| What proves a hand-off is enough | A fresh session acts on it unaided |
| What proves the listening changed | Nothing mechanical. Discovery must reach the why rather than skip to a solution |

---

## 6 · Assumptions, late decisions, and what is left to you

**Nothing was settled by assumption.** All five parts of the scope rest on answers actually given
across three rounds, and none was rejected.

One caveat about the evidence itself, recorded because it is the very fault release one fixes: four of
round 1's six answers came back tagged `DEFAULT` while the export's own counter said only `2/6`
answered — they had never been opened. Asked directly, the author confirmed they stood. So part of the
evidence for *what to build* rests on a chat confirmation rather than on the saved answers file.

### Two decisions taken after the rounds closed

Testing this brief against fresh readers surfaced two collisions the three rounds had not caught.
Both were put to the author and answered; they are recorded here because they are load-bearing and
were not settled by any round.

**A · A ground-opening question carries no options — free text only.** The alternative was to keep
2–4 options and pre-select none. Rejected: putting candidate answers on the page is the posture the
change exists to remove, and *In my own words* is already on every question. Consequences are in
§1.1 — chiefly that every answered discovery question exports as `OWN`, which is why no new tag is
needed.

**B · *Reviewed* alone does not release an unanswered open question.** `resolved` is therefore
kind-dependent: `rev || rej` for a narrowing question, answered-or-rejected for an open one. The
alternative readings both reintroduced the original fault — a tick would have released the question
as `[DEFAULT]` with an empty payload, which `EVIDENTIAL` (`megascope.mjs:349`) accepts as citable
evidence for a decision nobody made.

### Three implementation choices, now decided

**C · Discovery is round 0.** Not "round 1 with everything shifted up" — that would have added a
round to every scope and pushed against the four-round doctrine (`rounds.md:64`). Making `0` legal
takes four edits, and the third is the one that bites:

- `meta.round.n` `minimum: 1` → `0` (`schema.json:39`). Leave `of` alone; `S11` only checks
  `of >= n` (`megascope.mjs:463`).
- The evidence grammar `^r[1-6]:` → `^r[0-6]:` (`schema.json:275`), so a later round can cite a
  discovery answer as `r0:Q1`.
- **`engine.html:804` is `var RN = ROUND.n || 1`, and `0 || 1` is `1`.** A round-zero page would
  render as "Round 1" *and* build `SLUG` as `<project>-r1` (`:805`), so its saved answers would
  collide with round 1's in local storage. Use `??`, not `||`. Fix this in the same commit as the
  schema change or the two together are worse than either alone.
- The `n >= 2` conditional that makes `prev`/`prevAnswers` required (`schema.json:46`–`:50`) should
  become `n >= 1`: round 1 now has a predecessor, and discovery is the only round entitled to a null.

**One consequence to handle deliberately, found while checking the above.** The previous-round chain
in `megascope.mjs:480` is guarded on `round.n > 1`, so **round 1 would never be checked against round
0's answers** — no verification that the paste-back on disk is discovery's, and `S13` evidence
resolution for `r0:` references would not be reached the way it is for later rounds. Widen that guard
to `round.n > 0` alongside the schema change. `S9` at `:615` carries the same guard, and there it is
correct to leave alone: a round-1 that settles nothing after discovery is still legitimate.

**D · An explicit flag, named `openEnded`.** Inference from an absent `rec` was rejected: it cannot
tell a deliberately open question from one where the author forgot the recommendation, which is the
exact class of error the schema exists to catch. Make it a declared boolean property
(`additionalProperties` is `false`, so it must be declared) and hinge on it with the same
`if`/`then`/`else` shape the `technical`/`example` rule uses at `schema.json:380` — that rule is the
precedent worth copying because it enforces **both** directions: `example` required when technical,
and *forbidden* when not.

- `openEnded: true` ⇒ `rec`, `why`, `switchIf` and `options` must all be **absent**.
- Otherwise ⇒ all four required, exactly as today.
- Make it **optional, defaulting to false**, not required. Required would mean editing every existing
  data file — the examples, the fixtures, and this scope's own three rounds — to add
  `openEnded: false`. Optional is also the safer failure: forget the flag on an open question and it
  is treated as narrowing, so the build refuses it for a missing `rec`. Loud, and pointing at the
  right thing.
- The name avoids a collision: `open` is already the vocabulary for a **slot's** `state`
  (`schema.json:263`), and the prose uses "open slot" constantly. A question that is `openEnded` and
  a slot that is `open` are different ideas and should not share a word.

**E · `why` and `switchIf` are dropped, not replaced.** An open question simply carries neither, and
the `not: { required: [...] }` branch above enforces it.

This puts the entire burden of making a blank box answerable on `context` (40–240 characters) and
`breakdown` (2–3 items), both of which are already required on every question and neither of which
presupposes a recommendation. **Say so explicitly in
`references/writing-questions.md`** when you rewrite it: for a narrowing question, `context` sets up a
choice the reader can see; for an open one it is the only thing standing between the reader and an
empty field. That is a higher bar for the same field, and nothing in the format enforces it.

---

## 7 · Release two — agreed, and its own job

Release two is **the gate and the design loop**: the scope phase ends, and design is entered in a
**fresh session that loads only the hand-off**; the design loop gets its own rounds and its own slots;
a design pass always produces an artifact.

It is described here only so you know where release one stops. **It is not part of this job**, and by
the rule that held-back work becomes the next scope rather than a section in a hand-off, it should be
scoped as its own run of the tool once release one has shipped.

One verified finding worth carrying forward, because it is the main structural risk: a second set of
slots collides with four hard-coded places at once — `SLOTS` (`megascope.mjs:54`), `S5` (`:456`),
`R4`'s requirement of a slot literally named `deliverable` (`:758`), and two closed enums plus an
exactly-five rule asserted at `tests/schema.mjs:85`, `:88` and `:91`. The cleaner shape is a parallel
slot set and a separate readiness predicate, not widening the existing five.

---

## 8 · Where this came from

Three rounds of scoping, all files in `docs/scoping/megascope-phases/`:

- `SCOPE.md` — the five agreed parts, their evidence, and the research behind them.
- `round-1.data.json` … `round-3.data.json` — the questions asked.
- `round-1.answers.md` … `round-3.answers.md` — the answers, verbatim.
- `NOTES.md` — the running record, including decisions taken in conversation.

Readiness passes:

```bash
node skills/megascope/assets/megascope.mjs ready docs/scoping/megascope-phases/
```

`CLAUDE.md` at the repository root carries the five invariants a change must not break.
`CONTRIBUTING.md` covers the development workflow and how a release is cut.
