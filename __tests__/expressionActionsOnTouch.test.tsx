// Copyright 2026 Qore Technologies, s.r.o.
/**
 * With a mouse, an expression's actions (Wrap, Remove) float above its panel while it is hovered. A finger
 * cannot hover: a tap left them floating over what is above - an expression field's Visual / Text switch -
 * so a tap meant for Text could remove the expression. The builder keeps them in the panel when the
 * pointer is coarse, which `useCoarsePointer` tells; the builder in a touch story is qorus-ide's
 * `RowRuleBuiltVisuallyOnATouchDevice`.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COARSE_POINTER_QUERY, useCoarsePointer } from '../src/hooks/useCoarsePointer';

/** A pointer whose kind can change, as a tablet's does when a mouse is attached. */
const pointer = (coarse: boolean) => {
  const listeners = new Set<() => void>();
  const query = {
    matches: coarse,
    media: COARSE_POINTER_QUERY,
    addEventListener: (_e: string, l: () => void) => listeners.add(l),
    removeEventListener: (_e: string, l: () => void) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', (q: string) =>
    q === COARSE_POINTER_QUERY ? query : { matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }
  );
  return {
    set: (next: boolean) => {
      query.matches = next;
      listeners.forEach((l) => l());
    },
    listeners,
  };
};

describe('useCoarsePointer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false with a mouse', () => {
    pointer(false);
    expect(renderHook(() => useCoarsePointer()).result.current).toBe(false);
  });

  it('is true with a finger', () => {
    pointer(true);
    expect(renderHook(() => useCoarsePointer()).result.current).toBe(true);
  });

  it('follows the pointer when it changes, and stops listening when it goes', () => {
    const p = pointer(false);
    const { result, unmount } = renderHook(() => useCoarsePointer());
    act(() => p.set(true));
    expect(result.current).toBe(true);
    unmount();
    expect(p.listeners.size).toBe(0);
  });
});
