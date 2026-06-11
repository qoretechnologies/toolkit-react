// Copyright 2026 Qore Technologies, s.r.o.
//
// Minimal LSP type subset used by `ReqraftLspClient` — intentionally narrow;
// language-specific wrappers layer richer types on top.

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
  /**
   * Opaque server-supplied data carried with the item. Qonsole uses
   * this to encode wizard launch metadata (`{action: 'start-wizard',
   * name, start_path, ...}`) and per-kind hints (verb aliases, flag
   * types, etc.). The client passes it back via `completionItem/resolve`
   * if implemented; for now consumers (inserters, custom click
   * handlers) read it directly.
   */
  data?: Record<string, unknown>;
  /**
   * Server-side warning copy attached to specific items — Qonsole
   * uses this on mutating verbs ("Changes system state; execution
   * may require confirmation."). Rendered as a right-aligned chip
   * in the dropdown row.
   */
  warning?: string;
  /**
   * Command to execute on accept INSTEAD OF inserting `insertText`/
   * `textEdit`. Used by Qonsole for wizard launch items
   * (`{ command: 'qonsole.startWizard', arguments: [{...}] }`).
   * Standard LSP shape; the client is responsible for executing it
   * (the server rejects `workspace/executeCommand` for `qonsole.*`).
   */
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
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

/**
 * One parameter inside a signature. `label` is either a substring of
 * the parent signature's `label` or a literal name string. `documentation`
 * carries optional markdown / plaintext explainer.
 */
export interface ILspParameterInformation {
  label: string | [number, number];
  documentation?: ILspMarkupContent | string | null;
}

/**
 * A single function / operator signature. `parameters` lists the
 * positional parameters in order; the consumer highlights the one at
 * `activeParameter` from the parent `ILspSignatureHelp`.
 */
export interface ILspSignatureInformation {
  label: string;
  documentation?: ILspMarkupContent | string | null;
  parameters?: ILspParameterInformation[];
  /** Per-signature active parameter override (LSP spec optional). */
  activeParameter?: number;
}

/**
 * Response shape for `textDocument/signatureHelp`. Empty `signatures`
 * means "no help available at this position".
 */
export interface ILspSignatureHelp {
  signatures: ILspSignatureInformation[];
  /** Index into `signatures` of the active overload. Default 0. */
  activeSignature?: number;
  /** Index into the active signature's `parameters`. Default 0. */
  activeParameter?: number;
}

/**
 * Minimal projection of the server's `initialize` response
 * `capabilities` block — only the providers we currently read on the
 * client. Hooks gate themselves on the presence of the relevant
 * provider so an editor talking to a server that doesn't support a
 * feature degrades to no-op rather than erroring.
 */
export interface ILspServerCapabilities {
  completionProvider?: {
    triggerCharacters?: string[];
    resolveProvider?: boolean;
  };
  signatureHelpProvider?: {
    triggerCharacters?: string[];
    retriggerCharacters?: string[];
  };
  hoverProvider?: boolean | { workDoneProgress?: boolean };
  semanticTokensProvider?: {
    legend: ILspSemanticTokensLegend;
    full?: boolean | object;
    range?: boolean | object;
  };
  codeActionProvider?:
    | boolean
    | {
        codeActionKinds?: string[];
        resolveProvider?: boolean;
      };
  /** Allow unknown providers to pass through for forward compat. */
  [key: string]: unknown;
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
