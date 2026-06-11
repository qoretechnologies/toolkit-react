// Copyright 2026 Qore Technologies, s.r.o.
// An expression-catalogue fixture for stories / tests — a faithful subset of
// the real `GET /system?action=expressions&context=ui` payload (captured
// live), so the offline stories render the same operand types, operator
// words (`label_after`), and group structure as the live IDE. Not all 121
// entries — the ones the stories exercise.
import { IExpressionSchema } from './types';

// String comparators share this arg shape: a richtext value (with the
// operator word as `label_after`), a richtext operand, and an Ignore Case flag.
const stringArgs = (
  operandLabel: string,
  operatorWord: string
): IExpressionSchema['args'] => [
  {
    name: 'softstring',
    display_name: 'String Value',
    ui_type: 'richtext',
    required: true,
    label_after: operatorWord,
  },
  { name: 'softstring', display_name: operandLabel, ui_type: 'richtext', required: true },
  {
    name: 'bool',
    display_name: 'Ignore Case?',
    ui_type: 'bool',
    required: true,
    default_value: true,
  },
];

// Binary comparators on `any`: a value, the operator word, another value.
const comparatorArgs = (operatorWord: string): IExpressionSchema['args'] => [
  { name: 'any', display_name: 'Value', ui_type: 'any', required: true, label_after: operatorWord },
  { name: 'any', display_name: 'Value', ui_type: 'any', required: true },
];

