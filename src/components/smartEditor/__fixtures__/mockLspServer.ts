// Shared mock-socket LSP harness for stories — owns the JSON-RPC plumbing
// (heartbeat, initialize, document tracking, request dispatch); story files
// register only their language-specific handlers.
import { Client, Server } from 'mock-socket';

export const MOCK_LSP_URL = `wss://hq.qoretechnologies.com:8092/lsp?token=${process.env.REACT_APP_QORUS_TOKEN}`;

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
  // Most-recent document text from didOpen / didChange.
  documentText: string;
  delays: Record<string, number>;
  notify: (method: string, params: unknown) => void;
  close: () => void;
}

export const createMockLspServer = (
  url: string,
  options: IMockLspServerOptions = {}
): IMockLspServer => {
  const server = new Server(url);
  const sockets: Client[] = [];
  const lsp: IMockLspServer = {
    received: [],
    connectionCount: 0,
    getOpenConnectionCount: () => sockets.filter((socket) => socket.readyState === 1).length,
    documentText: '',
    delays: { ...options.delays },
    notify: (method, params) =>
      sockets.forEach((socket) =>
        socket.send(JSON.stringify({ jsonrpc: '2.0', method, params }))
      ),
    close: () => server.close(),
  };

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

      if (msg.method === 'textDocument/didOpen') {
        lsp.documentText = msg.params?.textDocument?.text ?? '';
      } else if (msg.method === 'textDocument/didChange') {
        // The client sends a single full-document content change.
        const change = msg.params?.contentChanges?.[0];
        if (change && typeof change.text === 'string') {
          lsp.documentText = change.text;
        }
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
