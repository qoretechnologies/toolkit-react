import { createContext } from 'use-context-selector';
import { IReqraftFetchResponse } from '../utils/fetch';

export interface IReqraftFetchContext {
  get: <T>(url: string, cache?: boolean) => Promise<IReqraftFetchResponse<T>>;
  post: <T>(url: string, body: any) => Promise<IReqraftFetchResponse<T>>;
  put: <T>(url: string, body: any) => Promise<IReqraftFetchResponse<T>>;
  delete: <T>(url: string) => Promise<IReqraftFetchResponse<T>>;
}

export const FetchContext = createContext<IReqraftFetchContext>({
  get: async () => {
    throw new Error('FetchContext not implemented');
  },
  post: async () => {
    throw new Error('FetchContext not implemented');
  },
  put: async () => {
    throw new Error('FetchContext not implemented');
  },
  delete: async () => {
    throw new Error('FetchContext not implemented');
  },
});
