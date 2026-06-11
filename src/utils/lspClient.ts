// Copyright 2026 Qore Technologies, s.r.o.

import { ReqraftWebSocket } from './websocket';
import {
  ILspCompletionItem,
  ILspDiagnostic,
  ILspMarkupContent,
  ILspSemanticTokensLegend,
  ILspServerCapabilities,
  ILspSignatureHelp,
  ILspTextEdit,
  TLspDocumentText,
} from './lspClient.types';

const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_URL = 'lsp';
const DEFAULT_MAX_RECONNECT_TRIES = 10;
const DEFAULT_RECONNECT_INTERVAL_MS = 5000;
const DEFAULT_TAB_SIZE = 4;

export interface IReqraftLspClientOptions {
  /**
   * LSP `languageId` — routes the document on a multi-language `/lsp`
   * endpoint. Must match a server-side language handler (e.g. `'dpql'`,
   * `'qonsole'`, `'qore'`).
   */
  languageId: string;
  /**
   * Document URI. Should be client-generated and opaque. Per the
   * server-side Qonsole LSP contract, must NOT contain session tokens,
   * usernames, sandbox namespace IDs, or command-derived secrets — any
   * value that ends up in server logs. Use random / nanoid suffixes.
   */
  uri: string;
  /** WebSocket path on the configured Reqraft instance. Default: `'lsp'`. */
  url?: string;
  /** Request timeout in milliseconds. Default: 15000. */
  requestTimeoutMs?: number;
  /** Max reconnect attempts before giving up. Default: 10. */
  maxReconnectTries?: number;
  /** Delay between reconnect attempts, in milliseconds. Default: 5000. */
  reconnectIntervalMs?: number;
}

interface IPendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
}

interface IJsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: unknown;
}

/**
 * One shared WebSocket + JSON-RPC session per LSP endpoint URL, multiplexing
 * any number of `ReqraftLspClient` documents. The Qorus `/lsp` handler keys language
 * sessions by document URI (`uriToDpqlSession` server-side), so a single
 * connection serves N editors — the standard LSP architecture (one connection
 * per language server, all documents on it). Responses route by JSON-RPC id;
 * `publishDiagnostics` routes by `params.uri`; other notifications are
 * delivered to every client that registered a handler for the method. The
 * connection closes when its last client releases it.
 */
class LspSharedConnection {
  private static registry = new Map<string, LspSharedConnection>();

  /** Get-or-create the connection for `url` and register `client` on it. */
  static acquire(
    url: string,
    config: { maxReconnectTries: number; reconnectIntervalMs: number },
    client: ReqraftLspClient
  ): LspSharedConnection {
    let conn = LspSharedConnection.registry.get(url);
    if (!conn) {
      // The first acquirer's reconnect config wins for the shared socket.
      conn = new LspSharedConnection(url, config);
      LspSharedConnection.registry.set(url, conn);
    }
    conn.clients.add(client);
    return conn;
  }

  private rws: ReqraftWebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, IPendingRequest>();
  private readonly clients = new Set<ReqraftLspClient>();
  private initPromise: Promise<void> | null = null;

  connected = false;
  capabilities: ILspServerCapabilities | null = null;
  semanticTokensLegend: ILspSemanticTokensLegend | null = null;

  private constructor(
    private readonly url: string,
    private readonly config: { maxReconnectTries: number; reconnectIntervalMs: number }
  ) {}

