// Copyright 2026 Qore Technologies, s.r.o.
// An expression's type is the server's (qoretechnologies/qorus#713).
//
// The builder used to work out a type from the catalogue's `ui_return_type`,
// one level deep, which disagreed with the server: `1 + 2.5` was "any" here and
// a float there. It now asks the server over `dpql/expressionType`, and until
// the server answers, or when it cannot, the type is not known.
import { act, renderHook } from '@testing-library/react';
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
  _resetExpressionTypeTransportForTests,
  fetchExpressionType,
  getCachedExpressionType,
  useExpressionType,
} from '../src/components/form/expressions/useExpressionType';

const SUM = { exp: '+', args: [{ type: 'int', value: 1 }, { type: 'float', value: 2.5 }] } as never;
const TEXT = { exp: 'lwr', args: [{ type: 'string', value: 'A' }] } as never;
const FLOAT = { inferred_type: 'float', ui_type: 'number', known: true };
const STRING = { inferred_type: 'string', ui_type: 'richtext', known: true };

beforeEach(() => {
  vi.useFakeTimers();
  _resetExpressionTypeTransportForTests();
  client.connect.mockReset();
  client.customRequest.mockReset();
  client.connect.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useExpressionType', () => {
  it('gives the type the server gives, once it has answered', async () => {
    client.customRequest.mockResolvedValue(FLOAT);
    const { result } = renderHook(() => useExpressionType(SUM));

    expect(result.current).toBeUndefined();
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(result.current).toEqual(FLOAT);
    expect(client.customRequest).toHaveBeenCalledWith('dpql/expressionType', { expression: SUM });
    expect(getCachedExpressionType(SUM)).toEqual(FLOAT);
  });

  it('asks once for the same expression', async () => {
    client.customRequest.mockResolvedValue(FLOAT);
    await fetchExpressionType(SUM);
    const { result } = renderHook(() => useExpressionType(SUM));

    expect(result.current).toEqual(FLOAT);
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(client.customRequest).toHaveBeenCalledTimes(1);
  });

  it('asks once for a burst of changes, for the last expression', async () => {
    client.customRequest.mockResolvedValue(STRING);
    const { result, rerender } = renderHook(({ value }) => useExpressionType(value), {
      initialProps: { value: SUM },
    });
    await act(() => vi.advanceTimersByTimeAsync(100));
    rerender({ value: TEXT });
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(client.customRequest).toHaveBeenCalledTimes(1);
    expect(client.customRequest).toHaveBeenCalledWith('dpql/expressionType', { expression: TEXT });
    expect(result.current).toEqual(STRING);
  });

  it('does not keep the type of the expression it had before', async () => {
    client.customRequest.mockResolvedValueOnce(FLOAT);
    const { result, rerender } = renderHook(({ value }) => useExpressionType(value), {
      initialProps: { value: SUM },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current).toEqual(FLOAT);

    client.customRequest.mockReturnValueOnce(new Promise(() => undefined));
    rerender({ value: TEXT });
    expect(result.current).toBeUndefined();
  });

  it('has no type when the server cannot give one', async () => {
    client.connect.mockRejectedValue(new Error('LSP connection gave up'));
    const { result } = renderHook(() => useExpressionType(SUM));
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(result.current).toBeUndefined();
    expect(client.customRequest).not.toHaveBeenCalled();
  });

  it('stops asking a server that does not know the method', async () => {
    client.customRequest.mockRejectedValue(new Error('-32601: Method not found'));

    await expect(fetchExpressionType(SUM)).resolves.toBeNull();
    await expect(fetchExpressionType(TEXT)).resolves.toBeNull();
    expect(client.customRequest).toHaveBeenCalledTimes(1);
  });

  it('ignores an answer without a type', async () => {
    client.customRequest.mockResolvedValue({});

    await expect(fetchExpressionType(SUM)).resolves.toBeNull();
    expect(getCachedExpressionType(SUM)).toBeUndefined();
  });

  it('has nothing to ask for an empty expression', async () => {
    const { result } = renderHook(() => useExpressionType(undefined));
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(result.current).toBeUndefined();
    await expect(fetchExpressionType({} as never)).resolves.toBeNull();
    expect(client.connect).not.toHaveBeenCalled();
  });
});
