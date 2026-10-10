/**
 * The story network guard blocks, and names, every request a story makes that no mock answers (qorus#646).
 *
 * Unanswered, such a request went to the instance the stories were configured with: every story file fetched
 * the current user from the live Qorus, and reqraft's useStorage stories passed only while it answered.
 */
import { describe, expect, it, vi } from 'vitest';
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
