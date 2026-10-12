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
 *
 * A request is not only a fetch. An `<img>` whose `src` is a server's URL loads it too: the template fixtures'
 * app logo was a URL on the live hq instance, so a chip's logo came from the network or, once that URL was gone,
 * left an empty slot in every capture of it. So an element's own load - an image, a frame, a script, a
 * stylesheet, a medium - is blocked and named as a request is, and whatever else the page still loads from
 * another origin (a CSS `url()`, a font) is named from the browser's own record of what it loaded.
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
  /** Where an element's own load is set: its attributes, and the URL properties of the elements below. */
  Element?: typeof Element;
  HTMLImageElement?: typeof HTMLImageElement;
  HTMLSourceElement?: typeof HTMLSourceElement;
  HTMLIFrameElement?: typeof HTMLIFrameElement;
  HTMLScriptElement?: typeof HTMLScriptElement;
  HTMLLinkElement?: typeof HTMLLinkElement;
  HTMLMediaElement?: typeof HTMLMediaElement;
  HTMLEmbedElement?: typeof HTMLEmbedElement;
  HTMLObjectElement?: typeof HTMLObjectElement;
  /** The browser's record of what the page loaded, for a load no element above made. */
  PerformanceObserver?: typeof PerformanceObserver;
}

/**
 * The attributes through which an element loads something, by tag (lower case), and what such a load is
 * called. `srcset` holds a list of URLs.
 */
const LOADING_ATTRIBUTES: Record<string, { kind: string; attributes: string[] }> = {
  img: { kind: 'image', attributes: ['src', 'srcset'] },
  source: { kind: 'image', attributes: ['src', 'srcset'] },
  image: { kind: 'image', attributes: ['href', 'xlink:href'] },
  input: { kind: 'image', attributes: ['src'] },
  iframe: { kind: 'frame', attributes: ['src'] },
  frame: { kind: 'frame', attributes: ['src'] },
  script: { kind: 'script', attributes: ['src'] },
  link: { kind: 'stylesheet', attributes: ['href'] },
  video: { kind: 'medium', attributes: ['src', 'poster'] },
  audio: { kind: 'medium', attributes: ['src'] },
  track: { kind: 'medium', attributes: ['src'] },
  embed: { kind: 'embed', attributes: ['src'] },
  object: { kind: 'embed', attributes: ['data'] },
};

/** The URLs in an attribute's value: one, or a `srcset`'s list (`a.png 1x, b.png 2x`). */
const urlsIn = (attribute: string, value: string): string[] =>
  attribute === 'srcset' ?
    value
      .split(',')
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .filter(Boolean)
  : [value];

/** The URL properties of the element classes, each a setter over the attribute of the same name. */
const LOADING_PROPERTIES: Array<[keyof IGuardedWindow, string[]]> = [
  ['HTMLImageElement', ['src', 'srcset']],
  ['HTMLSourceElement', ['src', 'srcset']],
  ['HTMLIFrameElement', ['src']],
  ['HTMLScriptElement', ['src']],
  ['HTMLLinkElement', ['href']],
  ['HTMLMediaElement', ['src']],
  ['HTMLEmbedElement', ['src']],
  ['HTMLObjectElement', ['data']],
];

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

  /* An element's own load. Its URL is checked where it is set - `setAttribute`, which React uses, and the
     element's URL property, which `new Image()` and hand-written code use - and one that would leave the page
     is put nowhere instead. */
  const restore: Array<() => void> = [];
  const loadingKind = (element: Element, attribute: string): string | undefined => {
    const loads = LOADING_ATTRIBUTES[element.localName];
    return loads?.attributes.includes(attribute.toLowerCase()) ? loads.kind : undefined;
  };
  const guardedValue = (element: Element, attribute: string, value: unknown): unknown => {
    const kind = loadingKind(element, attribute);
    if (!kind || typeof value !== 'string') {
      return value;
    }
    const outside = urlsIn(attribute.toLowerCase(), value).filter((url) => check(kind, url));
    return outside.length ? BLOCKED_HTTP_URL : value;
  };

  const ElementClass = win.Element;
  if (ElementClass) {
    const setAttribute = ElementClass.prototype.setAttribute;
    ElementClass.prototype.setAttribute = function (this: Element, name: string, value: string) {
      return setAttribute.call(this, name, String(guardedValue(this, name, value)));
    };
    const setAttributeNS = ElementClass.prototype.setAttributeNS;
    ElementClass.prototype.setAttributeNS = function (
      this: Element,
      namespace: string | null,
      name: string,
      value: string
    ) {
      return setAttributeNS.call(this, namespace, name, String(guardedValue(this, name, value)));
    };
    restore.push(() => {
      ElementClass.prototype.setAttribute = setAttribute;
      ElementClass.prototype.setAttributeNS = setAttributeNS;
    });
  }

  for (const [className, properties] of LOADING_PROPERTIES) {
    const proto = (win[className] as { prototype?: object } | undefined)?.prototype;
    for (const property of proto ? properties : []) {
      const descriptor = Object.getOwnPropertyDescriptor(proto!, property);
      if (!descriptor?.set) {
        continue;
      }
      const set = descriptor.set;
      Object.defineProperty(proto!, property, {
        ...descriptor,
        set(this: Element, value: unknown) {
          set.call(this, guardedValue(this, property, value));
        },
      });
      restore.push(() => Object.defineProperty(proto!, property, descriptor));
    }
  }

  /* Whatever else the page loads from another origin - a stylesheet's `url()`, a font - from the browser's own
     record. Read at `take` (`takeRecords`), so what loaded during a story is named for that story. What the
     guard itself sent nowhere is already named. */
  const takeResources = (() => {
    const Observer = win.PerformanceObserver;
    if (!Observer || !Observer.supportedEntryTypes?.includes('resource')) {
      return () => undefined;
    }
    const pending: PerformanceEntry[] = [];
    const observer = new Observer((list) => pending.push(...list.getEntries()));
    observer.observe({ type: 'resource' });
    restore.push(() => observer.disconnect());
    return () => {
      for (const entry of [...pending.splice(0), ...observer.takeRecords()]) {
        if (!entry.name.startsWith(BLOCKED_HTTP_URL)) {
          check((entry as PerformanceResourceTiming).initiatorType || 'resource', entry.name);
        }
      }
    };
  })();

  return {
    /** The requests blocked, or made, since the last `take`, cleared. */
    take: () => {
      takeResources();
      return blocked.splice(0);
    },
    /** Put back everything the guard replaced (for a test of the guard itself). */
    release: () => restore.splice(0).forEach((undo) => undo()),
  };
};
