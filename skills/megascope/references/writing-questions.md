# Writing good scoping questions

The document's power comes from one move: **every decision is pre-answered with a recommended default and a reason.** The user reviews instead of authoring. Protect that. A question the user has to think hard to answer from scratch has failed.

## The shape of a good question

```jsonc
{
  "id": "Q7",
  "section": "B",
  "question": "How should combat be modeled?",          // a decision, phrased short
  "why": "Shipped combat is a 60fps boids sim; the closed-form formula is dead code. Full boids is expensive and combat is a late, bounded concern.",
  "rec": "a",                                            // the recommendation, pre-selected
  "options": [
    { "key": "a", "label": "Analytic proxy", "detail": "Attrition from force ratio + OODA, calibrated on a few live battles; accept honor divergence." },
    { "key": "b", "label": "Faithful boids reproduction", "detail": "Exact but heavy and hard to validate." },
    { "key": "c", "label": "Black box", "detail": "Bot just reacts; sim uses a tunable constant." }
  ]
}
```

## Rules

1. **Recommend, don't survey.** Set `rec` to the option you would choose, and make the `why` defend it. `rec` may be *any* option — put the strongest-considered option first in the list, but recommend whichever is actually best.
2. **The `why` carries the tradeoff — and the runner-up condition.** One line. State *why the rec wins* and, when useful, *when you'd switch* ("(c) both modes is ideal if you want fast search + validation; if forced to one, (a) preserves fidelity"). That single clause is what lets a user override intelligently.
3. **Options are concrete and mutually exclusive.** Name real approaches with real consequences — not "Option 1 / Option 2 / a more flexible approach". 2–4 is the sweet spot (max 5). Each `label` is a few words; each `detail` is one line of consequence.
4. **Ground them.** Options should reflect the research: cite the mechanism, the constraint, the prior art. Specific options are trustworthy; generic ones invite bikeshedding.
5. **Don't ask what's decided.** If the user already fixed it, it's a `meta.constraints` chip, not a question. If it's derivable from another answer, fold it in.
6. **One decision per question.** If a question hides two choices, split it.
7. **Order options by consideration, not by preference alone.** The first option is the natural anchor; the `★ Recommended` tag (driven by `rec`) marks the pick wherever it sits.

## Sections

Group into **4–8 digestible areas** with short titles (`Objective & metric`, `Bot architecture`, `Telemetry`, `Unknowns & spikes`). Put genuine unknowns/spikes in their own trailing section so they read as "these need a decision or a spike," not as settled design.

## Multi-select

Use `"multi": true` only when the user genuinely picks a **set** (e.g. "which inputs to support in v1"). Then `rec` can be an array of keys (multiple pre-checked). Most questions should stay single-select — a forced single choice produces sharper decisions.

## Flags vs decisions (design for the user's escape hatch)

The doc gives the user a **Flag for follow-up** control per question. That means you don't have to pre-resolve everything: it's fine to recommend a default *and* expect some to get flagged for discussion. Write the `why` so a flag is an informed "let's talk," not a confused "I don't get it."

## Anti-patterns

- A `rec` with no `why`, or a `why` that just restates the option.
- Options that overlap or aren't real alternatives.
- "It depends" as an option (that's what the note/flag is for).
- Re-asking a constraint.
- 15 options. If you have that many, it's a ranking/priority question — model it as one scored decision or split the section.
- Jargon the user won't recognize. Name things from the user's side of the screen.
