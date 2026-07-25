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
import { parseAnswers } from '../skills/megascope/assets/megascope.mjs';

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
// Deliverable-neutral: a round's output is an updated scope, not a phase plan.
// This string is asserted below, so it and the engine's default change together
// or the gate breaks.
const CLOSING_DEFAULT = 'Update the scope from these answers, then tell me what is still open.';

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

  // --- the four-part shape actually reaches the page ---
  // The old harness asserted no optional text at all, which is how `why` could
  // have stopped rendering without a single check going red.
  const text = (sel) => { const n = doc.querySelector(sel); return n ? n.textContent.trim() : null; };
  let shapeOk = 0, shapeWhy = '';
  for (const q of data.questions) {
    const problems = [];
    if (text(`#card-${q.id} .q-context`) !== q.context) problems.push('context');
    const items = [...doc.querySelectorAll(`#card-${q.id} .q-breakdown li`)].map((li) => li.textContent.trim());
    if (JSON.stringify(items) !== JSON.stringify(q.breakdown)) problems.push(`breakdown (${items.length}/${q.breakdown.length})`);
    if (text(`#card-${q.id} .q-title`) !== q.question) problems.push('question');
    if (text(`#card-${q.id} .q-why`) !== q.why) problems.push('why');
    if (!text(`#card-${q.id} .q-switch`)?.endsWith(q.switchIf)) problems.push('switchIf');
    // present iff technical — the key is absent, not null, when it is false
    const ex = doc.querySelector(`#card-${q.id} .q-example`);
    if (q.technical ? !ex?.textContent.includes(q.example) : ex) problems.push('example');
    if (!problems.length) shapeOk++;
    else if (!shapeWhy) shapeWhy = ` — ${q.id} missing ${problems.join(', ')}`;
  }
  check(shapeOk === data.questions.length,
    `context, every breakdown item, question, why and switchIf reach every card (${shapeOk}/${data.questions.length})${shapeWhy}`);

  const technical = data.questions.filter((q) => q.technical).length;
  check(doc.querySelectorAll('.q-example').length === technical,
    `.q-example renders on exactly the ${technical} technical question(s), and nowhere else`);

  // --- keyboard + assistive affordances ---
  check([...doc.querySelectorAll('.opts')].every((o) => {
    const role = o.getAttribute('role');
    const label = o.getAttribute('aria-labelledby');
    return (role === 'radiogroup' || role === 'group') && label && doc.getElementById(label);
  }), 'every option group is a named radiogroup/group');
  check(doc.querySelector('.modal-card')?.getAttribute('aria-modal') === 'true', 'the export modal is a real dialog');
  check([...doc.querySelectorAll('.q')].every((c) => c.querySelector('.rej-toggle') && c.querySelector('.copyq-btn')),
    'every card carries the reject control and its own copy button');
  check([...doc.querySelectorAll('.q')].every((c) => c.querySelector('.opt.own')),
    'every question carries the __own escape, added by the engine and never declared by the data');

  check(doc.getElementById('tb-total').textContent === String(data.questions.length), 'total count = N');
  for (const id of ['tb-changed', 'tb-own', 'tb-rejected', 'tb-flagged', 'tb-answered']) {
    check(doc.getElementById(id).textContent === '0', `${id.slice(3)} starts at 0`);
  }
  check(doc.querySelectorAll('.nav a[data-sec]').length === data.sections.length, 'nav links = sections');

  // --- drive all four states + the flag, then round-trip the export ---
  const singles = data.questions.filter((q) => !q.multi);
  const [qChanged, qFlagged, qOwn, qRejected] = [singles[0], singles[1], singles[2], singles[3] || singles[1]];

  const alt = qChanged.options.find((o) => o.key !== recKeys(qChanged)[0]);
  const inp = doc.querySelector(`#card-${qChanged.id} .opt[data-key="${alt.key}"] input`);
  inp.checked = true; fire(inp, 'change');

  doc.querySelector(`#card-${qFlagged.id} .flag-toggle`).click();
  const note = doc.querySelector(`#card-${qFlagged.id} .q-note`);
  note.value = 'test note'; fire(note, 'input');

  const ownInp = doc.querySelector(`#card-${qOwn.id} .opt[data-key="__own"] input`);
  ownInp.checked = true; fire(ownInp, 'change');
  const other = doc.querySelector(`#card-${qOwn.id} .q-other`);
  check(!other.hidden, 'picking "in my own words" reveals the box it promises');
  other.value = 'what I actually want'; fire(other, 'input');

  doc.querySelector(`#card-${qRejected.id} .rej-toggle`).click();

  check(doc.getElementById('tb-changed').textContent === '1', 'changing an option increments "changed"');
  check(doc.getElementById('tb-own').textContent === '1', 'own words counts separately from changed');
  check(doc.getElementById('tb-rejected').textContent === '1', 'rejecting increments "need explaining"');
  check(doc.getElementById('tb-flagged').textContent === '1', 'flagging increments "flagged"');
  check(doc.getElementById('card-' + qChanged.id).dataset.state === 'changed', 'changed card gets its border state');
  check(doc.getElementById('card-' + qRejected.id).dataset.state === 'rejected',
    'rejected outranks everything else the card could be saying');

  // The reassuring lie this document must not tell.
  check(!doc.getElementById('hprog-txt').textContent.startsWith(String(data.questions.length)),
    'the progress bar cannot read complete while a question is rejected');

  doc.getElementById('copyBtn').click();
  const exp = doc.getElementById('exportText').textContent;
  const line = (id) => exp.split('\n').find((l) => l.startsWith(`- ${id} `));

  check(exp.startsWith(`# ${data.meta.title} — round ${data.meta.round.n} of ${data.meta.round.of}: answers`),
    'export header names the round');
  check(exp.split('\n')[1] === `scope-id: ${data.meta.project} · r${data.meta.round.n}/${data.meta.round.of} rev ${data.meta.round.revision}`,
    'line 2 is the machine-readable scope-id — its absence is how a legacy export identifies itself');
  check(/^Summary: \d+ default · \d+ changed · \d+ in own words · \d+ rejected · \d+ flagged · \d+\/\d+ answered\.$/m.test(exp),
    'the summary line reports all four states as a partition');
  check(/^Readiness this round: .+ [✓—]( · .+ [✓—])+$/m.test(exp), 'the readiness strip is reproduced verbatim in the export');

  check(/^- \S+ \[CHANGED\] \(\w+\) [A-Z0-9-]+: .+ {3}\(rec was [A-Z0-9-]+: .+\)$/.test(line(qChanged.id)),
    `CHANGED line, with a three-space (rec was …) — ${line(qChanged.id)}`);
  check(line(qFlagged.id).includes(' · FLAGGED]') && line(qFlagged.id).includes('[DEFAULT · FLAGGED]'),
    'FLAGGED sits inside the brackets, orthogonal to state');
  check(!line(qFlagged.id).includes('(rec was'), '(rec was …) is emitted for CHANGED and OWN only');
  check(line(qOwn.id).includes('OWN: in my own words') && line(qOwn.id).includes('(rec was'),
    'an OWN payload prints the fixed literal and still shows the recommendation');
  check(exp.includes('    own words: what I actually want'), 'own words is a four-space continuation');
  check(line(qRejected.id).includes(`[REJECTED] (${qRejected.slot}) no answer — this question did not make sense to me`),
    'the REJECTED sentence is fixed and non-overridable');
  check(exp.includes(`    asked: ${qRejected.question}`),
    'a rejected question carries its text, so it can be re-taught without opening the data file');
  check(exp.includes('    note: test note'), 'note is a four-space continuation');
  check(exp.split('\n').every((l) => !/^ +/.test(l) || /^ {4}(own words|asked|note): \S/.test(l)),
    'every indented line is a well-formed continuation with a non-empty value');
  check(data.questions.every((q) => new RegExp(`^- ${q.id} \\[`, 'm').test(exp)), 'every question reaches the export');
  check(exp.trim().endsWith(data.meta.closingAsk || CLOSING_DEFAULT), 'export ends with the closing ask');

  // Last, because it deliberately resets the states set up above.
  doc.getElementById('acceptAll').click();
  check(doc.getElementById('tb-rejected').textContent === '1',
    '"Accept all defaults" does not sweep up a question the user said they did not understand');
  check(Number(doc.getElementById('tb-answered').textContent) === data.questions.length - 1,
    'answered = reviewed AND not rejected, even after accepting everything else');

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

