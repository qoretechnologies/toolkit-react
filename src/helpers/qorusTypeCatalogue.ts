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
  /**
   * Whether a picker that lists every type offers it as a choice. A type that is not offered (the string format
   * types, a file) names a field or an option whose UI type it is, and says what values it takes, but nobody
   * chooses it for a value; see `offeredQorusTypes`. A server before qorus 974643455 says nothing: offered.
   */
  offered?: boolean;
}

/**
 * The types a value's own type menu offers ("Set Custom Value"), in the order it lists them: text first. The menu
 * follows this order, not the catalogue's, so the server moving a type in its catalogue does not move it in the menu
 * (richtext, which follows the Qorus object types in the catalogue since qorus ed0f9ba62).
 */
export const compactTypesList = ['richtext', 'float', 'bool', 'date', 'binary', 'hash', 'list'];

/** The types `compactTypesList` names, in its order, as the catalogue describes them; one it lacks is left out. */
export const compactQorusTypes = (types: IQorusTypeObject[] | undefined): IQorusTypeObject[] =>
  compactTypesList.flatMap((name) => types?.find((type) => type.name === name) ?? []);

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
    offered: true,
  },
  {
    name: 'context',
    display_name: 'Context',
    sentence_form: "a value of the context's type",
    short_desc: 'The data type is determined by the context value chosen',
    desc: 'The data type is determined by the context value chosen',
    types_accepted: ['any'],
    exact_match: ['any'],
    offered: true,
  },
  {
    name: 'string',
    display_name: 'Text',
    sentence_form: 'text',
    short_desc: 'Text',
    desc: 'Text',
    types_accepted: ['any'],
    exact_match: ['string', 'richtext'],
    offered: true,
  },
  {
    name: 'int',
    display_name: 'Whole number',
    sentence_form: 'a whole number',
    short_desc: 'A whole number (64-bit)',
    desc: 'A whole number (64-bit)',
    types_accepted: ['int', 'float', 'number'],
    exact_match: ['int', 'float', 'number'],
    offered: true,
  },
  {
    name: 'float',
    display_name: 'Number',
    sentence_form: 'a number',
    short_desc: 'A number with a fractional part (double precision)',
    desc: 'A number with a fractional part (double precision)',
    types_accepted: ['float', 'int', 'number'],
    exact_match: ['float', 'int', 'number'],
    offered: true,
  },
  {
    name: 'number',
    display_name: 'Exact number',
    sentence_form: 'an exact number',
    short_desc: 'A decimal number kept exactly',
    desc: 'A decimal number kept exactly',
    types_accepted: ['number', 'float', 'int'],
    exact_match: ['number', 'float', 'int'],
    offered: true,
  },
  {
    name: 'bool',
    display_name: 'True or false',
    sentence_form: 'true or false',
    short_desc: 'True or false',
    desc: 'True or false',
    types_accepted: ['bool'],
    exact_match: ['bool'],
    offered: true,
  },
  {
    name: 'date',
    display_name: 'Date',
    sentence_form: 'a date and time',
    short_desc: 'A date and time',
    desc: 'A date and time',
    types_accepted: ['date'],
    exact_match: ['date'],
    offered: true,
  },
  {
    name: 'time',
    display_name: 'Time',
    sentence_form: 'a time of day',
    short_desc: 'A time of day',
    desc: 'A time of day',
    types_accepted: ['date'],
    exact_match: ['date'],
    offered: true,
  },
  {
    name: 'binary',
    display_name: 'Binary data',
    sentence_form: 'binary data',
    short_desc: 'Binary data',
    desc: 'Binary data',
    types_accepted: ['binary'],
    exact_match: ['binary'],
    offered: true,
  },
  {
    name: 'data',
    display_name: 'Text or binary data',
    sentence_form: 'text or binary data',
    short_desc: 'Text or binary data',
    desc: 'Text or binary data',
    // a value of a string format type is text
    types_accepted: [
      'string',
      'richtext',
      'binary',
      'data',
      'email',
      'uri',
      'uuid',
      'hostname',
      'ipv4',
      'ipv6',
      'phone',
    ],
    exact_match: ['string', 'richtext', 'binary', 'data'],
    offered: true,
  },
  {
    name: 'hash',
    display_name: 'Key-value pairs (hash)',
    sentence_form: 'key-value pairs (a hash)',
    short_desc: 'Key-value pairs (hash)',
    desc: 'Key-value pairs (a hash): each value is stored under a named key',
    // a file is a hash
    types_accepted: ['hash', 'file'],
    exact_match: ['hash'],
    offered: true,
  },
  {
    name: 'list',
    display_name: 'List',
    sentence_form: 'a list',
    short_desc: 'List',
    desc: 'List',
    types_accepted: ['list'],
    exact_match: ['list'],
    offered: true,
  },
  {
    name: 'rgbcolor',
    display_name: 'Color',
    sentence_form: 'a color',
    short_desc: 'A color: red, green and blue from 0 to 255 and an opacity from 0 to 1',
    desc: 'A color, stored as a hash: r, g and b are integers from 0 to 255, and a is the opacity, from 0 (transparent) to 1 (opaque); a missing or null a is opaque. A hex code such as #ff0000 is not a stored color.',
    types_accepted: ['rgbcolor'],
    exact_match: ['rgbcolor'],
    offered: true,
  },
  {
    name: 'workflow',
    display_name: 'Workflow',
    sentence_form: 'a workflow',
    short_desc: 'Qorus workflow',
    desc: 'Qorus workflow',
    types_accepted: ['workflow', 'string', 'richtext'],
    exact_match: ['workflow', 'string', 'richtext'],
    offered: true,
  },
  {
    name: 'service',
    display_name: 'Service',
    sentence_form: 'a service',
    short_desc: 'Qorus service',
    desc: 'Qorus service',
    types_accepted: ['service', 'string', 'richtext'],
    exact_match: ['service', 'string', 'richtext'],
    offered: true,
  },
  {
    name: 'job',
    display_name: 'Job',
    sentence_form: 'a job',
    short_desc: 'Qorus job',
    desc: 'Qorus job',
    types_accepted: ['job', 'string', 'richtext'],
    exact_match: ['job', 'string', 'richtext'],
    offered: true,
  },
  {
    name: 'mapper',
    display_name: 'Mapper',
    sentence_form: 'a mapper',
    short_desc: 'Qorus mapper',
    desc: 'Qorus mapper',
    types_accepted: ['mapper', 'string', 'richtext'],
    exact_match: ['mapper', 'string', 'richtext'],
    offered: true,
  },
  {
    name: 'data-provider',
    display_name: 'Data provider',
    sentence_form: 'a data provider',
    short_desc: 'Qorus data provider',
    desc: 'Qorus data provider',
    types_accepted: ['data-provider'],
    exact_match: ['data-provider'],
    offered: true,
  },
  {
    name: 'connection',
    display_name: 'Connection',
    sentence_form: 'a connection',
    short_desc: 'Qorus connection',
    desc: 'Qorus connection',
    types_accepted: ['connection', 'string', 'richtext'],
    exact_match: ['connection', 'string', 'richtext'],
    offered: true,
  },
  /* Not offered: a type the server gives a field or an option as its UI type, and so names and converts, but that a
     person choosing a type for a value does not choose - the DataProvider module's string format types, which are
     text, and its file type, which is a hash (qorus 974643455). */
  {
    name: 'richtext',
    display_name: 'Text',
    sentence_form: 'text',
    short_desc: 'Text that can hold templates',
    desc: 'Text that can hold templates',
    types_accepted: ['any'],
    exact_match: ['string', 'richtext'],
    offered: false,
  },
  {
    name: 'email',
    display_name: 'Email address',
    sentence_form: 'an email address',
    short_desc: 'An email address',
    desc: 'An email address, such as user@example.com',
    types_accepted: ['email', 'string', 'richtext'],
    exact_match: ['email', 'string', 'richtext'],
    offered: false,
  },
  {
    name: 'uri',
    display_name: 'Address (URI)',
    sentence_form: 'an address (a URI)',
    short_desc: 'An address that starts with its scheme (a URI)',
    desc: 'An address that starts with its scheme (a URI), such as https://example.com/',
    types_accepted: ['uri', 'string', 'richtext'],
    exact_match: ['uri', 'string', 'richtext'],
    offered: false,
  },
  {
    name: 'uuid',
    display_name: 'Unique identifier (UUID)',
    sentence_form: 'a unique identifier (a UUID)',
    short_desc: 'A universally unique identifier (a UUID)',
    desc: 'A universally unique identifier (a UUID): 32 hexadecimal digits in groups of 8, 4, 4, 4 and 12, such as 123e4567-e89b-12d3-a456-426614174000',
    types_accepted: ['uuid', 'string', 'richtext'],
    exact_match: ['uuid', 'string', 'richtext'],
    offered: false,
  },
  {
    name: 'hostname',
    display_name: 'Host name',
    sentence_form: 'a host name',
    short_desc: 'A host or domain name',
    desc: 'A host or domain name, such as example.com',
    types_accepted: ['hostname', 'string', 'richtext'],
    exact_match: ['hostname', 'string', 'richtext'],
    offered: false,
  },
  {
    name: 'ipv4',
    display_name: 'IPv4 address',
    sentence_form: 'an IPv4 address',
    short_desc: 'An IPv4 address',
    desc: 'An IPv4 address, such as 192.0.2.1',
    types_accepted: ['ipv4', 'string', 'richtext'],
    exact_match: ['ipv4', 'string', 'richtext'],
    offered: false,
  },
  {
    name: 'ipv6',
    display_name: 'IPv6 address',
    sentence_form: 'an IPv6 address',
    short_desc: 'An IPv6 address',
    desc: 'An IPv6 address, such as 2001:db8::1',
    types_accepted: ['ipv6', 'string', 'richtext'],
    exact_match: ['ipv6', 'string', 'richtext'],
    offered: false,
  },
  {
    name: 'phone',
    display_name: 'Phone number',
    sentence_form: 'a phone number',
    short_desc: 'A telephone number',
    desc: 'A telephone number, such as +1 555 0100',
    types_accepted: ['phone', 'string', 'richtext'],
    exact_match: ['phone', 'string', 'richtext'],
    offered: false,
  },
  {
    name: 'file',
    display_name: 'File',
    sentence_form: 'a file',
    short_desc: 'A file: its name, its content and its MIME type',
    desc: 'A file, stored as a hash: its name, its content (raw or base64-encoded) and its MIME type',
    types_accepted: ['file', 'hash'],
    exact_match: ['file', 'hash'],
    offered: false,
  },
];

