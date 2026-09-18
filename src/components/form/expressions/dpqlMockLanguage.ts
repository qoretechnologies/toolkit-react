// Copyright 2026 Qore Technologies, s.r.o.
// The DPQL the story language server speaks: tokens, parse, type analysis,
// serialize and render, as pure functions.
//
// A mock that answers every request with a fixed shape makes stories assert
// its artefacts instead of the product. The one this replaced parsed ANY text
// into `text == ""`, so `1 + 2 ==` — which the real server rejects — previewed
// as `"1 + 2 ==" == ""` and a bool field reported "returns string". Each
// answer here follows what the Qorus `/lsp` handler actually returned for the
// same input, recorded in `__tests__/dpqlMockLanguage.test.ts`; only the subset
// the stories exercise is modelled.
import { mockExpressions } from './mockExpressions';
import { IExpressionSchema } from './types';

/** One argument or node of a DPQL expression AST, as the server shapes it. */
export interface IDpqlMockNode {
  exp?: string;
  args?: IDpqlMockNode[];
  type?: string;
  value?: unknown;
  is_expression?: boolean;
}

export interface IDpqlMockDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  code: string;
  line: number;
  column: number;
  end_line: number;
  end_column: number;
}

export interface IDpqlMockParseResult {
  success: boolean;
  expression?: { is_expression: true; value: IDpqlMockNode };
  inferred_type?: string;
  target_type?: string;
  type_compatible?: boolean;
  auto_coercible?: boolean;
  coercion_may_fail?: boolean;
  suggested_fix?: { text: string; description: string };
  diagnostics: IDpqlMockDiagnostic[];
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

/* The server parses, serializes and renders by the expression catalogue — an
   expression's symbol, type, group and `render_template` — so this reads the
   stories' catalogue for the same answers. */
const CATALOGUE = new Map<string, IExpressionSchema>(
  mockExpressions.map((info) => [info.name, info])
);

/** `DET_Function`: a rendering calls it by name. */
const DET_FUNCTION = 2;
/** `DET_Operator`. */
const DET_OPERATOR = 1;

const WORD = /^[A-Za-z_]\w*$/;

/** An expression's DPQL spelling: its symbol without a display `()`, else its name. */
const symbolOf = (name: string): string =>
  CATALOGUE.get(name)?.symbol?.replace(/\(\)$/, '') || name;

/**
 * A two-argument catalogue comparison is written infix by its symbol:
 * `"test" startsWith "t"`. With any other number of arguments it is a call.
 * `regex` is the exception the server spells `=~ /…/`, which is not modelled.
 */
const isInfixComparison = (name: string, argCount: number): boolean => {
  const info = CATALOGUE.get(name);
  return (
    argCount === 2 &&
    info?.type === DET_OPERATOR &&
    !!info.groups?.includes('Comparison') &&
    name !== 'regex'
  );
};

/** Expression names by the word DPQL spells them with: `startsWith` → `starts-with`. */
const NAME_BY_SYMBOL = new Map<string, string>(
  mockExpressions
    .filter((info) => WORD.test(symbolOf(info.name)))
    .map((info) => [symbolOf(info.name), info.name])
);

// ─── Semantic tokens ─────────────────────────────────────────────────────────

const DPQL_KEYWORDS = new Set(['in', 'not', 'between', 'and', 'like', 'true', 'false', 'null']);
const DPQL_FUNCTIONS = new Set([
  'abs', 'round', 'floor', 'ceil', 'trim', 'ltrim', 'rtrim', 'concat', 'split', 'substr',
  'coalesce', 'nullif', 'now', 'days', 'hours', 'minutes', 'seconds', 'milliseconds',
  'microseconds', 'years', 'months', 'weeks', 'get_year', 'get_month', 'get_day', 'get_hour',
  'get_minute', 'get_second', 'format_date', 'format_number', 'map', 'hash_map', 'contains',
  'ignore', 'case', 'toString', 'toInt', 'toFloat', 'toBool', 'startsWith', 'endsWith',
]);

/**
 * `textDocument/semanticTokens/full` for `text`: the LSP delta-encoded 5-tuple
 * array, with type indices into `SEMANTIC_TOKENS_LEGEND`. It covers readable
 * renderings as well as DPQL, as the server's does — `contains` and
 * `(ignore case)` in an explanation are coloured too.
 */
export function mockTokenizeDpql(text: string): number[] {
  // Longer operators must come first so `==` isn't matched as two `=`.
  const TOKEN_RE = new RegExp(
    [
      `("(?:\\\\.|[^"\\\\])*")`, // 1: double-quoted string
      `('(?:\\\\.|[^'\\\\])*')`, // 2: single-quoted string
      `(/(?:\\\\.|[^/\\\\])*/[gimsux]*)`, // 3: regex literal /…/flags
      `(@"(?:\\\\.|[^"\\\\])*"|@[A-Za-z_][\\w.]*)`, // 4: @field
      `(\\$[A-Za-z_-][\\w-]*:(?:\\{[^}]*\\}|[\\w.{}]+))`, // 5: $context:value
      `(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)`, // 6: number
      `(==|!=|<=|>=|&&|\\|\\||=~|!~|[+\\-*/%<>!=])`, // 7: operator
      // 8: punctuation — matched so it is not misread, but the server leaves it uncoloured
      `(\\.\\.|[,(){}\\[\\].])`,
      `(\\b[A-Za-z_][\\w]*\\b)`, // 9: identifier (keyword check)
    ].join('|'),
    'g'
  );

  const tokens: Array<{ line: number; char: number; length: number; type: number }> = [];
  text.split('\n').forEach((line, lineIdx) => {
    TOKEN_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TOKEN_RE.exec(line)) !== null) {
      let type = -1;
      if (match[1] || match[2]) type = 11; // string
      else if (match[3]) type = 13; // regexp
      else if (match[4]) type = 4; // variable
      else if (match[5]) type = 2; // class (template)
      else if (match[6]) type = 12; // number
      else if (match[7]) type = 14; // operator
      else if (match[9]) {
        const word = match[9];
        if (DPQL_KEYWORDS.has(word.toLowerCase())) type = 8; // keyword
        else if (DPQL_FUNCTIONS.has(word) || DPQL_FUNCTIONS.has(word.toLowerCase())) type = 6; // function
      }
      if (type >= 0) {
        tokens.push({ line: lineIdx, char: match.index, length: match[0].length, type });
      }
    }
  });

  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const t of tokens) {
    const deltaLine = t.line - prevLine;
    data.push(deltaLine, deltaLine === 0 ? t.char - prevChar : t.char, t.length, t.type, 0);
    prevLine = t.line;
    prevChar = t.char;
  }
  return data;
}

