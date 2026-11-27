// Copyright 2026 Qore Technologies, s.r.o.
import { isArray } from 'lodash';
import { IQorusTypeObject } from '../../../../hooks/useQorusTypes';
import { areQorusTypesCompatible, isTextOrDateType } from '../../../../helpers/expressions';

export interface IExpressionReturnTypeMatchInput {
  /** What the place takes: a type, several, or nothing said. */
  returnType?: string | string[];
  /** The place's base type, for a type the catalogue does not list. */
  returnBaseType?: string;
  /** What the expression gives, as the server says. */
  expressionReturnType?: string;
  /** The expression's operation is not chosen yet: it gives nothing yet, so nothing is said of it. */
  noOperationYet?: boolean;
  /** The server has not said yet what the expression gives. */
  typeNotKnownYet?: boolean;
  /** A top-level condition's verdict on what it gives (`conditionVerdict`): an error never matches. */
  condition?: 'error' | 'warning';
  /** The place is a condition: any result but text, a date or a time decides it. */
  takesCondition?: boolean;
  /** The type catalogue (`useQorusTypes().value`). */
  types?: IQorusTypeObject[];
}

/**
 * Whether what an expression gives fits the place it is in: a field of a type, a condition, an argument. A place
 * that says nothing, or takes `any`, `auto` or a `context`, takes anything; otherwise the type catalogue decides
 * (`areQorusTypesCompatible`), a type it does not list by its base type, so a field of a text format (an email, a
 * URL) takes an expression that gives text, and a true-or-false field does not.
 */
export const isExpressionReturnTypeMatching = ({
  returnType,
  returnBaseType,
  expressionReturnType,
  noOperationYet,
  typeNotKnownYet,
  condition,
  takesCondition,
  types,
}: IExpressionReturnTypeMatchInput): boolean =>
  !!noOperationYet ||
  (condition !== 'error' &&
    (!!typeNotKnownYet ||
      expressionReturnType === 'any' ||
      (isArray(returnType) ?
        areQorusTypesCompatible(returnType, expressionReturnType, types, returnBaseType)
      : returnType === 'auto' ||
        returnType === 'any' ||
        returnType === 'context' ||
        // a place of a type the catalogue does not list takes what its base type takes
        areQorusTypesCompatible(returnType, expressionReturnType, types, returnBaseType) ||
        returnType === expressionReturnType ||
        !returnType) ||
      // a condition is decided by any result but text, a date or a time
      (!!takesCondition && !!expressionReturnType && !isTextOrDateType(expressionReturnType))));
