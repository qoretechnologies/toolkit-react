import { forEach } from 'lodash';
import { nanoid } from 'nanoid';
import { fetchConfig, query } from './fetch';

export interface IReqraftWebSocketConfig {
  url: string;
  pooled?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectTries?: number;
  useHeartbeat?: boolean;
  onOpen?: (ev?: Event) => void;
  onMessage?: (ev: MessageEvent) => void;
  onClose?: (ev?: CloseEvent) => void;
  onError?: (ev?: Event) => void;
  onReconnecting?: (reconnectNumber?: number) => void;
  onReconnectFailed?: () => void;
  tokenOverride?: string;
}

export class ReqraftWebSocketsManager {
  public static defaultConfig: IReqraftWebSocketConfig = {
    reconnect: true,
    url: '',
    maxReconnectTries: 10,
    reconnectInterval: 5000,
    useHeartbeat: true,
  };
  public static connections: Record<
    string,
    { socket: WebSocket; using: number; heartbeat?: NodeJS.Timeout }
  > = {};

  public static closeAll() {
    forEach(this.connections, (connection) => {
      connection.socket.close(4999);
      delete this.connections[connection.socket.url];
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
    { type: keyof WebSocketEventMap; event: (ev: Event) => void }
  > = {};
  public socket: WebSocket;
  private _poolKey: string;

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

    this.handlers[id] = { type: event, event: handler };

    ReqraftWebSocketsManager.addHandler(this._poolKey, event, handler);

    return id;
  }

  public removeHandler(id: string) {
    if (!this.handlers[id]) return;

    ReqraftWebSocketsManager.removeHandler(
      this._poolKey,
      this.handlers[id].type,
      this.handlers[id].event
    );

    delete this.handlers[id];
  }

  private getSocketUrl() {
    let wsUrl = fetchConfig.instance.replace('http', 'ws');

    if (wsUrl.endsWith('/')) {
      wsUrl = wsUrl.slice(0, -1);
    }

    const token = this.options.tokenOverride || fetchConfig.instanceToken;

    return `${wsUrl}/${this.options.url}${token ? `?token=${token}` : ''}`;
  }

  public connect() {
    if (!ReqraftWebSocketsManager.connections[this._poolKey]) {
      this.socket = new WebSocket(this.getSocketUrl());
      this.socket.onopen = (ev) => {
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
        socket: this.socket,
        using: 0,
      };
    } else {
      this.socket = ReqraftWebSocketsManager.connections[this._poolKey].socket;
      this.options?.onOpen?.(null);
    }

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
      this.options?.onClose?.(<CloseEvent>event);
      this.stopHeartbeat();
      this.removeAllHandlers();

      delete ReqraftWebSocketsManager.connections[this._poolKey];

      // Start the reconnect process
      this.maybeReconnect((<CloseEvent>event).code);
    });

    this.addHandler('error', (event) => {
      this.options?.onError?.(event);
    });
  }

  public send(data: string) {
    this.socket.send(data);
  }

  public async checkServerStatus() {
    // If this results in a 401, the server will redirect automatically
    await query({ url: '/system/pid', cache: false });
  }

  private async tryReconnect() {
    this.reconnectTries++;
    this.options?.onReconnecting?.(this.reconnectTries);

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
    try {
      await this.checkServerStatus();
    } catch (error) {
      // deliberately ignored — see above
    }

    this.connect();
  }

  public maybeReconnect(closeCode: number) {
    if (this.options.reconnect && closeCode !== 4999) {
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
    if (!ReqraftWebSocketsManager.connections[this._poolKey]) return;
    // Decrement the number of parts using this connection
    ReqraftWebSocketsManager.connections[this._poolKey].using--;
    // If this is the last part using the connection, close it
    if (ReqraftWebSocketsManager.connections[this._poolKey].using === 0) {
      this.close();
      return;
    }

    // Remove all handlers
    this.removeAllHandlers();
  }

  public close() {
    this.socket.close(4999);
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

  private stopHeartbeat() {
    if (!ReqraftWebSocketsManager.connections[this._poolKey]) return;

    clearInterval(ReqraftWebSocketsManager.connections[this._poolKey].heartbeat);
    ReqraftWebSocketsManager.connections[this._poolKey].heartbeat = null;
  }
}