// ─── Parse ───────────────────────────────────────────────────────────────────

type TToken =
  | { kind: 'number'; text: string; start: number }
  | { kind: 'string'; text: string; start: number }
  | { kind: 'template'; text: string; start: number }
  | { kind: 'word'; text: string; start: number }
  | { kind: 'op'; text: string; start: number };

const LEX_RE =
  /\s*(?:("(?:\\.|[^"\\])*")|(\$[A-Za-z_-][\w-]*:[\w.{}]+)|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|(==|!=|<=|>=|&&|\|\||[-+*/<>!(),]))/y;

/** Binary operators, loosest first — the precedence the server parenthesises by. */
const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '>': 3,
  '<=': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
};

const RETURN_TYPES: Record<string, string> = {
  toString: 'string',
  toInt: 'int',
  toFloat: 'float',
  toBool: 'bool',
};

class DpqlMockSyntaxError extends Error {
  constructor(
    message: string,
    readonly column: number
  ) {
    super(message);
  }
}

const tokenize = (text: string): TToken[] => {
  const tokens: TToken[] = [];
  LEX_RE.lastIndex = 0;
  while (LEX_RE.lastIndex < text.length) {
    const start = LEX_RE.lastIndex;
    const m = LEX_RE.exec(text);
    if (!m) {
      if (text.slice(start).trim() === '') break;
      throw new DpqlMockSyntaxError('Unexpected character', start + 1);
    }
    const tokenStart = start + m[0].length - m[0].trimStart().length;
    if (m[1]) tokens.push({ kind: 'string', text: m[1], start: tokenStart });
    else if (m[2]) tokens.push({ kind: 'template', text: m[2], start: tokenStart });
    else if (m[3]) tokens.push({ kind: 'number', text: m[3], start: tokenStart });
    else if (m[4]) tokens.push({ kind: 'word', text: m[4], start: tokenStart });
    else if (m[5]) tokens.push({ kind: 'op', text: m[5], start: tokenStart });
  }
  return tokens;
};

const templateArg = (raw: string): IDpqlMockNode => {
  const [, context, value] = raw.match(/^\$([^:]+):(.*)$/) ?? [];
  return { type: 'auto', value: { tmpl_context: context, tmpl_value: value, raw } };
};

