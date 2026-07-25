---
name: megascope
description: >-
  Drive a fuzzy project request to an agreed phased plan with a detailed MVP, via
  upfront clarification, parallel research, and a polished interactive HTML scoping
  document the user fills in and pastes back. Use when the user wants to scope, plan,
  or spec a non-trivial project — "scope this", "help me plan X", "turn this idea
  into a build plan", "what should the MVP be", "let's figure out requirements before
  building". Especially strong for technical/software builds (research fan-out, phased
  plans, MVP boundary), but works for any substantial project.
---

# megascope — interactive project scoping

Turn a vague request into a **phased build plan with a detailed Phase-1/MVP** by (1) clarifying up front, (2) researching in parallel, and (3) handing the user a **polished, theme-aware interactive scoping document** where every decision is pre-set to a recommended default. The user reviews/overrides/flags, clicks **Copy answers for Claude**, pastes back; you resolve follow-ups and deliver the plan.

The document is produced by a **data-driven engine**: one static HTML shell (`assets/engine.html`) fed a per-run **questions-JSON**. Each run generates *only the JSON* — never bespoke HTML. That is the core efficiency win and the thing to protect.

## Operating rules (read first)

- **Files.** The engine shell, schema, and playbook sit alongside this skill: `assets/engine.html`, `assets/schema.json`, and `references/`. (The worked example and the `build-doc.mjs` helper live in the megascope repo — `examples/` and `scripts/` — useful when developing, not needed at run time.)
- **Never edit the engine shell for a run.** Generate the questions-JSON, then produce the doc by taking `assets/engine.html` and replacing ONLY the contents of its `<script id="scoping-data">` block with your JSON: Read the engine, write the combined result into the target project. (Working in the repo, `node scripts/build-doc.mjs <data.json> <out.html>` does exactly this.)
- **Validate every JSON** against `assets/schema.json` before building; a malformed block makes the engine fall back to its empty state.
- **Recommendation-first, always.** Every question ships pre-answered with a `rec` and a one-line `why`. The user's job is to *review*, not to author. A blank-looking question is a bug.
- **Don't re-ask what's decided.** Constraints the user already fixed become `meta.constraints` chips, not questions.
- **The engine is untouched, tasteful, and self-contained.** Personality comes from `meta.theme` (usually one accent hex) + the content — not from editing the shell.

## The pipeline

### 0 · Intake & clarify
Read the request. Pin the **subject, goal, audience, and the single job** of the scoping doc. List the facts already decided (these become constraints, not questions).

If the request is underspecified in ways that would **change the research direction**, ask **2–4 high-leverage clarifications** with `AskUserQuestion` — multiple choice, recommended option first, always a free-text escape. Good clarifiers resolve forks like: platform/target, the metric of success, hard constraints (stack, timeline, budget), or scope ceiling. Skip clarifiers that don't change what you'd research or recommend — pick a sensible default and note it instead.

### 1 · Research fan-out
Scale research to complexity:

| Complexity | Approach |
|---|---|
| Trivial / well-understood | Skip fan-out; draft questions directly from what you know. |
| Moderate | 3–5 parallel researchers, each a facet; one synthesis pass. |
| Complex / unfamiliar codebase or domain | 8–12+ researchers across code, domain, prior art, constraints, risks; a dedicated synthesis agent. |

Prefer a **`Workflow`** (invoking this skill is your opt-in to orchestrate) with a **pipeline**: parallel dossier-writers → a synthesis stage. If `Workflow` is unavailable, **degrade gracefully** to a batch of parallel `Agent` calls (or, for small jobs, research inline yourself).

Each researcher writes a **dossier** grounded in real sources (cite `file:line` for code; tag community/inference claims; resolve contradictions against ground truth). The synthesis stage consolidates them into three artifacts — the same shape as the gold-standard reference:

