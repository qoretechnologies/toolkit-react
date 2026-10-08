/*
 * Copyright (c) 2026 Qore Technologies, s.r.o.
 */
import { describe, expect, it } from 'vitest';
import { hasTextAroundATemplate } from '../src/helpers/templates';
import { validateField, validateFieldWithResult } from '../src/helpers/validations';

/**
 * qorus#646 (David): a whole number, a number, a yes/no or a date written with text around a template
 * ("$record:{bestellnummer} Stk.") is not one of those. It was valid: anything that starts with `$` and
 * has a `:` was taken for a template, so the form could be saved with a value its type cannot hold.
 */
describe('text around a template', () => {
  it('is told from a template alone, a literal and plain text', () => {
    expect(hasTextAroundATemplate('$record:{pos} Stk.')).toBe(true);
    expect(hasTextAroundATemplate('SUP-$record:{pos}')).toBe(true);
    expect(hasTextAroundATemplate('$record:{a}$record:{b}')).toBe(true);
    expect(hasTextAroundATemplate('$record:{pos}')).toBe(false);
    expect(hasTextAroundATemplate('$local:id')).toBe(false);
    expect(hasTextAroundATemplate('12')).toBe(false);
    expect(hasTextAroundATemplate('Stk.')).toBe(false);
    expect(hasTextAroundATemplate(undefined)).toBe(false);
    expect(hasTextAroundATemplate(12)).toBe(false);
  });

  const cases: [string, string][] = [
    ['int', "A whole number can't have text around a template"],
    ['softint', "A whole number can't have text around a template"],
    ['number', "A number can't have text around a template"],
    ['float', "A number can't have text around a template"],
    ['bool', "True or false can't have text around a template"],
    ['date', "A date can't have text around a template"],
  ];

  for (const [type, message] of cases) {
    it(`makes a ${type} value invalid, and says why`, () => {
      expect(validateField(type, '$record:{pos} Stk.')).toBe(false);
      expect(validateFieldWithResult(type, '$record:{pos} Stk.')).toEqual(
        expect.objectContaining({ isValid: false, reason: message })
      );
    });

    it(`leaves a ${type} template alone valid`, () => {
      expect(validateField(type, '$record:{pos}')).toBe(true);
    });
  }

  it('leaves text with a template in it valid in a text field', () => {
    expect(validateField('string', '$record:{pos} Stk.')).toBe(true);
  });

  it('leaves the literals of each type valid', () => {
    expect(validateField('int', 12)).toBe(true);
    expect(validateField('number', 3.5)).toBe(true);
    expect(validateField('bool', true)).toBe(true);
  });
});
