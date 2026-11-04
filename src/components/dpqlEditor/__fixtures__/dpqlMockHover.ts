// Copyright 2026 Qore Technologies, s.r.o.
// What the Qorus `/lsp` handler answers to `textDocument/hover` on a DPQL document, for the stories' stand-in
// servers (qorus#646, David: "there are no mouseover / hovers on the functions or on the chips").
//
// A function's and an operator's hover is the server's own markdown, captured from professor's live `/lsp`
// (`dpqlServerHovers.json` says how). A field, a template, an accessor and a literal are answered in the shape the
// server answers them, as captured there: `**field** \`@create.items\`` and its type when the record says it,
// `**template** \`$local:input\``, `**operator** \`[*]\`` on the `*` of a wildcard, `**field** \`id\`` on a name
// after a dot, `**numeric literal** \`0\``, `**string literal** \`"x"\``. Brackets, braces, dots, parentheses and
// commas have none.
import SERVER_HOVERS from './dpqlServerHovers.json';

/** The record's fields, as `dpql/setContext` gives them: each field's type, by name. */
export type TDpqlHoverFields = Record<
  string,
  { type?: string | string[] | { name?: string } } | undefined
>;

export interface IDpqlMockHover {
  contents: { kind: 'markdown'; value: string };
}

const FUNCTIONS: Record<string, string> = SERVER_HOVERS.functions;
const OPERATORS: Record<string, string> = SERVER_HOVERS.operators;
/** The operators, longest first, so `>=` is read before `>`. */
const OPERATOR_SYMBOLS = [
  '==',
  '!=',
  '>=',
  '<=',
  '&&',
  '||',
  '=~',
  '!~',
  '>',
  '<',
  '+',
  '-',
  '*',
  '/',
  '!',
];

const NAME_START = /[\p{L}_]/u;
const NAME_PART = /[\p{L}\p{M}\p{N}_]/u;

const markdown = (value: string): IDpqlMockHover => ({ contents: { kind: 'markdown', value } });

/** A field's type as the server writes it: a list or a hash of anything, else the type. */
const typeOf = (fields: TDpqlHoverFields | undefined, name: string): string | undefined => {
  const declared = fields?.[name]?.type;
  const type =
    typeof declared === 'string' ? declared
    : Array.isArray(declared) ? declared.join('|')
    : declared?.name;
  if (!type) {
    return undefined;
  }
  return type === 'list' || type === 'hash' ? `${type}<auto>` : type;
};

/** One thing in the text that has a hover: where it is, and what is said of it. */
interface IHoverSpan {
  start: number;
  end: number;
  value?: string;
}

/** Where a string literal that opens at `at` ends (after its closing quote), or the end of the line. */
const endOfString = (line: string, at: number): number => {
  const quote = line[at];
  for (let i = at + 1; i < line.length; i += 1) {
    if (line[i] === '\\') {
      i += 1;
    } else if (line[i] === quote) {
      return i + 1;
    }
  }
  return line.length;
};

/** Where a name that starts at `at` ends. */
const endOfName = (line: string, at: number, dashes = false): number => {
  let i = at;
  while (i < line.length) {
    if (NAME_PART.test(line[i])) {
      i += 1;
    } else if (dashes && line[i] === '-' && /[a-zA-Z]/.test(line[i + 1] ?? '')) {
      i += 2;
    } else {
      break;
    }
  }
  return i;
};

/** The accessors after a field that ends at `at`, as spans: the `*` of a wildcard, a name, a key, an index. */
const accessorSpans = (line: string, at: number, spans: IHoverSpan[]): number => {
  let i = at;
  for (;;) {
    if (line[i] === '.' && NAME_START.test(line[i + 1] ?? '')) {
      const end = endOfName(line, i + 1, true);
      spans.push({ start: i + 1, end, value: `**field** \`${line.slice(i + 1, end)}\`` });
      i = end;
    } else if (line[i] === '[' && line[i + 1] === '*' && line[i + 2] === ']') {
      spans.push({ start: i + 1, end: i + 2, value: OPERATORS['[*]'] });
      i += 3;
    } else if (line[i] === '{' && line[i + 1] === '*' && line[i + 2] === '}') {
      spans.push({ start: i + 1, end: i + 2, value: OPERATORS['{*}'] });
      i += 3;
    } else if (line[i] === '[' && /^-?\d+\]/.test(line.slice(i + 1))) {
      const close = line.indexOf(']', i);
      spans.push({
        start: i + 1,
        end: close,
        value: `**numeric literal** \`${line.slice(i + 1, close)}\``,
      });
      i = close + 1;
    } else if (line[i] === '{') {
      // keys in braces: `{"content-type"}`, `{b}`, `{a, "b c"}`
      let j = i + 1;
      for (;;) {
        while (line[j] === ' ' || line[j] === ',') {
          j += 1;
        }
        if (line[j] === '"' || line[j] === "'") {
          const end = endOfString(line, j);
          spans.push({ start: j, end, value: `**field** \`${line.slice(j, end)}\`` });
          j = end;
        } else if (NAME_START.test(line[j] ?? '')) {
          const end = endOfName(line, j);
          spans.push({ start: j, end, value: `**field** \`${line.slice(j, end)}\`` });
          j = end;
        } else {
          break;
        }
      }
      if (line[j] !== '}') {
        return i;
      }
      i = j + 1;
    } else {
      return i;
    }
  }
};

