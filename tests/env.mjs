#!/usr/bin/env node
// env.mjs — the posture check, E1 to E3.
//
// `env` answers one question: if this scope gets committed, who sees it? It got
// written because that question was left to per-repo convention, and convention
// put a brief full of personal detail one `git add` away from a public repo.
//
// Two halves, for two different risks:
//
//   CLASSIFICATION  the shell is stubbed, so every combination of tracked /
//                   ignored / public / private can be asserted without a network,
//                   a GitHub account, or `gh` being installed at all. This is
//                   where the judgment lives: which combinations warn, which are
//                   a deliberate override, and which are simply facts.
//
//   REAL GIT        a temp repository, actually initialised. Stubs agree with
//                   whatever you assumed when you wrote them; only real git can
//                   say whether `check-ignore` and `ls-files` mean what the
//                   classifier thinks they mean.
//
// The check is ADVISORY by design — it must never change an exit code, and every
// fact must degrade to unknown rather than throw. Both are asserted below,
// because a posture check that can fail a close is a posture check that gets
// switched off.
//
// Run: `npm test`.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { environment } from '../skills/megascope/assets/megascope.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('\n▶ env (the posture check)');

// ── classification, on a stubbed shell ──────────────────────────────────────

/**
 * A shell that answers from a script instead of a machine. `null` for a command
 * means "could not ask" — a missing binary or a timeout — which is the case the
 * real world produces most often and the one a stub is most likely to skip.
 */
const stub = ({ repo = '/repo', ignored = false, tracked = [], remotes = ['origin'], visibility = 'private' }) =>
  (cmd, args) => {
    if (cmd === 'gh') {
      if (visibility === null) return { code: null, out: '' };
      return { code: 0, out: visibility === 'private' ? 'true' : 'false' };
    }
    const sub = args[0];
    if (sub === 'rev-parse') return repo === null ? { code: 128, out: '' } : { code: 0, out: repo };
    if (sub === 'check-ignore') return { code: ignored ? 0 : 1, out: '' };
    if (sub === 'ls-files') return { code: 0, out: tracked.join('\n') };
    if (sub === 'remote') return remotes === null ? { code: null, out: '' } : { code: 0, out: remotes.join('\n') };
    return { code: null, out: '' };
  };

const at = (opts) => environment('/repo/docs/scoping/thing', { run: stub(opts) });
const level = (e, id) => e.rows.find((r) => r.id === id)?.level;

{
  const e = at({ ignored: true, visibility: 'public' });
  check(e.posture === 'ignored' && level(e, 'E3') === 'ok',
    'ignored artifacts in a public repo: the default posture, no warning');
  check(e.warnings.length === 0,
    'a public repository is a fact, not a warning — E2 never warns on its own');
}

{
  const e = at({ ignored: false, visibility: 'public' });
  check(e.posture === 'loose' && level(e, 'E3') === 'warn',
    'untracked but not ignored: warns — this is one `git add -A` from published');
  check(/git add -A/.test(e.rows.find((r) => r.id === 'E3').detail),
    'the loose warning names the command that would do it');
}

{
  const e = at({ tracked: ['docs/scoping/thing/KICKOFF.md'], visibility: 'public' });
  check(e.posture === 'tracked' && level(e, 'E3') === 'warn',
    'tracked in a public repo: warns — the motivating incident');
}

{
  const e = at({ tracked: ['docs/scoping/thing/KICKOFF.md'], visibility: 'private' });
  check(e.posture === 'tracked' && level(e, 'E3') === 'info' && e.warnings.length === 0,
    'tracked in a private repo: a legitimate override, reported not warned');
}

{
  const e = at({ tracked: ['docs/scoping/thing/KICKOFF.md'], remotes: [], visibility: null });
  check(level(e, 'E3') === 'info', 'tracked with no remote: nothing is published, so nothing to warn about');
}

