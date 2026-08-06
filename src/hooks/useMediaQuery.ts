import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * Exists because some affordances cannot be expressed in CSS alone: a
 * hover-gated control has to MOVE into an overflow menu on a device that has no
 * hover, and moving a node is a React decision, not a stylesheet one.
 *
 * SSR/JSDOM-safe: environments without `matchMedia` report `false` rather than
 * throwing, so a server render (or a unit test) behaves as if the query does not
 * match instead of crashing.
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    // Re-read on subscribe: the query can have changed between the initial
    // render and this effect (a resize during hydration).
    setMatches(list.matches);

    // Safari <14 only has the deprecated add/removeListener pair.
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    }

    list.addListener(onChange);
    return () => list.removeListener(onChange);
  }, [query]);

  return matches;
};

/** A pointer that can hover (a mouse), as opposed to touch. */
export const HOVER_CAPABLE_QUERY = '(hover: hover) and (pointer: fine)';

/** Viewport narrow enough that per-row action buttons stop fitting. */
export const NARROW_VIEWPORT_QUERY = '(max-width: 768px)';

/**
 * Whether hover-revealed affordances are usable here. `false` on touch, where
 * :hover never fires and a hover-gated control would be unreachable.
 */
export const useCanHover = (): boolean => useMediaQuery(HOVER_CAPABLE_QUERY);

/** Whether the viewport is narrow enough to collapse per-row actions. */
export const useIsNarrowViewport = (): boolean => useMediaQuery(NARROW_VIEWPORT_QUERY);
