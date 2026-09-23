// Shared mock-socket LSP harness for stories — owns the JSON-RPC plumbing
// (heartbeat, initialize, document tracking, request dispatch); story files
// register only their language-specific handlers.
import { Client, Server } from 'mock-socket';
import { storySocketUrl } from '../../../stories/storyNetwork';

/** Where `ReqraftLspClient` dials by default, on the instance stories use. */
export const MOCK_LSP_URL = storySocketUrl('lsp');

// LSP-standard 16-type / 6-modifier legend, as the real Qorus server
// advertises in `initialize` (qorus/Classes/QorusLspWebSocketHandler.qc:847).
export const SEMANTIC_TOKENS_LEGEND = {
  tokenTypes: [
    'namespace',
    'type',
    'class',
    'parameter',
    'variable',
    'property',
    'function',
    'method',
    'keyword',
    'modifier',
    'comment',
    'string',
    'number',
    'regexp',
    'operator',
    'decorator',
  ],
  tokenModifiers: [
    'declaration',
    'definition',
    'readonly',
    'static',
    'defaultLibrary',
    'documentation',
  ],
};

export const DEFAULT_LSP_CAPABILITIES = {
  semanticTokensProvider: {
    legend: SEMANTIC_TOKENS_LEGEND,
    full: true,
    range: true,
  },
};

export interface IMockLspParams {
  textDocument?: { uri?: string; text?: string; metadata?: Record<string, string> };
  contentChanges?: Array<{ text?: string }>;
  position?: { line: number; character: number };
  text?: string;
  [key: string]: unknown;
}

export interface IMockLspMessage {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: IMockLspParams;
}

// Returns the JSON-RPC `result` for requests; the return value is ignored
// for notifications (no `id`).
export type TMockLspHandler = (msg: IMockLspMessage, lsp: IMockLspServer) => unknown;

export interface IMockLspServerOptions {
  capabilities?: Record<string, unknown>;
  handlers?: Record<string, TMockLspHandler>;
  // Result for requests with no registered handler.
  defaultResult?: unknown;
  // Per-method response delay in ms; also mutable per story via `lsp.delays`.
  delays?: Record<string, number>;
}

export interface IMockLspServer {
  received: IMockLspMessage[];
  connectionCount: number;
  getOpenConnectionCount: () => number;
  // Most-recent document text from didOpen / didChange, whichever document.
  documentText: string;
  /**
   * The text of every open document, by URI. Clients share ONE socket per
   * endpoint and open a document each — an editor and several read-only
   * renderings at once — so a per-document answer (semantic tokens) must read
   * its own document, not whichever one changed last.
   */
  textOf: (uri?: string) => string;
  delays: Record<string, number>;
  notify: (method: string, params: unknown) => void;
  close: () => void;
}

/* One mock per URL at a time. `.storybook/preview.tsx` starts a default DPQL
   language server for every story, and a story that needs its own handlers
   creates a server on the same URL; mock-socket refuses a second server there,
   so creating one replaces whichever is listening. */
const activeServers = new Map<string, IMockLspServer>();

export const createMockLspServer = (
  url: string,
  options: IMockLspServerOptions = {}
): IMockLspServer => {
  // No connection reset here: `.storybook/preview.tsx` resets the shared LSP
  // connections (and the expression render client) before every story, which
  // covers stories that never create a mock server as well as those that do.
  activeServers.get(url)?.close();
  const server = new Server(url);
  const sockets: Client[] = [];
  const documents = new Map<string, string>();
  let closed = false;
  const lsp: IMockLspServer = {
    received: [],
    connectionCount: 0,
    getOpenConnectionCount: () => sockets.filter((socket) => socket.readyState === 1).length,
    documentText: '',
    textOf: (uri) => (uri !== undefined && documents.has(uri) ? documents.get(uri)! : lsp.documentText),
    delays: { ...options.delays },
    notify: (method, params) =>
      sockets.forEach((socket) =>
        socket.send(JSON.stringify({ jsonrpc: '2.0', method, params }))
      ),
    close: () => {
      /* Once only. mock-socket finds clients by URL, not by server, so closing a
         server that was already replaced would close its REPLACEMENT's clients
         — and the default server is closed twice when a story replaces it: once
         on replacement, once in the preview's teardown. */
      if (closed) {
        return;
      }
      closed = true;
      if (activeServers.get(url) === lsp) {
        activeServers.delete(url);
      }
      server.close();
      // `close()` drops the clients but leaves mock-socket's WebSocket installed
      // on the page; only `stop()` puts the real one back. Without it a story
      // that reaches a real server (`parameters.live`) dials the mock instead.
      server.stop();
    },
  };
  activeServers.set(url, lsp);

  server.on('connection', (socket) => {
    lsp.connectionCount++;
    sockets.push(socket);
    socket.on('message', (raw) => {
      // ReqraftWebSocket heartbeats are plain strings, not JSON-RPC.
      if (raw === 'ping') {
        socket.send('pong');
        return;
      }
      let msg: IMockLspMessage;
      try {
        msg = JSON.parse(raw as string);
      } catch {
        return;
      }
      lsp.received.push(msg);

      const uri = msg.params?.textDocument?.uri;
      if (msg.method === 'textDocument/didOpen') {
        lsp.documentText = msg.params?.textDocument?.text ?? '';
        if (uri !== undefined) {
          documents.set(uri, lsp.documentText);
        }
      } else if (msg.method === 'textDocument/didChange') {
        // The client sends a single full-document content change.
        const change = msg.params?.contentChanges?.[0];
        if (change && typeof change.text === 'string') {
          lsp.documentText = change.text;
          if (uri !== undefined) {
            documents.set(uri, change.text);
          }
        }
      } else if (msg.method === 'textDocument/didClose' && uri !== undefined) {
        documents.delete(uri);
      }

      const handler = options.handlers?.[msg.method];

      // Notifications (no `id`) get no response.
      if (msg.id === undefined) {
        handler?.(msg, lsp);
        return;
      }

      const result = handler
        ? handler(msg, lsp)
        : msg.method === 'initialize'
          ? { capabilities: options.capabilities ?? DEFAULT_LSP_CAPABILITIES }
          : (options.defaultResult ?? null);
      const response = JSON.stringify({ jsonrpc: '2.0', id: msg.id, result });
      const delay = lsp.delays[msg.method] ?? 0;
      if (delay > 0) {
        setTimeout(() => socket.send(response), delay);
      } else {
        socket.send(response);
      }
    });
  });

  return lsp;
};
