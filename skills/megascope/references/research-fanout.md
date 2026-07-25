# Research fan-out & synthesis

The defaults in the scoping doc are only as good as the research behind them. Fan out to cover the domain, converge to a synthesis, then turn the synthesis into questions.

## Scale to complexity

| Signal | Fan-out |
|---|---|
| Familiar domain, small surface | None — draft questions from what you know. |
| Moderate; some unknowns | 3–5 parallel researchers, one synthesis pass. |
| Large/unfamiliar codebase or domain; contested best practices | 8–12+ researchers across facets; a dedicated synthesis agent; consider a second pass on the riskiest facet. |

Announce the scale you chose. Don't silently under-research a complex ask.

## Facets to split by

Pick the axes that matter for the subject. Common ones:
- **Codebase** — architecture, entry points, the types/handlers the build must use, existing conventions (cite `file:line`).
- **Domain mechanics** — the real rules/constraints/formulas that decide strategy.
- **Prior art** — how others solved it; community wisdom (tag `[COMMUNITY]` vs `[INFERENCE]`).
- **Constraints & non-goals** — platform, stack, timeline, budget, legal/ethical limits.
- **Risks & unknowns** — the things that need a spike, and the contradictions between sources.

## With a Workflow (preferred)

Invoking `/megascope` is your opt-in to orchestrate. Use a **pipeline**: dossier-writers run in parallel, each feeding a synthesis stage. Sketch:

```js
// phase 1: parallel dossiers  ·  phase 2: one synthesis → 3 artifacts
const FACETS = [ /* {key, prompt} per facet above */ ];
const dossiers = await parallel(FACETS.map(f => () =>
  agent(f.prompt + ' Write a dossier grounded in real sources; cite file:line for code; tag community/inference claims.',
        { label: 'research:' + f.key, phase: 'Research' })));
const synthesis = await agent(
  'Consolidate these dossiers into (1) a deduplicated master dossier with contradictions resolved against ground truth, ' +
  '(2) an OPEN-QUESTIONS list — each a decision with 2–4 concrete options, a ★ recommended default, and a one-line rationale, ' +
  '(3) a proposed phase plan (ordered so each phase proves architecture before scaling; mark the Phase-1/MVP boundary). ' +
  'Dossiers:\n\n' + dossiers.filter(Boolean).join('\n\n---\n\n'),
  { label: 'synthesis', phase: 'Synthesis', schema: SYNTHESIS_SCHEMA });
```

Give the synthesis a schema so it returns structured open-questions you can map straight into the questions-JSON.

## Without a Workflow (degrade)

Fire a batch of parallel `Agent` calls (one per facet) in a single message, then synthesize yourself. For a small job, just research inline. The pipeline shape is the same; only the harness changes.

## The three synthesis artifacts

Mirror the gold-standard reference (the worked example under `examples/` is built from exactly these):

1. **Master dossier** — canonical, deduplicated facts. Numbers verified in source override web-derived numbers. A contradiction table (what conflicted, how it resolved, evidence).
2. **Open questions** — the raw material for `questions[]`. Each: 2–4 concrete options, a ★ recommended default, a one-line rationale that names the tradeoff and the runner-up condition. Group by area.
3. **Phase plan** — architecture-at-a-glance, phase-by-phase goals + exit criteria, an explicit Phase-1/MVP boundary and an out-of-MVP list.

## Quality bar

- **Cite.** Code claims get `file:line`; external claims get a source and a `[COMMUNITY]`/`[INFERENCE]` tag.
- **Resolve contradictions**, don't average them. Prefer ground truth (the actual source/spec) over secondary summaries; record the resolution.
- **Flag genuine unknowns** as spikes with a cheap way to settle them (e.g. "capture 3–5 live samples to fit the proxy"), and surface them as their own scoping section.
- **Verify** load-bearing recommendations before you default to them — a wrong default that looks authoritative is worse than an open question.
