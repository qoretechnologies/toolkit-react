import type { ITransport } from '../core/queue';
import { safeStorage } from '../core/storage';
import type { IPageInfo, ITrackerEnv } from '../core/tracker';

/**
 * Sends a batch. `beacon` (page going away): `navigator.sendBeacon`, falling back
 * to `fetch(…, { keepalive: true })` when the beacon is refused (too big, or the
 * browser has none). Any HTTP answer counts as delivered — the collector always
 * answers 204, and a 404 (collector not installed) must not turn into a retry loop;
 * only a network error keeps the batch for the next flush.
 */
export const browserTransport = (endpoint: string): ITransport => ({
  async send(body, mode) {
    if (mode === 'beacon' && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        if (navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))) return true;
      } catch {
        /* fall through to fetch */
      }
    }
    try {
      await fetch(endpoint, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        // Batches stay under 60 KB (queue.ts), inside keepalive's 64 KB budget.
        keepalive: true,
        credentials: 'same-origin',
      });
      return true;
    } catch {
      return false;
    }
  },
});

const fetchJson = async (url: string, timeoutMs: number): Promise<unknown> => {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl?.signal, credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

/** desktop / tablet / mobile from the user agent (targeting only; the server classifies for reports). */
export const deviceOf = (ua: string): IPageInfo['device'] => {
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
  return 'desktop';
};

const readPage = (): IPageInfo => ({
  origin: window.location.origin,
  path: window.location.pathname,
  search: window.location.search,
  title: document.title,
  referrer: document.referrer,
  lang: navigator.language || 'en',
  viewport: [window.innerWidth, window.innerHeight],
  device: deviceOf(navigator.userAgent || ''),
});

export const browserEnv = (endpoint: string): ITrackerEnv => ({
  local: safeStorage(() => window.localStorage),
  session: safeStorage(() => window.sessionStorage),
  transport: browserTransport(endpoint),
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  page: readPage,
  fetchJson,
  // eslint-disable-next-line no-console
  log: (...args) => console.info(...args),
});