  /** Open the socket and `initialize` once; re-entrant for every client. */
  connect(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      let initialConnect = true;

      this.rws = new ReqraftWebSocket({
        url: this.url,
        pooled: false,
        reconnect: true,
        maxReconnectTries: this.config.maxReconnectTries,
        reconnectInterval: this.config.reconnectIntervalMs,
        useHeartbeat: true,
        onOpen: () => {
          this.connected = true;

          this.sendRequest('initialize', { capabilities: {} }, DEFAULT_REQUEST_TIMEOUT_MS)
            .then((initResult: any) => {
              // Capture the full capabilities block. Consumers gate
              // optional features (signatureHelp, semantic tokens, …)
              // on the presence of the relevant provider so we degrade
              // gracefully against servers that don't support them.
              const caps = initResult?.capabilities;
              this.capabilities =
                caps && typeof caps === 'object' ? (caps as ILspServerCapabilities) : null;

              const legend = caps?.semanticTokensProvider?.legend;
              if (
                legend &&
                Array.isArray(legend.tokenTypes) &&
                Array.isArray(legend.tokenModifiers)
              ) {
                this.semanticTokensLegend = {
                  tokenTypes: legend.tokenTypes.slice(),
                  tokenModifiers: legend.tokenModifiers.slice(),
                };
              } else {
                this.semanticTokensLegend = null;
              }
              if (initialConnect) {
                initialConnect = false;
                // Awaiting clients self-notify ready in their connect().
                resolve();
              } else {
                // Reconnect: every registered document re-opens itself.
                this.clients.forEach((c) => c._resyncAfterReconnect());
                this.clients.forEach((c) => c._notifyReady(true));
              }
            })
            .catch((err) => {
              if (initialConnect) {
                initialConnect = false;
                reject(err);
              } else {
                this.clients.forEach((c) => c._notifyReady(false));
              }
            });
        },
        onMessage: (event: MessageEvent) => {
          // pong is already filtered out by ReqraftWebSocket's heartbeat.
          let msg: any;
          try {
            msg = JSON.parse(event.data as string);
          } catch {
            return;
          }

          // Response (has id + result/error)
          if (
            msg.id !== undefined &&
            msg.id !== null &&
            (msg.result !== undefined || msg.error !== undefined)
          ) {
            const pending = this.pending.get(msg.id);
            if (pending) {
              clearTimeout(pending.timer);
              this.pending.delete(msg.id);
              if (msg.error) {
                pending.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
              } else {
                pending.resolve(msg.result);
              }
            }
            return;
          }

          // Notification (has method, no id)
          if (msg.method) {
            if (msg.method === 'textDocument/publishDiagnostics' && msg.params?.uri) {
              // Diagnostics belong to exactly one document — route by uri.
              this.clients.forEach((c) => {
                if (c.documentUri === msg.params.uri) {
                  c._deliverNotification(msg.method, msg.params);
                }
              });
              return;
            }
            this.clients.forEach((c) => c._deliverNotification(msg.method, msg.params));
          }
        },
        onClose: () => {
          this.connected = false;
          // Reject all pending requests.
          this.pending.forEach((p) => {
            clearTimeout(p.timer);
            p.reject(new Error('WebSocket closed'));
          });
          this.pending.clear();
          this.clients.forEach((c) => {
            c._notifyReady(false);
            c._notifyDisconnect();
          });
        },
        onError: () => {
          // onClose fires after onError; rejection happens there.
        },
      });
    });

    // Reset on failure so connect() can be retried with a clean slate —
    // close() also drops the dead socket, which would otherwise leak when
    // a retry stacks a fresh ReqraftWebSocket on top of it.
    this.initPromise.catch(() => {
      this.close();
    });

    return this.initPromise;
  }

  /** @internal Test hook — close and forget every shared connection. */
  static _resetForTests(): void {
    LspSharedConnection.registry.forEach((conn) => conn.close());
    LspSharedConnection.registry.clear();
  }

  /** Deregister a client; the last one out closes the socket. */
  release(client: ReqraftLspClient): void {
    this.clients.delete(client);
    if (this.clients.size === 0) {
      LspSharedConnection.registry.delete(this.url);
      this.close();
    }
  }

  private close(): void {
    this.initPromise = null;
    if (this.rws) {
      // Disable reconnect before cleanup to prevent zombie reconnect timers.
      this.rws.options.reconnect = false;
      this.rws.remove();
      this.rws = null;
    }
    this.connected = false;
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('Client disconnected'));
    });
    this.pending.clear();
  }

  sendRequest(method: string, params: any, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.rws?.socket || this.rws.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = this.nextId++;

      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer, method });

      const msg: IJsonRpcMessage = { jsonrpc: '2.0', id, method };
      if (params !== undefined) {
        msg.params = params;
      }
      this.rws.socket.send(JSON.stringify(msg));
    });
  }

  sendNotification(method: string, params?: any): void {
    if (!this.rws?.socket || this.rws.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const msg: IJsonRpcMessage = { jsonrpc: '2.0', method };
    if (params !== undefined) {
      msg.params = params;
    }
    this.rws.socket.send(JSON.stringify(msg));
  }
}

/**
 * JSON-RPC 2.0 client speaking LSP for ONE document URI. Transport is the
 * shared per-endpoint connection (`LspSharedConnection`) — creating more
 * clients does not open more sockets.
 */
export class ReqraftLspClient {
  private conn: LspSharedConnection | null = null;
  private connectPromise: Promise<void> | null = null;
  private readonly languageId: string;
  private readonly uri: string;
  private readonly url: string;
  private readonly requestTimeoutMs: number;
  private readonly maxReconnectTries: number;
  private readonly reconnectIntervalMs: number;

  private notificationHandlers = new Map<string, (params: any) => void>();

  private diagnosticCallback: ((uri: string, diags: ILspDiagnostic[]) => void) | null = null;
  private disconnectCallback: (() => void) | null = null;
  private readyCallback: ((ready: boolean) => void) | null = null;

  // Stored so we can re-send didOpen on reconnect.
  private lastText: TLspDocumentText | null = null;
  private lastMetadata: Record<string, unknown> | undefined = undefined;

