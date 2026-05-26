// Copyright 2026 Qore Technologies, s.r.o.
//
// Generic JSON-RPC 2.0 LSP client over a `ReqraftWebSocket`. Targets the
// shared `/lsp` endpoint and is parameterized by `languageId` so the same
// client class can drive any language server the backend exposes — DPQL,
// Qonsole, Qore, Python, … The standard LSP document-sync + feature
// requests live on this class; language-specific custom methods
// (e.g. `dpql/setContext`) are exposed via `customRequest()` and are
// typically wrapped by per-language convenience classes layered on top.
//
// Each LspClient instance owns one isolated WebSocket (`pooled: false`)
// because LSP sessions have per-document state (a `dpql-${uri}` session
// on the server, for instance). Sharing the socket between unrelated
// editors would conflate diagnostics and request/response correlation.

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

export interface ILspClientOptions {
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
  resolve: (value: any) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  method: string;
}

/**
 * JSON-RPC 2.0 client speaking LSP over a single isolated `ReqraftWebSocket`.
 * One `LspClient` instance manages one document URI.
 */
export class LspClient {
  private rws: ReqraftWebSocket | null = null;
  private readonly languageId: string;
  private readonly uri: string;
  private readonly url: string;
  private readonly requestTimeoutMs: number;
  private readonly maxReconnectTries: number;
  private readonly reconnectIntervalMs: number;

  private nextId = 1;
  private pending = new Map<number, IPendingRequest>();
  private notificationHandlers = new Map<string, (params: any) => void>();

  private diagnosticCallback: ((uri: string, diags: ILspDiagnostic[]) => void) | null = null;
  private disconnectCallback: (() => void) | null = null;
  private readyCallback: ((ready: boolean) => void) | null = null;

  private connected = false;
  private initPromise: Promise<void> | null = null;

  // Stored so we can re-send didOpen on reconnect.
  private lastText: TLspDocumentText | null = null;
  private lastMetadata: Record<string, any> | undefined = undefined;

  /**
   * Captured from `initialize → capabilities.semanticTokensProvider.legend`.
   * `null` until the initialize response arrives, and stays `null` if the
   * server doesn't advertise semantic-token support. Consumers
   * (`useLspSemanticTokens`) need this legend to resolve the
   * `tokenType` / `tokenModifiers` int indices into human-readable
   * names — both arrays are positional.
   *
   * Kept as a top-level field for backwards compatibility with the
   * pre-`capabilities` API; new code should prefer
   * `capabilities?.semanticTokensProvider?.legend`.
   */
  public semanticTokensLegend: ILspSemanticTokensLegend | null = null;

  /**
   * Full `capabilities` block from the server's `initialize` response.
   * `null` until the handshake completes. Consumers gate optional
   * features on the presence of the relevant provider — e.g.
   * `useLspSignatureHelp` only fires requests when
   * `capabilities?.signatureHelpProvider` is present, and reads
   * `triggerCharacters` from it. Forward-compatible: unknown
   * providers pass through the `[key: string]: unknown` index
   * signature in `ILspServerCapabilities`.
   */
  public capabilities: ILspServerCapabilities | null = null;

  constructor(options: ILspClientOptions) {
    this.languageId = options.languageId;
    this.uri = options.uri;
    this.url = options.url ?? DEFAULT_URL;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxReconnectTries = options.maxReconnectTries ?? DEFAULT_MAX_RECONNECT_TRIES;
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? DEFAULT_RECONNECT_INTERVAL_MS;
  }

