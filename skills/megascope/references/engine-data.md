# Engine data contract (formatVersion 2)

How `assets/engine.html` consumes a round's questions-JSON. The shell renders **everything** from
the JSON in its `<script type="application/json" id="scoping-data">` block. `assets/schema.json` is
the machine-checkable version of this document; `assets/megascope.mjs` enforces both it and the
cross-references it cannot express.

## Building a document

```bash
node assets/megascope.mjs build round-1.data.json round-1.html
```

It validates first and **refuses to write** on failure, so a broken document cannot reach the user.
Do not read the engine and splice the block by hand.

The page has no `<!doctype>/<html>/<head>/<body>` wrapper, so the same file works as a standalone
`.html` **and** as an Artifact source. It declares `<meta charset="utf-8">` first, so smart quotes,
em-dashes and emoji survive `file://`, HTTP and Artifacts alike.

Opened with the empty `{}`, the shell shows a friendly "no data loaded" note. Opened with data that
is unparseable, or that isn't `formatVersion: 2`, it shows a **loud refusal** instead — those are
failures, and rendering a blank document for them is how a broken run used to look deliberate.

## Inline markup

Every display string is HTML-escaped, then a tiny formatter runs. Use it sparingly:

| Write | Renders |
|---|---|
| `**bold**` | **bold** |
| `` `mono` `` | monospace span |
| `~highlight~` | accent-colored span |

## Top level

| Field | | |
|---|---|---|
| `formatVersion` | ✓ | Exactly `2`. |
| `meta` | ✓ | Identity, the scope panel, framing, theme. |
| `sections` | ✓ | 1–4 decision areas. |
| `questions` | ✓ | 1–8 decisions. |

## `meta`

| Field | | Renders as |
|---|---|---|
| `project` | ✓ | Stable slug, the **same in every round**. Pattern-forbidden from carrying `-rN`: the storage key is derived, not spelled. |
| `round` | ✓ | `{n, of, revision, label, prev, prevAnswers}` — see below. |
| `title` | ✓ | Header title, `<title>`, and the export header. |
| `scope` | ✓ | The five slots — see below. |
| `glossary` | ✓ | Term → gloss. May be `{}`. |
| `subtitle` | | Small uppercase label. Default `Round n of m`. |
| `favicon` | | 1–2 emoji for the header mark. Pass it as the Artifact favicon too. |
| `eyebrow` | | Mono label above the headline. Defaults to `Round n of m · A areas · B decisions`. |
| `headline` | | Serif intro headline, ≤90 chars. |
| `lede` | | Intro paragraph. Say what the last round settled and what this one is for. |
| `legend` | | Overrides the sidebar "How to read this" note. |
| `steps[]` | | 3–6 numbered process steps. Default is deliverable-neutral. |
| `overallNotesTitle` / `overallNotesHint` | | The free-text catch-all box. |
| `closingAsk` | | Final line of the export. |
| `research` | | `{mode, trigger[], sources[]}` — see `rounds.md`. |
| `constraints[]` | | Check chips: already-decided facts, so they aren't re-asked. `{label,text}` or a bare string. |
| `context` | | The collapsible panel. Hidden entirely if empty. |
| `theme` | | Personality — see `theming.md`. **The only source of it.** |

### `meta.round`

```jsonc
"round": {
  "n": 2,                              // this round
  "of": 3,                             // rounds planned (>= n)
  "revision": 1,                       // bump only when REPUBLISHING the same n with edited questions
  "label": "Where the line is",        // this round's subject, plain language
  "prev": "round-1.data.json",         // required when n > 1, else null
  "prevAnswers": "round-1.answers.md"  // the VERBATIM paste-back. Parsed. No answers file, no next round.
}
```

The engine derives its `localStorage` key from this: `<project>-r<n>[-v<revision>]-scoping-v1`. That
is why rounds cannot silently inherit each other's answers, and why `revision` matters — republishing
an *edited* round 2 under the same number would otherwise rehydrate the first draft. The theme
preference stays project-wide, since light-or-dark is a person's preference across rounds.

### `meta.scope`

Exactly five entries, in the order `goal, deliverable, boundary, verification, constraints`. Renders
as the panel above the toolbar: state pill, label, full text, and provenance.

```jsonc
{ "slot": "goal",
  "label": "What we're trying to achieve",   // display only, ≤40
  "state": "settled",                        // settled | open
  "text": "Log a finished book in under ten seconds, from your phone.",   // 25–240, plain language
  "evidence": ["r1:Q1", "r1:Q3"],            // r<n>:<qid> or r<n>:notes — resolved against the saved paste-back
  "kind": "new-project-plan",                // deliverable slot only; required once settled
  "kindOther": null,                         // required, 20–120, when kind is "other"
  "assumed": false,                          // true ⇒ "assumption" required, evidence may be empty
  "assumption": null,
  "reopened": null }                         // required when this slot regressed settled → open
```

### `meta.glossary`

