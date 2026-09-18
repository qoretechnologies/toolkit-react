// Copyright 2026 Qore Technologies, s.r.o.
// The server holds the text the editor shows, however that text got there.
//
// A session told the server about text only when the author typed it: `didOpen`
// carried the text the editor had at mount, and a value set afterwards — the
// DPQL a Text view is seeded with once `dpql/serialize` answers, a Preview that
// follows the author's typing — never reached it. The server went on colouring
// and diagnosing its own stale copy: a seeded Text view was never highlighted,
// and a Preview was coloured for text it no longer showed.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  connect: vi.fn<() => Promise<void>>(),
  didOpen: vi.fn(),
  didChange: vi.fn(),
  disconnect: vi.fn(),
  onDiagnostics: vi.fn(),
  onReady: vi.fn(),
  semanticTokensLegend: null,
  capabilities: null,
}));

vi.mock('../../src/utils/lspClient', () => ({
  // Constructed with `new`, so a class — every instance is the one fake client.
  ReqraftLspClient: class {
    constructor() {
      return client;
    }
  },
}));

import { useLspSession } from '../../src/components/smartEditor/useLspSession';

/** Lets the fake connection open: `connect()` resolves, then `didOpen` runs. */
let openConnection: () => void = () => undefined;

beforeEach(() => {
  vi.clearAllMocks();
  client.connect.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        openConnection = resolve;
      })
  );
});

const open = async () => {
  await act(async () => {
    openConnection();
  });
};

describe('useLspSession document text', () => {
  it('opens the document with the text the editor holds by then, not at mount', async () => {
    const { result } = renderHook(() => useLspSession({ languageId: 'dpql', initialText: '' }));

    // The Text view is seeded before the connection has opened.
    result.current.didChange('"$local:name" == "John"');
    await open();

    expect(client.didOpen).toHaveBeenCalledWith('"$local:name" == "John"', undefined);
    expect(client.didChange).not.toHaveBeenCalled();
    expect(result.current.isReady).toBe(true);
  });

  it('sends a text set after the document opened', async () => {
    const { result } = renderHook(() => useLspSession({ languageId: 'dpql', initialText: '1 + 2' }));
    await open();

    act(() => result.current.didChange('1 + 2 > 3'));

    expect(client.didOpen).toHaveBeenCalledWith('1 + 2', undefined);
    expect(client.didChange).toHaveBeenCalledTimes(1);
    expect(client.didChange).toHaveBeenCalledWith('1 + 2 > 3', 2);
  });

  it('does not resend the text the server already holds', async () => {
    const { result } = renderHook(() => useLspSession({ languageId: 'dpql', initialText: '1 + 2' }));
    await open();

    // Typing sends the change, and the value echoed back is the same text.
    act(() => result.current.didChange('1 + 2 >'));
    act(() => result.current.didChange('1 + 2 >'));
    act(() => result.current.didChange('1 + 2'));

    expect(client.didChange.mock.calls).toEqual([
      ['1 + 2 >', 2],
      ['1 + 2', 3],
    ]);
  });
});