/* The catalogue the server answered GET /system/qorus-type-info with, once a `useQorusTypes` has it. */
let serverQorusTypes: IQorusTypeObject[] | undefined;

/**
 * The type catalogue for code outside a component: the server's answer once a `useQorusTypes` has it, reqraft's
 * copy (`defaultQorusTypes`) until then. It gave reqraft's copy always, so a type or a conversion only the server
 * knows was never seen by the checks that decide which values and templates fit a field (qorus#646). A component
 * gives the checks `useQorusTypes().value` instead, so that it draws again when the answer comes.
 */
export const getQorusTypes = (): IQorusTypeObject[] => serverQorusTypes ?? defaultQorusTypes;

/**
 * The types a picker that lists every type offers: the ones the catalogue offers (`offered` is not false), and the
 * type a value already has (`held`), so that a value of a type that is not offered still shows what it is. In the
 * catalogue's order.
 */
export const offeredQorusTypes = (
  types: IQorusTypeObject[] | undefined,
  held?: string | string[]
): IQorusTypeObject[] => {
  const heldNames = ([] as string[])
    .concat(held ?? [])
    .map((name) => qorusTypeEntry(types, name)?.name);
  return (types ?? []).filter((type) => type.offered !== false || heldNames.includes(type.name));
};

/** Keeps the server's answer for `getQorusTypes`; `useQorusTypes` gives it each answer it has. */
export const setServerQorusTypes = (types: IQorusTypeObject[] | undefined): void => {
  serverQorusTypes = types?.length ? types : undefined;
};

