import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReqraftStorage } from '../src/hooks/useStorage/useStorage';
import { ReqraftUserProvider } from '../src/providers/StorageProvider';
import {
  ICurrentUser,
  currentUserStore,
} from '../src/stores/currentUser/currentUser';

const mocks = vi.hoisted(() => ({
  persist: vi.fn(),
}));

vi.mock('../src/hooks/useFetch/useFetch', () => ({
  useFetch: () => ({ load: mocks.persist }),
}));

vi.mock('../src/hooks/useReqraftProperty', () => ({
  useReqraftProperty: () => 'ide',
}));

const StorageConsumer = () => {
  const [value, update, remove] = useReqraftStorage<boolean>(
    'cookie-consent',
    false
  );
  return (
    <>
      <span data-testid='value'>{String(value)}</span>
      <button type='button' onClick={() => update(true)}>
        update
      </button>
      <button type='button' onClick={remove}>
        remove
      </button>
    </>
  );
};

const user = (storage?: Record<string, unknown>): ICurrentUser =>
  ({
    username: 'new-user',
    storage,
  }) as ICurrentUser;

describe('ReqraftUserProvider storage initialization', () => {
  beforeEach(() => {
    mocks.persist.mockReset();
    mocks.persist.mockResolvedValue(undefined);
    currentUserStore.setState({
      currentUser: user(),
      loading: false,
      error: undefined,
      errorData: undefined,
      load: vi.fn().mockResolvedValue(user()),
    });
  });

  afterEach(() => {
    currentUserStore.setState({ currentUser: undefined });
  });

  it('initializes and persists storage for a user without a storage field', () => {
    render(
      <ReqraftUserProvider waitForStorage={false}>
        <StorageConsumer />
      </ReqraftUserProvider>
    );

    expect(screen.getByTestId('value').textContent).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    expect(screen.getByTestId('value').textContent).toBe('true');
    expect(currentUserStore.getState().currentUser?.storage).toEqual({
      ide: { 'cookie-consent': true },
    });
    expect(mocks.persist).toHaveBeenCalledWith({
      body: { storage: { ide: { 'cookie-consent': true } } },
    });
  });

  it('removes a path safely for a user without a storage field', () => {
    render(
      <ReqraftUserProvider waitForStorage={false}>
        <StorageConsumer />
      </ReqraftUserProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    expect(currentUserStore.getState().currentUser?.storage).toEqual({
      ide: { 'cookie-consent': null },
    });
    expect(mocks.persist).toHaveBeenCalledWith({
      body: { storage_path: 'ide.cookie-consent' },
    });
  });

  it('preserves unrelated storage while updating a path', () => {
    currentUserStore.setState({
      currentUser: user({ other: { preference: 'preserved' } }),
    });
    render(
      <ReqraftUserProvider waitForStorage={false}>
        <StorageConsumer />
      </ReqraftUserProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    expect(currentUserStore.getState().currentUser?.storage).toEqual({
      other: { preference: 'preserved' },
      ide: { 'cookie-consent': true },
    });
  });
});
