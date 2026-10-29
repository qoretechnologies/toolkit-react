// Copyright 2026 Qore Technologies, s.r.o.
// A record field as the stories' stand-in for the Qorus language server writes it in DPQL, and reads it back
// (qorus#646). The server reads `$record:{<path>}` as a test path (Qorus `QorusRecordPath::reference()`): fields
// separated by `.`, the selectors `[n]`, `[*]` and `{*}`, and a backslash escaping the character after it. A path of
// fields is a field reference, a path with a selector the accessors DPQL gives the same path written after `@`; and
// `dpql/serialize` writes those as the DPQL serializer writes them (Qore `DpqlSerializer`, qore#5480):
//
// - a field path whose every part is a bare name is written bare (`@create.status`), any other quoted as one name
//   (`@"create.order-id"`): dots separate the parts in a quoted name too, and a dot that is part of a key is `\.`
//   (the key `Unit.Price` is `@"Unit\.Price"`);
// - after `[*]` the item's path is `.name` (`@orders[*].id`), or `{"key"}` for one key that is not a name; after
//   `{*}` it is the path after the value (`@prices{*}.amount`);
// - a key after an index is `.name` when it is a name (`@items[0].sku`), else `{key}` / `{"key"}`.
//
// What the serializer cannot write as accessors (a wildcard body it writes with `map`) is left as the template.
// Pure: no React, no transport.
import { readRecordReference } from '../../../helpers/recordFieldReference';

export { readRecordReference };

/** Qore `DpqlTokenizer::isBareFieldName()`: a name, then `.` and more parts of letters, digits and `_`. */
const BARE_FIELD = /^[\p{L}_][\p{L}\p{M}\p{N}_]*(?:\.[\p{L}\p{M}\p{N}_]+)*$/u;
/** Qore `DpqlSerializer::isBareMemberName()`: a key written `.name` after an accessor. */
const BARE_MEMBER = /^[\p{L}_](?:[\p{L}\p{M}\p{N}_]|-[a-zA-Z])*$/u;
/** Qore `DpqlTokenizer::isBareKey()`: a key written bare in braces. */
const BARE_KEY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
/** Qore `DpqlKeywordIdentifiers`: identifiers that are values, so never a bare key. */
const KEYWORD_IDENTIFIERS = new Set(['true', 'false', 'null']);

const isBareMember = (name: string) =>
  BARE_MEMBER.test(name) && !KEYWORD_IDENTIFIERS.has(name.toLowerCase());
const isBareKey = (name: string) =>
  BARE_KEY.test(name) && !KEYWORD_IDENTIFIERS.has(name.toLowerCase());

/** A part of a record path. */
type TPathPart =
  | { kind: 'field'; name: string }
  | { kind: 'index'; index: number }
  | { kind: 'list' }
  | { kind: 'hash' };

/** The reference a record path is, as the server builds it: a field reference, or accessors over one. */
type TReference =
  | { kind: 'field'; field: string }
  | { kind: 'item' }
  | { kind: 'index'; base: TReference; index: number }
  | { kind: 'key'; base: TReference; key: string }
  | { kind: 'list' | 'hash'; base: TReference; body: TReference };

/** The text in the braces of a template with the template's escapes (`\{`, `\}`, `\\`) decoded. */
export const recordTemplatePath = (text: string): string => text.replace(/\\([{}\\])/g, '$1');

/** The parts of a record path as a test path reads it, or undefined where the accessors cannot give it. */
const pathParts = (path: string): { parts: TPathPart[]; selector: boolean } | undefined => {
  const parts: TPathPart[] = [];
  let selector = false;
  let segment = '';
  const flush = () => {
    if (segment !== '') parts.push({ kind: 'field', name: segment });
    segment = '';
  };
  for (let i = 0; i < path.length; ++i) {
    const ch = path[i];
    if (ch === '\\') {
      if (i + 1 >= path.length) return undefined;
      segment += path[++i];
    } else if (ch === '.') {
      flush();
    } else if (ch === '[') {
      flush();
      const end = path.indexOf(']', i + 1);
      if (end < 0) return undefined;
      const raw = path.slice(i + 1, end);
      if (raw === '*') parts.push({ kind: 'list' });
      else if (/^\d+$/.test(raw)) parts.push({ kind: 'index', index: Number(raw) });
      else return undefined;
      selector = true;
      i = end;
    } else if (ch === '{' && path.startsWith('{*}', i)) {
      flush();
      parts.push({ kind: 'hash' });
      selector = true;
      i += 2;
    } else {
      segment += ch;
    }
  }
  flush();
  return parts.length && parts[0].kind === 'field' ? { parts, selector } : undefined;
};

/** The value accessors apply to: the base, the field reference of the fields read, or the wildcard's item. */
const accessorBase = (base: TReference | undefined, fields: string[]): TReference =>
  base ??
  (fields.length ?
    { kind: 'field', field: fields.map((name) => name.replace(/\./g, '\\.')).join('.') }
  : { kind: 'item' });

