import { useState } from 'react';
import { useQueryClient } from 'react-query';
import { useEffectOnce } from 'react-use';
import { FetchContext, TReqraftContextQueryConfig } from '../contexts/FetchContext';
import { query, setupFetch } from '../utils/fetch';
import { IReqraftProviderProps } from './ReqraftProvider';

export interface IReqraftFetchProviderProps extends IReqraftProviderProps {}

export const ReqraftFetchProvider = ({
  children,
  instance,
  instanceToken,
  instanceUnauthorizedRedirect,
}: IReqraftFetchProviderProps) => {
  const queryClient = useQueryClient();
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
