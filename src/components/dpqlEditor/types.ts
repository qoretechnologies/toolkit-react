// Copyright 2026 Qore Technologies, s.r.o.
// Type definitions for the DpqlEditor component. Slate node types
// (`ISlateElement`, `ISlateText`, `TSlateNode`) live in the smartEditor
// primitive's `types.ts` — re-export them here for backward compat.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { TSizes } from '@qoretechnologies/reqore/dist/constants/sizes';

export type {
  ISlateElement,
  ISlateText,
  TSlateNode,
} from '../smartEditor/types';

/** Result of a `dpql/parse` request — DPQL-specific custom LSP method. */
export interface IDpqlParseResult {
  success: boolean;
  expression: Record<string, any> | null;
  /** The type the server inferred for the expression's result. */
  inferred_type?: string;
  /** Echo of the `target_type` the request asked about, when one was sent. */
  target_type?: string;
  /** `true` when the inferred type already satisfies the target. */
  type_compatible?: boolean;
  /** `true` when a conversion to the target exists at all. */
  auto_coercible?: boolean;
  /**
   * `true` when that conversion is only ATTEMPTED, not guaranteed — text used
   * as a number, whose outcome depends on what the text turns out to hold.
   * A total conversion (a number used as text) reports `false`, and the server
   * emits no diagnostic for it: warning about something that cannot fail
   * teaches authors to ignore the warnings that can.
   */
  coercion_may_fail?: boolean;
  /** The conversion that would make the expression fit, when one would. */
  suggested_fix?: { text: string; description?: string };
  /**
   * How the server reads the expression as a condition, when the request asked (`condition: true`):
   * `condition` (it gives true or false), `truthiness` (a number, a list, a hash: true unless it is zero or
   * empty), `not_a_condition` (text, a date or a time), `unknown` (a result it cannot tell). A server that
   * does not know the question leaves it out.
   */
  condition_reading?: 'condition' | 'truthiness' | 'not_a_condition' | 'unknown';
  /**
   * With `condition`: each part of the expression's `&&`, `||` and `!`, at any depth, with the type it gives
   * and how a condition reads it - in the server's walk order (qorus#646). `condition_reading` is the worst of
   * the expression's own reading and its parts'.
   */
  parts?: Array<{
    type: string;
    reading: 'condition' | 'truthiness' | 'not_a_condition' | 'unknown';
  }>;
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

/** What else a `dpql/parse` asks. */
export interface IDpqlParseOptions {
  /**
   * The expression is a condition: ask how the server reads it as one (`condition: true`) instead of
   * whether it fits a type; the target type is not sent.
   */
  condition?: boolean;
}

/** A record's fields for `dpql/setContext`: each field's type (or types) and an optional description. */
export type TDpqlFields = Record<string, { type: string | string[]; desc?: string }>;

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
   * The record's fields, for a record no data provider has (a sheet contract's columns and added fields):
   * each field's type - a Qore type name, or a list of them for a field that may hold any of them - and an
   * optional description. Sent as `fields` on `dpql/setContext` and at `didOpen`; completion, validation and
   * hover then offer them. With a provider too, the provider's fields are replaced.
   */
  fields?: TDpqlFields;
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
  /**
   * The size the text is drawn at, as a field of that size draws it - and the chips in it with it. A host
   * drawing the same value as another field (an expression's Value and Expression tabs) gives both one size,
   * so a reference is the same chip in either (qorus#646). The editor's own when not given.
   */
  size?: TSizes;
  /** Read-only mode. */
  readOnly?: boolean;
  /** `off`: a line does not wrap; the text scrolls sideways inside its box. Default `on`. */
  wordWrap?: 'on' | 'off';
  /** The tallest the text's box grows; the text scrolls within it past that. Unlimited when not given. */
  maxHeight?: string;
  /** Each line's number before it, as a code editor shows them. Default off. */
  lineNumbers?: boolean;
  /**
   * Whether to render diagnostic underlines. Default `true`. Set `false`
   * for display-only surfaces whose text is not valid DPQL — e.g. the
   * expression "Explain" panel (server rendering shown through the editor
   * for template chips + LSP token colors). See `ISmartEditorProps`.
   */
  showDiagnostics?: boolean;
  /** Whether to show hover popovers (`textDocument/hover`). Default `true`. */
  enableHover?: boolean;
  /**
   * Draw a template (`$…`) chip as every other template chip is drawn (`getTemplateTagStyle`: `info`, or the
   * catalogue entry's built-in or event-trigger intent). Default `true` (qorus#646): a template was blue in a
   * value's text and gray in an expression's. `false` keeps the per-prefix palette (`TEMPLATE_COLORS`).
   */
  templateTagsUseIntent?: boolean;
  /**
   * The overlay shown while the language server connects. Forwarded to
   * `SmartEditor`; pass `null` to show the text without one — a read-only
   * rendering already has its text, and only its colors wait for the server.
   */
  loadingIndicator?: React.ReactNode;
  /**
   * The template catalogue the surface offers: a `$…` reference found in it
   * is labelled by its catalogue name. See `IDpqlTagRendererOptions.templates`.
   */
  templates?: IReqoreFormTemplates;
  /**
   * Whether the field's templates can be browsed as their catalogue nests them - their groups, a record's members -
   * in the template picker, from a button beside the text (qorus#646, David's review: a DPQL field offered no
   * hierarchy). A template chosen there is put in at the caret, where a value can go. On by default where the
   * editor has templates and can be edited. A click in the empty text, a click on a chip and a group's row in the
   * completion list open the same picker.
   */
  browseTemplates?: boolean;
  /** Called when the editor loses focus. */
  onBlur?: () => void;
  /**
   * Called once when there is no language server to talk to (connecting failed): the editor can show the
   * text but not parse, serialize or complete it, so a host that needs those offers what works without it.
   */
  onUnavailable?: () => void;
  /**
   * Called once the language server can parse and write this editor's text: its session is connected and
   * its context bound. A host that parses or serializes through the editor's ref waits for this rather
   * than asking earlier, when the answer is "nothing parsed".
   */
  onReady?: () => void;
  /**
   * A click, a tap or Tab into the text asks what can be written at the caret, and the one completion list
   * opens there: the server's completion, with the field's templates where a value can be written (qorus#646,
   * David's decision). On by default where the editor has templates; an expression's Text view turns it on
   * always.
   */
  completeOnClick?: boolean;
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
  /**
   * Parse DPQL text into an expression AST via `dpql/parse`.
   *
   * `targetType` asks the server, in the same round trip, whether the
   * expression's result can satisfy that type — see `coercion_may_fail` on
   * the result. Omit it to ask only whether the text parses.
   *
   * `condition` asks instead how the server reads the expression as a condition (`condition_reading`).
   */
  parse: (
    text: string,
    targetType?: string,
    options?: IDpqlParseOptions
  ) => Promise<IDpqlParseResult>;
  /**
   * Serialize an expression AST back to DPQL text via `dpql/serialize`: '' while the session has no client,
   * and rejected, with the server's reason, when the server refuses to write the value.
   */
  serialize: (expression: Record<string, any>) => Promise<string>;
}
