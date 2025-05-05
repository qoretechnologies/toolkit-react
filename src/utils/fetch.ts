import { QueryClient } from '@tanstack/react-query';
import { ReqraftQueryClient } from '../providers/ReqraftProvider';

export interface IReqraftFetchConfig {
  instance: string;
  instanceToken: string;
  instanceRbacDisabled?: boolean;
  unauthorizedRedirect?: (pathname: string) => string;
}

export interface IReqraftFetchOkResponse<T> {
  ok: true;
  data: T;

  code?: number;
  error?: any;
  response: Response;
}

export interface IReqraftFetchErrorResponse<E> {
  ok: false;
  data: E;

  code?: number;
  error?: any;
  response: Response;
}

export type TReqraftFetchResponse<T, E = string> =
  | IReqraftFetchOkResponse<T>
  | IReqraftFetchErrorResponse<E>;

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
  if (!fetchConfig.instanceToken && !fetchConfig.instanceRbacDisabled) {
    return new Response(JSON.stringify({}), {
      status: 401,
      statusText: 'Unauthorized',
    });
  }

  return fetch(`${fetchConfig.instance}api/latest/${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: fetchConfig.instanceRbacDisabled
        ? undefined
        : `Bearer ${fetchConfig.instanceToken}`,
    },
    body: JSON.stringify(body),
  }).catch((error) => {
    return new Response(JSON.stringify({}), {
      status: 500,
      statusText: `Request failed ${error.message}`,
    });
  });
}

export interface IReqraftQueryConfig<T> {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string | number, any>;
  cache?: boolean;
  queryClient?: QueryClient;
  onBefore?: () => void;
  onSuccess?: (data: IReqraftFetchOkResponse<T>) => void;
  onError?: (data: IReqraftFetchErrorResponse<string>) => void;
}

export function isError<T, E>(
  res: TReqraftFetchResponse<T, E>
): res is IReqraftFetchErrorResponse<E> {
  return res.ok === false;
}

export async function query<T>({
  url,
  method = 'GET',
  body,
  cache = true,
  queryClient = ReqraftQueryClient,
  onBefore,
  onSuccess,
  onError,
}: IReqraftQueryConfig<T>): Promise<TReqraftFetchResponse<T, string>> {
  const shouldCache = method === 'DELETE' || method === 'POST' ? false : cache;
  const cacheKey = `${url}:${method}:${JSON.stringify(body || {})}`;

  onBefore?.();

  const requestData = await queryClient.fetchQuery<TReqraftFetchResponse<T, string>>({
    queryKey: [cacheKey],
    queryFn: async (): Promise<TReqraftFetchResponse<T, string>> => {
      const response = await doFetchData(url, method, body);

      if (
        response.status === 401 &&
        process.env.NODE_ENV !== 'test' &&
        process.env.NODE_ENV !== 'storybook'
      ) {
        window.location.href = fetchConfig.unauthorizedRedirect(window.location.pathname);
      }

      const clone = response.clone();
      let parsed: unknown;

      try {
        parsed = await clone.json();
      } catch (error) {
        parsed = {};
      }

      if (!response.ok) {
        const result = {
          data: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
          ok: false as const,
          code: response.status,
          error: response.statusText,
          response,
        };

        onError?.(result);
        return result;
      }

      const result = {
        data: parsed as T,
        ok: true as const,
        code: response.status,
        response,
      };

      onSuccess?.(result);
      return result;
    },
    staleTime: shouldCache ? CACHE_EXPIRATION_TIME : 0,
  });

  if (!requestData.ok) {
    queryClient.invalidateQueries({ queryKey: [cacheKey] });
  }

  return requestData;
}
