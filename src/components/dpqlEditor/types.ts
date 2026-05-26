// Copyright 2026 Qore Technologies, s.r.o.
// Type definitions for the DpqlEditor component. Slate node types
// (`ISlateElement`, `ISlateText`, `TSlateNode`) live in the smartEditor
// primitive's `types.ts` — re-export them here for backward compat.

import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';

export type {
  ISlateElement,
  ISlateText,
  TSlateNode,
} from '../smartEditor/types';

/** Result of a `dpql/parse` request — DPQL-specific custom LSP method. */
export interface IDpqlParseResult {
  success: boolean;
  expression: Record<string, any> | null;
  diagnostics: Array<{
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    message: string;
    severity?: number;
    code?: string | number;
    source?: string;
  }>;
}

export interface IDpqlEditorProps {
  /** Current value as plain DPQL text. */
  value: string;
  /** Called with plain DPQL text whenever the editor content changes. */
  onChange: (value: string) => void;
  /**
   * Data provider path for context-aware completions. Resolves to the
   * `provider` field on `dpql/setContext`. Supports the four forms
   * documented server-side: `@<app>/<action>`, `datasource:name`,
   * `connection:name`, or a factory string.
   */
  provider?: string;
  /** Record type: `'record'` (default), `'create'`, or `'update'`. */
  recordType?: string;
  /** Additional `dpql/setContext` options (forwarded as `options`). */
  options?: Record<string, any>;
  /**
   * FSM action code, surfaced to the server as `action_code` in `didOpen`
   * metadata. Used to derive search-context semantics for the editor
   * (e.g. DPAT_FIND / DPAT_UPDATE / DPAT_DELETE).
   */
  actionCode?: number;
  /** CSS height of the editable area. Default `'200px'`. */
  height?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Called when the editor loses focus. */
  onBlur?: () => void;
  /** Template picker items (for dropdown insertion above the editor). */
  templates?: IReqoreFormTemplates;
  /**
   * Current FSM state ID. When set, templates matching the form
   * `$data:{stateId.field}` are converted to `@field` on insertion.
   */
  stateId?: string;
  /**
   * Opt-in to server-driven plain-text → Slate parsing via the LSP's
   * `dpql/toRichtext` custom method. When `true`, the editor calls
   * `dpql/toRichtext({ text: value })` on mount and on every external
   * `value` change, and uses the server's structured response as the
   * Slate document. Falls back to the client-side regex parser if the
   * server request fails, times out, or returns a shape we don't
   * recognise. While the request is in flight, the editor shows the
   * "Connecting…" overlay (see `SmartEditor.loadingIndicator`).
   *
   * Trade-off: the server understands nested expressions, function
   * calls with templates inside, and quoted edge cases better than
   * the client regex — but the server's current `toRichtext` only
   * recognises `$template:value` patterns, NOT `@field` references.
   * For DPQL where field refs dominate, the client-side parser is
   * usually richer. Treat this as an escape hatch for documents that
   * tickle the client regex's known limitations.
   *
   * Default `false`.
   */
  useServerParse?: boolean;
}

/** Imperative methods exposed via the `DpqlEditor` ref. */
export interface IDpqlEditorRef {
  /** Format the document via `textDocument/formatting`. */
  format: () => Promise<void>;
  /**
   * Validate the document via `dpql/validate`. Returns `{valid: true}`
   * when the document has no diagnostics, otherwise an array of errors.
   */
  validate: () => Promise<{ valid: boolean; errors?: Array<{ message: string }> }>;
  /** Parse DPQL text into an expression AST via `dpql/parse`. */
  parse: (text: string) => Promise<IDpqlParseResult>;
  /** Serialize an expression AST back to DPQL text via `dpql/serialize`. */
  serialize: (expression: Record<string, any>) => Promise<string>;
}
