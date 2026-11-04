// Copyright 2026 Qore Technologies, s.r.o.
// A record field reference in DPQL text - `@pos`, `@"create.order-id"`, `@orders[*].id` - read as the `$record:{…}`
// template it stands for (qorus#646). Qorus reads `$record:{<path>}` as a test path (`QorusRecordPath`), and its DPQL
// serializer writes the same path after `@` (qore#5480: dots separate the parts of a name, quoted or bare, and a dot
// that is part of a key is `\.`). A field written in DPQL and the template a value holds are one record field, so they
// are drawn as one chip; and the stories' stand-in for the server reads the reference back to the template with this.
// Pure: no React, no transport.

/**
 * The text in the braces of a template that decodes to `path`, as the Qorus IDE writes it (`recordTemplateOf`):
 * every backslash and every brace is escaped, except the hash wildcard `{*}`. `Unit.Price` under `create` (the path
 * `create.Unit\.Price`) is `$record:{create.Unit\\.Price}`.
 */
const recordTemplateText = (path: string): string =>
  path.replace(/\{\*\}|[\\{}]/g, (found) => (found === '{*}' ? found : `\\${found}`));

/** A key of a test path: a dot, a bracket, a brace or a backslash in it is escaped. */
const testPathKey = (key: string): string => key.replace(/[.[{\\]/g, (ch) => `\\${ch}`);

/** The accessors a field reference may be followed by, as `dpql/parse` reads them. */
const ACCESSOR =
  /^(?:\[\*\]|\[\d+\]|\{\*\}|\.[\p{L}_](?:[\p{L}\p{M}\p{N}_]|-[a-zA-Z])*|\{"(?:\\.|[^"\\])*"\}|\{[A-Za-z_]\w*\})/u;

/** A field reference, bare or quoted, at the start of a text. */
const FIELD_REFERENCE =
  /^@(?:"((?:\\.|[^"\\])*)"|([\p{L}_][\p{L}\p{M}\p{N}_]*(?:\.[\p{L}\p{M}\p{N}_]+)*))/u;

/**
 * The record field reference at the start of `text` - `@pos`, `@"create.order-id"`, `@orders[*].id` - read as the
 * template the server gives it (`$record:{create.order-id}`, `$record:{orders[*].id}`) and the length it takes, or
 * undefined where there is none.
 */
export const readRecordReference = (
  text: string
): { template: string; length: number } | undefined => {
  const match = FIELD_REFERENCE.exec(text);
  if (!match) return undefined;
  let path: string;
  if (match[1] !== undefined) {
    // a quoted name: dots separate its parts, `\.` is a dot of a key, `\"` and `\\` are a quote and a backslash
    const keys: string[] = [];
    let key = '';
    const quoted = match[1];
    for (let i = 0; i < quoted.length; ++i) {
      const ch = quoted[i];
      if (ch === '\\' && i + 1 < quoted.length) {
        key += quoted[++i];
      } else if (ch === '.') {
        keys.push(key);
        key = '';
      } else key += ch;
    }
    keys.push(key);
    path = keys.map(testPathKey).join('.');
  } else {
    path = match[2];
  }
  let length = match[0].length;
  for (let rest = text.slice(length), accessor = ACCESSOR.exec(rest); accessor;) {
    const written = accessor[0];
    if (written.startsWith('[') || written === '{*}') {
      path += written;
    } else if (written.startsWith('.')) {
      path += written;
    } else {
      const key =
        written.startsWith('{"') ?
          (JSON.parse(written.slice(1, -1)) as string)
        : written.slice(1, -1);
      path += `.${testPathKey(key)}`;
    }
    length += written.length;
    rest = text.slice(length);
    accessor = ACCESSOR.exec(rest);
  }
  return { template: `$record:{${recordTemplateText(path)}}`, length };
};

/**
 * The `$record:{…}` template a field reference stands for, when `reference` is exactly one field reference
 * (`@orders[*].id` is `$record:{orders[*].id}`), or undefined.
 */
export const recordTemplateOfReference = (reference: string): string | undefined => {
  const read = readRecordReference(reference);
  return read && read.length === reference.length ? read.template : undefined;
};
