// Copyright 2026 Qore Technologies, s.r.o.
// The catalogue entries for DPQL's accessor wildcards, as the server serves them (Qore DataProvider 3.10,
// `GET system?action=expressions&context=ui`), and `size`, which a wildcard is typically counted with. A fixture
// for the stories and tests of a field path (qorus#646); not a catalogue a form is given.
import { IExpressionSchema } from './types';

const anyArg = (display_name: string, short_desc: string) => ({
  name: 'any',
  display_name,
  short_desc,
  ui_type: 'any',
  required: true,
});

export const WILDCARD_EXPRESSIONS: IExpressionSchema[] = [
  {
    name: 'size',
    display_name: 'Size',
    short_desc: 'Returns the number of elements in a list or hash',
    desc: 'Returns the number of elements in a list, the number of keys in a hash, or the length of a string',
    symbol: 'size',
    type: 2,
    subtype: 1,
    role: 3,
    return_type: 'int',
    ui_return_type: 'int',
    varargs: false,
    groups: ['List'],
    args: [anyArg('Value', 'The list, hash or string to measure')],
  },
  {
    name: 'list_wildcard',
    display_name: 'list wildcard ([*])',
    short_desc: 'Applies the accessors after [*] to each item of a list, returning a new list',
    desc: 'Written `source[*]` followed by accessors, such as `@orders[*].id`',
    symbol: '[*]',
    render_template: '$arg[0][*] $arg[1]',
    type: 1,
    subtype: 1,
    role: 3,
    return_type: 'list',
    ui_return_type: 'list',
    varargs: false,
    groups: ['Data Manipulation'],
    args: [
      anyArg('Source', 'The list to iterate over'),
      anyArg('Item Expression', 'The accessors evaluated for each item'),
    ],
  },
  {
    name: 'hash_wildcard',
    display_name: 'hash wildcard ({*})',
    short_desc: 'Applies the accessors after {*} to each value of a hash, returning a new list',
    desc: 'Written `source{*}` followed by accessors, such as `@prices{*}.amount`',
    symbol: '{*}',
    render_template: '$arg[0]{*} $arg[1]',
    type: 1,
    subtype: 1,
    role: 3,
    return_type: 'list',
    ui_return_type: 'list',
    varargs: false,
    groups: ['Data Manipulation'],
    args: [
      anyArg('Source', 'The hash to iterate over'),
      anyArg('Value Expression', 'The accessors evaluated for each value'),
    ],
  },
  {
    name: 'wildcard_item',
    display_name: 'wildcard item',
    short_desc: 'The item of the enclosing [*] wildcard',
    desc:
      'The item that the accessors after `[*]` are applied to when they do not start with a field; it is only ' +
      'valid in a list wildcard and is not written in DPQL',
    symbol: '',
    type: 1,
    subtype: 1,
    role: 3,
    return_type: 'any',
    ui_return_type: 'any',
    varargs: false,
    groups: ['Data Manipulation'],
    args: [],
    // the server's flag: drawn only inside a wildcard, never offered for picking
    internal: true,
  },
];

const field = (name: string) => ({ type: 'auto', value: `$record:{${name}}` });
const operation = (exp: string, ...args: unknown[]) => ({
  is_expression: true,
  value: { exp, args },
});

/** `@orders[*].id`, as the server parses it. */
export const ORDER_IDS = operation('list_wildcard', field('orders'), field('id'));
/** `@prices{*}`, as the server parses it. */
export const PRICES = operation('hash_wildcard', field('prices'), field('value'));
/** `size(@orders[*].id) + size(@prices{*})`. */
export const COUNTED_WILDCARDS = operation(
  '+',
  operation('size', ORDER_IDS),
  operation('size', PRICES)
);
