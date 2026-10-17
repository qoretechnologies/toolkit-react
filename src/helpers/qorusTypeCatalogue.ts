// Copyright 2026 Qore Technologies, s.r.o.
// The Qorus server's type catalogue as reqraft keeps it (qorus#646): what each type is called as a label (its
// display name) and inside a sentence (its sentence form). No React here: the form's validation names types too,
// and the hook (`useQorusTypes`) that answers with the server's catalogue builds on it.
import { IReqoreIconName } from '@qoretechnologies/reqore/dist/types/icons';
import { TQorusType } from '@qoretechnologies/ts-toolkit';

export interface IQorusTypeObject {
  /** The type's name as a label: in a picker, a form, a list ("Whole number"). */
  display_name: string;
  /**
   * The type's name inside a sentence ("a whole number": "The expression gives a whole number"). A server before
   * qorus c6b3fb97c gives none; see `qorusTypeSentenceForm`.
   */
  sentence_form?: string;
  name: TQorusType | string;
  desc?: string;
  short_desc?: string;
  icon?: IReqoreIconName;
  types_accepted: (TQorusType | string)[];
  exact_match?: (TQorusType | string)[];
}

export const compactTypesList = ['richtext', 'float', 'hash', 'list', 'bool', 'date', 'binary'];

/**
 * reqraft's copy of the server's type catalogue (GET /system/qorus-type-info), used until the server answers: the
 * same types, in the same order, with the same fields. __tests__/qorusTypeCatalogue.test.ts compares it with a
 * recorded response (__tests__/fixtures/qorusTypeInfo.json), so a copy that drifts from the server fails.
 */
export const defaultQorusTypes: IQorusTypeObject[] = [
  {
    name: 'any',
    display_name: 'Any',
    sentence_form: 'any value',
    short_desc: 'Any data type',
    desc: 'Any data type',
    types_accepted: ['any'],
    exact_match: ['any'],
  },
  {
    name: 'context',
    display_name: 'Context',
    sentence_form: "a value of the context's type",
    short_desc: 'The data type is determined by the context value chosen',
    desc: 'The data type is determined by the context value chosen',
    types_accepted: ['any'],
    exact_match: ['any'],
  },
  {
    name: 'string',
    display_name: 'Text',
    sentence_form: 'text',
    short_desc: 'Text',
    desc: 'Text',
    types_accepted: ['any'],
    exact_match: ['string', 'richtext'],
  },
  {
    name: 'richtext',
    display_name: 'Rich text',
    sentence_form: 'formatted text',
    short_desc: 'Text with formatting',
    desc: 'Text with formatting',
    types_accepted: ['any'],
    exact_match: ['string', 'richtext'],
  },
  {
    name: 'int',
    display_name: 'Whole number',
    sentence_form: 'a whole number',
    short_desc: 'A whole number (64-bit)',
    desc: 'A whole number (64-bit)',
    types_accepted: ['int', 'float', 'number'],
    exact_match: ['int', 'float', 'number'],
  },
  {
    name: 'float',
    display_name: 'Number',
    sentence_form: 'a number',
    short_desc: 'A number with a fractional part (double precision)',
    desc: 'A number with a fractional part (double precision)',
    types_accepted: ['float', 'int', 'number'],
    exact_match: ['float', 'int', 'number'],
  },
  {
    name: 'number',
    display_name: 'Exact number',
    sentence_form: 'an exact number',
    short_desc: 'A decimal number kept exactly',
    desc: 'A decimal number kept exactly',
    types_accepted: ['number', 'float', 'int'],
    exact_match: ['number', 'float', 'int'],
  },
  {
    name: 'bool',
    display_name: 'True or false',
    sentence_form: 'true or false',
    short_desc: 'True or false',
    desc: 'True or false',
    types_accepted: ['bool'],
    exact_match: ['bool'],
  },
  {
    name: 'date',
    display_name: 'Date',
    sentence_form: 'a date and time',
    short_desc: 'A date and time',
    desc: 'A date and time',
    types_accepted: ['date'],
    exact_match: ['date'],
  },
  {
    name: 'time',
    display_name: 'Time',
    sentence_form: 'a time of day',
    short_desc: 'A time of day',
    desc: 'A time of day',
    types_accepted: ['date'],
    exact_match: ['date'],
  },
  {
    name: 'binary',
    display_name: 'Binary data',
    sentence_form: 'binary data',
    short_desc: 'Binary data',
    desc: 'Binary data',
    types_accepted: ['binary'],
    exact_match: ['binary'],
  },
  {
    name: 'data',
    display_name: 'Text or binary data',
    sentence_form: 'text or binary data',
    short_desc: 'Text or binary data',
    desc: 'Text or binary data',
    types_accepted: ['string', 'richtext', 'binary', 'data'],
    exact_match: ['string', 'richtext', 'binary', 'data'],
  },
  {
    name: 'hash',
    display_name: 'Key-value pairs (hash)',
    sentence_form: 'key-value pairs (a hash)',
    short_desc: 'Key-value pairs (hash)',
    desc: 'Key-value pairs (a hash): each value is stored under a named key',
    types_accepted: ['hash'],
    exact_match: ['hash'],
  },
  {
    name: 'list',
    display_name: 'List',
    sentence_form: 'a list',
    short_desc: 'List',
    desc: 'List',
    types_accepted: ['list'],
    exact_match: ['list'],
  },
  {
    name: 'rgbcolor',
    display_name: 'Color',
    sentence_form: 'a color',
    short_desc: 'A color: red, green and blue from 0 to 255 and an opacity from 0 to 1',
    desc: 'A color, stored as a hash: r, g and b are integers from 0 to 255, and a is the opacity, from 0 (transparent) to 1 (opaque); a missing or null a is opaque. A hex code such as #ff0000 is not a stored color.',
    types_accepted: ['rgbcolor'],
    exact_match: ['rgbcolor'],
  },
  {
    name: 'workflow',
    display_name: 'Workflow',
    sentence_form: 'a workflow',
    short_desc: 'Qorus workflow',
    desc: 'Qorus workflow',
    types_accepted: ['workflow', 'string', 'richtext'],
    exact_match: ['workflow', 'string', 'richtext'],
  },
  {
    name: 'service',
    display_name: 'Service',
    sentence_form: 'a service',
    short_desc: 'Qorus service',
    desc: 'Qorus service',
    types_accepted: ['service', 'string', 'richtext'],
    exact_match: ['service', 'string', 'richtext'],
  },
  {
    name: 'job',
    display_name: 'Job',
    sentence_form: 'a job',
    short_desc: 'Qorus job',
    desc: 'Qorus job',
    types_accepted: ['job', 'string', 'richtext'],
    exact_match: ['job', 'string', 'richtext'],
  },
  {
    name: 'mapper',
    display_name: 'Mapper',
    sentence_form: 'a mapper',
    short_desc: 'Qorus mapper',
    desc: 'Qorus mapper',
    types_accepted: ['mapper', 'string', 'richtext'],
    exact_match: ['mapper', 'string', 'richtext'],
  },
  {
    name: 'data-provider',
    display_name: 'Data provider',
    sentence_form: 'a data provider',
    short_desc: 'Qorus data provider',
    desc: 'Qorus data provider',
    types_accepted: ['data-provider'],
    exact_match: ['data-provider'],
  },
  {
    name: 'connection',
    display_name: 'Connection',
    sentence_form: 'a connection',
    short_desc: 'Qorus connection',
    desc: 'Qorus connection',
    types_accepted: ['connection', 'string', 'richtext'],
    exact_match: ['connection', 'string', 'richtext'],
  },
];

