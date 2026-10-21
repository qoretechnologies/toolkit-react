import { forEach } from 'lodash';
import { nanoid } from 'nanoid';
import { fetchConfig, query } from './fetch';

/**
 * How long a socket's handshake has to open before the socket is closed and replaced: the
 * default of the `handshakeTimeout` option.
 *
 * A handshake can hang: the server takes the connection and never answers the upgrade, or the
 * network loses it on the way. The socket then sends no event at all - no open, no error, no
 * close - until the browser gives up on its own (Chromium after about four minutes), and a
 * socket used to be replaced only after a close. A hung socket also holds back every other
 * socket to the same host and port, because Chromium runs one handshake per host and port at a
 * time: a hung language-server socket kept the Qorus IDE's own socket from connecting, and the
 * other way round. Closing it ends its handshake at once and lets the queue move.
 *
 * The same 15 s as the Qorus IDE gives its own sockets (`WS_HANDSHAKE_TIMEOUT_MS`): an upgrade
 * takes well under a second on an idle instance and a few seconds under load.
 */
export const REQRAFT_WS_HANDSHAKE_TIMEOUT_MS = 15000;

/**
 * How long a reconnect waits for the server-status probe (`GET system/pid`) before it dials
 * without the answer: the default of the `probeTimeout` option. A server that hangs the upgrade
 * usually hangs REST too, and a probe that never answered held the replacement with it.
 */
export const REQRAFT_WS_PROBE_TIMEOUT_MS = 10000;

/** The code `close()` and `closeAll()` close a socket with: such a socket is never reconnected. */
const CLOSED_ON_PURPOSE = 4999;

export interface IReqraftWebSocketConfig {
  url: string;
  pooled?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectTries?: number;
  /**
   * How long, in ms, a socket's handshake has to open; default `REQRAFT_WS_HANDSHAKE_TIMEOUT_MS`
   * (15 s), and `0` sets no limit. A socket still connecting at the deadline is closed, its users
   * hear what a failed handshake tells them (`onError`, then `onClose` with code 1006), and it is
   * replaced as a socket that closed is: `reconnect`, `reconnectInterval` and `maxReconnectTries`
   * apply. An open socket has no deadline.
   */
  handshakeTimeout?: number;
  /**
   * How long, in ms, a reconnect waits for its server-status probe (`GET system/pid`) before it
   * dials anyway; default `REQRAFT_WS_PROBE_TIMEOUT_MS` (10 s), and `0` sets no limit. The
   * request is aborted at the limit.
   */
  probeTimeout?: number;
  useHeartbeat?: boolean;
  onOpen?: (ev?: Event) => void;
  onMessage?: (ev: MessageEvent) => void;
  onClose?: (ev?: CloseEvent) => void;
  onError?: (ev?: Event) => void;
  onReconnecting?: (reconnectNumber?: number) => void;
  onReconnectFailed?: () => void;
  tokenOverride?: string;
}

/**
 * The URL a socket for `path` dials on `instance`: `http(s)` becomes `ws(s)`,
 * and the token, when there is one, rides in the query. The single definition —
 * story mocks build their URLs with it too, so they cannot drift from it.
 */
export const buildReqraftSocketUrl = (instance: string, path: string, token?: string): string => {
  let wsUrl = instance.replace('http', 'ws');

  if (wsUrl.endsWith('/')) {
    wsUrl = wsUrl.slice(0, -1);
  }

  return `${wsUrl}/${path}${token ? `?token=${token}` : ''}`;
};

/** Each socket's handshake deadline, from its creation until it opens, fails or is closed. */
const handshakeDeadlines = new WeakMap<WebSocket, ReturnType<typeof setTimeout>>();

const clearHandshakeDeadline = (socket: WebSocket | undefined) => {
  if (!socket || !handshakeDeadlines.has(socket)) {
    return;
  }

  clearTimeout(handshakeDeadlines.get(socket));
  handshakeDeadlines.delete(socket);
};

/**
 * The sockets closed on purpose. A socket closed while it is still connecting reports code 1006,
 * not the code `close()` was given, so its close event alone cannot say the close was meant.
 */
const closedOnPurpose = new WeakSet<WebSocket>();

/** Takes `socket` out of the pool, with its heartbeat, if the pool still holds it under `key`. */
const releaseConnection = (key: string, socket: WebSocket) => {
  const connection = ReqraftWebSocketsManager.connections[key];

  if (!connection || connection.socket !== socket) {
    return;
  }

  clearInterval(connection.heartbeat);
  delete ReqraftWebSocketsManager.connections[key];
};

