# megascope v2 — agreed plan

Status: **schema agreed 2026-07-25.** Nothing in `skills/`, `scripts/`, `tests/` or `examples/` has
been edited yet.

Requirements live in [`BRIEF-v2.md`](BRIEF-v2.md) — read that first for *why*, then this for *what to
type*. Read its **Status** block; four of its instructions are superseded.

**Division of authority.** The brief wins on **requirements** — the engine stays data-less, the format
guarantees structure, the user is never boxed in. If this file contradicts one of those, this file is
wrong. This file wins on **sequencing and mechanism** — field names, limits, check ids, build order,
and the amendment that parks `examples/paperclips/` in `scratch/` at step 1 rather than deleting it
outright.

Evidence base: full read of the dev worktree at `49f771b`, plus three independently-authored
candidate designs, an adversarial verdict on each, and verification of every load-bearing claim
below (each cited `path:line`).

---

## Decisions taken by Daniel — do not re-ask

| # | Decision | Answer |
|---|---|---|
| 1 | Per-round size caps | **8 questions / 4 sections.** `questions` maxItems 8, `sections` maxItems 4. The cap is the pressure that makes rounds real. |
| 2 | Does the validator parse the saved paste-back to verify evidence? | **Yes, parse it.** Every paste-back is saved verbatim as `round-N.answers.md`; check S10 and `ready`'s R3 resolve each `evidence` ref against it. A ref to a `REJECTED` or absent question fails. This is what makes readiness a check rather than a self-report. |
| 3 | Round ceiling | **Schema allows `n`/`of` up to 6; doctrine stops at 4.** At round 4, switch to conversation plus `assumed:true` + a written `assumption`. The schema does not make an honest fifth round illegal. |

---

## 0 · What the measurements actually say

I measured `examples/paperclips/scoping.data.json` rather than trusting the diagnosis, and the
fault is more specific than "questions are verbose":

| Metric | Value |
|---|---|
| Questions / sections | **31 / 7** |
| `question` text length | avg **39** chars, max **85** |
| `why` length | avg **138**, max **221** |
| Longest option **label** | **186 chars** — `Exact economy/ops/trust/creativity/sales/costs/quantum/investment/tournament/drones/factories/power/probes/drift; approximate boids combat, wire-price` |
| Longest option **detail** | **214 chars** |
| Options per question | 3–4 (so "no maximum" has not yet bitten) |
| Unexplained ALLCAPS tokens | **18** — `CDN CMA CPU ES EV GREEDY IGT IIFE JSON MVP OODA PRNG RNG RTA SVG UI WR YAML` |

Two consequences that shape the whole design:

1. **The question field is not the problem — the options are.** Length limits must bite on
   `options[].label`, `options[].detail` and `why`. A word cap on `question` would be enforcing
   a rule the corpus already passes.
2. **Jargon must be caught by requiring explanation, not by banning characters.** A backtick lint
   scores **0 of 31** here — none of those 18 tokens is backticked. The check that works is the
   inverse: scan display text for identifier-shaped tokens and *require* a `meta.glossary` entry.

`writing-questions.md:51` already says "Jargon the user won't recognize" is an anti-pattern, and
`:26` already caps labels at "a few words". Both were ignored. That is the evidence for your core
instruction: **structure must be guaranteed by the format, not by prose doctrine.**

---

## 1 · The schema shape

One file per round: `round-<n>.data.json`. Annotated JSONC; strip `//` to run.
Markers: **NEW** / **CHANGED** / **UNCHANGED** / **REMOVED**.

