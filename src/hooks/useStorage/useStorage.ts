import { useCallback, useContext, useMemo } from 'react';
import { ReqraftStorageContext } from '../../contexts/StorageContext';

export type TReqraftStorageValue = string | number | boolean | Record<string | number, any> | any[];
export type TReqraftUseStorage<T extends TReqraftStorageValue> = [
  T,
  (newStorage: T) => void,
  () => void,
];

export function useReqraftStorage<T extends TReqraftStorageValue>(
  path: string,
  defaultValue?: T,
  includeAppPrefix?: boolean
): TReqraftUseStorage<T> {
  const { getStorage, updateStorage, removeStorageValue } = useContext(ReqraftStorageContext);

  const value = useMemo(
    () => getStorage(path, defaultValue, includeAppPrefix),
    [path, defaultValue, includeAppPrefix, getStorage]
  );

  const updater = useCallback(
    (newStorage: T) => {
      updateStorage(path, newStorage, includeAppPrefix);
    },
    [path, includeAppPrefix, updateStorage]
  );

  const remover = useCallback(() => {
    removeStorageValue(path, includeAppPrefix);
  }, [path, includeAppPrefix, removeStorageValue]);

  return [value, updater, remover];
}
