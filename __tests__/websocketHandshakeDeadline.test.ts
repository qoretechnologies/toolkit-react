// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A handshake can hang: the server takes the connection and never answers the upgrade. The
 * socket then sends no event at all until Chromium gives up on it, about four minutes later, and
 * `ReqraftWebSocket` used to replace a socket only after a close, so a hung language-server or
 * DPQL socket stayed hung. As Chromium runs one handshake per host and port at a time, it also
 * kept every other socket to the instance from connecting.
 *
 * These sockets never open unless a test opens them. The server-status probe a reconnect makes
 * is `query`, mocked here; a probe that goes through the real `query` and `fetch` is in
 * websocketProbeAbort.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IReqraftWebSocketConfig,
  REQRAFT_WS_HANDSHAKE_TIMEOUT_MS,
  REQRAFT_WS_PROBE_TIMEOUT_MS,
  ReqraftWebSocket,
  ReqraftWebSocketsManager,
} from '../src/utils/websocket';
import { HangingWebSocket } from './fixtures/hangingWebSocket';

const queryMock = vi.hoisted(() => vi.fn());

let nanoidCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: () => `deadline-id-${++nanoidCounter}`,
}));

vi.mock('../src/utils/fetch', () => ({
  fetchConfig: {
    instance: 'http://localhost:8092/',
    instanceToken: 'test-token',
  },
  query: queryMock,
}));

const URL = 'lsp';
const DEADLINE = REQRAFT_WS_HANDSHAKE_TIMEOUT_MS;
const PROBE_LIMIT = REQRAFT_WS_PROBE_TIMEOUT_MS;
const INTERVAL = ReqraftWebSocketsManager.defaultConfig.reconnectInterval;

const sockets = () => HangingWebSocket.instances;
const latest = () => HangingWebSocket.latest();
const live = () => HangingWebSocket.live();
const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);
/** Lets what is already due run: microtasks, and the events a close queued. */
const settle = () => vi.advanceTimersByTimeAsync(0);

const opened: ReqraftWebSocket[] = [];
const connect = (config: Partial<IReqraftWebSocketConfig> = {}) => {
  const ws = new ReqraftWebSocket({ url: URL, useHeartbeat: false, ...config });

  opened.push(ws);

  return ws;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', HangingWebSocket);
  HangingWebSocket.reset();
  ReqraftWebSocketsManager.connections = {};
  queryMock.mockReset();
  queryMock.mockResolvedValue({ ok: true, data: 1234 });
});

afterEach(() => {
  opened.splice(0).forEach((ws) => ws.remove());
  ReqraftWebSocketsManager.connections = {};
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the defaults', () => {
  it('give a handshake 15 s, as the Qorus IDE does, and the probe 10 s', () => {
    expect(REQRAFT_WS_HANDSHAKE_TIMEOUT_MS).toBe(15000);
    expect(REQRAFT_WS_PROBE_TIMEOUT_MS).toBe(10000);
    expect(ReqraftWebSocketsManager.defaultConfig.handshakeTimeout).toBe(15000);
    expect(ReqraftWebSocketsManager.defaultConfig.probeTimeout).toBe(10000);
  });
});