/** Every span in `line` that the server answers a hover for. */
const hoverSpans = (line: string, fields?: TDpqlHoverFields): IHoverSpan[] => {
  const spans: IHoverSpan[] = [];
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '"' || char === "'") {
      const end = endOfString(line, i);
      spans.push({ start: i, end, value: `**string literal** \`${line.slice(i, end)}\`` });
      i = end;
    } else if (char === '@') {
      let end: number;
      if (line[i + 1] === '"') {
        end = endOfString(line, i + 1);
      } else {
        end = i + 1;
        while (
          end < line.length &&
          (NAME_PART.test(line[end]) || (line[end] === '.' && NAME_START.test(line[end + 1] ?? '')))
        ) {
          end += 1;
        }
      }
      const reference = line.slice(i, end);
      const type = typeOf(fields, reference.slice(1));
      spans.push({
        start: i,
        end,
        value: `**field** \`${reference}\`${type ? `\n\nType: \`${type}\`` : ''}`,
      });
      i = accessorSpans(line, end, spans);
    } else if (char === '$' && /^\$\w+:/.test(line.slice(i))) {
      const colon = line.indexOf(':', i);
      let end = colon + 1;
      if (line[end] === '{') {
        let depth = 0;
        for (; end < line.length; end += 1) {
          if (line[end] === '\\') {
            end += 1;
          } else if (line[end] === '{') {
            depth += 1;
          } else if (line[end] === '}' && --depth === 0) {
            end += 1;
            break;
          }
        }
      } else {
        while (end < line.length && /[\w.]/.test(line[end])) {
          end += 1;
        }
      }
      const raw = line.slice(colon + 1, end);
      const value = raw.startsWith('{') && raw.endsWith('}') ? raw.slice(1, -1) : raw;
      spans.push({
        start: i,
        end,
        value: `**template** \`${line.slice(i, end)}\`\n\nContext: \`${line.slice(i + 1, colon)}\`\nValue: \`${value}\``,
      });
      i = end;
    } else if (/\d/.test(char)) {
      let end = i;
      while (end < line.length && /[\d.]/.test(line[end])) {
        end += 1;
      }
      spans.push({ start: i, end, value: `**numeric literal** \`${line.slice(i, end)}\`` });
      i = end;
    } else if (NAME_START.test(char)) {
      const end = endOfName(line, i);
      const name = line.slice(i, end);
      // a function is a name its call follows
      const isCall = /^\s*\(/.test(line.slice(end));
      spans.push({ start: i, end, value: isCall ? FUNCTIONS[name] : undefined });
      i = end;
    } else {
      const operator = OPERATOR_SYMBOLS.find((symbol) => line.startsWith(symbol, i));
      if (operator) {
        spans.push({ start: i, end: i + operator.length, value: OPERATORS[operator] });
        i += operator.length;
      } else {
        i += 1;
      }
    }
  }
  return spans;
};

/**
 * The hover the server answers at `position` in `text` - in the shape the live `/lsp` answers it - or null where
 * it answers none. `fields` is what `dpql/setContext` gave the document: a field it declares has its type.
 */
export const mockHoverDpql = (
  text: string,
  position: { line: number; character: number },
  fields?: TDpqlHoverFields
): IDpqlMockHover | null => {
  const line = text.split('\n')[position.line] ?? '';
  const span = hoverSpans(line, fields).find(
    ({ start, end }) => position.character >= start && position.character < end
  );
  return span?.value ? markdown(span.value) : null;
};
