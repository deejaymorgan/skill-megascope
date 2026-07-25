#!/usr/bin/env node
// smoke.mjs — megascope render + round-trip smoke test.
//
// For each data case (the fixtures under tests/fixtures/) it:
//   1. validates the questions-JSON against assets/schema.json (ajv) + semantic checks
//   2. injects it into the engine shell and renders headless (jsdom)
//   3. asserts: zero script errors, correct card count, EVERY default pre-selected
//      to its recommendation, live counts, and a clean export round-trip
//
// Requires devDeps: `npm install` (ajv, jsdom). Run: `npm test`.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import Ajv from 'ajv';
import { injectData } from '../scripts/inject.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENGINE = resolve(ROOT, 'skills/megascope/assets/engine.html');
const SCHEMA = resolve(ROOT, 'skills/megascope/assets/schema.json');

let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

const engine = await readFile(ENGINE, 'utf8');
const schema = JSON.parse(await readFile(SCHEMA, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const CASES = [
  { name: 'round 1 (fixture)', path: resolve(ROOT, 'tests/fixtures/scope/round-1.data.json') },
  { name: 'round 2 (fixture)', path: resolve(ROOT, 'tests/fixtures/scope/round-2.data.json') },
];

const recKeys = (q) => (Array.isArray(q.rec) ? q.rec.slice() : [q.rec]);

/** Render a built document headlessly, optionally against a pre-seeded localStorage. */
function render(html, seed) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const m = (e && (e.message || String(e))) || '';
    // jsdom's CSS parser can't handle modern syntax (color-mix, backdrop-filter) —
    // that's a jsdom limitation, not a page bug (real browsers parse it cleanly).
    if (/Could not parse CSS stylesheet/i.test(m)) return;
    errors.push('jsdomError: ' + m);
  });
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    // Both rounds share an origin on purpose — that is the whole point of the
    // isolation test below. Different origins would isolate them for free and
    // prove nothing about the storage key.
    url: 'http://localhost/',
    beforeParse(window) {
      window.IntersectionObserver = class {
        observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
      };
      if (!window.matchMedia) {
        window.matchMedia = (q) => ({
          matches: false, media: q,
          addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null,
        });
      }
      try {
        Object.defineProperty(window.navigator, 'clipboard', {
          configurable: true, value: { writeText: () => Promise.resolve() },
        });
      } catch { /* ignore */ }
      for (const [k, v] of Object.entries(seed || {})) window.localStorage.setItem(k, v);
    },
  });
  const { window } = dom;
  return {
    dom, window, doc: window.document, errors,
    fire: (el, t) => el.dispatchEvent(new window.Event(t, { bubbles: true })),
    keys: () => Object.keys({ ...window.localStorage }),
  };
}
const CLOSING_DEFAULT =
  'Please turn these into a phased build plan with detailed Phase-1 (MVP) requirements, and follow up on anything I flagged.';

for (const c of CASES) {
  console.log(`\n▶ ${c.name}`);
  const data = JSON.parse(await readFile(c.path, 'utf8'));

  // --- 1. schema validation ---
  const schemaOk = validate(data);
  check(schemaOk, 'schema-valid' + (schemaOk ? '' : ': ' + ajv.errorsText(validate.errors)));

  // --- 2. semantic checks ---
  const secIds = new Set(data.sections.map((s) => s.id));
  check(secIds.size === data.sections.length, 'section ids are unique');
  const qids = data.questions.map((q) => q.id);
  check(new Set(qids).size === qids.length, 'question ids are unique');
  let optUniq = true, recValid = true, secRef = true;
  for (const q of data.questions) {
    const keys = q.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) optUniq = false;
    if (!recKeys(q).every((k) => keys.includes(k))) recValid = false;
    if (!secIds.has(q.section)) secRef = false;
  }
  check(optUniq, 'option keys are unique within each question');
  check(recValid, 'every rec key exists in its options');
  check(secRef, 'every question.section references a known section');

  // --- 3. headless render ---
  const { window, doc, errors, fire } = render(injectData(engine, data));

  check(errors.length === 0, 'zero script/console errors' + (errors.length ? ` — ${errors[0]}` : ''));

  const cards = [...doc.querySelectorAll('.q')];
  check(cards.length === data.questions.length, `rendered ${cards.length}/${data.questions.length} question cards`);

  let defaultsOk = 0;
  for (const q of data.questions) {
    const card = doc.getElementById('card-' + q.id);
    if (!card) continue;
    const checked = [...card.querySelectorAll('input')].filter((i) => i.checked).map((i) => i.value).sort();
    const rec = recKeys(q).sort();
    if (JSON.stringify(checked) === JSON.stringify(rec)) defaultsOk++;
  }
  check(defaultsOk === data.questions.length,
    `every default pre-selected to its ★ recommendation (${defaultsOk}/${data.questions.length})`);

  check(doc.getElementById('tb-total').textContent === String(data.questions.length), 'total count = N');
  check(doc.getElementById('tb-changed').textContent === '0', 'changed starts at 0');
  check(doc.getElementById('tb-flagged').textContent === '0', 'flagged starts at 0');
  check(doc.getElementById('tb-reviewed').textContent === '0', 'reviewed starts at 0');
  check(doc.querySelectorAll('.nav a[data-sec]').length === data.sections.length, 'nav links = sections');

  // --- interaction + export round-trip ---
  const q0 = data.questions.find((q) => !q.multi) || data.questions[0];
  const rec0 = recKeys(q0)[0];
  const alt = q0.options.find((o) => o.key !== rec0);
  const inp = doc.querySelector(`#card-${q0.id} .opt[data-key="${alt.key}"] input`);
  inp.checked = true; fire(inp, 'change');
  const q1 = data.questions.find((q) => q.id !== q0.id) || q0;
  doc.querySelector(`#card-${q1.id} .flag-toggle`).click();
  const q2 = data.questions.find((q) => q.id !== q0.id && q.id !== q1.id) || q1;
  const ta = doc.querySelector(`#card-${q2.id} .q-note`);
  ta.value = 'test note'; fire(ta, 'input');

  check(Number(doc.getElementById('tb-changed').textContent) >= 1, 'changing an option increments "changed"');
  check(doc.getElementById('tb-flagged').textContent === '1', 'flagging increments "flagged"');
  check(doc.getElementById('card-' + q0.id).dataset.state === 'changed', 'changed card gets the "changed" border state');

  doc.getElementById('copyBtn').click();
  const exp = doc.getElementById('exportText').textContent;
  check(exp.includes(`# ${data.meta.title} — scoping answers`), 'export has the titled header');
  check(/Summary: \d+ changed · \d+ flagged for follow-up · \d+\/\d+ reviewed\./.test(exp), 'export has a summary line');
  check(exp.includes('[CHANGED]'), 'export marks a CHANGED item');
  check(exp.includes('(rec was'), 'export shows the recommendation when changed');
  check(exp.includes('⚑ FOLLOW-UP'), 'export marks a flagged item');
  check(exp.includes('note: test note'), 'export includes notes');
  check(exp.trim().endsWith(data.meta.closingAsk || CLOSING_DEFAULT), 'export ends with the closing ask');

  window.close();
}

