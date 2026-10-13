// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { validateFieldWithResult } from '../src/helpers/validations';

/**
 * qorus#646: what a form says of a value that is not of its field's type names the type as the server's catalogue
 * does inside a sentence - its sentence form - not in Qore's words ("an integer", "a float", "a True or False
 * value") or words of its own ("a number" for an exact number, "a date" for a date and time).
 */
const reason = (type: string, value: unknown) => validateFieldWithResult(type, value).reason;

describe('a value not of its field type', () => {
  it.each([
    ['int', 'abc', 'Value must be a whole number'],
    ['float', 'abc', 'Value must be a number'],
    ['number', 'abc', 'Value must be an exact number'],
    ['bool', 'abc', 'Value must be true or false'],
    ['hash', 'abc', 'Value must be a set of fields'],
  ])('of type %s, %j, says %j', (type, value, said) => {
    expect(reason(type, value)).toBe(said);
  });
});

describe('text around a template, in a field that is not text', () => {
  it.each([
    ['int', 'a whole number'],
    ['float', 'a number'],
    ['number', 'an exact number'],
    ['bool', 'true or false'],
    ['date', 'a date and time'],
  ])('of type %s says it makes the value text, not %s', (type, notA) => {
    expect(reason(type, 'pos $local:{pos}')).toBe(
      `"pos" makes this text, not ${notA}. Delete it to keep the template alone.`
    );
  });
});
