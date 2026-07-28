#!/usr/bin/env node
// screenshot.mjs — regenerate the README images from the worked example.
//
// A screenshot in a README rots: the engine changes, the picture doesn't, and the
// first thing a new reader sees is a version that no longer exists. So the images
// are built rather than taken — `npm run screenshot` reproduces all four from
// examples/reading-log/round-1.data.json, and the check below refuses to write a
// shot of a page that logged an error or failed to render its cards.
//
// Two frames, each in light and dark, wired into the README as <picture> elements
// so they follow the reader's own theme:
//
//   document-*.png   the top of a round — masthead, what's already decided, and
//                    the running scope panel
//   question-*.png   one question card — the recommendation, the why, the escapes
//
// Playwright is not a dependency of this repo: it is a heavy install that only this
// script needs. Install it locally (`npm i --no-save playwright`) or have it on your
// global path; the script says so if it can't find it.
//
// Run: `npm run screenshot`

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = resolve(ROOT, 'examples/reading-log/round-1.data.json');
const BUILT = resolve(ROOT, 'scratch/round-1.html');
const OUT = resolve(ROOT, 'docs/images');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'screenshot: playwright not found.\n' +
    '  npm i --no-save playwright   (browsers: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 if you already have one)',
  );
  process.exit(1);
}

// 1 · Build the document the same way a run does — via the shipped tool, so the
//     picture can only ever show a round that actually validates.
await mkdir(resolve(ROOT, 'scratch'), { recursive: true });
execFileSync('node', [resolve(ROOT, 'skills/megascope/assets/megascope.mjs'), 'build', DATA, BUILT], {
  stdio: 'inherit',
});

// 2 · Serve it. The engine renders everything from its data block at run time, so
//     over file:// the page's JS never runs and every shot would be an empty shell.
const html = await readFile(BUILT);
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const FRAMES = [
  // The top of the document: everything above the first question.
  { name: 'document', viewport: { width: 1280, height: 1180 }, clip: { x: 0, y: 0, width: 1280, height: 1180 } },
  // One card, tight — this is the claim the whole design rests on. The action bar is
  // fixed to the viewport, so it overlaps the bottom of the crop; hide it for this
  // frame only, where it is an artefact of cropping rather than part of the card.
  { name: 'question', viewport: { width: 1280, height: 900 }, selector: '#card-Q1', hide: '#actionbar' },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
let wrote = 0;

for (const frame of FRAMES) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: frame.viewport,
      deviceScaleFactor: 2,
      colorScheme: scheme,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();

    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('#card-Q1');
    await page.waitForTimeout(300);

    // A blank shell renders fine and looks like a working page in a thumbnail. Check
    // the engine actually built the document before writing anything to disk.
    const cards = await page.locator('article.q').count();
    if (errors.length) throw new Error(`${frame.name}/${scheme}: page logged errors — ${errors.join(' | ')}`);
    if (cards !== 5) throw new Error(`${frame.name}/${scheme}: expected 5 question cards, rendered ${cards}`);

    if (frame.hide) await page.addStyleTag({ content: `${frame.hide} { visibility: hidden !important }` });

    const path = resolve(OUT, `${frame.name}-${scheme}.png`);
    if (frame.selector) await page.locator(frame.selector).screenshot({ path });
    else await page.screenshot({ path, clip: frame.clip });

    console.log(`  ✓ docs/images/${frame.name}-${scheme}.png`);
    wrote++;
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log(`\n${wrote} images written to docs/images/`);
if (!existsSync(resolve(ROOT, 'README.md'))) process.exit(1);