/**
 * Closes `socket` on purpose: its users are told it closed, and none of them reconnects it. It
 * leaves the pool at once, so whoever connects next dials a new socket instead of joining one
 * that is closing.
 */
const closeOnPurpose = (key: string, socket: WebSocket) => {
  closedOnPurpose.add(socket);
  clearHandshakeDeadline(socket);
  releaseConnection(key, socket);
  socket.close(CLOSED_ON_PURPOSE);
};

export class ReqraftWebSocketsManager {
  public static defaultConfig: IReqraftWebSocketConfig = {
    reconnect: true,
    url: '',
    maxReconnectTries: 10,
    reconnectInterval: 5000,
    handshakeTimeout: REQRAFT_WS_HANDSHAKE_TIMEOUT_MS,
    probeTimeout: REQRAFT_WS_PROBE_TIMEOUT_MS,
    useHeartbeat: true,
  };
  public static connections: Record<
    string,
    { socket: WebSocket; using: number; heartbeat?: NodeJS.Timeout }
  > = {};

  public static closeAll() {
    forEach({ ...this.connections }, (connection, key) => {
      closeOnPurpose(key, connection.socket);
    });
  }

  public static addHandler(
    url: string,
    event: keyof WebSocketEventMap,
    handler: (ev: Event | MessageEvent | CloseEvent) => void
  ) {
    this.connections[url]?.socket.addEventListener(event, handler);

    return () => {
      this.connections[url]?.socket.removeEventListener(event, handler);
    };
  }

  public static removeHandler(
    url: string,
    event: keyof WebSocketEventMap,
    handler: (ev: Event | MessageEvent | CloseEvent) => void
  ) {
    this.connections[url]?.socket.removeEventListener(event, handler);
  }
}

export class ReqraftWebSocket {
  public isConnected: boolean;
  public reconnectTries: number = 0;
  public reconnectInterval: NodeJS.Timeout;
  public options: IReqraftWebSocketConfig;
  public readonly handlers: Record<
    string,
    {
      type: keyof WebSocketEventMap;
      event: (ev: Event) => void;
      /** The socket the handler was added to, which is the one it is removed from. */
      socket?: WebSocket;
    }
  > = {};
  public socket: WebSocket;
  private _poolKey: string;
  /** Set once the caller has closed or removed this connection: nothing reconnects it then. */
  private _stopped = false;
  /** The server-status probe of the reconnect in progress; aborted when the caller closes. */
  private _probe: AbortController | undefined;

  constructor(config: IReqraftWebSocketConfig) {
    this.isConnected = true;
    this.reconnectTries = 0;
    this.reconnectInterval = null;
    this.options = { ...ReqraftWebSocketsManager.defaultConfig, ...config };
    this._poolKey =
      this.options.pooled === false ? `${this.options.url}::${nanoid()}` : this.options.url;

    this.connect();
  }

  public addHandler(
    event: keyof WebSocketEventMap,
    handler: (ev: Event | MessageEvent | CloseEvent) => void
  ) {
    const id = nanoid();
    const socket = ReqraftWebSocketsManager.connections[this._poolKey]?.socket;

    this.handlers[id] = { type: event, event: handler, socket };

    socket?.addEventListener(event, handler);

    return id;
  }

  public removeHandler(id: string) {
    const handler = this.handlers[id];

    if (!handler) return;

    // From the socket it was added to: by now the pool may hold another socket, and a handler
    // left on a socket that was given up on would hear that socket's own close too.
    handler.socket?.removeEventListener(handler.type, handler.event);

    delete this.handlers[id];
  }

  private getSocketUrl() {
    return buildReqraftSocketUrl(
      fetchConfig.instance,
      this.options.url,
      this.options.tokenOverride || fetchConfig.instanceToken
    );
  }

