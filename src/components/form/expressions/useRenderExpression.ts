// Copyright 2026 Qore Technologies, s.r.o.
// The "Explain" seam. Turns an expression AST into its readable rendering.
//
// The rendering is the server's `DataProvider::renderExpression`, reached over
// the LSP custom method `dpql/renderExpression` (added next to `dpql/serialize`
// in `QorusLspWebSocketHandler.qc`). All consumers share ONE render socket: the
// module-level `ReqraftLspClient` below rides the per-endpoint
// `LspSharedConnection`, and JSON-RPC request ids associate each response with
// the caller — N expression builders on one form means N independent in-flight
// requests on one connection, no cross-wiring.
//
// There is no client-side stand-in. A Qorus form does not work without Qorus,
// so the only time the server was "unreachable" in practice was while the
// page's first connection was still opening — and racing that with a 1.5s timer
// replaced the real rendering with an approximation labelled "Approximate", on
// exactly the first Explain of every page. A rendering now waits for the
// connection; `null` means the server cannot render at all (it predates the
// method, or the connection gave up), which the caller says plainly.
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef } from 'react';
import { ReqraftLspClient } from '../../../utils/lspClient';
import { IExpressionValue } from './types';

/* The synchronous summary a collapsed row prints — see `readFirst.ts`. It is
   not a stand-in for this rendering and is never shown in its place. */
export { renderExpressionToText } from './renderExpressionToText';

/** Coalesce rapid re-renders per consumer (live typing) — trailing edge. */
const RENDER_DEBOUNCE_MS = 300;

let renderClient: ReqraftLspClient | null = null;
/** Set after a `-32601 method not found` — the server predates the method. */
let methodUnsupported = false;

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

/** One rendered expression — what `renderRich` resolves with. */
export interface IRenderedExpression {
  /** The readable rendering (plain text). */
  text: string;
  /**
   * The server's richtext form — template references arrive as `tag` nodes
   * (the IDE renders them as chips). Convert with `richtextResponseToSlate`.
   */
  richtext: unknown | null;
}

const renderViaServer = async (value: IExpressionValue): Promise<IRenderedExpression | null> => {
  if (methodUnsupported) return null;
  const client = getRenderClient();
  try {
    // Waits as long as the connection does: it has its own reconnect schedule
    // and rejects once it gives up, so this never outlives a dead socket.
    await client.connect();
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
};

interface IPendingRender {
  value: IExpressionValue;
  resolvers: Array<(rendered: IRenderedExpression | null) => void>;
}

export interface IUseRenderExpressionResult {
  /** The readable rendering of an expression AST, or `null` when the server cannot render. */
  render: (value: IExpressionValue) => Promise<string | null>;
  /**
   * Like `render`, but also resolves the server's richtext form (template
   * references as `tag` nodes — chips). `null` when there is nothing to render
   * or the server cannot render it.
   */
  renderRich: (value: IExpressionValue) => Promise<IRenderedExpression | null>;
}

export const useRenderExpression = (): IUseRenderExpressionResult => {
  const pendingRef = useRef<IPendingRender | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRunRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Settle any coalesced callers so no promise is left hanging past unmount.
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.resolvers.forEach((resolve) => resolve(null));
    },
    []
  );

  const renderRich = useCallback(
    (value: IExpressionValue): Promise<IRenderedExpression | null> =>
      new Promise<IRenderedExpression | null>((resolve) => {
        // Coalesce calls per consumer: rapid live updates collapse to the
        // newest AST; every awaiting caller gets that newest rendering.
        pendingRef.current = {
          value,
          resolvers: [...(pendingRef.current?.resolvers ?? []), resolve],
        };

        const run = async (): Promise<void> => {
          const job = pendingRef.current;
          pendingRef.current = null;
          if (!job) return;
          lastRunRef.current = Date.now();
          const outcome = job.value?.exp ? await renderViaServer(job.value) : null;
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
    (value: IExpressionValue): Promise<string | null> =>
      renderRich(value).then((r) => r?.text ?? null),
    [renderRich]
  );

  return { render, renderRich };
};
