#!/usr/bin/env node
// dev.mjs — live engine preview. Watches the engine shell + a sample dataset and
// rebuilds scratch/preview.html on every save. Zero deps (node built-ins).
//
//   npm run dev                 # uses tests/fixtures/rich.data.json as sample data
//   node scripts/dev.mjs <data.json>
//
// Open the printed file in your browser; refresh after a save to see changes.
// (Editing SKILL.md / references/ is prompt work — dogfood those live; this loop
//  is for the engine + questions-JSON, which render without Claude.)

import { watch } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename, relative } from 'node:path';
import { injectData } from './inject.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENGINE = resolve(ROOT, 'skills/megascope/assets/engine.html');
const DATA = resolve(ROOT, process.argv[2] || 'tests/fixtures/rich.data.json');
const OUT = resolve(ROOT, 'scratch/preview.html');

let building = false, again = false;
async function build() {
  if (building) { again = true; return; }
  building = true;
  try {
    const [engine, raw] = await Promise.all([readFile(ENGINE, 'utf8'), readFile(DATA, 'utf8')]);
    let data;
    try { data = JSON.parse(raw); }
    catch (e) { console.error(`✗ invalid JSON in ${basename(DATA)}: ${e.message}`); return; }
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, injectData(engine, data), 'utf8');
    console.log(`✓ ${relative(ROOT, OUT)}  (${new Date().toLocaleTimeString()})`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
  } finally {
    building = false;
    if (again) { again = false; build(); }
  }
}

let timer = null;
const schedule = () => { clearTimeout(timer); timer = setTimeout(build, 120); };

await build();
console.log(`\n▶ live preview:  file://${OUT}`);
console.log(`  watching engine.html + ${basename(DATA)} — edit, save, refresh the tab. Ctrl-C to stop.\n`);

// Watch the containing dirs (survives editor save-and-replace), filter to our files.
for (const f of [ENGINE, DATA]) {
  watch(dirname(f), (_evt, name) => { if (name === basename(f)) schedule(); });
}
