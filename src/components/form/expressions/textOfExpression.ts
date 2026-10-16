// Copyright 2026 Qore Technologies, s.r.o.
// What the Text view is given for an expression built in the Visual view.
//
// `dpql/serialize` was handed the AST as the Visual view stores it, and wrote what
// it could of operands that are not DPQL (see expressionOperands): the server
// `{args=(null)} > {type=int}`, a stand-in `undefined([object Object]) > [object Object]`.
// The Text view serializes only an expression that is filled in, with its operands
// read as what they hold, and shows one that is not with a hole for each missing part.
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
  value?.exp
    ? renderExpressionToText(value, expressions)
        // a field of the record, as DPQL names it
        .replace(/"\$record:\{([^}]+)\}"/g, '@$1')
    : EXPRESSION_HOLE;

export { expressionOperand };
