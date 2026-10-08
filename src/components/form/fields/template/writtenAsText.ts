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
import {
  findTemplate,
  isCompleteTemplateToken,
  isValueTemplate,
  TEMPLATE_TOKEN_SOURCE,
} from '../../../../helpers/templates';

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

/**
 * Whether a form option of this type is written as text on its Value tab - a text field taking templates as
 * chips and detecting expressions - rather than on its own control (qorus#646, David): text, untyped values,
 * whole numbers and numbers. A yes / no, a date and fixed choices keep their own control.
 */
export const isWrittenAsTextOnTheValueTab = (type?: string): boolean =>
  type === 'string' ||
  isUntypedOptionType(type) ||
  (!!type && (TEXTABLE_SCALARS[type] === 'int' || TEXTABLE_SCALARS[type] === 'number'));

/** The tabs a field's value is entered on (see `valueTabsOf`). */
export type TValueTab = 'value' | 'expression' | 'visual' | 'template';

/**
 * The text a value shows as on the Value tab: text as it is, a number or a yes/no as written, null as
 * `null` (in an untyped field), nothing for no value.
 */
export const valueTextOf = (value: unknown, type?: string): string => {
  if (value === undefined) return '';
  if (value === null) return isUntypedOptionType(type) ? NULL_TEXT : '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * A value written as an expression's text: a literal as DPQL writes it (`12`, `true`, `"open"`), a template
 * as itself, text with templates as the text and the templates joined (`concat("SUP-", $record:{pos})`).
 * The Expression tab opens on this for a value that is not an expression yet.
 */
export const expressionTextOfValue = (value: unknown): string => {
  if (value === undefined || value === null) return value === null ? 'null' : '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return '';
  const text = String(value);
  // nothing written is nothing to write: not an empty concat()
  if (text === '') return '';
  if (isCompleteTemplateToken(text)) return String(text);
  const plain: string = text;
  const parts = plain.split(new RegExp(`(${TEMPLATE_TOKEN_SOURCE})`)).filter((part) => part !== '');
  if (parts.length === 1) return JSON.stringify(plain);
  return `concat(${parts.map((part) => (isCompleteTemplateToken(part) ? part : JSON.stringify(part))).join(', ')})`;
};

/**
 * A lone template written in the expression editor's Text view, as the server parses it: the `template`
 * operation with the reference as its one argument. It is stored as the bare template, which every consumer
 * evaluates; the expression form of it is not one the server reads back as the template's value.
 */
export const loneTemplateOf = (expression: unknown): string | undefined => {
  const node = (expression as { value?: { exp?: string; args?: unknown[] } } | undefined)?.value;
  if (node?.exp !== 'template' || node.args?.length !== 1) return undefined;
  const arg = node.args[0] as { value?: { raw?: unknown } | string } | undefined;
  const raw = typeof arg?.value === 'string' ? arg.value : arg?.value?.raw;
  return typeof raw === 'string' && isCompleteTemplateToken(raw) ? raw : undefined;
};

/**
 * A lone value written in the expression editor's Text view (`12`, `true`, `"open"`), as the server parses
 * it: the `value` operation with a plain value as its one argument. It is stored as that value - the field's
 * own shape - rather than as an expression the Visual view has nothing to show for. A record field is not
 * such a value: it is read from the row.
 */
export const loneValueOf = (expression: unknown): { value: unknown } | undefined => {
  const node = (expression as { value?: { exp?: string; args?: unknown[] } } | undefined)?.value;
  if (node?.exp !== 'value' || node.args?.length !== 1) return undefined;
  const arg = node.args[0] as { value?: unknown; is_expression?: boolean } | undefined;
  const value = arg?.value;
  if (!arg || arg.is_expression || (value !== null && typeof value === 'object')) return undefined;
  if (typeof value === 'string' && isValueTemplate(value)) return undefined;
  return { value };
};

/** The text a value is seeded into the Text view as: a template, a number or a yes/no as written. */
export const expressionSeedOf = (value: unknown): string => {
  if (typeof value === 'string') return isCompleteTemplateToken(value) ? value : '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

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

/** The kind of value a type holds, for telling whether a template and a field hold the same kind. */
const valueKindOf = (type?: string): string | undefined => {
  if (!type) return undefined;
  const t = type.replace(/^\*/, '').replace(/^soft/, '');
  if (TEXTABLE_SCALARS[t]) return TEXTABLE_SCALARS[t];
  if (t === 'string' || t === 'date' || t === 'list' || t === 'hash' || t === 'binary') return t;
  return undefined;
};

/** Whether a template of this type is a value of the field's type as it is, with nothing to convert. */
export const sameValueType = (templateType: string, fieldType?: string): boolean => {
  const a = valueKindOf(templateType);
  const b = valueKindOf(fieldType);
  // a whole number is a number too
  return !a || !b || a === b || (a === 'int' && b === 'number');
};

/** A type in words: "a whole number", "text". */
export const templateTypeName = (type?: string): string => {
  switch (valueKindOf(type)) {
    case 'int':
      return 'A whole number';
    case 'number':
      return 'A number';
    case 'bool':
      return 'A yes / no value';
    case 'string':
      return 'Text';
    case 'date':
      return 'A date';
    default:
      return type ?? 'A value';
  }
};