  /**
   * Captured from `initialize → capabilities.semanticTokensProvider.legend`
   * on the shared connection. `null` until the initialize response arrives,
   * and stays `null` if the server doesn't advertise semantic-token support.
   * Consumers (`useLspSemanticTokens`) need this legend to resolve the
   * `tokenType` / `tokenModifiers` int indices into names.
   */
  get semanticTokensLegend(): ILspSemanticTokensLegend | null {
    return this.conn?.semanticTokensLegend ?? null;
  }

  /**
   * Full `capabilities` block from the server's `initialize` response on the
   * shared connection. `null` until the handshake completes. Consumers gate
   * optional features on the presence of the relevant provider.
   */
  get capabilities(): ILspServerCapabilities | null {
    return this.conn?.capabilities ?? null;
  }

  constructor(options: IReqraftLspClientOptions) {
    this.languageId = options.languageId;
    this.uri = options.uri;
    this.url = options.url ?? DEFAULT_URL;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxReconnectTries = options.maxReconnectTries ?? DEFAULT_MAX_RECONNECT_TRIES;
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? DEFAULT_RECONNECT_INTERVAL_MS;
  }

  /**
   * Acquire the shared connection for this endpoint — opening the socket and
   * sending `initialize` only if this is the first client on it — and
   * resolve when the handshake is done. Re-entrant.
   */
  connect(): Promise<void> {
    if (this.connectPromise) {
      return this.connectPromise;
    }
    if (!this.conn) {
      this.conn = LspSharedConnection.acquire(
        this.url,
        {
          maxReconnectTries: this.maxReconnectTries,
          reconnectIntervalMs: this.reconnectIntervalMs,
        },
        this
      );
    }
    this.connectPromise = this.conn
      .connect()
      .then(() => {
        this.readyCallback?.(true);
      })
      .catch((err) => {
        // Allow a retry after failure.
        this.connectPromise = null;
        this.readyCallback?.(false);
        throw err;
      });
    return this.connectPromise;
  }

  /**
   * Release the shared connection. Sends `textDocument/didClose` first; the
   * socket itself only closes when the last client releases it. In-flight
   * requests from this client are left to their timeouts (their results are
   * ignored once the consumer has unmounted).
   */
  disconnect(): void {
    this.connectPromise = null;
    if (this.conn) {
      if (this.conn.connected) {
        try {
          this.sendNotification('textDocument/didClose', {
            textDocument: { uri: this.uri },
          });
        } catch {
          // best-effort
        }
      }
      this.conn.release(this);
      this.conn = null;
    }
  }


