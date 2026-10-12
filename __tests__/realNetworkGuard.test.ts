/**
 * The story network guard blocks, and names, every request a story makes that no mock answers (qorus#646).
 *
 * Unanswered, such a request went to the instance the stories were configured with: every story file fetched
 * the current user from the live Qorus, and reqraft's useStorage stories passed only while it answered.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BLOCKED_HTTP_URL,
  BLOCKED_WS_URL,
  guardRealNetwork,
  outsideTarget,
} from '../src/stories/realNetworkGuard';

const PAGE = 'http://localhost:63315/__vitest_test__/';

describe('outsideTarget', () => {
  it('names a request to another origin, by origin and path', () => {
    expect(
      outsideTarget('https://hq.qoretechnologies.com:8092/api/latest/users?action=current', PAGE)
    ).toBe('https://hq.qoretechnologies.com:8092/api/latest/users');
    expect(outsideTarget('wss://hq.qoretechnologies.com:8092/lsp', PAGE)).toBe(
      'wss://hq.qoretechnologies.com:8092/lsp'
    );
  });

  it("leaves the page's own origin, relative URLs and other schemes alone", () => {
    expect(outsideTarget('http://localhost:63315/@fs/x.js', PAGE)).toBeUndefined();
    expect(outsideTarget('ws://localhost:63315/__vitest_browser_api__', PAGE)).toBeUndefined();
    expect(outsideTarget('/api/latest/users', PAGE)).toBeUndefined();
    expect(outsideTarget('data:,x', PAGE)).toBeUndefined();
    expect(outsideTarget('blob:http://localhost:63315/1', PAGE)).toBeUndefined();
  });
});

describe('guardRealNetwork', () => {
  const guarded = () => {
    const realFetch = vi.fn(async () => new Response('{}'));
    const opened: unknown[] = [];
    class FakeXhr {
      open(method: string, url: string | URL) {
        opened.push([method, String(url)]);
      }
    }
    const dialled: string[] = [];
    class FakeWebSocket {
      constructor(url: string | URL) {
        dialled.push(String(url));
      }
    }
    const sendBeacon = vi.fn((_url: string | URL, _data?: BodyInit | null) => true);
    const win = {
      location: { href: PAGE },
      realFetch: realFetch as unknown as typeof fetch,
      realXMLHttpRequest: FakeXhr as unknown as typeof XMLHttpRequest,
      WebSocket: FakeWebSocket as unknown as typeof WebSocket,
      navigator: { sendBeacon },
    };
    const network = guardRealNetwork(win);
    return { win, network, realFetch, opened, dialled, sendBeacon };
  };

  it('fails a fetch no mock answered, without sending it, and names it', async () => {
    const { win, network, realFetch } = guarded();
    await expect(
      win.realFetch!('https://hq.qoretechnologies.com:8092/api/latest/users?action=current')
    ).rejects.toThrow('is not mocked');
    expect(realFetch).not.toHaveBeenCalled();
    expect(network.take()).toEqual(['fetch https://hq.qoretechnologies.com:8092/api/latest/users']);
    // taken once
    expect(network.take()).toEqual([]);
  });

  it("lets the page's own requests through", async () => {
    const { win, network, realFetch } = guarded();
    await win.realFetch!('/__vitest_browser__/x.json');
    expect(realFetch).toHaveBeenCalledTimes(1);
    expect(network.take()).toEqual([]);
  });

  it('sends an XHR, a WebSocket and a beacon that leave the page nowhere, and names them', () => {
    const { win, network, opened, dialled, sendBeacon } = guarded();
    new win.realXMLHttpRequest!().open(
      'GET',
      'https://hq.qoretechnologies.com:8092/api/latest/system/pid'
    );
    new win.WebSocket!('wss://hq.qoretechnologies.com:8092/lsp');
    expect(win.navigator.sendBeacon('https://telemetry.example.com/v1', null)).toBe(false);
    expect(opened).toEqual([['GET', BLOCKED_HTTP_URL]]);
    expect(dialled).toEqual([BLOCKED_WS_URL]);
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(network.take()).toEqual([
      'XHR https://hq.qoretechnologies.com:8092/api/latest/system/pid',
      'WebSocket wss://hq.qoretechnologies.com:8092/lsp',
      'beacon https://telemetry.example.com/v1',
    ]);
  });
});

/**
 * An element's own load is a request too: the template fixtures' app logo was an `<img>` on the live hq
 * instance, which no mock could answer and the fetch guard never saw.
 */