```jsonc
{
  // NEW · REQUIRED · const 2
  // Lets the engine refuse a v1 payload loudly. Today engine.html:424 does
  // `catch(e){DATA={}}` and falls through to the friendly empty state at :463 —
  // so a malformed run silently produces a blank document.
  "formatVersion": 2,

  "meta": {
    // required: ["project","round","title","scope","glossary"]  (was ["project","title"] at schema.json:13)

    // CHANGED · pattern ^[a-z0-9][a-z0-9-]*$ · 1–60
    //   PLUS not:{ pattern: "-r[0-9]+(-v[0-9]+)?$" }
    // STABLE across every round — the round never enters this string; the engine
    // derives the storage slug (§2). This makes SKILL.md:83's "-followup"
    // convention unrepresentable rather than merely discouraged.
    "project": "reading-log",

    "round": {                            // NEW · REQUIRED · additionalProperties:false
      "n": 2,                             //   REQUIRED int 1–6
      "of": 3,                            //   REQUIRED int 1–6   (validator: of >= n)
      "revision": 1,                      //   REQUIRED int 1–9, default 1. Bump when REPUBLISHING the
                                          //     same n with edited questions. Enters the slug, so a
                                          //     rewritten round 2 cannot rehydrate the first draft.
      "label": "Where your books live",   //   REQUIRED ≤60 · this round's subject, plain language
      "prev": "round-1.data.json",         //   REQUIRED when n>1 else null · ≤120 · relative
      "prevAnswers": "round-1.answers.md"  //   REQUIRED when n>1 else null · the VERBATIM paste-back.
                                           //     The validator parses it (§3). No answers file, no round 2.
    },

    "title": "Reading log",               // CHANGED · required · 1–80 (was unbounded)
    "subtitle": "Round 2 of 3",           // CHANGED · ≤60
    "favicon": "📚",                       // CHANGED · ≤4
    "headline": "Two things left to pin down.",     // CHANGED · ≤90
    "lede": "You settled the goal last round…",     // CHANGED · ≤400
    "steps": ["…","…","…"],               // CHANGED · 3–6 items, each ≤60
    "closingAsk": "Update the scope from these answers, then tell me what's still open.",
                                          // CHANGED · ≤300 · engine default de-phased (E15)

    // ------------------------------------------------------------ NEW · REQUIRED
    // The running scope panel AND the readiness checklist AND what every question
    // must point at. One object, three jobs.
    // An ARRAY not a map, so the engine iterates in given order and hardcodes no
    // slot names — the data-less invariant holds.
    // minItems 5 / maxItems 5; validator: id set == exactly these five, in order.
    "scope": [
      { "slot": "goal",                   // REQUIRED enum goal|deliverable|boundary|verification|constraints
        "label": "What we're trying to achieve",     // REQUIRED ≤40 (display only)
        "state": "settled",               // REQUIRED enum settled|open
        "text": "Log a finished book in under ten seconds, from your phone.",
                                          // REQUIRED 25–240 · plain language.
                                          //   The minLength matters: without it `"text":"ok"`
                                          //   legally terminates the whole loop.
        "evidence": ["r1:Q1","r1:Q3"] },  // REQUIRED array; minItems 1 when settled unless assumed:true.
                                          //   Grammar: "r<n>:<qid>" | "r<n>:notes".  "chat" is NOT legal.

      { "slot": "deliverable", "label": "What we hand over", "state": "settled",
        "text": "A phone web app: a short build plan plus a first working cut.",
        "kind": "new-project-plan",       // NEW · REQUIRED on this slot when settled.
                                          //   enum: new-project-plan | codebase-feature | experiment | other
                                          //   THIS is requirement 3 — the deliverable is now data, not doctrine.
        "kindOther": null,                // NEW · REQUIRED 20–120 when kind=="other"
        "evidence": ["r1:Q4"] },

      { "slot": "boundary",    "label": "What's in and what's out", "state": "open",
        "text": "In: logging plus a finished list. Sharing is out. Version-one line not drawn yet.",
        "evidence": [] },
      { "slot": "verification","label": "How we know it's done", "state": "open",
        "text": "Nothing agreed yet — this round asks for it.", "evidence": [] },
      { "slot": "constraints", "label": "Fixed facts we work inside", "state": "settled",
        "text": "Phone only. No account. You are the only reader. Must work with no signal.",
        "evidence": ["r1:Q2","r1:notes"],
        "assumed": false,                 // NEW · optional, default false. When true, "assumption" is
        "assumption": null,               //   REQUIRED (30–200) and evidence may be []. The ONLY honest
                                          //   way to settle a slot with no user answer. Surfaces in its
                                          //   own section of the kick-off brief.
        "reopened": null }                 // NEW · optional ≤120 · REQUIRED when this slot regressed
                                          //   settled→open versus meta.round.prev.
    ],

    // NEW · REQUIRED (may be {}) · maxProperties 10
    // propertyNames ^[A-Za-z][A-Za-z0-9_.·-]{1,31}$ · values 15–140
    // Every identifier-shaped token in display text must have an entry (check S14),
    // and every entry must be used. This is the jargon fix — it catches RNG/OODA/IGT
    // where a backtick ban catches nothing.
    "glossary": { "sync": "keeping a copy of your list somewhere other than the phone" },

    "constraints": [ /* UNCHANGED — already-decided facts as chips */ ],
    "context":     { /* CHANGED — blocks[].type "phases" REMOVED (req 3) */ },
    "theme":       { /* UNCHANGED — the only source of personality */ }
  },

  "sections": [                            // CHANGED · maxItems 4 (see decision 2)
    { "id": "A", "title": "Where it lives" }
  ],

  "questions": [                           // CHANGED · maxItems 8 (see decision 2)
    {
      "id": "Q1",                          // CHANGED · pattern ^[A-Z][A-Za-z0-9]{0,5}$ · unique (S1)
      "section": "A",                      // UNCHANGED · must reference a sections[].id
      "slot": "boundary",                  // NEW · REQUIRED · enum, same five.
                                           //   S6: must name a slot whose state is "open" — you cannot
                                           //       ask about something you declared settled.
                                           //   S7: every "open" slot must be named by ≥1 question.
                                           //   S6+S7 = exact cover. Drift is a build failure.

      // ---- the four-part shape, in render order -----------------------------
      "context": "Your phone loses signal on the train, which is exactly when you finish a book.",
                                           // NEW · REQUIRED · 40–240 · why this is on the table
      "breakdown": [                       // NEW · REQUIRED · 2–3 items, each 20–140.
                                           //   An ARRAY, not a paragraph — decomposition is the
                                           //   forcing function that a prose field cannot be.
        "Works offline: you can log a book anywhere and it catches up later.",
        "Needs signal: less to build, but the app is dead on the train."
      ],
      "technical": false,                  // NEW · REQUIRED boolean · the if/then hinge:
                                           //   true  ⇒ required ["example"]
                                           //   false ⇒ not:{required:["example"]}  (key ABSENT, not null)
      // "example": "Offline-first means the app writes to the phone first, then copies up later.",
                                           // NEW · optional ≤200 · present iff technical:true.
                                           //   With options[].detail, the only fields where
                                           //   identifier-shaped tokens are allowed.
      "question": "Should the app keep working with no signal?",
                                           // CHANGED · ≤100, must end "?" · field NAME kept
                                           //   (engine reads q.question at :438; renaming churns docs
                                           //   for nothing). NO word cap — the corpus shows this field
                                           //   is already fine; a cap here would enforce nothing.
      "why": "Offline costs a little extra work and removes the one moment the app would fail you.",
                                           // CHANGED · now REQUIRED (optional today at schema.json:151,
                                           //   absent from the required list at :145) · 30–200
                                           //   The 200 cap bites: today's max is 221.
      "switchIf": "Pick B if you want something usable this week and can live with dead spots.",
                                           // NEW · REQUIRED · 20–140 · the runner-up condition.
                                           //   writing-questions.md:25 calls this the single sentence
                                           //   that lets a user override intelligently. Made structural.
      // ---- /four-part shape -------------------------------------------------

      "rec": "a",                          // CHANGED · array gains uniqueItems; multi:false ⇒ must be
                                           //   a string. Every key must exist in options (S4).
      "multi": false,                      // UNCHANGED
      "options": [                         // CHANGED · minItems 2, maxItems 4 (was NO maximum)
        { "key": "a",                      // CHANGED · pattern ^[a-z0-9][a-z0-9-]{0,7}$
                                           //   Bans a leading "_", reserving "__own" for the engine.
          "label": "Works offline",        // CHANGED · 3–48 chars, ≤7 words, not:{pattern:"[/;|\\[\\]]"}
                                           //   THIS is the fix for the measured fault: the 186-char
                                           //   slash-list label becomes literally unrepresentable.
                                           //   Banning | [ ] also keeps author text out of the export
                                           //   grammar, making the delimiters unforgeable (§4).
          "detail": "Log anything, anytime; it syncs when you're back on." },
                                           // CHANGED · now REQUIRED, 15–140 (optional & unbounded
                                           //   today; observed max 214)
        { "key": "b", "label": "Needs signal", "detail": "Simpler to build, useless on the train." }
      ]
    }
  ]
}
```

