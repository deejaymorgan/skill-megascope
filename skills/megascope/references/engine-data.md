# Engine data contract

How `assets/engine.html` consumes a questions-JSON. The shell renders **everything** from the JSON in its `<script type="application/json" id="scoping-data">` block — title, header, intro, constraints, context, sections, cards, export, and theme. `assets/schema.json` is the machine-checkable version of this document.

## Injection

The shell ships with an empty data block:

```html
<script type="application/json" id="scoping-data">{}</script>
```

A run replaces **only that block's contents** with its JSON. Use `node scripts/build-doc.mjs <data.json> <out.html>`, or do it by hand. Everything else in `engine.html` is byte-identical every run. Opened with the empty `{}` (or invalid JSON), the shell shows a friendly "no data loaded" state instead of erroring.

The page has no `<!doctype>/<html>/<head>/<body>` wrapper, so the same file works as a **standalone `.html`** and as an **Artifact source**. It declares `<meta charset="utf-8">` first, so smart quotes / em-dashes / emoji render correctly over `file://`, HTTP, and Artifacts.

## Inline markup

Every display string is HTML-escaped, then a tiny formatter runs. Use it sparingly:

| Write | Renders |
|---|---|
| `**bold**` | **bold** |
| `` `mono` `` | monospace span |
| `~highlight~` | accent-colored span |

## `meta`

| Field | Required | Renders as |
|---|---|---|
| `project` | ✓ | Slug. Keys `localStorage` (`<project>-scoping-v1`, `<project>-scoping-theme`), the download filename, and the answers-JSON `meta.project`. |
| `title` | ✓ | Header title + `<title>` + export header (`# <title> — scoping answers`). |
| `subtitle` | | Small uppercase label under the title. Default `Scoping & planning`. |
| `favicon` | | 1–2 emoji for the header mark. Also pass it as the Artifact `favicon`. Omitted → a generic drawn mark. |
| `eyebrow` | | Mono label above the headline. Default auto-derives `Scoping document · N areas · M decisions`. |
| `headline` | | Serif intro headline. |
| `lede` | | Intro paragraph (supports `**bold**`). |
| `legend` | | Overrides the sidebar "How to read this" note. |
| `steps[]` | | The numbered process steps under the lede. Default is the standard 4. |
| `overallNotesTitle` / `overallNotesHint` | | Heading + sub-copy for the free-text catch-all box. |
| `closingAsk` | | Final line of the export (what you want back). |
| `constraints[]` | | Check chips = already-decided facts. `{label,text}` or a bare string. |
| `context` | | The collapsible panel (below). Hidden entirely if empty. |
| `theme` | | Personality (see `theming.md`). |

## `meta.context`

All optional; the accordion auto-hides if nothing is present.

- `title` — the summary/accordion label (default `Project context`).
- `note` — one framing paragraph.
- `cards[]` — an auto-fitting card grid; each `{title, body, foot}`. Use for a stage/subsystem/persona/domain map.
- `blocks[]` — labeled blocks rendered in order, each with a `heading` and a `type`:
  - `phases` — `items[]` of `{key, label, desc}` → a keyed phase list (great for the proposed build phases).
  - `list` — `items[]` of `{term, desc}` → a definition list.
  - `diagram` — `lines[]` of monospace text; `~…~` highlights, `**…**` bolds. Good for an architecture sketch.
  - `prose` — a `text` paragraph.

## `sections[]`

`{id, title}`. `id` is the short nav tag (e.g. `A`), must be unique. Order = display + nav + export order.

## `questions[]`

`{id, section, question, why, rec, options[], multi?}`.

- `id` — unique; shown on the card and in the export.
- `section` — must match a `sections[].id`; unknown ids collect under a trailing **Other** section (non-fatal).
- `question` — the decision as a short question.
- `why` — one-line rationale. Strongly recommended; it's what makes the doc trustworthy.
- `options[]` — 2–5 `{key, label, detail}`. `key` unique within the question.
- `rec` — the **pre-selected** default. A single key for single-select; a key **or array of keys** for `multi`. Every key must be a real option. May be any option, not just the first.
- `multi` — `true` → checkboxes (multi-select). Default single-select radio.

## State, counts, export

- On load, each question is set to `rec` and marked *not reviewed*. Selecting an option, adding a note, flagging, or "Accept all defaults" marks it reviewed.
- Live counts: **changed** (choice ≠ rec), **flagged**, **reviewed / total**. Section nav shows a "touched" badge (changed or flagged) per section.
- Per-question controls: radio/checkbox options, **Add note**, **Flag for follow-up**, **Reviewed**. Status chip + left-border reflect state (default / changed / ⚑ flagged).
- Persistence: all state in `localStorage` under `<project>-scoping-v1`; theme under `<project>-scoping-theme`.
- **Copy answers for Claude** → a modal with parseable markdown and a clipboard copy. **Download JSON** → a structured answers file. Export shape:

```
# <title> — scoping answers

Summary: X changed · Y flagged for follow-up · Z/N reviewed.
(Questions not marked CHANGED keep the recommended default.)

## A. <section title>
- Q1 [CHANGED] B: <label>   (rec was A: <label>)
- Q2 [default · ⚑ FOLLOW-UP] B: <label>
    note: <user note>
...

## Overall notes / new questions
<text or (none)>

---
<closingAsk>
```

Parse it by scanning `- <id> [<tags>] <KEY>: …` lines; `CHANGED` and `⚑ FOLLOW-UP` are the two you act on, plus `note:` lines and the overall-notes block.

## Theme tokens

The shell defines a full neutral palette + a default blue accent for light and dark. `meta.theme.accent` (one hex) overrides the **accent family** via CSS `color-mix()` in both themes; `neutralBias` nudges the neutrals warm/cool; `serif`/`sans`/`mono` override the font stacks. Text-on-accent color is auto-chosen by luminance for contrast. See `theming.md`.
