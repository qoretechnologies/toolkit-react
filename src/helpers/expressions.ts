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
 * Whether a type is text or a date: what a condition cannot be. A condition is evaluated by its
 * truthiness, so a number (0 or not), a list or hash (empty or not), binary data and an untyped result
 * all decide it; text and dates do not say plainly what is meant, and are compared explicitly instead
 * (`@status == "open"`, `@note != ""`).
 */
export const isTextOrDateType = (type: string): boolean =>
  /^(string|richtext|date)$/.test(type.replace(/^\*/, '').replace(/^soft/, ''));

/** Whether a place takes a condition: its result must be true or false (`bool`, or a list of only that). */
export const isConditionType = (returnType: string | string[] | undefined): boolean => {
  const types = isArray(returnType) ? returnType : returnType ? [returnType] : [];
  return types.length > 0 && types.every((type) => /^\*?(bool|boolean)$/.test(type));
};

/**
 * Whether an operation is offered where its result must be of `returnType`: a condition (`bool`) is
 * built from the operations whose result decides it, which is any result but text or a date.
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
