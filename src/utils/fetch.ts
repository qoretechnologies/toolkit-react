export interface IReqraftFetchConfig {
  instance: string;
  instanceToken: string;
  unauthorizedRedirect?: string;
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
  unauthorizedRedirect: '/?next=',
};

const CACHE_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes

const fetchCache: {
  [key: string]: {
    actualCall: Promise<any>;
    data: any;
    timestamp: number;
  };
} = {};

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

export const invalidateCache = (key: string) => {
  delete fetchCache[key];
};

const doFetchData = async (url: string, method = 'GET', body?: { [key: string]: any }) => {
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
};

export async function query<T>(
  url: string,
  method = 'GET',
  body?: Record<string | number, any>,
  forceCache = true
): Promise<IReqraftFetchResponse<T>> {
  const cache = method === 'DELETE' || method === 'POST' ? false : forceCache;
  const cacheKey = `${url}:${method}:${JSON.stringify(body || {})}`;

  if (fetchCache[cacheKey]?.data) {
    if (Date.now() - fetchCache[cacheKey].timestamp < CACHE_EXPIRATION_TIME) {
      return {
        data: fetchCache[cacheKey].data,
        ok: true,
      };
    }

    delete fetchCache[cacheKey];
  }

  if (!fetchCache[cacheKey]?.actualCall || !cache) {
    const fetchCall = doFetchData(url, method, body);

    if (cache) {
      fetchCache[cacheKey] = { actualCall: null, data: null, timestamp: Date.now() };
      fetchCache[cacheKey].actualCall = fetchCall;
    }

    const requestData = await fetchCall;

    if (requestData.status === 401) {
      window.location.href = '/?next=' + window.location.pathname;
    }

    if (!requestData.ok) {
      delete fetchCache[cacheKey];

      return {
        data: null,
        ok: false,
        code: requestData.status,
        error: requestData.statusText,
      };
    }

    const json = await requestData.json();

    if (cache) {
      fetchCache[cacheKey].data = json;
    }

    return {
      data: json,
      ok: requestData.ok,
      code: requestData.status,
      error: !requestData.ok ? json : undefined,
    };
  } else {
    // We need to wait for the call to finish and the data to be available
    while (!fetchCache[cacheKey]?.data) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      data: fetchCache[cacheKey].data,
      ok: true,
    };
  }
}
