import { useState } from 'react';
import { useEffectOnce } from 'react-use';
import { FetchContext } from '../contexts/FetchContext';
import { query, setupFetch } from '../utils/fetch';
import { IReqraftProviderProps } from './ReqraftProvider';

export interface IReqraftFetchProviderProps extends IReqraftProviderProps {}

export const ReqraftFetchProvider = ({
  children,
  instance,
  instanceToken,
  instanceUnauthorizedRedirect,
}: IReqraftFetchProviderProps) => {
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

  async function get<T>(url: string, cache?: boolean) {
    return query<T>(url, 'GET', undefined, cache);
  }

  async function post<T>(url: string, body: any) {
    return query<T>(url, 'POST', body);
  }

  async function put<T>(url: string, body: any) {
    return query<T>(url, 'PUT', body);
  }

  async function del<T>(url: string) {
    return query<T>(url, 'DELETE');
  }

  return (
    <FetchContext.Provider
      value={{
        get,
        post,
        put,
        delete: del,
      }}
    >
      {children}
    </FetchContext.Provider>
  );
};
