import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReqraftQueryClient } from '../src/providers/ReqraftProvider';
import { query, seedQueryCache, setupFetch } from '../src/utils/fetch';

const URL = '/system/qorus-type-info';
const TYPES = [{ name: 'string' }, { name: 'int' }];

/**
 * Two caches over one API cannot see each other's in-flight requests, so a
 * resource both libraries want is fetched twice by construction — see the
 * comment on `query`. A host that has already fetched one settles it by seeding.
 *
 * Measured on the Qorus IDE, which warm-starts `/system/qorus-type-info` from
 * `index.html` because its whole boot gates on it: the same URL went out again
 * at 2777ms, when the first form mounted.
 */
describe('a resource the host has already fetched', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ReqraftQueryClient.clear();
    setupFetch({ instance: 'https://example.test/' });
    const makeResponse = (): any => {
      const body = [{ name: 'from-network' }];
      const response: any = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(body),
        json: async () => body,
      };
      response.clone = () => makeResponse();
      return response;
    };
    fetchSpy = vi.fn(async () => makeResponse());
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    ReqraftQueryClient.clear();
  });

  it('is served from the seed, with no request', async () => {
    seedQueryCache({ url: URL, data: TYPES });

    const response = await query<typeof TYPES>({ url: URL });

    expect(response.ok).toBe(true);
    expect(response.data).toEqual(TYPES);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('goes and asks when nothing was seeded', async () => {
    // The control. Without this the test above would pass for a `query` that
    // never fetches at all.
    const response = await query<typeof TYPES>({ url: URL });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(response.data).toEqual([{ name: 'from-network' }]);
  });

  it('seeds under the key the ordinary request would use', async () => {
    // A seed under a different key would be invisible, and the consumer would
    // fetch anyway — silently, which is how this defect survived.
    seedQueryCache({ url: URL, data: TYPES });
    await query({ url: URL });
    expect(fetchSpy).not.toHaveBeenCalled();

    // ...and a DIFFERENT url is unaffected: seeding is not a global mute.
    await query({ url: '/system/something-else' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