describe('a socket whose handshake never opens', () => {
  it('is closed and replaced at its deadline', async () => {
    const events: string[] = [];
    const onError = vi.fn(() => events.push('error'));
    const onClose = vi.fn((_event?: CloseEvent) => events.push('close'));
    const onReconnecting = vi.fn();
    connect({ onError, onClose, onReconnecting });
    const hung = sockets()[0];

    await advance(DEADLINE - 1);
    expect(hung.close).not.toHaveBeenCalled();
    expect(ReqraftWebSocketsManager.connections[URL].socket).toBe(hung);
    expect(onClose).not.toHaveBeenCalled();

    await advance(1);
    expect(hung.close).toHaveBeenCalledOnce();
    // Detached: nothing it does from now on reaches anyone.
    expect(hung.onopen).toBeNull();
    expect(hung.listenerCount()).toBe(0);
    // Its users heard what a browser reports of a handshake that failed, once.
    expect(events).toEqual(['error', 'close']);
    expect(onClose.mock.calls[0][0]).toMatchObject({ code: 1006, wasClean: false });
    expect(onClose.mock.calls[0][0].reason).toContain(`${DEADLINE / 1000} seconds`);
    // The first attempt after a close is immediate, and so is this one.
    expect(onReconnecting).toHaveBeenCalledExactlyOnceWith(1);
    expect(sockets()).toHaveLength(2);
    expect(ReqraftWebSocketsManager.connections[URL].socket).toBe(sockets()[1]);
    expect(live()).toEqual([sockets()[1]]);

    // The hung socket's own error and close, which its close() caused, reached nobody.
    await settle();
    expect(events).toEqual(['error', 'close']);
  });

  it('is kept when it opens just before its deadline', async () => {
    const onClose = vi.fn();
    const onOpen = vi.fn();
    connect({ onClose, onOpen });
    const socket = sockets()[0];

    await advance(DEADLINE - 1);
    socket.open();
    await advance(10 * DEADLINE);

    expect(onOpen).toHaveBeenCalledOnce();
    expect(socket.close).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(sockets()).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is given the handshakeTimeout it was configured with', async () => {
    connect({ handshakeTimeout: 2000 });

    await advance(1999);
    expect(sockets()[0].close).not.toHaveBeenCalled();

    await advance(1);
    expect(sockets()[0].close).toHaveBeenCalledOnce();
    expect(sockets()).toHaveLength(2);
  });

  it('waits for good with handshakeTimeout 0, as before', async () => {
    const onClose = vi.fn();
    connect({ handshakeTimeout: 0, onClose });

    await advance(60 * 60_000);

    expect(sockets()).toHaveLength(1);
    expect(sockets()[0].close).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  /**
   * The same schedule either way: an attempt straight after the first failure, one every
   * `reconnectInterval` after that, and `onReconnectFailed` at the attempt cap.
   */
  it.each([
    ['a handshake that hangs', () => advance(DEADLINE)],
    ['a handshake that is refused', async () => latest().fail()],
  ])('backs off and gives up after %s as after a close', async (_name, fail) => {
    const onReconnecting = vi.fn();
    const onReconnectFailed = vi.fn();
    connect({ maxReconnectTries: 3, onReconnecting, onReconnectFailed });

    // The first socket, then one per attempt, every one of them failing.
    for (const [attempt, pause] of [
      [1, 0],
      [2, INTERVAL],
      [3, INTERVAL],
    ]) {
      const count = sockets().length;
      await fail();
      await settle();

      if (pause) {
        // Nothing is connecting while it waits.
        expect(live()).toHaveLength(0);

        await advance(pause - 1);
        expect(sockets()).toHaveLength(count);

        await advance(1);
      }
      expect(sockets()).toHaveLength(count + 1);
      expect(onReconnecting).toHaveBeenLastCalledWith(attempt);
      expect(live()).toEqual([latest()]);
    }
    expect(onReconnectFailed).not.toHaveBeenCalled();

    // The last one's failure is the end of it.
    await fail();
    await settle();
    expect(onReconnectFailed).toHaveBeenCalledOnce();
    expect(live()).toHaveLength(0);
    expect(ReqraftWebSocketsManager.connections[URL]).toBeUndefined();

    // And nothing more is tried.
    await advance(10 * 60_000);
    expect(sockets()).toHaveLength(4);
    expect(onReconnecting).toHaveBeenCalledTimes(3);
    expect(onReconnectFailed).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers when a later attempt opens, and the open socket has no deadline', async () => {
    const onOpen = vi.fn();
    const onReconnecting = vi.fn();
    const onReconnectFailed = vi.fn();
    const ws = connect({ useHeartbeat: true, onOpen, onReconnecting, onReconnectFailed });

    await advance(DEADLINE);
    await advance(DEADLINE);
    await advance(INTERVAL);
    expect(sockets()).toHaveLength(3);
    expect(onReconnecting).toHaveBeenLastCalledWith(2);

    const third = sockets()[2];
    third.open();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(ws.socket).toBe(third);
    expect(ws.reconnectTries).toBe(0);

    await advance(10 * DEADLINE);
    expect(third.close).not.toHaveBeenCalled();
    expect(sockets()).toHaveLength(3);
    // It is in use: the heartbeat runs on it.
    expect(third.sent).toContain('ping');

    // The count starts over: a drop is attempt 1 again, made at once.
    onReconnecting.mockClear();
    third.fail();
    await settle();
    expect(onReconnecting).toHaveBeenCalledExactlyOnceWith(1);
    expect(sockets()).toHaveLength(4);
    expect(onReconnectFailed).not.toHaveBeenCalled();
  });

  it('tells every user of a shared socket, and gives them one replacement', async () => {
    const first = { onError: vi.fn(), onClose: vi.fn() };
    const second = { onError: vi.fn(), onClose: vi.fn() };
    const ws1 = connect(first);
    const ws2 = connect(second);
    expect(sockets()).toHaveLength(1);

    await advance(DEADLINE);

    for (const user of [first, second]) {
      expect(user.onError).toHaveBeenCalledOnce();
      expect(user.onClose).toHaveBeenCalledOnce();
      expect(user.onClose.mock.calls[0][0]).toMatchObject({ code: 1006 });
    }
    expect(sockets()).toHaveLength(2);
    expect(ws1.socket).toBe(sockets()[1]);
    expect(ws2.socket).toBe(sockets()[1]);
    expect(ReqraftWebSocketsManager.connections[URL].using).toBe(2);
    expect(live()).toEqual([sockets()[1]]);
  });

  it('is replaced even when a user fails while it is told', async () => {
    // The exception is the event target's to report (a browser logs it as uncaught); it must
    // not keep the socket from being let go of and replaced.
    connect({
      onClose: () => {
        throw new Error('a consumer bug');
      },
    });

    await advance(DEADLINE);

    expect(sockets()).toHaveLength(2);
    expect(sockets()[0].listenerCount()).toBe(0);
    expect(ReqraftWebSocketsManager.connections[URL].socket).toBe(sockets()[1]);
    expect(live()).toEqual([sockets()[1]]);
  });

  it('is replaced even when onReconnecting throws', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      connect({
        onReconnecting: () => {
          throw new Error('a consumer bug');
        },
      });

      await advance(DEADLINE);

      expect(sockets()).toHaveLength(2);
      expect(errors).toHaveBeenCalledWith(
        expect.stringContaining('onReconnecting'),
        expect.objectContaining({ message: 'a consumer bug' })
      );
    } finally {
      errors.mockRestore();
    }
  });
});

