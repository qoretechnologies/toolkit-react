// Copyright 2026 Qore Technologies, s.r.o.
// Generic LSP session lifecycle hook. Manages a single `LspClient` instance
// per-mount: connect → didOpen with optional metadata → forward subsequent
// content changes via didChange → expose the live client so wrappers can
// dispatch language-specific custom methods (e.g. `dpql/setContext`,
// `qonsole/assist`). Cleans up on unmount.

import { useCallback, useEffect, useRef, useState } from 'react';
import { LspClient } from '../../utils/lspClient';
import { ILspCompletionItem, ILspDiagnostic } from '../../utils/lspClient.types';
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
  /** Most-recent `textDocument/publishDiagnostics` payload for this document. */
  diagnostics: ILspDiagnostic[];
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
    diagnostics,
    didChange,
    getCompletions,
    format,
  };
}
