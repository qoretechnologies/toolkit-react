// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The server-status probe a reconnect makes, through the real `query` and `fetch`: at its limit
 * the request itself is aborted, so a REST endpoint that hangs neither holds the replacement of a
 * hung socket nor keeps one of the browser's connections to the instance busy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchConfig, query, setupFetch } from '../src/utils/fetch';
import {
  REQRAFT_WS_HANDSHAKE_TIMEOUT_MS,
  REQRAFT_WS_PROBE_TIMEOUT_MS,
  ReqraftWebSocket,
  ReqraftWebSocketsManager,
} from '../src/utils/websocket';
import { HangingWebSocket } from './fixtures/hangingWebSocket';

let nanoidCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: () => `probe-id-${++nanoidCounter}`,
}));

const INSTANCE = 'https://qorus.test:8092/';

/** A server that never answers REST: the request settles only when it is aborted, as fetch does. */
const hangingFetch = vi.fn(
  (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true }
      );
    })
);

const savedConfig = { ...fetchConfig };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', HangingWebSocket);
  vi.stubGlobal('fetch', hangingFetch);
  hangingFetch.mockClear();
  HangingWebSocket.reset();
  ReqraftWebSocketsManager.connections = {};
  setupFetch({ instance: INSTANCE, instanceToken: 'test-token' });
});

afterEach(() => {
  ReqraftWebSocketsManager.connections = {};
  Object.assign(fetchConfig, savedConfig);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the probe of a reconnect, against a server that hangs REST too', () => {
  it('aborts its request at the limit, and the replacement is dialed', async () => {
    const ws = new ReqraftWebSocket({ url: 'lsp', useHeartbeat: false });

    // The handshake hangs; at its deadline the reconnect asks REST first.
    await vi.advanceTimersByTimeAsync(REQRAFT_WS_HANDSHAKE_TIMEOUT_MS);
    expect(hangingFetch).toHaveBeenCalledOnce();
    const [url, init] = hangingFetch.mock.calls[0];
    expect(url).toBe(`${INSTANCE}api/latest/system/pid`);
    expect(init.signal.aborted).toBe(false);
    expect(HangingWebSocket.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(REQRAFT_WS_PROBE_TIMEOUT_MS - 1);
    expect(init.signal.aborted).toBe(false);
    expect(HangingWebSocket.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(init.signal.aborted).toBe(true);
    expect(HangingWebSocket.instances).toHaveLength(2);
    expect(HangingWebSocket.live()).toEqual([HangingWebSocket.instances[1]]);

    ws.remove();
  });

  it('aborts its request when the caller lets the connection go', async () => {
    const ws = new ReqraftWebSocket({ url: 'lsp', useHeartbeat: false });

    await vi.advanceTimersByTimeAsync(REQRAFT_WS_HANDSHAKE_TIMEOUT_MS);
    const [, init] = hangingFetch.mock.calls[0];

    ws.remove();
    expect(init.signal.aborted).toBe(true);

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(HangingWebSocket.instances).toHaveLength(1);
  });
});

describe('query() with a signal', () => {
  it('hands the signal to fetch, and answers an aborted request as one that failed', async () => {
    const controller = new AbortController();
    const answer = query({ url: 'system/pid', cache: false, signal: controller.signal });

    await vi.advanceTimersByTimeAsync(0);
    expect(hangingFetch).toHaveBeenCalledOnce();
    expect(hangingFetch.mock.calls[0][1].signal).toBe(controller.signal);

    controller.abort();

    await expect(answer).resolves.toMatchObject({ ok: false, code: 500 });
  });
});
