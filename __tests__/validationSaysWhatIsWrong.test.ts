// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { validateFieldWithResult } from '../src/helpers/validations';

/**
 * A refused value is told what is wrong with it. A number in a text field was "Text value is empty", which it is not:
 * it is not text. A hash with a wrong argument was "Hash arguments are invalid", which named no argument and said
 * nothing of why: the reason names the argument and says what is wrong with it.
 */
describe('a text field', () => {
  it('says a value of another type must be text, and keeps "empty" for an empty value', () => {
    expect(validateFieldWithResult('richtext', 123).reason).toBe('Value must be text');
    expect(validateFieldWithResult('richtext', true).reason).toBe('Value must be text');
    expect(validateFieldWithResult('richtext', '').reason).toBe('Text value is empty');
    expect(validateFieldWithResult('richtext', undefined).reason).toBe('Text value is empty');

    expect(validateFieldWithResult('string', 123).reason).toBe('Value must be text');
    expect(validateFieldWithResult('string', '').reason).toBe('Value must be a non-empty text');
  });

  it('still takes text', () => {
    expect(validateFieldWithResult('richtext', 'Hello').isValid).toBe(true);
    expect(validateFieldWithResult('string', 'Hello').isValid).toBe(true);
  });
});

describe("a hash's arguments", () => {
  const schema = {
    arg_schema: {
      name: { type: 'string', required: true },
      port: { type: 'int', display_name: 'Port' },
    },
  } as never;

  it('names a required argument with no value', () => {
    expect(validateFieldWithResult('hash', { port: 8080 }, schema).reason).toBe('“name” needs a value');
  });

  it('names an argument whose value is refused, and says why', () => {
    const { isValid, reason } = validateFieldWithResult(
      'hash',
      { name: 'orders', port: 'eighty' },
      schema
    );

    expect(isValid).toBe(false);
    expect(reason).toMatch(/^“Port”: /);
    expect(reason).toBe(`“Port”: ${validateFieldWithResult('int', 'eighty').reason}`);
  });

  it('takes a hash whose arguments are all right', () => {
    expect(validateFieldWithResult('hash', { name: 'orders', port: 8080 }, schema).isValid).toBe(true);
  });
});
