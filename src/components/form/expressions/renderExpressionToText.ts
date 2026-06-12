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

const renderLiteral = (value: unknown): string => {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * Recursively render an expression AST to readable text — the client-side
 * approximation, used as the fallback when the LSP is unreachable.
 */
export const renderExpressionToText = (
  value: IExpressionValue | undefined,
  expressions: IExpressionSchema[] = []
): string => {
  if (!value?.exp) return '';
  const schema = expressions.find((e) => e.name === value.exp);
  const symbol = schema?.symbol ?? value.exp;
  const args = (value.args ?? []).map((arg: IExpression) =>
    arg?.is_expression && arg.value?.exp
      ? `(${renderExpressionToText(arg.value, expressions)})`
      : renderLiteral(arg?.value)
  );

  // Logical group (subtype 2) → join with the symbol.
  if (schema?.subtype === 2 || value.exp === '&&' || value.exp === '||') {
    return args.join(` ${symbol} `);
  }
  // Binary operator → infix.
  if (args.length === 2 && isOperatorSymbol(symbol)) {
    return `${args[0]} ${symbol} ${args[1]}`;
  }
  // Otherwise function form.
  return `${symbol}(${args.join(', ')})`;
};