/** `QorusRecordPath::accessors()`: the reference of the parts from `pos`, read from `base` or the record. */
const accessors = (
  parts: TPathPart[],
  pos: number,
  base: TReference | undefined,
  fields: string[]
): TReference => {
  for (let i = pos; i < parts.length; ++i) {
    const part = parts[i];
    switch (part.kind) {
      case 'field':
        if (base) base = { kind: 'key', base, key: part.name };
        else fields = [...fields, part.name];
        break;
      case 'index':
        base = { kind: 'index', base: accessorBase(base, fields), index: part.index };
        fields = [];
        break;
      case 'list':
        return {
          kind: 'list',
          base: accessorBase(base, fields),
          body: accessors(parts, i + 1, undefined, []),
        };
      case 'hash':
        return {
          kind: 'hash',
          base: accessorBase(base, fields),
          body: accessors(parts, i + 1, undefined, ['value']),
        };
    }
  }
  return accessorBase(base, fields);
};

/** `DpqlSerializer::escapeFieldPath()`: a quote is `\"`, a backslash before a dot stays, any other is `\\`. */
const escapeFieldPath = (field: string): string =>
  field.replace(/"|\\(?!\.)/g, (match) => (match === '"' ? '\\"' : '\\\\'));

/** `DpqlSerializer::serializeFieldRef()`. */
const fieldReference = (field: string): string =>
  BARE_FIELD.test(field) ? `@${field}` : `@"${escapeFieldPath(field)}"`;

/** The keys of a field path: split at its unescaped dots, the escapes read. */
const fieldPathKeys = (field: string): string[] => {
  const keys: string[] = [];
  let key = '';
  for (let i = 0; i < field.length; ++i) {
    if (field[i] === '\\' && i + 1 < field.length) key += field[++i];
    else if (field[i] === '.') {
      keys.push(key);
      key = '';
    } else key += field[i];
  }
  keys.push(key);
  return keys;
};

/** `DpqlSerializer::serializeKeyAccessor()`: `.name` after an accessor, else `{key}` or `{"key"}`. */
const keyAccessor = (key: string, afterAccessor: boolean): string =>
  afterAccessor && isBareMember(key) ?
    `.${key}`
  : `{${isBareKey(key) ? key : JSON.stringify(key)}}`;

const isAccessor = (reference: TReference) =>
  reference.kind === 'index' || reference.kind === 'key';

/** `DpqlSerializer::serializeWildcardFieldPath()`. */
const wildcardFieldPath = (field: string, op: 'list' | 'hash'): string | undefined => {
  const keys = fieldPathKeys(field);
  if (op === 'hash') {
    if (keys[0] !== 'value') return undefined;
    keys.shift();
  }
  if (keys.every(isBareMember)) return keys.length ? `.${keys.join('.')}` : '';
  return op === 'list' && keys.length === 1 ? `{${JSON.stringify(keys[0])}}` : undefined;
};

/** `DpqlSerializer::serializeWildcardBody()`: the accessors after `[*]` or `{*}`, or undefined. */
const wildcardBody = (body: TReference, op: 'list' | 'hash'): string | undefined => {
  switch (body.kind) {
    case 'field':
      return wildcardFieldPath(body.field, op);
    case 'item':
      return op === 'list' ? '' : undefined;
    case 'index': {
      const base = wildcardBody(body.base, op);
      return base === undefined ? undefined : `${base}[${body.index}]`;
    }
    case 'key': {
      const base = wildcardBody(body.base, op);
      return base === undefined ? undefined : base + keyAccessor(body.key, isAccessor(body.base));
    }
    case 'list':
    case 'hash': {
      const base = wildcardBody(body.base, op);
      const inner = wildcardBody(body.body, body.kind);
      return base === undefined || inner === undefined ?
          undefined
        : `${base}${body.kind === 'list' ? '[*]' : '{*}'}${inner}`;
    }
  }
};

/** A reference as `dpql/serialize` writes it, or undefined where the accessors cannot write it. */
const serialize = (reference: TReference): string | undefined => {
  switch (reference.kind) {
    case 'field':
      return fieldReference(reference.field);
    case 'item':
      return undefined;
    case 'index': {
      const base = serialize(reference.base);
      return base === undefined ? undefined : `${base}[${reference.index}]`;
    }
    case 'key': {
      const base = serialize(reference.base);
      return base === undefined ? undefined : (
          base + keyAccessor(reference.key, isAccessor(reference.base))
        );
    }
    case 'list':
    case 'hash': {
      const base = serialize(reference.base);
      const body = wildcardBody(reference.body, reference.kind);
      return base === undefined || body === undefined ?
          undefined
        : `${base}${reference.kind === 'list' ? '[*]' : '{*}'}${body}`;
    }
  }
};

/**
 * A `$record:{<path>}` template as `dpql/serialize` writes the reference it is - `@create.status`,
 * `@"create.order-id"`, `@"Unit\.Price"`, `@orders[*].id`, `@prices{*}.amount`, `@items[0].sku` - or undefined for
 * any other value, and for a path the accessors cannot write (it stays the template).
 */
export const recordReferenceDpql = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const inner = /^\$record:\{(.*)\}$/s.exec(value)?.[1];
  if (inner === undefined) return undefined;
  const path = recordTemplatePath(inner);
  if (!/[[{\\]/.test(path)) {
    return path === '' ? undefined : fieldReference(path);
  }
  const read = pathParts(path);
  if (!read) return undefined;
  if (!read.selector) {
    return serialize(
      accessorBase(
        undefined,
        read.parts.map((part) => (part as { name: string }).name)
      )
    );
  }
  return serialize(accessors(read.parts, 0, undefined, []));
};
