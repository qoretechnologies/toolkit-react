import { Server, WebSocket as MockWebSocket, Client as MockClient } from 'mock-socket';
import { ReqraftLspClient, _resetSharedLspConnectionsForTests } from '../src/utils/lspClient';
import { ReqraftWebSocketsManager } from '../src/utils/websocket';

// Mock nanoid (ESM-only module) — same pattern as websocket.test.ts.
let nanoidCounter = 0;
jest.mock('nanoid', () => ({
  nanoid: () => `test-id-${++nanoidCounter}`,
}));

// Mock the fetch utility so ReqraftWebSocket has an instance host + token.
jest.mock('../src/utils/fetch', () => ({
  fetchConfig: {
    instance: 'http://localhost:8092/',
    instanceToken: 'test-token',
  },
  query: jest.fn().mockResolvedValue({ ok: true }),
}));

// Replace global WebSocket with mock-socket's implementation.
(global as any).WebSocket = MockWebSocket;

const WS_URL = 'ws://localhost:8092/lsp?token=test-token';

/**
 * Tiny in-process LSP server harness that:
 *   - waits for `initialize` and replies with empty capabilities
 *   - records every message it received
 *   - exposes helpers to send canned responses and push notifications
 *
 * The real `/lsp` backend speaks JSON-RPC 2.0 — this matches the on-wire
 * shape (`jsonrpc: '2.0'`, `id`, `method`, `params` / `result` / `error`).
 */
class LspServerHarness {
  received: any[] = [];
  /** Number of physical WebSocket connections the server has accepted. */
  connections = 0;
  private client: MockClient | null = null;

  constructor(server: Server) {
    server.on('connection', (socket) => {
      this.connections++;
      this.client = socket;
      socket.on('message', (raw) => {
        // Heartbeats from ReqraftWebSocket are plain 'ping' strings — ignore.
        if (raw === 'ping') {
          socket.send('pong');
          return;
        }
        let msg: any;
        try {
          msg = JSON.parse(raw as string);
        } catch {
          return;
        }
        this.received.push(msg);

        // Auto-respond to initialize so connect() resolves.
        if (msg.method === 'initialize' && msg.id !== undefined) {
          this.respond(msg.id, { capabilities: {} });
        }
      });
    });
  }

  respond(id: number, result: any): void {
    this.client?.send(JSON.stringify({ jsonrpc: '2.0', id, result }));
  }

  respondError(id: number, code: number, message: string): void {
    this.client?.send(
      JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
    );
  }

  notify(method: string, params: any): void {
    this.client?.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  }

  /** Find the first received message whose method matches; undefined otherwise. */
  receivedFor(method: string): any {
    return this.received.find((m) => m.method === method);
  }

  receivedAllFor(method: string): any[] {
    return this.received.filter((m) => m.method === method);
  }
}

