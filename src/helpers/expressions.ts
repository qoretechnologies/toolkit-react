// Copyright 2026 Qore Technologies, s.r.o.
// Expression / type-compatibility helpers — ported verbatim from qorus-ide
// (`src/helpers/expressions.ts` + `areQorusTypesCompatible` from
// `src/helpers/functions.tsx`), import paths adapted to reqraft. Used by the
// ported ExpressionBuilder.
import { isArray } from 'lodash';
import {
  IExpression,
  IExpressionSchema,
  IExpressionSchemaArg,
} from '../components/form/expressions/types';
import { defaultQorusTypes, getQorusTypes, IQorusTypeObject } from '../hooks/useQorusTypes';

export const getArgumentType = (
  expressions: IExpressionSchema[],
  arg?: IExpression,
  schema?: IExpressionSchemaArg
) => {
  if (arg?.is_expression) {
    return expressions?.find(
      (exp) => exp.name === (arg.value as { exp?: string })?.exp
    )?.ui_return_type;
  }

  return arg?.type || schema?.ui_type;
};

export const argumentMatchesType = (
  expressions: IExpressionSchema[],
  arg: IExpression | undefined,
  schema: IExpressionSchemaArg
) => {
  const types = getQorusTypes();
  const acceptedTypes = types.find((type) => type.name === schema.ui_type);
  const argType = getArgumentType(expressions, arg, schema);

  if (!acceptedTypes) {
    return true;
  }

  return (
    argType === 'any' ||
    !!acceptedTypes.exact_match?.includes(argType as string) ||
    acceptedTypes.types_accepted.includes('any') ||
    acceptedTypes.types_accepted.includes(getArgumentType(expressions, arg, schema) as string)
  );
};

/**
 * `auto` is the codebase's other spelling of `any` — `Field.tsx` maps both to
 * one renderer, and FormEngine tests `type === 'any' || type === 'auto'` in
 * several places — but the TYPES LIST only carries `any`.
 *
 * That mattered here because an unknown main type falls into the "not found"
 * branch below and answers FALSE for every check. So an `auto`-typed field was
 * judged incompatible with everything: `filterTemplatesByType()` removed every
 * template from it, and the picker offered a group header with nothing under
 * it. The field was not "a field with no templates" — it was a field whose
 * templates had all been filtered away by a name mismatch.
 */
const normalizeAnyLikeTypeName = (name: string): string => (name === 'auto' ? 'any' : name);

export const areQorusTypesCompatible = (
  mainType: string | string[],
  checkType: string | string[],
  fallbackTypes?: IQorusTypeObject[]
): boolean => {
  const types = getQorusTypes() || fallbackTypes || defaultQorusTypes;
  const mainTypes = (isArray(mainType) ? mainType : [mainType]).map(normalizeAnyLikeTypeName);
  const checkTypes = (isArray(checkType) ? checkType : [checkType]).map(normalizeAnyLikeTypeName);
  // Get each of the main types from the types list
  for (const main of mainTypes) {
    // Get the type object from the types
    const mainTypeObject = types.find((type) => type.name === main);
    // If the main object does not exist
    if (!mainTypeObject) {
      return false;
    }
    // If the main type includes "any" it's automatically compatible
    if (mainTypeObject.exact_match?.includes('any')) {
      return true;
    }
    // Check if any of the check types are in the main types accepted types
    for (const check of checkTypes) {
      if (mainTypeObject.exact_match?.includes(check)) {
        return true;
      }
    }
    // If the main type includes "any" it's automatically compatible
    if (mainTypeObject.types_accepted.includes('any')) {
      return true;
    }
    // Check if any of the check types are in the main types accepted types
    for (const check of checkTypes) {
      if (mainTypeObject.types_accepted.includes(check)) {
        return true;
      }
    }
  }
  // If none of the types are compatible return false
  return false;
};

/**
 * Whether a type is text, a date or a time: what a condition cannot be. A condition is evaluated by its
 * truthiness, so a number (0 or not), a list or hash (empty or not), binary data and an untyped result
 * all decide it; text, dates and times do not say plainly what is meant, and are compared explicitly
 * instead (`@status == "open"`, `@note != ""`). The Qorus server applies the same rule.
 */
export const isTextOrDateType = (type: string): boolean =>
  /^(string|richtext|date|time)$/.test(type.replace(/^\*/, '').replace(/^soft/, ''));

/**
 * Whether a place takes a condition: its result must be true or false (`bool`, optional or soft, or a list of
 * only that).
 */
export const isConditionType = (returnType: string | string[] | undefined): boolean => {
  const types = isArray(returnType) ? returnType : returnType ? [returnType] : [];
  return types.length > 0 && types.every((type) => /^\*?(soft)?(bool|boolean)$/.test(type));
};

/**
 * What an editor says of a condition that gives this type (qorus#646): nothing for true or false or a type it
 * cannot tell (`any`, `auto`); an error for text, a date or a time, which do not say plainly what is meant;
 * and a warning for any other (a number, a list, a hash), which the condition reads as true unless it is
 * zero or empty - accepted, as the Qorus server accepts it, but said, because it is seldom what was meant.
 * qorus-ide says the same of its own condition editors.
 */
export const conditionVerdict = (type: string | undefined): 'error' | 'warning' | undefined => {
  if (!type) {
    return undefined;
  }
  const base = type.replace(/^\*/, '').replace(/^soft/, '').replace(/<.*$/, '');
  if (!base || /^(bool|boolean|any|auto)$/.test(base)) {
    return undefined;
  }
  return isTextOrDateType(base) ? 'error' : 'warning';
};

