// Copyright 2026 Qore Technologies, s.r.o.
// A value the server refuses to write as DPQL is said to be refused, not answered with no text (qorus#646).
//
// `dpql/serialize` raises DPQL-SERIALIZE-ERROR for an expression it cannot write - a two-argument operator
// stored with more arguments. The session answered '' for that, as it does while it has no client, and the
// Text view opened empty for the author to type over: what was typed then replaced the value.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const client = {
  customRequest: async (method: string) => {
    if (method === 'dpql/serialize') {
      throw Object.assign(
        new Error('DPQL-SERIALIZE-ERROR: "-" takes two arguments; this one has 3'),
        {
          code: -32603,
        }
      );
    }
    return {};
  },
};

vi.mock('../src/components/smartEditor/useLspSession', () => ({
  useLspSession: () => ({ client, isReady: true, uri: 'inmemory://dpql/1', diagnostics: [] }),
}));

import { useDpqlSession } from '../src/components/dpqlEditor/useDpqlSession';

describe('a DPQL session asked to write a value it cannot', () => {
  it('says the server refused, with its reason', async () => {
    const { result } = renderHook(() => useDpqlSession({}));
    await expect(result.current.serialize({ exp: '-', args: [1, 2, 3] })).rejects.toThrow(
      /DPQL-SERIALIZE-ERROR/
    );
  });
});