### Removed from the contract

| Removed | Why |
|---|---|
| `meta.context.blocks[].type:"phases"` | The phased plan is no longer the fixed output (req 3). |
| The `-followup` slug convention (`SKILL.md:83`) | Replaced by a derived slug (§2); `meta.project` now *forbids* the suffix. |
| Engine alias tolerance — `q.opts`, `q.q`, `q.sec`, tuple options, `rec`→`opts[0]` (`engine.html:429-436`) | Engine and schema finally agree on one contract. Cost: an unvalidated file hits the `formatVersion` panel instead of half-rendering. That is the intended trade. |
| `scripts/inject.mjs` + `build-doc.mjs` as separate files | Merged into `skills/megascope/assets/megascope.mjs`; old paths become one-line re-exports so `dev.mjs:16` and `smoke.mjs:17` keep working. |
| `examples/paperclips/` | Replaced by `examples/reading-log/`. |

### What the engine adds that the data never declares

So a run cannot forget them: the `__own` option on every question; the reject control; the flag
control and its per-question copy button; the note textarea; the fixed REJECTED sentence; the tag
vocabulary. These are **not** themeable — they are a parse contract, and letting a run restyle them
would let a run break it. Personality still arrives only through `meta.theme`
(`engine.html:481-530`, untouched).

---

## 2 · How rounds are represented

**One questions-JSON per round. No `rounds[]` container, and no separate ledger file.** The round
file *is* the ledger snapshot; the previous round's file plus its saved answers are what it is
checked against.

```
docs/scoping/reading-log/
  round-1.data.json     # meta.round = {n:1, of:3, revision:1, prev:null, prevAnswers:null}
  round-1.html          # built artifact (published as an Artifact)
  round-1.answers.md    # the VERBATIM paste-back, saved on receipt — machine-parsed (§3)
  round-2.data.json     # prev:"round-1.data.json", prevAnswers:"round-1.answers.md"
  round-2.html
  round-2.answers.md
  research/r2/dossier.md
  SCOPE.md   KICKOFF.md # the close
```

Three hard blockers rule out one file for all rounds — none of them preferences:

1. The engine parses exactly **one** payload (`engine.html:326`, read at `:422-424`), and
   `inject.mjs` splices exactly that block. An all-rounds file needs a round router in the shell.
2. `TOTAL` (`:445`), the progress bar (`:776-778`) and both counter triples (`:772-775`) are
   single-valued singletons. Per-round variants turn the engine from a renderer into a wizard.
3. Round N is written *from* round N−1's answers, so an all-rounds file gets rewritten and
   republished every round — under one slug, which is exactly the collision below.

### The slug: `meta.project` does not vary — the storage key does

Today, verbatim (`skills/megascope/assets/engine.html:443-444`):

```js
  var PROJECT=(META.project||"megascope-project").toString();
  var STORE=PROJECT+"-scoping-v1", THEME_KEY=PROJECT+"-scoping-theme";
```

`load()` (`:642-656`) rehydrates by bare `q.id`, so round 2 of the same project silently inherits
round 1's answers, and `coerceChoice` (`:657-660`) quietly resets keys that no longer exist.
Replacement:

