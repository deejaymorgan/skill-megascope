#!/usr/bin/env node
// ready.mjs — the close, R1 to R6.
//
// `ready` is the only thing standing between "I think we're done" and a
// kick-off brief. It has to fail for the right reason and say which, because
// its exit-1 message IS the spec for the next round.
//
// The passing directory is BUILT here rather than checked in, and built by
// performing exactly the close SKILL.md documents: take the answered scope,
// update the final round's data file in place to record what its answers
// settled. If that procedure ever stopped producing a ready scope, this test
// goes red — which a directory of hand-written files could never tell you.
//
// Run: `npm test`.

import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { ready, validateData } from '../skills/megascope/assets/megascope.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('\n▶ ready (the close)');

/** Build a finished scope in a temp dir, optionally damaged one way. */
function scopeDir(damage) {
  const dir = mkdtempSync(join(tmpdir(), 'megascope-ready-'));
  cpSync(resolve(ROOT, 'tests/fixtures/scope'), dir, { recursive: true });
  cpSync(resolve(ROOT, 'tests/fixtures/ready/round-2.answers.md'), join(dir, 'round-2.answers.md'));

  // THE CLOSE, as SKILL.md documents it: the final round's answers came back,
  // so its data file is updated in place to record what they settled. No new
  // round, no bumped revision — the questions did not change, the scope did.
  const p = join(dir, 'round-2.data.json');
  const data = JSON.parse(readFileSync(p, 'utf8'));
  const slot = (name) => data.meta.scope.find((s) => s.slot === name);
  Object.assign(slot('boundary'), {
    state: 'settled',
    text: 'Two readings: one at the mast, one in the low corner. A daily summary only, not every reading.',
    evidence: ['r2:Q6', 'r2:Q7'],
    reopened: null,
  });
  Object.assign(slot('verification'), {
    state: 'settled',
    text: 'A minimum thermometer read each morning, plus a warning the same evening if a sensor goes quiet.',
    evidence: ['r2:Q8', 'r2:Q9'],
    reopened: null,
  });
  if (damage) damage(data, dir);
  writeFileSync(p, JSON.stringify(data, null, 2));
  return dir;
}

const run = (damage) => {
  const dir = scopeDir(damage);
  try { return { r: ready(dir), dir }; } finally { /* caller cleans up */ }
};

// ── the happy path ─────────────────────────────────────────────────────────
{
  const dir = scopeDir();
  const r = ready(dir);
  check(r.ok, 'a finished scope is ready' + (r.ok ? '' : ` — ${r.first.id}: ${r.first.detail}`));
  check(r.rows.length === 6 && r.rows.every((row) => row.ok), 'all six conditions pass, and all six are reported');

  // The close must also leave a file that still validates — otherwise the
  // record of the agreed scope is itself malformed.
  const data = JSON.parse(readFileSync(join(dir, 'round-2.data.json'), 'utf8'));
  const v = validateData(data, { path: join(dir, 'round-2.data.json'), phase: 'validate' });
  check(v.ok, 'and the updated round file still validates' +
    (v.ok ? '' : `: ${[...v.structural, ...v.semantic].map((e) => e.message || e).join('; ')}`));

  // ...but must NOT be buildable. That refusal is the loop terminator.
  const b = validateData(data, { path: join(dir, 'round-2.data.json'), phase: 'build' });
  const s8 = b.semantic.find((f) => f.id === 'S8');
  check(!!s8, 'while `build` refuses it — the loop terminates on a tool refusal, not a judgment call');
  check(s8?.message.includes('kick-off prompt'), `and says what to do instead: "${s8?.message}"`);
  rmSync(dir, { recursive: true, force: true });
}