1. **Master dossier** — deduplicated canonical facts, contradictions resolved.
2. **Open questions** — each a decision with **2–4 concrete options, a ★ recommended default, and a one-line rationale**. This *is* the raw material for the questions-JSON.
3. **Proposed phase plan** — phases ordered so each proves architecture before scaling, with a Phase-1/MVP boundary.

See `references/research-fanout.md` for workflow patterns and the dossier/synthesis format.

### 2 · Build the scoping doc
Transform the synthesis into the **questions-JSON** (`assets/schema.json`):

- Map open-questions → `questions[]` (`id`, `section`, `question`, `why`, `rec`, `options[]`). Follow `references/writing-questions.md` — concrete options, the runner-up condition in the `why`, `rec` may be any option.
- Group questions into `sections[]` (digestible areas, ~4–8).
- Fill `meta`: title/subtitle/favicon, headline, lede, the already-decided `constraints` chips, and a `context` panel (a `note`, `cards` for a domain/stage map, and `blocks` for the proposed phases + an architecture diagram).
- Pick a **subject-grounded `theme.accent`** (one hex → the whole palette) + optional `neutralBias`/fonts. See `references/theming.md`.
- Save `<project>.scoping.data.json`, then build the HTML by injecting it into `assets/engine.html` — replace the `<script id="scoping-data">` block and write the copy into the target project (e.g. `docs/scoping/`). Repo helper: `node scripts/build-doc.mjs path/to/scoping.data.json path/to/scoping.html`.
- **Publish as an Artifact.** Load the `artifact-design` skill for calibration (the shell is already tasteful; keep it so). The engine omits `<!doctype>/<html>/<head>/<body>`, so it is Artifact-ready as-is. Pass `favicon` from `meta.favicon`, a stable `title`, and a one-line `description`.
- Hand the user the link with a one-line instruction: *review the defaults, change/flag/note what matters, then click "Copy answers for Claude" and paste it back here.*

`references/engine-data.md` is the exact data contract (how each field renders, the inline markup, the injection point).

### 3 · Round-trip
The user reviews in the doc and pastes the **Copy answers for Claude** export back into chat. It is clean, parseable markdown: a summary line, per-section `- Qid [CHANGED|default · ⚑ FOLLOW-UP] KEY: label (rec was …)` lines, `note:` lines, an overall-notes block, and a closing ask.

### 4 · Follow-up loop
Parse the export. Then:
- Confirm the **CHANGED** choices (note anything they imply for the plan).
- For every **⚑ FOLLOW-UP** and any ambiguous note, ask **targeted** follow-ups — in chat for a few, or a small follow-up scoping doc if there are many. Resolve the overall-notes / new questions too.
- Iterate until nothing is open.

### 5 · Deliver the plan
Produce the **phased build plan + detailed Phase-1/MVP requirements**, reflecting the chosen options — in the style of a `PHASE-PLAN.md`: an architecture-at-a-glance, phase-by-phase goals with exit criteria, a detailed MVP checklist, an explicit *out-of-MVP* list, and sequencing/risk notes. Save it into the project.

## Degradation & edge cases
- **No `Workflow`:** use parallel `Agent` calls; for tiny projects, research inline and skip fan-out.
- **User wants to skip research:** go straight to a questions-JSON from your own knowledge — still recommendation-first.
- **Very small project:** fewer sections/questions is fine; the value is the recommendation-first round-trip, not volume.
- **Re-scoping after paste-back:** you can regenerate a *follow-up* doc with only the unresolved questions (new `project` slug suffix, e.g. `-followup`, to keep separate localStorage).

## Files (alongside this skill)
- `assets/engine.html` — the static, data-driven shell. **Do not edit per run.**
- `assets/schema.json` — the questions-JSON schema (validate against this).
- `references/{writing-questions,research-fanout,theming,engine-data}.md` — playbook.

In the megascope repo (development only): `examples/` (worked example), `scripts/build-doc.mjs` (injection helper), `tests/smoke.mjs` (render + round-trip test).
