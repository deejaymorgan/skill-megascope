#!/usr/bin/env node
// megascope.mjs — the one tool a megascope run calls.
//
//   node megascope.mjs validate <round-N.data.json>
//   node megascope.mjs build    <round-N.data.json> [out.html]
//   node megascope.mjs ready    <scope-dir>/
//   node megascope.mjs env      <scope-dir>/
//
// Zero dependencies: node built-ins only, so it runs from inside the deployed
// skill, where there is no package.json and no node_modules.
//
// ── why this exists ─────────────────────────────────────────────────────────
// Three faults converge on one small script. The skill used to tell Claude to
// read a 53 KB engine and write the combined file by hand (expensive and
// error-prone); the docs pointed at an injection helper that existed nowhere;
// and plain JSON Schema cannot express the cross-references that actually keep
// a scope honest — that a question targets an OPEN slot, that a settled slot
// cites an answer the user really gave, that a round advanced at all.
//
// ── the two passes ──────────────────────────────────────────────────────────
// STRUCTURAL  a walker over the shipped schema.json. It interprets the schema
//             rather than re-encoding it, so there is exactly one copy of the
//             contract. That only stays honest if the walker knows every
//             keyword the schema uses — an unimplemented keyword is not an
//             error, it is a guarantee that silently stops holding. KEYWORDS is
//             the closed vocabulary both sides agree on, and tests/schema.mjs
//             fails the build if schema.json ever reaches outside it.
//
// SEMANTIC    S1-S16. Split by phase, because the two phases ask different
//             questions:
//               validate  S1-S5, S10-S16 — is this file coherent?
//               build     + S6-S9 — is this round fit to be put in front of
//                         someone? A round with nothing open, nothing advanced,
//                         or a question about something already settled is a
//                         well-formed file and a broken round. `build` refuses
//                         to write it, which is what makes the loop terminate
//                         on a tool refusal rather than on judgment.
//
// ── the readiness gate ──────────────────────────────────────────────────────
// `ready` (R1-R6) is the close. It exits 0 only when all five scope slots are
// settled, each on evidence that resolves against a saved paste-back or on a
// written assumption. Its exit-1 message names the first unmet condition and
// its slot — that message IS the spec for the next round.
//
// ── the posture check ───────────────────────────────────────────────────────
// `env` (E1-E3) reports where the artifacts sit and who can see them. Scoping
// artifacts absorb whatever the scope touched — verbatim answers, real paths,
// directory listings pasted in as evidence — so the default posture is
// untracked, and committing is an opt-in that owes a sanitisation pass. See
// references/artifacts.md. This REPORTS that posture; it never enforces it, and
// every fact degrades to unknown rather than throwing: a missing git, a missing
// gh or no network must not stop a scope from closing.

import { readFileSync, writeFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, resolve, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Siblings resolve against THIS file, not the process cwd: the skill is
// deployed as a symlinked directory, so a path walked up from the repo root
// does not exist at run time.
const ENGINE_PATH = fileURLToPath(new URL('./engine.html', import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL('./schema.json', import.meta.url));

export const SLOTS = ['goal', 'deliverable', 'boundary', 'verification', 'constraints'];

/** Every JSON Schema keyword the walker implements, plus the annotations it ignores. */
export const KEYWORDS = new Set([
  // applicators
  'properties', 'additionalProperties', 'propertyNames', 'items',
  'oneOf', 'anyOf', 'allOf', 'not', 'if', 'then', 'else',
  '$ref', 'definitions',
  // assertions
  'type', 'required', 'enum', 'const',
  'minProperties', 'maxProperties',
  'minItems', 'maxItems', 'uniqueItems',
  'minLength', 'maxLength', 'pattern',
  'minimum', 'maximum',
  // annotations — parsed, never enforced
  '$schema', '$id', 'title', 'description', 'default',
]);

// ════════════════════════════════════════════════════════════════════════════
//  STRUCTURAL PASS — a walker over the shipped schema
// ════════════════════════════════════════════════════════════════════════════

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}
function typeMatches(v, t) {
  const actual = typeOf(v);
  return t === 'number' ? actual === 'number' || actual === 'integer' : actual === t;
}

// Code-point length, matching ajv: "🌦" is one character, not two. Getting this
// wrong would make emoji-bearing fields disagree between the two validators for
// no reason a reader could ever guess.
function ucs2length(str) {
  let len = 0, pos = 0;
  const n = str.length;
  while (pos < n) {
    len++;
    const c = str.charCodeAt(pos++);
    if (c >= 0xd800 && c <= 0xdbff && pos < n && (str.charCodeAt(pos) & 0xfc00) === 0xdc00) pos++;
  }
  return len;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeOf(a) !== typeOf(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObj(a)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && deepEqual(a[k], b[k]));
  }
  return false;
}

// ajv compiles patterns with the `u` flag by default; match it, or a pattern
// that is legal in one dialect and not the other diverges silently.
const reCache = new Map();
const rx = (p) => {
  let r = reCache.get(p);
  if (!r) { r = new RegExp(p, 'u'); reCache.set(p, r); }
  return r;
};

/**
 * Validate `data` against `schema`, reporting in ajv's error shape so the two
 * can be compared case by case.
 * @returns {Array<{instancePath:string, keyword:string, params:object, message:string}>}
 */
export function validateStructure(data, schema) {
  const errors = [];
  walk(schema, data, '', schema, errors);
  return errors;
}

function passes(schema, value, root) {
  const sink = [];
  walk(schema, value, '', root, sink);
  return sink.length === 0;
}

