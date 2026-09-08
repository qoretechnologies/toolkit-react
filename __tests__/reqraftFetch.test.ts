/**
 * Unit tests for src/utils/fetch.ts — the single request mechanism.
 *
 * Regression coverage for a measured duplicate-request bug: loading the Qorus
 * IDE's test creator issued `api/latest/system/qorus-type-info` AND
 * `api/latest//system/qorus-type-info` (note the empty path segment) for one
 * resource, because the cache was keyed on the url as written and two call
 * sites spelled the same path differently. The same page fetched
 * `dataprovider/arg_schemas/test-cases` twice in the same millisecond for the
 * same reason.
 *
 * The point of these tests is that ONE resource is ONE cache entry and ONE
 * in-flight request regardless of spelling, instance or caller.
 */
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchConfig,
  query,
  reqraftApiPath,
  reqraftCacheKey,
  setupFetch,
} from '../src/utils/fetch';

/** A QueryClient per test: a shared cache would leak entries between cases. */
const freshClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('reqraftApiPath', () => {
  it('strips the leading slash the api prefix already carries', () => {
    expect(reqraftApiPath('/system/qorus-type-info')).toBe('system/qorus-type-info');
  });

  it('strips repeated leading slashes', () => {
    expect(reqraftApiPath('///users')).toBe('users');
  });

  it('leaves a path without a leading slash alone', () => {
    expect(reqraftApiPath('system/qorus-type-info')).toBe('system/qorus-type-info');
  });

  it('leaves interior slashes alone', () => {
    expect(reqraftApiPath('/dataprovider/arg_schemas/test-cases')).toBe(
      'dataprovider/arg_schemas/test-cases'
    );
  });

  it('does NOT strip when the caller owns the whole url', () => {
    // `noApiPrefix` means the caller passed an absolute path to some other
    // service; its leading slash is part of the address, not our prefix.
    expect(reqraftApiPath('/other/service', true)).toBe('/other/service');
  });
});

describe('reqraftCacheKey', () => {
  it('gives both spellings of one path the SAME key', () => {
    // The measured bug: these were two entries and two requests.
    expect(reqraftCacheKey({ url: '/system/qorus-type-info' })).toBe(
      reqraftCacheKey({ url: 'system/qorus-type-info' })
    );
  });

  it('separates different paths', () => {
    expect(reqraftCacheKey({ url: 'tests/assertions' })).not.toBe(
      reqraftCacheKey({ url: 'tests/step-kinds' })
    );
  });

  it('separates methods', () => {
    expect(reqraftCacheKey({ url: 'users', method: 'GET' })).not.toBe(
      reqraftCacheKey({ url: 'users', method: 'PUT' })
    );
  });

  it('separates different bodies', () => {
    expect(reqraftCacheKey({ url: 'exec', method: 'POST', body: { a: 1 } })).not.toBe(
      reqraftCacheKey({ url: 'exec', method: 'POST', body: { a: 2 } })
    );
  });

  it('treats a missing body and an empty body as the same request', () => {
    expect(reqraftCacheKey({ url: 'users' })).toBe(reqraftCacheKey({ url: 'users', body: {} }));
  });

  it('separates the same path on a DIFFERENT instance', () => {
    // Two servers are two resources that happen to share a path.
    expect(reqraftCacheKey({ url: 'users', instance: 'https://other:8011/' })).not.toBe(
      reqraftCacheKey({ url: 'users' })
    );
  });

  it('does not separate an instance override that equals the configured one', () => {
    expect(reqraftCacheKey({ url: 'users', instance: fetchConfig.instance })).toBe(
      reqraftCacheKey({ url: 'users' })
    );
  });

  it('separates two different explicit tokens', () => {
    // Different identities must not read each other's cached response.
    expect(reqraftCacheKey({ url: 'users', token: 'aaa' })).not.toBe(
      reqraftCacheKey({ url: 'users', token: 'bbb' })
    );
  });

  it('gives the same token the same key', () => {
    expect(reqraftCacheKey({ url: 'users', token: 'aaa' })).toBe(
      reqraftCacheKey({ url: 'users', token: 'aaa' })
    );
  });

  it('does not put the token itself in the key', () => {
    const secret = 'super-secret-bearer-token';
    expect(reqraftCacheKey({ url: 'users', token: secret })).not.toContain(secret);
  });

  it('separates a tokened call from an untokened one', () => {
    expect(reqraftCacheKey({ url: 'users', token: 'aaa' })).not.toBe(
      reqraftCacheKey({ url: 'users' })
    );
  });
});