/**
 * The caller lets the connection go while a handshake hangs, or while its replacement waits:
 * `remove()` is what `useReqraftWebSocket` and the language-server client call, `close()` the
 * direct way. Nothing may be left behind: no timer, no socket, no attempt later on.
 */
describe('a caller who closes during a hang', () => {
  it.each([['remove'], ['close']] as const)(
    'leaves no timer or socket behind when it calls %s() while the handshake hangs',
    async (release) => {
      const onReconnecting = vi.fn();
      const onClose = vi.fn();
      const ws = connect({ onReconnecting, onClose });
      const hung = sockets()[0];

      await advance(DEADLINE / 2);
      ws[release]();

      expect(hung.close).toHaveBeenCalledExactlyOnceWith(4999);
      expect(ReqraftWebSocketsManager.connections[URL]).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);

      // A socket closed while it connects reports 1006, as if it had failed: the caller is
      // told it closed, and it is not reconnected for it.
      await settle();
      expect(onClose).toHaveBeenCalledOnce();
      expect(onClose.mock.calls[0][0]).toMatchObject({ code: 1006 });

      await advance(10 * 60_000);
      expect(sockets()).toHaveLength(1);
      expect(live()).toHaveLength(0);
      expect(onReconnecting).not.toHaveBeenCalled();
      expect(queryMock).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each([['remove'], ['close']] as const)(
    'calls off the attempt waiting to run when it calls %s()',
    async (release) => {
      const onReconnecting = vi.fn();
      const ws = connect({ onReconnecting });

      // The first replacement is made at once and hangs too; the next waits its interval.
      await advance(DEADLINE);
      await advance(DEADLINE);
      expect(sockets()).toHaveLength(2);
      expect(live()).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(1);

      ws[release]();
      expect(vi.getTimerCount()).toBe(0);

      await advance(10 * 60_000);
      expect(sockets()).toHaveLength(2);
      expect(onReconnecting).toHaveBeenCalledOnce();
    }
  );

  it.each([['remove'], ['close']] as const)(
    'aborts the probe in flight when it calls %s(), and dials nothing after it',
    async (release) => {
      queryMock.mockReturnValue(new Promise(() => undefined));
      const ws = connect();

      await advance(DEADLINE);
      expect(queryMock).toHaveBeenCalledOnce();
      const { signal } = queryMock.mock.calls[0][0] as { signal: AbortSignal };
      expect(signal.aborted).toBe(false);

      ws[release]();
      expect(signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);

      await advance(10 * 60_000);
      expect(sockets()).toHaveLength(1);
      expect(ReqraftWebSocketsManager.connections[URL]).toBeUndefined();
    }
  );

  it('is not replaced when the caller removes it as it is told of the timeout', async () => {
    const ws: ReqraftWebSocket = connect({ onClose: () => ws.remove() });

    await advance(DEADLINE);
    await advance(10 * INTERVAL);

    expect(sockets()).toHaveLength(1);
    // Not even the server is asked about a connection nobody holds.
    expect(queryMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves the other user of a shared socket to its replacement', async () => {
    const ws1 = connect();
    const ws2 = connect();

    await advance(DEADLINE / 2);
    ws1.remove();
    expect(ReqraftWebSocketsManager.connections[URL].using).toBe(1);

    await advance(DEADLINE / 2);
    expect(sockets()).toHaveLength(2);
    expect(ws2.socket).toBe(sockets()[1]);
    expect(ReqraftWebSocketsManager.connections[URL].using).toBe(1);
    expect(ws1.socket).toBe(sockets()[0]);
  });

  it('does not count down a socket another user dialed while it waited', async () => {
    // The second user's probe never answers: it is still waiting when the first has dialed
    // the replacement and the second goes.
    queryMock
      .mockResolvedValueOnce({ ok: true })
      .mockReturnValueOnce(new Promise(() => undefined));
    const ws1 = connect();
    const ws2 = connect();

    await advance(DEADLINE);
    expect(sockets()).toHaveLength(2);
    expect(ws1.socket).toBe(sockets()[1]);
    expect(ReqraftWebSocketsManager.connections[URL].using).toBe(1);

    ws2.remove();

    expect(ReqraftWebSocketsManager.connections[URL].socket).toBe(sockets()[1]);
    expect(ReqraftWebSocketsManager.connections[URL].using).toBe(1);
    expect(sockets()[1].close).not.toHaveBeenCalled();
  });
});

describe('the server-status probe', () => {
  it('is cut off at its limit when the server never answers, and the replacement goes ahead', async () => {
    // A server that hangs the upgrade usually hangs REST too.
    queryMock.mockReturnValue(new Promise(() => undefined));
    connect();

    await advance(DEADLINE);
    expect(queryMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ url: '/system/pid', cache: false, signal: expect.any(AbortSignal) })
    );
    const { signal } = queryMock.mock.calls[0][0] as { signal: AbortSignal };
    expect(sockets()).toHaveLength(1);

    await advance(PROBE_LIMIT - 1);
    expect(signal.aborted).toBe(false);
    expect(sockets()).toHaveLength(1);

    await advance(1);
    expect(signal.aborted).toBe(true);
    expect(sockets()).toHaveLength(2);
    expect(live()).toEqual([sockets()[1]]);
  });

  it('is given the probeTimeout it was configured with', async () => {
    queryMock.mockReturnValue(new Promise(() => undefined));
    connect({ probeTimeout: 500 });

    await advance(DEADLINE);
    await advance(499);
    expect(sockets()).toHaveLength(1);

    await advance(1);
    expect(sockets()).toHaveLength(2);
  });

  it('leaves no timer behind when it answers in time', async () => {
    connect();

    await advance(DEADLINE);

    expect(sockets()).toHaveLength(2);
    // Only the replacement's handshake deadline is left.
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe('closeAll()', () => {
  it('closes a socket that is still connecting without reconnecting it', async () => {
    const onReconnecting = vi.fn();
    connect({ onReconnecting });

    ReqraftWebSocketsManager.closeAll();

    expect(ReqraftWebSocketsManager.connections).toEqual({});
    expect(vi.getTimerCount()).toBe(0);

    await advance(10 * 60_000);
    expect(sockets()).toHaveLength(1);
    expect(onReconnecting).not.toHaveBeenCalled();
  });

  it('lets a connection made straight after it dial a new socket, not join the closing one', async () => {
    connect();
    ReqraftWebSocketsManager.closeAll();

    const next = connect();

    expect(sockets()).toHaveLength(2);
    expect(next.socket).toBe(sockets()[1]);

    // The closed socket's own close, which arrives now, leaves the new one alone.
    await settle();
    expect(ReqraftWebSocketsManager.connections[URL].socket).toBe(sockets()[1]);
    expect(sockets()[1].listenerCount()).toBeGreaterThan(0);
    expect(sockets()[1].close).not.toHaveBeenCalled();
  });
});
