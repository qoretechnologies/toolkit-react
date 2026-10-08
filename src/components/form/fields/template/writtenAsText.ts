// Copyright 2026 Qore Technologies, s.r.o.
// What a field holds for the text written in its template editor.
//
// A field that takes templates and custom values shows ONE editor for both: a text
// field where a chosen template is a chip, with text typed around it (qorus#646). The
// field's value is read from that text:
//
// - a template standing alone is that template - in an untyped field, of the
//   template's own type (a whole-number field of the record makes the value a whole
//   number);
// - a literal of a scalar field's type (`12` in a whole-number field, `true` in a
//   yes/no one) is that literal;
// - null in an untyped field is written `null` (an empty field holds no value at all);
// - anything else is text: an untyped field's value becomes text, a typed field holds
//   what was written and says it does not fit (an expression in it is detected and
//   offered, or switched to, by the field's DPQL detection).
//
// Deleting the text around a template makes it a lone template again, and the value
// takes the template's type again. Pure: no React, no transport.
import { IReqoreFormTemplates } from '@qoretechnologies/reqore/dist/components/Textarea';
import { isUntypedOptionType } from '../../../../helpers/optionUiTypes';
import { findTemplate, isCompleteTemplateToken } from '../../../../helpers/templates';

/** Scalar types whose value can be written as text: whole numbers, numbers, yes/no. Not a date, which has
 *  its own control. */
const TEXTABLE_SCALARS: Record<string, 'int' | 'number' | 'bool'> = {
  int: 'int',
  integer: 'int',
  softint: 'int',
  number: 'number',
  float: 'number',
  softfloat: 'number',
  softnumber: 'number',
  bool: 'bool',
  boolean: 'bool',
  softbool: 'bool',
};

/** Whether a field of this type is written in the template editor: text, untyped, or a textable scalar. */
export const isWrittenAsText = (type?: string): boolean =>
  type === 'string' || isUntypedOptionType(type) || (!!type && type in TEXTABLE_SCALARS);

const INT_LITERAL = /^\s*[-+]?\d+\s*$/;
const NUMBER_LITERAL = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?\s*$/i;
const BOOL_LITERAL = /^\s*(true|false)\s*$/i;

/** The literal `text` writes in a scalar type, or `undefined` when it writes none. */
export const scalarLiteral = (text: string, type?: string): number | boolean | undefined => {
  switch (type ? TEXTABLE_SCALARS[type] : undefined) {
    case 'int':
      return INT_LITERAL.test(text) ? Number.parseInt(text, 10) : undefined;
    case 'number':
      return NUMBER_LITERAL.test(text) ? Number.parseFloat(text) : undefined;
    case 'bool': {
      const match = BOOL_LITERAL.exec(text);
      return match ? match[1].toLowerCase() === 'true' : undefined;
    }
    default:
      return undefined;
  }
};

/** How null is written in an untyped field: the word, so it is not taken for an empty field. */
export const NULL_TEXT = 'null';

/** The text an untyped field shows for its value: `null` for null; for anything else, the text it is. */
export const untypedTextOf = (value: unknown, type?: string): string | undefined =>
  value === null && isUntypedOptionType(type) ? NULL_TEXT : undefined;

export interface ITemplateTextValue {
  value: unknown;
  /** the value's type: the field's own, or for an untyped field the type the text gives it */
  type?: string;
}

/** What the field holds for `text`, written in its template editor. See the top of this file. */
export const templateTextValue = (
  text: string,
  type: string | undefined,
  templates?: IReqoreFormTemplates
): ITemplateTextValue => {
  const trimmed = text.trim();
  if (isCompleteTemplateToken(trimmed)) {
    if (isUntypedOptionType(type)) {
      const badge = templates ? findTemplate(templates, trimmed)?.badge : undefined;
      return { value: trimmed, type: typeof badge === 'string' && badge ? badge : type };
    }
    return { value: trimmed, type };
  }
  // null, the literal that says "no value", is a value of an untyped field: written `null`, it is null
  if (isUntypedOptionType(type) && trimmed === NULL_TEXT) {
    return { value: null, type };
  }
  const literal = scalarLiteral(text, type);
  if (literal !== undefined) {
    return { value: literal, type };
  }
  return { value: text, type: isUntypedOptionType(type) ? 'string' : type };
};