describe('query', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setupFetch({ instance: 'https://instance:8011/' });
    fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('builds the url from the instance and the api prefix', async () => {
    await query({ url: 'users', queryClient: freshClient() });
    expect(fetchMock.mock.calls[0][0]).toBe('https://instance:8011/api/latest/users');
  });

  it('does NOT emit an empty path segment for a leading-slash caller', async () => {
    // `api/latest//system/...` is what the duplicate looked like on the wire.
    await query({ url: '/system/qorus-type-info', queryClient: freshClient() });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://instance:8011/api/latest/system/qorus-type-info'
    );
  });

  it('uses an absolute url verbatim when the caller owns the whole address', async () => {
    // Prepending the instance here built `https://instance:8011/https://other/…`,
    // which is what `useExpressions` asks for whenever `expressionsUrl` is
    // absolute.
    await query({
      url: 'https://other.example:8092/api/latest/expressions',
      noApiPrefix: true,
      queryClient: freshClient(),
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://other.example:8092/api/latest/expressions');
  });

  it('keeps a root-relative url intact when the caller owns the address', async () => {
    await query({ url: '/absolute/path/one', noApiPrefix: true, queryClient: freshClient() });
    expect(fetchMock.mock.calls[0][0]).toBe('/absolute/path/one');
  });

  it('makes ONE request for two concurrent callers spelling the path differently', async () => {
    const queryClient = freshClient();
    await Promise.all([
      query({ url: '/dataprovider/arg_schemas/test-cases', queryClient }),
      query({ url: 'dataprovider/arg_schemas/test-cases', queryClient }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('makes ONE request for a second caller after the first resolved', async () => {
    const queryClient = freshClient();
    await query({ url: '/system/qorus-type-info', queryClient });
    await query({ url: 'system/qorus-type-info', queryClient });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('makes TWO requests for genuinely different paths', async () => {
    const queryClient = freshClient();
    await Promise.all([
      query({ url: 'tests/step-kinds', queryClient }),
      query({ url: 'tests/assertions', queryClient }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refetches when the caller opts out of the cache', async () => {
    const queryClient = freshClient();
    await query({ url: 'users', queryClient, cache: false });
    await query({ url: 'users', queryClient, cache: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still shares ONE in-flight request when the cache is off', async () => {
    const queryClient = freshClient();
    await Promise.all([
      query({ url: 'users', queryClient, cache: false }),
      query({ url: '/users', queryClient, cache: false }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a response for the life of the page when staleTime is Infinity', async () => {
    const queryClient = freshClient();
    await query({ url: 'tests/step-kinds', queryClient, staleTime: Infinity });
    await query({ url: 'tests/step-kinds', queryClient, staleTime: Infinity });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the configured instance token as a bearer', async () => {
    setupFetch({ instance: 'https://instance:8011/', instanceToken: 'session-token' });
    await query({ url: 'users', queryClient: freshClient() });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');
  });

  it('omits the instance token when rbac is disabled', async () => {
    setupFetch({
      instance: 'https://instance:8011/',
      instanceToken: 'session-token',
      instanceRbacDisabled: true,
    });
    await query({ url: 'users', queryClient: freshClient() });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('prefers an explicit per-call token over the instance token', async () => {
    setupFetch({ instance: 'https://instance:8011/', instanceToken: 'session-token' });
    await query({ url: 'qog-templates', queryClient: freshClient(), token: 'other-token' });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer other-token');
  });

  it('merges custom headers over the default content type', async () => {
    await query({
      url: 'users',
      queryClient: freshClient(),
      headers: { Accept: 'text/csv', 'Content-Type': 'text/plain' },
    });
    const { headers } = fetchMock.mock.calls[0][1];
    expect(headers.Accept).toBe('text/csv');
    expect(headers['Content-Type']).toBe('text/plain');
  });

  it('does not share a cache entry between two different explicit tokens', async () => {
    const queryClient = freshClient();
    await query({ url: 'users', queryClient, token: 'aaa' });
    await query({ url: 'users', queryClient, token: 'bbb' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('groups requests under an explicit cacheKey', async () => {
    const queryClient = freshClient();
    await Promise.all([
      query({ url: 'tests/step-kinds', queryClient, cacheKey: 'shared' }),
      query({ url: 'tests/assertions', queryClient, cacheKey: 'shared' }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a JSON error body so the caller gets the sentence, not the reason phrase', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ err: 'REST-ARG-ERROR', desc: 'Unknown option(s) provided: foo' }, 400)
    );
    const result = await query<any>({ url: 'tests/step-kinds', queryClient: freshClient() });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(400);
    expect(result.errorBody?.err).toBe('REST-ARG-ERROR');
    expect(result.errorBody?.desc).toBe('Unknown option(s) provided: foo');
  });

  it('keeps the raw text of a non-JSON error instead of flattening it', async () => {
    fetchMock.mockResolvedValue(
      new Response('upstream exploded', { status: 500, statusText: 'Server Error' })
    );
    const result = await query<any>({ url: 'users', queryClient: freshClient() });
    expect(result.ok).toBe(false);
    expect(result.rawText).toBe('upstream exploded');
    // `{}` masquerading as a parsed error would tell the caller nothing.
    expect(result.errorBody).toBeUndefined();
  });

  it('keeps data as an empty object for a body that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    const result = await query<any>({ url: 'users', queryClient: freshClient() });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({});
  });

  it('leaves the response body unread for the caller', async () => {
    // `readBody` clones; a caller reading `.json()` off the response must still
    // work, which is what any raw/streaming consumer relies on.
    const result = await query<any>({ url: 'users', queryClient: freshClient() });
    expect(result.response.bodyUsed).toBe(false);
    await expect(result.response.json()).resolves.toEqual({ ok: true });
  });

  it('does not navigate on a 401 when the caller owns its auth policy', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { pathname: '/ide', replace });
    fetchMock.mockResolvedValue(jsonResponse({ desc: 'nope' }, 401));

    await query({
      url: 'support/tickets',
      queryClient: freshClient(),
      redirectOnUnauthorized: false,
    });

    expect(replace).not.toHaveBeenCalled();
  });

  it('navigates on a 401 by default', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { pathname: '/ide', replace });
    setupFetch({
      instance: 'https://instance:8011/',
      unauthorizedRedirect: (location) => `/expired?next=${location.pathname}`,
    });
    fetchMock.mockResolvedValue(jsonResponse({ desc: 'nope' }, 401));

    await query({ url: 'users', queryClient: freshClient() });

    expect(replace).toHaveBeenCalledWith('/expired?next=/ide');
  });

  it('does not cache a failed response', async () => {
    const queryClient = freshClient();
    fetchMock.mockResolvedValueOnce(jsonResponse({ desc: 'nope' }, 500));
    await query({ url: 'users', queryClient });
    await query({ url: 'users', queryClient });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
