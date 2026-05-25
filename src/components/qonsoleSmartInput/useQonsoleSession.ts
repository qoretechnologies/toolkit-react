// Copyright 2026 Qore Technologies, s.r.o.
// Qonsole-specific layer on top of the generic `useLspSession`. Handles
// the `qonsole/setContext` lifecycle (sends initial context as didOpen
// metadata, re-dispatches when context changes) and exposes typed
// wrappers for the server's `qonsole/assist` and `qonsole/validate`
// custom methods. Shape based on the live spike captured in
// `qorus-frontend/QONSOLE_LSP_REFERENCE.md`.

import { useCallback, useEffect } from 'react';
import { ILspDiagnostic } from '../../utils/lspClient.types';
import { IUseLspSessionResult, useLspSession } from '../smartEditor/useLspSession';
import {
  IQonsoleAssistContext,
  IQonsoleAssistResult,
  TQonsoleAssistFeature,
} from './types';

export interface IUseQonsoleSessionOptions {
  /** Optional initial `/use` context. */
  useContext?: IQonsoleAssistContext;
  /** Initial document text sent on `didOpen`. */
  initialText?: string;
}

export interface IUseQonsoleSessionResult {
  /** The generic LSP session — pass through to SmartEditor. */
  session: IUseLspSessionResult;
  /** Most recent `publishDiagnostics`. */
  diagnostics: ILspDiagnostic[];
  /**
   * `qonsole/assist` (uri form). Returns the full snapshot for the
   * current document at the given position. Pass `features: ['all']`
   * for everything; the default is also `['all']`.
   */
  assist: (
    position: { line: number; character: number },
    features?: TQonsoleAssistFeature[]
  ) => Promise<IQonsoleAssistResult | null>;
  /**
   * `qonsole/validate` — synchronous diagnostics summary.
   */
  validate: () => Promise<{ valid: boolean; errors?: Array<{ message: string }> }>;
}

export function useQonsoleSession(
  opts: IUseQonsoleSessionOptions
): IUseQonsoleSessionResult {
  const { useContext: ctx, initialText = '' } = opts;

  const session = useLspSession({
    languageId: 'qonsole',
    initialText,
    // The server reads context from `textDocument.metadata.context` on
    // didOpen (per qorus-frontend/QONSOLE_LSP_REFERENCE.md).
    initialMetadata: ctx ? { context: ctx } : undefined,
  });

  // React to `useContext` changes — re-dispatch `qonsole/setContext`.
  useEffect(() => {
    if (!session.client || !session.isReady || !ctx) return;
    session.client
      .customRequest('qonsole/setContext', {
        uri: session.uri,
        context: ctx,
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[Qonsole] setContext failed:', err);
      });
  }, [session.client, session.isReady, session.uri, ctx]);

  const assist = useCallback(
    async (
      position: { line: number; character: number },
      features: TQonsoleAssistFeature[] = ['all']
    ): Promise<IQonsoleAssistResult | null> => {
      if (!session.client) return null;
      try {
        return await session.client.customRequest<IQonsoleAssistResult>(
          'qonsole/assist',
          {
            uri: session.uri,
            position,
            features,
          }
        );
      } catch {
        return null;
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
      }>('qonsole/validate', { uri: session.uri });
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
    session,
    diagnostics: session.diagnostics,
    assist,
    validate,
  };
}
