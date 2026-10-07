// Copyright 2026 Qore Technologies, s.r.o.
// A request that was abandoned is not a request that failed.
//
// `query` rejects with react-query's `CancelledError` when its query is removed
// from the cache while the request is in flight - `ReqraftQueryClient.clear()`,
// which a story runner calls between stories. Nobody hears the answer, and the
// server refused nothing. `ReqraftUserProvider` warned "the current user could
// not be loaded" for it (28 times across 8 story files in one qorus-ide run),
// `AutoFormField` showed its schema as one that "could not be loaded", and
// `useFetch`, `FormEngine` and `CompactRow` let it escape their effects as an
// unhandled rejection. A real failure is still reported exactly as before.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { CancelledError } from '@tanstack/react-query';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { AutoFormField } from '../src/components/form/fields/auto/AutoFormField';
import { FetchContext, IReqraftFetchContext } from '../src/contexts/FetchContext';
import { useFetch } from '../src/hooks/useFetch/useFetch';
import { TemplatesCache, useTemplates } from '../src/hooks/useTemplates';
import { ReqraftQueryClient } from '../src/providers/ReqraftProvider';
import { ReqraftUserProvider } from '../src/providers/StorageProvider';
import { currentUserStore } from '../src/stores/currentUser/currentUser';
import { isQueryCancelled, query } from '../src/utils/fetch';
import { queryUnlessCancelled } from '../src/utils/queryUnlessCancelled';
import { emptyFetchContext } from './support/fetchContext';

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

/** Requests the stubbed `fetch` is holding; each is answered when the test ends. */
let held: ((response: Response) => void)[] = [];

/** A `fetch` that never answers on its own, so a request is in flight until the test says. */
const holdRequests = () => {
  const fetchMock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        held.push(resolve);
      })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/**
 * One macrotask: every promise reaction a cancel (or a failure) triggers is a
 * microtask, so they have all run - and a rejection nobody handled has been
 * reported - once a macrotask turn has passed.
 */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** What a story runner does between stories: forget every query, in flight or not. */
const abandonEverything = async () => {
  await act(async () => {
    ReqraftQueryClient.clear();
  });
  await settle();
};

beforeEach(() => {
  unhandled.length = 0;
  held = [];
  process.on('unhandledRejection', onUnhandled);
  currentUserStore.setState({
    currentUser: undefined,
    error: undefined,
    errorData: undefined,
    loading: false,
  });
});

afterEach(async () => {
  // answer what is still held, so nothing settles after the environment is gone
  held.forEach((resolve) => resolve(new Response('{}', { status: 200 })));
  await settle();
  process.off('unhandledRejection', onUnhandled);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isQueryCancelled and queryUnlessCancelled', () => {
  it('a query abandoned in flight rejects with a cancel, which is told apart from a failure', async () => {
    const fetchMock = holdRequests();
    const pending = query({ url: 'abandoned/one', cache: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const rejection = pending.catch((error: unknown) => error);
    ReqraftQueryClient.clear();

    expect(isQueryCancelled(await rejection)).toBe(true);
    expect(isQueryCancelled(new Error('Failed to fetch'))).toBe(false);
    expect(isQueryCancelled(new TypeError('Failed to fetch'))).toBe(false);
    expect(isQueryCancelled(undefined)).toBe(false);
    expect(isQueryCancelled(new CancelledError({ silent: true }))).toBe(true);
  });

  it('queryUnlessCancelled answers undefined for an abandoned query', async () => {
    const fetchMock = holdRequests();
    const pending = queryUnlessCancelled({ url: 'abandoned/two', cache: false });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    ReqraftQueryClient.clear();

    await expect(pending).resolves.toBeUndefined();
  });

  it('queryUnlessCancelled still answers a failed request, and still rejects anything else', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"desc":"no"}', { status: 403, statusText: 'Forbidden' }))
    );
    await expect(queryUnlessCancelled({ url: 'refused', cache: false })).resolves.toMatchObject({
      ok: false,
      code: 403,
    });

    // a body that cannot be read throws inside the query function
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => unreadableResponse())
    );
    await expect(queryUnlessCancelled({ url: 'unreadable', cache: false })).rejects.toThrow(
      'body stream aborted'
    );
  });
});

/** A response whose body cannot be read: `query` throws rather than answering. */
const unreadableResponse = () =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    clone: () => ({ text: () => Promise.reject(new Error('body stream aborted')) }),
  }) as unknown as Response;