export const mockExpressions: IExpressionSchema[] = [
  {
    name: '==',
    display_name: 'Logical Equals',
    short_desc: 'Returns True if the two arguments are logically equal',
    desc: 'Returns `True` if the two arguments are logically equal; types are converted if necessary.',
    symbol: '==',
    type: 1,
    subtype: 1,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: false,
    groups: ['Comparison'],
    args: comparatorArgs('=='),
  },
  {
    name: '<',
    display_name: 'Logical Less Than',
    short_desc: 'Returns True if the first argument is less than the second',
    desc: 'Returns `True` if the first argument is less than the second.',
    symbol: '<',
    type: 1,
    subtype: 1,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: false,
    groups: ['Comparison'],
    args: comparatorArgs('<'),
  },
  {
    name: '>=',
    display_name: 'Logical Greater Than Or Equal',
    short_desc: 'Returns True if the first argument is greater than or equal to the second',
    desc: 'Returns `True` if the first argument is greater than or equal to the second.',
    symbol: '>=',
    type: 1,
    subtype: 1,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: false,
    groups: ['Comparison'],
    args: comparatorArgs('>='),
  },
  {
    name: '&&',
    display_name: 'Logical And',
    short_desc: 'Returns True if all arguments are True with logic short-circuiting',
    desc: 'Logical AND of all arguments, with short-circuiting.',
    symbol: '&&',
    type: 1,
    subtype: 2,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: true,
    min_args: 1,
    groups: ['Logic'],
    args: [{ name: 'bool', display_name: 'Value', ui_type: 'bool', required: true }],
  },
  {
    name: '||',
    display_name: 'Logical Or',
    short_desc: 'Returns True if at least one argument is True with logic short-circuiting',
    desc: 'Logical OR of all arguments, with short-circuiting.',
    symbol: '||',
    type: 1,
    subtype: 2,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: true,
    min_args: 1,
    groups: ['Logic'],
    args: [{ name: 'bool', display_name: 'Value', ui_type: 'bool', required: true }],
  },
  {
    name: 'contains',
    display_name: 'String Contains',
    short_desc: 'Returns True if the given string contains the given characters',
    desc: 'Returns `True` if the first argument contains the second.',
    symbol: 'contains',
    type: 1,
    subtype: 1,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: false,
    groups: ['String'],
    args: stringArgs('Substring', 'contains'),
  },
  {
    name: 'starts-with',
    display_name: 'String Starts With',
    short_desc: 'Returns True if the given value starts with the given characters',
    desc: 'Returns `True` if the value starts with the given characters when converted to a string.',
    symbol: 'startsWith',
    type: 1,
    subtype: 1,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: false,
    groups: ['String'],
    args: stringArgs('Start String', 'starts with'),
  },
  {
    name: 'ends-with',
    display_name: 'String Ends With',
    short_desc: 'Returns True if the given string ends with the given characters',
    desc: 'Returns `True` if the value ends with the given characters when converted to a string.',
    symbol: 'endsWith',
    type: 1,
    subtype: 1,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: false,
    groups: ['String'],
    args: stringArgs('End String', 'ends with'),
  },
  // --- Varargs (int) -------------------------------------------------------
  // The base of the variable-arguments family. `varargs: true` + `subtype: 1`
  // (NOT 2 — subtype 2 is the &&/|| logical-group path) so `addMissingArgs`
  // appends `min_args - 1` plain int slots. `min_args: 1` matches the IDE `+`.
  {
    name: '+',
    display_name: 'Addition',
    short_desc: 'Returns the sum of all arguments',
    desc: 'Returns the sum of all arguments. Accepts a variable number of integer operands.',
    symbol: '+',
    type: 1,
    subtype: 1,
    return_type: 'int',
    ui_return_type: 'int',
    varargs: true,
    min_args: 1,
    groups: ['Math'],
    args: [{ name: 'int', display_name: 'Value', ui_type: 'int', required: true }],
  },
  // --- Function expressions ------------------------------------------------
  // Single-arg type-conversion function. Used as the wrap/unwrap base: a
  // boolean-returning op with one operand ("Value To Convert").
  {
    name: 'convert-to-boolean',
    display_name: 'Convert to Boolean',
    short_desc: 'Converts the given value to a boolean',
    desc: 'Converts the given value to a boolean value.',
    symbol: 'boolean',
    type: 1,
    subtype: 1,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: false,
    groups: ['Conversion'],
    // `ui_type: 'richtext'` (not `any`): a concrete operand type so the operand
    // field renders once it carries a value. String/richtext input is a
    // faithful conversion source.
    args: [
      { name: 'softstring', display_name: 'Value To Convert', ui_type: 'richtext', required: true },
    ],
  },
  // List → string join. The wrap target: a single-operand op ("List To Join")
  // an expression can be wrapped in.
  {
    name: 'join-list',
    display_name: 'Join List Elements',
    short_desc: 'Joins the elements of a list into a single string',
    desc: 'Joins the elements of the given list into a single string.',
    symbol: 'join',
    type: 1,
    subtype: 1,
    return_type: 'string',
    ui_return_type: 'string',
    varargs: false,
    groups: ['List'],
    args: [{ name: 'list', display_name: 'List To Join', ui_type: 'list', required: true }],
  },
  // String op whose first operand is `richtext` (types_accepted: ['any']),
  // so a `date`-typed first arg is accepted-but-not-exact when an op switches
  // to it — this drives the mismatched-types confirmation modal (Tier B).
  // The third arg mirrors the live op's "Regex Options" — a list with
  // `element_allowed_values` — for the IDE's `WithArgWithAllowedValues` /
  // `ArgsChangeWhenOperatorChanges` story family.
  {
    name: 'regex',
    display_name: 'Matches Regular Expression',
    short_desc: 'Returns True if the given value matches the regular expression',
    desc: 'Returns `True` if the value matches the given regular expression.',
    symbol: 'regex',
    type: 1,
    subtype: 1,
    return_type: 'bool',
    ui_return_type: 'bool',
    varargs: false,
    groups: ['String'],
    args: [
      { name: 'softstring', display_name: 'String Value', ui_type: 'richtext', required: true },
      { name: 'string', display_name: 'Regular Expression', ui_type: 'string', required: true },
      {
        name: 'list',
        display_name: 'Regex Options',
        ui_type: 'list',
        required: false,
        element_allowed_values: [
          {
            display_name: 'Global',
            short_desc: 'Match all occurrences',
            value: { value: 'g', type: 'string' },
          },
          {
            display_name: 'Multiline',
            short_desc: '^ and $ match line boundaries',
            value: { value: 'm', type: 'string' },
          },
          {
            display_name: 'Case Insensitive',
            short_desc: 'Ignore case when matching',
            value: { value: 'i', type: 'string' },
          },
        ],
      },
    ],
  },
  // Date formatter — first operand `date`, second `richtext`. The mismatch
  // base: switching this to a string op (`regex`) makes the `date` first arg
  // accepted-but-not-exact → the confirmation modal.
  {
    name: 'format_date',
    display_name: 'Format Date',
    short_desc: 'Formats a date according to the given format string',
    desc: 'Formats the given date value according to the given format string.',
    symbol: 'format_date',
    type: 2,
    subtype: 1,
    return_type: 'string',
    ui_return_type: 'string',
    varargs: false,
    groups: ['Date'],
    args: [
      { name: 'date', display_name: 'Date To Format', ui_type: 'date', required: true },
      { name: 'string', display_name: 'Format String', ui_type: 'richtext', required: true },
    ],
  },
  // Number formatter — first operand `int`/`number`. The IDE's
  // `FunctionFirstArgTypeCanBeChanged` target.
  {
    name: 'format_number',
    display_name: 'Format Number',
    short_desc: 'Formats a number according to the given format string',
    desc: 'Formats the given number value according to the given format string.',
    symbol: 'format_number',
    type: 2,
    subtype: 1,
    return_type: 'string',
    ui_return_type: 'string',
    varargs: false,
    groups: ['Number'],
    args: [
      { name: 'number', display_name: 'Number To Format', ui_type: 'number', required: true },
      { name: 'string', display_name: 'Format String', ui_type: 'richtext', required: true },
    ],
  },
];