/** An operand: a bare argument, or a nested expression wrapped as the server wraps it. */
const asOperand = (node: IDpqlMockNode): IDpqlMockNode =>
  node.exp ? { is_expression: true, value: node } : node;

const parseTokens = (tokens: TToken[], endColumn: number): IDpqlMockNode => {
  let pos = 0;
  const peek = () => tokens[pos];
  const fail = (): never => {
    const token = peek();
    throw new DpqlMockSyntaxError(
      token ? `Unexpected token '${token.text}'` : 'Unexpected end of input, expected value',
      token ? token.start + 1 : endColumn
    );
  };

  const primary = (): IDpqlMockNode => {
    const token = peek();
    if (!token) return fail();
    pos++;
    switch (token.kind) {
      case 'number':
        return token.text.includes('.')
          ? { type: 'float', value: parseFloat(token.text) }
          : { type: 'int', value: parseInt(token.text, 10) };
      case 'string':
        return { type: 'string', value: JSON.parse(token.text) };
      case 'template':
        return templateArg(token.text);
      case 'word': {
        if (token.text === 'true' || token.text === 'false') {
          return { type: 'bool', value: token.text === 'true' };
        }
        if (token.text === 'null') {
          return { type: 'any', value: null };
        }
        if (peek()?.text === '(') {
          pos++;
          const args: IDpqlMockNode[] = [];
          while (peek() && peek()!.text !== ')') {
            args.push(asOperand(binary(1)));
            if (peek()?.text === ',') {
              pos++;
            }
          }
          if (peek()?.text !== ')') return fail();
          pos++;
          return { exp: NAME_BY_SYMBOL.get(token.text) ?? token.text, args };
        }
        return { type: 'string', value: token.text };
      }
      case 'op':
        if (token.text === '(') {
          const inner = binary(1);
          if (peek()?.text !== ')') return fail();
          pos++;
          return inner;
        }
        if (token.text === '!') {
          return { exp: '!', args: [asOperand(primary())] };
        }
        pos--;
        return fail();
    }
    return fail();
  };

  const binary = (minPrecedence: number): IDpqlMockNode => {
    let left = primary();
    for (;;) {
      const op = peek();
      // A word comparison (`"a" contains "b"`) binds as the symbol comparisons do.
      const wordComparison =
        op?.kind === 'word' && NAME_BY_SYMBOL.has(op.text) &&
        isInfixComparison(NAME_BY_SYMBOL.get(op.text)!, 2)
          ? NAME_BY_SYMBOL.get(op.text)
          : undefined;
      const precedence =
        op?.kind === 'op' ? BINARY_PRECEDENCE[op.text]
        : wordComparison ? BINARY_PRECEDENCE['==']
        : undefined;
      if (precedence === undefined || precedence < minPrecedence) {
        return left;
      }
      pos++;
      const right = binary(precedence + 1);
      left = { exp: wordComparison ?? op!.text, args: [asOperand(left), asOperand(right)] };
    }
  };

  const root = binary(1);
  if (pos < tokens.length) fail();
  return root;
};

const nodeOf = (operand: IDpqlMockNode): IDpqlMockNode =>
  operand.is_expression ? (operand.value as IDpqlMockNode) : operand;

/** The type an expression returns, as far as the server can tell before it runs. */
export const inferDpqlMockType = (node: IDpqlMockNode): string => {
  if (!node.exp) {
    return node.type === 'auto' ? 'auto' : (node.type ?? 'auto');
  }
  if (node.exp === 'value') return 'auto';
  if (RETURN_TYPES[node.exp]) return RETURN_TYPES[node.exp];
  if (['==', '!=', '<', '>', '<=', '>=', '&&', '||', '!'].includes(node.exp)) return 'bool';
  if (['+', '-', '*', '/'].includes(node.exp)) {
    const operandTypes = (node.args ?? []).map((arg) => inferDpqlMockType(nodeOf(arg)));
    if (operandTypes.includes('auto')) return 'auto';
    if (node.exp === '+' && operandTypes.includes('string')) return 'string';
    return operandTypes.includes('float') ? 'float' : 'int';
  }
  return 'auto';
};

const capitalise = (word: string) => word[0].toUpperCase() + word.slice(1);

