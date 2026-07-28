#!/usr/bin/env node
// docs.mjs — every command the docs tell you to run must exist.
//
// `references/engine-data.md` told readers to run `node tests/build-doc.mjs`.
// That file existed at neither that path nor any other, and had not for as long
// as anyone could tell — because nothing checked. A stale command in a skill is
// worse than a stale command in a README: Claude reads it at run time and does
// what it says.
//
// So: pull every `node …` and `npm …` out of the markdown and resolve it.
// Paths inside skills/megascope/ resolve against the SKILL directory, because
// that is the working directory a run actually has — the repo root is not
// reachable from the deployed symlink.
//
// Run: `npm test`.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SKILL = resolve(ROOT, 'skills/megascope');

let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('\n▶ docs (every documented command resolves)');

// Every markdown file in the repo is something a reader — or a run — is expected to
// actually type from. Add a name here only if that stops being true.
const NOT_INSTRUCTIONS = new Set();

// Walked by hand rather than with fs/promises' glob: the shipped tool imports nothing
// newer than node:fs, so megascope runs on old Node, and the suite should be able to
// prove that on the same versions rather than needing 22+ itself.
const SKIP = new Set(['node_modules', 'scratch', '.git']);
async function* markdownIn(dir, base = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* markdownIn(resolve(dir, entry.name), rel);
    else if (entry.name.endsWith('.md')) yield rel;
  }
}

const files = [];
for await (const f of markdownIn(ROOT)) {
  if (!NOT_INSTRUCTIONS.has(f)) files.push(f);
}
files.sort();

/** Commands live in code formatting. Prose that happens to say "npm scripts" does not. */
function* commandsIn(text) {
  const regions = [];
  for (const m of text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)) regions.push([m[1], m.index]);
  for (const m of text.matchAll(/`([^`\n]+)`/g)) regions.push([m[1], m.index]);
  for (const [body, at] of regions) {
    const lineBase = text.slice(0, at).split('\n').length;
    for (const m of body.matchAll(/(?:^|\s)(node|npm)\s+([^\n)|]+)/g)) {
      yield { bin: m[1], rest: m[2], line: lineBase + body.slice(0, m.index).split('\n').length - 1 };
    }
  }
}

const pkg = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'));
const scripts = new Set(Object.keys(pkg.scripts || {}));
const NPM_BUILTIN = new Set(['install', 'test', 'ci', 'i']);

// A placeholder is not a path. These are the shapes the docs legitimately use
// to stand in for something the caller supplies.
const isPlaceholder = (p) => /[<>*]/.test(p) || /^(path\/|docs\/scoping\/|\.\.\.|your-)/.test(p) || p === '.';

const problems = [];
let nodeCmds = 0, npmCmds = 0;

for (const file of files) {
  const text = await readFile(resolve(ROOT, file), 'utf8');
  // commands inside skills/ are run from the skill directory; everything else
  // from the repo root
  const base = file.startsWith('skills/megascope/') ? SKILL : ROOT;

  for (const { bin, rest, line } of commandsIn(text)) {
    const args = rest.trim().replace(/[.,;:]+$/, '').split(/\s+/).filter((a) => a && !a.startsWith('-'));
    if (!args.length) continue;
    const where = `${file}:${line}`;

    if (bin === 'npm') {
      npmCmds++;
      const sub = args[0];
      if (sub === 'run') {
        if (!args[1]) continue;
        if (!scripts.has(args[1])) problems.push(`${where} — \`npm run ${args[1]}\` is not a script in package.json`);
      } else if (!NPM_BUILTIN.has(sub) && !scripts.has(sub)) {
        problems.push(`${where} — \`npm ${sub}\` is neither a script nor an npm builtin`);
      }
      continue;
    }

    nodeCmds++;
    const target = args[0];
    if (isPlaceholder(target)) continue;
    // Three legitimate vantage points: the skill directory (what a run has),
    // the repo root (what most docs quote), and the doc's own directory (a doc
    // inside a folder may reasonably say "run this from here").
    const bases = [base, ROOT, resolve(ROOT, dirname(file))];
    if (bases.some((b) => existsSync(resolve(b, target)))) continue;
    problems.push(`${where} — \`node ${target}\` resolves to nothing from ${
      [...new Set(bases.map((b) => relative(ROOT, b) || '.'))].join(', ')}`);
  }
}

check(problems.length === 0,
  `${nodeCmds} node + ${npmCmds} npm commands across ${files.length} markdown files all resolve`);
for (const p of problems) check(false, p);

// The shipped skill must not tell a run to reach outside its own directory:
// mega.sh symlinks skills/megascope alone, so ../scripts and ../tests do not
// exist at run time.
const escapes = [];
for (const file of files.filter((f) => f.startsWith('skills/megascope/'))) {
  const text = await readFile(resolve(ROOT, file), 'utf8');
  for (const { bin, rest, line } of commandsIn(text)) {
    const target = (rest.trim().split(/\s+/)[0] || '');
    if (bin === 'node' && /^(\.\.\/|scripts\/|tests\/)/.test(target)) {
      escapes.push(`${file}:${line} — \`node ${target}\` points outside the deployed skill`);
    }
  }
}
check(escapes.length === 0, 'no shipped command reaches outside the deployed skill directory');
for (const e of escapes) check(false, e);

console.log(failures ? `\n✗ ${failures} docs check(s) failed` : '');
process.exit(failures ? 1 : 0);
