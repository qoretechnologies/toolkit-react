import { useEffect, useState } from 'react';

/** The width below which a surface takes its phone presentation; reqore's own breakpoint. */
export const PHONE_VIEWPORT_QUERY = '(max-width: 480px)';

/**
 * Phone-sized viewport, from the media query itself rather than reqore's
 * `isMobile` property. That property is pinned to `false` under
 * `NODE_ENV=test`, which is what a story run (and so every Qlip capture)
 * executes under, so a phone branch keyed on it never renders in a capture
 * and the story that exists to show it shows the desktop layout instead.
 *
 * Starts `false` and settles after mount, so a server render and the first
 * paint agree; pass `enabled: false` to skip the subscription entirely.
 */
export const usePhoneViewport = (enabled = true): boolean => {
  const [phone, setPhone] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const query = window.matchMedia(PHONE_VIEWPORT_QUERY);
    const sync = () => setPhone(query.matches);

    sync();
    query.addEventListener('change', sync);

    return () => query.removeEventListener('change', sync);
  }, [enabled]);

  return phone;
};
