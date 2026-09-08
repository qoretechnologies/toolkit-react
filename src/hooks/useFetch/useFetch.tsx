import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useEffectOnce } from 'react-use';
import { useContextSelector } from 'use-context-selector';
import { FetchContext } from '../../contexts/FetchContext';
import { ReqraftQueryClient } from '../../providers/ReqraftProvider';
import { IReqraftQueryConfig, reqraftCacheKey } from '../../utils/fetch';

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

  /* An answer we ALREADY HAVE is not a loading state.
     `loading` started at `loadOnMount` unconditionally, so every consumer that
     mounted reported "loading" for at least one async turn even when the
     response was sitting in the cache — and `FormEngine` renders its
     `options-loading-skeleton` whenever any of its sources says that. So each
     form appearing on a page flashed a skeleton whether or not anything was
     actually fetched, which is what the repeated skeletons on an IDE page are:
     measured on a fully warm SECOND visit to one page, three skeleton waves
     against two requests, the last wave with no request anywhere near it.
     Seeded from the query cache instead, so a resource already in hand renders
     immediately. */
  /* The provider is OPTIONAL here. `useQueryClient` THROWS when no
     `QueryClientProvider` is above it, and plenty of consumers mount a form
     with only a `FetchContext` — requiring one turned a rendering optimisation
     into a hard dependency and took 131 tests down with it. `useContext` runs
     before that throw, so hook order is unaffected and catching is safe. The
     fallback is the same client `query` itself defaults to, so a cache hit is
     found either way. */
  let queryClient: QueryClient;
  try {
    queryClient = useQueryClient();
  } catch {
    queryClient = ReqraftQueryClient;
  }

  const cached = queryClient.getQueryData([
    reqraftCacheKey({ url, method, body, noApiPrefix }),
  ]) as { data?: T; ok?: boolean } | undefined;
  const hasCachedAnswer = !!cached && cached.ok !== false && cached.data !== undefined;

  const [loading, setLoading] = useState(!!loadOnMount && !hasCachedAnswer);
  const [data, setData] = useState<T | undefined>(
    hasCachedAnswer ? (cached?.data as T) : defaultData
  );
  const [response, setResponse] = useState<Response | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [errorData, setErrorData] = useState<any>();

  const load = useCallback(
    async ({
      body: customBody,
      mergeBodies,
      silent,
    }: {
      body?: Record<string | number, any>;
      mergeBodies?: boolean;
      /** Revalidate without announcing a loading state — see the note above. */
      silent?: boolean;
    } = {}) => {
      if (!silent) {
        setLoading(true);
      }

      const _body = mergeBodies ? { ...body, ...customBody } : customBody || body;
      const response = await query<T>({ url, body: _body, cache, noApiPrefix });

      if (!silent) {
        setLoading(false);
      }

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
      // Still revalidates when the entry is cached — `query` honours its own
      // staleness — but silently, so a cached answer never flashes a skeleton.
      load({ silent: hasCachedAnswer });
    }
  });

  return useMemo(
    () => ({ data, loading, load, error, errorData, response }),
    [JSON.stringify(data), loading, load, error, errorData, response]
  );
}
