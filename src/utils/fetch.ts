import { QueryClient } from '@tanstack/react-query';
import { ReqraftQueryClient } from '../providers/ReqraftProvider';

export interface IReqraftFetchConfig {
  instance: string;
  instanceToken?: string;
  instanceRbacDisabled?: boolean;
  unauthorizedRedirect?: (pathname: string) => string;
}

export interface IReqraftFetchResponse<T> {
  data: T;
  ok: boolean;
  code?: number;
  error?: any;
  response: Response;
}

export const fetchConfig: IReqraftFetchConfig = {
  instance: window.location.origin + '/',
  instanceToken: '',
  unauthorizedRedirect: (pathname: string) => `/?next=${pathname}`,
};

const CACHE_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes

export const setupFetch = ({
  instance,
  instanceToken,
  instanceRbacDisabled,
  unauthorizedRedirect,
}: IReqraftFetchConfig) => {
  fetchConfig.instance = instance;
  fetchConfig.instanceToken = instanceToken;
  fetchConfig.instanceRbacDisabled = instanceRbacDisabled;

  if (unauthorizedRedirect) {
    fetchConfig.unauthorizedRedirect = unauthorizedRedirect;
  }
};

async function doFetchData(
  url: string,
  method = 'GET',
  body?: { [key: string]: any }
): Promise<Response> {
  // We do not check for token because Qorus now handles auth automatically via cookies
  // token is only supplied in a dev environment
  const headers = {
    'Content-Type': 'application/json',
  };

  if (fetchConfig.instanceToken && !fetchConfig.instanceRbacDisabled) {
    headers['Authorization'] = `Bearer ${fetchConfig.instanceToken}`;
  }

  return fetch(`${fetchConfig.instance}api/latest/${url}`, {
    method,
    headers,
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

  const requestData = await queryClient.fetchQuery({
    queryKey: [cacheKey],
    queryFn: async () => {
      const response = await doFetchData(url, method, body);

      const clone = response.clone();
      let data: any;

      try {
        data = await clone.json();
      } catch (error) {
        data = {};
      }

      return {
        data,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        response,
      };
    },
    staleTime: shouldCache ? CACHE_EXPIRATION_TIME : 0,
  });

  if (!requestData.ok) {
    queryClient.invalidateQueries({ queryKey: [cacheKey] });

    return {
      data: requestData.data,
      ok: false,
      code: requestData.status,
      error: requestData.statusText,
      response: requestData.response,
    };
  }

  return {
    data: requestData.data,
    ok: true,
    code: requestData.status,
    response: requestData.response,
  };
}
