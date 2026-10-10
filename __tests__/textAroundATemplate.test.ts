/*
 * Copyright (c) 2026 Qore Technologies, s.r.o.
 */
import { describe, expect, it } from 'vitest';
import { hasTextAroundATemplate, textAroundATemplate } from '../src/helpers/templates';
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

  /* qlip build 20261008-083118 (Foxhoundn): "How does the user fix this? Why has this happened?" - the
     message names the text that makes the value text, says it is not of the field's type because of it,
     and says what to do. */
  const cases: [string, string][] = [
    ['int', '"Stk." makes this text, not a whole number. Delete it to keep the template alone.'],
    [
      'softint',
      '"Stk." makes this text, not a whole number. Delete it to keep the template alone.',
    ],
    ['number', '"Stk." makes this text, not a number. Delete it to keep the template alone.'],
    ['float', '"Stk." makes this text, not a number. Delete it to keep the template alone.'],
    ['bool', '"Stk." makes this text, not true or false. Delete it to keep the template alone.'],
    ['date', '"Stk." makes this text, not a date. Delete it to keep the template alone.'],
  ];

  for (const [type, message] of cases) {
    it(`makes a ${type} value invalid, and says why and how to fix it`, () => {
      expect(validateField(type, '$record:{pos} Stk.')).toBe(false);
      expect(validateFieldWithResult(type, '$record:{pos} Stk.')).toEqual(
        expect.objectContaining({ isValid: false, reason: message })
      );
    });

    it(`leaves a ${type} template alone valid`, () => {
      expect(validateField(type, '$record:{pos}')).toBe(true);
    });
  }

  it('names the text before a template, and text on both sides of it', () => {
    expect(validateFieldWithResult('int', 'SUP-$record:{pos}').reason).toBe(
      '"SUP-" makes this text, not a whole number. Delete it to keep the template alone.'
    );
    expect(validateFieldWithResult('int', 'ca.  $record:{pos}   Stk.').reason).toBe(
      '"ca. … Stk." makes this text, not a whole number. Delete it to keep the template alone.'
    );
  });

  it('says to keep one template where there are several', () => {
    expect(validateFieldWithResult('int', '$record:{a}$record:{b}').reason).toBe(
      'Templates side by side make this text, not a whole number. Keep one of them alone.'
    );
    expect(validateFieldWithResult('bool', '$record:{a} and $record:{b}').reason).toBe(
      'Text and more than one template make this text, not true or false. Keep one template alone.'
    );
  });

  it('tells the text around templates apart from the templates', () => {
    expect(textAroundATemplate('$record:{pos} Stk.')).toEqual({ text: ['Stk.'], templates: 1 });
    expect(textAroundATemplate('SUP-$record:{pos}')).toEqual({ text: ['SUP-'], templates: 1 });
    expect(textAroundATemplate('$record:{a}$record:{b}')).toEqual({ text: [], templates: 2 });
    expect(textAroundATemplate('$record:{pos}')).toBeUndefined();
    expect(textAroundATemplate('Stk.')).toBeUndefined();
    expect(textAroundATemplate(12)).toBeUndefined();
  });

  it('leaves text with a template in it valid in a text field', () => {
    expect(validateField('string', '$record:{pos} Stk.')).toBe(true);
  });

  it('leaves the literals of each type valid', () => {
    expect(validateField('int', 12)).toBe(true);
    expect(validateField('number', 3.5)).toBe(true);
    expect(validateField('bool', true)).toBe(true);
  });
});