```js
  var PROJECT=(META.project||"megascope-project").toString();
  var RN=(META.round&&META.round.n)||1, RV=(META.round&&META.round.revision)||1;
  var SLUG=PROJECT+"-r"+RN+(RV>1?"-v"+RV:"");
  var STORE=SLUG+"-scoping-v1", THEME_KEY=PROJECT+"-scoping-theme";
```

Collision becomes impossible **by construction** rather than by remembering a suffix, because
`meta.round.n` is schema-required inside an `additionalProperties:false` object and `meta.project`
is pattern-forbidden from carrying `-rN`. `revision` closes the second case: republishing an
*edited* round 2 under the same `n`. `THEME_KEY` stays deliberately project-wide — light/dark is a
person's preference and should carry across rounds. `SLUG` also drives the download filename
(`:896`) and `payload.meta` (`:891`).

### How the scope panel is fed

By `meta.scope` in the round's own file — five entries, iterated in array order, rendered as state
pill + label + full text + provenance, plus `meta.glossary` as a term list. No cross-file reads at
run time. Claude authors it from the previous `answers.md`; the **validator** is the only thing that
opens sibling files, and only to check the panel's claims are earned.

---

## 3 · The three open questions

### 3a · When does research happen? Per round, sized off what the previous paste-back opened. Round 1 is capped light by the schema.

Today it fires once, sized off a static complexity table (`research-fanout.md:9-11`, mirrored
`SKILL.md:38-42`). That is keyed wrong: it spends 8–12 researchers before anyone knows which layer
matters.

- **Round 1** targets `goal` + `deliverable`. `meta.research.mode` is schema-restricted to
  `none|light` when `n == 1`; `light` = ≤3 parallel readers, no synthesis agent, no dossier.
  Round 1 must not make the user wait — that is the point of splitting rounds.
- **Rounds ≥2** carry `research.trigger[]` (minItems 1): the specific things in the previous export
  that opened this round (an `open` slot, a `REJECTED` id, an `OWN` answer, a note). Sizing: **one
  researcher per planned `technical:true` question, plus one per unresolved REJECTED question,
  capped at 8**; a dedicated synthesis agent above 5. `mode:"deep"` requires `sources` (minItems 3).
- **Mechanical tie:** `technical:true` ⇒ `example` required (schema) **and** `research.mode != "none"`
  (check S15). A technical question cannot exist unresearched.
- **Stop rule** (there is none today — `SKILL.md:74` "Iterate until nothing is open" is all there is):
  research for a round stops when every planned question has a `why` you can defend in under 200
  chars and a `switchIf` naming a real condition. If you cannot write those two sentences, that is
  the thing to research; if you still cannot, the question is not ready and its slot stays open.
- **Deleted:** synthesis artifact 3, "a proposed phase plan … Phase-1/MVP boundary"
  (`research-fanout.md:37,:54`; `SKILL.md:50`). Replaced by "a proposed update to the five scope
  slots: for each open slot, what the research says it should say."

### 3b · How is a round represented? One questions-JSON per round — §2.

### 3c · What does the readiness checklist check against? The five slots — and those are checked against the previous round's saved paste-back, parsed from disk.

This is where all three candidate designs failed *identically*, and all three judges caught it
independently: the checklist was written by the same agent it was meant to discipline, and nothing
cross-checked it. A slot could flip to `settled` with 30 characters of hand-waving and pass.

The fix is cheap because §4's export contract is strict by design — so parse it. **Three levels:**

**1 · Live, in the engine.** `updateSummary()` (`:763-782`) iterates `meta.scope` and marks a slot ✓
when every question naming it is answered (DEFAULT / CHANGED / OWN) and none is REJECTED; — otherwise.
Rendered as a readiness strip and reproduced verbatim in the export. The user watches the state
machine advance; Claude receives the same reading.

**2 · Before the doc exists** — `megascope.mjs build` refuses otherwise:

- **S6** every `questions[].slot` names a slot whose `state` is `"open"`.
- **S7** every `"open"` slot is named by ≥1 question.  *(S6+S7 = exact cover.)*
- **S8** at least one slot is `"open"` — else it fails with *"scope is complete — produce the
  kick-off prompt, not another round."* **The loop terminator is a tool refusal, not a judgment call.**
- **S9 (advancement)** vs `meta.round.prev`: ≥1 slot must have moved `open → settled`, and no slot
  may regress without a `reopened` string. `of ≤ 6` plus strict advancement over five slots bounds
  the loop by construction.
- **S10 (evidence)** vs `meta.round.prevAnswers`: every `evidence` ref on a settled slot must
  resolve to a question that appears in that answers file with state `DEFAULT`, `CHANGED` or `OWN`
  — **never `REJECTED`, never absent**. `r<n>:notes` resolves against a non-empty overall-notes block.

**3 · At the close** — `node assets/megascope.mjs ready docs/scoping/<project>/` prints a table and
exits 0 only when: all five slots `settled` (R1); each `text` ≥25 chars (R2); each has resolving
evidence, or `assumed:true` with an `assumption` (R3); the `deliverable` slot has a `kind`, plus
`kindOther` when `kind=="other"` (R4); no question in the latest answers file is still `REJECTED`
(R5); every `round-N.data.json` has a sibling `round-N.answers.md` (R6). Exit 1 names the first
unmet condition and its slot:

```
not ready: R1 — slot "verification" is open (no round has targeted it yet)
```

That message *is* the spec for the next round's `slot` assignments.

