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

export const ReqraftUserProvider = ({ children }: IReqraftStorageProviderProps) => {
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
      const updatedStorage = set(cloneDeep(currentUser?.storage), _path, value);

      updateCurrentUserStorage(updatedStorage);

      load({ body: { storage: updatedStorage } });
    },
    [appName, currentUser?.storage, load, updateCurrentUserStorage]
  );

  const removeStorageValue = useCallback(
    function (path: string, includeAppPrefix: boolean = true) {
      const _path = includeAppPrefix ? `${appName}.${path}` : path;

      const updatedStorage = set(cloneDeep(currentUser?.storage), _path, null);

      updateCurrentUserStorage(updatedStorage);

      load({ body: { storage_path: _path } });
    },
    [appName, currentUser?.storage, load, updateCurrentUserStorage]
  );

  const contextValue = useMemo(
    () => ({ storage: currentUser?.storage, getStorage, updateStorage, removeStorageValue }),
    [currentUser?.storage, getStorage, updateStorage, removeStorageValue]
  );

  if (loading) {
    return null;
  }

  return (
    <ReqraftStorageContext.Provider value={contextValue}>{children}</ReqraftStorageContext.Provider>
  );
};
