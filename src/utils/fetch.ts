import { QueryClient } from 'react-query';
import { ReqraftQueryClient } from '../providers/ReqraftProvider';

export interface IReqraftFetchConfig {
  instance: string;
  instanceToken: string;
  unauthorizedRedirect?: (pathname: string) => string;
}

export interface IReqraftFetchResponse<T> {
  data: T;
  ok: boolean;
  code?: number;
  error?: any;
}

const fetchConfig: IReqraftFetchConfig = {
  instance: window.location.origin + '/',
  instanceToken: '',
  unauthorizedRedirect: (pathname: string) => `/?next=${pathname}`,
};

const CACHE_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes

export const setupFetch = ({
  instance,
  instanceToken,
  unauthorizedRedirect,
}: IReqraftFetchConfig) => {
  fetchConfig.instance = instance;
  fetchConfig.instanceToken = instanceToken;

  if (unauthorizedRedirect) {
    fetchConfig.unauthorizedRedirect = unauthorizedRedirect;
  }
};

async function doFetchData(
  url: string,
  method = 'GET',
  body?: { [key: string]: any }
): Promise<Response> {
  if (!fetchConfig.instanceToken) {
    return new Response(JSON.stringify({}), {
      status: 401,
      statusText: 'Unauthorized',
    });
  }

  return fetch(`${fetchConfig.instance}api/latest/${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${fetchConfig.instanceToken}`,
    },
    body: JSON.stringify(body),
  }).catch((error) => {
    return new Response(JSON.stringify({}), {
      status: 500,
      statusText: `Request failed ${error.message}`,
    });
  });
}

export interface IReqraftQueryConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string | number, any>;
  cache?: boolean;
  queryClient?: QueryClient;
}

export async function query<T>({
  url,
  method = 'GET',
  body,
  cache = true,
  queryClient = ReqraftQueryClient,
}: IReqraftQueryConfig): Promise<IReqraftFetchResponse<T>> {
  const shouldCache = method === 'DELETE' || method === 'POST' ? false : cache;
  const cacheKey = `${url}:${method}:${JSON.stringify(body || {})}`;

  const requestData = await queryClient.fetchQuery(
    cacheKey,
    async () => {
      const response = await doFetchData(url, method, body);
      const clone = response.clone();
      const json = await clone.json();

      if (response.status === 401) {
        window.location.href = fetchConfig.unauthorizedRedirect(window.location.pathname);
      }

      return {
        data: json,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      };
    },
    {
      staleTime: shouldCache ? CACHE_EXPIRATION_TIME : 0,
    }
  );

  if (!requestData.ok) {
    queryClient.invalidateQueries(cacheKey);

    return {
      data: null,
      ok: false,
      code: requestData.status,
      error: requestData.statusText,
    };
  }

  return {
    data: requestData.data,
    ok: true,
    code: requestData.status,
  };
}
