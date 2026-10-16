// Copyright 2026 Qore Technologies, s.r.o.
// The type an expression gives, as the server works it out.
//
// An expression has one type everywhere in Qorus (qoretechnologies/qorus#713):
// the server's expression type rules decide it for DPQL validation, the
// language server, evaluation and the editors alike. The builder used to work
// out its own type from the catalogue's `ui_return_type` one level deep, which
// disagreed with the server (`1 + 2.5` was "any" here and a float there), so it
// now asks the server, over the LSP custom method `dpql/expressionType` (next
// to `dpql/renderExpression` in `QorusLspWebSocketHandler.qc`), on the same
// shared connection as the rendering.
//
// There is no client-side stand-in: until the server answers, or when it
// cannot (it predates the method, or the connection gave up), the type is not
// known and nothing is judged by it.
import { nanoid } from 'nanoid';
import { useEffect, useState } from 'react';
import { ReqraftLspClient } from '../../../utils/lspClient';
import { IExpressionValue } from './types';

/** Coalesce rapid changes per consumer (live editing) — trailing edge. */
const TYPE_DEBOUNCE_MS = 300;

/** The type an expression gives, as the server names it. */
export interface IExpressionType {
  /** The type's name, as `dpql/parse` gives it (`float`, `*int`, `hash<auto>`); `auto` when not known. */
  inferred_type: string;
  /** The type as the UI names it, as the catalogue's `ui_return_type` does (`number`, `richtext`, `any`). */
  ui_type: string;
  /** `true` when the type is known before the expression is evaluated. */
  known: boolean;
}

let typeClient: ReqraftLspClient | null = null;
/** Set after a `-32601 method not found` — the server predates the method. */
let methodUnsupported = false;
/** The types the server gave, by the expression's JSON, for the synchronous readers. */
const typeCache = new Map<string, IExpressionType>();

const getTypeClient = (): ReqraftLspClient => {
  if (!typeClient) {
    typeClient = new ReqraftLspClient({
      languageId: 'dpql',
      // Opaque per-load URI; `dpql/expressionType` is stateless (no `didOpen`
      // needed), the URI only identifies the client locally.
      uri: `inmemory://reqraft/expression-type/${nanoid()}`,
    });
  }
  return typeClient;
};

const cacheKey = (value: IExpressionValue): string => JSON.stringify(value);

/**
 * The type the server gave for an expression, if it has given it — for the
 * readers that cannot wait (an argument's label, the check of the arguments
 * that are kept when the operation changes). `undefined` when not known yet.
 */
export const getCachedExpressionType = (
  value: IExpressionValue | undefined
): IExpressionType | undefined => (value?.exp ? typeCache.get(cacheKey(value)) : undefined);

/** Asks the server for an expression's type; `null` when it cannot say. */
export const fetchExpressionType = async (
  value: IExpressionValue
): Promise<IExpressionType | null> => {
  if (!value?.exp || methodUnsupported) return null;
  const key = cacheKey(value);
  const cached = typeCache.get(key);
  if (cached) return cached;
  const client = getTypeClient();
  try {
    // Waits as long as the connection does: it has its own reconnect schedule
    // and rejects once it gives up, so this never outlives a dead socket.
    await client.connect();
    const result = await client.customRequest<Partial<IExpressionType>>('dpql/expressionType', {
      // The server accepts both the bare `{exp, args}` AST and the
      // `{is_expression, value}` wrapper, as `dpql/renderExpression` does.
      expression: value,
    });
    if (typeof result?.inferred_type !== 'string' || typeof result?.ui_type !== 'string') {
      return null;
    }
    const type: IExpressionType = {
      inferred_type: result.inferred_type,
      ui_type: result.ui_type,
      known: !!result.known,
    };
    typeCache.set(key, type);
    return type;
  } catch (err) {
    // `ReqraftLspClient` rejections are `Error('<code>: <message>')`.
    if (err instanceof Error && err.message.startsWith('-32601')) {
      methodUnsupported = true;
    }
    return null;
  }
};

/** @internal Test hook — drop the module-level client, the cache and the health state. */
export const _resetExpressionTypeTransportForTests = (): void => {
  typeClient?.disconnect();
  typeClient = null;
  methodUnsupported = false;
  typeCache.clear();
};

/**
 * The type an expression gives, from the server; `undefined` until the server
 * has answered, and when it cannot say.
 */
export const useExpressionType = (
  value: IExpressionValue | undefined
): IExpressionType | undefined => {
  const key = value?.exp ? cacheKey(value) : undefined;
  const [type, setType] = useState<IExpressionType | undefined>(() =>
    getCachedExpressionType(value)
  );

  useEffect(() => {
    if (!key) {
      setType(undefined);
      return undefined;
    }
    const cached = typeCache.get(key);
    if (cached) {
      setType(cached);
      return undefined;
    }
    // the type of the previous expression is not this one's
    setType(undefined);
    let current = true;
    const timer = setTimeout(() => {
      void fetchExpressionType(JSON.parse(key) as IExpressionValue).then((served) => {
        if (current) {
          setType(served ?? undefined);
        }
      });
    }, TYPE_DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [key]);

  return type;
};