/** Forgets the server's answer, so that a test or a story starts without one. */
export const _resetServerQorusTypesForTests = (): void => setServerQorusTypes(undefined);

/** Qore's other names for a type the catalogue lists under its own (qorus#646). */
const QORE_TYPE_ALIASES: Record<string, string> = { boolean: 'bool', integer: 'int' };

/**
 * A type's name as the catalogue lists it: Qore's other name for a type (`integer`, `boolean`) is the type it names
 * (`int`, `bool`). The server's catalogue knows each type by one name only, and says which it converts by that name.
 */
export const catalogueTypeName = (typeName: string): string =>
  QORE_TYPE_ALIASES[typeName] ?? typeName;

/**
 * The catalogue's entry for a type (the server's catalogue, or reqraft's copy until it answers).
 *
 * The catalogue lists each type once, by its own name, and the catalogue's own entry for a name always wins. A type
 * named another way is the type it is, as the server names it (qorus c6b3fb97c): `boolean` and `integer` are `bool`
 * and `int`; an optional type (`*string`) and a soft one (`softint`, a declaration that converts a value to its base
 * type) are their base type; a complex one (`hash<auto>`, `list<string>`) is its kind.
 *
 * A type the catalogue lists under none of those names is the type of its `baseType`: the base data type that
 * Qorus gives with every field, option and argument (`base_type`), so that a type the catalogue does not list (a
 * user type, a type of a newer server) is the kind of value it holds. Undefined where neither is listed.
 */
