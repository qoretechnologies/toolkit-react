/**
 * The npm package ships what consumers load (qorus#646).
 *
 * The package had no `files` field, so everything outside .npmignore was published: agent notes (.claude,
 * .tasks), design docs, configs and the sources (1242 files, 8 MB). It now ships an allowlist, and
 * .github/scripts/check-packed-files.mjs fails CI when the packed file list (`npm pack --dry-run`) is missing
 * an entry point, a built file or a module a consumer imports (.github/consumer-imports.txt, qorus-ide's deep
 * imports). These run it on packages made here, with real npm.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const SCRIPT = join(ROOT, '.github/scripts/check-packed-files.mjs');
const REAL_PACKAGE = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const CONSUMER_IMPORTS = readFileSync(join(ROOT, '.github/consumer-imports.txt'), 'utf8');

let dirs: string[] = [];
afterEach(() => {
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  dirs = [];
});

/** A package at `dir` with `package.json` and the given files, checked against `imports`. */
const check = (packageJson: Record<string, unknown>, files: string[], imports = '') => {
  const dir = mkdtempSync(join(tmpdir(), 'reqraft-pack-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify(packageJson));
  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), '');
  }
  writeFileSync(join(dir, 'imports.txt'), imports);
  try {
    const out = execFileSync('node', [SCRIPT, 'imports.txt'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { ok: true, out };
  } catch (error) {
    const { stdout, stderr } = error as { stdout: string; stderr: string };
    return { ok: false, out: `${stdout}${stderr}` };
  }
};

const PACKAGE = {
  name: '@qoretechnologies/reqraft',
  version: '1.0.0',
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  files: ['dist', 'README.md', 'LICENSE'],
};
const BUILT = [
  'dist/index.js',
  'dist/index.d.ts',
  'dist/components/menu/Menu.js',
  'dist/components/menu/Menu.d.ts',
  'dist/helpers/common/index.js',
  'dist/helpers/common/index.d.ts',
];
const IMPORTS = [
  '@qoretechnologies/reqraft',
  '@qoretechnologies/reqraft/dist/components/menu/Menu',
  '@qoretechnologies/reqraft/dist/helpers/common',
].join('\n');

describe('check-packed-files.mjs', () => {
  it('passes a package that ships its entry points, its build and every consumer import', () => {
    const { ok, out } = check(
      PACKAGE,
      [...BUILT, 'README.md', 'LICENSE', 'src/index.tsx'],
      IMPORTS
    );
    expect(ok).toBe(true);
    expect(out).toMatch(/6 built files and 3 consumer imports checked/);
  });

  it('fails when the allowlist leaves out what was built, naming each file', () => {
    const { ok, out } = check(
      { ...PACKAGE, files: ['dist/index.js', 'dist/index.d.ts'] },
      BUILT,
      IMPORTS
    );
    expect(ok).toBe(false);
    expect(out).toContain('dist/components/menu/Menu.js: built, not in the package');
    expect(out).toContain(
      '@qoretechnologies/reqraft/dist/components/menu/Menu: imported by a consumer, no module for it in the package'
    );
  });

  it('fails when a module a consumer imports is no longer built', () => {
    const { ok, out } = check(
      PACKAGE,
      BUILT.filter((file) => !file.startsWith('dist/helpers/common/')),
      IMPORTS
    );
    expect(ok).toBe(false);
    expect(out).toContain(
      '@qoretechnologies/reqraft/dist/helpers/common: imported by a consumer, no module'
    );
    expect(out).toContain(
      '@qoretechnologies/reqraft/dist/helpers/common: imported by a consumer, no types'
    );
  });

  it('fails when an entry point is not in the package', () => {
    const { ok, out } = check({ ...PACKAGE, types: 'types/index.d.ts' }, BUILT, IMPORTS);
    expect(ok).toBe(false);
    expect(out).toContain('types/index.d.ts: an entry point in package.json, not in the package');
  });

  it('fails when nothing was built', () => {
    const { ok, out } = check(PACKAGE, [], '');
    expect(ok).toBe(false);
    expect(out).toContain('dist/ is empty');
  });

  it("this package's allowlist ships every module qorus-ide imports", () => {
    // each import as the build writes it: the module and its types
    const modules = CONSUMER_IMPORTS.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith(`${REAL_PACKAGE.name}/`))
      .map((line) => line.slice(REAL_PACKAGE.name.length + 1));
    expect(modules.length).toBeGreaterThan(30);
    const { ok, out } = check(
      {
        name: REAL_PACKAGE.name,
        version: '1.0.0',
        main: REAL_PACKAGE.main,
        types: REAL_PACKAGE.types,
        files: REAL_PACKAGE.files,
      },
      [
        REAL_PACKAGE.main,
        REAL_PACKAGE.types,
        ...modules.flatMap((module) => [`${module}.js`, `${module}.d.ts`]),
        '.claude/CLAUDE.md',
        '.tasks/INDEX.md',
        'design/notes.md',
      ],
      CONSUMER_IMPORTS
    );
    expect(ok, out).toBe(true);
  });

  it("this package's allowlist ships no agent notes, design docs or sources", () => {
    const dir = mkdtempSync(join(tmpdir(), 'reqraft-pack-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ ...REAL_PACKAGE, scripts: {} }));
    for (const file of [
      'dist/index.js',
      'dist/index.d.ts',
      '.claude/CLAUDE.md',
      '.tasks/INDEX.md',
      'design/a.md',
      'src/index.tsx',
      'qlip/x.png',
      'README.md',
      'LICENSE',
    ]) {
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      writeFileSync(join(dir, file), '');
    }
    const [pack] = JSON.parse(
      execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    );
    expect(pack.files.map(({ path }: { path: string }) => path).sort()).toEqual([
      'LICENSE',
      'README.md',
      'dist/index.d.ts',
      'dist/index.js',
      'package.json',
    ]);
  });
});
