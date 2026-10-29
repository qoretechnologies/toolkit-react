// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What the users of `ReqraftWebSocket` see when a handshake hangs, through the real socket
 * layer: `useReqraftWebSocket`, and the language-server client the DPQL and smart editors use.
 * Before the handshake deadline, a hang called none of their callbacks: the hook said nothing
 * and the client's `connect()` waited for good.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReqraftWebSocket } from '../src/hooks/useWebSocket/useWebSocket';
import { ReqraftLspClient, _resetSharedLspConnectionsForTests } from '../src/utils/lspClient';
import {
  REQRAFT_WS_HANDSHAKE_TIMEOUT_MS,
  ReqraftWebSocketsManager,
} from '../src/utils/websocket';
import { HangingWebSocket } from './fixtures/hangingWebSocket';

let nanoidCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: () => `consumer-id-${++nanoidCounter}`,
}));

vi.mock('../src/utils/fetch', () => ({
  fetchConfig: {
    instance: 'http://localhost:8092/',
    instanceToken: 'test-token',
  },
  query: vi.fn().mockResolvedValue({ ok: true }),
}));

const DEADLINE = REQRAFT_WS_HANDSHAKE_TIMEOUT_MS;
const INTERVAL = ReqraftWebSocketsManager.defaultConfig.reconnectInterval;

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', HangingWebSocket);
  HangingWebSocket.reset();
  ReqraftWebSocketsManager.connections = {};
});

afterEach(() => {
  _resetSharedLspConnectionsForTests();
  ReqraftWebSocketsManager.connections = {};
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useReqraftWebSocket when the handshake hangs', () => {
  const options = {
    url: 'log-test',
    openOnMount: true,
    closeOnUnmount: true,
    reconnect: true,
    useHeartbeat: false,
    useState: true,
    includeLogMessagesInState: true,
  };
  const log = (result: { current: ReturnType<typeof useReqraftWebSocket> }) =>
    result.current.messages.map(({ message }) => message);

  it('says it is reconnecting at the deadline, and is open once the replacement opens', async () => {
    const { result, unmount } = renderHook(() => useReqraftWebSocket(options));

    await advance(DEADLINE - 1);
    expect(log(result)).toEqual([]);

    await advance(1);
    expect(result.current.status).toBe('CONNECTING');
    // What a failed handshake tells it: an error, a close, then the first attempt.
    expect(log(result)).toEqual([
      'Connection error',
      'Connection closed',
      'Reconnecting... Attempt 1',
    ]);

    await act(async () => {
      HangingWebSocket.latest().open();
    });
    expect(result.current.status).toBe('OPEN');
    expect(log(result)).toContain('Connection opened');

    unmount();
  });

  it('says the reconnect failed when every attempt hangs', async () => {
    const { result, unmount } = renderHook(() =>
      useReqraftWebSocket({ ...options, maxReconnectTries: 2 })
    );

    // The first socket, and two attempts: the first at once, the second after the interval.
    await advance(DEADLINE);
    await advance(DEADLINE);
    await advance(INTERVAL);
    expect(log(result)).not.toContain('Reconnect failed');

    await advance(DEADLINE);
    expect(result.current.status).toBe('CLOSED');
    expect(log(result)[log(result).length - 1]).toBe('Reconnect failed');
    expect(HangingWebSocket.instances).toHaveLength(3);
    expect(HangingWebSocket.live()).toHaveLength(0);

    unmount();
  });

  it('leaves no socket or timer behind when it unmounts during the hang', async () => {
    const { unmount } = renderHook(() => useReqraftWebSocket(options));

    await advance(DEADLINE / 2);
    unmount();
    await advance(10 * 60_000);

    expect(HangingWebSocket.instances).toHaveLength(1);
    expect(HangingWebSocket.live()).toHaveLength(0);
    expect(ReqraftWebSocketsManager.connections).toEqual({});
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('ReqraftLspClient when its first handshake hangs', () => {
  /** Answers `initialize` as the Qorus `/lsp` handler does. */
  const lspServer = (frame: string) => {
    if (frame === 'ping') {
      return 'pong';
    }

    const message = JSON.parse(frame);

    if (message.method === 'initialize') {
      return JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { capabilities: {} } });
    }

    return undefined;
  };

  it('connects on the replacement, without waiting for the browser to give up', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://handshake/hangs' });
    let connected = false;
    client.connect().then(() => (connected = true));

    await advance(DEADLINE);
    expect(connected).toBe(false);
    expect(HangingWebSocket.instances).toHaveLength(2);

    const replacement = HangingWebSocket.latest();
    replacement.respond = lspServer;
    await act(async () => {
      replacement.open();
    });
    await advance(0);

    expect(connected).toBe(true);
    expect(client.isConnected).toBe(true);
    expect(HangingWebSocket.live()).toEqual([replacement]);

    client.disconnect();
  });

  it('leaves no socket or timer behind when its last client goes during the hang', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://handshake/goes' });
    client.connect().catch(() => undefined);

    await advance(DEADLINE / 2);
    client.disconnect();
    await advance(10 * 60_000);

    expect(HangingWebSocket.instances).toHaveLength(1);
    expect(HangingWebSocket.live()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no socket or timer behind when its last client goes while the replacement waits', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://handshake/waits' });
    client.connect().catch(() => undefined);

    // The first replacement hangs too; the next one waits its interval.
    await advance(DEADLINE);
    await advance(DEADLINE);
    expect(HangingWebSocket.instances).toHaveLength(2);

    client.disconnect();
    await advance(10 * 60_000);

    expect(HangingWebSocket.instances).toHaveLength(2);
    expect(HangingWebSocket.live()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
