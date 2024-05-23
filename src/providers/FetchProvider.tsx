import { useQueryClient } from '@tanstack/react-query';
import { FetchContext, TReqraftContextQueryConfig } from '../contexts/FetchContext';
import { query } from '../utils/fetch';

export interface IReqraftFetchProviderProps {
  children: React.ReactNode;
}

export const ReqraftFetchProvider = ({ children }: IReqraftFetchProviderProps) => {
  const queryClient = useQueryClient();

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
