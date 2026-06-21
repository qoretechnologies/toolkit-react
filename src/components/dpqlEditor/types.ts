// Copyright 2026 Qore Technologies, s.r.o.
// Type definitions for the DpqlEditor component. Slate node types
// (`ISlateElement`, `ISlateText`, `TSlateNode`) live in the smartEditor
// primitive's `types.ts` — re-export them here for backward compat.

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
  /**
   * Optional **minimum** height of the editable area (CSS value). The
   * editor auto-grows with its content; this is just a floor. Omit for a
   * single-line field that grows as you type (right for match-expression
   * fields); pass e.g. `'200px'` for a taller multi-line code editor.
   */
  height?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /**
   * Whether to render diagnostic underlines. Default `true`. Set `false`
   * for display-only surfaces whose text is not valid DPQL — e.g. the
   * expression "Explain" panel (server rendering shown through the editor
   * for template chips + LSP token colours). See `ISmartEditorProps`.
   */
  showDiagnostics?: boolean;
  /** Whether to show hover popovers (`textDocument/hover`). Default `true`. */
  enableHover?: boolean;
  /**
   * Color template (`$…`) tags with the `info` intent instead of the per-prefix
   * palette — for read-only render surfaces (the Explain panel) that mirror
   * qorus-ide's uniform `info` template styling. Default `false` (per-prefix
   * palette, the editor's at-a-glance prefix coloring).
   */
  templateTagsUseIntent?: boolean;
  /** Called when the editor loses focus. */
  onBlur?: () => void;
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

  /**
   * Bind the document's field set to the canonical alert-payload
   * schema (`severity`, `alert_type`, `alert_code`, `alert_class`,
   * `interface_type`, `interface_name`, `alert_object`, …). Required
   * for the Alert Rule / Silence editor to produce correct
   * completions and diagnostics on `@payload.field` references.
   *
   * Server contract: `dpql/setAlertPayloadContext`. The server treats
   * alert-payload and provider/recordType bindings as **mutually
   * exclusive** — when this is `true`, the `provider` /
   * `recordType` / `options` / `actionCode` props are silently
   * ignored. Toggling this prop back to `false` re-binds the
   * provider context if one is configured (via `dpql/setContext`).
   *
   * Default `false`.
   */
  alertPayloadContext?: boolean;

  /**
   * FSM context for state-aware template completions. When set,
   * `$data:` / `$fsminput:` template namespaces resolve against the
   * FSM's state graph; pass `currentState` to narrow `$data:` to a
   * specific state's payload.
   *
   * Exactly one of `fsm` / `draftId` / `fsmId` must be provided.
   * Pass `undefined` (or omit the prop) to clear any existing FSM
   * binding for this session.
   *
   * Server contract: `dpql/setFsmContext`. Independent of and
   * composable with `provider`/`recordType` (provider yields field
   * completions; FSM yields template completions).
   */
  fsmContext?: TDpqlFsmContext;
}

/**
 * FSM context source — exactly one of `fsm` / `draftId` / `fsmId`.
 * The optional `currentState` narrows state-data completions to that
 * state when present.
 */
export type TDpqlFsmContext =
  | { fsm: Record<string, any>; currentState?: string; draftId?: never; fsmId?: never }
  | { draftId: string; currentState?: string; fsm?: never; fsmId?: never }
  | { fsmId: number; currentState?: string; fsm?: never; draftId?: never };

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
