// Copyright 2026 Qore Technologies, s.r.o.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import {
  conditionErrorText,
  conversionText,
  expressionTypeMismatchText,
} from '../src/helpers/expressions';
import {
  defaultQorusTypes,
  qorusTypeDisplayName,
  qorusTypeSentenceForm,
  useQorusTypes,
} from '../src/hooks/useQorusTypes';
import { emptyFetchContext, okResponse } from './support/fetchContext';

/**
 * qorus#646: a place whose type is not known yet - no type, or an empty name - has no name to give. The names of a
 * type say nothing for it (`undefined`), and each sentence that would name the type is worded without one. They
 * said "a value of type undefined" and "a value of type " inside a sentence, and the display name was the type
 * itself only by chance.
 */
describe('no type', () => {
  it.each([[undefined], ['']])('%j has no sentence form', (type) => {
    expect(qorusTypeSentenceForm(defaultQorusTypes, type)).toBeUndefined();
  });

  it.each([[undefined], ['']])('%j has no display name', (type) => {
    expect(qorusTypeDisplayName(defaultQorusTypes, type)).toBeUndefined();
  });

  it('has no name with no catalogue either', () => {
    expect(qorusTypeSentenceForm(undefined, undefined)).toBeUndefined();
    expect(qorusTypeDisplayName(undefined, '')).toBeUndefined();
  });

  // a type is still named when it is known, and when it is not listed: only no type has no name
  it('leaves a named type its names', () => {
    expect(qorusTypeSentenceForm(defaultQorusTypes, 'int')).toBe('a whole number');
    expect(qorusTypeDisplayName(defaultQorusTypes, 'int')).toBe('Whole number');
    expect(qorusTypeSentenceForm(defaultQorusTypes, 'order-status')).toBe(
      'a value of an unknown type'
    );
    expect(qorusTypeDisplayName(defaultQorusTypes, 'order-status')).toBe('Unknown type');
  });

  it('has no names from the hook', async () => {
    const fetchContext = emptyFetchContext();
    fetchContext.get = vi.fn(async () => okResponse(defaultQorusTypes as never));
    const { result } = renderHook(() => useQorusTypes(), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={fetchContext}>{children}</FetchContext.Provider>
      ),
    });
    await waitFor(() => expect(fetchContext.get).toHaveBeenCalled());
    expect(result.current.getTypeSentenceForm(undefined)).toBeUndefined();
    expect(result.current.getTypeSentenceForm('')).toBeUndefined();
    expect(result.current.getTypeDisplayName(undefined)).toBeUndefined();
    expect(result.current.getTypeSentenceForm('bool')).toBe('true or false');
  });
});

describe('a sentence about a type that is not known', () => {
  it('names no type when a condition gives one that is not known', () => {
    const said = conditionErrorText(undefined, undefined);
    expect(said).toBe(
      'The condition must evaluate to true or false. Compare the value instead, for example @status == "open".'
    );
    expect(said).not.toMatch(/undefined|evaluates to\s*,/);
  });

  it('still names the type a condition gives when it is known', () => {
    expect(conditionErrorText('text', 'string')).toMatch(
      /^The condition evaluates to text, but it must evaluate to true or false\./
    );
  });

  it('says what an expression gives without naming what a place of no known type takes', () => {
    const said = expressionTypeMismatchText('a whole number', undefined);
    expect(said).toBe(
      'This expression gives a whole number, which this field does not take. Choose another expression, or put this one inside an expression that converts it.'
    );
    expect(said).not.toMatch(/undefined|takes\s*\./);
  });

  it('says what a place takes, and "nothing" for an expression that gives nothing yet', () => {
    expect(expressionTypeMismatchText(undefined, 'true or false')).toBe(
      'This expression gives nothing, but this field takes true or false. Choose an expression that gives true or false, or put this one inside an expression that converts it.'
    );
  });

  it.each([
    ['a date and time', 'text', 'Converted from a date and time to text'],
    [undefined, 'a whole number', 'Converted to a whole number'],
    ['text', undefined, 'Converted from text'],
    [undefined, undefined, 'Converted'],
  ])('a conversion from %j to %j says %j', (from, to, said) => {
    expect(conversionText(from, to)).toBe(said);
  });
});
