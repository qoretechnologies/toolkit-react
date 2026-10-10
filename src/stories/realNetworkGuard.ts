// Copyright 2026 Qore Technologies, s.r.o.
/**
 * No story reaches a real server (qorus#646).
 *
 * Stories are answered by mocks: storybook-addon-mock for HTTP, mock-socket for WebSockets. A request no mock
 * answers went out to whatever instance the story was configured with: reqraft's useStorage stories reached
 * the live Qorus for the current user, and passed only while it answered. Installed in the story test setup,
 * this blocks every such request (it fails at once, as a network error, and nothing leaves the page) and keeps
 * the list, which the setup fails the story with.
 *
 * What is blocked is a request to another origin than the page's own: the mocks answer before it would leave
 * (the addon calls the "real" fetch / XHR, wrapped here, only for what it has no entry for), and the test
 * runner's own traffic is to the page's origin. Stories that are meant to reach a real server are tagged
 * `!test` and never run under it.
 */

/** Where a request goes, if it leaves the page: its origin and path. */
export const outsideTarget = (url: string | URL, page: string): string | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(String(url), page);
  } catch {
    return undefined;
  }
  if (!/^(https?|wss?):$/.test(parsed.protocol)) {
    return undefined;
  }
  const own = new URL(page).origin;
  const asHttp = parsed.origin.replace(/^ws(s?):/, 'http$1:');
  return asHttp === own ? undefined : `${parsed.origin}${parsed.pathname}`;
};

/** Where a blocked request is sent instead: nothing listens there, so it fails at once, and nothing is reached. */
export const BLOCKED_HTTP_URL = 'http://127.0.0.1:9/blocked-by-the-story-network-guard';
export const BLOCKED_WS_URL = 'ws://127.0.0.1:9/blocked-by-the-story-network-guard';

export interface IGuardedWindow {
  location: { href: string };
  realFetch?: typeof fetch;
  realXMLHttpRequest?: typeof XMLHttpRequest;
  WebSocket?: typeof WebSocket;
  navigator?: { sendBeacon?: (url: string | URL, data?: BodyInit | null) => boolean };
}

/** Blocks and records every request of `win` that would leave its page. Returns the requests blocked so far. */
export const guardRealNetwork = (win: IGuardedWindow) => {
  const blocked: string[] = [];
  const check = (kind: string, url: string | URL) => {
    const target = outsideTarget(url, win.location.href);
    if (target) {
      blocked.push(`${kind} ${target}`);
    }
    return target;
  };

  const realFetch = win.realFetch;
  if (realFetch) {
    win.realFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' || input instanceof URL ? input : input.url;
      if (check('fetch', url)) {
        return Promise.reject(new TypeError(`Failed to fetch: ${String(url)} is not mocked`));
      }
      return realFetch(input, init);
    }) as typeof fetch;
  }

  const RealXhr = win.realXMLHttpRequest;
  if (RealXhr) {
    win.realXMLHttpRequest = class extends RealXhr {
      open(method: string, url: string | URL, ...rest: unknown[]) {
        const target = check('XHR', url);
        return (super.open as (...args: unknown[]) => void)(
          method,
          target ? BLOCKED_HTTP_URL : url,
          ...rest
        );
      }
    };
  }

  const RealWebSocket = win.WebSocket;
  if (RealWebSocket) {
    win.WebSocket = class extends RealWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(check('WebSocket', url) ? BLOCKED_WS_URL : url, protocols);
      }
    };
  }

  const sendBeacon = win.navigator?.sendBeacon?.bind(win.navigator);
  if (sendBeacon && win.navigator) {
    Object.defineProperty(win.navigator, 'sendBeacon', {
      configurable: true,
      value: (url: string | URL, data?: BodyInit | null) =>
        check('beacon', url) ? false : sendBeacon(url, data),
    });
  }

  return {
    /** The requests blocked since the last `take`, cleared. */
    take: () => blocked.splice(0),
  };
};