  public connect() {
    this._stopped = false;

    if (!ReqraftWebSocketsManager.connections[this._poolKey]) {
      const created = new WebSocket(this.getSocketUrl());

      this.socket = created;
      created.onopen = (ev) => {
        clearHandshakeDeadline(created);

        // Closed or given up on before its open arrived: it is no longer this connection's.
        if (ReqraftWebSocketsManager.connections[this._poolKey]?.socket !== created) {
          return;
        }

        this.reconnectTries = 0;
        this.isConnected = true;

        clearInterval(this.reconnectInterval);

        this.reconnectInterval = undefined;

        if (this.options.useHeartbeat) {
          this.startHeartbeat();
        }

        this.options?.onOpen?.(ev);
      };

      ReqraftWebSocketsManager.connections[this._poolKey] = {
        socket: created,
        using: 0,
      };

      this.armHandshakeDeadline(created);
    } else {
      this.socket = ReqraftWebSocketsManager.connections[this._poolKey].socket;
      this.options?.onOpen?.(null);
    }

    const socket = this.socket;

    // Increment the number of parts using this connection
    ReqraftWebSocketsManager.connections[this._poolKey].using++;

    if (this.options?.onMessage) {
      this.addHandler('message', (event) => {
        if ((<MessageEvent>event).data === 'pong') {
          return;
        }

        this.options?.onMessage?.(<MessageEvent>event);
      });
    }

    this.addHandler('close', (event) => {
      clearHandshakeDeadline(socket);

      try {
        this.options?.onClose?.(<CloseEvent>event);
      } finally {
        // Whatever the caller's callback did, the socket is let go of, and reconnected unless
        // it was closed on purpose.
        releaseConnection(this._poolKey, socket);
        this.removeAllHandlers();

        // Start the reconnect process
        this.maybeReconnect(
          closedOnPurpose.has(socket) ? CLOSED_ON_PURPOSE : (<CloseEvent>event).code
        );
      }
    });

    this.addHandler('error', (event) => {
      clearHandshakeDeadline(socket);

      this.options?.onError?.(event);
    });
  }

  /**
   * Gives the handshake of `socket`, which this connection just created, `handshakeTimeout` ms
   * to open. A hung handshake sends no event at all, so nothing else would ever replace it.
   */
  private armHandshakeDeadline(socket: WebSocket) {
    const timeout = this.options.handshakeTimeout;

    if (!(timeout > 0)) {
      return;
    }

    handshakeDeadlines.set(
      socket,
      setTimeout(() => {
        handshakeDeadlines.delete(socket);

        if (socket.readyState === WebSocket.CONNECTING) {
          this.abandonHandshake(socket, timeout);
        }
      }, timeout)
    );
  }

  /**
   * Gives up on `socket`, whose handshake did not open within `timeout` ms: it is detached and
   * closed, and every user of it is told what a failed handshake tells it, and reconnects.
   */
  private abandonHandshake(socket: WebSocket, timeout: number) {
    // Out of the pool first, so its replacement is a new socket and never this one again.
    releaseConnection(this._poolKey, socket);
    // A handshake that completes after all no longer opens anything.
    socket.onopen = null;

    try {
      // Ends the handshake, which also lets the ones queued behind it go. The events it causes
      // come after this and reach nobody: the users' handlers are off it by then.
      socket.close();
    } catch (error) {
      // It is out of the pool and replaced either way.
    }

    // An error, then a close with code 1006 and no clean closing handshake: what a browser
    // reports of a handshake that failed, and what the users get, through the same handlers.
    // Each one takes its handlers off this socket and goes through `maybeReconnect`, with the
    // backoff and attempt cap of any close. Nothing else is read into it: the server refused
    // nothing, it never answered.
    socket.dispatchEvent(new Event('error'));
    socket.dispatchEvent(
      new CloseEvent('close', {
        code: 1006,
        reason: `The WebSocket handshake did not complete within ${timeout / 1000} seconds`,
        wasClean: false,
      })
    );
  }

  public send(data: string) {
    this.socket.send(data);
  }

  public async checkServerStatus(signal?: AbortSignal) {
    // If this results in a 401, the server will redirect automatically
    await query({ url: '/system/pid', cache: false, signal });
  }