describe('ReqraftUserProvider: an abandoned current-user load', () => {
  const renderProvider = () =>
    render(
      <ReqraftUserProvider waitForStorage>
        <span>the page</span>
      </ReqraftUserProvider>
    );

  it('does not warn, does not enter the failed state, and stops loading', async () => {
    const fetchMock = holdRequests();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { queryByText, findByText } = renderProvider();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // waitForStorage: nothing renders while the user is loading
    expect(currentUserStore.getState().loading).toBe(true);
    expect(queryByText('the page')).toBeNull();

    await abandonEverything();

    expect(warn).not.toHaveBeenCalled();
    expect(currentUserStore.getState().error).toBeUndefined();
    expect(currentUserStore.getState().errorData).toBeUndefined();
    expect(currentUserStore.getState().loading).toBe(false);
    // the page is no longer held back waiting for an answer that will not come
    expect(await findByText('the page')).toBeTruthy();
    expect(unhandled).toEqual([]);
  });

  it('keeps the user it already had', async () => {
    const user = { username: 'already-here', permissions: [] } as never;
    currentUserStore.setState({ currentUser: user });
    holdRequests();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    renderProvider();

    await vi.waitFor(() => expect(currentUserStore.getState().loading).toBe(true));
    await abandonEverything();

    expect(currentUserStore.getState().currentUser).toBe(user);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a real failure still warns once and enters the failed state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"desc":"Permission denied"}', { status: 403 }))
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { findByText } = renderProvider();

    expect(await findByText('the page')).toBeTruthy();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    await settle();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'Reqraft: the current user could not be loaded',
      currentUserStore.getState().error
    );
    expect(currentUserStore.getState().error).toBeTruthy();
    expect(unhandled).toEqual([]);
  });

  it('a load that throws (not an HTTP answer) warns once and enters the failed state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => unreadableResponse())
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { findByText } = renderProvider();

    // before: `loading` stayed true for good and a waitForStorage page rendered nothing
    expect(await findByText('the page')).toBeTruthy();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    await settle();

    expect(warn).toHaveBeenCalledTimes(1);
    const { error, loading, currentUser } = currentUserStore.getState();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('body stream aborted');
    expect(loading).toBe(false);
    expect(currentUser).toBeUndefined();
    expect(warn).toHaveBeenCalledWith('Reqraft: the current user could not be loaded', error);
    expect(unhandled).toEqual([]);
  });

  it('a caller of load() still learns that the load was abandoned', async () => {
    const fetchMock = holdRequests();
    const pending = currentUserStore.getState().load();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const rejection = pending.catch((error: unknown) => error);
    ReqraftQueryClient.clear();

    expect(isQueryCancelled(await rejection)).toBe(true);
  });
});

/** A fetch context over the real `query`, as `ReqraftFetchProvider` builds it. */
const realFetchContext = (): IReqraftFetchContext => ({
  get: (config) => query({ ...config!, method: 'GET' }),
  post: (config) => query({ ...config!, method: 'POST' }),
  put: (config) => query({ ...config!, method: 'PUT' }),
  del: (config) => query({ ...config!, method: 'DELETE' }),
});

describe('useFetch: an abandoned load', () => {
  it('is neither an error nor an unhandled rejection, and stops loading', async () => {
    const fetchMock = holdRequests();
    const fetchContext = realFetchContext();
    const { result } = renderHook(
      () => useFetch<{ value: number }>({ url: 'abandoned/use-fetch', loadOnMount: true }),
      {
        wrapper: ({ children }) => (
          <FetchContext.Provider value={fetchContext}>{children}</FetchContext.Provider>
        ),
      }
    );

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current.loading).toBe(true);

    await abandonEverything();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.data).toBeUndefined();
    expect(unhandled).toEqual([]);
  });

  it('a failed load is still an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500, statusText: 'Internal Server Error' }))
    );
    const fetchContext = realFetchContext();
    const { result } = renderHook(() => useFetch({ url: 'failed/use-fetch', loadOnMount: true }), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={fetchContext}>{children}</FetchContext.Provider>
      ),
    });

    await vi.waitFor(() => expect(result.current.error).toBe('Internal Server Error'));
    expect(result.current.loading).toBe(false);
  });
});

describe('useTemplates: an abandoned load', () => {
  beforeEach(() => {
    TemplatesCache.clear();
  });

  it('is not an error, and nothing is cached for the context', async () => {
    const fetchMock = holdRequests();
    const { result } = renderHook(() => useTemplates(true, {}, 'abandoned-context'));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await abandonEverything();

    expect(result.current.error).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(TemplatesCache.has('abandoned-context')).toBe(false);
  });
});

describe('AutoFormField: an abandoned schema load', () => {
  const wrap = (node: React.ReactNode) => (
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>{node}</FetchContext.Provider>
    </ReqoreUIProvider>
  );

  it('is not shown as a schema that could not be loaded', async () => {
    const fetchMock = holdRequests();
    const { container } = render(
      wrap(
        <AutoFormField
          name='abandoned'
          type='hash'
          arg_schema='abandoned_schema'
          value={undefined}
          onChange={vi.fn()}
        />
      )
    );

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('dataprovider/arg_schemas/abandoned_schema'),
        expect.anything()
      )
    );
    await abandonEverything();

    expect(container.textContent).not.toContain('could not be loaded');
    expect(unhandled).toEqual([]);
  });

  it('a schema that is refused is still shown as one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => unreadableResponse())
    );
    const { findByText } = render(
      wrap(
        <AutoFormField
          name='refused'
          type='hash'
          arg_schema='refused_schema'
          value={undefined}
          onChange={vi.fn()}
        />
      )
    );

    expect(await findByText(/body stream aborted/)).toBeTruthy();
  });
});

describe('FormEngine: an abandoned remote schema load', () => {
  it('is not an unhandled rejection', async () => {
    const fetchMock = holdRequests();
    render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            name='abandoned-remote'
            value={{} as never}
            url='abandoned-remote'
            operatorsUrl='abandoned-operators'
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('options/abandoned-remote'),
        expect.anything()
      )
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('abandoned-operators'),
      expect.anything()
    );
    await abandonEverything();

    expect(unhandled).toEqual([]);
  });

  it('a loader rejected with a cancel shows no error', async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <FormEngine
            compact
            name='abandoned-loader'
            value={{} as never}
            optionsLoader={() => Promise.reject(new CancelledError({ silent: true }))}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await settle();

    expect(container.textContent).not.toContain('[object Object]');
    expect(container.querySelector('.options-loading-skeleton')).toBeNull();
  });
});
