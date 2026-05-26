// Copyright 2026 Qore Technologies, s.r.o.
// Type definitions for QonsoleSmartInput — a Reqraft component that
// drives the Qorus Qonsole `/lsp` LSP from a SmartEditor.

/**
 * `/use` context override for a Qonsole document. The server reads this
 * via `textDocument.metadata.context` on didOpen and via the
 * `qonsole/setContext` custom method. Matches the shape documented in
 * `qorus/design/qonsole-lsp.md` and confirmed by the live spike.
 */
export interface IQonsoleAssistContext {
  /** Resource kind — `'services'`, `'workflows'`, `'connections'`, … */
  resource: string;
  /** Resource public name (preferred) */
  name?: string;
  /** Resource identifier (alternative to `name`) */
  identifier?: string;
}

/** Feature subset to request from `qonsole/assist`. */
export type TQonsoleAssistFeature =
  | 'completion'
  | 'diagnostics'
  | 'hover'
  | 'signature'
  | 'tokens'
  | 'format'
  | 'suggestions'
  | 'wizards'
  | 'all';

/**
 * Raw `qonsole/assist` payload. Shape captured from the live spike on
 * 2026-05-25 and documented in `QONSOLE_LSP_REFERENCE.md`. Kept as a
 * loose record because the server has freedom to add fields; consumers
 * should validate specific feature blocks they consume.
 */
export interface IQonsoleAssistResult {
  version: string;
  // Server literal — `"command"` (input starts with `/`), `"nl"`
  // (free-form natural language), or `"empty"`. The earlier
  // `"natural-language"` was a documentation error; the server
  // returns the literal `"nl"` (see QonsoleAssistService.qc:282).
  mode: 'command' | 'nl' | 'empty';
  context?: Record<string, unknown>;
  canonical?: {
    command_name?: string;
    verb?: string;
    description?: string;
    resource?: string;
  };
  completion?: {
    state: string;
    prefix: string;
    replace_start: number;
    replace_end: number;
    items: Array<Record<string, any>>;
  };
  starter_suggestions?: Record<string, any>;
  diagnostics?: Array<Record<string, any>>;
  hover?: Record<string, any>;
  signature?: Record<string, any>;
  tokens?: Array<{ start: number; end: number; type: string; modifiers: string[] }>;
  format?: Record<string, any>;
  related_wizards?: Array<Record<string, any>>;
  metrics?: {
    duration_ms: number;
    completion_items: number;
    diagnostic_count: number;
    suggestion_count: number;
    wizard_count: number;
  };
}

export interface IQonsoleSmartInputProps {
  /** Current value as plain text. Single-line by convention but multi-line works. */
  value: string;
  /** Called with the new plain-text value whenever the document changes. */
  onChange: (value: string) => void;
  /**
   * Optional `/use` context override. Sent as `textDocument.metadata.context`
   * on the initial `didOpen` and re-dispatched via `qonsole/setContext`
   * whenever it changes.
   */
  useContext?: IQonsoleAssistContext;
  /** Read-only mode. */
  readOnly?: boolean;
  /** CSS height of the editable area. Default `'40px'` — single-line look. */
  height?: string;
  /** Called when the editor loses focus. */
  onBlur?: () => void;
  /**
   * Called when the user accepts a wizard-launch completion item —
   * i.e. an item whose `command.command === "qonsole.startWizard"`.
   * The argument is the server-supplied wizard descriptor:
   *
   *   `{ action: 'start-wizard', name, title, short_desc, verb,
   *      resource, start_path, source_command }`
   *
   * The consumer is responsible for launching the wizard flow —
   * typically POSTing to `start_path` and rendering a step-by-step
   * modal. Reqraft provides no wizard runner UI; that lives in the
   * qorus-ide consumer.
   *
   * When this prop is set, wizard items are NOT inserted as text on
   * accept; this callback fires instead. When it's `undefined`, the
   * item's `label` falls through to plain-text insertion (degraded
   * but harmless).
   *
   * See `qorus/Classes/QonsoleAssistService.qc:818` for the
   * wizard descriptor's exact shape.
   */
  onWizardStart?: (args: Record<string, unknown>) => void;
}

export interface IQonsoleSmartInputRef {
  /**
   * Synchronous validation via `qonsole/validate`. Returns
   * `{valid: true}` when the server reports no diagnostics, otherwise
   * `{valid: false, errors: [{message}]}`.
   */
  validate: () => Promise<{ valid: boolean; errors?: Array<{ message: string }> }>;
  /**
   * Fetch a rich assist snapshot at the current cursor position.
   * Returns the full server payload (completion + signature + hover +
   * tokens + diagnostics + …) for callers that want one round-trip per
   * keystroke instead of N requests.
   */
  assist: (
    position: { line: number; character: number },
    features?: TQonsoleAssistFeature[]
  ) => Promise<IQonsoleAssistResult | null>;
}