/**
 * Whether a field is a condition: its schema's `metadata.condition`, the mark a host sets on the options that
 * are conditions (a Qog transition's value, a built-in if's value, a while or for block's condition). The
 * schema's own `type` cannot say it: a value of type bool is not a condition.
 */
export const isConditionOption = (field: { metadata?: Record<string, unknown> } | undefined): boolean =>
  field?.metadata?.condition === true;

/** What is said of a condition that gives text, a date or a time: how to make it one. */
export const conditionErrorText = (typeName: string): string =>
  `A condition can't give ${typeName}: compare it explicitly, for example @status == "open" or @note != "".`;

/** What is said of a condition that gives a number, a list or a hash. */
export const CONDITION_BY_TRUTHINESS_TEXT =
  "This condition is true whenever its value isn't zero or empty. To say what you mean, compare it explicitly.";

/** The operators whose every part is read as true or false by its value: AND, OR and NOT. */
export const LOGICAL_OPERATORS = ['&&', '||', '!'] as const;

/** Whether an expression is an AND, an OR or a NOT. */
export const isLogicalOperation = (expression: IExpression | undefined): boolean =>
  !!expression?.is_expression &&
  (LOGICAL_OPERATORS as readonly string[]).includes(expression.value?.exp);

/** How the server reads a part of a condition (`dpql/parse` with `condition: true`, qorus#646). */
export type TConditionReading = 'condition' | 'truthiness' | 'not_a_condition' | 'unknown';

/** A part of an AND, an OR or a NOT in a condition: the type it gives and how it is read. */
export interface IConditionPart {
  type: string;
  reading: TConditionReading;
  /** What the server says of it, in its words, when it says anything. */
  message?: string;
}

/**
 * The parts the server judged, each with what it said of it.
 *
 * The server says it in the diagnostics (NOT_A_CONDITION, CONDITION_BY_TRUTHINESS), in the order it judged:
 * the whole expression first, then its parts - one for each that is not true or false, all over the whole
 * text. The whole's own reading is the one its type gives (`inferredType`); the answer's `condition_reading`
 * is the worst of all of them. A part keeps no words when the diagnostics do not line up with the readings.
 */
export const conditionPartsWithMessages = (
  parts: IConditionPart[] | undefined,
  inferredType: string | undefined,
  diagnostics: Array<{ code?: string | number; message: string }>
): IConditionPart[] | undefined => {
  if (!parts) {
    return undefined;
  }
  const said = diagnostics.filter(
    (d) => d.code === 'NOT_A_CONDITION' || d.code === 'CONDITION_BY_TRUTHINESS'
  );
  const codeOf = (reading: TConditionReading) =>
    reading === 'not_a_condition' ? 'NOT_A_CONDITION'
    : reading === 'truthiness' ? 'CONDITION_BY_TRUTHINESS'
    : undefined;
  const wholeVerdict = conditionVerdict(inferredType);
  const rest = wholeVerdict ? said.slice(1) : said;
  const partCodes = parts.map((part) => codeOf(part.reading)).filter(Boolean);
  if (rest.length !== partCodes.length || rest.some((d, index) => d.code !== partCodes[index])) {
    return parts;
  }
  let next = 0;
  return parts.map((part) =>
    codeOf(part.reading) ? { ...part, message: rest[next++].message } : part
  );
};

/**
 * Where each part the server judged is drawn, by the path of its card in the expression (the builder's
 * `path`; `''` for the expression itself).
 *
 * The server reads each part of `&&`, `||` and `!` as a condition (qorus#646) and answers `parts` in its own
 * walk order: the operands of the expression's logical operator, left to right, a nested `&&`, `||` or `!`
 * standing for its own parts. A part of an AND or an OR has its own card; the part a NOT reads is drawn on
 * the NOT's card. An answer whose parts are not this expression's (a stale one, or none) places nothing.
 */
export const conditionPartCards = (
  expression: IExpression | undefined,
  parts: IConditionPart[] | undefined
): Record<string, IConditionPart> => {
  const cards: string[] = [];
  const walk = (node: IExpression, path: string): void => {
    (node.value?.args ?? []).forEach((arg: IExpression, index: number) => {
      const argPath = `${path ? `${path}.` : ''}value.args.${index}`;
      if (isLogicalOperation(arg)) {
        walk(arg, argPath);
      } else {
        cards.push(node.value?.exp === '!' ? path : argPath);
      }
    });
  };
  if (expression && isLogicalOperation(expression)) {
    walk(expression, '');
  }
  if (!parts || parts.length !== cards.length) {
    return {};
  }
  return Object.fromEntries(cards.map((card, index) => [card, parts[index]]));
};

/** What is said of a part of a condition: nothing when it is true or false or cannot be told. */
export const conditionPartVerdict = (
  part: IConditionPart | undefined
): 'error' | 'warning' | undefined =>
  part?.reading === 'not_a_condition' ? 'error'
  : part?.reading === 'truthiness' ? 'warning'
  : undefined;

/**
 * Whether an operation is offered where its result must be of `returnType`: a condition (`bool`) is
 * built from the operations whose result decides it, which is any result but text, a date or a time.
 *
 * Only a condition narrows the list. Any other type keeps every operation: a value of one type is often
 * made from an operation that gives another (text from rich text, a number from an int), and the
 * mismatch message after the choice says when it does not fit.  An operation whose result is known
 * only once it is built (`any`, or the type of its first argument) is offered everywhere.
 */
export const expressionFitsReturnType = (
  returnType: string | string[] | undefined,
  expression: { ui_return_type?: string; return_type_first_arg?: boolean }
): boolean => {
  if (!isConditionType(returnType)) {
    return true;
  }
  const result = expression.ui_return_type;
  if (expression.return_type_first_arg || !result || result === 'any' || result === 'auto') {
    return true;
  }
  return !isTextOrDateType(result);
};
