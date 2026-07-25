# Research, per round

The recommendations in a round are only as good as the research behind them. But research is sized
**per round**, not once up front — spending eight researchers before anyone has agreed the goal
spends them on the wrong layer.

## Round 1 is capped light, on purpose

`meta.research.mode` may only be `none` or `light` when `n` is 1. `light` means up to 3 parallel
readers, no synthesis agent, no dossier.

Round 1 asks what the thing is for and what kind of work it is. That rarely needs deep work, and
making the user wait for it defeats the point of splitting rounds at all.

## From round 2, size it off what the last export opened

Record the specific triggers in `research.trigger[]` — an open slot, a `REJECTED` id, an `OWN`
answer that went somewhere you didn't offer, a note raising something new. Then:

| Signal | Fan-out |
|---|---|
| The layer is familiar and the answers were unsurprising | `light` — read what you need, no dossier |
| Real unknowns, a codebase to read, contested practice | `deep`: one researcher per planned `technical: true` question, plus one per unresolved rejection, capped at 8 |
| Above 5 researchers | add a dedicated synthesis agent |

`mode: "deep"` must name at least 3 `sources`. Announce the scale you chose; don't silently
under-research a hard round.

**Mechanically tied:** a question marked `technical: true` requires an `example` *and* cannot exist
with `mode: "none"`. A technical question cannot exist unresearched.

## Facets to split by

Pick the axes that matter for **this round's open slots**:

- **Codebase** — architecture, entry points, the conventions the work must fit (cite `file:line`).
- **Domain mechanics** — the real rules and constraints that decide the answer.
- **Prior art** — how others solved it; tag `[COMMUNITY]` vs `[INFERENCE]`.
- **Constraints** — platform, stack, timeline, budget, legal.
- **Risks** — what needs a spike, and where sources contradict each other.

## With a Workflow

Invoking `/megascope` is your opt-in to orchestrate. Use a **pipeline**: readers in parallel,
feeding a synthesis stage.

```js
// one researcher per open slot this round, then a synthesis pass
const FACETS = [ /* {key, prompt} per facet above */ ];
const dossiers = await parallel(FACETS.map(f => () =>
  agent(f.prompt + ' Write a dossier grounded in real sources; cite file:line for code; ' +
        'tag community/inference claims.', { label: 'research:' + f.key, phase: 'Research' })));
const synthesis = await agent(
  'Consolidate these into (1) a deduplicated master dossier with contradictions resolved against ' +
  'ground truth, (2) an OPEN-QUESTIONS list — each a decision with 2-4 concrete options, a ★ ' +
  'recommended default, a one-line rationale and the condition under which you would switch, and ' +
  '(3) a proposed update to the open scope slots: for each one, what the research says it should ' +
  'now say. Dossiers:\n\n' + dossiers.filter(Boolean).join('\n\n---\n\n'),
  { label: 'synthesis', phase: 'Synthesis', schema: SYNTHESIS_SCHEMA });
```

Give the synthesis a schema so it returns structured open-questions you can map straight into the
round's `questions[]`.

**Without a Workflow:** fire a batch of parallel `Agent` calls in one message and synthesize
yourself. For a small round, research inline. The shape is the same; only the harness changes.

## The three synthesis artifacts

1. **Master dossier** — canonical, deduplicated facts. Numbers verified in source beat numbers from
   summaries. Record what conflicted and how it resolved.
2. **Open questions** — the raw material for `questions[]`. Each needs 2–4 concrete options, a
   recommendation, a rationale, and a real switch condition.
3. **A proposed update to the open scope slots** — for each open slot, what the research says its
   `text` should now say, and what still has to be asked.

## The stop rule

Research for a round stops when every planned question has a `why` you could defend in under 200
characters and a `switchIf` naming a condition the user could recognise in their own situation.

If you can't write those two sentences, **that** is the thing to go and find out. If you still
can't after looking, the question isn't ready: leave its slot open and carry it to the next round.

## Quality bar

- **Cite.** Code claims get `file:line`; external claims get a source and a `[COMMUNITY]` /
  `[INFERENCE]` tag.
- **Resolve contradictions**, don't average them. Prefer the actual source over a summary of it.
- **Flag genuine unknowns** as spikes with a cheap way to settle them, and let them keep a slot open
  rather than pretending to a recommendation.
- **Verify anything load-bearing.** A wrong default that reads as authoritative is worse than an
  open question — the whole document is built to be trusted at a glance.
