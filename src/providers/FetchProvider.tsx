import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useEffectOnce } from 'react-use';
import { FetchContext, TReqraftContextQueryConfig } from '../contexts/FetchContext';
import { useReqraftProperty } from '../hooks/useReqraftProperty';
import { query, setupFetch } from '../utils/fetch';

export interface IReqraftFetchProviderProps {
  children: React.ReactNode;
}

export const ReqraftFetchProvider = ({ children }: IReqraftFetchProviderProps) => {
  const queryClient = useQueryClient();
  const instance = useReqraftProperty('instance');
  const instanceToken = useReqraftProperty('instanceToken');
  const instanceUnauthorizedRedirect = useReqraftProperty('instanceUnauthorizedRedirect');

  const [ready, setReady] = useState(false);

  useEffectOnce(() => {
    setupFetch({
      instance,
      instanceToken,
      unauthorizedRedirect: instanceUnauthorizedRedirect,
    });

    setReady(true);
  });

  if (!ready) {
    return null;
  }

  async function get<T>(config: TReqraftContextQueryConfig) {
    return query<T>({ queryClient, ...config, method: 'GET' });
  }

  async function post<T>(config: TReqraftContextQueryConfig) {
    return query<T>({ queryClient, ...config, method: 'POST' });
  }

  async function put<T>(config: TReqraftContextQueryConfig) {
    return query<T>({ queryClient, ...config, method: 'PUT' });
  }

  async function del<T>(config: TReqraftContextQueryConfig) {
    return query<T>({ queryClient, ...config, method: 'DELETE' });
  }

  return (
    <FetchContext.Provider
      value={{
        get,
        post,
        put,
        del,
      }}
    >
      {children}
    </FetchContext.Provider>
  );
};
