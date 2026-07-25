# Writing questions worth pre-answering

The schema already enforces the **shape**: context, a breakdown of 2–3 items, an example when the
question is technical, the question itself, a `why`, a `switchIf`, 2–4 options with short labels
and real details. `build` refuses anything that misses. None of that is your problem any more.

**This file is only about the things a length check cannot see.** Everything below was doctrine
before and got ignored anyway — which is exactly why the rest of it became structure.

## Recommend, don't survey

Set `rec` to the option you would actually choose, and make the `why` defend it. `rec` may be
*any* option. If you genuinely have no view, you have not researched enough to ask yet — that is
what the stop rule in `rounds.md` is for.

Order options by **consideration, not preference**: put the natural first-thought option first, and
let the ★ tag mark the pick wherever it sits. Leading with the recommendation makes the others read
as decoration.

## `switchIf` is a real condition, not a hedge

The one sentence that lets a user override intelligently. It has to name a **circumstance they can
recognise in their own situation**:

> ✓ "Pick B if you want something usable this week and can live with dead spots."
> ✗ "Pick B if you prefer B." — restates the option
> ✗ "Pick B if that suits your needs better." — names nothing

If you can't write a real one, you don't understand the tradeoff yet.

## Write from the reader's side of the screen

The `context` says why this is on the table **in their terms** — what they said, what they will
run into. Not what the system does internally.

The `breakdown` is the decision decomposed, not a summary of the options. Each item is what
choosing that way actually means for them. Two items is usually right; three is the ceiling.

The `example` is for questions that are genuinely technical, and it earns its place by being
**concrete and everyday** — a real number, a real morning, a real thing they can picture. An
example that restates the question in the same register is worse than none.

## One decision per question

If a question hides two choices, split it. If two questions can't be answered independently, one
of them belongs in the next round — **no question inside a round may depend on another**, because
the user answers them in whatever order they like.

## Options are alternatives, not a spectrum

Name real approaches with real consequences. Each `detail` is one line of *consequence*, not a
restatement of the label.

Include an option you would not recommend when it is the honest alternative — a question with one
plausible option and two straw men is not a question. But don't pad to four: two good options beat
four where two are filler.

**Never write "It depends" as an option.** That is what the note, the flag and *In my own words*
are for, and the engine adds all three to every question already.

## Multi-select is rarer than it looks

Use `multi: true` only when the user genuinely picks a **set** — "which of these would you use".
A forced single choice produces a sharper decision, and most questions that feel like sets are
really one decision with a scope attached.

## The three escapes are not failure modes

Every question carries them, automatically:

- **In my own words** — the answer, in their language. It supersedes every option you offered. If
  it opens something this round didn't contain, that's a good outcome: it goes in the next round.
- **This doesn't make sense** — the user should never have to pick an option they don't understand.
  Write the `why` so a rejection means "I don't follow this", never "I don't follow *you*".
- **Flag** — a bookmark for their own workflow. They can copy the question out on its own, ask
  about it in a separate chat, and come back. The answer still stands; don't hold the round open.

Expect some of each. A round where nothing is changed, flagged or rejected usually means the
questions were too easy to be worth asking.

## Anti-patterns

- A `why` that restates the recommended option instead of defending it.
- Options that overlap, or that aren't real alternatives.
- Re-asking something already in `meta.constraints`.
- A question whose honest answer is "whatever you think" — that's a decision you should make and
  record in a slot, not a question.
- Splitting one decision across three questions to fill the round. Under-filling a round is fine.
