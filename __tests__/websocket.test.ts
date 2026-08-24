import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import {
  ReqraftWebSocket,
  ReqraftWebSocketsManager,
} from '../src/utils/websocket';
import { query } from '../src/utils/fetch';

// Mock nanoid (ESM-only module)
let nanoidCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: () => `test-id-${++nanoidCounter}`,
}));

// Mock the fetch utility
vi.mock('../src/utils/fetch', () => ({
  fetchConfig: {
    instance: 'http://localhost:8092/',
    instanceToken: 'test-token',
  },
  query: vi.fn().mockResolvedValue({ ok: true }),
}));

// Replace global WebSocket with mock-socket's implementation
(global as any).WebSocket = MockWebSocket;

const WS_URL = 'ws://localhost:8092/lsp?token=test-token';

describe('ReqraftWebSocket', () => {
  let mockServer: Server;

  beforeEach(() => {
    // Clean up any existing connections
    ReqraftWebSocketsManager.connections = {};
    mockServer = new Server(WS_URL);
  });

  afterEach(() => {
    mockServer.close();
  });

  describe('pooled option (default behavior)', () => {
    it('should share the same WebSocket when two instances connect to the same URL', () => {
      const onOpen1 = vi.fn();
      const onOpen2 = vi.fn();

      const ws1 = new ReqraftWebSocket({
        url: 'lsp',
        useHeartbeat: false,
        reconnect: false,
        onOpen: onOpen1,
      });

      const ws2 = new ReqraftWebSocket({
        url: 'lsp',
        useHeartbeat: false,
        reconnect: false,
        onOpen: onOpen2,
      });

      // Both should reference the same underlying socket
      expect(ws1.socket).toBe(ws2.socket);
      // Pool entry should have using === 2
      expect(ReqraftWebSocketsManager.connections['lsp'].using).toBe(2);
    });

    it('should share the same WebSocket when pooled is explicitly true', () => {
      const ws1 = new ReqraftWebSocket({
        url: 'lsp',
        pooled: true,
        useHeartbeat: false,
        reconnect: false,
      });

      const ws2 = new ReqraftWebSocket({
        url: 'lsp',
        pooled: true,
        useHeartbeat: false,
        reconnect: false,
      });

      expect(ws1.socket).toBe(ws2.socket);
      expect(ReqraftWebSocketsManager.connections['lsp'].using).toBe(2);
    });

    it('should decrement using count on remove but not close shared socket', () => {
      const ws1 = new ReqraftWebSocket({
        url: 'lsp',
        useHeartbeat: false,
        reconnect: false,
      });

      // Second client on the same pool key — only the side effect matters.
      new ReqraftWebSocket({
        url: 'lsp',
        useHeartbeat: false,
        reconnect: false,
      });

      expect(ReqraftWebSocketsManager.connections['lsp'].using).toBe(2);

      ws1.remove();

      // Connection should still exist with using === 1
      expect(ReqraftWebSocketsManager.connections['lsp']).toBeDefined();
      expect(ReqraftWebSocketsManager.connections['lsp'].using).toBe(1);
    });
  });

  describe('pooled: false (isolated connections)', () => {
    it('should create separate WebSocket connections for the same URL', () => {
      const ws1 = new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      const ws2 = new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      // They should NOT share the same socket
      expect(ws1.socket).not.toBe(ws2.socket);
    });

    it('should use unique pool keys for isolated connections', () => {
      // Instances matter only for their pool-registry side effects.
      new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      // There should be 2 separate entries in connections (with unique keys)
      const connectionKeys = Object.keys(ReqraftWebSocketsManager.connections);
      expect(connectionKeys.length).toBe(2);

      // Both keys should start with 'lsp::' but be different
      expect(connectionKeys[0]).toMatch(/^lsp::/);
      expect(connectionKeys[1]).toMatch(/^lsp::/);
      expect(connectionKeys[0]).not.toBe(connectionKeys[1]);
    });

    it('should each have using === 1', () => {
      new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      const connectionKeys = Object.keys(ReqraftWebSocketsManager.connections);
      expect(ReqraftWebSocketsManager.connections[connectionKeys[0]].using).toBe(1);
      expect(ReqraftWebSocketsManager.connections[connectionKeys[1]].using).toBe(1);
    });

    it('removing an isolated connection should not affect other connections', () =>
      new Promise<void>((resolve) => {
        const ws1 = new ReqraftWebSocket({
          url: 'lsp',
          pooled: false,
          useHeartbeat: false,
          reconnect: false,
        });

        const ws2 = new ReqraftWebSocket({
          url: 'lsp',
          pooled: false,
          useHeartbeat: false,
          reconnect: false,
        });

        const connectionKeysBefore = Object.keys(ReqraftWebSocketsManager.connections);
        expect(connectionKeysBefore.length).toBe(2);

        // The close event fires asynchronously, so we check after a tick
        ws1.remove();

        setTimeout(() => {
          // Only one connection should remain after the close event fires
          const connectionKeysAfter = Object.keys(ReqraftWebSocketsManager.connections);
          expect(connectionKeysAfter.length).toBe(1);

          // ws2's socket should still be accessible
          expect(ws2.socket).toBeDefined();
          resolve();
        }, 50);
      }));

    it('should still use the correct URL for the actual WebSocket connection', () => {
      const ws = new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      // The actual WebSocket URL should use the real URL, not the pool key
      expect(ws.socket.url).toBe(WS_URL);
    });
  });

  describe('mixed pooled and isolated connections', () => {
    it('should not interfere with each other', () => {
      const pooled1 = new ReqraftWebSocket({
        url: 'lsp',
        useHeartbeat: false,
        reconnect: false,
      });

      const pooled2 = new ReqraftWebSocket({
        url: 'lsp',
        useHeartbeat: false,
        reconnect: false,
      });

      const isolated = new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      // Pooled instances share a socket
      expect(pooled1.socket).toBe(pooled2.socket);

      // Isolated instance has its own socket
      expect(isolated.socket).not.toBe(pooled1.socket);

      // 2 entries in connections: one for pooled ('lsp'), one for isolated ('lsp::...')
      const connectionKeys = Object.keys(ReqraftWebSocketsManager.connections);
      expect(connectionKeys.length).toBe(2);

      // The pooled connection should have using === 2
      expect(ReqraftWebSocketsManager.connections['lsp'].using).toBe(2);
    });

    it('removing isolated connection should not affect pooled connections', () => {
      const pooled1 = new ReqraftWebSocket({
        url: 'lsp',
        useHeartbeat: false,
        reconnect: false,
      });

      const pooled2 = new ReqraftWebSocket({
        url: 'lsp',
        useHeartbeat: false,
        reconnect: false,
      });

      const isolated = new ReqraftWebSocket({
        url: 'lsp',
        pooled: false,
        useHeartbeat: false,
        reconnect: false,
      });

      isolated.remove();

      // Pooled connections should be unaffected
      expect(ReqraftWebSocketsManager.connections['lsp']).toBeDefined();
      expect(ReqraftWebSocketsManager.connections['lsp'].using).toBe(2);
      expect(pooled1.socket).toBe(pooled2.socket);
    });
  });

  describe('reconnecting when the server is unreachable', () => {
    // The reconnect path had NO unit coverage — every other test here passes
    // `reconnect: false`, and the module mock resolves `query` unconditionally,
    // so the one case that matters in production was never exercised.
    afterEach(() => {
      (query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true } as never);
    });

    it('still reconnects when the server-status probe rejects', async () => {
      // The probe is advisory — it exists so a dead session can redirect on a
      // 401. `query()` REJECTS on a network error, and a network error is the
      // normal state while reconnecting: the server being unreachable is the
      // reason we are here. Awaiting it unguarded skipped `connect()`, so the
      // socket never closed again, `maybeReconnect()` was never called again,
      // and the state machine stopped silently — no further attempts, and no
      // `onReconnectFailed` for a caller to react to.
      (query as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));

      const socket = new ReqraftWebSocket({
        url: WS_URL,
        reconnect: true,
        maxReconnectTries: 2,
        reconnectInterval: 1,
        pooled: false,
      });
      const connect = vi.spyOn(socket, 'connect');

      socket.reconnectTries = 0;
      socket.maybeReconnect(1006);

      await vi.waitFor(() => expect(connect).toHaveBeenCalled());

      socket.remove();
    });

    it('reports failure once the tries are exhausted', async () => {
      // The end of the same chain: whatever the probe did, a caller waiting to
      // be told the reconnect gave up must actually be told.
      (query as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed to fetch'));
      const onReconnectFailed = vi.fn();

      const socket = new ReqraftWebSocket({
        url: WS_URL,
        reconnect: true,
        maxReconnectTries: 2,
        reconnectInterval: 1,
        pooled: false,
        onReconnectFailed,
      });

      socket.reconnectTries = socket.options.maxReconnectTries;
      socket.maybeReconnect(1006);

      expect(onReconnectFailed).toHaveBeenCalled();

      socket.remove();
    });
  });
});