/** What a successful parse says about fitting `target`, shaped as the server's answer. */
const analyse = (
  text: string,
  inferred: string,
  target: string
): Omit<IDpqlMockParseResult, 'success' | 'expression' | 'diagnostics'> & {
  diagnostics: IDpqlMockDiagnostic[];
} => {
  const base = { inferred_type: inferred, target_type: target };
  if (inferred === 'auto' || target === 'auto' || target === 'any' || inferred === target) {
    return { ...base, type_compatible: true, auto_coercible: true, coercion_may_fail: false, diagnostics: [] };
  }
  // Text can become anything but may not parse on the day; a number or a bool
  // always becomes text; nothing else converts implicitly.
  const coercible = inferred === 'string' || target === 'string';
  const mayFail = inferred === 'string';
  const span = { line: 1, column: 1, end_line: 1, end_column: text.length + 1 };
  return {
    ...base,
    type_compatible: false,
    auto_coercible: coercible,
    coercion_may_fail: mayFail,
    ...(coercible
      ? {
          suggested_fix: {
            text: `to${capitalise(target)}(${text})`,
            description: `Convert ${inferred} to ${target} using to${capitalise(target)}()`,
          },
        }
      : {}),
    diagnostics: [
      {
        severity: coercible ? 'warning' : 'error',
        message: coercible
          ? `Expression returns '${inferred}' but target expects '${target}' (auto-coercion available)`
          : `Expression returns '${inferred}' but target expects '${target}'`,
        code: 'TYPE_MISMATCH',
        ...span,
      },
    ],
  };
};

/** `dpql/parse`: the AST for `text`, or the diagnostic the server reports. */
export const mockParseDpql = (text: string, target?: string): IDpqlMockParseResult => {
  const trimmed = text.trim();
  try {
    const tokens = tokenize(trimmed);
    const node = parseTokens(tokens, trimmed.length + 1);
    // A lone value is wrapped in `value(...)`, which is how the server tells a
    // literal apart from an expression.
    const root: IDpqlMockNode = node.exp ? node : { exp: 'value', args: [node] };
    const inferred = inferDpqlMockType(root);
    return {
      success: true,
      expression: { is_expression: true, value: root },
      ...(target ? analyse(trimmed, inferred, target) : { inferred_type: inferred, diagnostics: [] }),
    } as IDpqlMockParseResult;
  } catch (err) {
    const column = err instanceof DpqlMockSyntaxError ? err.column : 1;
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          message: err instanceof Error ? err.message : String(err),
          code: 'DPQL-E001',
          line: 1,
          column,
          end_line: 1,
          end_column: column,
        },
      ],
    };
  }
};

// ─── Serialize and render ────────────────────────────────────────────────────

const TEMPLATE_TOKEN = /^\$[A-Za-z_-][\w-]*:[\w.{}]+$/;

/** An argument's own value, for a rendering that asks whether it is set. */
const argumentValue = (arg: IDpqlMockNode | undefined): unknown =>
  arg && !arg.exp && !arg.is_expression ? arg.value : arg;

const printLiteral = (value: unknown, readable: boolean): string => {
  if (value && typeof value === 'object' && 'raw' in value) {
    return String((value as { raw?: string }).raw);
  }
  if (typeof value === 'string') {
    // Serialized DPQL keeps a string a string; a readable rendering shows a
    // reference the string holds as the reference, which the server's does too.
    return readable && TEMPLATE_TOKEN.test(value) ? value : JSON.stringify(value);
  }
  return value === null || value === undefined ? 'null' : String(value);
};

/**
 * `parentPrecedence` is the context: a nested operator binding looser than it
 * is parenthesised. `0` never parenthesises (a call's own commas delimit its
 * arguments); `Infinity` always does, which is how the server substitutes an
 * argument into a `render_template`.
 */
const printArg = (arg: IDpqlMockNode, parentPrecedence: number, readable: boolean): string => {
  if (arg.is_expression) {
    const inner = arg.value as IDpqlMockNode;
    const printed = printNode(inner, readable);
    const precedence = BINARY_PRECEDENCE[inner.exp ?? ''];
    return precedence !== undefined && precedence < parentPrecedence ? `(${printed})` : printed;
  }
  if (arg.exp) return printNode(arg, readable);
  return printLiteral(arg.value, readable);
};

/** `render_template` substitution, in the server's order. */
const renderTemplate = (info: IExpressionSchema, args: IDpqlMockNode[]): string => {
  const argument = (n: number): string => {
    if (n < args.length) return printArg(args[n], Infinity, true);
    // A missing argument reads as its default, or as nothing.
    const fallback = info.args?.[n]?.default_value;
    return fallback === undefined ? '' : printLiteral(fallback, true);
  };
  return info
    .render_template!.split('$symbol')
    .join(info.symbol)
    .split('$args')
    .join(args.map((_, n) => argument(n)).join(', '))
    .replace(/\$arg\[(\d+)\]/g, (_, n) => argument(Number(n)))
    .replace(
      /\$\{arg\[(\d+)\](?:\s*\?([^:}]*):([^}]*))?\}/g,
      (_, n, whenSet = '', whenUnset = '') => {
        /* The argument decides when it was given, its default only when it was
           not — as the expression evaluates. An explicit `false` on a
           default-true argument reads as unset (Qore `5f3d9b491`). */
        const given = args[Number(n)];
        const isSet =
          given !== undefined ? argumentValue(given) : info.args?.[Number(n)]?.default_value;
        return isSet ? whenSet : whenUnset;
      }
    );
};

