// Copyright 2026 Qore Technologies, s.r.o.
import { defaultQorusTypes, IQorusTypeObject } from './qorusTypeData';

/**
 * The words of the built-in type catalogue, reqraft's copy of the server's (`defaultQorusTypes`), which names types
 * until the server answers and wherever no form has the server's catalogue. The server gives its own catalogue in
 * the language it is asked for; these are the same words for the copy, by type name, and what a type no catalogue
 * names is called.
 */
export interface IQorusTypeLabels {
  /** What a type is called as a label where no catalogue names it ("Unknown type"). */
  unknownType: string;
  /** A type inside a sentence where its catalogue gives no sentence form: `name` is its label or its path. */
  valueOfType: (name: string) => string;
  /** A type inside a sentence where no catalogue names it. */
  valueOfAnUnknownType: string;
  /** Each built-in type's name as a label ("Whole number"), by its type name (`int`). */
  names: Record<string, string>;
  /** Each built-in type's name inside a sentence ("a whole number"). */
  sentenceForms: Record<string, string>;
  /** Each built-in type's description in a line. */
  shortDescriptions: Record<string, string>;
  /** Each built-in type's description. */
  descriptions: Record<string, string>;
}

/** One field of every built-in type, by its type name: the English the labels start from. */
const byTypeName = (field: keyof IQorusTypeObject): Record<string, string> =>
  Object.fromEntries(
    defaultQorusTypes.flatMap((type) =>
      typeof type[field] === 'string' && type[field] ? [[type.name, type[field] as string]] : []
    )
  );

/** The English words: the built-in catalogue's own. */
export const DEFAULT_QORUS_TYPE_LABELS: IQorusTypeLabels = {
  unknownType: 'Unknown type',
  valueOfType: (name) => `a value of type ${name}`,
  valueOfAnUnknownType: 'a value of an unknown type',
  names: byTypeName('display_name'),
  sentenceForms: byTypeName('sentence_form'),
  shortDescriptions: byTypeName('short_desc'),
  descriptions: byTypeName('desc'),
};
