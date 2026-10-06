// Copyright 2026 Qore Technologies, s.r.o.
// A current user that cannot be loaded is a state, not an unhandled rejection.
//
// `ReqraftUserProvider` loads the current user on mount. The store's `load()`
// rejects when the request fails, and the provider dropped that promise, so a
// page with no signed-in user - a 401 without a token, a CORS refusal on another
// origin, a 404 - raised an unhandled rejection. In reqraft's Storybook every
// story is wrapped in the provider, and the rejection marked stories as errored
// whenever it landed before they finished (non-localhost or token-less origins).
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReqraftUserProvider } from '../src/providers/StorageProvider';
import { currentUserStore } from '../src/stores/currentUser/currentUser';

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);

beforeEach(() => {
  unhandled.length = 0;
  process.on('unhandledRejection', onUnhandled);
  currentUserStore.setState({ currentUser: undefined, error: undefined, errorData: undefined, loading: false });
});

afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A turn of the event loop, after which a rejection nobody handled has been reported. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a current user that cannot be loaded', () => {
  it.each([
    ['401, no token', () => Promise.resolve(new Response('{"desc":"Authentication required"}', { status: 401 }))],
    ['404, no such endpoint', () => Promise.resolve(new Response('Not Found', { status: 404 }))],
    ['a refused or failed request (CORS, network)', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('%s: the provider renders its children, keeps the error, and nothing is unhandled', async (_name, answer) => {
    vi.stubGlobal('fetch', vi.fn(answer));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { findByText } = render(
      <ReqraftUserProvider waitForStorage>
        <span>the page</span>
      </ReqraftUserProvider>
    );

    expect(await findByText('the page')).toBeTruthy();
    await waitFor(() => expect(currentUserStore.getState().error).toBeTruthy());
    expect(currentUserStore.getState().currentUser).toBeUndefined();
    await settle();
    expect(unhandled).toEqual([]);
    // said, not swallowed
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('current user'), currentUserStore.getState().error);
  });

  it('a caller of load() still learns that it failed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))));
    await expect(currentUserStore.getState().load()).rejects.toBeTruthy();
  });
});
