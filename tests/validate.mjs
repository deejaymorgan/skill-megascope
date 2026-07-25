#!/usr/bin/env node
// validate.mjs — the invalid corpus, asserted on the error path.
//
// "It failed" is not a passing test: a fixture that fails for the wrong reason
// proves nothing about the guarantee it was written for, and quietly keeps
// passing after that guarantee is removed. So every mutation names the failure
// it is supposed to provoke, and this asserts THAT failure specifically.
//
// Two halves, because the contract has two halves:
//   structural  ajv and the shipped walker must agree, keyword for keyword —
//               the differential test that keeps the walker honest about a
//               schema it interprets rather than re-encodes
//   semantic    the mutation is deliberately schema-VALID, so only the named
//               check (S1-S15) catches it. That it validates is asserted too:
//               if the schema started rejecting it, the check would stop being
//               exercised and would rot untested.
//
// Run: `npm test`.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Ajv from 'ajv';
import { MUTATIONS } from './fixtures/mutations.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCOPE = resolve(ROOT, 'tests/fixtures/scope');
const SCHEMA = resolve(ROOT, 'skills/megascope/assets/schema.json');

let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('\n▶ invalid corpus (one mutation per guarantee)');

const schema = JSON.parse(await readFile(SCHEMA, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const bases = {
  'round-1': JSON.parse(await readFile(resolve(SCOPE, 'round-1.data.json'), 'utf8')),
  'round-2': JSON.parse(await readFile(resolve(SCOPE, 'round-2.data.json'), 'utf8')),
};

// The bases themselves must be valid, or every "schema-valid" assertion below
// is measuring the base rather than the mutation.
for (const [name, data] of Object.entries(bases)) {
  const ok = validate(data);
  check(ok, `base ${name} is schema-valid` + (ok ? '' : ': ' + ajv.errorsText(validate.errors)));
}

const describe = (e) => `${e.instancePath || '/'} ${e.keyword}` +
  (e.params?.missingProperty ? ` (${e.params.missingProperty})` : '') +
  (e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : '');

const seenIds = new Set();
const structural = [];
const semantic = [];

for (const m of MUTATIONS) {
  if (seenIds.has(m.id)) { check(false, `duplicate mutation id "${m.id}"`); continue; }
  seenIds.add(m.id);

  const data = structuredClone(bases[m.base]);
  m.mutate(data, bases);
  const ok = validate(data);
  const errors = ok ? [] : validate.errors.slice();

  if (m.expect.keyword) {
    structural.push({ ...m, data });
    const want = m.expect;
    const hit = errors.some((e) =>
      e.keyword === want.keyword &&
      (e.instancePath || '') === want.path &&
      (!want.param || e.params?.missingProperty === want.param || e.params?.additionalProperty === want.param));
    check(hit, `${m.id}: ${want.path} ${want.keyword}${want.param ? ` (${want.param})` : ''}` +
      (hit ? '' : ok ? ' — but it VALIDATED' : ` — got ${errors.slice(0, 3).map(describe).join(', ')}`));
  } else {
    semantic.push({ ...m, data });
    check(ok, `${m.id}: schema-valid, so only ${m.expect.check} can catch it` +
      (ok ? '' : ` — schema rejected it (${errors.slice(0, 2).map(describe).join(', ')}), so ${m.expect.check} is never exercised`));
  }
}

// Every semantic check must be exercised by at least one mutation. A check with
// no fixture is a check nobody has ever seen run.
const CHECKS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S15'];
const covered = new Set(semantic.map((m) => m.expect.check));
const missing = CHECKS.filter((c) => !covered.has(c));
check(missing.length === 0, `every semantic check has a fixture${missing.length ? ` — missing ${missing.join(', ')}` : ''}`);

console.log(`  · ${structural.length} structural · ${semantic.length} semantic · ${MUTATIONS.length} total`);

if (failures) console.log(`\n✗ ${failures} corpus check(s) failed`);
process.exit(failures ? 1 : 0);
