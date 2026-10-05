// Copyright 2026 Qore Technologies, s.r.o.
import { useEffect, useState } from 'react';

/** The pointer a finger is: it cannot hover. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/**
 * Whether the primary pointer is coarse (a finger), from the media query itself.
 *
 * Starts `false` and settles after mount, so a server render and the first paint agree.
 */
export const useCoarsePointer = (): boolean => {
  const [coarse, setCoarse] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const query = window.matchMedia(COARSE_POINTER_QUERY);
    const sync = () => setCoarse(query.matches);

    sync();
    query.addEventListener?.('change', sync);

    return () => query.removeEventListener?.('change', sync);
  }, []);

  return coarse;
};