  /**
   * Asks the server whether it answers, for at most `probeTimeout` ms: a server that hangs the
   * upgrade usually hangs this request too, and a probe that never answered held the reconnect
   * with it. Resolves when the probe answers, fails or is cut off, and never rejects.
   */
  private async probeServer(): Promise<void> {
    const probe = new AbortController();
    const timeout = this.options.probeTimeout;
    let deadline: ReturnType<typeof setTimeout> | undefined;

    this._probe = probe;

    try {
      await Promise.race([
        this.checkServerStatus(probe.signal),
        // Cut off at the limit, or when the caller closes the connection meanwhile.
        new Promise<void>((resolve) => {
          probe.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(deadline);
              resolve();
            },
            { once: true }
          );

          if (timeout > 0) {
            deadline = setTimeout(() => probe.abort(), timeout);
          }
        }),
      ]);
    } catch (error) {
      // deliberately ignored — see `tryReconnect`
    } finally {
      clearTimeout(deadline);

      if (this._probe === probe) {
        this._probe = undefined;
      }
    }
  }

  private async tryReconnect() {
    this.reconnectInterval = undefined;
    this.reconnectTries++;

    try {
      this.options?.onReconnecting?.(this.reconnectTries);
    } catch (error) {
      // A caller's callback that throws must not stop the reconnect it is being told about.
      console.error(`[ReqraftWebSocket] onReconnecting failed for ${this.options.url}:`, error);
    }

    // The probe is ADVISORY: its only job is to let a dead session redirect on a
    // 401 before we retry. It must never gate the reconnect itself.
    //
    // `query()` rejects on a network error, and a network error is the normal
    // state while reconnecting — the server being unreachable is why we are
    // here. Awaiting it unguarded meant the throw skipped `connect()`, so the
    // socket never closed again, so `maybeReconnect()` was never called again:
    // the state machine stopped silently, mid-way, with no further attempts and
    // no `onReconnectFailed`. A caller waiting to be told the reconnect gave up
    // waits forever, and the UI sits on CONNECTING.
    //
    // It surfaced as a CI-only story failure because a dev machine answers
    // `/system/pid` (so the probe resolves and the chain advances) while CI has
    // no server behind it — the same difference that makes it a REAL bug, since
    // production has no server behind it either at exactly this moment.
    //
    // A probe that never answers stalls the chain just the same, so it is also
    // bounded (`probeServer`).
    await this.probeServer();

    // Closed by the caller while it waited.
    if (this._stopped) {
      return;
    }

    this.connect();
  }

  public maybeReconnect(closeCode: number) {
    if (this._stopped) {
      return;
    }

    if (this.options.reconnect && closeCode !== CLOSED_ON_PURPOSE) {
      clearTimeout(this.reconnectInterval);

      // If this is the first reconnect try
      if (this.reconnectTries === 0) {
        this.tryReconnect();

        return;
      }

      // If we haven't reached the max number of reconnect tries
      if (this.reconnectTries < this.options.maxReconnectTries) {
        this.reconnectInterval = setTimeout(
          this.tryReconnect.bind(this),
          this.options.reconnectInterval
        );

        return;
      }

      // Reconnect failed
      this.isConnected = false;
      this.reconnectInterval = undefined;
      this.reconnectTries = 0;

      this.options.onReconnectFailed?.();
    }
  }

  public remove() {
    const connection = ReqraftWebSocketsManager.connections[this._poolKey];

    // Between sockets - waiting to reconnect, or given up: there is no socket to let go of, only
    // the reconnect to stop. The pool may hold a socket another user has dialed since; that one
    // is not this one's to count down.
    if (!connection || connection.socket !== this.socket) {
      this.stopReconnecting();
      this.removeAllHandlers();
      return;
    }

    // Decrement the number of parts using this connection
    connection.using--;
    // If this is the last part using the connection, close it
    if (connection.using === 0) {
      this.close();
      return;
    }

    this.stopReconnecting();
    // Remove all handlers
    this.removeAllHandlers();
  }

  /**
   * Closes the connection on purpose: it is not reconnected, a reconnect already on its way is
   * called off, and the socket's handshake deadline goes with it.
   */
  public close() {
    this.stopReconnecting();
    closeOnPurpose(this._poolKey, this.socket);
  }

  /** Calls off this connection's reconnect: the attempt waiting to run and the probe in flight. */
  private stopReconnecting() {
    this._stopped = true;
    clearTimeout(this.reconnectInterval);
    this.reconnectInterval = undefined;
    this._probe?.abort();
  }

  public removeAllHandlers() {
    forEach(this.handlers, (_handler, id) => {
      this.removeHandler(id);
    });
  }

  private startHeartbeat() {
    // Start the heartbeat
    clearInterval(ReqraftWebSocketsManager.connections[this._poolKey].heartbeat);
    ReqraftWebSocketsManager.connections[this._poolKey].heartbeat = null;
    ReqraftWebSocketsManager.connections[this._poolKey].heartbeat = setInterval(() => {
      this.socket.send('ping');
    }, 3000);
  }
}