function walk(schema, value, path, root, errors) {
  if (schema === true || schema === undefined) return;
  if (schema === false) { errors.push(err(path, 'false schema', {})); return; }

  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => (o == null ? o : o[k]), root);
    walk(target, value, path, root, errors);
    // draft-07: siblings of $ref are ignored
    return;
  }

  // ---- type ----
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(value, t))) {
      errors.push(err(path, 'type', { type: schema.type }));
      return; // every further assertion would be noise
    }
  }

  // ---- universal assertions ----
  if (schema.enum !== undefined && !schema.enum.some((c) => deepEqual(c, value))) {
    errors.push(err(path, 'enum', { allowedValues: schema.enum }));
  }
  if (schema.const !== undefined && !deepEqual(schema.const, value)) {
    errors.push(err(path, 'const', { allowedValue: schema.const }));
  }

  const kind = typeOf(value);

  // ---- strings ----
  if (kind === 'string') {
    const len = ucs2length(value);
    if (schema.minLength !== undefined && len < schema.minLength) {
      errors.push(err(path, 'minLength', { limit: schema.minLength }));
    }
    if (schema.maxLength !== undefined && len > schema.maxLength) {
      errors.push(err(path, 'maxLength', { limit: schema.maxLength }));
    }
    if (schema.pattern !== undefined && !rx(schema.pattern).test(value)) {
      errors.push(err(path, 'pattern', { pattern: schema.pattern }));
    }
  }

  // ---- numbers ----
  if (kind === 'number' || kind === 'integer') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(err(path, 'minimum', { limit: schema.minimum, comparison: '>=' }));
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(err(path, 'maximum', { limit: schema.maximum, comparison: '<=' }));
    }
  }

  // ---- arrays ----
  if (kind === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(err(path, 'minItems', { limit: schema.minItems }));
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(err(path, 'maxItems', { limit: schema.maxItems }));
    }
    if (schema.uniqueItems === true) {
      outer: for (let i = 1; i < value.length; i++) {
        for (let j = 0; j < i; j++) {
          if (deepEqual(value[i], value[j])) { errors.push(err(path, 'uniqueItems', { i, j })); break outer; }
        }
      }
    }
    if (schema.items !== undefined) {
      value.forEach((item, i) => walk(schema.items, item, `${path}/${i}`, root, errors));
    }
  }

  // ---- objects ----
  if (kind === 'object') {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) {
      errors.push(err(path, 'minProperties', { limit: schema.minProperties }));
    }
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) {
      errors.push(err(path, 'maxProperties', { limit: schema.maxProperties }));
    }
    for (const req of schema.required || []) {
      if (!(req in value)) errors.push(err(path, 'required', { missingProperty: req }));
    }
    if (schema.propertyNames !== undefined) {
      for (const k of keys) {
        if (!passes(schema.propertyNames, k, root)) {
          errors.push(err(path, 'propertyNames', { propertyName: k }));
        }
      }
    }
    if (schema.properties) {
      for (const [k, sub] of Object.entries(schema.properties)) {
        if (k in value) walk(sub, value[k], `${path}/${escapePointer(k)}`, root, errors);
      }
    }
    if (schema.additionalProperties !== undefined) {
      const known = new Set(Object.keys(schema.properties || {}));
      for (const k of keys) {
        if (known.has(k)) continue;
        if (schema.additionalProperties === false) {
          errors.push(err(path, 'additionalProperties', { additionalProperty: k }));
        } else if (isObj(schema.additionalProperties)) {
          walk(schema.additionalProperties, value[k], `${path}/${escapePointer(k)}`, root, errors);
        }
      }
    }
  }

  // ---- applicators ----
  for (const sub of schema.allOf || []) walk(sub, value, path, root, errors);

  if (schema.anyOf && !schema.anyOf.some((sub) => passes(sub, value, root))) {
    errors.push(err(path, 'anyOf', {}));
  }
  if (schema.oneOf) {
    const n = schema.oneOf.filter((sub) => passes(sub, value, root)).length;
    if (n !== 1) errors.push(err(path, 'oneOf', { passingSchemas: n }));
  }
  if (schema.not !== undefined && passes(schema.not, value, root)) {
    errors.push(err(path, 'not', {}));
  }
  if (schema.if !== undefined) {
    const branch = passes(schema.if, value, root) ? schema.then : schema.else;
    if (branch !== undefined) {
      const before = errors.length;
      walk(branch, value, path, root, errors);
      if (errors.length > before) {
        errors.push(err(path, 'if', { failingKeyword: branch === schema.then ? 'then' : 'else' }));
      }
    }
  }
}

