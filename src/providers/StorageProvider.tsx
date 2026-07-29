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
      const updatedStorage = set(cloneDeep(latestStorage), _path, value);

      updateCurrentUserStorage(updatedStorage);

      load({ body: { storage: updatedStorage } });
    },
    [appName, load, updateCurrentUserStorage]
  );

  const removeStorageValue = useCallback(
    function (path: string, includeAppPrefix: boolean = true) {
      const _path = includeAppPrefix ? `${appName}.${path}` : path;

      // Same as `updateStorage`: mutate the latest blob, never a stale closure copy.
      const latestStorage = currentUserStore.getState().currentUser?.storage;
      const updatedStorage = set(cloneDeep(latestStorage), _path, null);

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
