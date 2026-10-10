/**
 * The Discord message's "Qlip visual tests" link goes to the build the run uploaded (qorus#646).
 *
 * The build id was read from qlip's upload line up to the first space. qlip now writes
 * `[qlip] uploaded build 20261010-104435: 635 entries …`, so the id kept its colon and every link went to
 * build `20261010-104435:`, which does not exist (qlip's API answers 404 for it).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, '../.github/scripts/qlip-build-link.sh');
const ESC = '\u001b';

let dirs: string[] = [];
afterEach(() => {
  dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  dirs = [];
});

const resolveLink = (log?: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'reqraft-qlip-'));
  dirs.push(dir);
  const file = join(dir, 'qlip-output.log');
  if (log !== undefined) {
    writeFileSync(file, log);
  }
  return execFileSync(SCRIPT, [file], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
};

describe('qlip-build-link.sh', () => {
  it("reads the build id without the colon qlip writes after it, through qlip's colours", () => {
    expect(
      resolveLink(
        [
          ' ✓ |storybook (chromium)| src/components/menu/Menu.stories.tsx > Basic',
          `${ESC}[36m[qlip]${ESC}[39m uploaded build 20261010-104435: 635 entries from 54 contexts ` +
            '(628 auto, 0 manual, 0 failed, 7 skipped), 0/588 screenshots uploaded (all unchanged) → https://qlip.qoretechnologies.com',
        ].join('\n')
      )
    ).toBe(
      [
        'build_id=20261010-104435',
        'url=https://qlip.qoretechnologies.com/builds/20261010-104435',
      ].join('\n')
    );
  });

  it("reads qlip's older line too, and the server it names", () => {
    expect(
      resolveLink(
        '[qlip] uploaded build 20260629-123456 (12 fragments, 3 new) → https://qlip.example.com\n'
      )
    ).toBe(
      ['build_id=20260629-123456', 'url=https://qlip.example.com/builds/20260629-123456'].join('\n')
    );
  });

  it('names no build when none was uploaded, or the stories never ran', () => {
    expect(resolveLink('[qlip] build 20261010-121512: 635 entries … → /local/screenshots\n')).toBe(
      ''
    );
    expect(resolveLink()).toBe('');
  });

  it('is what the tests workflow links', () => {
    const tests = readFileSync(resolve(__dirname, '../.github/workflows/tests.yml'), 'utf8');
    expect(tests).toContain('.github/scripts/qlip-build-link.sh qlip-output.log');
    expect(tests).toContain('[Qlip visual tests](${{ steps.qlip.outputs.url }})');
  });
});
