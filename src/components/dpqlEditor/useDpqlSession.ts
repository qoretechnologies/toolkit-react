// Copyright 2026 Qore Technologies, s.r.o.
// DPQL-specific layer on top of the generic `useLspSession`. Manages
// `dpql/setContext` lifecycle (re-runs whenever provider / recordType /
// options / actionCode change) and stores the field-meta map the server
// returns for tooltip rendering. Wraps the `dpql/parse` / `dpql/serialize`
// / `dpql/validate` custom methods as typed Promise-returning functions.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ILspDiagnostic } from '../../utils/lspClient.types';
import { useLspSession, IUseLspSessionResult } from '../smartEditor/useLspSession';
import { IDpqlParseResult, TDpqlFsmContext } from './types';

export interface IDpqlFieldMeta {
  display_name?: string;
  short_desc?: string;
  desc?: string;
  type?: { name?: string };
}

export interface IUseDpqlSessionOptions {
  /** Provider spec — `@<app>/<action>`, `datasource:name`, `connection:name`, or factory string. */
  provider?: string;
  /** Record type — `'record'` (default), `'create'`, or `'update'`. */
  recordType?: string;
  /** Additional `dpql/setContext` options forwarded as `options`. */
  options?: Record<string, any>;
  /** FSM action code (DPAT_FIND / DPAT_UPDATE / DPAT_DELETE / …). */
  actionCode?: number;
  /** Initial DPQL text sent on `didOpen`. */
  initialText?: string;
  /**
   * Use the canonical alert-payload schema instead of (or in addition
   * to) a provider/recordType binding. Mutually exclusive with
   * `provider`/`recordType` server-side — when `true`, the provider
   * binding is suppressed. Toggling back to `false` re-binds the
   * provider if one is configured.
   */
  alertPayloadContext?: boolean;
  /**
   * FSM context for state-aware template completions. Composes with
   * provider/alertPayload — fired as an independent binding.
   */
  fsmContext?: TDpqlFsmContext;
}

export interface IUseDpqlSessionResult {
  /** The generic LSP session — pass straight through to SmartEditor. */
  session: IUseLspSessionResult;
  /** Field metadata returned by the most recent `dpql/setContext`. */
  fieldMeta: Record<string, IDpqlFieldMeta>;
  /** Most recent `publishDiagnostics`. */
  diagnostics: ILspDiagnostic[];
  /** `dpql/parse` — DPQL text → expression AST. */
  parse: (text: string) => Promise<IDpqlParseResult>;
  /** `dpql/serialize` — expression AST → DPQL text. */
  serialize: (expression: Record<string, any>) => Promise<string>;
  /**
   * `dpql/validate` — returns `{valid, errors?}` summary derived from the
   * diagnostics array the server returns.
   */
  validate: () => Promise<{ valid: boolean; errors?: Array<{ message: string }> }>;
}