`{ "term": "what it means, in plain words" }`, up to 10. Identifier-shaped terms are allowed only in
a question's `example` and an option's `detail`; each one needs an entry here, and every entry must
be used. Renders as a term list at the foot of the scope panel.

### `meta.context`

All optional; the accordion auto-hides if nothing is present.

- `title` — the accordion label.
- `note` — one framing paragraph.
- `cards[]` — an auto-fitting grid of `{title, body, foot}`. A stage, subsystem or domain map.
- `blocks[]` — labeled blocks rendered in order, each `{heading, type}`:
  - `list` — `items[]` of `{term, desc}` → a definition list.
  - `diagram` — `lines[]` of monospace text; `~…~` highlights, `**…**` bolds.
  - `prose` — a `text` paragraph.

## `sections[]`

`{id, title}`. `id` is the short nav tag and the export heading. Unique. Questions whose `section`
matches nothing collect under a trailing **Other** block.

## `questions[]`

Rendered in this order — the question comes **last**, once the reader has what they need to answer it.

| Field | | |
|---|---|---|
| `id` | ✓ | Unique, e.g. `Q1`. Appears on the card, in the export, and in evidence refs. |
| `section` | ✓ | Must match a `sections[].id`. |
| `slot` | ✓ | Which scope slot this feeds. Must be a slot that is **open**. |
| `context` | ✓ | 40–240. Why this is on the table, in the reader's terms. Renders first. |
| `breakdown` | ✓ | **An array** of 2–3 items, 20–140 each. The decision decomposed. Renders as a list. |
| `technical` | ✓ | Boolean. `true` requires `example`; `false` forbids the key entirely. |
| `example` | | ≤200. Present **iff** `technical`. Concrete and everyday. |
| `question` | ✓ | ≤100, ends in `?`. |
| `why` | ✓ | 30–200. Why the recommendation wins, and what it costs. |
| `switchIf` | ✓ | 20–140. The runner-up condition. |
| `rec` | ✓ | The pre-selected default. One key, or an array for `multi`. May be any option. |
| `multi` | | `true` → checkboxes. Default single-select. |
| `options` | ✓ | 2–4 `{key, label, detail}`. `label` ≤7 words, ≤48 chars, and none of `/ ; \| [ ]`. `detail` 15–140, required. |

**The engine adds what the data must never declare:** the *In my own words* option, the *This
doesn't make sense* control, the flag, the per-question copy button, the note box, the fixed
rejection sentence, and the tag vocabulary. They are a parse contract — letting a run restyle them
would let a run break it.

## State, counts, export

Four states form a **partition** — `DEFAULT`, `CHANGED`, `OWN`, `REJECTED` — and `FLAGGED` is
orthogonal to all four. "Answered" means reviewed **and not rejected**, so the progress bar cannot
read complete while a question is still rejected, and "Accept all defaults" skips rejected ones.

Everything persists to `localStorage` under the derived slug.

**Copy answers for Claude** produces the export below; **Download JSON** produces a structured
answers file, falling back to the modal where a sandbox blocks the download.

```
# <title> — round <n> of <of>: answers
scope-id: <project> · r<n>/<of> rev <revision>

Summary: A default · B changed · C in own words · D rejected · E flagged · F/N answered.
Readiness this round: <slot label> ✓ · <slot label> — · …
(✓ = every question feeding that slot is answered and none rejected.)

## A. <section title>
- Q1 [CHANGED] (boundary) B: <label>   (rec was A: <label>)
- Q2 [DEFAULT · FLAGGED] (goal) A: <label>
    note: <user note>
- Q3 [OWN] (goal) C: <label> | OWN: in my own words   (rec was A: <label>)
    own words: <what they actually wrote>
- Q4 [REJECTED] (verification) no answer — this question did not make sense to me
    asked: <the question, verbatim>

## Overall notes / new questions
<text or (none)>

---
<closingAsk>
```

This is a **parse contract**, not a formatting preference — `megascope.mjs` reads it back to resolve
every evidence claim a later round makes. Option labels are pattern-banned from carrying the
delimiters, and every continuation value has its whitespace collapsed, so no author or user text can
forge the tag brackets, the `" | "` join, or the three-space `(rec was …)`. Line 2's **absence**
identifies a pre-v2 export.

Continuations are exactly four spaces, in fixed order: `own words:` → `asked:` → `note:`.
`own words:` appears iff `OWN` (never empty — it falls back to `(nothing written yet)`), `asked:`
iff `REJECTED`, and `note:` whenever there is one, in any state. **The note is never the answer** —
that is what `own words:` is for.

## Theme tokens

The shell defines a full neutral palette and a default accent for light and dark. `meta.theme.accent`
(one hex) overrides the **accent family** via `color-mix()` in both themes; `neutralBias` nudges the
neutrals warm or cool; `serif`/`sans`/`mono` override the font stacks. Text-on-accent is chosen by
luminance. The semantic colors — flagged, answered, needs-explaining — are fixed: they carry meaning,
not brand. See `theming.md`.