**Termination, stated once.** `ready` exits 0 → present the scope summary (one short paragraph per
slot, using each slot's `text` verbatim so the user reads back exactly what was recorded, plus the
assumptions section). Approve → write `SCOPE.md` and `KICKOFF.md`. Question it → simplify, give one
concrete example and one analogy, patch that slot's `text`, re-present. Only when a slot genuinely
regresses do you set `state:"open"` with a `reopened` reason and run another round.

**The escape hatch, made honest.** A question rejected twice is a broken question, not a broken
user. Don't re-ask a third time: settle the slot with `assumed:true` + an `assumption` string, say
so out loud, and it appears in a **"Decided by assumption, not agreement"** section of the kick-off
brief. This replaces a legal-but-empty `evidence:["chat"]`, which one candidate design actually
*instructed* Claude to use as its round-4 fallback.

---

## 4 · The export parse contract

Built by `buildExport()` (`engine.html:834-868`), joined with `\n`. Literal text is literal;
`{…}` interpolates; `⟦…⟧` is conditional. Only continuation lines are indented; nothing else in the
document begins with `- ` or `## `.

```
# {meta.title} — round {n} of {of}: answers
scope-id: {meta.project} · r{n}/{of} rev {revision}

Summary: {nDefault} default · {nChanged} changed · {nOwn} in own words · {nRejected} rejected · {nFlagged} flagged · {nAnswered}/{TOTAL} answered.
Readiness this round: {slot.label} {✓|—} · {slot.label} {✓|—} · …
(✓ = every question feeding that slot is answered and none rejected.)

## {sec.id}. {sec.title}
- {q.id} [{STATE}⟦ · FLAGGED⟧] ({q.slot}) {PAYLOAD}
⟦    own words: {otherText}⟧
⟦    asked: {q.question}⟧
⟦    note: {note}⟧

## Overall notes / new questions
{notes or "(none)"}

---
{meta.closingAsk}
```

**STATE — exactly one token. Precedence `REJECTED > OWN > CHANGED > DEFAULT`.**

| STATE | Condition | PAYLOAD | Mandatory continuation |
|---|---|---|---|
| `DEFAULT` | chosen keys == `rec` keys, not rejected | `{KEY}: {Label}` | — |
| `CHANGED` | chosen keys != `rec` keys, `__own` not among them | `{KEY}: {Label}`␠␠␠`(rec was {RECKEY}: {RecLabel})` | — |
| `OWN` | `__own` is (or is among) the chosen keys | picks in option order, `__own` printing as the fixed literal `OWN: in my own words`, joined `␠\|␠`, then ␠␠␠`(rec was …)` | `own words:` |
| `REJECTED` | `rej === true` | `no answer — this question did not make sense to me` (fixed, non-overridable) | `asked:` |

Non-negotiable details:

- Line 2 `scope-id:` is the machine-readable round identifier. Parse it first; its **absence**
  identifies a legacy (pre-v2) export.
- `{KEY}` is the option key upper-cased. Multi-select joins picks with `" | "` as today (`:850-851`).
  Author labels are pattern-banned from containing `|`, `[`, `]`, `/`, `;`, so the join and the tag
  brackets are unforgeable.
- `(rec was …)` is prefixed by **exactly three spaces** (as `:853`), body `{RECKEY}: {RecLabel}`
  joined `" | "` (`recLabelText`, `:461`). Emitted for `CHANGED` and `OWN` only — never for
  `DEFAULT` or `REJECTED`.
- `FLAGGED` is appended **inside** the brackets after `" · "`, orthogonal to STATE:
  `[REJECTED · FLAGGED]` and `[DEFAULT · FLAGGED]` are both legal. ASCII only — today's
  `⚑ FOLLOW-UP` (`:849`, asserted at `tests/smoke.mjs:151`) is renamed because flag's *meaning*
  changed and emoji in a tag alphabet is a parser hazard. The ⚑ glyph stays in the UI.
- `({q.slot})` always follows the tag bracket — the free link back to the readiness checklist.
- **Continuation lines are exactly four spaces**, in fixed order when more than one appears:
  `own words:` → `asked:` → `note:`. Each value is `String(x).replace(/\s+/g," ").trim()`, so no
  continuation can contain a newline or a run of spaces — which is what makes the three-space
  `(rec was …)` delimiter unforgeable by user text.
- `own words:` is emitted **iff** STATE is `OWN`. Selected with nothing typed:
  exactly `    own words: (nothing written yet)` — never an empty value, so the line always parses.
- `asked:` is emitted **iff** STATE is `REJECTED`, carrying `q.question` verbatim so a rejected
  question can be re-taught, or forked into a fresh session, without opening the data file.
- `note:` is emitted whenever the note is non-empty, for **any** STATE — including `REJECTED`, where
  it is the user saying which part confused them. **The note is never the answer**; that is what
  `own words:` is for. (One candidate reused the note *as* the Other field — cheaper, but it loses
  the multi-select case and misreads a note written about a different option as the answer.)
- Orphan sections emit last under `## Other`, fixing the sentinel leak at `:846`, which today prints
  the literal `## __other. Other`.

### Claude's obligations on paste-back

In `SKILL.md`, so parsing is never improvised:

