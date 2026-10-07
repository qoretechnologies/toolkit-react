// Copyright 2026 Qore Technologies, s.r.o.
// What the Text view is given for an expression built in the Visual view.
//
// The Visual view stores operands in the shapes its editors produce, and two of
// them are not DPQL at all:
//
// - an operand switched to "Use Expression" whose operation is not chosen yet
//   (`{ is_expression: true, value: { args } }`, no `exp`), and an operand not
//   filled in (`{}`, `{ type }`): there is nothing to write for them;
// - a custom Text value, which is a rich-text document (a list of Slate nodes),
//   not a string.
//
// `dpql/serialize` was handed them as they were and wrote what it could of a
// hash or a list: the server `{args=(null)} > {type=int}`, a stand-in
// `undefined([object Object]) > [object Object]`. This module turns the AST into
// what serialize can write, or says that it cannot be written yet.
import { richtextToSegments, richtextToString } from '../../../helpers/common';
import { renderExpressionToText } from './renderExpressionToText';
import { IExpression, IExpressionSchema, IExpressionValue } from './types';

/** How a part not filled in yet is written: as the read-first row summary writes it. */
export const EXPRESSION_HOLE = '…';

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** A rich-text value as the operand DPQL can write, or `undefined` when it is empty. */
const richtextOperand = (value: unknown): IExpression | undefined => {
  const segments = richtextToSegments(value as never).filter(
    (segment) => segment.kind === 'tag' || segment.text.trim()
  );
  if (!segments.length) return undefined;
  // a single template is that template, as a template picked from the list is
  if (segments.length === 1 && segments[0].kind === 'tag') {
    return { type: 'auto', value: segments[0].value };
  }
  return { type: 'string', value: richtextToString(value as never) };
};

/** One operand as DPQL can write it, or `undefined` when it is not filled in. */
const operandOf = (arg: unknown): unknown => {
  if (arg === undefined || arg === null) return undefined;
  if (!isObject(arg)) return arg;
  if (arg.is_expression) {
    const nested = isObject(arg.value) ? writableValue(arg.value as IExpressionValue) : undefined;
    return nested ? { ...arg, value: nested } : undefined;
  }
  if ('exp' in arg) return writableValue(arg as IExpressionValue);
  if (!('value' in arg) || arg.value === undefined) return undefined;
  if (arg.type === 'richtext') return richtextOperand(arg.value);
  return arg;
};

/** The expression with every operand as DPQL can write it, or `undefined` when one is missing. */
const writableValue = (value: IExpressionValue): IExpressionValue | undefined => {
  if (!value.exp) return undefined;
  const args: unknown[] = [];
  for (const arg of value.args ?? []) {
    const operand = operandOf(arg);
    if (operand === undefined) return undefined;
    args.push(operand);
  }
  return { ...value, args: args as IExpression[] };
};

/**
 * The expression as `dpql/serialize` can write it, or `undefined` when part of it
 * is not filled in yet (an operation not chosen, an operand left empty).
 */
export const serializableExpression = (
  value: IExpressionValue | undefined
): IExpressionValue | undefined => (value ? writableValue(value) : undefined);

/**
 * An expression that is not filled in yet, as text: what is there, and a
 * {@link EXPRESSION_HOLE} for each part that is not - `… > …` for a comparison
 * whose values are not chosen, as the read-first row writes it. Not DPQL; the
 * Text view shows it until the author writes the rest.
 */
export const incompleteExpressionText = (
  value: IExpressionValue | undefined,
  expressions: IExpressionSchema[] = []
): string => {
  const withHoles = (node: IExpressionValue | undefined): IExpressionValue => ({
    // an operation not chosen yet is a hole of its own
    exp: node?.exp,
    args: (node?.args ?? []).map((arg) => {
      const operand = operandOf(arg);
      if (operand !== undefined) return operand as IExpression;
      if (isObject(arg) && arg.is_expression && isObject(arg.value) && arg.value.exp) {
        return { is_expression: true, value: withHoles(arg.value as IExpressionValue) };
      }
      return { is_expression: true, value: { exp: HOLE_EXP, args: [] } };
    }),
  });
  if (!value?.exp) return EXPRESSION_HOLE;
  return renderExpressionToText(withHoles(value), [
    ...expressions,
    { name: HOLE_EXP, symbol: HOLE_EXP } as IExpressionSchema,
  ])
    .replace(HOLE_CALL, EXPRESSION_HOLE)
    // a field of the record, as DPQL names it
    .replace(/"\$record:\{([^}]+)\}"/g, '@$1');
};

/** A stand-in operation for a hole while rendering, written back as {@link EXPRESSION_HOLE}. */
const HOLE_EXP = '__expression_hole__';
const HOLE_CALL = new RegExp(`${HOLE_EXP}\\(\\)`, 'g');
