// Copyright 2026 Qore Technologies, s.r.o.
// The "Explain" seam. Turns an expression AST into a readable string.
//
// The canonical rendering is the server's `DataProvider::renderExpression`,
// reached over the LSP custom method `dpql/renderExpression` (added next to
// `dpql/serialize` in `QorusLspWebSocketHandler.qc`). All consumers share ONE
// render socket: the module-level `ReqraftLspClient` below rides the per-endpoint
// `LspSharedConnection`, and JSON-RPC request ids associate each response
// with the caller — N expression builders on one form means N independent
// in-flight requests on one connection, no cross-wiring.
//
// When the LSP is unreachable (or the server predates the method), `render`
// falls back to the client-side approximation below; `serverRendering` tells
// consumers which path served.
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReqraftLspClient } from '../../../utils/lspClient';
import { IExpressionSchema, IExpressionValue } from './types';

export { renderExpressionToText } from './renderExpressionToText';
import { renderExpressionToText } from './renderExpressionToText';

// ── The shared render transport ───────────────────────────────────────
// One lazy module-level client for ALL `useRenderExpression` consumers.
// Rendering needs no document/context state, so a single connection (shared
// further with any open DPQL editors via `LspSharedConnection`) serves
// every builder on the page.

/** Coalesce rapid re-renders per consumer (live typing) — trailing edge. */
const RENDER_DEBOUNCE_MS = 300;
/** How long a render call waits for the socket before falling back. */
const CONNECT_WAIT_MS = 1500;
/** After a failed wait, fall back instantly for this long before re-waiting. */
const CONNECT_RETRY_COOLDOWN_MS = 10000;

let renderClient: ReqraftLspClient | null = null;
/** Set after a `-32601 method not found` — the server predates the method. */
let methodUnsupported = false;
let lastConnectWaitFailedAt = 0;

let lastServerRendering = false;
const serverRenderingListeners = new Set<(on: boolean) => void>();
const setLastServerRendering = (on: boolean): void => {
  if (on !== lastServerRendering) {
    lastServerRendering = on;
    serverRenderingListeners.forEach((listener) => listener(on));
  }
};

const getRenderClient = (): ReqraftLspClient => {
  if (!renderClient) {
    renderClient = new ReqraftLspClient({
      languageId: 'dpql',
      // Opaque per-load URI; `dpql/renderExpression` is stateless (no
      // `didOpen` needed), the URI only identifies the client locally.
      uri: `inmemory://reqraft/render-expression/${nanoid()}`,
    });
  }
  return renderClient;
};

/**
 * Wait (briefly) for the shared connection. `connect()` is re-entrant and the
 * underlying socket keeps its own reconnect schedule, so this only bounds how
 * long a single render call blocks before falling back — after a failed wait
 * we fall back instantly for a cooldown period instead of re-blocking.
 */
const waitForConnection = async (client: ReqraftLspClient): Promise<boolean> => {
  if (client.isConnected) return true;
  if (Date.now() - lastConnectWaitFailedAt < CONNECT_RETRY_COOLDOWN_MS) {
    return false;
  }
  const connected = await Promise.race([
    client.connect().then(
      () => true,
      () => false
    ),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), CONNECT_WAIT_MS);
    }),
  ]);
  if (!connected || !client.isConnected) {
    lastConnectWaitFailedAt = Date.now();
    return false;
  }
  return true;
};

/** One rendered expression — what `renderRich` resolves with. */
export interface IRenderedExpression {
  /** The readable rendering (plain text). */
  text: string;
  /**
   * The server's richtext form — template references arrive as `tag` nodes
   * (the IDE renders them as chips). `null` on the client-side fallback.
   * Convert with `richtextResponseToSlate` for `RichTextFormField`.
   */
  richtext: unknown | null;
  /** `true` when the server `dpql/renderExpression` produced this result. */
  server: boolean;
}

