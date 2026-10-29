// Copyright 2026 Qore Technologies, s.r.o.
import { ReactNode, useEffect, useRef } from 'react';
import { COARSE_POINTER_QUERY } from '../hooks/useCoarsePointer';

/**
 * Make the story believe its pointer is a finger: `matchMedia('(pointer: coarse)')` matches.
 *
 * `useCoarsePointer` asks the media query, and the test browser has a mouse; there is no Storybook or
 * Chromium setting a story can turn on for it, so the query is answered here. It is answered during render,
 * not in an effect, because the components below ask in their own effects, which run first. The real
 * `matchMedia` is put back when the story unmounts.
 */
export const CoarsePointer = ({ children }: { children: ReactNode }) => {
  const real = useRef<typeof window.matchMedia>();

  if (!real.current) {
    const matchMedia = window.matchMedia.bind(window);
    real.current = matchMedia;
    window.matchMedia = ((query: string) =>
      query === COARSE_POINTER_QUERY
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          } as MediaQueryList)
        : matchMedia(query)) as typeof window.matchMedia;
  }

  useEffect(
    () => () => {
      if (real.current) {
        window.matchMedia = real.current;
      }
    },
    []
  );

  return <>{children}</>;
};

export const withCoarsePointer = (Story: () => JSX.Element) => (
  <CoarsePointer>
    <Story />
  </CoarsePointer>
);
