import { vi } from 'vitest';
import type { IReqraftFetchContext } from '../../src/contexts/FetchContext';
import type { IReqraftFetchResponse } from '../../src/utils/fetch';

/**
 * A successful answer, shaped the way `query()` builds one — including the
 * `Response` it came from, which `useFetch` hands on to its callers.
 *
 * Tests used to hand-roll `{ ok: true, data }` and cast the context to `never`
 * or `any` to get past the contract; a mock that does not satisfy the contract
 * cannot tell a consumer that reads `response` from one that does not.
 */
export const okResponse = <T>(data: T): IReqraftFetchResponse<T> => ({
  data,
  ok: true,
  code: 200,
  response: new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }),
});

/**
 * A fetch context whose every method answers with an empty list, and records
 * its calls — the context a form renders against when no test cares what the
 * server says.
 */
export const emptyFetchContext = () => {
  const answer = () => vi.fn(async () => okResponse([] as never));
  return {
    get: answer(),
    post: answer(),
    put: answer(),
    del: answer(),
  } satisfies IReqraftFetchContext;
};
