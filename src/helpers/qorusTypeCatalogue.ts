// Copyright 2026 Qore Technologies, s.r.o.
// The Qorus server's type catalogue as reqraft keeps it: what each type is called as a label (its
// display name) and inside a sentence (its sentence form). No React here: the form's validation names types too,
// and the hook (`useQorusTypes`) that answers with the server's catalogue builds on it.
import { IReqraftLabels, reqraftLabels } from './reqraftLabels';
import { defaultQorusTypes, IQorusTypeObject } from './qorusTypeData';

export type { IQorusTypeObject } from './qorusTypeData';

/* The built-in catalogue in the host's words, and the words it was worded with: worded again when they change. */
let wordedWith: IReqraftLabels | undefined;
let worded: IQorusTypeObject[] = defaultQorusTypes;

/**
 * reqraft's copy of the server's catalogue (`defaultQorusTypes`) in the host's words (`setReqraftLabels`,
 * `qorusTypes`): each type's names and descriptions as the host gives them, English where it gives none. What
 * names types until the server answers, and where no form has the server's catalogue. The server's own answer is
 * in the language it was asked for, and is used as it comes.
 */
export const builtInQorusTypes = (): IQorusTypeObject[] => {
  const labels = reqraftLabels();
  if (labels !== wordedWith) {
    wordedWith = labels;
    const words = labels.qorusTypes;
    const wordedTypes = defaultQorusTypes.map((type) => ({
      ...type,
      display_name: words.names[type.name] ?? type.display_name,
      sentence_form: words.sentenceForms[type.name] ?? type.sentence_form,
      short_desc: words.shortDescriptions[type.name] ?? type.short_desc,
      desc: words.descriptions[type.name] ?? type.desc,
    }));
    // in English it is the copy itself, as it always was
    const same = wordedTypes.every(
      (type, index) =>
        type.display_name === defaultQorusTypes[index].display_name &&
        type.sentence_form === defaultQorusTypes[index].sentence_form &&
        type.short_desc === defaultQorusTypes[index].short_desc &&
        type.desc === defaultQorusTypes[index].desc
    );
    worded = same ? defaultQorusTypes : wordedTypes;
  }
  return worded;
};

/**
 * The types a value's own type menu offers ("Set custom value"), in the order it lists them: text first. The menu
 * follows this order, not the catalogue's, so the server moving a type in its catalogue does not move it in the menu
 * (richtext, which follows the Qorus object types in the catalogue since qorus ed0f9ba62).
 */
export const compactTypesList = ['richtext', 'float', 'bool', 'date', 'binary', 'hash', 'list'];

/** The types `compactTypesList` names, in its order, as the catalogue describes them; one it lacks is left out. */
export const compactQorusTypes = (types: IQorusTypeObject[] | undefined): IQorusTypeObject[] =>
  compactTypesList.flatMap((name) => types?.find((type) => type.name === name) ?? []);

export { defaultQorusTypes } from './qorusTypeData';

/* The catalogue the server answered GET /system/qorus-type-info with, once a `useQorusTypes` has it. */
let serverQorusTypes: IQorusTypeObject[] | undefined;

/**
 * The type catalogue for code outside a component: the server's answer once a `useQorusTypes` has it, reqraft's
 * copy (`defaultQorusTypes`) until then. It gave reqraft's copy always, so a type or a conversion only the server
 * knows was never seen by the checks that decide which values and templates fit a field. A component
 * gives the checks `useQorusTypes().value` instead, so that it draws again when the answer comes.
 */
export const getQorusTypes = (): IQorusTypeObject[] => serverQorusTypes ?? builtInQorusTypes();

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

/** Qore's other names for a type the catalogue lists under its own. */
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

/**
 * The English name of a type no catalogue entry names.
 * @deprecated A type no catalogue names is called in the host's words: `reqraftLabels().qorusTypes.unknownType`.
 */
export const UNKNOWN_TYPE_NAME = 'Unknown type';
/** The name of a type no catalogue entry names: a user type by its path, anything else as unknown. */
const unlistedTypeName = (typeName: string): string =>
  typeName.includes('/') ? typeName : reqraftLabels().qorusTypes.unknownType;

