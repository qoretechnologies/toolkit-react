// Copyright 2026 Qore Technologies, s.r.o.
import { expect, test } from 'vitest';
import { findInternalNames, publicFiles } from '../scripts/publicTextGate.mjs';

/**
 * Reqraft is open source: its sources, stories, tests and docs name nothing truly internal (people and personas,
 * private issues and PRs, review, board, queue and decision ids, chats and internal hosts). Qorus and its products
 * may be named where they explain a component. See `scripts/publicTextGate.mjs`.
 */
test('the public text names nothing internal', () => {
  const found = findInternalNames(publicFiles()).map(
    ({ file, line, kind, text }) => `${file}:${line}: ${text} (${kind})`
  );

  expect(found).toEqual([]);
});