export const getQorusTypes = (): IQorusTypeObject[] => defaultQorusTypes;

/** Qore's other names for a type the catalogue lists under its own (qorus#646). */
const QORE_TYPE_ALIASES: Record<string, string> = { boolean: 'bool', integer: 'int' };

/**
 * A type's name as the catalogue lists it: Qore's other name for a type (`integer`, `boolean`) is the type it names
 * (`int`, `bool`). The server's catalogue knows each type by one name only, and says which it converts by that name.
 */
export const catalogueTypeName = (typeName: string): string => QORE_TYPE_ALIASES[typeName] ?? typeName;

/**
 * The catalogue's entry for a type (the server's catalogue, or reqraft's copy until it answers).
 *
 * The catalogue lists each type once, by its own name, and the catalogue's own entry for a name always wins. A type
 * named another way is the type it is, as the server names it (qorus c6b3fb97c): `boolean` and `integer` are `bool`
 * and `int`; an optional type (`*string`) and a soft one (`softint`, a declaration that converts a value to its base
 * type) are their base type; a complex one (`hash<auto>`, `list<string>`) is its kind. Undefined for a type the
 * catalogue lists under no name.
 */
const qorusTypeEntry = (
  types: IQorusTypeObject[] | undefined,
  typeName: string | undefined
): IQorusTypeObject | undefined => {
  // a place with no type yet is named by nothing
  if (!typeName) {
    return undefined;
  }
  const listed = (name: string) => types?.find((type) => type.name === name);
  const base = typeName.replace(/^\*/, '').replace(/<.*$/, '');
  const unsoft = /^soft[a-z]/.test(base) ? base.slice(4) : base;
  return (
    listed(typeName) ??
    listed(base) ??
    listed(QORE_TYPE_ALIASES[base] ?? '') ??
    listed(unsoft) ??
    listed(QORE_TYPE_ALIASES[unsoft] ?? '')
  );
};

/**
 * What a type is called as a label ("Whole number"), by the type catalogue; a type it lists under no name keeps its
 * name. See `qorusTypeEntry` for the names a type goes by.
 *
 * No type (`undefined` or an empty name: a place whose type is not known yet) has no name: `undefined`, and the
 * caller draws or words its text without one (qorus#646).
 */
export const qorusTypeDisplayName = (
  types: IQorusTypeObject[] | undefined,
  typeName: string | undefined
): string | undefined =>
  typeName ? (qorusTypeEntry(types, typeName)?.display_name ?? typeName) : undefined;

/**
 * What a type is called inside a sentence ("a whole number": "The expression gives a whole number"), by the type
 * catalogue - its sentence form, which the server gives in the language it is asked for (qorus#646, c6b3fb97c).
 *
 * A catalogue with no sentence form for it (a server before c6b3fb97c) gives a wording that needs no article -
 * "a value of type Whole number" - with its display name, or the type's own name where the catalogue lists it under
 * none. An English article is never built from a display name: "a Exact number", "a Whole number" in a sentence
 * of another language.
 *
 * No type (`undefined` or an empty name) has no sentence form: `undefined`, and the caller words its sentence
 * without a type ("This expression gives nothing", "Converted to a whole number") rather than "a value of type
 * undefined" (qorus#646).
 */
export const qorusTypeSentenceForm = (
  types: IQorusTypeObject[] | undefined,
  typeName: string | undefined
): string | undefined => {
  if (!typeName) {
    return undefined;
  }
  const entry = qorusTypeEntry(types, typeName);
  return entry?.sentence_form || `a value of type ${entry?.display_name ?? typeName}`;
};
