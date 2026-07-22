#!/usr/bin/env node
// build-doc.mjs — inject a questions-JSON into the engine shell and write a
// standalone scoping HTML. Mirrors exactly what a megascope run does.
//
//   node scripts/build-doc.mjs <data.json> [out.html]
//
// Default output: alongside the data file, as <name>.html.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { injectData } from './inject.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(__dirname, '../skills/megascope/assets/engine.html');

const dataPath = process.argv[2];
if (!dataPath) {
  console.error('usage: node scripts/build-doc.mjs <data.json> [out.html]');
  process.exit(2);
}
const outPath = process.argv[3] || dataPath.replace(/\.data\.json$|\.json$/i, '') + '.html';

const engine = await readFile(ENGINE, 'utf8');
const raw = await readFile(dataPath, 'utf8');
let data;
try { data = JSON.parse(raw); }
catch (e) { console.error('Invalid JSON in ' + dataPath + ': ' + e.message); process.exit(1); }

const html = injectData(engine, data);
await writeFile(outPath, html, 'utf8');

const nQ = Array.isArray(data.questions) ? data.questions.length : 0;
const nS = Array.isArray(data.sections) ? data.sections.length : 0;
console.log(`wrote ${outPath}  (${nS} sections · ${nQ} questions)`);
