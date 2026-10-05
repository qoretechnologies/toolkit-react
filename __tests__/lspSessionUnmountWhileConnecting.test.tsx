// Copyright 2026 Qore Technologies, s.r.o.
/**
 * An editor that goes before its language server connection opens closes that connection itself, which
 * is not a failure: nothing is reported. A connection that fails while the editor is there still is.
 */
import { renderHook } from '@testing-library/react';
import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLspSession } from '../src/components/smartEditor/useLspSession';
import { _resetSharedLspConnectionsForTests } from '../src/utils/lspClient';
import { ReqraftWebSocketsManager } from '../src/utils/websocket';

let nanoidCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: () => `unmount-id-${++nanoidCounter}`,
}));

vi.mock('../src/utils/fetch', () => ({
  fetchConfig: {
    instance: 'http://localhost:8093/',
    instanceToken: 'test-token',
  },
  query: vi.fn().mockResolvedValue({ ok: true }),
}));

(global as any).WebSocket = MockWebSocket;

const WS_URL = 'ws://localhost:8093/lsp?token=test-token';

describe('an LSP session that ends while it connects', () => {
  let server: Server;
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // the server accepts the socket and never answers `initialize`: the session is still connecting
    server = new Server(WS_URL);
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
    server.stop();
    _resetSharedLspConnectionsForTests();
    ReqraftWebSocketsManager.connections = {};
  });

  it('reports nothing when the editor goes first', async () => {
    const { unmount } = renderHook(() => useLspSession({ languageId: 'dpql' } as never));
    unmount();
    // the connection's rejection is delivered after the unmount
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
    expect(errors.mock.calls.filter((call) => String(call[0]).includes('[LSP session]'))).toEqual([]);
  });
});
