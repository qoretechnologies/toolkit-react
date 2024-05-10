import { useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { FetchContext } from '../../contexts/FetchContext';
import { IReqraftQueryConfig } from '../../utils/fetch';

export interface IReqraftUseFetch<T> {
  data: T | undefined;
  loading: boolean;
  load: () => Promise<T>;
  error: Error | undefined;
}

export function useFetch<T>({
  url,
  method = 'GET',
  body,
  cache,
  defaultData,
}: IReqraftQueryConfig & { defaultData?: T }) {
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

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | undefined>(defaultData);
  const [error, setError] = useState<Error | undefined>();

  async function load() {
    setLoading(true);

    const response = await query<T>({ url, body, cache });

    setLoading(false);

    console.log({ response });

    if (response.ok) {
      setData(response.data);
    } else {
      setError(response.error);
    }
  }

  return { data, loading, load, error };
}
