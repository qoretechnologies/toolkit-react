import { useCallback, useMemo, useState } from 'react';
import { useEffectOnce } from 'react-use';
import { useContextSelector } from 'use-context-selector';
import { FetchContext } from '../../contexts/FetchContext';
import { IReqraftQueryConfig } from '../../utils/fetch';

export interface IReqraftUseFetch<T> {
  data: T | undefined;
  loading: boolean;
  load: () => Promise<T>;
  error: Error | undefined;
  errorData?: any;
}

export interface IReqraftUseFetchOptions<T> extends IReqraftQueryConfig {
  defaultData?: T;
  loadOnMount?: boolean;
}

export function useFetch<T>({
  url,
  method = 'GET',
  body,
  cache,
  defaultData,
  loadOnMount,
  noApiPrefix,
}: IReqraftUseFetchOptions<T>) {
  const query = useContextSelector(FetchContext, (context) => {
    switch (method) {
      case 'GET':
        return context.get;
      case 'POST':
        return context.post;
      case 'PUT':
        return context.put;
      case 'DELETE':
        return context.del;
      default:
        throw new Error('Invalid method');
    }
  });

  const [loading, setLoading] = useState(loadOnMount);
  const [data, setData] = useState<T | undefined>(defaultData);
  const [response, setResponse] = useState<Response | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [errorData, setErrorData] = useState<any>();

  const load = useCallback(
    async ({
      body: customBody,
      mergeBodies,
    }: { body?: Record<string | number, any>; mergeBodies?: boolean } = {}) => {
      setLoading(true);

      const _body = mergeBodies ? { ...body, ...customBody } : customBody || body;
      const response = await query<T>({ url, body: _body, cache, noApiPrefix });

      setLoading(false);

      if (response.ok) {
        setError(undefined);
        setErrorData(undefined);
        setData(response.data);
      } else {
        setError(response.error);
        setErrorData(response.data);
      }

      setResponse(response.response);
    },
    [JSON.stringify(body), method, url, cache, noApiPrefix]
  );

  useEffectOnce(() => {
    if (loadOnMount) {
      load();
    }
  });

  return useMemo(
    () => ({ data, loading, load, error, errorData, response }),
    [JSON.stringify(data), loading, load, error, errorData, response]
  );
}