export function useDpqlSession(
  opts: IUseDpqlSessionOptions
): IUseDpqlSessionResult {
  const {
    provider,
    recordType,
    options: ctxOptions,
    actionCode,
    initialText = '',
    alertPayloadContext = false,
    fsmContext,
  } = opts;

  // Provider/recordType context and alert-payload context are
  // server-side mutually exclusive — only one binds the URI at a time.
  // When `alertPayloadContext` is `true`, suppress the provider effect
  // so they don't race.
  const needsProviderBinding =
    Boolean(provider && recordType) && !alertPayloadContext;

  const initialMetadata = (() => {
    const m: Record<string, any> = {};
    if (alertPayloadContext) {
      // Tell the server at `didOpen` time which binding this URI
      // should have — avoids a separate `dpql/setAlertPayloadContext`
      // roundtrip on first mount. The server's `isAlertPayloadContext`
      // helper (qorus/Classes/QorusLspWebSocketHandler.qc:8497) reads
      // this metadata key directly.
      m.dpql_context = 'alert-payload';
    } else {
      if (provider) m.provider = provider;
      if (recordType) m.recordType = recordType;
      if (ctxOptions) m.options = ctxOptions;
      if (actionCode !== undefined) m.action_code = actionCode;
    }
    return Object.keys(m).length > 0 ? m : undefined;
  })();

  const session = useLspSession({
    languageId: 'dpql',
    initialMetadata,
    initialText,
  });

  const [fieldMeta, setFieldMeta] = useState<Record<string, IDpqlFieldMeta>>({});

  // Track each context binding's pending state independently. The
  // combined gate `isContextBound` (computed below) is the AND of the
  // three — SmartEditor and its child LSP hooks gate on the combined
  // signal to avoid firing requests against an unbound server during
  // the 50-200ms gap between LSP `initialize`/`didOpen` and the
  // setContext response. Without this, a fast user typing `@` right
  // after mount hits the server with no context bound, gets empty
  // completions, and the dropdown silently auto-closes.
  //
  // Initial states mirror what `initialMetadata` does at didOpen:
  // - Provider/recordType binding: already done via metadata on
  //   didOpen, so we start `true` and only flip `false` on later
  //   changes that require an explicit `dpql/setContext` call.
  //   (Actually no — the server's `dpql/setContext` is needed to get
  //   the field-meta back. We DO need to fire it on initial mount
  //   too. So start `false`.)
  // - Alert-payload binding: same reasoning — start `false`, but the
  //   server may bind via didOpen metadata so this might flip true
  //   without an explicit request. We fire it explicitly anyway for
  //   field-meta consistency.
  // - FSM binding: ALWAYS requires an explicit
  //   `dpql/setFsmContext` request — no initialMetadata shortcut.
  const [providerBound, setProviderBound] = useState(!needsProviderBinding);
  const [alertPayloadBound, setAlertPayloadBound] = useState(
    !alertPayloadContext
  );
  const [fsmBound, setFsmBound] = useState(!fsmContext);
  const isContextBound = providerBound && alertPayloadBound && fsmBound;

  // Provider/recordType binding. Suppressed while alert-payload is
  // active — they're mutually exclusive on the server.
  useEffect(() => {
    if (!needsProviderBinding) {
      setProviderBound(true);
      return undefined;
    }
    if (!session.client || !session.isReady) return undefined;
    setProviderBound(false);
    let cancelled = false;
    session.client
      .customRequest<{ fields?: Record<string, any> }>('dpql/setContext', {
        uri: session.uri,
        provider,
        recordType,
        options: ctxOptions,
        action_code: actionCode,
      })
      .then((result) => {
        if (cancelled) return;
        if (result?.fields) {
          const meta: Record<string, IDpqlFieldMeta> = {};
          for (const [name, field] of Object.entries(
            result.fields as Record<string, any>
          )) {
            meta[name] = {
              display_name: field.display_name,
              short_desc: field.short_desc,
              desc: field.desc,
              type: field.type ? { name: field.type.name } : undefined,
            };
          }
          setFieldMeta(meta);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[DPQL] setContext failed:', err);
      })
      .finally(() => {
        if (cancelled) return;
        // Flip the gate true even on error — best-effort. A transient
        // setContext failure shouldn't lock the editor out forever.
        setProviderBound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    needsProviderBinding,
    session.client,
    session.isReady,
    session.uri,
    provider,
    recordType,
    ctxOptions,
    actionCode,
  ]);

  // Alert-payload binding. On first mount it lands via
  // `initialMetadata.dpql_context` at didOpen — no extra roundtrip.
  // For later toggles (false → true after mount) we fire the explicit
  // `dpql/setAlertPayloadContext` method. Toggling back to false
  // re-binds the provider context (if one is configured) via the
  // sibling provider effect above.
  const [alertPayloadInitialMount, setAlertPayloadInitialMount] = useState(true);
  useEffect(() => {
    if (!alertPayloadContext) {
      setAlertPayloadBound(true);
      return undefined;
    }
    if (!session.client || !session.isReady) return undefined;
    // First mount with alert-payload=true: the server already bound
    // via `initialMetadata.dpql_context` at didOpen, so once isReady
    // is true the binding is done — no explicit request needed.
    if (alertPayloadInitialMount) {
      setAlertPayloadInitialMount(false);
      setAlertPayloadBound(true);
      return undefined;
    }
    // Later toggle false→true: fire the explicit method.
    setAlertPayloadBound(false);
    let cancelled = false;
    session.client
      .customRequest('dpql/setAlertPayloadContext', { uri: session.uri })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[DPQL] setAlertPayloadContext failed:', err);
      })
      .finally(() => {
        if (cancelled) return;
        setAlertPayloadBound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    alertPayloadContext,
    alertPayloadInitialMount,
    session.client,
    session.isReady,
    session.uri,
  ]);

  // FSM context binding. Always uses the explicit
  // `dpql/setFsmContext` method (no initialMetadata shortcut on the
  // server). Independent of provider / alert-payload — both can apply.
  //
  // We track the previous `fsmContext` via a ref so we only fire when
  // there's actual binding work to do (set / change / clear). Without
  // this skip, every DpqlEditor mount with no `fsmContext` would
  // unnecessarily call `setFsmContext` with no source — and the brief
  // `fsmBound: false` window during that no-op roundtrip would race
  // with user typing on first mount (broke `LspCompletionRoundtrip`).
  const prevFsmContextRef = useRef<TDpqlFsmContext | undefined>(undefined);
  useEffect(() => {
    const prevHadBinding = Boolean(prevFsmContextRef.current);
    const currentHasBinding = Boolean(fsmContext);
    prevFsmContextRef.current = fsmContext;

    if (!session.client || !session.isReady) {
      // If we haven't connected yet, the gate state mirrors the
      // intent: no binding requested → ready; binding requested → wait.
      setFsmBound(!currentHasBinding);
      return undefined;
    }
    // No-op: never had a binding, still don't. Skip the request.
    if (!prevHadBinding && !currentHasBinding) {
      setFsmBound(true);
      return undefined;
    }
    // Bind, update, or clear. Build params from the discriminated
    // union; passing no source key clears any existing FSM binding.
    const params: Record<string, unknown> = { uri: session.uri };
    if (fsmContext) {
      if ('fsm' in fsmContext && fsmContext.fsm) {
        params.fsm = fsmContext.fsm;
      } else if ('draftId' in fsmContext && fsmContext.draftId) {
        params.draft_id = fsmContext.draftId;
      } else if ('fsmId' in fsmContext && fsmContext.fsmId !== undefined) {
        params.fsmid = fsmContext.fsmId;
      }
      if (fsmContext.currentState) {
        params.current_state = fsmContext.currentState;
      }
    }
    setFsmBound(false);
    let cancelled = false;
    session.client
      .customRequest('dpql/setFsmContext', params)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[DPQL] setFsmContext failed:', err);
      })
      .finally(() => {
        if (cancelled) return;
        setFsmBound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    session.client,
    session.isReady,
    session.uri,
    fsmContext,
  ]);

  // Wrap the underlying LSP session so consumers see the DPQL-aware
  // `isContextReady` instead of the generic primitive's `true`. Spread
  // preserves every function reference; only this one field is
  // overridden.
  const wrappedSession = useMemo<IUseLspSessionResult>(
    () => ({ ...session, isContextReady: isContextBound }),
    [session, isContextBound]
  );

  const parse = useCallback(
    async (text: string): Promise<IDpqlParseResult> => {
      if (!session.client) {
        return { success: false, expression: null, diagnostics: [] };
      }
      try {
        const result = await session.client.customRequest<Partial<IDpqlParseResult>>(
          'dpql/parse',
          { uri: session.uri, text }
        );
        return {
          success: result?.success ?? false,
          expression: result?.expression ?? null,
          diagnostics: result?.diagnostics ?? [],
        };
      } catch {
        return { success: false, expression: null, diagnostics: [] };
      }
    },
    [session.client, session.uri]
  );

  const serialize = useCallback(
    async (expression: Record<string, any>): Promise<string> => {
      if (!session.client) return '';
      try {
        const result = await session.client.customRequest<{ dpql?: string }>(
          'dpql/serialize',
          { uri: session.uri, expression }
        );
        return result?.dpql ?? '';
      } catch {
        return '';
      }
    },
    [session.client, session.uri]
  );

  const validate = useCallback(async (): Promise<{
    valid: boolean;
    errors?: Array<{ message: string }>;
  }> => {
    if (!session.client) {
      return { valid: false, errors: [{ message: 'No LSP connection' }] };
    }
    try {
      const result = await session.client.customRequest<{
        diagnostics?: ILspDiagnostic[];
      }>('dpql/validate', { uri: session.uri });
      const diags = result?.diagnostics ?? [];
      if (diags.length > 0) {
        return {
          valid: false,
          errors: diags.map((d) => ({ message: d.message })),
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, errors: [{ message: 'Validation request failed' }] };
    }
  }, [session.client, session.uri]);

  return {
    session: wrappedSession,
    fieldMeta,
    diagnostics: session.diagnostics,
    parse,
    serialize,
    validate,
  };
}
