// Copyright 2026 Qore Technologies, s.r.o.
import { getQorusTypes, IQorusTypeObject } from '../../../hooks/useQorusTypes';
import { qorusTypeEntry } from '../../../helpers/qorusTypeCatalogue';
import { IExpression, IExpressionSchemaArg } from './types';

/** The schema types with exactly one control (a rich-text editor, a number field, a yes/no switch): an argument of
 *  one of them is that control whatever it holds. */
const TYPES_WITH_ONE_CONTROL = ['richtext', 'number', 'bool'];

const singleControlType = (uiType: unknown): string | undefined =>
  TYPES_WITH_ONE_CONTROL.includes(uiType as string) ? (uiType as string) : undefined;

/** The type a plain value is, by what it holds: a value saved without its type is drawn as what it is. */
export const typeOfValue = (value: unknown): string | undefined => {
  if (typeof value === 'boolean') {
    return 'bool';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'float';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  if (Array.isArray(value)) {
    return 'list';
  }
  if (value !== null && typeof value === 'object') {
    return 'hash';
  }
  return undefined;
};

/** Whether a date written `YYYY-MM-DD` names a day that exists: 2026-02-30 does not. */
const isRealDay = (text: string): boolean => {
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})/.exec(text) ?? [];
  if (!year) {
    return false;
  }
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day)
  );
};

/** A time of day, `HH:MM[:SS[.ffffff]]`, optionally with its offset, within a day's range. */
const isTimeOfDay = (text: string): boolean => {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[3] ?? 0) < 60;
};

/**
 * Whether text is base64 data as Qorus writes binary data: the standard alphabet, padded to whole groups of four,
 * and written exactly as its bytes encode again. URL-safe or unpadded base64 is not what Qorus reads as binary data.
 */
const isBase64 = (text: string): boolean => {
  if (!text || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
    return false;
  }
  try {
    return btoa(atob(text)) === text;
  } catch {
    return false;
  }
};

/** Schema types whose values are saved as text, with what text is a value of each. */
const TYPES_SAVED_AS_TEXT: Record<string, (text: string) => boolean> = {
  date: (text) =>
    /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(text) &&
    !Number.isNaN(Date.parse(text)) &&
    isRealDay(text),
  time: isTimeOfDay,
  binary: isBase64,
};

/**
 * The type a value saved without one is read as, in an argument of this schema:
 * - in an argument of any type, the value's own type;
 * - a value the schema takes as itself (its `exact_match`), the schema's control: a number in a number argument,
 *   text in a rich-text one, true or false in a yes/no switch (only a real true or false is the switch);
 * - text in an argument whose values are saved as text (a date, a time, binary data), the schema type when the text
 *   is one;
 * - else the value's own type, which the schema may not take: "abc" in a whole-number argument is text, and is said.
 */
export const typeOfSavedValue = (
  value: unknown,
  schema: IExpressionSchemaArg | undefined,
  types: IQorusTypeObject[] = getQorusTypes()
): string | undefined => {
  const schemaType = schema?.ui_type;
  const own = typeOfValue(value);
  if (!schemaType || schemaType === 'any' || schemaType === 'auto') {
    return own;
  }
  if (!own) {
    return schemaType;
  }
  if (qorusTypeEntry(types, schemaType, schema?.base_type)?.exact_match?.includes(own)) {
    return singleControlType(schemaType) ?? own;
  }
  if (own === 'string' && TYPES_SAVED_AS_TEXT[schemaType]?.(value as string)) {
    return schemaType;
  }
  return own;
};

/** The signature types of an argument that holds a whole number (`int`, `softint`, `*int`). */
const WHOLE_NUMBER_SIGNATURE_TYPES = new Set(['int', 'softint', 'integer']);

/**
 * Whether the value given an argument that holds a whole number has a fraction, which Qorus drops when it converts
 * the value. Not a mismatch (the type catalogue has an int take a float) but worth saying: `2.5` is passed on as `2`.
 * Only a value written as a number is judged; an expression's result is known only when it runs.
 */
export const argumentDropsFraction = (
  arg: IExpression | undefined,
  schema: IExpressionSchemaArg | undefined
): boolean => {
  if (!schema || !arg || arg.is_expression) {
    return false;
  }
  const signature = String(schema.name ?? '').replace(/^\*/, '');
  const wholeNumber = WHOLE_NUMBER_SIGNATURE_TYPES.has(signature) || schema.ui_type === 'int';
  return (
    wholeNumber &&
    typeof arg.value === 'number' &&
    Number.isFinite(arg.value) &&
    !Number.isInteger(arg.value)
  );
};

/** Whether an argument's signature type is soft (`softint`, `*softstring`): it converts what it is given. */
export const isSoftArgument = (schema: IExpressionSchemaArg | undefined): boolean =>
  /^soft[a-z]/.test(String(schema?.name ?? '').replace(/^\*/, ''));

/** The types a soft argument converts its value from: numbers, true or false, dates and text of every kind. */
export const SOFT_CONVERTED_TYPES = ['number', 'bool', 'date', 'data'];
