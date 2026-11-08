// Copyright 2026 Qore Technologies, s.r.o.
// The operands of an expression as the Visual view stores them, read as what they hold.
//
// The Visual view stores operands in the shapes its editors produce, and two of
// them are not values at all:
//
// - an operand switched to "Use Expression" whose operation is not chosen yet
//   (`{ is_expression: true, value: { args } }`, no `exp`), and an operand not
//   filled in (`{}`, `{ type }`): there is nothing in them yet;
// - a custom Text value, which is a rich-text document (a list of Slate nodes),
//   not a string.
//
// Everything that writes an expression as text reads its operands here - the
// Text view's `dpql/serialize`, the read-first row summary, and an application's
// own summaries - so none of them prints a hash or `[object Object]` for them.
// Pure: no transport/socket import.
import { richtextToString } from '../../../helpers/common';
import { isCompleteTemplateToken } from '../../../helpers/templates';
import { IExpression, IExpressionValue } from './types';

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/**
 * A rich-text value as Qorus reads it (`_priv_parse_ui_hash_value_intern`): its paragraphs, each its text with its
 * tags as their templates, joined with a newline - an empty paragraph too.
 */
const richtextAsTheServerReadsIt = (value: unknown): string =>
  Array.isArray(value) ?
    value.map((paragraph) => richtextToString([paragraph] as never)).join('\n')
  : richtextToString(value as never);

/**
 * A rich-text value as the operand it holds, or `undefined` when it is empty. It is a template when what it reads as
 * is one template and nothing else, as the server rules (`QorusUiExpression::uiTemplateArg()`): any character around
 * it - a space, a tab, a newline, a no-break space, another paragraph - makes it text, which evaluation keeps.
 */
const richtextOperand = (value: unknown): IExpression | undefined => {
  const text = richtextAsTheServerReadsIt(value);
  if (text === '') return undefined;
  if (isCompleteTemplateToken(text)) {
    return { type: 'auto', value: text };
  }
  return { type: 'string', value: text };
};

/**
 * One operand as what it holds: a literal, a `{ type, value }`, or a nested
 * expression whose own operands are read the same way; `undefined` when it is
 * not filled in yet (an operation not chosen, a value not given).
 *
 * A nested expression whose operation is chosen but whose operands are not all
 * filled in is kept, with its missing operands as `undefined`, so a summary can
 * write what is there.
 */
export const expressionOperand = (arg: unknown): unknown => {
  if (arg === undefined || arg === null) return undefined;
  if (!isObject(arg)) return arg;
  if (arg.is_expression) {
    if (!isObject(arg.value) || !arg.value.exp) return undefined;
    return { ...arg, value: expressionWithOperands(arg.value as IExpressionValue) };
  }
  if ('exp' in arg) return arg.exp ? expressionWithOperands(arg as IExpressionValue) : undefined;
  if (!('value' in arg) || arg.value === undefined) return undefined;
  if (arg.type === 'richtext') return richtextOperand(arg.value);
  return arg;
};

/** The expression with each operand read as what it holds (`undefined` where none is given yet). */
export const expressionWithOperands = (value: IExpressionValue): IExpressionValue => ({
  ...value,
  args: (value.args ?? []).map(expressionOperand) as IExpression[],
});

/** Whether every part of the expression is filled in: an operation, and each of its operands. */
export const isExpressionComplete = (value: IExpressionValue | undefined): boolean => {
  if (!value?.exp) return false;
  return (value.args ?? []).every((arg) => {
    const operand = expressionOperand(arg);
    if (operand === undefined) return false;
    if (isObject(operand) && operand.is_expression)
      return isExpressionComplete(operand.value as IExpressionValue);
    if (isObject(operand) && 'exp' in operand)
      return isExpressionComplete(operand as IExpressionValue);
    return true;
  });
};