/** Wait until predicate returns true, polling each tick, capped at timeoutMs. */
async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe('ReqraftLspClient', () => {
  let mockServer: Server;
  let harness: LspServerHarness;

  beforeEach(() => {
    ReqraftWebSocketsManager.connections = {};
    _resetSharedLspConnectionsForTests();
    mockServer = new Server(WS_URL);
    harness = new LspServerHarness(mockServer);
  });

  afterEach(() => {
    mockServer.close();
  });

  // ── Connect / initialize handshake ────────────────────────────────

  it('connects, sends initialize, and resolves connect()', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/1' });
    await client.connect();

    expect(harness.receivedFor('initialize')).toMatchObject({
      jsonrpc: '2.0',
      method: 'initialize',
      params: { capabilities: {} },
    });
    expect(client.isConnected).toBe(true);

    client.disconnect();
  });

  it('reuses the in-flight connect() promise when called twice', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/2' });
    const p1 = client.connect();
    const p2 = client.connect();
    expect(p1).toBe(p2);
    await Promise.all([p1, p2]);
    // Only one initialize should have been sent.
    expect(harness.receivedAllFor('initialize')).toHaveLength(1);
    client.disconnect();
  });

  // ── Request / response correlation ────────────────────────────────

  it('correlates request id with response and resolves with result', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/3' });
    await client.connect();

    const promise = client.customRequest<{ items: { label: string }[] }>(
      'textDocument/completion',
      { textDocument: { uri: 'dpql://test/3' }, position: { line: 0, character: 0 } }
    );

    await waitFor(() => !!harness.receivedFor('textDocument/completion'));
    const req = harness.receivedFor('textDocument/completion');
    expect(req.id).toBeDefined();
    expect(req.params.textDocument.uri).toBe('dpql://test/3');

    harness.respond(req.id, { items: [{ label: '@status' }] });

    const result = await promise;
    expect(result.items).toEqual([{ label: '@status' }]);

    client.disconnect();
  });

  it('rejects when the server returns a JSON-RPC error', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/4' });
    await client.connect();

    const promise = client.customRequest('dpql/setContext', { uri: 'dpql://test/4' });
    await waitFor(() => !!harness.receivedFor('dpql/setContext'));
    const req = harness.receivedFor('dpql/setContext');
    harness.respondError(req.id, -32602, 'invalid provider');

    await expect(promise).rejects.toThrow('-32602: invalid provider');

    client.disconnect();
  });

  it('times out unanswered requests', async () => {
    const client = new ReqraftLspClient({
      languageId: 'dpql',
      uri: 'dpql://test/5',
      requestTimeoutMs: 50,
    });
    await client.connect();

    const promise = client.customRequest('dpql/validate', {});
    await expect(promise).rejects.toThrow('timed out');

    client.disconnect();
  });

  // ── Notifications ──────────────────────────────────────────────────

  it('dispatches publishDiagnostics notifications to onDiagnostics callback', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/6' });
    const cb = jest.fn();
    client.onDiagnostics(cb);
    await client.connect();

    const diagnostics = [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
        message: 'unknown field',
        severity: 1,
      },
    ];
    harness.notify('textDocument/publishDiagnostics', {
      uri: 'dpql://test/6',
      diagnostics,
    });

    await waitFor(() => cb.mock.calls.length > 0);
    expect(cb).toHaveBeenCalledWith('dpql://test/6', diagnostics);

    client.disconnect();
  });

  it('dispatches arbitrary notifications via onNotification', async () => {
    const client = new ReqraftLspClient({ languageId: 'qonsole', uri: 'qonsole://chat/1' });
    const cb = jest.fn();
    client.onNotification('qonsole/sessionStateChanged', cb);
    await client.connect();

    harness.notify('qonsole/sessionStateChanged', { state: 'working' });
    await waitFor(() => cb.mock.calls.length > 0);
    expect(cb).toHaveBeenCalledWith({ state: 'working' });

    client.disconnect();
  });

  it('offNotification removes a previously registered handler', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/7' });
    const cb = jest.fn();
    client.onNotification('dpql/event', cb);
    client.offNotification('dpql/event');
    await client.connect();

    harness.notify('dpql/event', { foo: 'bar' });
    // Give the event loop a tick to deliver had it been registered.
    await new Promise((r) => setTimeout(r, 20));
    expect(cb).not.toHaveBeenCalled();

    client.disconnect();
  });

  // ── Document sync ──────────────────────────────────────────────────

  it('didOpen sends textDocument/didOpen with languageId and metadata', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/8' });
    await client.connect();

    client.didOpen('@status == "active"', { provider: 'datasource:mydb', recordType: 'record' });

    await waitFor(() => !!harness.receivedFor('textDocument/didOpen'));
    const msg = harness.receivedFor('textDocument/didOpen');
    expect(msg.params.textDocument).toMatchObject({
      uri: 'dpql://test/8',
      languageId: 'dpql',
      version: 1,
      text: '@status == "active"',
      metadata: { provider: 'datasource:mydb', recordType: 'record' },
    });

    client.disconnect();
  });

  it('didChange sends textDocument/didChange with the new text', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/9' });
    await client.connect();

    client.didChange('@status == "pending"', 2);

    await waitFor(() => !!harness.receivedFor('textDocument/didChange'));
    const msg = harness.receivedFor('textDocument/didChange');
    expect(msg.params).toMatchObject({
      textDocument: { uri: 'dpql://test/9', version: 2 },
      contentChanges: [{ text: '@status == "pending"' }],
    });

    client.disconnect();
  });

  // ── Standard feature wrappers ─────────────────────────────────────

  it('getCompletions unwraps both bare-array and {items: [...]} server responses', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/10' });
    await client.connect();

    // First call: server returns {items: [...]}
    const wrappedPromise = client.getCompletions(0, 0);
    await waitFor(() => harness.receivedAllFor('textDocument/completion').length === 1);
    let req = harness.receivedAllFor('textDocument/completion')[0];
    harness.respond(req.id, { items: [{ label: '@a' }] });
    expect(await wrappedPromise).toEqual([{ label: '@a' }]);

    // Second call: server returns a bare array
    const barePromise = client.getCompletions(0, 0);
    await waitFor(() => harness.receivedAllFor('textDocument/completion').length === 2);
    req = harness.receivedAllFor('textDocument/completion')[1];
    harness.respond(req.id, [{ label: '@b' }]);
    expect(await barePromise).toEqual([{ label: '@b' }]);

    client.disconnect();
  });

  it('format returns newText from the first edit, null when no edits', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/11' });
    await client.connect();

    // First: server returns an edit array
    const editPromise = client.format();
    await waitFor(() => harness.receivedAllFor('textDocument/formatting').length === 1);
    let req = harness.receivedAllFor('textDocument/formatting')[0];
    harness.respond(req.id, [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 100 },
        },
        newText: '@a == 1',
      },
    ]);
    expect(await editPromise).toBe('@a == 1');

    // Second: server returns empty array
    const emptyPromise = client.format();
    await waitFor(() => harness.receivedAllFor('textDocument/formatting').length === 2);
    req = harness.receivedAllFor('textDocument/formatting')[1];
    harness.respond(req.id, []);
    expect(await emptyPromise).toBeNull();

    client.disconnect();
  });

  // ── Disconnect behavior ────────────────────────────────────────────

  it('disconnect sends didClose and rejects pending requests', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/12' });
    await client.connect();

    const stuck = client.customRequest('dpql/parse', { text: 'x' });
    // Attach the rejection handler eagerly so disconnect()'s synchronous
    // rejection doesn't escape as an unhandledRejection before the
    // assertion below has a chance to wire up.
    const stuckRejected = expect(stuck).rejects.toThrow('Client disconnected');

    await waitFor(() => !!harness.receivedFor('dpql/parse'));

    client.disconnect();

    // didClose delivery is async via mock-socket — wait for it to arrive.
    await waitFor(() => !!harness.receivedFor('textDocument/didClose'));
    expect(harness.receivedFor('textDocument/didClose')).toBeDefined();
    // Pending request should have been rejected.
    await stuckRejected;
    expect(client.isConnected).toBe(false);
  });

  it('introspection getters reflect constructor arguments', () => {
    const client = new ReqraftLspClient({
      languageId: 'qonsole',
      uri: 'qonsole://chat/abc',
    });
    expect(client.documentLanguageId).toBe('qonsole');
    expect(client.documentUri).toBe('qonsole://chat/abc');
    expect(client.isConnected).toBe(false);
  });

  // ── Shared connection multiplexing ──────────────────────────────────

  it('multiplexes many clients over ONE shared socket, routing diagnostics by uri', async () => {
    const a = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://shared/a' });
    const b = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://shared/b' });
    await Promise.all([a.connect(), b.connect()]);

    // One physical connection, one initialize handshake — N editors, 1 socket.
    expect(harness.connections).toBe(1);
    expect(harness.receivedAllFor('initialize')).toHaveLength(1);

    // Diagnostics route to the owning document only.
    const got = { a: 0, b: 0 };
    a.onDiagnostics(() => {
      got.a++;
    });
    b.onDiagnostics(() => {
      got.b++;
    });
    harness.notify('textDocument/publishDiagnostics', {
      uri: 'dpql://shared/b',
      diagnostics: [{ message: 'x' }],
    });
    await waitFor(() => got.b === 1);
    expect(got.a).toBe(0);

    // Releasing one client keeps the shared socket alive for the other.
    a.disconnect();
    const p = b.customRequest('dpql/parse', { text: 'x' });
    await waitFor(() => !!harness.receivedFor('dpql/parse'));
    harness.respond(harness.receivedFor('dpql/parse').id, { ok: true });
    await expect(p).resolves.toEqual({ ok: true });
    expect(b.isConnected).toBe(true);

    b.disconnect();
  });

  // ── Reconnect & lifecycle edge cases ────────────────────────────────

  // Drop the current socket and stand up a fresh server on the same URL.
  // ReqraftWebSocket's first reconnect attempt is immediate, so the new
  // server is in place before the retry lands.
  const dropAndRecover = () => {
    mockServer.close();
    mockServer = new Server(WS_URL);
    harness = new LspServerHarness(mockServer);
  };

  it('re-sends didOpen and re-fires ready after a transient socket drop', async () => {
    const client = new ReqraftLspClient({
      languageId: 'dpql',
      uri: 'dpql://test/reconnect',
      reconnectIntervalMs: 30,
    });
    const readyStates: boolean[] = [];
    client.onReady((r) => readyStates.push(r));
    await client.connect();
    client.didOpen('@status == "active"', { provider: 'p' });
    await waitFor(() => !!harness.receivedFor('textDocument/didOpen'));
    expect(readyStates).toEqual([true]);

    dropAndRecover();

    // The reconnect must re-handshake AND re-open the document so the
    // server rebuilds its per-uri session state.
    await waitFor(() => !!harness.receivedFor('textDocument/didOpen'), 3000);
    const reopened = harness.receivedFor('textDocument/didOpen');
    expect(reopened.params.textDocument.text).toBe('@status == "active"');
    expect(reopened.params.textDocument.metadata).toEqual({ provider: 'p' });
    expect(harness.receivedFor('initialize')).toBeDefined();

    // Ready cycled false on the drop, then true again after resync.
    await waitFor(() => readyStates.length >= 3 && readyStates[readyStates.length - 1] === true);
    expect(readyStates).toContain(false);
    expect(readyStates[readyStates.length - 1]).toBe(true);

    client.disconnect();
  });

  it('resyncs every multiplexed client after a single shared reconnect', async () => {
    const a = new ReqraftLspClient({
      languageId: 'dpql',
      uri: 'dpql://shared/ra',
      reconnectIntervalMs: 30,
    });
    const b = new ReqraftLspClient({
      languageId: 'dpql',
      uri: 'dpql://shared/rb',
      reconnectIntervalMs: 30,
    });
    await Promise.all([a.connect(), b.connect()]);
    a.didOpen('a-text');
    b.didOpen('b-text');
    await waitFor(() => harness.receivedAllFor('textDocument/didOpen').length === 2);

    dropAndRecover();

    // One physical reconnect, one re-handshake — BOTH documents re-open.
    await waitFor(() => harness.receivedAllFor('textDocument/didOpen').length === 2, 3000);
    expect(harness.connections).toBe(1);
    expect(harness.receivedAllFor('initialize')).toHaveLength(1);
    const texts = harness
      .receivedAllFor('textDocument/didOpen')
      .map((m) => m.params.textDocument.text)
      .sort();
    expect(texts).toEqual(['a-text', 'b-text']);

    a.disconnect();
    b.disconnect();
  });

  it('a late client joining an already-open connection is ready without a second initialize', async () => {
    const a = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://shared/la' });
    await a.connect();
    expect(harness.receivedAllFor('initialize')).toHaveLength(1);

    // B arrives AFTER A's handshake already resolved.
    const b = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://shared/lb' });
    const bReady: boolean[] = [];
    b.onReady((r) => bReady.push(r));
    await b.connect();

    expect(bReady).toEqual([true]);
    expect(harness.connections).toBe(1);
    expect(harness.receivedAllFor('initialize')).toHaveLength(1);

    a.disconnect();
    b.disconnect();
  });

  it('handles disconnect() called before connect() resolves', async () => {
    const client = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/dispose' });
    const connectP = client.connect();
    // The in-flight handshake may reject when the socket is torn down
    // mid-connect — swallow it so it doesn't surface as an unhandled
    // rejection; the assertion is on the resulting state.
    connectP.catch(() => undefined);
    client.disconnect();

    expect(client.isConnected).toBe(false);

    // The shared connection was released cleanly — a fresh client connects.
    const fresh = new ReqraftLspClient({ languageId: 'dpql', uri: 'dpql://test/dispose2' });
    await fresh.connect();
    expect(fresh.isConnected).toBe(true);
    fresh.disconnect();
  });
});
