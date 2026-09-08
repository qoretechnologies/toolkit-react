import { QueryClient } from '@tanstack/react-query';
import { ReqraftQueryClient } from '../providers/ReqraftProvider';

export interface IReqraftFetchConfig {
  instance: string;
  instanceToken?: string;
  instanceRbacDisabled?: boolean;
  unauthorizedRedirect?: (location: Window['location']) => string;
}

export interface IReqraftFetchResponse<T> {
  data: T;
  ok: boolean;
  code?: number;
  error?: any;
  /**
   * The parsed error body on a non-ok response, when the server sent JSON.
   *
   * Qorus errors carry `{ err, desc }`; `error` above is only the HTTP reason
   * phrase, which is why a caller that wanted the sentence had to reach into
   * `data`. Consumers that need the code (`err`) or the message (`desc`) should
   * read this rather than re-parsing.
   */
  errorBody?: Record<string, any>;
  /**
   * The response text when the body was NOT valid JSON. A non-JSON error would
   * otherwise arrive as `{}` with only a reason phrase, discarding whatever the
   * server actually said.
   */
  rawText?: string;
  response: Response;
}

export const fetchConfig: IReqraftFetchConfig = {
  instance: window.location.origin + '/',
  instanceToken: '',
  unauthorizedRedirect: (location: Window['location']) => `/?next=${location.pathname}`,
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

/**
 * The API path a caller asked for, without the leading slash the prefix already
 * carries.
 *
 * `doFetchData` builds `${instance}api/latest/${url}`, and that prefix ENDS in a
 * slash — so a caller writing `/dataprovider/arg_schemas/x` produced
 * `api/latest//dataprovider/arg_schemas/x`. Qorus serves it, which is how both
 * spellings survived side by side (`useArgSchema` writes one, `CompactRow` and
 * `AutoFormField` the other), but it is not harmless: the query cache is keyed
 * on the url, so `/x` and `x` were two cache entries and two requests for one
 * resource.
 *
 * Normalised here, once, rather than at each call site — the convention is
 * invisible from a caller's point of view and the next one would get it wrong
 * again. Only applied when the prefix is added: a caller that opts out of the
 * prefix owns its whole path, leading slash included.
 */
export const reqraftApiPath = (url: string, noApiPrefix: boolean = false): string =>
  noApiPrefix ? url : url.replace(/^\/+/, '');

/**
 * A cheap, stable, non-reversible marker for a bearer token.
 *
 * Two callers holding DIFFERENT tokens are two identities and must not share a
 * cached response, so the token has to take part in the cache key — but a raw
 * token in a key is a credential sitting in devtools' query inspector. djb2 is
 * enough to tell two tokens apart, which is all the key needs.
 */
const tokenMarker = (token?: string): string => {
  if (!token) {
    return '';
  }
  let hash = 5381;
  for (let index = 0; index < token.length; index++) {
    hash = ((hash << 5) + hash + token.charCodeAt(index)) | 0;
  }
  return `:t${(hash >>> 0).toString(36)}`;
};

/**
 * The one cache key for a request, used by every caller in every downstream
 * project so that one resource is one entry and one in-flight request.
 *
 * `instance` and the token take part because both change WHICH server and WHOSE
 * data answers: a call that overrides the instance, or that carries an explicit
 * token, is a different resource that happens to share a path.
 */
export const reqraftCacheKey = ({
  url,
  method = 'GET',
  body,
  noApiPrefix,
  instance,
  token,
}: Pick<IReqraftQueryConfig, 'url' | 'method' | 'body' | 'noApiPrefix' | 'instance' | 'token'>) =>
  `${reqraftApiPath(url, noApiPrefix)}:${method}:${JSON.stringify(body || {})}${
    instance && instance !== fetchConfig.instance ? `:@${instance}` : ''
  }${tokenMarker(token)}`;

async function doFetchData(
  url: string,
  method = 'GET',
  body?: { [key: string]: any },
  noApiPrefix = false,
  instance = fetchConfig.instance,
  headers?: Record<string, string>,
  token?: string
): Promise<Response> {
  // We do not check for token because Qorus now handles auth automatically via cookies
  // token is only supplied in a dev environment
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers ?? {}),
  };

  const finalToken = token ?? (fetchConfig.instanceRbacDisabled ? undefined : fetchConfig.instanceToken);

  if (finalToken && !finalHeaders['Authorization']) {
    finalHeaders['Authorization'] = `Bearer ${finalToken}`;
  }

  // `noApiPrefix` means the caller owns the WHOLE url — an absolute address for
  // another service, which is the only thing reqraft itself uses it for
  // (`useExpressions` sets it exactly when `expressionsUrl` is `http(s)://…`).
  // Prepending the instance there built `https://instance:8011/https://other/…`.
  return fetch(`${noApiPrefix ? '' : `${instance}api/latest/`}${reqraftApiPath(url, noApiPrefix)}`, {
    method,
    headers: finalHeaders,
    body: JSON.stringify(body),
    credentials: 'include',
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
  /**
   * The `url` is a complete address and is used verbatim — neither the instance
   * nor `api/latest/` is prepended, and its leading slash is left alone. For
   * reaching a service that is not this Qorus instance.
   */
  noApiPrefix?: boolean;
  /** Override the global instance URL for this single call (e.g. to target a different port). */
  instance?: string;
  /** Extra request headers, merged over the default `Content-Type`. */
  headers?: Record<string, string>;
  /**
   * A bearer token for THIS call, instead of the configured instance token —
   * for a route that is authenticated as somebody other than the current app
   * session. Takes part in the cache key.
   */
  token?: string;
  /**
   * An explicit cache key, for a caller that must group or separate requests
   * differently from the default `path:method:body` identity.
   */
  cacheKey?: string;
  /**
   * How long a cached response counts as fresh, in ms. Defaults to 5 minutes
   * when `cache` is on. `Infinity` keeps it for the life of the page — what a
   * caller wants for a catalogue that cannot change without a server restart.
   */
  staleTime?: number;
  /**
   * Whether a 401 on this request should send the page to
   * `fetchConfig.unauthorizedRedirect`. Defaults to `true`.
   *
   * A 401 only means "this app's session expired" when the request actually
   * carried this app's credential. A call that targets another service, or that
   * hands over an explicit token, proves nothing about the session — signing the
   * user out because an unrelated credential was refused is wrong. Callers that
   * own their own auth policy (or that must never navigate, such as a test
   * runner or a Storybook preview) pass `false`.
   */
  redirectOnUnauthorized?: boolean;
}

/**
 * Reads a response body without consuming it, and says whether it was JSON.
 *
 * `data` stays `{}` for a body that is empty or not JSON, which is the contract
 * reqraft's consumers have always been given. The text is handed back separately
 * as `rawText` so an error that was not JSON still carries whatever the server
 * said, instead of being flattened to a bare reason phrase.
 */
const readBody = async (response: Response): Promise<{ data: any; rawText?: string }> => {
  const rawText = await response.clone().text();

  try {
    return { data: JSON.parse(rawText) };
  } catch (_error) {
    return { data: {}, rawText };
  }
};

/**
 * The single request mechanism.
 *
 * Every request in reqraft AND in the projects built on it goes through here,
 * so that one resource has one cache entry and one in-flight request no matter
 * which library, hook or component asked for it. A downstream project that
 * keeps its own fetch helper (qorus-ide's `fetchData` is the one this was
 * written for) should adapt onto this rather than hold a second cache: two
 * caches over one API cannot see each other's in-flight requests, so any
 * resource both libraries want is fetched twice by construction.
 */
export async function query<T>({
  url,
  method = 'GET',
  body,
  cache = true,
  queryClient = ReqraftQueryClient,
  noApiPrefix = false,
  instance,
  headers,
  token,
  cacheKey,
  staleTime,
  redirectOnUnauthorized = true,
}: IReqraftQueryConfig): Promise<IReqraftFetchResponse<T>> {
  const shouldCache = method === 'DELETE' || method === 'POST' ? false : cache;
  const key =
    cacheKey ?? reqraftCacheKey({ url, method, body, noApiPrefix, instance, token });

  const requestData = await queryClient.fetchQuery({
    queryKey: [key],
    queryFn: async () => {
      const response = await doFetchData(url, method, body, noApiPrefix, instance, headers, token);

      if (response.status === 401 && redirectOnUnauthorized && fetchConfig.unauthorizedRedirect) {
        // `replace`, not an assignment: the page being left is dead, and a
        // history entry for it means Back lands on a view that can only 401
        // again.
        window.location.replace(fetchConfig.unauthorizedRedirect(window.location));
      }

      const { data, rawText } = await readBody(response);

      return {
        data,
        rawText,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        response,
      };
    },
    staleTime: shouldCache ? (staleTime ?? CACHE_EXPIRATION_TIME) : 0,
  });

  if (!requestData.ok) {
    queryClient.invalidateQueries({ queryKey: [key] });

    return {
      data: requestData.data,
      ok: false,
      code: requestData.status,
      error: requestData.statusText,
      // Only when the body really was JSON: `data` is `{}` for a non-JSON body,
      // and an empty object masquerading as a parsed error tells a caller
      // nothing while looking like it did.
      errorBody: requestData.rawText === undefined ? requestData.data : undefined,
      rawText: requestData.rawText,
      response: requestData.response,
    };
  }

  return {
    data: requestData.data,
    ok: true,
    code: requestData.status,
    rawText: requestData.rawText,
    response: requestData.response,
  };
}

export interface IReqraftRawResponse {
  ok: boolean;
  code?: number;
  error?: string;
  /** The response bytes. Undefined on a non-ok response. */
  blob?: Blob;
  /** The `Content-Type` the bytes were served with, without parameters. */
  mime?: string;
}

/**
 * Fetch a resource whose body is NOT JSON — a file, an export, a log.
 *
 * Shares `doFetchData` with `query`, which owns the API prefix, the bearer token
 * and `credentials: 'include'`. The point is that raw responses do not become a
 * second, drifting copy of that auth handling.
 *
 * Nothing is cached: these payloads are large and read once.
 *
 * @param accept the `Accept` header. Endpoints that negotiate on the file's own
 *   MIME type answer **406** unless the caller accepts that type, and the caller
 *   usually cannot know it ahead of time, so this accepts anything by default.
 */
export async function queryRaw({
  url,
  method = 'GET',
  body,
  noApiPrefix = false,
  instance,
  headers,
  token,
  accept = '*/*',
  redirectOnUnauthorized = true,
}: Omit<IReqraftQueryConfig, 'cache' | 'queryClient' | 'cacheKey' | 'staleTime'> & {
  accept?: string;
}): Promise<IReqraftRawResponse> {
  try {
    const response = await doFetchData(url, method, body, noApiPrefix, instance, {
      Accept: accept,
      ...(headers ?? {}),
    }, token);

    if (response.status === 401 && redirectOnUnauthorized && fetchConfig.unauthorizedRedirect) {
      window.location.replace(fetchConfig.unauthorizedRedirect(window.location));
    }

    if (!response.ok) {
      let error: string;
      try {
        // an error body is still JSON even when the success body is not
        error = (await response.json()).desc ?? response.statusText;
      } catch (_error) {
        error = response.statusText;
      }

      return { ok: false, code: response.status, error };
    }

    return {
      ok: true,
      code: response.status,
      blob: await response.blob(),
      mime: (response.headers.get('content-type') ?? '').split(';')[0].trim() || undefined,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
