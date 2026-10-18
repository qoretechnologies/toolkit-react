// Copyright 2026 Qore Technologies, s.r.o.
// What the Text view is given for an expression built in the Visual view.
//
// `dpql/serialize` was handed the AST as the Visual view stores it, and wrote what
// it could of operands that are not DPQL (see expressionOperands): the server
// `{args=(null)} > {type=int}`, a stand-in `undefined([object Object]) > [object Object]`.
// The Text view serializes only an expression that is filled in, with its operands
// read as what they hold, and shows one that is not with a hole for each missing part.
import { recordFieldOfTemplate, templateTokenSpans } from '../../../helpers/templates';
import { expressionOperand, expressionWithOperands, isExpressionComplete } from './expressionOperands';
import { EXPRESSION_HOLE, renderExpressionToText } from './renderExpressionToText';
import { IExpressionSchema, IExpressionValue } from './types';

export { EXPRESSION_HOLE };

/**
 * The expression as `dpql/serialize` can write it, or `undefined` when part of it
 * is not filled in yet (an operation not chosen, an operand left empty).
 */
export const serializableExpression = (
  value: IExpressionValue | undefined
): IExpressionValue | undefined => (isExpressionComplete(value) ? expressionWithOperands(value!) : undefined);

/**
 * An expression that is not filled in yet, as text: what is there, and a
 * {@link EXPRESSION_HOLE} for each part that is not - `… > …` for a comparison
 * whose values are not chosen, as the read-first row writes it. Not DPQL; the
 * Text view shows it until the author writes the rest.
 */
export const incompleteExpressionText = (
  value: IExpressionValue | undefined,
  expressions: IExpressionSchema[] = []
): string =>
  value?.exp ? recordFieldsAsDpql(renderExpressionToText(value, expressions)) : EXPRESSION_HOLE;

/** Each quoted record field in `text` as DPQL names it: `"$record:{orders[*].id}"` is `@orders[*].id`. Read as
 *  templates are, so a path with braces in it (`prices{*}`) is one field, not cut at its first `}`. */
const recordFieldsAsDpql = (text: string): string => {
  let out = '';
  let last = 0;
  templateTokenSpans(text).forEach(([start, end]) => {
    const field = recordFieldOfTemplate(text.slice(start, end));
    if (field && text[start - 1] === '"' && text[end] === '"') {
      out += `${text.slice(last, start - 1)}@${field}`;
      last = end + 1;
    }
  });
  return out + text.slice(last);
};

export { expressionOperand };
