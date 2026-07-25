#!/usr/bin/env node
// schema.mjs — guards the questions-JSON schema itself.
//
//   1. it compiles under ajv (draft-07)
//   2. it uses ONLY keywords the shipped walker implements
//   3. the invariants the rest of the system reads off it are actually there
//
// (2) is the load-bearing one. `assets/megascope.mjs` interprets this schema
// directly rather than re-encoding it, so validation stays data-driven — but a
// hand-written interpreter silently ignores keywords it does not know, and an
// ignored keyword is a guarantee that quietly stops holding. This test fails
// loudly instead. Run: `npm test`.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Ajv from 'ajv';
import { KEYWORDS } from '../skills/megascope/assets/megascope.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCHEMA = resolve(ROOT, 'skills/megascope/assets/schema.json');

let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('\n▶ schema (assets/schema.json)');

const schema = JSON.parse(await readFile(SCHEMA, 'utf8'));

// --- 1. ajv compiles it ---
let compiled = true, compileErr = '';
try {
  new Ajv({ allErrors: true, strict: false }).compile(schema);
} catch (e) {
  compiled = false; compileErr = e.message;
}
check(compiled, 'ajv compiles the schema' + (compiled ? '' : ': ' + compileErr));

// --- 2. closed keyword vocabulary ---
// How each keyword's value must be recursed into. Anything not listed here is a
// leaf (its value is data, not a subschema) or an outright unknown.
const SUBSCHEMA = new Set(['additionalProperties', 'propertyNames', 'not', 'if', 'then', 'else', 'items']);
const SUBSCHEMA_MAP = new Set(['properties', 'definitions']);
const SUBSCHEMA_LIST = new Set(['oneOf', 'anyOf', 'allOf']);

const unknown = [];
const used = new Set();
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function walk(node, path) {
  if (!isObj(node)) return;
  for (const [k, v] of Object.entries(node)) {
    used.add(k);
    if (!KEYWORDS.has(k)) { unknown.push(`${path}/${k}`); continue; }
    if (SUBSCHEMA.has(k)) {
      // tuple-form `items` is deliberately outside the vocabulary
      if (k === 'items' && Array.isArray(v)) { unknown.push(`${path}/items (tuple form)`); continue; }
      if (isObj(v)) walk(v, `${path}/${k}`);
    } else if (SUBSCHEMA_MAP.has(k)) {
      if (isObj(v)) for (const [name, sub] of Object.entries(v)) walk(sub, `${path}/${k}/${name}`);
    } else if (SUBSCHEMA_LIST.has(k)) {
      if (Array.isArray(v)) v.forEach((sub, i) => walk(sub, `${path}/${k}/${i}`));
    }
  }
}
walk(schema, '#');

check(unknown.length === 0,
  'every keyword is one the walker implements' + (unknown.length ? ` — unknown at ${unknown.join(', ')}` : ''));

const unusedKeywords = [...KEYWORDS].filter((k) => !used.has(k));
console.log(`  · vocabulary: ${used.size} keywords used, ${unusedKeywords.length} implemented but unused`);

// --- 3. invariants other code reads off the schema ---
const at = (p) => p.split('/').reduce((o, k) => (o == null ? o : o[k]), schema);
const SLOTS = ['goal', 'deliverable', 'boundary', 'verification', 'constraints'];

check(at('properties/formatVersion/const') === 2, 'formatVersion is pinned to const 2');

const slotEnum = at('definitions/scopeSlot/properties/slot/enum');
check(JSON.stringify(slotEnum) === JSON.stringify(SLOTS),
  'scopeSlot.slot enumerates the five slots in canonical order');
check(JSON.stringify(at('definitions/question/properties/slot/enum')) === JSON.stringify(SLOTS),
  'question.slot enumerates the same five slots');

check(at('properties/meta/properties/scope/minItems') === 5 && at('properties/meta/properties/scope/maxItems') === 5,
  'meta.scope is exactly five entries');
check(at('properties/questions/maxItems') === 8, 'questions cap at 8 — the pressure that makes rounds real');
check(at('properties/sections/maxItems') === 4, 'sections cap at 4');
check(at('definitions/question/properties/options/maxItems') === 4, 'options cap at 4');

// The measured fault: a 186-char slash-list option label. Both halves of the fix.
check(at('definitions/option/properties/label/maxLength') === 48, 'option label caps at 48 chars');
check(at('definitions/option/properties/label/not/pattern') === '[/;|\\[\\]]',
  'option label bans the export delimiters / ; | [ ]');
check(at('definitions/option/required').includes('detail'), 'option detail is required');
check(at('definitions/question/required').includes('why'), 'why is required (it was optional in v1)');
check(at('definitions/question/properties/why/maxLength') === 200, 'why caps at 200 chars — v1 max observed was 221');
check(at('definitions/question/properties/question/maxLength') === 100 &&
      at('definitions/question/properties/question/pattern') === '\\?$',
  'question caps at 100 and must end in a question mark');

// The floors — without them the fault relocates from verbose to vacuous.
for (const [path, min] of [
  ['definitions/scopeSlot/properties/text/minLength', 25],
  ['definitions/question/properties/context/minLength', 40],
  ['definitions/question/properties/why/minLength', 30],
  ['definitions/question/properties/switchIf/minLength', 20],
  ['definitions/option/properties/detail/minLength', 15],
]) check(at(path) === min, `${path.replace(/^definitions\//, '').replace(/\/minLength$/, '')} has a real floor (${min})`);

check(at('properties/meta/properties/project/not/pattern') === '-r[0-9]+(-v[0-9]+)?$',
  'meta.project cannot carry a round suffix — the slug is derived, not spelled');

console.log(failures ? `\n✗ ${failures} schema check(s) failed` : '');
process.exit(failures ? 1 : 0);
