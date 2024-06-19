import { forEach } from 'lodash';
import shortid from 'shortid';
import { fetchConfig, query } from './fetch';

export interface IReqraftWebSocketConfig {
  url: string;
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

  constructor(config: IReqraftWebSocketConfig) {
    this.isConnected = true;
    this.reconnectTries = 0;
    this.reconnectInterval = null;
    this.options = { ...ReqraftWebSocketsManager.defaultConfig, ...config };

    this.connect();
  }

  public addHandler(
    event: keyof WebSocketEventMap,
    handler: (ev: Event | MessageEvent | CloseEvent) => void
  ) {
    const id = shortid.generate();

    this.handlers[id] = { type: event, event: handler };

    ReqraftWebSocketsManager.addHandler(this.options.url, event, handler);

    return id;
  }

  public removeHandler(id: string) {
    if (!this.handlers[id]) return;

    ReqraftWebSocketsManager.removeHandler(
      this.options.url,
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

    return `${wsUrl}/${this.options.url}?token=${fetchConfig.instanceToken}`;
  }

  public connect() {
    if (!ReqraftWebSocketsManager.connections[this.options.url]) {
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

      ReqraftWebSocketsManager.connections[this.options.url] = {
        socket: this.socket,
        using: 0,
      };
    } else {
      this.socket = ReqraftWebSocketsManager.connections[this.options.url].socket;
      this.options?.onOpen?.(null);
    }

    // Increment the number of parts using this connection
    ReqraftWebSocketsManager.connections[this.options.url].using++;

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

      delete ReqraftWebSocketsManager.connections[this.options.url];

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
    const check = await query({ url: '/system/pid', cache: false });

    if (check.code === 401) {
      // Qorus is back up again but we need to re-authenticate
      // Get the current pathname and redirect to the login page
      window.location.href = fetchConfig.unauthorizedRedirect(window.location.pathname);
    }
  }

  private async tryReconnect() {
    this.reconnectTries++;
    this.options?.onReconnecting?.(this.reconnectTries);

    await this.checkServerStatus();

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
    if (!ReqraftWebSocketsManager.connections[this.options.url]) return;
    // Decrement the number of parts using this connection
    ReqraftWebSocketsManager.connections[this.options.url].using--;
    // If this is the last part using the connection, close it
    if (ReqraftWebSocketsManager.connections[this.options.url].using === 0) {
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
    clearInterval(ReqraftWebSocketsManager.connections[this.options.url].heartbeat);
    ReqraftWebSocketsManager.connections[this.options.url].heartbeat = null;
    ReqraftWebSocketsManager.connections[this.options.url].heartbeat = setInterval(() => {
      this.socket.send('ping');
    }, 3000);
  }

  private stopHeartbeat() {
    if (!ReqraftWebSocketsManager.connections[this.options.url]) return;

    clearInterval(ReqraftWebSocketsManager.connections[this.options.url].heartbeat);
    ReqraftWebSocketsManager.connections[this.options.url].heartbeat = null;
  }
}
