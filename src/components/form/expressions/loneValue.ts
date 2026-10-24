// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The server parses a reference written alone (`$record:{pos}`) as `template($record:{pos})` - the operation
 * Qore's DPQL parser wraps a lone template in (DP_EXPR_TEMPLATE) - and evaluates it as it evaluates `value(...)`,
 * the wrapper of any other lone value; it writes both back as the reference (`@pos`). An author never wrote an
 * operation: shown as one, it read "template(record: order_id)", and the Visual view looked it up as an
 * operation and said "Qorus has no operation template." (qorus#646, David's review). So a lone `template` is
 * shown, rendered and checked as the lone value it is.
 */
export const LONE_VALUE_OPERATIONS = ['value', 'template'];

/** Whether `operation` wraps a lone value (`value(x)`, `template(x)`). */
export const isLoneValueOperation = (operation: unknown): boolean =>
  typeof operation === 'string' && LONE_VALUE_OPERATIONS.includes(operation);

/** An expression's AST with a lone `template(x)` as the `value(x)` it is shown and checked as. */
export const asLoneValue = <T extends { exp?: unknown; args?: unknown[] } | undefined>(
  ast: T
): T => (ast?.exp === 'template' && ast.args?.length === 1 ? ({ ...ast, exp: 'value' } as T) : ast);
