import { useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { FetchContext } from '../../contexts/FetchContext';

export function useGet<T>({
  url,
  cache,
  defaultData,
}: {
  url: string;
  cache?: boolean;
  defaultData?: T;
}) {
  const get = useContextSelector(FetchContext, (context) => context.get);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | undefined>(defaultData);

  async function load() {
    setLoading(true);

    const response = await get<T>(url, cache);

    setLoading(false);

    if (response.ok) {
      setData(response.data);
    }
  }

  return { data, loading, load };
}