  /**
   * Open the WebSocket, send `initialize`, resolve when the server replies.
   * Re-entrant: subsequent calls return the in-flight (or resolved) promise.
   */
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
        maxReconnectTries: this.maxReconnectTries,
        reconnectInterval: this.reconnectIntervalMs,
        useHeartbeat: true,
        onOpen: () => {
          this.connected = true;

          this.sendRequest('initialize', { capabilities: {} })
            .then((initResult: any) => {
              // Capture the full capabilities block. Consumers gate
              // optional features (signatureHelp, semantic tokens, …)
              // on the presence of the relevant provider so we degrade
              // gracefully against servers that don't support them.
              const caps = initResult?.capabilities;
              this.capabilities =
                caps && typeof caps === 'object'
                  ? (caps as ILspServerCapabilities)
                  : null;

              // Also keep the dedicated `semanticTokensLegend` field
              // for backwards compat — `useLspSemanticTokens` reads it
              // directly. Standard LSP shape:
              // `{ tokenTypes: string[], tokenModifiers: string[] }`.
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
                resolve();
              } else if (this.lastText !== null) {
                // Reconnect: re-open the document with last known text.
                this.didOpen(this.lastText, this.lastMetadata);
              }
              this.readyCallback?.(true);
            })
            .catch((err) => {
              if (initialConnect) {
                initialConnect = false;
                reject(err);
              }
              this.readyCallback?.(false);
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
                pending.reject(
                  new Error(`${msg.error.code}: ${msg.error.message}`)
                );
              } else {
                pending.resolve(msg.result);
              }
            }
            return;
          }

          // Notification (has method, no id)
          if (msg.method) {
            this.handleNotification(msg.method, msg.params);
          }
        },
        onClose: () => {
          this.connected = false;
          this.readyCallback?.(false);
          // Reject all pending requests.
          this.pending.forEach((p) => {
            clearTimeout(p.timer);
            p.reject(new Error('WebSocket closed'));
          });
          this.pending.clear();
          if (this.disconnectCallback) {
            this.disconnectCallback();
          }
        },
        onError: () => {
          // onClose fires after onError; rejection happens there.
        },
      });
    });

    // Clear initPromise on failure so connect() can be retried after error.
    this.initPromise.catch(() => {
      this.initPromise = null;
    });

    return this.initPromise;
  }

  /** Close the WebSocket and clean up. Sends `textDocument/didClose` first. */
  disconnect(): void {
    this.initPromise = null;

    if (this.rws) {
      // Disable reconnect before cleanup to prevent zombie reconnect timers.
      this.rws.options.reconnect = false;
      clearTimeout(this.rws.reconnectInterval);

      if (this.connected) {
        try {
          this.sendNotification('textDocument/didClose', {
            textDocument: { uri: this.uri },
          });
        } catch {
          // best-effort
        }
      }

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

  // ── Standard LSP document sync ──────────────────────────────────────

  /**
   * Send `textDocument/didOpen`. The optional `metadata` field is a
   * Qorus-specific extension that carries per-language context (e.g. DPQL
   * provider/recordType, Qonsole `/use` context). The standard LSP
   * `TextDocumentItem` does not include `metadata`, but the Qorus
   * `/lsp` handler reads it on open to bind context to the URI.
   */
  didOpen(text: TLspDocumentText, metadata?: Record<string, any>): void {
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

  /** Send `textDocument/didChange` with full document sync. */
  didChange(text: TLspDocumentText, version = 1): void {
    this.lastText = text;
    this.sendNotification('textDocument/didChange', {
      textDocument: { uri: this.uri, version },
      contentChanges: [{ text }],
    });
  }

  /** Send `textDocument/didClose`. Usually `disconnect()` does this for you. */
  didClose(): void {
    this.sendNotification('textDocument/didClose', {
      textDocument: { uri: this.uri },
    });
  }

  // ── Standard LSP feature requests ───────────────────────────────────

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

  // ── Custom-method dispatch (language-specific extensions) ───────────

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

  // ── Event registration ──────────────────────────────────────────────

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

  /** Detach a previously registered notification handler. */
  offNotification(method: string): void {
    this.notificationHandlers.delete(method);
  }

  // ── Introspection ───────────────────────────────────────────────────

  /** True between successful `connect()` and `disconnect()` / socket close. */
  get isConnected(): boolean {
    return this.connected;
  }

  /** The document URI this client is bound to. */
  get documentUri(): string {
    return this.uri;
  }

  /** The LSP language ID this client opened the document with. */
  get documentLanguageId(): string {
    return this.languageId;
  }

  // ── Internal ────────────────────────────────────────────────────────

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
    return new Promise((resolve, reject) => {
      if (
        !this.rws?.socket ||
        this.rws.socket.readyState !== WebSocket.OPEN
      ) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = this.nextId++;

      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, this.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timer, method });

      const msg: any = { jsonrpc: '2.0', id, method };
      if (params !== undefined) {
        msg.params = params;
      }
      this.rws.socket.send(JSON.stringify(msg));
    });
  }

  private sendNotification(method: string, params?: any): void {
    if (
      !this.rws?.socket ||
      this.rws.socket.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    const msg: any = { jsonrpc: '2.0', method };
    if (params !== undefined) {
      msg.params = params;
    }
    this.rws.socket.send(JSON.stringify(msg));
  }
}
