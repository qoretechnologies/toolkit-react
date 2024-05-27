import { createContext } from 'react';
import { Get } from 'type-fest';
import { TReqraftStorageValue } from '../hooks/useStorage/useStorage';

export type TReqraftStorage = Record<string, any>;

export interface IReqraftStorageContext {
  storage?: Record<string, any>;
  getStorage?: <T extends TReqraftStorageValue>(
    path: string,
    defaultValue?: T,
    includeAppPrefix?: boolean
  ) => Get<TReqraftStorage, string>;
  updateStorage?: <T extends TReqraftStorageValue>(
    path: string,
    value: T,
    includeAppPrefix?: boolean
  ) => void;
  removeStorageValue: (path: string, includeAppPrefix?: boolean) => void;
}

export const ReqraftStorageContext = createContext<IReqraftStorageContext>({
  storage: {},
  getStorage: () => {
    throw new Error('Storage not implemented');
  },
  updateStorage: () => {
    throw new Error('Storage not implemented');
  },
  removeStorageValue: () => {
    throw new Error('Storage not implemented');
  },
});
