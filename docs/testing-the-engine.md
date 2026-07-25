# Testing the engine in a browser

`npm test` covers the machinery headlessly (jsdom render + schema validation + export round-trip).
This file is for the things only a real browser shows: layout, light/dark, focus rings, and the
sandbox behaviours an Artifact imposes.

## Serve over HTTP — never open `file://`

**The in-app browser renders a `file://` URL as a static snapshot. Page JavaScript does not run.**
The engine renders *everything* from its data block at run time, so over `file://` you are looking at
an empty shell: no cards, no counters, and `read_console_messages` / `javascript_tool` report stale or
empty state. It looks like the engine is broken when nothing is wrong.

Serve the directory first, then navigate to the localhost URL:

```bash
python3 -m http.server 8137
```

Then open `http://localhost:8137/<path>/<file>.html`. Console reads and JS evaluation work against the
live page from there.

`scripts/dev.mjs` (`npm run dev`) writes its preview to `scratch/preview.html` — same rule applies to
that file.

## Charset

Standalone HTML must declare `<meta charset="utf-8">` first. Serving over HTTP without it made
UTF-8 decode as Latin-1 — mojibake in smart quotes, em-dashes and emoji. The engine already declares
it (`skills/megascope/assets/engine.html`); keep it first in the file.

## What only a browser can tell you

- **Light *and* dark.** The theme is driven by one accent hex through `color-mix()`; a palette that
  reads well in one mode can fail in the other. Check both.
- **Keyboard focus.** Option inputs are visually hidden, so the focus ring has to be drawn on the
  wrapper. Tab through a section and confirm the ring is actually visible.
- **Artifact sandbox.** In a sandboxed iframe `confirm()` silently returns undefined, so a reset
  guarded by it fires immediately; `URL.createObjectURL` downloads may be blocked outright. Verify
  reset and Download JSON in a **real** Artifact, not just locally — locally they both work and tell
  you nothing.