describe('guardRealNetwork: what an element loads', () => {
  const PAGE_HERE = window.location.href;
  let release: (() => void) | undefined;

  afterEach(() => {
    release?.();
    release = undefined;
  });

  const guarded = (extra: Partial<Parameters<typeof guardRealNetwork>[0]> = {}) => {
    const network = guardRealNetwork({
      location: { href: PAGE_HERE },
      Element: window.Element,
      HTMLImageElement: window.HTMLImageElement,
      HTMLSourceElement: window.HTMLSourceElement,
      HTMLIFrameElement: window.HTMLIFrameElement,
      HTMLScriptElement: window.HTMLScriptElement,
      HTMLLinkElement: window.HTMLLinkElement,
      HTMLMediaElement: window.HTMLMediaElement,
      HTMLEmbedElement: window.HTMLEmbedElement,
      HTMLObjectElement: window.HTMLObjectElement,
      ...extra,
    });
    release = network.release;
    return network;
  };

  const LOGO = 'https://hq.qoretechnologies.com:8092/api/public/apps/Qorus/logo';

  it('puts an image another origin serves nowhere, set as an attribute or as a property, and names it', () => {
    const network = guarded();
    const byAttribute = document.createElement('img');
    byAttribute.setAttribute('src', LOGO);
    const byProperty = new Image();
    byProperty.src = `${LOGO}?v=2`;
    expect(byAttribute.getAttribute('src')).toBe(BLOCKED_HTTP_URL);
    expect(byProperty.getAttribute('src')).toBe(BLOCKED_HTTP_URL);
    expect(network.take()).toEqual([`image ${LOGO}`, `image ${LOGO}`]);
  });

  it("puts a srcset nowhere when any of its images is another origin's", () => {
    const network = guarded();
    const source = document.createElement('source');
    source.setAttribute('srcset', `/own.png 1x, ${LOGO} 2x`);
    expect(source.getAttribute('srcset')).toBe(BLOCKED_HTTP_URL);
    expect(network.take()).toEqual([`image ${LOGO}`]);
  });

  it('names a frame, a script and a stylesheet another origin serves', () => {
    const network = guarded();
    document.createElement('iframe').src = 'https://example.com/embed';
    document.createElement('script').setAttribute('src', 'https://cdn.example.com/lib.js');
    document.createElement('link').href = 'https://fonts.example.com/face.css';
    expect(network.take()).toEqual([
      'frame https://example.com/embed',
      'script https://cdn.example.com/lib.js',
      'stylesheet https://fonts.example.com/face.css',
    ]);
  });

  it("leaves the page's own images, data and other attributes alone", () => {
    const network = guarded();
    const img = document.createElement('img');
    img.setAttribute('src', '/assets/qorusAppLogo.svg');
    img.setAttribute('alt', LOGO);
    const inline = new Image();
    inline.src = 'data:image/svg+xml,%3Csvg/%3E';
    const link = document.createElement('a');
    link.setAttribute('href', 'https://example.com/runbook');
    expect(img.getAttribute('src')).toBe('/assets/qorusAppLogo.svg');
    expect(img.getAttribute('alt')).toBe(LOGO);
    expect(inline.getAttribute('src')).toBe('data:image/svg+xml,%3Csvg/%3E');
    expect(link.getAttribute('href')).toBe('https://example.com/runbook');
    expect(network.take()).toEqual([]);
  });

  it('names what else the page loaded from another origin, from the browser\'s record, once', () => {
    const entries = [
      { name: 'https://fonts.example.com/face.woff2', initiatorType: 'css' },
      { name: `${BLOCKED_HTTP_URL}?x`, initiatorType: 'xmlhttprequest' },
      { name: new URL('/own.css', PAGE_HERE).href, initiatorType: 'link' },
    ];
    class FakeObserver {
      static supportedEntryTypes = ['resource'];
      observe = vi.fn();
      disconnect = vi.fn();
      takeRecords = () => entries.splice(0) as unknown as PerformanceEntryList;
      constructor(_callback: PerformanceObserverCallback) {}
    }
    const network = guarded({ PerformanceObserver: FakeObserver as unknown as typeof PerformanceObserver });
    expect(network.take()).toEqual(['css https://fonts.example.com/face.woff2']);
    expect(network.take()).toEqual([]);
  });

  it('puts back everything it replaced when released', () => {
    const network = guarded();
    network.release();
    release = undefined;
    const img = document.createElement('img');
    img.setAttribute('src', LOGO);
    expect(img.getAttribute('src')).toBe(LOGO);
    expect(network.take()).toEqual([]);
  });
});
