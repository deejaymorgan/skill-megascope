#!/usr/bin/env node
// build-doc.mjs — thin repo-side wrapper. The build itself (validate, then
// inject, then write) ships inside the skill:
//
//   node skills/megascope/assets/megascope.mjs build <data.json> [out.html]
//
// This wrapper exists so `npm run build` and the dev scripts keep working.

import { buildDoc } from '../skills/megascope/assets/megascope.mjs';

const dataPath = process.argv[2];
if (!dataPath) {
  console.error('usage: node scripts/build-doc.mjs <data.json> [out.html]');
  process.exit(2);
}

const r = buildDoc(dataPath, process.argv[3]);
if (!r.ok) {
  console.error(`✗ ${dataPath} — refusing to build`);
  for (const e of r.structural) console.error(`  ✗ ${e.message}`);
  for (const f of r.semantic) console.error(`  ✗ ${f.id} · ${f.message}`);
  process.exit(1);
}
console.log(`wrote ${r.out}  (${r.sections} sections · ${r.questions} questions)`);

export { buildDoc };
