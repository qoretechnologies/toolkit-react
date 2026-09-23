// Copyright 2026 Qore Technologies, s.r.o.
// Types for the expression subsystem. A Qorus expression is an AST
// `{ exp, args }`; DPQL is its text serialization (dpql/parse ↔
// dpql/serialize). A field stores it as `is_expression: true` + the AST.
import { TQorusExpressionReturnType } from '@qoretechnologies/ts-toolkit';

/** The AST: an expression name plus its argument list. */
export interface IExpressionValue {
  exp?: string;
  args?: IExpression[];
}

/**
 * One node in an expression. A leaf is `{ type, value }` (a literal or a
 * `$template:ref`); a nested expression sets `is_expression: true` and
 * carries `{ exp, args }` in `value`.
 */
export interface IExpression {
  value?: IExpressionValue | any;
  type?: string;
  is_expression?: boolean;
  required?: boolean;
  /** Set when an arg's value type is accepted-but-not-exact (confirm UI). */
  types_mismatch?: boolean;
}

/** The seed value for a fresh expression. */
export const ExpressionDefaultValue: IExpression = {
  value: { args: [] },
  is_expression: true,
};

/**
 * One argument slot in an expression schema. Mirrors a form-field schema
 * arg plus the operand-label affixes. `ui_type` is the UI type the
 * operand field renders (a superset of `TQorusType` — includes
 * `select-string` etc.), so it is typed loosely as a string.
 */
export interface IExpressionSchemaArg {
  name?: string;
  display_name?: string;
  short_desc?: string;
  desc?: string;
  /** The operand field type (UI superset of TQorusType). */
  ui_type: string;
  signature_type_code?: string;
  required?: boolean;
  default_value?: any;
  allowed_values?: any[];
  element_allowed_values?: any[];
  /** Text shown before the operand field. */
  label_before?: string;
  /** Text shown after the operand field. */
  label_after?: string;
  sensitive?: boolean;
}

/**
 * One entry in the expression catalogue (`GET /system?action=expressions`).
 * `subtype: 2` marks a logical group (`&&` / `||`); `subtype: 1` is a
 * normal expression. `symbol` drives the readable rendering.
 */
export interface IExpressionSchema {
  name: string;
  display_name: string;
  short_desc: string;
  desc: string;
  /**
   * What the expression evaluates to.
   *
   * Not a plain `TQorusType`: the server names a container's element type inline,
   * so `list<string>` and `hash<auto>` are ordinary answers here and a narrower
   * type would refuse the catalogue the server actually serves. Taken from
   * ts-toolkit rather than restated, so the two cannot drift.
   */
  return_type: TQorusExpressionReturnType;
  ui_return_type: string;
  symbol: string;
  /**
   * How the server's readable rendering (`dpql/renderExpression`) spells this
   * expression, when not by its symbol: `$arg[n]` is an argument, `$symbol` the
   * symbol, `$args` all arguments, and `${arg[n] ? set : unset}` reads the
   * argument or its `default_value` — e.g. `$arg[0].startsWith($arg[1], $arg[2])`.
   */
  render_template?: string;
  /** Server type code (operator/function); not a reliable infix discriminator. */
  type: number;
  /** `1` normal, `2` logical group (AND/OR). */
  subtype: 1 | 2;
  args: IExpressionSchemaArg[];
  varargs: boolean;
  role?: number;
  min_args?: number;
  groups?: string[];
  /** Provenance markers when merged with a data-provider's `expressions_url`. */
  from_server?: boolean;
  from_both?: boolean;
  return_type_first_arg?: boolean;
  return_type_arg_priority?: string[];
}

/** Where a varargs expression offers operand reordering. */
export type TExpressionReorderSurface = 'overflowMenu' | 'dragHandle' | 'positionPicker';

/**
 * `true` (the default) renders the drag grip together with the "Move Argument"
 * section in the field's `⋮` menu; `false` turns reordering off; a list
 * renders exactly those surfaces.
 */
export type TExpressionReorder = boolean | TExpressionReorderSurface[];
