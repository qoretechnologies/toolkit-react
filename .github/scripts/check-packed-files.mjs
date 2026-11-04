#!/usr/bin/env node
// Checks that the npm package ships what its consumers load: run from the package root after `yarn build`.
//
// usage: node .github/scripts/check-packed-files.mjs [consumer imports file]
//
// The package's contents are package.json's `files` allowlist; before it, everything not in .npmignore was
// published, agent notes and design docs included. An allowlist can just as easily leave something out, and a
// consumer's deep import (qorus-ide imports `@qoretechnologies/reqraft/dist/components/...` directly) would then
// fail only in the consumer. So the packed file list (`npm pack --dry-run`) must hold:
// - every entry point package.json names (main, types, module, exports, bin);
// - every file the build wrote to dist/;
// - for each import in the consumer imports file, the module (`.js`) and its types (`.d.ts`).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

const normalize = (path) => posix.normalize(path.replace(/^\.\//, ''));

const targetsOf = (field) => {
  if (!field) return [];
  if (typeof field === 'string') return [field];
  return Object.values(field).flatMap(targetsOf);
};

const builtFiles = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ?
        builtFiles(path)
      : [normalize(path.split('\\').join('/'))];
  });
};

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [pack] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
);
const packed = new Set(pack.files.map(({ path }) => normalize(path)));
const problems = [];

for (const entry of [
  pkg.main,
  pkg.types,
  pkg.typings,
  pkg.module,
  ...targetsOf(pkg.exports),
  ...targetsOf(pkg.bin),
]) {
  if (entry && !packed.has(normalize(entry))) {
    problems.push(`${entry}: an entry point in package.json, not in the package`);
  }
}

const built = builtFiles('dist');
if (!built.length) {
  problems.push('dist/ is empty: run `yarn build` first');
}
for (const file of built) {
  if (!packed.has(file)) {
    problems.push(`${file}: built, not in the package`);
  }
}

const importsFile = process.argv[2];
const imports =
  importsFile ?
    readFileSync(importsFile, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
  : [];
for (const specifier of imports) {
  if (specifier === pkg.name) {
    continue; // the package root: main and types, checked above
  }
  if (!specifier.startsWith(`${pkg.name}/`)) {
    problems.push(`${specifier}: not an import of ${pkg.name}`);
    continue;
  }
  const path = normalize(specifier.slice(pkg.name.length + 1));
  const has = (...candidates) => candidates.some((candidate) => packed.has(candidate));
  if (!has(path, `${path}.js`, `${path}/index.js`)) {
    problems.push(`${specifier}: imported by a consumer, no module for it in the package`);
  }
  if (
    !has(`${path}.d.ts`, `${path}/index.d.ts`) &&
    !path.endsWith('.js') &&
    !path.endsWith('.json')
  ) {
    problems.push(`${specifier}: imported by a consumer, no types for it in the package`);
  }
}

console.log(
  `${pkg.name}@${pkg.version}: ${pack.entryCount} files, ${pack.size} bytes packed, ${pack.unpackedSize} unpacked; ` +
    `${built.length} built files and ${imports.length} consumer imports checked`
);
if (problems.length) {
  console.error(problems.map((problem) => `- ${problem}`).join('\n'));
  process.exit(1);
}
