// Copyright 2026 Qore Technologies, s.r.o.
/**
 * Why a value its field's pattern refuses is refused (qorus#646, David on FormEngine · Compact Auto Focus Targets
 * Invalid Filled Field: "we need to tell the user why there's an error - i.e. what doesn't match the pattern - what
 * is the pattern - without this, the user can become frustrated"). It said "Value does not match validation pattern".
 */
import { describe, expect, it } from 'vitest';
import { patternMismatchReason, validateFieldWithResult } from '../src/helpers/validations';

describe('a value its pattern refuses', () => {
  it('says what the pattern accepts, in the words the server gives it', () => {
    expect(
      patternMismatchReason({
        validation_regex: '^[^:]+:[0-9]+$',
        validation_regex_desc: 'a host name and a port, like api.example.com:443',
      })
    ).toBe('Must be a host name and a port, like api.example.com:443.');
    // a sentence the server ended itself is not ended twice
    expect(
      patternMismatchReason({ validation_regex: 'x', validation_regex_desc: 'an http address.' })
    ).toBe('Must be an http address.');
  });

  it('else says the form a value must have by its example, and the pattern as a detail', () => {
    expect(
      patternMismatchReason({
        validation_regex: '^https?://',
        example_value: 'https://api.example.com',
      })
    ).toBe(
      'Must match the expected form, for example https://api.example.com. Pattern: ^https?://'
    );
    expect(patternMismatchReason({ validation_regex: '^[0-9]+$', example_value: 42 })).toBe(
      'Must match the expected form, for example 42. Pattern: ^[0-9]+$'
    );
  });

  it('with neither, says that much, and the pattern', () => {
    expect(patternMismatchReason({ validation_regex: '^a' })).toBe(
      'Must match the expected form. Pattern: ^a'
    );
    // an example that is no text is not written out
    expect(patternMismatchReason({ validation_regex: '^a', example_value: { a: 1 } })).toBe(
      'Must match the expected form. Pattern: ^a'
    );
  });

  it('is the reason a text field and a format field give', () => {
    const field = { validation_regex: '^https?://', example_value: 'https://api.example.com' };
    expect(validateFieldWithResult('string', 'bad-endpoint', field).reasons).toEqual([
      'Must match the expected form, for example https://api.example.com. Pattern: ^https?://',
    ]);
    expect(
      validateFieldWithResult('hostname', 'bad host', { validation_regex: '^[a-z]+$' }).reasons
    ).toEqual(['Must match the expected form. Pattern: ^[a-z]+$']);
    expect(validateFieldWithResult('string', 'https://x', field).isValid).toBe(true);
  });
});
