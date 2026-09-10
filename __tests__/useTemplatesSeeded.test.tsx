import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn(async () => ({ ok: true, data: {} }));
vi.mock('../src/utils/fetch', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  query: (...args: unknown[]) => query(...(args as [])),
}));

import { TemplatesCache, seedTemplatesCache, useTemplates } from '../src/hooks/useTemplates';

/**
 * A seeded context must cost nothing: no request, and no wait.
 *
 * The wait is the expensive half. `FormEngine` will not render a field before
 * its templates exist, so every mount that re-asks a question it has already
 * been handed the answer to holds a whole form as a placeholder — measured on
 * the live alert rule as 580ms of placeholder followed by 193 elements
 * dropping 67px when it cleared.
 */
describe('useTemplates with a seeded context', () => {
  beforeEach(() => {
    TemplatesCache.clear();
    query.mockClear();
  });

  it('reports ready immediately and issues no request', async () => {
    seedTemplatesCache('generic', { 'my-context': { some: 'value' } } as never);

    const { result } = renderHook(() => useTemplates(true, {}, 'generic'));

    // The point of the seed: ready on the FIRST render, not after a round trip.
    expect(result.current.loading).toBe(false);
    expect(result.current.value).toBeDefined();

    await waitFor(() => {
      expect(query).not.toHaveBeenCalled();
    });
  });

  it('still fetches a context it was NOT handed', async () => {
    // The control: without this the first test passes for a component that
    // never fetches anything at all.
    seedTemplatesCache('generic', { 'my-context': { some: 'value' } } as never);

    renderHook(() => useTemplates(true, {}, 'something-else'));

    await waitFor(() => {
      expect(query).toHaveBeenCalled();
    });
  });
});