// ══ the escapes survive a reload ═══════════════════════════════════════════
// otherText and rej have to be in BOTH blank() and load()'s whitelist. Missing
// from either, the two controls that exist so nobody gets boxed in are the two
// that silently lose their content.
console.log('\n▶ reload (the escapes persist)');

const live = render(injectData(engine, r1Data));
const liveOwn = live.doc.querySelector('#card-Q1 .opt[data-key="__own"] input');
liveOwn.checked = true; live.fire(liveOwn, 'change');
const liveText = live.doc.querySelector('#card-Q1 .q-other');
liveText.value = 'neither of those, actually'; live.fire(liveText, 'input');
live.doc.querySelector('#card-Q2 .rej-toggle').click();
const liveNote = live.doc.querySelector('#card-Q2 .q-note');
liveNote.value = 'I do not follow the second option'; live.fire(liveNote, 'input');

const back = render(injectData(engine, r1Data), { [R1_KEY]: live.window.localStorage.getItem(R1_KEY) });
check(back.doc.querySelector('#card-Q1 .q-other').value === 'neither of those, actually',
  'the user’s own words come back after a reload');
check(!back.doc.querySelector('#card-Q1 .q-other').hidden, 'and the box is open to show them');
check(back.doc.getElementById('card-Q2').dataset.state === 'rejected', 'a rejection comes back after a reload');
check(back.doc.getElementById('tb-rejected').textContent === '1', 'and is still counted');
back.doc.getElementById('copyBtn').click();
check(back.doc.getElementById('exportText').textContent.includes('    own words: neither of those, actually'),
  'and both reach the export from restored state alone');