/** Server-side render; `null` means "fall back to the client-side path". */
const renderViaServer = async (
  value: IExpressionValue
): Promise<{ text: string; richtext: unknown | null } | null> => {
  if (methodUnsupported) return null;
  const client = getRenderClient();
  if (!(await waitForConnection(client))) return null;
  try {
    const result = await client.customRequest<{ rendered?: string; richtext?: unknown }>(
      'dpql/renderExpression',
      // The server accepts both the bare `{exp, args}` AST and the
      // `{is_expression, value}` wrapper; consumers pass the bare AST.
      { expression: value }
    );
    return typeof result?.rendered === 'string'
      ? { text: result.rendered, richtext: result.richtext ?? null }
      : null;
  } catch (err) {
    // `ReqraftLspClient` rejections are `Error('<code>: <message>')`.
    if (err instanceof Error && err.message.startsWith('-32601')) {
      methodUnsupported = true;
    }
    return null;
  }
};

/** @internal Test hook — drop the module-level client + cached health state. */
export const _resetRenderExpressionTransportForTests = (): void => {
  renderClient?.disconnect();
  renderClient = null;
  methodUnsupported = false;
  lastConnectWaitFailedAt = 0;
  lastServerRendering = false;
};

interface IPendingRender {
  value: IExpressionValue;
  expressions: IExpressionSchema[];
  resolvers: Array<(rendered: IRenderedExpression) => void>;
}

export interface IUseRenderExpressionResult {
  /** Render an expression AST to a readable string. */
  render: (value: IExpressionValue, expressions?: IExpressionSchema[]) => Promise<string>;
  /**
   * Like `render`, but also resolves the server's richtext form (template
   * references as `tag` nodes — chips) and which path served. For consumers
   * that style the rendering, e.g. the builder's Explain panel.
   */
  renderRich: (
    value: IExpressionValue,
    expressions?: IExpressionSchema[]
  ) => Promise<IRenderedExpression>;
  /**
   * `true` when the server `dpql/renderExpression` path served the last
   * render; `false` while on the client-side approximation (LSP unreachable
   * or the server predates the method).
   */
  serverRendering: boolean;
}

export const useRenderExpression = (): IUseRenderExpressionResult => {
  const [serverRendering, setServerRendering] = useState(lastServerRendering);
  const pendingRef = useRef<IPendingRender | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRunRef = useRef(0);

  useEffect(() => {
    serverRenderingListeners.add(setServerRendering);
    return () => {
      serverRenderingListeners.delete(setServerRendering);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Settle any coalesced callers with the synchronous fallback so no
      // promise is left hanging past unmount.
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.resolvers.forEach((resolve) =>
        resolve({
          text: renderExpressionToText(pending.value, pending.expressions),
          richtext: null,
          server: false,
        })
      );
    };
  }, []);

  const renderRich = useCallback(
    (
      value: IExpressionValue,
      expressions: IExpressionSchema[] = []
    ): Promise<IRenderedExpression> =>
      new Promise<IRenderedExpression>((resolve) => {
        // Coalesce calls per consumer: rapid live updates collapse to the
        // newest AST; every awaiting caller gets that newest rendering.
        pendingRef.current = {
          value,
          expressions,
          resolvers: [...(pendingRef.current?.resolvers ?? []), resolve],
        };

        const run = async (): Promise<void> => {
          const job = pendingRef.current;
          pendingRef.current = null;
          if (!job) return;
          lastRunRef.current = Date.now();
          let outcome: IRenderedExpression;
          if (!job.value?.exp) {
            outcome = { text: '', richtext: null, server: false };
          } else {
            const served = await renderViaServer(job.value);
            setLastServerRendering(served !== null);
            outcome = served
              ? { ...served, server: true }
              : {
                  text: renderExpressionToText(job.value, job.expressions),
                  richtext: null,
                  server: false,
                };
          }
          job.resolvers.forEach((r) => r(outcome));
        };

        if (timerRef.current) return; // a run is already scheduled
        const elapsed = Date.now() - lastRunRef.current;
        if (elapsed >= RENDER_DEBOUNCE_MS) {
          void run(); // leading edge — single calls render immediately
        } else {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void run();
          }, RENDER_DEBOUNCE_MS - elapsed);
        }
      }),
    []
  );

  const render = useCallback(
    (value: IExpressionValue, expressions: IExpressionSchema[] = []): Promise<string> =>
      renderRich(value, expressions).then((r) => r.text),
    [renderRich]
  );

  return { render, renderRich, serverRendering };
};