/**
 * What a type is called as a label ("Whole number"), by the type catalogue, or by its `baseType` where the
 * catalogue lists it under no name (see `qorusTypeEntry`). A type named by neither is never named by its code: a
 * user type is named by its path, anything else is "Unknown type".
 *
 * No type (`undefined` or an empty name: a place whose type is not known yet) has no name: `undefined`, and the
 * caller draws or words its text without one.
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
 * catalogue - its sentence form, which the server gives in the language it is asked for (Qorus c6b3fb97c).
 *
 * A catalogue with no sentence form for it (a server before c6b3fb97c) gives a wording that needs no article -
 * "a value of type Whole number" - with its display name. An English article is never built from a display name:
 * "a Exact number", "a Whole number" in a sentence of another language. A type named neither by the catalogue
 * nor by its `baseType` is "a value of type" its path where it is a user type, else "a value of an unknown type".
 *
 * No type (`undefined` or an empty name) has no sentence form: `undefined`, and the caller words its sentence
 * without a type ("This expression gives nothing", "Converted to a whole number") rather than "a value of type
 * undefined".
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
  const words = reqraftLabels().qorusTypes;
  if (entry) {
    return entry.sentence_form || words.valueOfType(entry.display_name);
  }
  return typeName.includes('/') ? words.valueOfType(typeName) : words.valueOfAnUnknownType;
};

/** The types that are text. */
const TEXT_TYPE_NAMES = ['string', 'richtext'];

/** The kinds of text the server names by their own types: each is text, and a place that takes text takes it. */
const TEXT_FORMAT_TYPE_NAMES = ['email', 'uri', 'uuid', 'hostname', 'ipv4', 'ipv6', 'phone'];

/** A type's name without the optional mark or `soft`. */
const baseTypeName = (name: string | undefined): string =>
  (name ?? '').replace(/^\*/, '').replace(/^soft(?=[a-z])/, '');

/**
 * The types a place takes, named inside a sentence: each name said once. Several types are one name: a soft or optional
 * type is its base type (`softint`, `*int`: "a whole number"), and two types can share a sentence form (`string` and
 * `richtext`: "text"). Undefined where none has one.
 */
export const typesInASentence = (
  typeNames: (string | undefined)[],
  sentenceForm: (typeName: string | undefined) => string | undefined
): string | undefined => {
  // text of a kind (an email address, a URI, a phone number) is text: a place that takes text says "text" once
  const takesText = typeNames.some((name) => TEXT_TYPE_NAMES.includes(baseTypeName(name)));
  const forms = Array.from(
    new Set(
      typeNames
        .filter((name) => !(takesText && TEXT_FORMAT_TYPE_NAMES.includes(baseTypeName(name))))
        .map(sentenceForm)
        .filter((form): form is string => !!form)
    )
  );
  return forms.length ? reqraftLabels().formEngine.typesJoin(forms) : undefined;
};

/** What a type is called inside a sentence ("a whole number"), by a catalogue: `useQorusTypes().getTypeSentenceForm`. */
export type TTypeSentenceForm = (
  typeName: string | undefined,
  baseType?: string
) => string | undefined;

/** The built-in catalogue's sentence form of a type, for a surface no form has given the server's catalogue to. */
export const builtInTypeSentenceForm: TTypeSentenceForm = (typeName, baseType) =>
  qorusTypeSentenceForm(builtInQorusTypes(), typeName, baseType);

/**
 * A type's name as a label - its display name ("Whole number") - only where the catalogue lists it, else
 * undefined: a type it does not list is not named by its code (`<string>`), which is no word for a reader
 * (a reader is never shown raw data).
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
  qorusTypeKnownName(builtInQorusTypes(), typeName, baseType);

/**
 * A type's name as a label that is never its code (`qorusTypeDisplayName`): what a list of templates badges a
 * template with - a user type with no base type by its path, any other unknown type "Unknown type".
 */
export type TTypeLabel = (typeName: string | undefined, baseType?: string) => string | undefined;

/** The built-in catalogue's label for a type, for a list no form has given the server's catalogue to. */
export const builtInTypeLabel: TTypeLabel = (typeName, baseType) =>
  qorusTypeDisplayName(builtInQorusTypes(), typeName, baseType);

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
 * where the catalogue lists it as a hash, or as taking a hash in its own right: any or
 * hash yes, scalar no. Text, which converts any value, is not a place for a record; a place of any type is
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