- `scope-id:` must match the in-flight round. If not, stop and ask; do not merge.
- `DEFAULT` — silent. `CHANGED` — confirm in one line. Both count as evidence for `({slot})`.
- `OWN` — the `own words:` text **supersedes every listed option**. Reflect it back in one sentence.
  If it reveals a decision this round didn't contain, add it to the next round rather than arguing.
  Counts as evidence.
- `REJECTED` — **never counts as evidence, and never carries the default forward as if answered.**
  Open a dialogue from the `asked:` text: restate the decision in simpler words, one concrete
  everyday example and one analogy, confirm understanding, then re-ask — in chat for one or two, in
  the next round for several. Rejected twice ⇒ the question is wrong; settle by assumption and say so.
- `FLAGGED` — the user's own bookmark, not an objection. **The answer stands.** Answer the flag
  briefly and do not hold the round open for it.

### Second clipboard payload — the per-card "Copy this question" button

This is what makes `flag` a genuinely distinct affordance: fork it into its own session, ask, come back.

```
Clarifying question — {meta.title}, round {n}, {q.id} (slot: {q.slot})

Background: {q.context}
The question: {q.question}
What it comes down to:
- {q.breakdown[i]}
⟦Example given: {q.example}⟧
The choices offered:
- {KEY}: {label} — {detail}
The recommendation was {RECKEY}: {RecLabel} — {q.why}
It said to switch if: {q.switchIf}
My note so far: {note or "(none)"}

Explain this to me in plain language with a concrete example, then help me answer it.
Don't assume I know any jargon. I'll take the answer back to the scoping document.
```

---

## 5 · Engine changes

All in `skills/megascope/assets/engine.html`. Every item reads a **data** field or fixes a named
defect; nothing is project-specific, nothing is edited per run, `applyThemeTokens()` (`:481-530`) is
untouched.

| # | Change | Req |
|---|---|---|
| **E1** | `normalizeQ` (`:429-441`) reads `context`, `breakdown`, `technical`, `example`, `switchIf`, `slot`; drops all alias tolerance and the `rec → opts[0]` fallback (`:430-436`). | 1 |
| **E2** | `formatVersion` gate before the empty-state branch (`:463`): `!== 2` renders a loud "this engine needs v2 data" panel. Closes the silent-blank path from `catch(e){DATA={}}` (`:424`). | guarantee |
| **E3** | Storage slug (`:443-444`) → the `SLUG` block in §2; `THEME_KEY` stays project-wide. `payload.meta` (`:891`) gains `round`/`revision`; filename (`:896`) uses `SLUG`. | 2 |
| **E4** | `__own` option appended (never prepended) in `normalizeQ`. `coerceChoice`'s `optByKey` filter (`:658-659`) accepts it free since it is a real option; the key pattern bans `_`-leading author keys so collision is unrepresentable. | 5a |
| **E5** | `blank()` (`:641`) and the `load()` whitelist (`:649-652`) gain `otherText:""` and `rej:false`. Without **both**, free text and rejection are dropped on reload. | 5a,5b |
| **E6** | `card()` (`:702-731`): `.q-context` → `ul.q-breakdown` → `.q-example` *(only when present)* → `h3.q-title` → `.q-why` → `.q-switch` → `.opts` → `.q-foot` → `.q-other` + note. All at the 38px gutter (`:224,:226,:246,:255`). Foot gains `.rej-toggle` and `.copyq-btn`. | 1,5 |
| **E7** | `change` handler (`:791-800`): picking `__own` reveals and focuses `.q-other`. `input` handler (`:801-805`) gains a `.q-other` → `otherText` branch with save. | 5a |
| **E8** | click dispatch (`:806-817`): `.rej-toggle` → `s.rej=!s.rej; if(s.rej) s.rev=false;` — **rejection is not review**, which is what keeps the readiness strip honest. `.copyq-btn` → `copyText(questionPrompt(q))` via existing `copyText` (`:871-878`). | 5b, flag |
| **E9** | `updateCard` (`:744-761`): `data-state` precedence `rejected > flagged > changed > default`; chips "Needs explaining" / "In your words". CSS beside `:215-216`, `:252-254`. | 5 |
| **E10** | `updateSummary` (`:763-782`) counts `answered`/`changed`/`own`/`rejected` as a **partition**; new counter spans (`:373-377`, `:400-402`); header progress becomes `answered/TOTAL` where answered = `rev && !rej`, so the bar can no longer read 100% with open rejections; `acceptAll` (`:824-827`) skips rejected. Plus the readiness strip, iterating `meta.scope`. | 6 |
| **E11** | `renderScopePanel()` from `renderChrome()` (`:592-593`): a `<section class="scopepanel">` at the top of `.content`, above `.toolbar`. Iterates `meta.scope` in array order, then `meta.glossary`. **Explicitly not a third rail** — the `236px minmax(0,1fr)` grid (`:107`), sticky `.nav` (`:109`) and `padding-bottom:130px` reserve (`:126`) are untouched, and a third column has no breakpoint between 940px and 1220px. | 4 |
| **E12** | `buildExport()` (`:834-868`) rewritten to §4; orphan heading fixed to `## Other` (`:846`). | 2,5,6 |
| **E13** | Reset (`:829`): `confirm()` silently no-ops in a sandboxed iframe, so the guard evaporates → two-click arm on the button ("Click again to reset", 4s revert). Download (`:890-899`): wrap in try/catch; on failure or missing `URL.createObjectURL`, open the modal with the pretty JSON so it degrades to copy. | sandbox |
| **E14** | Focus: inputs are `opacity:0;width:1px;height:1px` (`:231`) and the file's only focus rule is a bare `:focus-visible` (`:75`) — so the ring draws on an invisible 1px box. Add `.opt input:focus-visible{outline:none}`, `.opt:has(:focus-visible){outline:2px solid var(--accent);outline-offset:2px}`, plus a sibling fallback on `.marker`. Also `role="radiogroup"`+`aria-labelledby` on `.opts`, and `role="dialog"`/`aria-modal` + focus move on the modal. | defect |
| **E15** | Deliverable-neutral defaults: `steps` (`:565`, today ends "I return the phased plan + MVP") and `closingAsk` (`:866`). **`tests/smoke.mjs:41-42` hardcodes that closingAsk string and asserts it at `:153` — both change in the same commit or the gate breaks.** | 3 |