export const qorusTypeEntry = (
  types: IQorusTypeObject[] | undefined,
  typeName: string | undefined,
  baseType?: string
): IQorusTypeObject | undefined => {
  // a place with no type yet is named by nothing
  if (!typeName) {
    return undefined;
  }
  const listed = (name: string) => types?.find((type) => type.name === name);
  const named = (name: string) => {
    const base = name.replace(/^\*/, '').replace(/<.*$/, '');
    const unsoft = /^soft[a-z]/.test(base) ? base.slice(4) : base;
    return (
      listed(name) ??
      listed(base) ??
      listed(QORE_TYPE_ALIASES[base] ?? '') ??
      listed(unsoft) ??
      listed(QORE_TYPE_ALIASES[unsoft] ?? '')
    );
  };
  return named(typeName) ?? (baseType ? named(baseType) : undefined);
};

/** The name of a type no catalogue entry names: a user type by its path, anything else as unknown. */
export const UNKNOWN_TYPE_NAME = 'Unknown type';
const unlistedTypeName = (typeName: string): string =>
  typeName.includes('/') ? typeName : UNKNOWN_TYPE_NAME;

/**
 * What a type is called as a label ("Whole number"), by the type catalogue, or by its `baseType` where the
 * catalogue lists it under no name (see `qorusTypeEntry`). A type named by neither is never named by its code: a
 * user type is named by its path, anything else is "Unknown type" (qorus#646).
 *
 * No type (`undefined` or an empty name: a place whose type is not known yet) has no name: `undefined`, and the
 * caller draws or words its text without one (qorus#646).
 */
export const qorusTypeDisplayName = (
  types: IQorusTypeObject[] | undefined,
  typeName: string | undefined,
  baseType?: string
): string | undefined =>
  typeName ?
    (qorusTypeEntry(types, typeName, baseType)?.display_name ?? unlistedTypeName(typeName))
  : undefined;

/**
 * What a type is called inside a sentence ("a whole number": "The expression gives a whole number"), by the type
 * catalogue - its sentence form, which the server gives in the language it is asked for (qorus#646, c6b3fb97c).
 *
 * A catalogue with no sentence form for it (a server before c6b3fb97c) gives a wording that needs no article -
 * "a value of type Whole number" - with its display name. An English article is never built from a display name:
 * "a Exact number", "a Whole number" in a sentence of another language. A type named neither by the catalogue
 * nor by its `baseType` is "a value of type" its path where it is a user type, else "a value of an unknown type".
 *
 * No type (`undefined` or an empty name) has no sentence form: `undefined`, and the caller words its sentence
 * without a type ("This expression gives nothing", "Converted to a whole number") rather than "a value of type
 * undefined" (qorus#646).
 */
export const qorusTypeSentenceForm = (
  types: IQorusTypeObject[] | undefined,
  typeName: string | undefined,
  baseType?: string
): string | undefined => {
  if (!typeName) {
    return undefined;
  }
  const entry = qorusTypeEntry(types, typeName, baseType);
  if (entry) {
    return entry.sentence_form || `a value of type ${entry.display_name}`;
  }
  return typeName.includes('/') ? `a value of type ${typeName}` : 'a value of an unknown type';
};

/** What a type is called inside a sentence ("a whole number"), by a catalogue: `useQorusTypes().getTypeSentenceForm`. */
export type TTypeSentenceForm = (
  typeName: string | undefined,
  baseType?: string
) => string | undefined;

