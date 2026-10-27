// Copyright 2026 Qore Technologies, s.r.o.
import { useCallback, useEffect, useRef } from 'react';

/**
 * Whether the Tab whose key has just come up moved the focus into the element `rootOf` gives - its key went down
 * elsewhere - rather than going down in it: a Tab that took a completion, or moved the focus on from it. An editor
 * opens its list when Tab brings the focus in; opened for a Tab that went down in it, the list it had just taken a
 * completion from opened again, and its request for what the completion goes on to was dropped (qorus#646).
 *
 * Heard on the window, before a completion list hears the key on the document and keeps it from the page.
 */
export const useTabCameIn = (rootOf: () => HTMLElement | null | undefined) => {
  const wentDownHere = useRef(false);
  const root = useRef(rootOf);
  root.current = rootOf;
  useEffect(() => {
    const heard = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      let element: HTMLElement | null | undefined;
      try {
        element = root.current();
      } catch {
        // the element is not drawn: the Tab did not go down in it
      }
      wentDownHere.current = !!element && element.contains(document.activeElement);
    };
    window.addEventListener('keydown', heard, true);
    return () => window.removeEventListener('keydown', heard, true);
  }, []);
  // asked as the key comes up: whether it brought the focus in, which it did once only
  return useCallback(() => {
    const cameIn = !wentDownHere.current;
    wentDownHere.current = false;
    return cameIn;
  }, []);
};