---

## 6 · Build order

Dev worktree only; `main` untouched until step 10. `npm test` is the gate at every step.

1. **Unblock the gate, then retire the example — one commit.**
   `tests/smoke.mjs:36` is `CASES[0]`, loaded by `await readFile` inside the loop at `:46`, so
   removing `examples/paperclips/` throws an unhandled rejection **before the minimal fixture runs**
   — zero of 24 checks execute and the exit path never reports.
   **Move `examples/paperclips/` to `scratch/`, do not delete it yet.** `scratch/` is gitignored, so
   it leaves the repo exactly as the brief requires — every reference updated, `rg -n paperclips`
   empty — while the file stays on disk as the quality reference for authoring the new example and as
   the only extant corpus for checking the new length limits actually bite. It is deleted for real at
   step 9. Same commit: point `CASES` at fixtures, fix `scripts/dev.mjs:21` (its default `DATA` is the paperclips file,
   so `npm run dev` dies), `package.json:9` `build:example`, and the docs — `CLAUDE.md`,
   `README.md`, `SKILL.md:21,90`, `research-fanout.md:50`, `theming.md:20`, plus the stale
   `references/engine-data.md:13` (`node tests/build-doc.mjs` → exists nowhere; the real file is
   `scripts/build-doc.mjs`).
   **Gate:** `npm test` green on the *old* v1 format — proving the harness survives independently of
   the format change.
2. **Schema v2, no code.** Rewrite `assets/schema.json` per §1, using only a closed draft-07 keyword
   list. **Gate:** ajv compiles; a keyword meta-test fails if the schema uses any keyword the shipped
   walker (step 4) does not implement.
3. **Fixture corpus.** Valid `round1`/`round2`, plus ~24 single-mutation invalid files, one per
   guarantee: 5 options · 9 questions · 5 sections · `label` with a `/` · 9-word `label` ·
   `question` without `?` · `technical:true` without `example` · `example` with `technical:false` ·
   missing `switchIf` · `why` at 12 chars · slot `text` at 20 chars · question naming a *settled*
   slot · open slot with no question · all five settled · missing `prev` at n>1 · `mode:"deep"` with
   2 sources · `mode:"none"` with a technical question · `-r2` in `project` · option key `_own` ·
   duplicate question id · unglossaried acronym · evidence citing a REJECTED answer · no advancement
   vs `prev`. **Gate:** each invalid file fails **on the intended keyword or check id**, asserted on
   the error path — not merely "it failed".
4. **Ship `skills/megascope/assets/megascope.mjs`.** Merge `inject.mjs` + `build-doc.mjs`; add a
   schema walker (a recursive interpreter over the *shipped* `schema.json`, so validation stays
   data-driven), the semantic checks S1–S15, the export parser, and `ready` (R1–R6). Modes:
   `validate`, `build` (validates first, refuses to write on failure), `ready`. Keep
   `export function injectData` and make `scripts/inject.mjs` / `build-doc.mjs` one-line re-exports
   so `dev.mjs:16` and `smoke.mjs:17` keep working. Resolve siblings via
   `new URL('./engine.html', import.meta.url)` — `build-doc.mjs:15` walks
   `../skills/megascope/assets/`, which does not exist from inside the skill, and `mega.sh` symlinks
   `skills/megascope` only.
   **Verified feasible:** `inject.mjs` has *zero* imports and `build-doc.mjs` imports only node
   builtins; `ajv`/`jsdom` are test-only (`smoke.mjs:15-16`). Keep `.mjs` since no `package.json`
   reaches the deploy site.
   **Gate:** differential test — walker verdict === ajv verdict on all ~26 fixtures, case by case;
   plus a run from a copied directory with no `node_modules` and no `package.json`.
5. **Engine: ingest, slug, `formatVersion`** (E1–E5). No new UI. **Gate:** v2 fixture render, **plus
   a two-JSDOM localStorage isolation test** (both at `url:'http://localhost/'`, as `smoke.mjs:85`):
   drive round 1, seed round 2's DOM with round 1's keys, assert round 2 shows only its own defaults.
   That is the bug the brief names.
6. **Engine: card sub-fields, focus, a11y** (E6, E14). **Gate:** DOM assertions that `context`,
   **every** `breakdown` item, `question`, `why` and `switchIf` reach the card, and that
   `.q-example` is **absent** when `example` is absent. The current harness never asserts any
   optional text renders — which is how `why` could break invisibly.
