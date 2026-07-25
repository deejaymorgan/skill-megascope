---
name: megascope
description: >-
  Drive a fuzzy project request to an agreed, checkable scope through short
  rounds of questions, then produce a kick-off brief a fresh agent can execute.
  Each round is a polished interactive HTML document the user fills in and
  pastes back. Use when the user wants to scope, plan, or spec a non-trivial
  project — "scope this", "help me plan X", "turn this idea into a build plan",
  "what should the first version be", "let's figure out requirements before
  building". Especially strong for technical and software work, but the
  deliverable is itself a scoping decision, not a fixed output.
---

# megascope — scoping in rounds

Take a vague request to an agreed scope, one layer at a time, then hand over a
brief a fresh session can act on with no other context.

**Round 1 establishes the goal and what kind of work this is. Each later round takes
what is settled and scopes the next layer.** Small jobs need one round; large ones a
few. Scale to the job and say which you chose.

The document is produced by a **data-driven engine**: one static shell (`assets/engine.html`)
fed a per-round questions-JSON. You generate *only the JSON*. Never bespoke HTML, never an
edited shell. That is the core efficiency win and the thing to protect.

## Operating rules

- **One command does the build.** `node assets/megascope.mjs build <round-N.data.json> <out.html>`
  validates and then injects. It **refuses to write** an invalid round, so a broken document
  cannot reach the user. Do not read the engine and splice the data block yourself.
- **Never edit the shell.** Personality arrives only through `meta.theme` — usually one accent
  hex. If you find yourself wanting to change `engine.html`, the answer is in the data.
- **The engine adds the escapes; the data must not.** Every question automatically gets
  *In my own words*, *This doesn't make sense*, a flag, a note and its own copy button. They
  are a parse contract, not styling. Do not try to declare or restyle them.
- **Don't re-ask what's decided.** Facts the user already fixed become `meta.constraints`, listed
  under a heading the engine supplies: *Already decided — not re-asked here*.
- **Recommendation-first, always.** Every question ships pre-answered with a `rec`, a `why` and a
  `switchIf`. The user reviews; they do not author. A blank-looking question is a bug.

## The scope is five slots

Everything is tracked in `meta.scope`: **goal · deliverable · boundary · verification · constraints.**
Each is `settled` or `open`, carries plain-language `text`, and cites the answers that earned it.
A round asks about open slots and nothing else — `build` enforces exact cover.

`deliverable` also carries a `kind`: `new-project-plan`, `codebase-feature`, `experiment`, or
`other`. **Do not assume the output is a build plan.** Infer it from the goal; if the goal does
not make it obvious, round 1 asks.

See `references/rounds.md` for the slots, round sizing, and the close.

## The loop

### 0 · Intake
Read the request. Name the subject, the goal as you understand it, and the facts already fixed.
Ask **2–4** `AskUserQuestion` clarifications only where the answer changes what you would research.
Pick a working directory: `docs/scoping/<project>/`.

### 1 · Research, sized to the round
Round 1 is capped at `research.mode` `none` or `light` (≤3 parallel readers, no dossier) — it must
not make the user wait. Later rounds size research off what the previous paste-back actually opened,
and record that in `research.trigger[]`. A question marked `technical: true` must carry an `example`
**and** cannot exist with `research.mode: "none"`. See `references/research-fanout.md`.

### 2 · Write the round
Write `docs/scoping/<project>/round-<n>.data.json`. Follow `references/writing-questions.md`
for what the schema cannot enforce, and `references/engine-data.md` for the format.

Hard limits worth knowing before you start: **8 questions, 4 sections, 4 options** per round;
option labels ≤7 words; `why` ≤200 characters. The caps are the pressure that makes rounds real —
if a round will not fit, that is the signal to split it, not to compress the writing.

```bash
node assets/megascope.mjs build docs/scoping/<project>/round-1.data.json docs/scoping/<project>/round-1.html
```

Then **publish it as an Artifact**. Load the `artifact-design` skill for calibration — the shell is
already tasteful, so keep it so. The engine omits `<!doctype>/<html>/<head>/<body>`, so it is
Artifact-ready as-is. Pass `meta.favicon` — one emoji, a tab icon only, never drawn on the page —
as the Artifact favicon, along with a stable title.

