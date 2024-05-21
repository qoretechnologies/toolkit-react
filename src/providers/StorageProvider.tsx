import { cloneDeep, get, set } from 'lodash';
import { ReactNode, useEffect, useState } from 'react';
import type { Get } from 'type-fest';
import { ReqraftStorageContext, TReqraftStorage } from '../contexts/StorageContext';
import { useFetch } from '../hooks/useFetch/useFetch';
import { useReqraftProperty } from '../hooks/useReqraftProperty';
import { TReqraftStorageValue } from '../hooks/useStorage/useStorage';

export interface IReqraftStorageProviderProps {
  children: ReactNode;
}

export const ReqraftStorageProvider = ({ children }: IReqraftStorageProviderProps) => {
  const appName = useReqraftProperty('appName');

  const { data, loading } = useFetch({
    url: 'users/_current_/storage',
    cache: false,
    loadOnMount: true,
  });

  const { load } = useFetch({
    url: 'users/_current_/',
    method: 'PUT',
    cache: false,
  });

  const [storage, setStorage] = useState<TReqraftStorage>(data);

  useEffect(() => {
    if (data) {
      setStorage(data);
    }
  }, [data]);

  const getStorage = function <T extends TReqraftStorageValue>(
    path: string,
    defaultValue: T,
    includeAppPrefix: boolean = true
  ): Get<TReqraftStorage, string> {
    const _path = includeAppPrefix ? `${appName}.${path}` : path;

    return get(storage, _path) ?? defaultValue;
  };

  const updateStorage = function <T extends TReqraftStorageValue>(
    path: string,
    value: T,
    includeAppPrefix: boolean = true
  ) {
    const _path = includeAppPrefix ? `${appName}.${path}` : path;
    const updatedStorage = set(cloneDeep(storage), _path, value);

    setStorage(updatedStorage);

    load({ body: { storage: updatedStorage } });
  };

  const removeStorageValue = function (path: string, includeAppPrefix: boolean = true) {
    const _path = includeAppPrefix ? `${appName}.${path}` : path;

    const updatedStorage = set(cloneDeep(storage), _path, null);

    setStorage(updatedStorage);

    load({ body: { storage_path: _path } });
  };

  if (loading || !storage) {
    return null;
  }

  return (
    <ReqraftStorageContext.Provider
      value={{ storage, getStorage, updateStorage, removeStorageValue }}
    >
      {children}
    </ReqraftStorageContext.Provider>
  );
};
