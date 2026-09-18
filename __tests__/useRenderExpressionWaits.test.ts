// Copyright 2026 Qore Technologies, s.r.o.
// A server rendering waits for the connection, however long it takes to open.
//
// It used to give up after 1.5s and substitute a client-side approximation,
// then keep substituting for 10s — so a page whose first connection took two
// seconds to open showed the approximation on every expression, with Qorus up.
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  connect: vi.fn<() => Promise<void>>(),
  customRequest: vi.fn<() => Promise<unknown>>(),
  disconnect: vi.fn(),
}));

vi.mock('../src/utils/lspClient', () => ({
  // Constructed with `new`, so a class — every instance is the one fake client.
  ReqraftLspClient: class {
    constructor() {
      return client;
    }
  },
}));

import {
  _resetRenderExpressionTransportForTests,
  useRenderExpression,
} from '../src/components/form/expressions/useRenderExpression';

const AST = { exp: '+', args: [{ type: 'int', value: 1 }, { type: 'int', value: 2 }] } as never;

beforeEach(() => {
  vi.useFakeTimers();
  _resetRenderExpressionTransportForTests();
  client.connect.mockReset();
  client.customRequest.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRenderExpression', () => {
  it('waits for a connection that takes longer than the old cut-off', async () => {
    client.connect.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );
    client.customRequest.mockResolvedValue({ rendered: '1 + 2', richtext: null });
    const { result } = renderHook(() => useRenderExpression());

    const rendering = result.current.renderRich(AST);
    await vi.advanceTimersByTimeAsync(5000);

    await expect(rendering).resolves.toEqual({ text: '1 + 2', richtext: null });
    expect(client.customRequest).toHaveBeenCalledWith('dpql/renderExpression', { expression: AST });
  });

  it('resolves null, not an approximation, when the connection gives up', async () => {
    client.connect.mockRejectedValue(new Error('LSP connection gave up'));
    const { result } = renderHook(() => useRenderExpression());

    await expect(result.current.renderRich(AST)).resolves.toBeNull();
    expect(client.customRequest).not.toHaveBeenCalled();
  });

  it('stops asking a server that does not know the method', async () => {
    client.connect.mockResolvedValue(undefined);
    client.customRequest.mockRejectedValue(new Error('-32601: Method not found'));
    const { result } = renderHook(() => useRenderExpression());

    await expect(result.current.renderRich(AST)).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result.current.renderRich(AST)).resolves.toBeNull();
    expect(client.customRequest).toHaveBeenCalledTimes(1);
  });

  it('has nothing to render for an empty expression', async () => {
    const { result } = renderHook(() => useRenderExpression());

    await expect(result.current.renderRich({} as never)).resolves.toBeNull();
    expect(client.connect).not.toHaveBeenCalled();
  });
});