/** The built-in catalogue's sentence form of a type, for a surface no form has given the server's catalogue to. */
export const builtInTypeSentenceForm: TTypeSentenceForm = (typeName, baseType) =>
  qorusTypeSentenceForm(defaultQorusTypes, typeName, baseType);

/**
 * A type's name as a label - its display name ("Whole number") - only where the catalogue lists it, else
 * undefined: a type it does not list is not named by its code (`<string>`), which is no word for a reader
 * (qorus#646, IDE rule: no raw data).
 */
export const qorusTypeKnownName = (
  types: IQorusTypeObject[] | undefined,
  typeName: string | undefined,
  baseType?: string
): string | undefined => qorusTypeEntry(types, typeName, baseType)?.display_name || undefined;

/** A type's name as a label where the catalogue lists it, by a catalogue (`qorusTypeKnownName`). */
export type TTypeName = (typeName: string | undefined, baseType?: string) => string | undefined;

/** The built-in catalogue's name for a type, for a surface no form has given the server's catalogue to. */
export const builtInTypeName: TTypeName = (typeName, baseType) =>
  qorusTypeKnownName(defaultQorusTypes, typeName, baseType);

/**
 * A type's name as a label that is never its code (`qorusTypeDisplayName`): what a list of templates badges a
 * template with - a user type with no base type by its path, any other unknown type "Unknown type".
 */
export type TTypeLabel = (typeName: string | undefined, baseType?: string) => string | undefined;

/** The built-in catalogue's label for a type, for a list no form has given the server's catalogue to. */
export const builtInTypeLabel: TTypeLabel = (typeName, baseType) =>
  qorusTypeDisplayName(defaultQorusTypes, typeName, baseType);

/**
 * What kind of value an option takes, in words: its kind of control's name where the catalogue names it (a
 * color), else its type's ("Whole number"), with what a list holds after it ("List (Text)"). Undefined where the
 * catalogue names neither: nothing is said rather than the type's code.
 */
export const optionTypeWords = (
  schema:
    | {
        type?: unknown;
        ui_type?: unknown;
        ui_element_type?: unknown;
        base_type?: unknown;
        element_base_type?: unknown;
      }
    | undefined,
  typeName: TTypeName
): string | undefined => {
  const baseType = typeof schema?.base_type === 'string' ? schema.base_type : undefined;
  const elementBaseType =
    typeof schema?.element_base_type === 'string' ? schema.element_base_type : undefined;
  const named = (type: unknown, base?: string) =>
    typeof type === 'string' ? typeName(type, base) : undefined;
  // a type no catalogue entry names is the kind of value its base type is; a list's elements, theirs
  const kind = named(schema?.ui_type) ?? named(schema?.type, baseType);
  const element = named(schema?.ui_element_type, elementBaseType);
  return kind && element ? `${kind} (${element})` : kind;
};

/**
 * What kind of value an option takes, inside a sentence ("a whole number": "Takes a whole number."), by its kind of
 * control where the catalogue names it, else by its type. Undefined where the catalogue names neither.
 */
export const optionTypeSentence = (
  schema: { type?: unknown; ui_type?: unknown; base_type?: unknown } | undefined,
  typeName: TTypeName,
  typeSentenceForm: TTypeSentenceForm
): string | undefined => {
  const baseType = typeof schema?.base_type === 'string' ? schema.base_type : undefined;
  if (typeof schema?.ui_type === 'string' && typeName(schema.ui_type)) {
    return typeSentenceForm(schema.ui_type);
  }
  return typeof schema?.type === 'string' && typeName(schema.type, baseType) ?
      typeSentenceForm(schema.type, baseType)
    : undefined;
};

/**
 * Whether a place of type `typeName` (its base type `baseType`) takes a record whole - a hash, a Qog state's data:
 * where the catalogue lists it as a hash, or as taking a hash in its own right (qorus#646, David's review: "Any or
 * hash yes, scalar no"). Text, which converts any value, is not a place for a record; a place of any type is
 * judged by its caller (`isUntypedOptionType`), as the catalogue names no such type.
 */
export const qorusTypeTakesRecords = (
  types: IQorusTypeObject[] | undefined,
  typeName: string | undefined,
  baseType?: string
): boolean => {
  const entry = qorusTypeEntry(types?.length ? types : defaultQorusTypes, typeName, baseType);
  return !!entry && (entry.exact_match?.includes('hash') || entry.types_accepted?.includes('hash'));
};
