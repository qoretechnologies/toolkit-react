// Copyright 2026 Qore Technologies, s.r.o.
// Generic LSP session lifecycle hook. Manages a single `LspClient` instance
// per-mount: connect → didOpen with optional metadata → forward subsequent
// content changes via didChange → expose the live client so wrappers can
// dispatch language-specific custom methods (e.g. `dpql/setContext`,
// `qonsole/assist`). Cleans up on unmount.

import { useCallback, useEffect, useRef, useState } from 'react';
import { LspClient } from '../../utils/lspClient';
import {
  ILspCompletionItem,
  ILspDiagnostic,
  ILspSemanticTokensLegend,
  ILspServerCapabilities,
} from '../../utils/lspClient.types';
import { offsetToLspPosition } from './helpers';

let lspUriCounter = 0;

export interface IUseLspSessionOptions {
  languageId: string;
  /**
   * Document URI. If omitted, a random URI is generated using `languageId`
   * as the scheme: `<languageId>://session/<counter>`. Caller-provided URIs
   * must be opaque (no secrets / session tokens / sandbox IDs).
   */
  uri?: string;
  /** Optional metadata sent as `textDocument.metadata` on `didOpen`. */
  initialMetadata?: Record<string, any>;
  /** WebSocket path. Default: `'lsp'`. */
  url?: string;
  /** Initial document text sent on `didOpen`. Default: empty string. */
  initialText?: string;
}

export interface IUseLspSessionResult {
  /** The live `LspClient`, or `null` before connect resolves / after disconnect. */
  client: LspClient | null;
  /** The URI bound to this session. */
  uri: string;
  /** Becomes `true` once `initialize` + `didOpen` complete. */
  isReady: boolean;
  /**
   * Becomes `true` once any language-specific context binding the
   * wrapper requires has resolved. For the generic primitive session
   * this is always `true` (no context). Wrappers like `useDpqlSession`
   * override it: it's `false` while a `dpql/setContext` /
   * `dpql/setFsmContext` / `dpql/setAlertPayloadContext` request is
   * in flight after `isReady` flipped, and flips `true` once the
   * binding resolves (success or error — see the wrapper for
   * details).
   *
   * SmartEditor and its child hooks gate LSP requests on the
   * combined signal `isReady && isContextReady`: without it, a fast
   * user typing `@` in the ~50–200ms window between LSP-ready and
   * context-bound would hit the server context-less and get empty
   * results, with the dropdown auto-closing silently.
   */
  isContextReady: boolean;
  /** Most-recent `textDocument/publishDiagnostics` payload for this document. */
  diagnostics: ILspDiagnostic[];
  /**
   * The server's semantic-tokens legend, captured from
   * `initialize → capabilities.semanticTokensProvider.legend`. `null`
   * before the initialize response arrives or when the server doesn't
   * advertise semantic tokens. Consumers (`useLspSemanticTokens`) need
   * it to resolve int-encoded `tokenType` / `tokenModifiers` indices.
   *
   * Kept for backwards compatibility — new code should prefer
   * `capabilities?.semanticTokensProvider?.legend`.
   */
  semanticTokensLegend: ILspSemanticTokensLegend | null;
  /**
   * Full `capabilities` block from the server's initialize response.
   * `null` until the handshake completes. Hooks gate features on the
   * presence of the relevant provider (e.g. `useLspSignatureHelp`
   * only fires when `capabilities?.signatureHelpProvider` exists).
   */
  capabilities: ILspServerCapabilities | null;
  /** Forward content changes to the server via `didChange`. */
  didChange: (text: string) => void;
  /**
   * Request `textDocument/completion` at a plain-text offset. Converts
   * offset → LSP line/character at the boundary; returns the standard
   * `ILspCompletionItem[]`.
   */
  getCompletions: (plainText: string, offset: number) => Promise<ILspCompletionItem[]>;
  /** Request `textDocument/formatting`. Returns the new full document text, or null. */
  format: () => Promise<string | null>;
}

export function useLspSession(
  options: IUseLspSessionOptions
): IUseLspSessionResult {
  const { languageId, uri: uriProp, initialMetadata, url, initialText = '' } = options;

  const clientRef = useRef<LspClient | null>(null);
  const versionRef = useRef(1);
  const uriRef = useRef(uriProp ?? `${languageId}://session/${++lspUriCounter}`);

  const [client, setClient] = useState<LspClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ILspDiagnostic[]>([]);
  const [semanticTokensLegend, setSemanticTokensLegend] =
    useState<ILspSemanticTokensLegend | null>(null);
  const [capabilities, setCapabilities] =
    useState<ILspServerCapabilities | null>(null);

  useEffect(() => {
    const c = new LspClient({
      languageId,
      uri: uriRef.current,
      url,
    });
    clientRef.current = c;
    setClient(c);

    c.onDiagnostics((_uri, diags) => {
      setDiagnostics(diags);
    });

    c.onReady(setIsReady);

    c.connect()
      .then(() => {
        // Initialize completed — mirror the captured server
        // capabilities (including the semantic-tokens legend) into
        // React state so consumers can subscribe via the session
        // result.
        setSemanticTokensLegend(c.semanticTokensLegend);
        setCapabilities(c.capabilities);
        c.didOpen(
          initialText,
          initialMetadata && Object.keys(initialMetadata).length > 0
            ? initialMetadata
            : undefined
        );
        setIsReady(true);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[LSP session] Connect failed:', err);
        setIsReady(false);
      });

    return () => {
      c.disconnect();
      clientRef.current = null;
      setClient(null);
      setIsReady(false);
      setSemanticTokensLegend(null);
      setCapabilities(null);
    };
    // Connect once per mount. Metadata changes after mount are the
    // wrapper's responsibility (via the exposed `client` ref and the
    // appropriate custom method).
    // eslint-disable-next-line
  }, []);

  const didChange = useCallback((text: string) => {
    const c = clientRef.current;
    if (!c) return;
    c.didChange(text, ++versionRef.current);
  }, []);

  const getCompletions = useCallback(
    async (plainText: string, offset: number): Promise<ILspCompletionItem[]> => {
      const c = clientRef.current;
      if (!c) return [];
      const { line, character } = offsetToLspPosition(plainText, offset);
      try {
        return await c.getCompletions(line, character);
      } catch {
        return [];
      }
    },
    []
  );

  const format = useCallback(async (): Promise<string | null> => {
    const c = clientRef.current;
    if (!c) return null;
    try {
      return await c.format();
    } catch {
      return null;
    }
  }, []);

  return {
    client,
    uri: uriRef.current,
    isReady,
    // Generic session has no language-specific context to bind;
    // wrappers (`useDpqlSession`) override this on their returned
    // session by spreading + replacing.
    isContextReady: true,
    diagnostics,
    semanticTokensLegend,
    capabilities,
    didChange,
    getCompletions,
    format,
  };
}