Hand it over in one line: *review the defaults, change or reject anything that doesn't fit, then
click "Copy answers for Claude" and paste it back.*

### 3 · Read the paste-back
**Save it verbatim first**, as `round-<n>.answers.md`. Later rounds are checked against it — no
saved paste-back, no next round.

Check line 2's `scope-id:` matches the round you sent. If it doesn't, stop and ask; do not merge.
No `scope-id:` line at all means a pre-v2 export.

Then, per answer:

| Tag | What it means | What you do |
|---|---|---|
| `DEFAULT` | took the recommendation | nothing — silent |
| `CHANGED` | picked something else | confirm in one line |
| `OWN` | answered in their own words | the `own words:` text **supersedes every option**. Reflect it back in one sentence. If it opens a decision this round didn't contain, add it to the next round rather than arguing |
| `REJECTED` | "this doesn't make sense to me" | **never counts as evidence, and never carries the default forward as if answered** |
| `FLAGGED` | the user's own bookmark | **the answer stands.** Answer it briefly; do not hold the round open |

**On a rejection, open a dialogue.** Restate the decision in simpler words, give one everyday
example and one analogy, confirm they follow, then re-ask — in chat for one or two, in the next
round for several. **Rejected twice means the question is wrong, not the user.** Settle the slot with
`assumed: true` and a written `assumption`, say so out loud, and it surfaces in its own section of
the kick-off brief.

### 4 · Next round, or the close
Update the five slots from what came back. Then either:

- **Something is still open** → write `round-<n+1>.data.json` with `prev` and `prevAnswers` pointing
  at the round just finished, and go to step 2. `build` refuses a round that advances nothing,
  asks about a settled slot, or leaves an open slot untargeted.
- **Everything settled** → `build` refuses with *"the scope is complete — produce the kick-off
  prompt, not another round."* That refusal is the signal to close.

### 5 · Close
Update the final round's data file in place: set the slots its answers settled, with `evidence`
citing that round. Do not bump `revision` — the questions didn't change, the scope did. Then:

```bash
node assets/megascope.mjs ready docs/scoping/<project>/
```

Exit 0 means ready. Exit 1 names the first unmet condition and its slot — **that message is the
spec for what to do next.** Do not hand-wave past it.

When ready, present the scope summary: one short paragraph per slot, using each slot's `text`
**verbatim**, so the user reads back exactly what was recorded — plus a section for anything
settled by assumption.

- **They approve** → write `SCOPE.md` and `KICKOFF.md`.
- **They question it** → make it simpler, give one concrete example and one analogy, patch that
  slot's `text`, and re-present. Only when a slot genuinely regresses do you set it back to `open`
  with a `reopened` reason and run another round.

The **kick-off brief** is the deliverable: a self-contained document a fresh agent session can act
on with nothing else — what to build, what is already decided, what is out of scope, how to verify
it is done, and what was assumed rather than agreed. `references/rounds.md` has its shape.

## Files

- `assets/engine.html` — the static shell. **Never edited per run.**
- `assets/megascope.mjs` — `validate` · `build` · `ready`. Zero dependencies.
- `assets/schema.json` — the machine-checkable contract.
- `references/rounds.md` — the five slots, round sizing, the close, the kick-off brief.
- `references/writing-questions.md` — what makes a question worth pre-answering.
- `references/research-fanout.md` — per-round research patterns.
- `references/engine-data.md` — every field, and how it renders.
- `references/theming.md` — choosing an accent that belongs to the subject.

## Edge cases

- **A one-round job.** Fine — set `round.of` to 1. The value is the recommendation-first round-trip,
  not the number of rounds.
- **Beyond four rounds.** Doctrine stops at 4. If the scope still isn't closed, stop writing rounds:
  finish it in conversation and settle what's left with `assumed: true` and written assumptions.
- **No `Workflow`.** Use parallel `Agent` calls; for a small job, research inline.
- **The user wants to skip research.** Go straight to a round from what you know — still
  recommendation-first, and mark the questions `technical: false`.
