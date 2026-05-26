// Copyright 2026 Qore Technologies, s.r.o.
// DPQL-specific layer on top of the generic `useLspSession`. Manages
// `dpql/setContext` lifecycle (re-runs whenever provider / recordType /
// options / actionCode change) and stores the field-meta map the server
// returns for tooltip rendering. Wraps the `dpql/parse` / `dpql/serialize`
// / `dpql/validate` custom methods as typed Promise-returning functions.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ILspDiagnostic } from '../../utils/lspClient.types';
import { useLspSession, IUseLspSessionResult } from '../smartEditor/useLspSession';
import { IDpqlParseResult } from './types';

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
  const { provider, recordType, options: ctxOptions, actionCode, initialText = '' } = opts;

  const initialMetadata = (() => {
    const m: Record<string, any> = {};
    if (provider) m.provider = provider;
    if (recordType) m.recordType = recordType;
    if (ctxOptions) m.options = ctxOptions;
    if (actionCode !== undefined) m.action_code = actionCode;
    return Object.keys(m).length > 0 ? m : undefined;
  })();

  const session = useLspSession({
    languageId: 'dpql',
    initialMetadata,
    initialText,
  });

  const [fieldMeta, setFieldMeta] = useState<Record<string, IDpqlFieldMeta>>({});
  // Tracks whether a DPQL context binding has completed for this
  // session. SmartEditor and its child LSP hooks gate on
  // `session.isReady && session.isContextReady` to avoid firing
  // requests against a context-less server during the 50-200ms gap
  // between LSP `initialize`/`didOpen` and our `dpql/setContext`
  // response landing. Without this, a fast user typing `@` right
  // after mount hits the server with no provider bound, gets empty
  // completions, and the dropdown silently auto-closes.
  //
  // - Wrapper is NOT configured with a `provider` / `recordType`:
  //   we have no context to bind, so we report `true` immediately
  //   (the generic `useLspSession.isContextReady` default).
  // - Wrapper IS configured: starts `false`, flips `true` after
  //   `dpql/setContext` resolves (success OR error — best-effort
  //   so a transient failure doesn't lock the editor out forever).
  const needsContextBinding = Boolean(provider && recordType);
  const [isContextBound, setIsContextBound] = useState(!needsContextBinding);

  // React to provider / recordType / options / actionCode changes — call
  // `dpql/setContext` on the live client whenever the session is ready.
  useEffect(() => {
    if (!needsContextBinding) {
      // Configuration cleared — no context binding needed; flip the
      // gate back to ready so completions resume working.
      setIsContextBound(true);
      return undefined;
    }
    if (!session.client || !session.isReady) {
      // Will re-run when isReady flips true.
      return undefined;
    }
    // Re-arm the gate for this binding request — covers both the
    // initial connect AND any later provider/recordType change.
    setIsContextBound(false);
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
        // Flip the gate true even on error — best-effort: a
        // transient setContext failure shouldn't keep the editor
        // disabled forever. Completions will just be context-less
        // until the next provider/recordType change retries.
        setIsContextBound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    needsContextBinding,
    session.client,
    session.isReady,
    session.uri,
    provider,
    recordType,
    ctxOptions,
    actionCode,
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
