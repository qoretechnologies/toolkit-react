// Copyright 2026 Qore Technologies, s.r.o.
// A field path written with accessors (qorus#646): `@orders[*].id`, `@prices{*}.amount`, `@items[0].id`. The
// server reads one into accessor operations - `list_wildcard`, `hash_wildcard`, `wildcard_item`, `index` and `key` -
// over record fields, and an expression made only of those is drawn as the path it is, not as an operation with
// operands: the `@value` in `hash_wildcard(prices, value)` is the item's value, not a record field, and drawn as an
// operand it read "record: value".
import { recordFieldOfTemplate } from '../../../helpers/templates';
import { IExpression, IExpressionValue } from './types';

/** The accessor operations a field path is written with, as Qore's DataProvider names them. */
export const FIELD_PATH_OPERATIONS = {
  listWildcard: 'list_wildcard',
  hashWildcard: 'hash_wildcard',
  wildcardItem: 'wildcard_item',
  index: 'index',
  key: 'key',
} as const;

/** A key that reads as a field name after a dot; any other is written `{"key"}`. */
const BARE_KEY = /^[\p{L}_][\p{L}\p{M}\p{N}_]*$/u;

/** The operation an operand is, when it is one: its `{ exp, args }`. */
const operationOf = (arg?: IExpression): IExpressionValue | undefined =>
  arg?.is_expression && arg.value && typeof arg.value === 'object' ? arg.value : undefined;

/** The record field an operand names, when it is a field: `$record:{orders}` is `orders`. */
const recordFieldOf = (arg?: IExpression): string | undefined => {
  if (!arg || arg.is_expression || typeof arg.value !== 'string') {
    return undefined;
  }
  return recordFieldOfTemplate(arg.value);
};

/**
 * The path an operand is, or undefined when it is anything else. `relative`: it is a wildcard's body, read from the
 * item (`wildcard_item`, which is nothing written) - a field there is written after a dot (`[*].id`).
 */
const pathOfOperand = (arg: IExpression | undefined, relative: boolean): string | undefined => {
  const field = recordFieldOf(arg);
  if (field !== undefined) {
    return (
      field === '' ? undefined
      : relative ? `.${field}`
      : field
    );
  }
  const operation = operationOf(arg);
  return operation ? pathOfOperation(operation, relative) : undefined;
};

/** A hash wildcard's body: read from the value (`@value`), which is not written - `{*}.amount`, `{*}`. */
const hashBodyOf = (arg?: IExpression): string | undefined => {
  const body = pathOfOperand(arg, true);
  if (body === undefined) {
    return undefined;
  }
  if (body === '.value') {
    return '';
  }
  return /^\.value[.[{]/.test(body) ? body.slice('.value'.length) : undefined;
};

/** A literal operand's value: what `index` and `key` take. */
const literalOf = (arg?: IExpression): unknown =>
  arg && !arg.is_expression && !(typeof arg.value === 'string' && arg.value.startsWith('$')) ?
    arg.value
  : undefined;

const pathOfOperation = (operation: IExpressionValue, relative: boolean): string | undefined => {
  const [source, second] = operation.args ?? [];
  const count = operation.args?.length ?? 0;

  switch (operation.exp) {
    case FIELD_PATH_OPERATIONS.wildcardItem:
      // the item of the enclosing [*]: nothing written, and only inside a wildcard
      return relative && count === 0 ? '' : undefined;
    case FIELD_PATH_OPERATIONS.listWildcard:
    case FIELD_PATH_OPERATIONS.hashWildcard: {
      if (count !== 2) {
        return undefined;
      }
      const from = pathOfOperand(source, relative);
      const isList = operation.exp === FIELD_PATH_OPERATIONS.listWildcard;
      const body = isList ? pathOfOperand(second, true) : hashBodyOf(second);
      return from === undefined || body === undefined ?
          undefined
        : `${from}${isList ? '[*]' : '{*}'}${body}`;
    }
    case FIELD_PATH_OPERATIONS.index: {
      const from = pathOfOperand(source, relative);
      const at = literalOf(second);
      return count === 2 && from !== undefined && typeof at === 'number' && Number.isInteger(at) ?
          `${from}[${at}]`
        : undefined;
    }
    case FIELD_PATH_OPERATIONS.key: {
      const from = pathOfOperand(source, relative);
      const key = literalOf(second);
      if (count !== 2 || from === undefined || typeof key !== 'string') {
        return undefined;
      }
      return BARE_KEY.test(key) ? `${from}.${key}` : `${from}{${JSON.stringify(key)}}`;
    }
    default:
      return undefined;
  }
};

/**
 * The field path an expression is, as written - `orders[*].id`, `prices{*}`, `items[0].id` - when it is made only of
 * record fields and the accessor operations over them (and holds at least one); otherwise undefined, and it is
 * drawn as the operation it is. A record field alone is not a path: it is the field.
 */
export const fieldPathOf = (expression?: IExpression | IExpressionValue): string | undefined => {
  const operation =
    expression && 'is_expression' in expression ?
      operationOf(expression as IExpression)
    : (expression as IExpressionValue);
  if (!operation?.exp) {
    return undefined;
  }
  const path = pathOfOperation(operation, false);
  return path === '' ? undefined : path;
};

/** The template a field path is drawn as: the same chip a record field operand is, `$record:{orders[*].id}`. */
export const fieldPathTemplate = (path: string): string => `$record:{${path}}`;

/**
 * The expression with each field path in it written as the reference it reads as - `$record:{orders[*].id}` - for
 * a rendering to draw it as the Visual tab does: the path's chip, not the accessor operations. What is stored is
 * not changed; this is only what is shown.
 */
export const withFieldPathsAsReferences = (value: IExpressionValue): IExpressionValue => ({
  ...value,
  args: value.args?.map((arg) => {
    const path = arg?.is_expression ? fieldPathOf(arg) : undefined;
    if (path !== undefined) {
      return { type: 'auto', value: fieldPathTemplate(path) };
    }
    return arg?.is_expression && arg.value?.exp ?
        { ...arg, value: withFieldPathsAsReferences(arg.value) }
      : arg;
  }),
});
