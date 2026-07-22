# Example input request

The fuzzy request that this worked example was scoped from:

> I want to build a bot that speedruns the browser game *Universal Paperclips* —
> plays it start to finish as fast as possible, legitimately (reading game state
> and clicking the real controls, no save-editing). I'd also like an offline
> simulator so I can tune strategy without playing live runs, and it should be
> tweakable with some telemetry so I can see what it's doing. Goal is to reach the
> true ending (all three stages). Help me figure out the plan and where to start.

## What megascope did with it

1. **Intake** — pinned the subject (a legit-play speedrun bot + offline simulator), the
   goal (true ending, all 3 stages), and the already-decided facts (legit play, in-page
   TypeScript, offline sim + live validation, tweakable + telemetry). Those became the
   `meta.constraints` chips — **not** questions.

2. **Research fan-out** — parallel researchers dissected the game's actual source
   (`main.js`, `projects.js`, `combat.js`) and the community's speedrun wisdom, then a
   synthesis pass produced a master dossier, a decision-oriented open-questions list, and
   a proposed phase plan. (The gold-standard synthesis this example was distilled from
   lives in `/Users/daniel/Dev/paperclips/docs/research/`.)

3. **Build** — the open-questions became [`scoping.data.json`](scoping.data.json): 7
   sections, 31 recommendation-first questions, a context panel (the three game stages, the
   proposed build phases, and the shared-core architecture), and a steel-blue theme.
   Injecting it into the engine shell produced [`scoping.html`](scoping.html).

4. **Round-trip → plan** — the user reviews the defaults, changes/flags/notes, clicks
   **Copy answers for Claude**, and pastes back; megascope resolves follow-ups and returns
   the phased build plan + detailed Phase-1/MVP requirements.

## Rebuild the HTML

```bash
node tests/build-doc.mjs examples/paperclips/scoping.data.json examples/paperclips/scoping.html
```