// ── one failure per condition, each naming itself ──────────────────────────
const CASES = [
  {
    id: 'R1',
    what: 'a slot left open',
    damage: (d) => { d.meta.scope.find((s) => s.slot === 'verification').state = 'open'; },
    expect: /slot "verification" is open/,
  },
  {
    id: 'R2',
    what: 'a slot settled with almost nothing written',
    damage: (d) => { d.meta.scope.find((s) => s.slot === 'goal').text = 'Frost, basically.'; },
    expect: /slot "goal" says almost nothing/,
  },
  {
    id: 'R3',
    what: 'a slot settled on evidence that does not resolve',
    damage: (d) => { d.meta.scope.find((s) => s.slot === 'goal').evidence = ['r1:Q9']; },
    expect: /Q9 does not appear/,
  },
  {
    id: 'R4',
    what: 'a deliverable that never says what kind of work this is',
    damage: (d) => { delete d.meta.scope.find((s) => s.slot === 'deliverable').kind; },
    expect: /names no kind/,
  },
  {
    id: 'R5',
    what: 'the scope settled anyway while a question is still rejected',
    damage: (d, dir) => {
      const p = join(dir, 'round-2.answers.md');
      writeFileSync(p, readFileSync(p, 'utf8').replace(
        '- Q9 [DEFAULT] (verification) A: Warn me the same evening',
        '- Q9 [REJECTED] (verification) no answer — this question did not make sense to me\n    asked: What should happen when a sensor goes quiet?'));
      // settled on Q8 alone, so the evidence still resolves — R5 is the only
      // thing left that notices the user never understood Q9
      d.meta.scope.find((s) => s.slot === 'verification').evidence = ['r2:Q8'];
    },
    expect: /Q9 still rejected/,
  },
  {
    id: 'R6',
    what: 'a round whose paste-back was never saved',
    damage: (d, dir) => {
      rmSync(join(dir, 'round-1.answers.md'));
      // round 1's slots now rest on assumptions rather than on answers nobody
      // kept — legal, and it leaves R6 as the only condition still unmet
      for (const name of ['goal', 'deliverable', 'constraints']) {
        Object.assign(d.meta.scope.find((s) => s.slot === name), {
          evidence: [], assumed: true,
          assumption: 'Round one’s answers were never saved, so this stands on what was said in conversation.',
        });
      }
    },
    expect: /round 1 has no round-1\.answers\.md/,
  },
];

for (const c of CASES) {
  const dir = scopeDir(c.damage);
  const r = ready(dir);
  const row = r.rows.find((x) => x.id === c.id);
  check(!r.ok && r.first?.id === c.id,
    `${c.id} · ${c.what} — reported first, as ${r.first?.id ?? 'nothing'}`);
  check(c.expect.test(row?.detail || ''), `   and names it: "${row?.detail}"`);
  rmSync(dir, { recursive: true, force: true });
}

// ── the shipped example is a worked example, not a decorative one ──────────
// If the example stops being a scope that closes, it stops being worth reading.
{
  const dir = resolve(ROOT, 'examples/reading-log');
  const r = ready(dir);
  check(r.ok, 'examples/reading-log closes' + (r.ok ? '' : ` — ${r.first.id}: ${r.first.detail}`));

  // and every round in it is a legal round
  for (const n of [1, 2]) {
    const p = join(dir, `round-${n}.data.json`);
    const v = validateData(JSON.parse(readFileSync(p, 'utf8')), { path: p, phase: 'validate' });
    check(v.ok, `round-${n}.data.json validates` +
      (v.ok ? '' : `: ${[...v.structural.map((e) => e.message), ...v.semantic.map((f) => `${f.id} ${f.message}`)].join('; ')}`));
  }
  // round 2 was a real round when it was published: its questions cover the
  // slots that were open then, which is what `build` checks
  check(existsSync(join(dir, 'round-1.answers.md')) && existsSync(join(dir, 'round-2.answers.md')),
    'both paste-backs are saved verbatim, which is what evidence resolves against');
}

// ── the message is the spec for the next round ─────────────────────────────
{
  const dir = scopeDir((d) => {
    const v = d.meta.scope.find((s) => s.slot === 'verification');
    v.state = 'open'; v.evidence = [];
  });
  const r = ready(dir);
  check(/asked about, but not resolved yet/.test(r.first.detail),
    'R1 distinguishes a slot that was asked about from one no round has reached');
  rmSync(dir, { recursive: true, force: true });
}

console.log(failures ? `\n✗ ${failures} ready check(s) failed` : '');
process.exit(failures ? 1 : 0);