// ══ round isolation ═══════════════════════════════════════════════════════
// The named bug: rounds of one project share an origin and a project slug, so
// round 2 silently rehydrated round 1's answers, and coerceChoice quietly
// dropped the keys that no longer existed. Both rounds render at the SAME
// origin here on purpose — different origins would isolate them for free and
// prove nothing about the storage key.
console.log('\n▶ round isolation (shared origin, derived storage key)');

const r1Data = JSON.parse(await readFile(CASES[0].path, 'utf8'));
const r2Data = JSON.parse(await readFile(CASES[1].path, 'utf8'));
const R1_KEY = 'orchard-weather-station-r1-scoping-v1';
const R2_KEY = 'orchard-weather-station-r2-scoping-v1';

const a = render(injectData(engine, r1Data));
const q1alt = r1Data.questions[0].options.find((o) => o.key !== r1Data.questions[0].rec).key;
const inpA = a.doc.querySelector(`#card-Q1 .opt[data-key="${q1alt}"] input`);
inpA.checked = true; a.fire(inpA, 'change');

check(a.keys().includes(R1_KEY), `round 1 writes to ${R1_KEY}`);
check(!a.keys().includes('orchard-weather-station-scoping-v1'),
  'the bare project slug is no longer a storage key — the round is always in it');

// Hostile seed: round 1's store, forged to also carry an answer for a round-2
// question id. If round 2 read the wrong key, this is what would leak through.
const forged = JSON.stringify({
  __notes: 'notes from the round before',
  Q6: { choice: 'a', note: '', otherText: '', flag: false, rej: false, rev: true },
});
const b = render(injectData(engine, r2Data), { [R1_KEY]: forged });
const q6checked = [...b.doc.querySelectorAll('#card-Q6 input')].filter((i) => i.checked).map((i) => i.value);
check(JSON.stringify(q6checked) === JSON.stringify(['b']),
  `round 2 shows its own recommendation, not round 1's stored answer (got ${q6checked.join(',') || 'nothing'})`);
check(b.doc.getElementById('globalNotes').value === '',
  'overall notes do not leak across rounds either');
check(b.keys().includes(R2_KEY), `round 2 writes to ${R2_KEY}`);

// The counterfactual. Without it, the assertions above would also pass if
// persistence were simply broken.
const c = render(injectData(engine, r2Data), { [R2_KEY]: forged });
const q6restored = [...c.doc.querySelectorAll('#card-Q6 input')].filter((i) => i.checked).map((i) => i.value);
check(JSON.stringify(q6restored) === JSON.stringify(['a']),
  'seeded under its OWN key, round 2 does restore it — the isolation is the key, not broken persistence');
check(c.doc.getElementById('globalNotes').value === 'notes from the round before',
  'and its own notes come back');

// ══ the format gate ═══════════════════════════════════════════════════════
// Before this, a malformed payload was swallowed and fell through to the
// friendly empty state, so a broken run produced a blank document that looked
// deliberate. Each outcome must now be distinguishable.
console.log('\n▶ format gate');

const rawShell = render(engine);
check(!!rawShell.doc.querySelector('.empty') && !rawShell.doc.querySelector('.empty.bad'),
  'the raw shell still shows the friendly nothing-loaded note');

const v1 = structuredClone(r1Data); v1.formatVersion = 1;
const gateV1 = render(injectData(engine, v1));
check(!!gateV1.doc.querySelector('.empty.bad'), 'a v1 payload is refused loudly, not rendered blank');
check(/formatVersion/.test(gateV1.doc.querySelector('.empty.bad').textContent),
  'and the refusal names the version it found');
check(gateV1.doc.querySelectorAll('.q').length === 0, 'nothing renders behind the refusal');

const broken = render(engine.replace('id="scoping-data">{}', 'id="scoping-data">{not json'));
check(!!broken.doc.querySelector('.empty.bad'), 'an unparseable data block is refused loudly too');

console.log(`\n${failures ? `✗ ${failures} check(s) failed` : '✓ all checks passed'}\n`);
process.exit(failures ? 1 : 0);