const escapePointer = (k) => k.replace(/~/g, '~0').replace(/\//g, '~1');
const err = (instancePath, keyword, params) => ({
  instancePath, keyword, params,
  message: `${instancePath || '/'} fails ${keyword}${params.missingProperty ? ` (missing "${params.missingProperty}")`
    : params.additionalProperty ? ` (unexpected "${params.additionalProperty}")`
    : params.limit !== undefined ? ` (limit ${params.limit})` : ''}`,
});

// ════════════════════════════════════════════════════════════════════════════
//  THE EXPORT PARSER — reads a saved paste-back back into structure
// ════════════════════════════════════════════════════════════════════════════
//
// This is what makes readiness a check rather than a self-report: the same
// agent that writes "goal: settled" also writes the evidence, and nothing would
// cross-examine either without parsing what the user actually sent back.
//
// The grammar is strict by design — option labels are pattern-banned from
// carrying the delimiters, and every continuation value has its whitespace
// collapsed — so the parse is total, not best-effort.

const ANSWER_LINE = /^- ([A-Z][A-Za-z0-9]{0,5}) \[(DEFAULT|CHANGED|OWN|REJECTED)( · FLAGGED)?\] \(([a-z]+)\) (.*)$/;
const CONTINUATION = /^ {4}(own words|asked|note): (.*)$/;
const SCOPE_ID = /^scope-id: ([a-z0-9][a-z0-9-]*) · r([0-9]+)\/([0-9]+) rev ([0-9]+)$/;
const NOTES_HEADING = '## Overall notes / new questions';

/**
 * @returns {{legacy:boolean, scopeId:?{project:string,n:number,of:number,revision:number},
 *            answers:Map<string,object>, notes:string}}
 */
export function parseAnswers(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const answers = new Map();
  let scopeId = null;
  let current = null;
  let inNotes = false;
  const noteLines = [];

  for (const line of lines) {
    const sid = SCOPE_ID.exec(line);
    if (sid) {
      scopeId = { project: sid[1], n: Number(sid[2]), of: Number(sid[3]), revision: Number(sid[4]) };
      continue;
    }
    if (line === NOTES_HEADING) { inNotes = true; current = null; continue; }
    if (inNotes) {
      if (line.trim() === '---') { inNotes = false; continue; }
      noteLines.push(line);
      continue;
    }
    const m = ANSWER_LINE.exec(line);
    if (m) {
      current = { id: m[1], state: m[2], flagged: !!m[3], slot: m[4], payload: m[5], ownWords: null, asked: null, note: null };
      answers.set(current.id, current);
      continue;
    }
    const c = CONTINUATION.exec(line);
    if (c && current) {
      current[c[1] === 'own words' ? 'ownWords' : c[1]] = c[2];
      continue;
    }
    if (line.startsWith('## ')) current = null;
  }

  const notes = noteLines.join('\n').trim();
  return {
    legacy: scopeId === null,   // a pre-v2 export has no scope-id line at all
    scopeId,
    answers,
    notes: notes === '(none)' ? '' : notes,
  };
}

/** An answer counts as evidence only in these states. REJECTED never does. */
const EVIDENTIAL = new Set(['DEFAULT', 'CHANGED', 'OWN']);

// ════════════════════════════════════════════════════════════════════════════
//  SEMANTIC PASS — S1 to S15
// ════════════════════════════════════════════════════════════════════════════

// Jargon is caught by requiring explanation, not by banning characters. A
// backtick lint scored 0 of 31 on the corpus that motivated this — none of its
// 18 unexplained acronyms was backticked, and making backticks the one thing
// that hard-fails a build is an incentive to stop using them. So: find
// identifier-shaped tokens and demand a gloss.
const IDENTIFIER = /[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+|[a-z]+[A-Z][A-Za-z0-9]*|\b[A-Z]{2,}[0-9]*\b/g;
// ALLCAPS words no reader needs glossed. Deliberately tiny: a false positive
// costs one glossary line, a false negative is the exact fault being fixed.
const NOT_JARGON = new Set(['OK', 'TV', 'UK', 'US', 'EU', 'DIY', 'AM', 'PM', 'A', 'I']);

function identifiersIn(text) {
  // strip the inline markup first, so **CSV** and `CSV` read as CSV
  const bare = String(text).replace(/\*\*|~|`/g, '');
  const found = new Set();
  for (const m of bare.matchAll(IDENTIFIER)) {
    const tok = m[0];
    if (NOT_JARGON.has(tok)) continue;
    if (tok.length < 5 && tok.includes('.')) continue;  // "p.m", "e.g"
    found.add(tok);
  }
  return found;
}

/** Walk every string the engine renders, tagging which are allowed to carry jargon. */
function* displayText(data) {
  const m = data.meta || {};
  const yes = (where, text) => ({ where, text, jargonAllowed: false });
  for (const k of ['title', 'subtitle', 'eyebrow', 'headline', 'lede', 'legend',
    'overallNotesTitle', 'overallNotesHint', 'closingAsk']) {
    if (m[k]) yield yes(`meta.${k}`, m[k]);
  }
  if (m.round?.label) yield yes('meta.round.label', m.round.label);
  for (const s of m.steps || []) yield yes('meta.steps[]', s);
  for (const [i, slot] of (m.scope || []).entries()) {
    for (const k of ['label', 'text', 'assumption', 'reopened']) {
      if (slot[k]) yield yes(`meta.scope[${i}].${k}`, slot[k]);
    }
  }
  for (const c of m.constraints || []) {
    if (typeof c === 'string') yield yes('meta.constraints[]', c);
    else { if (c.label) yield yes('meta.constraints[].label', c.label); if (c.text) yield yes('meta.constraints[].text', c.text); }
  }
  const ctx = m.context || {};
  if (ctx.title) yield yes('meta.context.title', ctx.title);
  if (ctx.note) yield yes('meta.context.note', ctx.note);
  for (const card of ctx.cards || []) {
    for (const k of ['title', 'body', 'foot']) if (card[k]) yield yes(`meta.context.cards[].${k}`, card[k]);
  }
  for (const b of ctx.blocks || []) {
    if (b.heading) yield yes('meta.context.blocks[].heading', b.heading);
    if (b.text) yield yes('meta.context.blocks[].text', b.text);
    for (const it of b.items || []) {
      for (const k of ['term', 'desc']) if (it[k]) yield yes(`meta.context.blocks[].items[].${k}`, it[k]);
    }
    for (const l of b.lines || []) yield yes('meta.context.blocks[].lines[]', l);
  }
  for (const s of data.sections || []) if (s.title) yield yes(`sections[${s.id}].title`, s.title);
  for (const q of data.questions || []) {
    for (const k of ['context', 'question', 'why', 'switchIf']) if (q[k]) yield yes(`${q.id}.${k}`, q[k]);
    for (const b of q.breakdown || []) yield yes(`${q.id}.breakdown[]`, b);
    // the two fields where a technical term is the honest thing to write
    if (q.example) yield { where: `${q.id}.example`, text: q.example, jargonAllowed: true };
    for (const o of q.options || []) {
      yield yes(`${q.id}.${o.key}.label`, o.label);
      yield { where: `${q.id}.${o.key}.detail`, text: o.detail, jargonAllowed: true };
    }
  }
}

/**
 * @param {object} data      the parsed round file
 * @param {object} opts      { path: absolute path the file lives at, phase: 'validate'|'build' }
 * @returns {Array<{id:string, message:string}>}
 */
export function semanticChecks(data, opts = {}) {
  const fails = [];
  const fail = (id, message) => fails.push({ id, message });
  const meta = data.meta || {};
  const round = meta.round || {};
  const scope = meta.scope || [];
  const questions = data.questions || [];
  const sections = data.sections || [];
  const dir = opts.path ? dirname(opts.path) : null;
  const phase = opts.phase || 'validate';

  // ── S1-S4 · the things arrays cannot say about themselves ────────────────
  const qids = questions.map((q) => q.id);
  for (const dup of duplicates(qids)) fail('S1', `two questions share the id "${dup}"`);
  for (const dup of duplicates(sections.map((s) => s.id))) fail('S2', `two sections share the id "${dup}"`);

  const secIds = new Set(sections.map((s) => s.id));
  for (const q of questions) {
    if (!secIds.has(q.section)) fail('S3', `${q.id} is filed under section "${q.section}", which does not exist`);
    const keys = q.options.map((o) => o.key);
    for (const dup of duplicates(keys)) fail('S4', `${q.id} offers the option key "${dup}" twice`);
    for (const k of recKeys(q)) {
      if (!keys.includes(k)) fail('S4', `${q.id} recommends "${k}", which is not one of its options`);
    }
  }

  // ── S5 · the scope panel is the five slots, in order ─────────────────────
  const got = scope.map((s) => s.slot);
  if (got.join(',') !== SLOTS.join(',')) {
    fail('S5', `meta.scope must be exactly ${SLOTS.join(', ')} in that order — got ${got.join(', ') || '(nothing)'}`);
  }
  const bySlot = new Map(scope.map((s) => [s.slot, s]));

  // ── S11 · the round counts itself honestly ───────────────────────────────
  if (round.of < round.n) fail('S11', `this is round ${round.n} of ${round.of}`);

  // ── S16 · the favicon is exactly one emoji ───────────────────────────────
  // It is a tab icon and nothing else now, so "one" is the whole spec. The
  // schema can only bound the string's LENGTH, and a single emoji is not one
  // code unit — 👨‍👩‍👧 is eleven — so the count that matters is graphemes, which
  // is exactly the kind of thing that lands here rather than in schema.json.
  if (meta.favicon != null) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const n = [...seg.segment(meta.favicon)].length;
    if (n !== 1) fail('S16', `meta.favicon is ${n} characters ("${meta.favicon}") — it must be exactly one emoji`);
  }

  // ── S12/S13/S10 · evidence resolves against what the user really sent ────
  const answerFiles = new Map();   // round number -> parsed export (or null)
  let prevAnswers = null;

  if (round.n > 1 && dir) {
    const prevPath = resolve(dir, round.prev || '');
    if (!round.prev || !existsSync(prevPath)) {
      fail('S12', `meta.round.prev names "${round.prev}", which is not on disk`);
    }
    const answersPath = resolve(dir, round.prevAnswers || '');
    if (!round.prevAnswers || !existsSync(answersPath)) {
      fail('S12', `meta.round.prevAnswers names "${round.prevAnswers}", which is not on disk — no saved paste-back, no next round`);
    } else {
      prevAnswers = parseAnswers(readFileSync(answersPath, 'utf8'));
      if (prevAnswers.legacy) {
        fail('S12', `"${round.prevAnswers}" has no scope-id line, so it is a pre-v2 export and cannot be checked`);
      } else if (prevAnswers.scopeId.project !== meta.project || prevAnswers.scopeId.n !== round.n - 1) {
        fail('S12', `"${round.prevAnswers}" belongs to ${prevAnswers.scopeId.project} round ${prevAnswers.scopeId.n}, ` +
          `not ${meta.project} round ${round.n - 1}`);
      }
      answerFiles.set(round.n - 1, prevAnswers);
    }
  }

  const answersForRound = (k) => {
    if (answerFiles.has(k)) return answerFiles.get(k);
    let parsed = null;
    if (dir) {
      const p = resolve(dir, `round-${k}.answers.md`);
      if (existsSync(p)) parsed = parseAnswers(readFileSync(p, 'utf8'));
    }
    answerFiles.set(k, parsed);
    return parsed;
  };

  for (const slot of scope) {
    for (const ref of slot.evidence || []) {
      const [, kStr, target] = /^r([0-9]+):(.+)$/.exec(ref) || [];
      const k = Number(kStr);
      if (k > round.n) {
        fail('S13', `slot "${slot.slot}" cites ${ref}, which is a round that has not happened`);
        continue;
      }
      if (k === round.n && !(dir && existsSync(resolve(dir, `round-${k}.answers.md`)))) {
        // Citing your own round is legal only once its answers exist on disk.
        // That is the close: after the final paste-back, this round's scope is
        // updated in place to record what those answers settled. Before then it
        // would be a round marking its own homework.
        fail('S13', `slot "${slot.slot}" cites ${ref}, but round ${round.n} has not collected its own answers yet`);
        continue;
      }
      if (!dir) continue;
      const parsed = answersForRound(k);
      if (!parsed) { fail('S10', `slot "${slot.slot}" cites ${ref}, but round ${k}'s answers are not on disk`); continue; }
      if (target === 'notes') {
        if (!parsed.notes) fail('S10', `slot "${slot.slot}" cites ${ref}, but round ${k}'s overall notes are empty`);
        continue;
      }
      const answer = parsed.answers.get(target);
      if (!answer) fail('S10', `slot "${slot.slot}" cites ${ref}, but ${target} does not appear in round ${k}'s answers`);
      else if (!EVIDENTIAL.has(answer.state)) {
        fail('S10', `slot "${slot.slot}" cites ${ref}, but ${target} came back ${answer.state} — ` +
          `a rejected question is not an answer`);
      }
    }
  }

  // ── S14 · jargon must be explained, and every gloss must earn its place ──
  const glossary = meta.glossary || {};
  const glossed = new Set(Object.keys(glossary));
  const used = new Set();
  for (const { where, text, jargonAllowed } of displayText(data)) {
    for (const tok of identifiersIn(text)) {
      if (!jargonAllowed) {
        fail('S14', `${where} contains "${tok}" — identifier-shaped terms belong in an example or an option detail, ` +
          `where the reader has the surrounding sentence to lean on`);
        continue;
      }
      if (glossed.has(tok)) used.add(tok);
      else fail('S14', `${where} uses "${tok}" with no meta.glossary entry`);
    }
  }
  for (const term of glossed) {
    if (!used.has(term)) fail('S14', `meta.glossary explains "${term}", which never appears in the document`);
  }

  // ── S15 · a technical question cannot exist unresearched ─────────────────
  const mode = meta.research?.mode;
  for (const q of questions) {
    if (q.technical && mode !== 'light' && mode !== 'deep') {
      fail('S15', `${q.id} is marked technical, but meta.research.mode is ${mode ? `"${mode}"` : 'absent'}`);
    }
  }

  if (phase !== 'build') return fails;

  // ══ build-only: is this round fit to put in front of someone? ════════════

  // Has this round already BEEN put in front of someone? Its own paste-back on
  // disk is the tell — the same signal S13 uses above to let a slot cite its
  // own round. After the close, the final round's data file is updated in
  // place to record what its answers settled (references/rounds.md, "The
  // close"), so from that point meta.scope describes the finished scope, not
  // what this round set out to ask. Which of the checks below still apply
  // turns on that difference.
  const asked = !!(dir && existsSync(resolve(dir, `round-${round.n}.answers.md`)));
  const open = scope.filter((s) => s.state === 'open').map((s) => s.slot);

  // ── S8 · the loop terminator is a tool refusal, not a judgment call ──────
  // Unconditional, the closed round included: `build` must go on refusing the
  // file the close leaves behind, or the loop stops terminating on a refusal.
  // Only the wording changes, because "you made a mistake" and "you are done"
  // are different things to be told.
  if (scope.length && !open.length) {
    fail('S8', asked
      ? 'this round is closed — its answers are on disk and every slot is settled, so this file is now the record of a finished scope rather than a round to build. Produce the kick-off prompt'
      : 'every slot is settled — the scope is complete. Produce the kick-off prompt, not another round');
  }

  // ── S6 + S7 · exact cover. Drift is a build failure. ─────────────────────
  // Prospective only. On a closed round every question necessarily targets a
  // slot that is now settled — the answers to those very questions are what
  // settled it, and cite it as evidence — so S6 would report one fault per
  // question that the file does not have, and bury the single true line above.
  // S7 is its other half and goes with it.
  if (!asked) {
    const targeted = new Set(questions.map((q) => q.slot));
    for (const q of questions) {
      const slot = bySlot.get(q.slot);
      if (slot && slot.state !== 'open') {
        fail('S6', `${q.id} asks about "${q.slot}", which this round declares settled`);
      }
    }
    for (const slotName of open) {
      if (!targeted.has(slotName)) fail('S7', `slot "${slotName}" is open but no question in this round targets it`);
    }
  }

  // ── S9 · a round that settles nothing is not a round ─────────────────────
  if (round.n > 1 && dir && round.prev) {
    const prevPath = resolve(dir, round.prev);
    if (existsSync(prevPath)) {
      let prev = null;
      try { prev = JSON.parse(readFileSync(prevPath, 'utf8')); } catch { /* S12 already said so */ }
      const prevBySlot = new Map((prev?.meta?.scope || []).map((s) => [s.slot, s]));
      let advanced = false;
      for (const slot of scope) {
        const before = prevBySlot.get(slot.slot);
        if (!before) continue;
        if (before.state === 'open' && slot.state === 'settled') advanced = true;
        if (before.state === 'settled' && slot.state === 'open' && !slot.reopened) {
          fail('S9', `slot "${slot.slot}" went back to open without saying why — set "reopened"`);
        }
      }
      if (prevBySlot.size && !advanced) {
        fail('S9', `nothing settled since ${basename(prevPath)} — a round that advances no slot is not a round`);
      }
    }
  }

  return fails;
}

const duplicates = (arr) => {
  const seen = new Set(), dup = new Set();
  for (const x of arr) (seen.has(x) ? dup : seen).add(x);
  return dup;
};
const recKeys = (q) => (Array.isArray(q.rec) ? q.rec : [q.rec]);

// ════════════════════════════════════════════════════════════════════════════
//  THE PUBLIC OPERATIONS
// ════════════════════════════════════════════════════════════════════════════

/** @returns {{ok:boolean, structural:Array, semantic:Array}} */
export function validateData(data, opts = {}) {
  const schema = opts.schema || JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const structural = validateStructure(data, schema);
  // A file that is not structurally sound cannot be reasoned about semantically
  // — every check below would be reading fields that may not be there.
  const semantic = structural.length ? [] : semanticChecks(data, opts);
  return { ok: !structural.length && !semantic.length, structural, semantic };
}

const OPEN_TAG = '<script type="application/json" id="scoping-data">';
const CLOSE_TAG = '</script>';

/**
 * The one operation a run performs on the engine shell: replace ONLY the
 * contents of the data block. Everything else is byte-identical every run.
 */
export function injectData(engineHtml, data) {
  const start = engineHtml.indexOf(OPEN_TAG);
  if (start === -1) throw new Error('inject: could not find the scoping-data open tag in engine.html');
  const contentStart = start + OPEN_TAG.length;
  const end = engineHtml.indexOf(CLOSE_TAG, contentStart);
  if (end === -1) throw new Error('inject: could not find the closing </script> for scoping-data');

  const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  // Guard against a literal </script> inside a string value breaking the block.
  const safe = json.replace(/<\/script/gi, '<\\/script');
  let out = engineHtml.slice(0, contentStart) + '\n' + safe + '\n' + engineHtml.slice(end);

  // Set the static <title> too, so the standalone file, no-JS contexts and the
  // Artifact gallery all show the real name.
  const obj = typeof data === 'string' ? tryParse(data) : data;
  const title = obj?.meta?.title;
  if (title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${String(title).replace(/[<>]/g, '').trim()} · Scoping</title>`);
  }
  return out;
}

const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

/** Validate in the `build` phase, then write the standalone document. */
export function buildDoc(dataPath, outPath) {
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const result = validateData(data, { path: resolve(dataPath), phase: 'build' });
  if (!result.ok) return { ok: false, ...result };
  const out = outPath || dataPath.replace(/\.data\.json$|\.json$/i, '') + '.html';
  writeFileSync(out, injectData(readFileSync(ENGINE_PATH, 'utf8'), data), 'utf8');
  return { ok: true, out, sections: data.sections.length, questions: data.questions.length, ...result };
}

// ── ready · the close ───────────────────────────────────────────────────────

/**
 * R1-R6 over a scope directory. The exit-1 message names the first unmet
 * condition and its slot; that message is the spec for the next round.
 */
export function ready(dir) {
  const rows = [];
  const problems = [];
  const note = (id, ok, detail) => { rows.push({ id, ok, detail }); if (!ok) problems.push({ id, detail }); };

  const roundNums = readdirSync(dir)
    .map((f) => /^round-([0-9]+)\.data\.json$/.exec(f))
    .filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);

  if (!roundNums.length) return { ok: false, rows, first: { id: 'R6', detail: `no round-N.data.json in ${dir}` } };

  const latestN = roundNums[roundNums.length - 1];
  const data = JSON.parse(readFileSync(resolve(dir, `round-${latestN}.data.json`), 'utf8'));
  const scope = data.meta?.scope || [];

  // Which slots any round ever put a question against — it makes R1's message
  // say whether a slot was asked about and left open, or simply never reached.
  const everTargeted = new Set();
  for (const n of roundNums) {
    const d = JSON.parse(readFileSync(resolve(dir, `round-${n}.data.json`), 'utf8'));
    for (const q of d.questions || []) everTargeted.add(q.slot);
  }

  // R1 · every slot settled
  const stillOpen = scope.filter((s) => s.state !== 'settled');
  note('R1', stillOpen.length === 0, stillOpen.length
    ? `slot "${stillOpen[0].slot}" is open (${everTargeted.has(stillOpen[0].slot)
        ? 'asked about, but not resolved yet' : 'no round has targeted it yet'})`
    : `all ${scope.length} slots settled as of round ${latestN}`);

  // R2 · each slot actually says something
  const thin = scope.find((s) => !s.text || s.text.trim().length < 25);
  note('R2', !thin, thin ? `slot "${thin.slot}" says almost nothing` : 'every slot reads as a sentence');

  // R3 · settled on evidence that resolves, or on a written assumption
  let r3 = null;
  for (const slot of scope) {
    if (slot.assumed === true) {
      if (!slot.assumption) { r3 = `slot "${slot.slot}" is assumed but writes no assumption`; break; }
      continue;
    }
    if (!(slot.evidence || []).length) { r3 = `slot "${slot.slot}" cites no evidence and claims no assumption`; break; }
  }
  if (!r3) {
    const sem = semanticChecks(data, { path: resolve(dir, `round-${latestN}.data.json`), phase: 'validate' })
      .filter((f) => f.id === 'S10' || f.id === 'S13');
    if (sem.length) r3 = sem[0].message;
  }
  note('R3', !r3, r3 || 'every slot rests on a resolving answer or a written assumption');

  // R4 · the deliverable says what kind of work this is
  const deliverable = scope.find((s) => s.slot === 'deliverable');
  const r4 = !deliverable ? 'there is no deliverable slot'
    : !deliverable.kind ? 'the deliverable slot names no kind'
    : deliverable.kind === 'other' && !deliverable.kindOther ? 'the deliverable kind is "other" with nothing written'
    : null;
  note('R4', !r4, r4 || `deliverable kind: ${deliverable?.kind}`);

  // R5 · nothing is still rejected
  const latestAnswersPath = resolve(dir, `round-${latestN}.answers.md`);
  let r5 = null;
  if (!existsSync(latestAnswersPath)) {
    // not applicable rather than failed — a missing paste-back is R6's to
    // report, and duplicating it here would bury R6 behind a worse message
    rows.push({ id: 'R5', ok: true, detail: `round ${latestN} has no paste-back yet — see R6` });
  } else {
    const rejected = [...parseAnswers(readFileSync(latestAnswersPath, 'utf8')).answers.values()]
      .filter((a) => a.state === 'REJECTED');
    if (rejected.length) {
      r5 = `${rejected.map((a) => a.id).join(', ')} still rejected — re-teach it, or settle the slot by assumption and say so`;
    }
    note('R5', !r5, r5 || `round ${latestN}'s answers carry no rejections`);
  }

  // R6 · every round was actually answered
  const unanswered = roundNums.filter((n) => !existsSync(resolve(dir, `round-${n}.answers.md`)));
  note('R6', unanswered.length === 0, unanswered.length
    ? `round ${unanswered[0]} has no round-${unanswered[0]}.answers.md`
    : `${roundNums.length} round(s), each with its saved paste-back`);

  return { ok: problems.length === 0, rows, first: problems[0] || null, latestN, scope };
}

// ── env · the posture check ─────────────────────────────────────────────────

const GIT_MS = 2000;
const GH_MS = 6000;

/**
 * Ask the shell a question. `code` is null only when the question could not be
 * asked at all — a missing binary, or a timeout. A non-zero exit is an *answer*
 * (`git check-ignore` says "not ignored" with 1), and must not be confused with
 * one, or every repo without a .gitignore reads as unknown.
 * @returns {{code:number|null, out:string}}
 */
function shell(cmd, args, { cwd, timeout = GIT_MS } = {}) {
  try {
    const out = execFileSync(cmd, args, {
      cwd, timeout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { code: 0, out: out.trim() };
  } catch (e) {
    return { code: typeof e?.status === 'number' ? e.status : null, out: String(e?.stdout || '').trim() };
  }
}

/** The nearest ancestor that exists — at intake the scope directory has not been created yet. */
const firstExisting = (p) => {
  let cur = resolve(p);
  for (let i = 0; i < 64 && !existsSync(cur); i++) {
    const up = dirname(cur);
    if (up === cur) break;
    cur = up;
  }
  return cur;
};

/**
 * E1-E3 over a scope directory: where it sits, who can see it, and which
 * posture is actually in force. Advisory — the caller prints it and never
 * gates on it. `opts.run` replaces the shell, so the classification is
 * testable without a network or a GitHub account.
 */
export function environment(dir, opts = {}) {
  const run = opts.run || shell;
  const rows = [];
  const add = (id, level, detail) => rows.push({ id, level, detail });

  // git reports its toplevel with symlinks resolved, so the caller's path has to
  // be too or the two never subtract: /var/folders/… against /private/var/… gives
  // a repo-relative path of "../../..". Resolve the part that exists and put the
  // not-yet-created tail back on.
  const asked = resolve(dir);
  const base = firstExisting(asked);
  let path = asked;
  try { path = resolve(realpathSync(base), relative(base, asked)); } catch { /* keep what we were given */ }

  const top = run('git', ['rev-parse', '--show-toplevel'], { cwd: base });
  const repo = top.code === 0 && top.out ? top.out : null;

  if (!repo) {
    add('E1', 'info', `${path} is not inside a git repository — nothing here can be pushed, and nothing but a written pointer can find it`);
    return { repo: null, rel: null, ignored: null, tracked: null, remotes: null, visibility: null, posture: 'no-repo', rows, warnings: [] };
  }

  const inside = relative(repo, path);
  const rel = inside && !inside.startsWith('..') ? inside : path;
  add('E1', 'info', `${rel}/ inside ${repo}`);

  // check-ignore consults the index by default, so a tracked path correctly
  // reads as NOT ignored even when a pattern would otherwise match it.
  const ci = run('git', ['check-ignore', '-q', '--', path], { cwd: repo });
  const ignored = ci.code === 0 ? true : ci.code === 1 ? false : null;

  const ls = run('git', ['ls-files', '--', path], { cwd: repo });
  const trackedFiles = ls.code === 0 && ls.out ? ls.out.split('\n').filter(Boolean) : [];
  const tracked = ls.code === 0 ? trackedFiles.length : null;

  // A posture that was decided and written down is not the thing to warn about.
  // The warning is for a posture nobody chose — so an artifact whose status
  // header says it is committed on purpose settles it. See references/artifacts.md.
  const declared = trackedFiles.filter((f) => f.endsWith('.md')).find((f) => {
    try {
      const head = readFileSync(resolve(repo, f), 'utf8').split('\n', 15).join('\n');
      return /^\*\*Tracking:\*\*\s*committed/im.test(head);
    } catch { return false; }
  }) || null;

  const rm = run('git', ['remote'], { cwd: repo });
  const remotes = rm.code === 0 ? (rm.out ? rm.out.split('\n').filter(Boolean) : []) : null;

  // Only worth a network round-trip if there is somewhere for it to go.
  let visibility = null; // 'public' | 'private' | null = unknown
  if (remotes && remotes.length) {
    const gh = run('gh', ['repo', 'view', '--json', 'isPrivate', '-q', '.isPrivate'], { cwd: repo, timeout: GH_MS });
    if (gh.code === 0 && /^(true|false)$/.test(gh.out)) visibility = gh.out === 'true' ? 'private' : 'public';
  }

  // E2 is a fact, never a warning: a public repository is only a problem in
  // combination with what is in it, and E3 is where that combination is judged.
  // Warning here too would fire on every public repo whose artifacts are safely
  // ignored, which is exactly how an advisory check teaches people to skim past it.
  const published = remotes === null || remotes.length > 0;
  add('E2', 'info',
    remotes === null ? 'could not read this repository’s remotes — treat it as published'
      : !remotes.length ? 'no remote — nothing here is published anywhere'
      : visibility === 'private' ? 'the repository is private'
      : visibility === 'public' ? 'the repository is PUBLIC — whatever is committed here is world-readable'
      : `remote (${remotes.join(', ')}) but visibility is unknown — gh is missing, unauthenticated, or this is not a GitHub repository. Treat it as public`);

  let posture, level, detail;
  if (tracked === null) {
    posture = 'unknown'; level = 'warn';
    detail = 'could not ask git what it does with this path — check the posture by hand before committing anything';
  } else if (tracked > 0) {
    posture = 'tracked';
    if (visibility === 'private' || !published) {
      level = 'info';
      detail = `${tracked} artifact file(s) tracked in a ${visibility === 'private' ? 'private repository' : 'repository with no remote'} — a deliberate override. Say so in each artifact’s status header`;
    } else if (declared) {
      level = 'info';
      detail = `${tracked} artifact file(s) tracked on purpose — ${declared} declares it. Every commit here still owes a sanitisation pass`;
    } else {
      level = 'warn';
      detail = `${tracked} artifact file(s) are TRACKED and ${visibility === 'public' ? 'this repository is public' : 'this repository’s visibility is unknown'} — verbatim answers, real paths and pasted listings are published with them. Sanitise them and record the decision in their status header, or move them out of git`;
    }
  } else if (ignored === true) {
    posture = 'ignored'; level = 'ok';
    detail = 'untracked and ignored — the default posture is in force';
  } else {
    posture = 'loose'; level = 'warn';
    detail = `untracked but NOT ignored — git status lists these, so one \`git add -A\` sweeps them in. Add "${rel}/" to .gitignore, or decide to track them deliberately`;
  }
  add('E3', level, detail);

  return { repo, rel, ignored, tracked, declared, remotes, visibility, posture, rows, warnings: rows.filter((r) => r.level === 'warn') };
}

// ════════════════════════════════════════════════════════════════════════════
//  CLI
// ════════════════════════════════════════════════════════════════════════════

const USAGE = `usage:
  megascope.mjs validate <round-N.data.json>
  megascope.mjs build    <round-N.data.json> [out.html]
  megascope.mjs ready    <scope-dir>/
  megascope.mjs env      <scope-dir>/`;

function report(result) {
  for (const e of result.structural) console.error(`  ✗ ${e.message}`);
  for (const f of result.semantic) console.error(`  ✗ ${f.id} · ${f.message}`);
}

function main(argv) {
  const [mode, arg1, arg2] = argv;
  if (!mode || !arg1) { console.error(USAGE); return 2; }

  if (mode === 'validate' || mode === 'build') {
    let data;
    try { data = JSON.parse(readFileSync(arg1, 'utf8')); }
    catch (e) { console.error(`✗ ${basename(arg1)} is not valid JSON: ${e.message}`); return 1; }

    if (mode === 'validate') {
      const r = validateData(data, { path: resolve(arg1), phase: 'validate' });
      if (!r.ok) { console.error(`✗ ${basename(arg1)}`); report(r); return 1; }
      console.log(`✓ ${basename(arg1)} — ${data.sections.length} sections · ${data.questions.length} questions`);
      return 0;
    }

    const r = buildDoc(arg1, arg2);
    if (!r.ok) { console.error(`✗ ${basename(arg1)} — refusing to build`); report(r); return 1; }
    console.log(`✓ wrote ${r.out}  (${r.sections} sections · ${r.questions} questions)`);
    return 0;
  }

  // E-rows are advisory and never touch an exit code. They report a posture
  // the caller chose; a private repo that tracks everything is a legitimate
  // answer, and a gate that refused it would just be switched off.
  const MARK = { ok: '✓', info: '·', warn: '⚠' };
  const reportEnv = (e) => {
    for (const row of e.rows) console.log(`  ${MARK[row.level]} ${row.id} · ${row.detail}`);
    if (e.warnings.length) {
      console.log(`\n⚠ posture: ${e.warnings.length === 1 ? 'one thing' : `${e.warnings.length} things`} to look at above. Advisory — nothing here blocks the scope.`);
    }
  };

  if (mode === 'env') {
    reportEnv(environment(arg1));
    return 0;
  }

  if (mode === 'ready') {
    const r = ready(arg1);
    for (const row of r.rows) console.log(`  ${row.ok ? '✓' : '✗'} ${row.id} · ${row.detail}`);
    console.log('');
    const e = environment(arg1);
    reportEnv(e);
    if (!r.ok) { console.error(`\nnot ready: ${r.first.id} — ${r.first.detail}`); return 1; }
    console.log('\nready — write SCOPE.md and the kick-off prompt.');
    return 0;
  }

  console.error(USAGE);
  return 2;
}

// Run only when invoked directly, never when imported. Compare REAL paths on
// both sides: the skill is deployed as a symlink (~/.claude/skills/megascope),
// and node resolves import.meta.url through it while argv[1] keeps the link
// path — so a plain string compare is false exactly where it matters most.
const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
