// Copyright 2026 Qore Technologies, s.r.o.
//
// Minimal LSP type subset used by Reqraft's `LspClient`. The shapes follow
// the Language Server Protocol JSON-RPC payloads but are intentionally narrow
// — only what an editor consuming completions / diagnostics / hover / format
// needs is exposed. Consumers can layer richer types on top in
// language-specific wrappers (e.g. a DPQL-specific `IDpqlCompletionItem`
// that extends `ILspCompletionItem`).

/** Zero-based line + UTF-16 character offset. */
export interface ILspPosition {
  line: number;
  character: number;
}

/** Inclusive start, exclusive end — per LSP convention. */
export interface ILspRange {
  start: ILspPosition;
  end: ILspPosition;
}

/**
 * Diagnostic delivered via `textDocument/publishDiagnostics` notifications
 * or returned synchronously from language-specific `<lang>/validate` methods.
 */
export interface ILspDiagnostic {
  range: ILspRange;
  message: string;
  /** LSP DiagnosticSeverity: 1 = Error, 2 = Warning, 3 = Information, 4 = Hint */
  severity?: number;
  code?: string | number;
  source?: string;
}

/**
 * Completion item from `textDocument/completion`. `kind` follows the LSP
 * CompletionItemKind enum (1 = Text, 2 = Method, 3 = Function, …).
 *
 * When the server supplies a `textEdit`, that is the authoritative way to
 * apply the completion — the range tells the client exactly which span of
 * the document to replace (including any partial token the user already
 * typed). Falling back to `insertText` without using `textEdit` can lead to
 * the partial token being duplicated (e.g. typed `-` + inserted `--desc=`
 * becomes `---desc=`).
 */
export interface ILspCompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  insertText?: string;
  /** 1 = PlainText, 2 = Snippet */
  insertTextFormat?: number;
  documentation?: ILspMarkupContent | string | null;
  sortText?: string;
  filterText?: string;
  /**
   * Authoritative edit instructions from the server. When present, the
   * `range` is the span to replace (start/end as line/character positions
   * in the plain-text projection of the document) and `newText` is what
   * to put there. Consumers should prefer `textEdit` over `insertText`.
   */
  textEdit?: {
    range: ILspRange;
    newText: string;
  };
  /** Characters that auto-accept this completion when typed after it. */
  commitCharacters?: string[];
}

/** Rich-text content from hover / completion documentation. */
export interface ILspMarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

/**
 * Token legend advertised by the server in
 * `initialize → capabilities.semanticTokensProvider.legend`. Both
 * arrays are positional — a semantic token's encoded `tokenType` int
 * is an index into `tokenTypes`, and its encoded `tokenModifiers` int
 * is a bitmask over `tokenModifiers`. The standard LSP legend has 16
 * token types and 6 modifiers, but servers may extend either list.
 */
export interface ILspSemanticTokensLegend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

/**
 * Decoded semantic-token span (the int-array → human-friendly form
 * the editor consumes). `tokenType` / `tokenModifiers` are already
 * resolved against the server's legend.
 */
export interface ILspSemanticToken {
  /** 0-based line number in the document. */
  line: number;
  /** 0-based column (UTF-16) on that line. */
  character: number;
  /** Token length in characters. */
  length: number;
  /** Resolved type name (e.g. `"keyword"`, `"variable"`, `"string"`). */
  tokenType: string;
  /** Resolved modifier names from the bitmask. */
  tokenModifiers: string[];
}

/** Edit returned by `textDocument/formatting`. */
export interface ILspTextEdit {
  range: ILspRange;
  newText: string;
}

/**
 * Document text payload for `didOpen` / `didChange`. Plain string is the
 * standard LSP shape; some Qorus-language servers (e.g. DPQL) also accept
 * a structured richtext envelope `{ type: 'richtext', value: [...] }` that
 * the server flattens server-side. Consumers that don't need the richtext
 * form should pass a string.
 */
export type TLspDocumentText = string | { type: 'richtext'; value: unknown[] };
