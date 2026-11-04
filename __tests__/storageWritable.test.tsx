// Copyright 2026 Qore Technologies, s.r.o.
// A user whose storage is not theirs to keep writes it in memory only (qorus#693).
//
// A staff member in an interactive support session reads a customer's workspace as the
// workspace's reader principal. The server marks that identity `storage_writable: false`:
// a preference the staff member flips must behave as usual for the page's lifetime, and
// must never be sent to the server as the principal's storage. Every other user — and
// every server from before the flag — persists as before.
import { act, render, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReqraftStorageContext } from '../src/contexts/StorageContext';
import { ReqraftProvider } from '../src/providers/ReqraftProvider';
import { storageIsWritable } from '../src/providers/StorageProvider';
import { currentUserStore } from '../src/stores/currentUser/currentUser';

const user = (storage_writable?: boolean) => ({
  provider: 'qorus',
  username: 'staff',
  name: 'Support Staff',
  has_default: true,
  roles: [],
  permissions: [],
  workflows: [],
  services: [],
  jobs: [],
  mappers: [],
  vmaps: [],
  groups: [],
  fsms: [],
  storage: { theme: 'dark' },
  ...(storage_writable === undefined ? {} : { storage_writable }),
});

/** Every request the provider makes, by method, so a PUT that must not happen is provable. */
const requests: { method: string; url: string; body?: string }[] = [];

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const stubServer = (currentUser: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      requests.push({ method, url, body: typeof init?.body === 'string' ? init.body : undefined });
      return Promise.resolve(json(/users/.test(url) && method === 'GET' ? currentUser : {}));
    })
  );

/** The provider stack a storage write runs under in an app: the query client and fetch
 *  context the write is sent through, and the user provider that owns the storage. */
const Providers = ({ children }: { children: React.ReactNode }) => (
  <ReqraftProvider appName='test' waitForStorage={false}>
    {children}
  </ReqraftProvider>
);

/** Reads one storage key and offers a button that writes it — the way a preference does. */
const Preference = () => {
  const { getStorage, updateStorage } = useContext(ReqraftStorageContext);
  return (
    <button onClick={() => updateStorage('theme', 'light', false)}>
      {String(getStorage('theme', 'unset', false))}
    </button>
  );
};

beforeEach(() => {
  requests.length = 0;
  currentUserStore.setState({ currentUser: undefined, error: undefined, errorData: undefined, loading: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('storageIsWritable', () => {
  it('is false only when the server said so', () => {
    expect(storageIsWritable(undefined)).toBe(true);
    expect(storageIsWritable({})).toBe(true);
    expect(storageIsWritable({ storage_writable: true })).toBe(true);
    expect(storageIsWritable({ storage_writable: false })).toBe(false);
  });
});

describe('a storage write', () => {
  it('stays in memory for a user whose storage is not writable: the value updates, nothing is sent', async () => {
    stubServer(user(false));
    const { findByText, getByRole } = render(
      <Providers>
        <Preference />
      </Providers>
    );
    expect(await findByText('dark')).toBeTruthy();

    act(() => getByRole('button').click());

    await waitFor(() => expect(getByRole('button').textContent).toBe('light'));
    expect(currentUserStore.getState().currentUser?.storage).toEqual({ theme: 'light' });
    expect(requests.filter((r) => r.method === 'PUT')).toEqual([]);
  });

  it.each([
    ['a user the server marks writable', user(true)],
    ['a user from a server without the flag', user()],
  ])('is persisted for %s', async (_name, currentUser) => {
    stubServer(currentUser);
    const { findByText, getByRole } = render(
      <Providers>
        <Preference />
      </Providers>
    );
    expect(await findByText('dark')).toBeTruthy();

    act(() => getByRole('button').click());

    await waitFor(() => expect(getByRole('button').textContent).toBe('light'));
    await waitFor(() => expect(requests.filter((r) => r.method === 'PUT')).toHaveLength(1));
    const put = requests.find((r) => r.method === 'PUT')!;
    expect(put.url).toContain('users/_current_');
    expect(JSON.parse(put.body ?? '{}')).toEqual({ storage: { theme: 'light' } });
  });
});
