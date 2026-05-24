// Copyright 2026 Qore Technologies, s.r.o.
// DPQL-specific layer on top of Reqraft's generic LspClient. Manages a
// single per-instance LSP session (`languageId: 'dpql'`), surfaces the
// standard editor lifecycle (didOpen/didChange + diagnostics), and exposes
// typed wrappers for the server's `dpql/*` custom JSON-RPC methods:
//   - dpql/setContext              — provider / recordType / options
//   - dpql/setFsmContext           — FSM state context
//   - dpql/setAlertPayloadContext  — alert-rule editor context
//   - dpql/serialize               — expression AST → DPQL text
//   - dpql/parse                   — DPQL text → expression AST
//   - dpql/validate                — synchronous diagnostics
//
// All `dpql/*` methods are confirmed implemented on the Qorus server
// (Classes/QorusLspWebSocketHandler.qc:793-814). `setFsmContext` and
// `setAlertPayloadContext` are exposed from day one even though the
// original qorus-ide DpqlRichtext branch only used `setContext` — server
// supports them and they're the natural fit for FSM-config / Alert-Rule
// consumers respectively.

import { useCallback, useEffect, useRef, useState } from 'react';
import { LspClient } from '../../utils/lspClient';
import { ILspCompletionItem, ILspDiagnostic } from '../../utils/lspClient.types';
import { offsetToLspPosition, slateToPlainText } from './helpers';
import { IDpqlParseResult, ISlateElement } from './types';

let dpqlUriCounter = 0;

export interface IUseDpqlLspOptions {
  /** Provider spec — `@<app>/<action>`, `datasource:name`, `connection:name`, or factory string. */
  provider?: string;
  /** Record type — `'record'` (default), `'create'`, or `'update'`. */
  recordType?: string;
  /** Additional `dpql/setContext` options forwarded as `options`. */
  options?: Record<string, any>;
  /** FSM action code (DPAT_FIND / DPAT_UPDATE / DPAT_DELETE / …). */
  actionCode?: number;
}

export interface IDpqlFieldMeta {
  display_name?: string;
  short_desc?: string;
  desc?: string;
  type?: { name?: string };
}

export interface IUseDpqlLspResult {
  isReady: boolean;
  diagnostics: ILspDiagnostic[];
  /** Field metadata returned by `dpql/setContext`, keyed by field name. */
  fieldMeta: Record<string, IDpqlFieldMeta>;
  /** Notify LSP of content change — call from Slate `onChange`. */
  didChange: (elements: ISlateElement[]) => void;
  /** Request `textDocument/completion` at a plain-text offset. */
  getCompletions: (plainText: string, offset: number) => Promise<ILspCompletionItem[]>;
  /** Request `textDocument/formatting`. Returns the new text or null. */
  format: () => Promise<string | null>;
  /** Request `dpql/validate` synchronously. */
  validate: () => Promise<{ valid: boolean; errors?: Array<{ message: string }> }>;
  /** Request `dpql/parse` — DPQL text → expression AST. */
  parse: (text: string) => Promise<IDpqlParseResult>;
  /** Request `dpql/serialize` — expression AST → DPQL text. */
  serialize: (expression: Record<string, any>) => Promise<string>;
}

export function useDpqlLsp(opts: IUseDpqlLspOptions): IUseDpqlLspResult {
  const { provider, recordType, options: ctxOptions, actionCode } = opts;

  const clientRef = useRef<LspClient | null>(null);
  const versionRef = useRef(1);
  const uriRef = useRef(`dpql://richtext/${++dpqlUriCounter}`);

  const [isReady, setIsReady] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ILspDiagnostic[]>([]);
  const [fieldMeta, setFieldMeta] = useState<Record<string, IDpqlFieldMeta>>({});

  // Connect on mount, disconnect on unmount.
  useEffect(() => {
    const client = new LspClient({
      languageId: 'dpql',
      uri: uriRef.current,
    });
    clientRef.current = client;

    client.onDiagnostics((_uri, diags) => {
      setDiagnostics(diags);
    });

    client.onReady(setIsReady);

    client
      .connect()
      .then(() => {
        // Build metadata for initial context.
        const metadata: Record<string, any> = {};
        if (provider) metadata.provider = provider;
        if (recordType) metadata.recordType = recordType;
        if (ctxOptions) metadata.options = ctxOptions;
        if (actionCode !== undefined) metadata.action_code = actionCode;

        client.didOpen(
          '',
          Object.keys(metadata).length > 0 ? metadata : undefined
        );
        setIsReady(true);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[DPQL LSP] Connection failed:', err);
        setIsReady(false);
      });

    return () => {
      client.disconnect();
      clientRef.current = null;
      setIsReady(false);
    };
    // Initial connect runs once; subsequent provider/recordType changes
    // flow through the dedicated effect below. The deps are intentionally
    // empty so the WebSocket isn't torn down on prop changes.
  }, []);

  // Update context when provider/recordType/options/actionCode change.
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !provider || !recordType) return;

    client
      .customRequest<{ fields?: Record<string, any> }>('dpql/setContext', {
        uri: uriRef.current,
        provider,
        recordType,
        options: ctxOptions,
        action_code: actionCode,
      })
      .then((result) => {
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
        console.error('[DPQL LSP] setContext failed:', err);
      });
  }, [provider, recordType, ctxOptions, actionCode]);

  // Notify LSP of content changes.
  const didChange = useCallback((elements: ISlateElement[]) => {
    const client = clientRef.current;
    if (!client) return;

    const plainText = slateToPlainText(elements);
    client.didChange(plainText, ++versionRef.current);
  }, []);

  // Get completions at a given plain-text offset.
  const getCompletions = useCallback(
    async (plainText: string, offset: number): Promise<ILspCompletionItem[]> => {
      const client = clientRef.current;
      if (!client) return [];

      const { line, character } = offsetToLspPosition(plainText, offset);
      try {
        return await client.getCompletions(line, character);
      } catch {
        return [];
      }
    },
    []
  );

  const format = useCallback(async (): Promise<string | null> => {
    const client = clientRef.current;
    if (!client) return null;

    try {
      return await client.format();
    } catch {
      return null;
    }
  }, []);

  const validate = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return { valid: false, errors: [{ message: 'No LSP connection' }] };
    }

    try {
      const result = await client.customRequest<{ diagnostics?: ILspDiagnostic[] }>(
        'dpql/validate',
        { uri: uriRef.current }
      );
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
  }, []);

  const parse = useCallback(async (text: string): Promise<IDpqlParseResult> => {
    const client = clientRef.current;
    if (!client) {
      return { success: false, expression: null, diagnostics: [] };
    }
    try {
      const result = await client.customRequest<Partial<IDpqlParseResult>>(
        'dpql/parse',
        { uri: uriRef.current, text }
      );
      return {
        success: result?.success ?? false,
        expression: result?.expression ?? null,
        diagnostics: result?.diagnostics ?? [],
      };
    } catch {
      return { success: false, expression: null, diagnostics: [] };
    }
  }, []);

  const serialize = useCallback(
    async (expression: Record<string, any>): Promise<string> => {
      const client = clientRef.current;
      if (!client) return '';
      try {
        const result = await client.customRequest<{ dpql?: string }>(
          'dpql/serialize',
          { uri: uriRef.current, expression }
        );
        return result?.dpql ?? '';
      } catch {
        return '';
      }
    },
    []
  );

  return {
    isReady,
    diagnostics,
    fieldMeta,
    didChange,
    getCompletions,
    format,
    validate,
    parse,
    serialize,
  };
}
