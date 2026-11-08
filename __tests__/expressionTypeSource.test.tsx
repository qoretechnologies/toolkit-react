// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { expressionTypeMismatchText, expressionTypeSource } from '../src/helpers/expressions';
import { builtInTypeSentenceForm, typesInASentence } from '../src/helpers/qorusTypeCatalogue';

const form = (type: string | undefined) => builtInTypeSentenceForm(type);

describe('what a type mismatch says', () => {
  it('names the operand the expression gives its type from', () => {
    const source = expressionTypeSource(
      'string',
      [
        { label: '"Interface ID"', type: 'int' },
        { label: '"Order note"', type: 'richtext' },
      ],
      form
    );
    expect(source).toEqual({ label: '"Order note"' });
    expect(expressionTypeMismatchText('text', 'a whole number', source)).toBe(
      'This expression gives text because "Order note" is text, but this field takes a whole number. Choose an ' +
        'expression that gives a whole number, or put this one inside an expression that converts it.'
    );
  });

  it('names no operand when none gives the type: the type is the operation own', () => {
    expect(
      expressionTypeSource('string', [{ label: '"Interface ID"', type: 'int' }], form)
    ).toBeUndefined();
    expect(expressionTypeMismatchText('text', 'a whole number', undefined)).toBe(
      'This expression gives text, but this field takes a whole number. Choose an expression that gives a ' +
        'whole number, or put this one inside an expression that converts it.'
    );
  });

  it('skips an operand it cannot name, and says nothing of a type it does not know', () => {
    expect(
      expressionTypeSource('string', [{ label: undefined, type: 'string' }], form)
    ).toBeUndefined();
    expect(
      expressionTypeSource(undefined, [{ label: '"x"', type: 'string' }], form)
    ).toBeUndefined();
  });
});

describe('the types a field takes', () => {
  it('says each type once, as a short list', () => {
    expect(typesInASentence(['number', 'float', 'int', 'integer'], form)).toBe(
      'an exact number, a number or a whole number'
    );
  });

  it('joins two types with or alone', () => {
    expect(typesInASentence(['int', 'string'], form)).toBe('a whole number or text');
  });
});