{
  const e = at({ tracked: ['docs/scoping/thing/KICKOFF.md'], visibility: null });
  check(level(e, 'E3') === 'warn' && /unknown/.test(e.rows.find((r) => r.id === 'E2').detail),
    'unknown visibility is treated as public, not as an error');
}

{
  const e = at({ repo: null });
  check(e.posture === 'no-repo' && e.warnings.length === 0 && e.rows.length === 1,
    'outside a repository: one row, nothing to leak and nothing to warn about');
}

{
  // Every git call fails the way a missing binary fails.
  const e = environment('/anywhere', { run: () => ({ code: null, out: '' }) });
  check(e.posture === 'no-repo', 'no git at all degrades to "not a repository" rather than throwing');
}

// ── real git ────────────────────────────────────────────────────────────────

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** A repo with a scope directory in it, in one of the three postures. */
function repoWith(posture) {
  const dir = mkdtempSync(join(tmpdir(), 'megascope-env-'));
  git(dir, 'init', '-q');
  const scope = join(dir, 'docs/scoping/thing');
  mkdirSync(scope, { recursive: true });
  writeFileSync(join(scope, 'KICKOFF.md'), '# Kick-off — thing\n\n**Tracking:** untracked — local-only.\n');
  if (posture === 'ignored') appendFileSync(join(dir, '.git/info/exclude'), '\ndocs/scoping/thing/\n');
  if (posture === 'tracked') git(dir, 'add', 'docs/scoping/thing/KICKOFF.md');
  return { dir, scope };
}

for (const [posture, expected] of [['loose', 'loose'], ['ignored', 'ignored'], ['tracked', 'tracked']]) {
  const { dir, scope } = repoWith(posture);
  try {
    const e = environment(scope);
    check(e.posture === expected, `real git, ${posture}: reads back as "${expected}" (got "${e.posture}")`);
    if (posture === 'loose') {
      check(e.rel === 'docs/scoping/thing',
        `the repo-relative path survives a symlinked temp dir (got "${e.rel}")`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

{
  // Intake runs before the directory exists — the whole point of checking then.
  const { dir } = repoWith('loose');
  try {
    const e = environment(join(dir, 'docs/scoping/not-created-yet'));
    check(e.posture === 'loose' && e.rel === 'docs/scoping/not-created-yet',
      'a directory that does not exist yet still classifies — intake checks before it writes');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

{
  // A posture that was chosen and written down is not the thing to warn about.
  const { dir, scope } = repoWith('tracked');
  try {
    writeFileSync(join(scope, 'KICKOFF.md'),
      '# Kick-off — thing\n\n**Tracking:** committed deliberately — sanitised 2026-07-31.\n');
    git(dir, 'add', 'docs/scoping/thing/KICKOFF.md');
    const e = environment(scope, {
      run: (cmd, args, o) => (cmd === 'gh' ? { code: 0, out: 'false' } : shellReal(cmd, args, o)),
    });
    check(e.declared === 'docs/scoping/thing/KICKOFF.md' && e.warnings.length === 0,
      'a status header declaring the commit turns the warning into an override');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function shellReal(cmd, args, { cwd } = {}) {
  try { return { code: 0, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }; }
  catch (e) { return { code: typeof e?.status === 'number' ? e.status : null, out: String(e?.stdout || '').trim() }; }
}

// ── advisory means advisory ─────────────────────────────────────────────────

{
  // The worst posture there is, run through the CLI: still exit 0.
  const { dir, scope } = repoWith('tracked');
  try {
    const cli = resolve(ROOT, 'skills/megascope/assets/megascope.mjs');
    let code = 0;
    try { execFileSync(process.execPath, [cli, 'env', scope], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { code = e.status ?? 1; }
    check(code === 0, '`env` exits 0 even on the worst posture — it reports, it does not gate');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

console.log(failures ? `\n✗ ${failures} env check(s) failed` : '');
process.exit(failures ? 1 : 0);