  /**
   * Send `textDocument/didOpen`. The optional `metadata` field is a
   * Qorus-specific extension that carries per-language context (e.g. DPQL
   * provider/recordType, Qonsole `/use` context). The standard LSP
   * `TextDocumentItem` does not include `metadata`, but the Qorus
   * `/lsp` handler reads it on open to bind context to the URI.
   */
  didOpen(text: TLspDocumentText, metadata?: Record<string, unknown>): void {
    this.lastText = text;
    this.lastMetadata = metadata;
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: this.uri,
        languageId: this.languageId,
        version: 1,
        text,
        metadata,
      },
    });
  }

  didChange(text: TLspDocumentText, version = 1): void {
    this.lastText = text;
    this.sendNotification('textDocument/didChange', {
      textDocument: { uri: this.uri, version },
      contentChanges: [{ text }],
    });
  }

  didClose(): void {
    this.sendNotification('textDocument/didClose', {
      textDocument: { uri: this.uri },
    });
  }


  /** Request completions at a cursor position. */
  async getCompletions(line: number, character: number): Promise<ILspCompletionItem[]> {
    const result = await this.sendRequest('textDocument/completion', {
      textDocument: { uri: this.uri },
      position: { line, character },
    });
    if (Array.isArray(result)) {
      return result;
    }
    return result?.items ?? [];
  }

  /** Request semantic-token data (the flat encoded array LSP defines). */
  async getSemanticTokens(): Promise<number[]> {
    const result = await this.sendRequest('textDocument/semanticTokens/full', {
      textDocument: { uri: this.uri },
    });
    return result?.data ?? [];
  }

  /**
   * Request `textDocument/formatting`. Returns the replacement text from the
   * first edit (LSP servers typically return a single full-document edit
   * for formatting), or `null` if the server returned no edits.
   */
  async format(options?: { tabSize?: number; insertSpaces?: boolean }): Promise<string | null> {
    const result = (await this.sendRequest('textDocument/formatting', {
      textDocument: { uri: this.uri },
      options: {
        tabSize: options?.tabSize ?? DEFAULT_TAB_SIZE,
        insertSpaces: options?.insertSpaces ?? true,
      },
    })) as ILspTextEdit[] | null | undefined;
    if (Array.isArray(result) && result.length > 0) {
      return result[0].newText ?? null;
    }
    return null;
  }

  /** Request hover info at a cursor position. */
  async getHover(
    line: number,
    character: number
  ): Promise<ILspMarkupContent | null> {
    const result = await this.sendRequest('textDocument/hover', {
      textDocument: { uri: this.uri },
      position: { line, character },
    });
    if (result?.contents) {
      // LSP allows MarkedString | MarkedString[] | MarkupContent. We only
      // surface MarkupContent here; consumers who need the legacy forms
      // can call customRequest('textDocument/hover', …) directly.
      if (
        typeof result.contents === 'object' &&
        'kind' in result.contents &&
        'value' in result.contents
      ) {
        return result.contents as ILspMarkupContent;
      }
    }
    return null;
  }

  /**
   * Request signature help at a cursor position — `textDocument/signatureHelp`.
   * Returns `null` when the server reports no signatures available
   * (LSP allows either an empty `signatures: []` response or `null`;
   * we normalise to `null` in both cases so consumers have one
   * "nothing here" condition to check).
   */
  async getSignatureHelp(
    line: number,
    character: number
  ): Promise<ILspSignatureHelp | null> {
    const result = await this.sendRequest('textDocument/signatureHelp', {
      textDocument: { uri: this.uri },
      position: { line, character },
    });
    if (!result || !Array.isArray(result.signatures) || result.signatures.length === 0) {
      return null;
    }
    return result as ILspSignatureHelp;
  }


  /**
   * Send a request with an arbitrary method name. Used by language-specific
   * wrappers for namespaced custom methods like `dpql/setContext` or
   * `qonsole/assist`. Returns the typed `result` field of the JSON-RPC
   * response; rejects on `error`.
   */
  customRequest<TResult = any>(method: string, params?: any): Promise<TResult> {
    return this.sendRequest(method, params) as Promise<TResult>;
  }

  /** Send a notification with an arbitrary method name (no response). */
  customNotification(method: string, params?: any): void {
    this.sendNotification(method, params);
  }


  /** Register a callback for `textDocument/publishDiagnostics` notifications. */
  onDiagnostics(
    callback: (uri: string, diags: ILspDiagnostic[]) => void
  ): void {
    this.diagnosticCallback = callback;
  }

  /** Register a callback for socket disconnection. */
  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }

  /** Register a callback for ready-state changes (connected + initialized). */
  onReady(callback: (ready: boolean) => void): void {
    this.readyCallback = callback;
  }

  /**
   * Register a callback for an arbitrary server-to-client notification
   * method. Useful for language-specific notifications beyond
   * `publishDiagnostics`. Replaces any previously registered handler for
   * the same method.
   */
  onNotification(
    method: string,
    callback: (params: any) => void
  ): void {
    this.notificationHandlers.set(method, callback);
  }

  offNotification(method: string): void {
    this.notificationHandlers.delete(method);
  }


  get isConnected(): boolean {
    return this.conn?.connected ?? false;
  }

  get documentUri(): string {
    return this.uri;
  }

  get documentLanguageId(): string {
    return this.languageId;
  }

  // The `_`-prefixed methods are called by `LspSharedConnection` to route
  // connection-level events to the right document client. Not public API.

  /** @internal Re-send `didOpen` after the shared socket reconnects. */
  _resyncAfterReconnect(): void {
    if (this.lastText !== null) {
      this.didOpen(this.lastText, this.lastMetadata);
    }
  }

  /** @internal */
  _notifyReady(ready: boolean): void {
    this.readyCallback?.(ready);
  }

  /** @internal */
  _notifyDisconnect(): void {
    this.disconnectCallback?.();
  }

  /** @internal Notification delivery from the shared connection. */
  _deliverNotification(method: string, params: any): void {
    this.handleNotification(method, params);
  }

  private handleNotification(method: string, params: any): void {
    if (method === 'textDocument/publishDiagnostics' && this.diagnosticCallback) {
      this.diagnosticCallback(params?.uri, params?.diagnostics ?? []);
      return;
    }
    const handler = this.notificationHandlers.get(method);
    if (handler) {
      handler(params);
    }
  }

  private sendRequest(method: string, params?: any): Promise<any> {
    if (!this.conn) {
      return Promise.reject(new Error('WebSocket not connected'));
    }
    return this.conn.sendRequest(method, params, this.requestTimeoutMs);
  }

  private sendNotification(method: string, params?: any): void {
    this.conn?.sendNotification(method, params);
  }
}

/**
 * @internal Test hook: close and drop every shared LSP connection so each
 * jest test starts with a clean registry (mirrors
 * `ReqraftWebSocketsManager.connections = {}` in the websocket tests).
 */
export const _resetSharedLspConnectionsForTests = (): void => {
  LspSharedConnection._resetForTests();
};