// ══ orphan sections ═══════════════════════════════════════════════════════
// The old harness asserted that orphans never happen, so the branch collecting
// them had never executed — and it printed the sentinel as "## __other. Other".
console.log('\n▶ orphan sections (a branch that had never run)');

const orphan = structuredClone(r1Data);
orphan.questions[0].section = 'ZZ';
const orph = render(injectData(engine, orphan));
check(!!orph.doc.getElementById('sec-__other'), 'a question with an unknown section lands in a trailing Other block');
check(orph.doc.querySelectorAll('.q').length === orphan.questions.length, 'and no question is lost on the way');
orph.doc.getElementById('copyBtn').click();
const orphExp = orph.doc.getElementById('exportText').textContent;
check(/^## Other$/m.test(orphExp), 'the export heading is "## Other"');
check(!orphExp.includes('__other'), 'the sentinel never leaks into the document');

// ══ the export is a contract between two programs ═════════════════════════
// The engine writes it; megascope.mjs parses it back to resolve every evidence
// claim a later round makes. Nothing else couples them, so if the grammar
// drifts on either side, readiness quietly starts passing on nothing.
console.log('\n▶ export ⇄ parser (the contract holds end to end)');

const w = render(injectData(engine, r1Data));
const wOwn = w.doc.querySelector('#card-Q4 .opt[data-key="__own"] input');
wOwn.checked = true; w.fire(wOwn, 'change');
const wText = w.doc.querySelector('#card-Q4 .q-other');
wText.value = 'a plan, but a very short one'; w.fire(wText, 'input');
w.doc.querySelector('#card-Q2 .flag-toggle').click();
w.doc.querySelector('#card-Q3 .rej-toggle').click();
const wAlt = w.doc.querySelector('#card-Q1 .opt[data-key="b"] input');
wAlt.checked = true; w.fire(wAlt, 'change');
w.doc.getElementById('globalNotes').value = 'one thing you did not ask about';
w.fire(w.doc.getElementById('globalNotes'), 'input');
w.doc.getElementById('copyBtn').click();

const round = parseAnswers(w.doc.getElementById('exportText').textContent);
check(!round.legacy && round.scopeId.project === r1Data.meta.project && round.scopeId.n === 1,
  'the parser reads back the scope-id the engine wrote');
check(round.answers.size === r1Data.questions.length,
  `every question survives the round trip (${round.answers.size}/${r1Data.questions.length})`);
check(round.answers.get('Q1').state === 'CHANGED', 'CHANGED round-trips');
check(round.answers.get('Q2').state === 'DEFAULT' && round.answers.get('Q2').flagged,
  'DEFAULT + FLAGGED round-trips as two independent facts');
check(round.answers.get('Q3').state === 'REJECTED' && round.answers.get('Q3').asked === r1Data.questions[2].question,
  'REJECTED round-trips carrying the question that was asked');
check(round.answers.get('Q4').state === 'OWN' && round.answers.get('Q4').ownWords === 'a plan, but a very short one',
  'OWN round-trips carrying the user’s own words');
check([...round.answers.values()].every((a) => a.slot),
  'every answer carries the slot it feeds, which is what evidence resolves against');
check(round.notes === 'one thing you did not ask about', 'the overall-notes block round-trips');

// And the thing S10 exists to refuse.
check(round.answers.get('Q3').state === 'REJECTED',
  'a rejected question is legible as rejected, so it can never resolve as evidence');

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
