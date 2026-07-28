#!/usr/bin/env node
// manifest.mjs — the plugin ships, and it ships the version it claims.
//
// Publishing megascope is a git push: users install from this repository, so the
// two manifests are the delivery mechanism and a mistake in either is silent.
//
// The dangerous one is the version. Claude Code caches an installed plugin at
// plugins/cache/<marketplace>/<plugin>/<version>/ and resolves the version from
// plugin.json first — so `/plugin update` *skips the plugin entirely* when the
// version matches what is already cached. Push a change without bumping and every
// existing user stays on the old code, with no error on either side. Nothing else
// in the suite would notice, because the skill itself is perfectly fine.
//
// The rest is the shape the loader needs: a marketplace entry whose source points
// at a real plugin, under the name it is installed by.
//
// Run: `npm test`.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let failures = 0;
const check = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('\n▶ manifests (the plugin ships, at the version it claims)');

const json = async (p) => JSON.parse(await readFile(resolve(ROOT, p), 'utf8'));

const market = await json('.claude-plugin/marketplace.json');
const pkg = await json('package.json');

check(Array.isArray(market.plugins) && market.plugins.length === 1,
  'the marketplace lists exactly one plugin');

const entry = market.plugins[0];
const source = resolve(ROOT, entry.source);

check(existsSync(source), `the marketplace source resolves: ${entry.source}`);
check(existsSync(resolve(source, 'SKILL.md')),
  'the source is a plugin root — SKILL.md sits directly in it');
check(!entry.source.includes('..'),
  'the source stays inside the marketplace root (no ../ escape)');

const plugin = await json(resolve(source, '.claude-plugin/plugin.json'));

check(plugin.name === entry.name,
  `the plugin names itself what the marketplace installs it as (${plugin.name})`);

// The whole reason this file exists.
check(plugin.version === pkg.version,
  `plugin.json and package.json agree on the version (${plugin.version} vs ${pkg.version})` +
  (plugin.version === pkg.version ? '' :
    ' — bump both, or users cached at the old version never receive the update'));

check(/^\d+\.\d+\.\d+$/.test(plugin.version),
  `the version is X.Y.Z, so the cache path changes when it moves (${plugin.version})`);

// A plugin is copied to a cache directory on install, so anything it needs must be
// inside it. The docs test already forbids commands that reach outside; this checks
// the assets those commands name are actually part of what gets copied.
for (const asset of ['assets/engine.html', 'assets/megascope.mjs', 'assets/schema.json']) {
  check(existsSync(resolve(source, asset)), `the plugin carries its own ${asset}`);
}

console.log(failures ? `\n✗ ${failures} manifest check(s) failed` : '');
process.exit(failures ? 1 : 0);
