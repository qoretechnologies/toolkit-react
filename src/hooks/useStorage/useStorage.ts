import { useContextSelector } from 'use-context-selector';
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
  const { getStorage, updateStorage, removeStorageValue } = useContextSelector(
    ReqraftStorageContext,
    ({ getStorage, updateStorage, removeStorageValue }) => ({
      getStorage,
      updateStorage,
      removeStorageValue,
    })
  );

  return [
    getStorage(path, defaultValue, includeAppPrefix),
    (newStorage: T) => updateStorage(path, newStorage, includeAppPrefix),
    () => removeStorageValue(path, includeAppPrefix),
  ];
}