7. **Engine: the two escapes and the export** (E7–E10, E12). **Gate:** all eight legal tag
   combinations; the `own words:` continuation and its empty fallback; the fixed REJECTED sentence
   with its mandatory `asked:`; three-space `(rec was …)`; four-space continuations in fixed order; a
   reload test proving `otherText` and `rej` survive `save()`/`load()`; and a fixture with a
   deliberately unknown `question.section` asserting `## Other` — today `smoke.mjs:66` asserts
   orphans never happen, so that path has **never executed**.
8. **Engine: scope panel, readiness strip, sandbox fixes, neutral defaults** (E11, E13, E15, with
   `smoke.mjs:41-42,153` in the same commit). **Gate:** all five slots render with full text, states
   and glossary; reset works with `confirm` stubbed to `undefined`; download falls back to the modal
   with `URL.createObjectURL` throwing; light **and** dark checked by eye.
9. **Ledger checks + doctrine + the new example.** `ready` fixtures (one passing directory, one per
   failing R1–R6). Rewrite `SKILL.md` as the round loop, deleting every phased-plan assumption
   (`:4`, `:8-10`, `:15`, `:50`, `:59`, `:76-77`) and every hand-injection instruction (`:22`, `:61`;
   `engine-data.md:5-13`) in favour of `node assets/megascope.mjs build`. Trim
   `references/writing-questions.md` to what the schema *cannot* enforce: recommend-don't-survey, the
   runner-up condition's *content*, grounding in research, anchor-not-preference ordering, trailing
   spikes, flag-as-bookmark, "It depends" as an anti-pattern. New `references/rounds.md`: the five
   slots, round sizing, per-round research, the close, the kick-off brief. Write
   `examples/reading-log/` — `request.md`, `round-1.data.json` (2 sections, 5 questions, slots
   `goal`+`deliverable`), `round-1.answers.md` (a real export with one FLAGGED, one OWN, one
   REJECTED), `round-2.data.json` (slots `boundary`+`verification`, `prev`/`prevAnswers`, resolving
   evidence), `SCOPE.md`, `KICKOFF.md`. Each data file ≤4 KB against paperclips' 26,966 bytes; ship
   no `.html`. Add `tests/docs.mjs`: extract every `node …`/`npm …` command from the shipped markdown
   and assert the target exists — the check that would have caught `engine-data.md:13`.
   Finally, **delete `scratch/paperclips/` for real** — the reference copy parked at step 1 has done
   its job once `examples/reading-log/` passes.
   **Gate:** `npm test` green; `rg -n paperclips` empty; `rg -niE "phased|phase-1|\bMVP\b" skills/ README.md`
   returns only MVP-as-a-`deliverable`-option.
10. **Dogfood, then promote.** `npm run dogfood`, a **new** `claude` session, one real two-round
    scope end to end. The real acceptance test is whether Claude authors a round-1 file that
    validates on the **first** attempt. Then
    `git -C ~/Dev/skill-megascope merge dev && npm run restore`, `npm test` on `main`,
    `npm run deployed` reports DEPLOYED, one line in `LEARNINGS.md` on whether the length floors
    helped or fought.

---

## 7 · What was considered and rejected

- **Object maps** for sections/questions/options instead of arrays. A duplicate key silently
  **deletes a question** — strictly worse than a duplicate id in an array — and no differential test
  can cover it, because `JSON.parse` already dropped the dup so there is no oracle. Order also
  becomes load-bearing and invisible, and a question's id becomes its path, so it cannot move.
- **A third rail for the scope panel.** No breakpoint between 940px and 1220px, so content squeezes
  to ~335px, and it means surgery on the grid at `:107`, the sticky nav at `:109` and the actionbar
  reserve at `:126`. The panel goes in the intro flow instead.
- **A word-count regex on `question`.** The corpus shows this field averages 39 chars — the cap
  would enforce nothing, and pushing questions shorter is what produced the 186-char slash-list
  *labels* in the first place.
- **A backtick-based jargon lint.** Measured hit rate **0 of 31**, and it inverts into an incentive
  to stop backticking, since backticks would be the one thing that hard-fails the build. Replaced by
  the inverse: require a `meta.glossary` entry for identifier-shaped tokens.
- **`minLength: 1` on the new prose fields.** `"context": "."` and
  `verification:{state:"settled",text:"ok"}` were both legal in a candidate — and the second one
  terminated the loop. Real floors, or the fault just relocates from verbose-and-jargony to
  terse-and-vacuous, which is harder to spot because it passes everything.
- **The note textarea doubling as the Other field.** Elegant and nearly free, but it loses the
  multi-select case and misreads a note written about a *different* option as the answer.
- **A separate ledger file**, plus `rounds[].slug`, plus `readiness.slots[]` duplicated into every
  round — three overlapping representations of scope state where one array does the work.
- **`evidence:["chat"]` as a legal terminator.** One candidate's round-4 fallback *instructed*
  Claude to use it, making the escape hatch doctrine rather than accident. Replaced by
  `assumed:true` + a written assumption that surfaces in the kick-off brief.
- **No `revision` in the slug.** Republishing an edited round 2 rehydrates the old round 2 through
  `coerceChoice`'s silent key-dropping (`:657-660`) — and reject-and-rewrite is a first-class flow
  in this design, so its happy path walks straight into the unguarded case.
- **Per-round files with no cross-file check.** "The loop cannot run without shrinking scope" is
  false without S9: round 3 could legally leave the same slots open as round 2, indefinitely.
