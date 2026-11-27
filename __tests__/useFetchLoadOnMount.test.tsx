// Copyright 2026 Qore Technologies, s.r.o.
// What `useFetch({ loadOnMount: true })` asks for, and what becomes of a load that throws.
//
// Found in the Qorus IDE's unit tests: `useQorusTypes` mounts
// `useFetch({ url: '/system/qorus-type-info', loadOnMount: true })`. The hook already
// rendered the answer from the query cache, but its load-on-mount effect still asked the
// `FetchContext` for it. With no reqraft provider above it, the default context throws
// "FetchContext not implemented", and the effect let that rejection go unhandled: vitest
// fails a whole run for one, though every test in it passed. 73 of them in one IDE unit
// run. Two things are wrong, and each is fixed on its own:
//
// 1. A fresh cached answer is not requested on mount. `query` would hand back the same
//    entry without a request; going through the context to learn that is a request to a
//    context that may not exist. A STALE entry is still revalidated, silently.
// 2. A load-on-mount that throws ends in `error`, as a failed answer does. Nobody awaits
//    the effect's promise, so a rejection out of it is never anyone's to handle.
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { useFetch } from '../src/hooks/useFetch/useFetch';
import { useQorusTypes } from '../src/hooks/useQorusTypes';
import { ReqraftQueryClient } from '../src/providers/ReqraftProvider';
import { reqraftCacheKey, seedQueryCache } from '../src/utils/fetch';
import { okResponse } from './support/fetchContext';

const URL = '/system/qorus-type-info';
const CATALOGUE = [{ name: 'string' }, { name: 'int' }];
const SIX_MINUTES = 6 * 60 * 1000;

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

/**
 * One macrotask: the effect's request and every promise reaction after it are
 * microtasks, so they have all run - and a rejection nobody handled has been reported -
 * once a macrotask turn has passed.
 */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** An answer `query` stored this long ago. */
const cacheAnswer = (data: unknown, age = 0) =>
  ReqraftQueryClient.setQueryData(
    [reqraftCacheKey({ url: URL })],
    { data, ok: true, status: 200 },
    { updatedAt: Date.now() - age }
  );

/** Records what `loading` was on every render, so a one-render flash is visible. */
const Probe = ({ seen }: { seen: { loading: boolean[] } }) => {
  const { loading } = useFetch<typeof CATALOGUE>({ url: URL, loadOnMount: true });
  seen.loading.push(loading);
  return null;
};

beforeEach(() => {
  unhandled.length = 0;
  process.on('unhandledRejection', onUnhandled);
  ReqraftQueryClient.clear();
});

afterEach(async () => {
  await settle();
  process.off('unhandledRejection', onUnhandled);
  vi.restoreAllMocks();
});

describe('useFetch loadOnMount and the query cache', () => {
  it('does not ask the FetchContext for an answer the cache holds fresh', async () => {
    cacheAnswer(CATALOGUE);
    const get = vi.fn(async () => okResponse(CATALOGUE as never));

    const { result } = renderHook(() => useFetch({ url: URL, loadOnMount: true }), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={{ get, post: vi.fn(), put: vi.fn(), del: vi.fn() }}>
          {children}
        </FetchContext.Provider>
      ),
    });
    await settle();

    expect(get).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(CATALOGUE);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('counts an answer the host seeded as fresh', async () => {
    // `seedQueryCache` is how the IDE hands over the type catalogue it fetched before
    // the bundle parsed; that seed is exactly what made this request redundant.
    seedQueryCache({ url: URL, data: CATALOGUE });
    const get = vi.fn(async () => okResponse(CATALOGUE as never));

    render(
      <FetchContext.Provider value={{ get, post: vi.fn(), put: vi.fn(), del: vi.fn() }}>
        <Probe seen={{ loading: [] }} />
      </FetchContext.Provider>
    );
    await settle();

    expect(get).not.toHaveBeenCalled();
  });

  it('still revalidates a stale cached answer, without reporting loading', async () => {
    // The control: the fix is "fresh is not requested", not "cached is never requested".
    cacheAnswer(CATALOGUE, SIX_MINUTES);
    const get = vi.fn(async () => okResponse(CATALOGUE as never));
    const seen = { loading: [] as boolean[] };

    render(
      <FetchContext.Provider value={{ get, post: vi.fn(), put: vi.fn(), del: vi.fn() }}>
        <Probe seen={seen} />
      </FetchContext.Provider>
    );
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await settle();

    expect(seen.loading.some((loading) => loading)).toBe(false);
  });

  it('asks for a resource the cache does not hold', async () => {
    const get = vi.fn(async () => okResponse(CATALOGUE as never));

    const { result } = renderHook(() => useFetch({ url: URL, loadOnMount: true }), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={{ get, post: vi.fn(), put: vi.fn(), del: vi.fn() }}>
          {children}
        </FetchContext.Provider>
      ),
    });
    await waitFor(() => expect(result.current.data).toEqual(CATALOGUE));

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('asks again when the caller turned the cache off', async () => {
    cacheAnswer(CATALOGUE);
    const get = vi.fn(async () => okResponse(CATALOGUE as never));

    renderHook(() => useFetch({ url: URL, loadOnMount: true, cache: false }), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={{ get, post: vi.fn(), put: vi.fn(), del: vi.fn() }}>
          {children}
        </FetchContext.Provider>
      ),
    });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
  });
});

describe('a load-on-mount that throws', () => {
  it('ends in `error` with no FetchContext, not in an unhandled rejection', async () => {
    // No provider at all: the default context throws "FetchContext not implemented".
    const { result } = renderHook(() => useFetch({ url: URL, loadOnMount: true }));
    await settle();

    expect(unhandled).toEqual([]);
    expect(result.current.error?.message).toBe('FetchContext not implemented');
    expect(result.current.loading).toBe(false);
  });

  it('ends in `error` when the host context rejects', async () => {
    const get = vi.fn(async () => {
      throw new Error('socket closed');
    });

    const { result } = renderHook(() => useFetch({ url: URL, loadOnMount: true }), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={{ get, post: vi.fn(), put: vi.fn(), del: vi.fn() }}>
          {children}
        </FetchContext.Provider>
      ),
    });
    await settle();

    expect(unhandled).toEqual([]);
    expect(result.current.error?.message).toBe('socket closed');
    expect(result.current.loading).toBe(false);
  });

  it('still rejects to a caller that loads by hand, who can handle it', async () => {
    const { result } = renderHook(() => useFetch({ url: URL }));

    await act(async () => {
      await expect(result.current.load()).rejects.toThrow('FetchContext not implemented');
    });
    expect(unhandled).toEqual([]);
  });
});

describe('useQorusTypes with no reqraft provider (the IDE unit tests)', () => {
  it('neither asks the missing context nor leaves a rejection when the catalogue is seeded', async () => {
    seedQueryCache({ url: URL, data: CATALOGUE });

    renderHook(() => useQorusTypes());
    await settle();

    expect(unhandled).toEqual([]);
  });

  it('leaves no rejection when nothing is cached either', async () => {
    renderHook(() => useQorusTypes());
    await settle();

    expect(unhandled).toEqual([]);
  });
});
