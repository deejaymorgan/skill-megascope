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
import { cpSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import Ajv from 'ajv';
import { MUTATIONS } from './fixtures/mutations.mjs';
import { validateStructure, semanticChecks, ready, parseAnswers } from '../skills/megascope/assets/megascope.mjs';

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

// ── differential: the shipped walker against ajv, case by case ──────────────
// megascope.mjs interprets schema.json rather than re-encoding it, so this is
// the test that keeps that claim true. A walker that quietly ignored, say,
// `propertyNames` would still pass every fixture above; it cannot pass this.
console.log('\n▶ walker vs ajv (differential)');

const pathFor = (base) => resolve(SCOPE, `${base}.data.json`);
const disagreements = [];
const missedKeyword = [];

for (const m of MUTATIONS) {
  const data = structuredClone(bases[m.base]);
  m.mutate(data, bases);
  const ajvOk = validate(data);
  const walkerErrors = validateStructure(data, schema);
  const walkerOk = walkerErrors.length === 0;
  if (ajvOk !== walkerOk) {
    disagreements.push(`${m.id}: ajv says ${ajvOk ? 'valid' : 'invalid'}, walker says ${walkerOk ? 'valid' : 'invalid'}`);
  }
  if (m.expect.keyword) {
    const want = m.expect;
    const hit = walkerErrors.some((e) =>
      e.keyword === want.keyword &&
      e.instancePath === want.path &&
      (!want.param || e.params?.missingProperty === want.param || e.params?.additionalProperty === want.param));
    if (!hit) missedKeyword.push(`${m.id}: walker missed ${want.path} ${want.keyword}`);
  }
}
for (const d of disagreements) check(false, d);
for (const d of missedKeyword) check(false, d);
check(disagreements.length === 0, `walker and ajv return the same verdict on all ${MUTATIONS.length} mutations`);
check(missedKeyword.length === 0, `walker reports the intended keyword on all ${structural.length} structural mutations`);

for (const [name, data] of Object.entries(bases)) {
  const e = validateStructure(data, schema);
  check(e.length === 0, `walker accepts base ${name}` + (e.length ? `: ${e[0].message}` : ''));
}

// ── semantic: each mutation trips the check it was written for ─────────────
console.log('\n▶ semantic checks (S1-S15)');

for (const m of semantic) {
  const data = structuredClone(bases[m.base]);
  m.mutate(data, bases);
  // `build` is the superset phase — S6-S9 only run there, since they ask
  // whether a round is fit to show rather than whether a file is coherent.
  const fails = semanticChecks(data, { path: pathFor(m.base), phase: 'build' });
  const hit = fails.find((f) => f.id === m.expect.check);
  check(!!hit, `${m.expect.check} · ${m.id}` +
    (hit ? ` — "${hit.message}"` : fails.length ? ` — got ${fails.map((f) => f.id).join(', ')} instead` : ' — nothing fired'));
}

for (const [name, data] of Object.entries(bases)) {
  const fails = semanticChecks(data, { path: pathFor(name), phase: 'build' });
  check(fails.length === 0, `base ${name} passes every check in the build phase` +
    (fails.length ? `: ${fails.map((f) => `${f.id} ${f.message}`).join('; ')}` : ''));
}

// ── the deploy site has no node_modules and no package.json ────────────────
// mega.sh symlinks skills/megascope alone, so anything the tool reaches for
// outside that directory does not exist at run time. This is the only test
// that would catch a stray relative import or a devDependency creeping in.
console.log('\n▶ runs from the deployed skill (no node_modules, no package.json)');

const tmp = mkdtempSync(join(tmpdir(), 'megascope-deploy-'));
try {
  cpSync(resolve(ROOT, 'skills/megascope/assets'), join(tmp, 'assets'), { recursive: true });
  writeFileSync(join(tmp, 'round-1.data.json'), JSON.stringify(bases['round-1'], null, 2));
  const run = (...args) => execFileSync(process.execPath, [join(tmp, 'assets/megascope.mjs'), ...args],
    { cwd: tmp, encoding: 'utf8' });

  const out = run('validate', join(tmp, 'round-1.data.json'));
  check(out.startsWith('✓'), `validate runs standalone — ${out.trim()}`);

  run('build', join(tmp, 'round-1.data.json'), join(tmp, 'round-1.html'));
  const built = await readFile(join(tmp, 'round-1.html'), 'utf8');
  check(built.includes('"formatVersion": 2') && built.includes('Orchard'),
    'build injects the data into the engine it ships beside');

  let refused = '';
  try { run('build', join(tmp, 'nope.json')); } catch (e) { refused = String(e.stderr || e.stdout || ''); }
  check(refused.length > 0, 'a missing data file is refused rather than silently skipped');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ── the export parser, and the gate it feeds ───────────────────────────────
console.log('\n▶ export parser + ready');

const parsed = parseAnswers(await readFile(resolve(SCOPE, 'round-1.answers.md'), 'utf8'));
check(!parsed.legacy && parsed.scopeId.project === 'orchard-weather-station' && parsed.scopeId.n === 1,
  'scope-id parses to the round it belongs to');
check(parsed.answers.size === 5, `every answer line parses (${parsed.answers.size}/5)`);
check(parsed.answers.get('Q2').flagged && parsed.answers.get('Q2').state === 'DEFAULT',
  'FLAGGED is orthogonal to state — a flag is a bookmark, not an objection');
check(parsed.answers.get('Q5').state === 'OWN' && parsed.answers.get('Q5').ownWords.startsWith('wiring I can do'),
  'an OWN answer carries its own words');
check(parsed.answers.get('Q1').slot === 'goal', 'each answer carries the slot it feeds');
check(parsed.notes.startsWith('The shed already has'), 'the overall-notes block parses');

const legacy = parseAnswers('# Something — scoping answers\n\n- Q1 [CHANGED] B: whatever\n');
check(legacy.legacy, 'a pre-v2 export is identified as legacy by its missing scope-id, not by guesswork');

const r = ready(SCOPE);
check(!r.ok, 'a scope with an unanswered round is not ready');
check(r.first?.id === 'R1', `the first unmet condition is named, in order: ${r.first?.id} — ${r.first?.detail}`);
check(r.rows.length === 6, `all six conditions are reported, not just the first (${r.rows.length}/6)`);

if (failures) console.log(`\n✗ ${failures} corpus check(s) failed`);
process.exit(failures ? 1 : 0);
