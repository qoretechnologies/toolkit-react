// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Noticing that text typed into a PLAIN (non-expression) field is really a
 * DPQL expression, and deciding what to do about it.
 *
 * The rule this implements, in one sentence: **switch the field into
 * expression mode only when the text cannot be a valid literal for the
 * field's type but IS a real expression; otherwise offer, never silently
 * reinterpret.** Quietly turning the string `a + b` into a concatenation on a
 * `string` field would destroy a legitimate literal, so a type that accepts
 * any text never auto-switches — it only ever offers.
 *
 * ## Why the server has the last word
 *
 * "Does this parse as DPQL?" is NOT a usable test, which is the trap here.
 * Verified against the live LSP: `dpql/parse` reports `success: true` for
 * `hello`, for `42`, for `2026-09-06` and for `@a` — it wraps each of them in
 * a trivial `{exp: 'value', args: [...]}` node. Everything is a valid DPQL
 * program, because a bare literal is one. So a text that parses tells us
 * nothing; what tells us something is the SHAPE of the AST that comes back:
 *
 * | typed text        | `exp`      | verdict    |
 * |-------------------|------------|------------|
 * | `hello`, `42`     | `value`    | a literal  |
 * | `$local:count`    | `template` | a template |
 * | `@a > 5`          | `>`        | expression |
 * | `"a" + "b"`       | `+`        | expression |
 * | `toInt("5")`      | `toInt`    | expression |
 *
 * `isRealExpressionAst` is that test, and it is the only authority. The
 * lexical pass below decides nothing — its sole job is to keep a server
 * round-trip off every keystroke of every field.
 */
import { validateField } from './validations';

/** What to do about text that turned out to be an expression. */
export type TDpqlDetectionOutcome =
  /** Not an expression, or not one we may act on — leave the field alone. */
  | 'none'
  /** A real expression, but the text is also a valid literal here: ask. */
  | 'offer'
  /** A real expression, and the text cannot be a literal here: switch. */
  | 'switch';

/**
 * The `exp` values that mean "this is not an expression": a bare literal and
 * a bare template reference. A template is already the template field's job
 * (`isValueTemplate`), and a literal is what the plain field is for.
 */
const NON_EXPRESSION_OPS = new Set(['value', 'template']);

/**
 * Operators and calls whose presence makes a server probe worth the trip.
 * Deliberately generous — a false positive costs one debounced request that
 * comes back `exp: 'value'`, while a false negative silently loses the whole
 * feature. `-` and `/` require surrounding spaces so that dates
 * (`2026-09-06`), negative numbers (`-5`) and paths (`a/b`) don't trigger a
 * probe on every keystroke.
 */
const DPQL_OPERATOR_PATTERN = new RegExp(
  [
    '(==|!=|<>|>=|<=)', // two-character comparisons
    '[<>*%]', // unambiguous single-character operators
    '(?<!=)=(?!=)', // a lone `=`, not part of `==`
    '\\s[-+/]\\s', // arithmetic that is spaced (so `2026-09-06` is not)
    '\\b(and|or|not|like|in|contains)\\b', // word operators
  ].join('|'),
  'i'
);

/** A function call — `toInt("5")`, `upper(@name)`. */
const DPQL_CALL_PATTERN = /\b[a-z_]\w*\s*\(/i;

/**
 * The longest text worth probing. An expression a person types into a form
 * field is short; anything longer is a document, and probing it on every
 * keystroke would be a waste of a round-trip.
 */
const MAX_PROBE_LENGTH = 512;

/**
 * Cheap, purely lexical "might this be worth asking the server about?".
 * Never decides anything on its own — see the module comment.
 */
export const mightBeDpqlExpression = (text: unknown): boolean => {
  if (typeof text !== 'string') {
    return false;
  }

  const trimmed = text.trim();

  if (!trimmed || trimmed.length > MAX_PROBE_LENGTH) {
    return false;
  }

  return DPQL_OPERATOR_PATTERN.test(trimmed) || DPQL_CALL_PATTERN.test(trimmed);
};

/**
 * The authority: does this `dpql/parse` result describe a REAL expression
 * rather than a literal or a bare template reference? Accepts either the
 * field-ready envelope (`{is_expression, value: {exp, args}}`) the server
 * returns or a bare `{exp, args}` node.
 */
export const isRealExpressionAst = (expression: unknown): boolean => {
  if (!expression || typeof expression !== 'object') {
    return false;
  }

  const envelope = expression as { value?: unknown; exp?: unknown };
  const node = (
    envelope.exp === undefined && envelope.value && typeof envelope.value === 'object'
      ? envelope.value
      : envelope
  ) as { exp?: unknown };

  return typeof node.exp === 'string' && !!node.exp && !NON_EXPRESSION_OPS.has(node.exp);
};

/**
 * `true` when any diagnostic is an outright error. The server reports
 * severity as the string `'error'` on this route and LSP proper uses `1`;
 * both are accepted rather than assuming one.
 */
export const hasErrorDiagnostic = (
  diagnostics?: Array<{ severity?: number | string } | undefined | null>
): boolean =>
  !!diagnostics?.some((diagnostic) => {
    const severity = diagnostic?.severity;
    return severity === 1 || severity === 'error';
  });

/**
 * Could this text stand as a literal value of the field's own type? A type
 * that accepts any text (`string`, and every type the form validator passes
 * by default) always can, which is exactly why such a field never
 * auto-switches. Delegates to the form's own validator so the answer is the
 * same one the field itself would give.
 */
export const canBeLiteralOfType = (
  text: string,
  type?: string,
  field?: Record<string, any>
): boolean => {
  if (!type) {
    return true;
  }

  try {
    return validateField(type, text, field as any);
  } catch {
    // A validator that throws must not be read as "this cannot be a
    // literal" — that would auto-switch the field on the strength of a bug.
    return true;
  }
};

export interface IClassifyTypedTextArgs {
  /** The text the author typed into the plain field. */
  text: string;
  /** The field's declared type (`ui_type ?? type`). */
  type?: string;
  /** The field schema, for validators that consult `validation_regex` etc. */
  field?: Record<string, any>;
  /** The `dpql/parse` result for `text`, or `undefined` if it has not run. */
  parsed?: {
    success?: boolean;
    expression?: unknown;
    diagnostics?: Array<{ severity?: number | string }>;
  };
}

/**
 * The whole decision, in one pure function so it can be tested without a
 * server, a socket or a rendered field.
 */
export const classifyTypedText = ({
  text,
  type,
  field,
  parsed,
}: IClassifyTypedTextArgs): TDpqlDetectionOutcome => {
  if (!parsed?.success || !parsed.expression) {
    return 'none';
  }

  if (!isRealExpressionAst(parsed.expression) || hasErrorDiagnostic(parsed.diagnostics)) {
    return 'none';
  }

  return canBeLiteralOfType(text, type, field) ? 'offer' : 'switch';
};
