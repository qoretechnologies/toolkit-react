import { createContext } from 'use-context-selector';
import { IReqraftFetchResponse, IReqraftQueryConfig } from '../utils/fetch';

export type TReqraftContextQueryConfig = Omit<IReqraftQueryConfig, 'method'>;
export interface IReqraftFetchContext {
  get: <T>(config?: TReqraftContextQueryConfig) => Promise<IReqraftFetchResponse<T>>;
  post: <T>(config?: TReqraftContextQueryConfig) => Promise<IReqraftFetchResponse<T>>;
  put: <T>(config?: TReqraftContextQueryConfig) => Promise<IReqraftFetchResponse<T>>;
  del: <T>(config?: TReqraftContextQueryConfig) => Promise<IReqraftFetchResponse<T>>;
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
  del: async () => {
    throw new Error('FetchContext not implemented');
  },
});
