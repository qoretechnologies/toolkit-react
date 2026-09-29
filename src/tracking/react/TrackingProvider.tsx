import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode, type MutableRefObject } from 'react';
import type { IAttached } from '../browser/attach';
import type { Tracker } from '../core/tracker';

interface ITrackingContext {
  tracker: Tracker | null;
  /** The page wiring; set before any child's passive effect runs. */
  attached: MutableRefObject<IAttached | null>;
}

const TrackingContext = createContext<ITrackingContext>({ tracker: null, attached: { current: null } });

export interface ITrackingProviderProps {
  tracker: Tracker | null;
  /** Attaches the tracker to the page (listeners, observers); omitted in stories and tests. */
  attach?: () => IAttached;
  /** The current route (`pathname + search`): each change is a new page view. */
  location: string;
  children: ReactNode;
}

/**
 * Mount once, at the app shell. Without a provider (or with `tracker={null}`)
 * everything still renders: consent reads `unknown`, experiments serve the control.
 */
export const TrackingProvider = ({ tracker, attach, location, children }: ITrackingProviderProps) => {
  const attached = useRef<IAttached | null>(null);

  // Layout effects: every layout effect runs before any passive effect, so the
  // tracker is attached and started before a child's `useExperiment` effect.
  useLayoutEffect(() => {
    if (!tracker) return undefined;
    try {
      attached.current = attach?.() ?? null;
      tracker.start();
    } catch {
      /* never into the page */
    }
    return () => {
      attached.current?.detach();
      attached.current = null;
    };
  }, [tracker, attach]);

  useLayoutEffect(() => {
    tracker?.pageview();
  }, [tracker, location]);

  const value = useMemo(() => ({ tracker, attached }), [tracker]);
  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
};

export const useTrackingContext = () => useContext(TrackingContext);

/** The tracker, or null outside a provider. Call `goal`, `custom`, `record` on it. */
export const useTracker = () => useContext(TrackingContext).tracker;
