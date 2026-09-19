import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * An answer that is not a list must leave the catalogue empty.
 *
 * `GET system?action=expressions` shares its path with the instance-info call
 * (`GET system`), so a proxy, a story mock or a stale cache entry can hand this
 * hook the instance hash instead of the catalogue. The extras were guarded and
 * the base was not, so `mergeExpressions` called `.find` on a hash and the
 * TypeError took down every form under it — and, because the answer is cached
 * for the page, later forms as well.
 */
const fetched: Record<string, unknown> = { data: undefined };

vi.mock('../src/hooks/useFetch/useFetch', () => ({
  useFetch: () => ({
    data: fetched.data,
    loading: false,
    error: undefined,
    load: vi.fn(),
  }),
}));

import { useExpressions } from '../src/components/form/expressions/useExpressions';

describe('the expression catalogue', () => {
  it('is empty when the answer is an object rather than a list', () => {
    fetched.data = { 'instance-key': 'hq', supports_ai: true };

    const { result } = renderHook(() => useExpressions());

    expect(result.current.expressions).toEqual([]);
  });

  it('still reads a list, and a list wrapped in `data`', () => {
    const catalogue = [{ name: 'equals', display_name: 'Equals' }];

    fetched.data = catalogue;
    expect(renderHook(() => useExpressions()).result.current.expressions).toEqual(catalogue);

    fetched.data = { data: catalogue };
    expect(renderHook(() => useExpressions()).result.current.expressions).toEqual(catalogue);
  });
});
