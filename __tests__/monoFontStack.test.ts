// Copyright 2026 Qore Technologies, s.r.o.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * qorus#646: code-like text is written in reqore's mono stack (`ReqoreFonts.mono`: ui-monospace, SFMono-Regular,
 * Menlo, …), never in the bare generic `monospace`. The generic keyword is the browser's default fixed-width font -
 * Courier in Chrome on macOS unless the user changed it - so the expression editor wrote "202" larger than the
 * field's Value tab beside it, in a face no other text in the IDE uses.
 *
 * Read: every source under `src`, stories included (what they draw is reviewed as the product). A stack that ends
 * in `monospace` as its fallback is fine; `monospace` alone is not.
 */
const root = join(__dirname, '..');

/** Every TypeScript source under a directory, relative to the root, tests left out. */
const sourcesUnder = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourcesUnder(join(dir, entry.name))
    : /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [join(dir, entry.name)]
    : []
  );

/** A font family that is the bare generic alone: in a style object, or in CSS. */
const BARE_MONOSPACE = [
  /fontFamily:\s*(['"`])monospace\1/,
  /font-family:\s*monospace\s*(;|$|!important)/,
];

describe('code-like text is written in reqore mono stack', () => {
  it('in no source is the font family the bare generic monospace', () => {
    const offences = sourcesUnder('src').flatMap((file) =>
      readFileSync(join(root, file), 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          BARE_MONOSPACE.some((pattern) => pattern.test(line)) ? [`${file}:${index + 1}`] : []
        )
    );
    expect(offences).toEqual([]);
  });

  it('reads a bare generic as one, and a stack that falls back to it as none', () => {
    const bare = (line: string) => BARE_MONOSPACE.some((pattern) => pattern.test(line));

    expect(bare("style={{ fontFamily: 'monospace' }}")).toBe(true);
    expect(bare('  font-family: monospace;')).toBe(true);
    expect(bare('fontFamily: ReqoreFonts.mono,')).toBe(false);
    expect(bare('  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;')).toBe(false);
  });
});
