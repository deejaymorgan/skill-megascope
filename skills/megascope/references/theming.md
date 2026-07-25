# Theming

The engine shell is a deliberately quiet, tasteful neutral canvas. **Personality comes from `meta.theme` + the content**, not from editing the shell. In practice, one well-chosen accent carries the whole identity.

## `meta.theme`

```jsonc
"theme": {
  "accent": "#2C6BA6",     // one hex → the whole accent family, light + dark
  "neutralBias": "cool",   // "warm" | "cool" | "neutral" — subtle grounds temperature
  "serif": "…", "sans": "…", "mono": "…"   // optional font-stack overrides
}
```

Usually you set only `accent` (and maybe `neutralBias`). The engine derives `--accent`, `--accent-2`, `--accent-tint`, and `--accent-line` from the one hex via `color-mix()`, for **both** light and dark, and auto-picks readable text-on-accent by luminance. The semantic warn/ok colors stay fixed (they mean "flagged"/"reviewed", not brand).

## Choosing the accent (subject-grounded, not defaulted)

Pick a hue from the **subject's own world**, then keep everything around it quiet:
- An idle/incremental browser game → a steel/office blue (`#2C6BA6`).
- A CLI dev tool → terminal green (`#0E7C66`).
- A fintech ledger → deep indigo or gilt.
- A climate/maps project → a considered forest or ocean tone.

Avoid the current AI-design defaults — the cream-`#F4F1EA`-plus-terracotta look, the near-black-with-one-acid-pop look, the purple→blue gradient. If the subject genuinely suggests one of those, fine; otherwise spend the choice on something specific to the subject.

`neutralBias` nudges the grounds a touch **warm** or **cool** so the neutrals read as *chosen*, not defaulted — usually toward the accent's temperature (cool accent → `cool`, warm accent → `warm`).

## Fonts

Defaults are a serif display (Georgia stack), a system sans body, and a mono for tags/data — CSP-safe system stacks, no webfont URLs. Override only for a strong reason. If you want a distinctive face for an Artifact, inline it as a `@font-face` **data URI** inside the data (never link a CDN — the Artifact CSP blocks it and it fails silently to a fallback). Keep body text readable and near ~65 characters wide (the shell already caps measures).

## Contrast & both themes

- Every accent must stay legible on both grounds. The engine lightens the accent for dark mode automatically; if a very light or very dark accent looks off, nudge the hex rather than fighting the shell.
- Both light and dark are first-class — the shell defines full token sets for `prefers-color-scheme` and for the manual `data-theme` toggle in both directions. Don't ship a design that only looks right in one.
- Respect the existing project design system if the target repo has one (tokens/theme file) — its palette wins over your pick.

## Quick check

After building, open the HTML and toggle the theme (the moon/sun button, top-right). Both themes should look intentional, the accent should read clearly in each, and the neutrals should feel considered. The smoke test (`npm test`) confirms it renders without errors; your eye confirms it looks right.