/** A node as `dpql/serialize` writes it: DPQL that parses back to the same node. */
const serializeNode = (args: IDpqlMockNode[], name: string): string => {
  if (isInfixComparison(name, args.length) && WORD.test(symbolOf(name))) {
    // Not in the server's precedence table, so its operands are rendered in the
    // tightest context: any operator inside one is parenthesised.
    return `${printArg(args[0], Infinity, false)} ${symbolOf(name)} ${printArg(args[1], Infinity, false)}`;
  }
  return `${symbolOf(name)}(${args.map((arg) => printArg(arg, 0, false)).join(', ')})`;
};

/** A node as `dpql/renderExpression` reads it: a function by name, else its template. */
const renderNode = (args: IDpqlMockNode[], name: string): string | undefined => {
  const info = CATALOGUE.get(name);
  if (info?.type === DET_FUNCTION) {
    return `${name}(${args.map((arg) => printArg(arg, 0, true)).join(', ')})`;
  }
  return info?.render_template ? renderTemplate(info, args) : undefined;
};

const printNode = (node: IDpqlMockNode, readable: boolean): string => {
  const args = node.args ?? [];
  const name = node.exp ?? '';
  if (name === 'value' && args.length === 1) return printArg(args[0], 0, readable);
  const rendered = readable ? renderNode(args, name) : undefined;
  if (rendered !== undefined) return rendered;
  const precedence = BINARY_PRECEDENCE[name];
  if (precedence !== undefined && args.length === 2) {
    return `${printArg(args[0], precedence, readable)} ${name} ${printArg(args[1], precedence + 1, readable)}`;
  }
  // The builder stores an AND/OR group as ONE node with every member as an
  // argument; it reads as the members joined by the operator.
  if ((name === '&&' || name === '||') && args.length !== 2) {
    return args.map((arg) => printArg(arg, precedence + 1, readable)).join(` ${name} `);
  }
  if (name === '!') return `!${printArg(args[0], 6, readable)}`;
  if (!readable) return serializeNode(args, name);
  // Any other catalogue operator reads as its arguments joined by its symbol.
  const info = CATALOGUE.get(name);
  if (info) {
    return args.length === 1 ?
        `${info.symbol} ${printArg(args[0], 0, true)}`
      : args.map((arg) => printArg(arg, precedence ?? 0, true)).join(` ${info.symbol} `);
  }
  return `${name}(${args.map((arg) => printArg(arg, 0, true)).join(', ')})`;
};

const rootOf = (expression: IDpqlMockNode | undefined): IDpqlMockNode =>
  expression?.value && !expression.exp ? (expression.value as IDpqlMockNode) : (expression ?? {});

/** The richtext the server sends beside a rendering: each `$context:value` becomes a chip. */
export const dpqlMockRichtext = (text: string) => {
  const children: unknown[] = [];
  const reference = /\$([A-Za-z_-][\w-]*):([\w.{}]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = reference.exec(text)) !== null) {
    if (match.index > last) children.push({ text: text.slice(last, match.index) });
    children.push({
      type: 'tag',
      value: match[0],
      label: match[2],
      children: [{ text: '' }],
      metadata: { displayName: `${capitalise(match[1])} Context` },
    });
    last = match.index + match[0].length;
  }
  if (last < text.length || !children.length) children.push({ text: text.slice(last) });
  return { type: 'richtext', value: [{ type: 'paragraph', children }] };
};

/** `dpql/serialize`: DPQL text that parses back to the same expression. */
export const mockSerializeDpql = (expression: IDpqlMockNode | undefined) => {
  const dpql = printNode(rootOf(expression), false);
  return { dpql, richtext: dpqlMockRichtext(dpql) };
};

/** `dpql/renderExpression`: the readable rendering shown in previews and explanations. */
export const mockRenderDpql = (expression: IDpqlMockNode | undefined) => {
  const rendered = printNode(rootOf(expression), true);
  return { rendered, richtext: dpqlMockRichtext(rendered) };
};
