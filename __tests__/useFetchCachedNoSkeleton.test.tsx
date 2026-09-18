/**
 * An answer already in the cache is not a loading state.
 *
 * `useFetch` started `loading` at `loadOnMount` unconditionally, so every
 * consumer that mounted reported "loading" for at least one async turn even
 * when the response was sitting in the query cache. `FormEngine` renders its
 * `options-loading-skeleton` whenever any of its sources says that, so every
 * form appearing on an IDE page flashed a skeleton whether or not anything was
 * actually being fetched.
 *
 * Measured in the live IDE on a fully warm SECOND visit to one alert-rule page:
 * three skeleton waves against two requests, the last wave with no request
 * anywhere near it — the reader watches the page go ready, un-ready, ready,
 * un-ready. After the fix, zero waves on the same page.
 *
 * These render WITHOUT a `QueryClientProvider`, seeding the module-level client
 * that `query` itself defaults to. That is deliberate twice over: it is the
 * path most consumers take (a form mounted with only a `FetchContext`), and
 * mounting a provider registers window listeners that outlived the jsdom
 * teardown and failed CI with `ReferenceError: window is not defined` while
 * passing locally.
 */
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { useFetch } from '../src/hooks/useFetch/useFetch';
import { ReqraftQueryClient } from '../src/providers/ReqraftProvider';
import { reqraftCacheKey } from '../src/utils/fetch';

const CATALOGUE = [{ name: 'string' }, { name: 'int' }];

/** Records what `loading` was on every render, so a one-tick flash is visible. */
const Probe = ({
  url,
  seen,
}: {
  url: string;
  seen: { loading: boolean[]; data: unknown[] };
}) => {
  const { loading, data } = useFetch<typeof CATALOGUE>({ url, loadOnMount: true });
  seen.loading.push(loading);
  seen.data.push(data);
  return <div data-loading={String(loading)} />;
};

const renderProbe = (url: string, get: ReturnType<typeof vi.fn>) => {
  const seen = { loading: [] as boolean[], data: [] as unknown[] };
  const fetchContext = { get, post: vi.fn(), put: vi.fn(), del: vi.fn() };

  render(
    <FetchContext.Provider value={fetchContext as never}>
      <Probe url={url} seen={seen} />
    </FetchContext.Provider>
  );

  return seen;
};

/** Exactly what `query` stores for a resolved GET. */
const seedCache = (url: string, data: unknown) =>
  ReqraftQueryClient.setQueryData([reqraftCacheKey({ url })], { data, ok: true, status: 200 });

describe('useFetch with a warm cache', () => {
  beforeEach(() => {
    // `__tests__/setup.ts` clears the shared client between tests; this is the
    // per-test seed on top of that.
    ReqraftQueryClient.clear();
  });

  it('never reports loading for a resource already in the cache', async () => {
    seedCache('/system/qorus-type-info', CATALOGUE);

    const get = vi.fn(async () => ({ ok: true, data: CATALOGUE }));
    const seen = renderProbe('/system/qorus-type-info', get);

    // The flash is a single render with loading true — assert across ALL of
    // them, not just the last, or the flash passes unnoticed.
    await waitFor(() => expect(seen.loading.length).toBeGreaterThan(0));
    expect(seen.loading.some((l) => l === true)).toBe(false);
  });

  it('hands back the cached data on the very first render', async () => {
    seedCache('/system/qorus-type-info', CATALOGUE);

    const get = vi.fn(async () => ({ ok: true, data: CATALOGUE }));
    const seen = renderProbe('/system/qorus-type-info', get);

    expect(seen.data[0]).toEqual(CATALOGUE);
  });

  it('still reports loading when there is nothing cached', async () => {
    // The skeleton is right when a request really is in flight; this is the
    // control that stops the fix from simply never reporting loading.
    const get = vi.fn(
      async () =>
        new Promise((resolve) => setTimeout(() => resolve({ ok: true, data: CATALOGUE }), 5))
    );
    const seen = renderProbe('/system/uncached-thing', get as never);

    expect(seen.loading.some((l) => l === true)).toBe(true);
  });

  it('still revalidates a cached resource', async () => {
    // Silent, but not skipped: the entry is refreshed behind the rendered data.
    seedCache('/system/qorus-type-info', CATALOGUE);

    const get = vi.fn(async () => ({ ok: true, data: CATALOGUE }));
    renderProbe('/system/qorus-type-info', get);

    await waitFor(() => expect(get).toHaveBeenCalled());
  });

  it('does not treat a cached FAILURE as an answer', async () => {
    // A remembered error must not be rendered as though it were data.
    ReqraftQueryClient.setQueryData([reqraftCacheKey({ url: '/system/broken' })], {
      data: undefined,
      ok: false,
      status: 500,
    });

    const get = vi.fn(
      async () =>
        new Promise((resolve) => setTimeout(() => resolve({ ok: true, data: CATALOGUE }), 5))
    );
    const seen = renderProbe('/system/broken', get as never);

    expect(seen.loading.some((l) => l === true)).toBe(true);
  });
});
