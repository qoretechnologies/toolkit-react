// Copyright 2026 Qore Technologies, s.r.o.
// Type definitions for the DpqlEditor component.

import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';

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

/** Slate node — either an element (paragraph/tag) or a text node. */
export type TSlateNode = ISlateElement | ISlateText;

/** Slate custom element. Mirrors Reqore's CustomElement shape. */
export interface ISlateElement {
  type: 'paragraph' | 'tag';
  value?: string | number;
  label?: string | number;
  metadata?: Record<string, any>;
  children: TSlateNode[];
}

/** Slate custom text node with formatting + syntax-highlight + diagnostic marks. */
export interface ISlateText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  // Syntax highlighting decorations
  keyword?: boolean;
  string?: boolean;
  number?: boolean;
  operator?: boolean;
  comment?: boolean;
  function?: boolean;
  boolean?: boolean;
  // Diagnostic decorations
  error?: boolean;
}
