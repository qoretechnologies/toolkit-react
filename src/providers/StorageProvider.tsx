import { cloneDeep, get, set } from 'lodash';
import { ReactNode, useCallback, useMemo } from 'react';
import { useEffectOnce } from 'react-use';
import type { Get } from 'type-fest';
import { ReqraftStorageContext, TReqraftStorage } from '../contexts/StorageContext';
import { useFetch } from '../hooks/useFetch/useFetch';
import { useReqraftProperty } from '../hooks/useReqraftProperty';
import { TReqraftStorageValue } from '../hooks/useStorage/useStorage';
import { currentUserStore } from '../stores/currentUser/currentUser';
import { IReqraftProviderProps } from './ReqraftProvider';

/**
 * Apply a single path write onto the current storage blob, seeding a fresh object
 * when the user has no storage yet.
 *
 * `?? {}` is load-bearing: a user who has never written storage has
 * `storage === undefined | null`, and `set(cloneDeep(undefined), …)` returns
 * `undefined` (lodash won't set on a nullish target). Without the seed the FIRST
 * write for such a user — e.g. accepting the cookie-consent banner — persists an
 * empty body and silently drops the value, so the flag stays unset forever and
 * the banner never closes. Exported for testing.
 */
export const applyStorageWrite = (
  storage: TReqraftStorage | undefined,
  path: string,
  value: unknown
): TReqraftStorage => set(cloneDeep(storage) ?? {}, path, value);

export interface IReqraftStorageProviderProps
  extends Pick<IReqraftProviderProps, 'waitForStorage'> {
  children: ReactNode;
}

export const ReqraftUserProvider = ({ children, waitForStorage }: IReqraftStorageProviderProps) => {
  const appName = useReqraftProperty('appName');
  const {
    currentUser,
    updateStorage: updateCurrentUserStorage,
    load: loadCurrentUser,
    loading,
  } = currentUserStore();

  useEffectOnce(() => {
    loadCurrentUser();
  });

  const { load } = useFetch({
    url: 'users/_current_/',
    method: 'PUT',
    cache: false,
  });

  const getStorage = useCallback(
    function <T extends TReqraftStorageValue>(
      path: string,
      defaultValue: T,
      includeAppPrefix: boolean = true
    ): Get<TReqraftStorage, string> {
      const _path = includeAppPrefix ? `${appName}.${path}` : path;

      return get(currentUser?.storage, _path) ?? defaultValue;
    },
    [appName, currentUser?.storage]
  );

  const updateStorage = useCallback(
    function <T extends TReqraftStorageValue>(
      path: string,
      value: T,
      includeAppPrefix: boolean = true
    ) {
      const _path = includeAppPrefix ? `${appName}.${path}` : path;
      // Base the write on the LATEST storage read straight from the store, not
      // the blob captured in this callback's closure. A caller holding a stale
      // updater — e.g. an imperative store subscription created on mount, before
      // other keys had loaded — would otherwise persist an out-of-date blob and
      // wipe every key written to storage since its closure was captured.
      const latestStorage = currentUserStore.getState().currentUser?.storage;
      const updatedStorage = applyStorageWrite(latestStorage, _path, value);

      updateCurrentUserStorage(updatedStorage);

      load({ body: { storage: updatedStorage } });
    },
    [appName, load, updateCurrentUserStorage]
  );

  const removeStorageValue = useCallback(
    function (path: string, includeAppPrefix: boolean = true) {
      const _path = includeAppPrefix ? `${appName}.${path}` : path;

      // Same as `updateStorage`: mutate the LATEST blob (never a stale closure
      // copy), seeding a fresh object when there's no storage yet.
      const latestStorage = currentUserStore.getState().currentUser?.storage;
      const updatedStorage = applyStorageWrite(latestStorage, _path, null);

      updateCurrentUserStorage(updatedStorage);

      load({ body: { storage_path: _path } });
    },
    [appName, load, updateCurrentUserStorage]
  );

  const contextValue = useMemo(
    () => ({ storage: currentUser?.storage, getStorage, updateStorage, removeStorageValue }),
    [currentUser?.storage, getStorage, updateStorage, removeStorageValue]
  );

  if (loading && waitForStorage) {
    return null;
  }

  return (
    <ReqraftStorageContext.Provider value={contextValue}>{children}</ReqraftStorageContext.Provider>
  );
};
