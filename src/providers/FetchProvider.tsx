import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { FetchContext, TReqraftContextQueryConfig } from '../contexts/FetchContext';
import { query } from '../utils/fetch';

export interface IReqraftFetchProviderProps {
  children: React.ReactNode;
}

export const ReqraftFetchProvider = ({ children }: IReqraftFetchProviderProps) => {
  const queryClient = useQueryClient();

  const get = useCallback(
    <T extends any>(config: TReqraftContextQueryConfig) => {
      return query<T>({ queryClient, ...config, method: 'GET' });
    },
    [queryClient]
  );

  const post = useCallback(
    <T extends any>(config: TReqraftContextQueryConfig) => {
      return query<T>({ queryClient, ...config, method: 'POST' });
    },
    [queryClient]
  );

  const put = useCallback(
    <T extends any>(config: TReqraftContextQueryConfig) => {
      return query<T>({ queryClient, ...config, method: 'PUT' });
    },
    [queryClient]
  );

  const del = useCallback(
    <T extends any>(config: TReqraftContextQueryConfig) => {
      return query<T>({ queryClient, ...config, method: 'DELETE' });
    },
    [queryClient]
  );

  const contextValue = useMemo(
    () => ({
      get,
      post,
      put,
      del,
    }),
    [get, post, put, del]
  );

  return <FetchContext.Provider value={contextValue}>{children}</FetchContext.Provider>;
};
