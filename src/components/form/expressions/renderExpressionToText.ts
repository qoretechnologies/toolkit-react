// Copyright 2026 Qore Technologies, s.r.o.
// Client-side expression renderer — the offline approximation of an expression
// AST. Used as the fallback when the LSP "Explain" path
// (`DataProvider::renderExpression`) is unreachable, and by read-first
// summaries that must render synchronously. Pure: no transport/socket import,
// so it stays out of the LSP/nanoid dependency graph.
import { IExpression, IExpressionSchema, IExpressionValue } from './types';

/** A symbol made only of non-word characters renders infix (`a == b`). */
const isOperatorSymbol = (symbol?: string): boolean =>
  !!symbol && /^[^\w\s]+$/.test(symbol);

/**
 * Operator precedence, lower binds tighter.
 *
 * Mirrors `DpqlOperatorPrecedence` in the Qore DataProvider module, which is
 * the source of truth — the server renders the same ASTs through
 * `DataProvider::renderExpression`, and an offline fallback that parenthesised
 * differently would make the same expression read two ways depending on
 * whether the instance happened to be reachable.
 */
const PRECEDENCE: Record<string, number> = {
  '*': 1,
  '/': 1,
  '%': 1,
  '+': 2,
  '-': 2,
  '!': 3,
  '==': 4,
  '!=': 4,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '&&': 5,
  '||': 6,
};

/** Anything that is not an operator; nothing binds tighter. */
const PREC_PRIMARY = 0;
/** Looser than every operator, so a value rendered in it is never wrapped. */
const PREC_LOOSEST = 7;

/**
 * Operators whose grouping cannot change the result.
 *
 * `+` is deliberately absent: it concatenates when an operand is a string, so
 * `1 + (2 + "a")` is `"12a"` where `1 + 2 + "a"` is `"3a"`. Dropping its
 * parentheses would not be a cosmetic simplification.
 */
const ASSOCIATIVE = new Set(['&&', '||']);

const precedenceOf = (exp?: string): number => PRECEDENCE[exp ?? ''] ?? PREC_PRIMARY;

/**
 * The context an operator's argument is rendered in — the same rule as
 * `DpqlSerializer::getArgumentContext()`.
 *
 * The first argument is where left-associative parsing puts a same-precedence
 * child back, so it needs no parentheses; a later one does, or `1 - (2 - 3)`
 * reads as `1 - 2 - 3`, which is a different expression.
 */
const argumentContext = (exp: string, argn: number): number => {
  const prec = precedenceOf(exp);
  return !argn || ASSOCIATIVE.has(exp) ? prec : prec - 1;
};

/** An argument reaches this as a bare value or as a `{type, value}` envelope. */
const readArgValue = (arg: unknown): unknown =>
  arg !== null && typeof arg === 'object' && 'value' in (arg as object)
    ? (arg as { value: unknown }).value
    : arg;

const renderLiteral = (value: unknown): string => {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** Renders `value` and wraps it only if it binds looser than `contextPrec`. */
const renderInContext = (
  value: IExpressionValue | undefined,
  expressions: IExpressionSchema[],
  contextPrec: number
): string => {
  if (!value?.exp) return '';
  /* A `value` expression IS its literal.
  
     It is the wrapper the parser puts around a bare literal — typing `null`,
     or `42`, into the text editor produces one — and it carries no symbol, so
     rendering it through the generic paths printed the wrapper instead of the
     value: `value(42)` with a catalogue that names it, `(42)` with one that
     supplies its empty symbol. The server renders the literal alone, and a
     summary that disagrees with the preview beside it is worse than either. */
  if (value.exp === 'value' && (value.args ?? []).length === 1) {
    const only = (value.args ?? [])[0] as IExpression;
    if (!only?.is_expression) {
      return renderLiteral(readArgValue(only));
    }
  }
  const schema = expressions.find((e) => e.name === value.exp);
  const symbol = schema?.symbol ?? value.exp;
  const args = value.args ?? [];
  // Logical group (subtype 2) → join with the symbol.
  const isLogicalGroup = schema?.subtype === 2 || value.exp === '&&' || value.exp === '||';
  // Binary operator → infix. Everything else renders as a call, whose own
  // parentheses and commas already delimit its arguments.
  const isInfix = isLogicalGroup || (args.length === 2 && isOperatorSymbol(symbol));

  const parts = args.map((arg: IExpression, argn: number) =>
    arg?.is_expression && arg.value?.exp
      ? renderInContext(
          arg.value,
          expressions,
          isInfix ? argumentContext(value.exp as string, argn) : PREC_LOOSEST
        )
      : renderLiteral(arg?.value)
  );

  if (!isInfix) {
    return `${symbol}(${parts.join(', ')})`;
  }

  const text = isLogicalGroup ? parts.join(` ${symbol} `) : `${parts[0]} ${symbol} ${parts[1]}`;
  return precedenceOf(value.exp) > contextPrec ? `(${text})` : text;
};

/**
 * Recursively render an expression AST to readable text — the client-side
 * approximation, used as the fallback when the LSP is unreachable.
 */
export const renderExpressionToText = (
  value: IExpressionValue | undefined,
  expressions: IExpressionSchema[] = []
): string => renderInContext(value, expressions, PREC_LOOSEST);
