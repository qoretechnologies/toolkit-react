/**
 * The version CI publishes is worked out once (.github/scripts/release-version.sh), and the tests run names
 * only a version npm has (.github/scripts/published-version.sh).
 *
 * The tests workflow told people to install a version nothing published: it ran
 * `npm version prerelease --preid=canary.<time>` in the runner and posted
 * "install the canary version via `yarn add @qoretechnologies/reqraft@v0.10.63-canary.20261009190442.0`", a 404
 * on npm (and the `v` would not resolve anyway). The prerelease a PR really gets is publish.yml's
 * `<base>-pr.<PR>.g<sha7>`, under the `pr` tag, and none when package.json's version is already on npm.
 *
 * The scripts run here against a stand-in `npm` that knows a given set of published versions.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPTS = resolve(__dirname, '../.github/scripts');
const WORKFLOWS = resolve(__dirname, '../.github/workflows');
const NAME = '@qoretechnologies/reqraft';
const RUNS =
  'https://github.com/qoretechnologies/toolkit-react/actions/workflows/publish.yml?query=branch%3Afeature';

let dirs: string[] = [];
afterEach(() => {
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  dirs = [];
});

/** Runs a script in a checkout at `version`, with an npm that has published exactly `published`. */
const run = (
  script: string,
  args: string[],
  { version, published }: { version: string; published: string[] }
) => {
  const dir = mkdtempSync(join(tmpdir(), 'reqraft-release-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: NAME, version }));
  // `npm view <name>@<version> version`: the version when it is published, else E404 (exit 1), as npm does
  const npm = join(dir, 'bin', 'npm');
  execFileSync('mkdir', ['-p', join(dir, 'bin')]);
  writeFileSync(
    npm,
    [
      '#!/bin/sh',
      '[ "$1" = view ] || exit 3',
      'v=${2##*@}',
      'for p in $PUBLISHED; do [ "$p" = "$v" ] && { echo "$v"; exit 0; }; done',
      'echo "npm ERR! 404 No match found for version $v" >&2',
      'exit 1',
    ].join('\n')
  );
  chmodSync(npm, 0o755);
  const out = execFileSync(join(SCRIPTS, script), args, {
    cwd: dir,
    env: {
      ...process.env,
      PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      PUBLISHED: published.join(' '),
    },
    encoding: 'utf8',
  });
  return Object.fromEntries(
    out
      .trim()
      .split('\n')
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])
  );
};

describe('release-version.sh', () => {
  it('gives a PR a prerelease of the version it releases, under its number and sha', () => {
    expect(
      run('release-version.sh', ['pull_request', '137', '8f9aa65b1c2d3e4f'], {
        version: '0.10.62',
        published: ['0.10.61'],
      })
    ).toEqual({ name: NAME, base: '0.10.62', publish: 'true', version: '0.10.62-pr.137.g8f9aa65' });
  });

  it('prefixes the sha with g, so an all-digit sha is never a numeric identifier', () => {
    expect(
      run('release-version.sh', ['pull_request', '5', '0123456789'], {
        version: '1.2.3',
        published: [],
      }).version
    ).toBe('1.2.3-pr.5.g0123456');
  });

  it('cuts no prerelease when the PR has not bumped past a published version', () => {
    expect(
      run('release-version.sh', ['pull_request', '140', 'abcdef0123'], {
        version: '0.10.61',
        published: ['0.10.61'],
      })
    ).toEqual({ name: NAME, base: '0.10.61', publish: 'false' });
  });

  it('gives develop the version in package.json', () => {
    expect(
      run('release-version.sh', ['push'], { version: '0.10.62', published: [] })
    ).toMatchObject({
      publish: 'true',
      version: '0.10.62',
    });
  });
});

describe('published-version.sh', () => {
  it('names the prerelease npm has, with no v, and how to install it', () => {
    const out = run('published-version.sh', ['pull_request', '137', '8f9aa65b1c2d', RUNS], {
      version: '0.10.62',
      published: ['0.10.61', '0.10.62-pr.137.g8f9aa65'],
    });
    expect(out).toEqual({
      version: '0.10.62-pr.137.g8f9aa65',
      field: '0.10.62-pr.137.g8f9aa65',
      note: `, install the prerelease via \`yarn add ${NAME}@0.10.62-pr.137.g8f9aa65\`.`,
    });
  });

  it('names no version while npm does not have it, and points to the publish run', () => {
    const out = run('published-version.sh', ['pull_request', '137', '1234567abc', RUNS], {
      version: '0.10.62',
      // an earlier commit's prerelease is published, this commit's is not (yet, or it failed)
      published: ['0.10.61', '0.10.62-pr.137.g8f9aa65'],
    });
    expect(out.version).toBeUndefined();
    expect(out.field).toBe('none on npm yet');
    expect(out.note).toBe(
      `. No prerelease is on npm for this commit yet: see the [Publish run](${RUNS}).`
    );
    expect(JSON.stringify(out)).not.toMatch(/0\.10\.62-pr|yarn add/);
  });

  it('says no prerelease was cut when the version is already on npm', () => {
    const out = run('published-version.sh', ['pull_request', '140', 'abcdef0123', RUNS], {
      version: '0.10.61',
      published: ['0.10.61'],
    });
    expect(out.version).toBeUndefined();
    expect(out.field).toBe('none (0.10.61 is already on npm)');
    expect(out.note).toBe(
      '. No prerelease was cut: package.json is at 0.10.61, which is already on npm.'
    );
  });

  it("names develop's release once npm has it, and none before", () => {
    expect(
      run('published-version.sh', ['push', RUNS], { version: '0.10.62', published: ['0.10.62'] })
    ).toMatchObject({
      version: '0.10.62',
      field: '0.10.62',
    });
    expect(
      run('published-version.sh', ['push', RUNS], { version: '0.10.62', published: ['0.10.61'] })
    ).toEqual({
      field: 'none on npm yet',
      note: `. No prerelease is on npm for this commit yet: see the [Publish run](${RUNS}).`,
    });
  });
});

describe('the workflows', () => {
  const tests = readFileSync(join(WORKFLOWS, 'tests.yml'), 'utf8');
  const publish = readFileSync(join(WORKFLOWS, 'publish.yml'), 'utf8');

  it('work the prerelease out with the one script', () => {
    expect(publish).toContain('.github/scripts/release-version.sh pull_request');
    expect(tests).toContain('.github/scripts/published-version.sh pull_request');
  });

  it('make up no version and use no deprecated set-output', () => {
    expect(tests).not.toMatch(/npm version/);
    // a workflow command, not a mention of one in a comment
    expect(`${tests}\n${publish}`).not.toMatch(/^[^#\n]*::set-output/m);
    // the Discord messages name what published-version.sh found
    expect(tests).not.toMatch(/steps\.(bump|save_release_version)\./);
    expect(tests.match(/steps\.published\.outputs\.field/g)).toHaveLength(2);
    expect(tests).toContain('steps.published.outputs.note');
  });
});
