// Copyright 2026 Qore Technologies, s.r.o.
//
// A number the server was always going to refuse.
//
// The schema vocabulary had no way to say what range a numeric field accepts, so
// `count: 0` and `count: -3` looked like any other number in the form and came back
// as an error on save. `min_value` / `max_value` close that: the server declares a
// bound only where the same bound is already enforced on the write, and the form
// refuses the value while the field is still on screen.
//
// Two halves have to agree for that to be true, and each was broken on its own at
// some point in this codebase: the VALIDATOR has to read the bound, and the INPUT
// has to offer a spinner that stops where the validator does. A spinner that steps
// to 0 under a validator that refuses 0 teaches the author the form is broken.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Only the input is stood in for, so the assertions read the attributes this
// component passed rather than whatever reqore's own input decides to forward.
// Partial rather than whole: `validations` reaches the select field, which needs
// `ReqoreModal` at module scope, and a whole-module mock takes that away.
vi.mock('@qoretechnologies/reqore', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ReqoreInput: ({ value, onChange, ...rest }: Record<string, any>) => (
    <input data-testid='input' value={value} onChange={onChange} {...rest} />
  ),
}));

import NumberFormField from '../src/components/form/fields/number/Number';
import { validateField, validateFieldWithResult } from '../src/helpers/validations';

// ─── the validator ────────────────────────────────────────────────────────────

describe('a declared numeric bound', () => {
  it.each(['int', 'float', 'number'])('is applied by the %s validator', (type) => {
    expect(validateField(type, 5, { min_value: 1, max_value: 10 } as never)).toBe(true);
    expect(validateField(type, 0, { min_value: 1, max_value: 10 } as never)).toBe(false);
    expect(validateField(type, 11, { min_value: 1, max_value: 10 } as never)).toBe(false);
  });

  it('is inclusive at both ends', () => {
    // The server's bounds come from checks like `count <= 0` and `pct <= 100`, so the
    // endpoints are values the server keeps. An exclusive reading here would refuse a
    // `percentile` of exactly 100 — the most likely value anyone types.
    expect(validateField('int', 1, { min_value: 1, max_value: 100 } as never)).toBe(true);
    expect(validateField('int', 100, { min_value: 1, max_value: 100 } as never)).toBe(true);
  });

  it('applies on its own where only one side is declared', () => {
    // `alertrule.threshold.count` is the case: the store enforces a floor and no
    // ceiling, so declaring a ceiling would refuse a count the store would have kept.
    expect(validateField('int', 1_000_000, { min_value: 1 } as never)).toBe(true);
    expect(validateField('int', 0, { min_value: 1 } as never)).toBe(false);

    expect(validateField('int', -50, { max_value: 10 } as never)).toBe(true);
    expect(validateField('int', 11, { max_value: 10 } as never)).toBe(false);
  });

  it('bounds a fractional value on a float field', () => {
    // Why the server member is a decimal type rather than an integer one: a bound that
    // could only be whole would be undeclarable for half the fields it serves.
    expect(validateField('float', 0.5, { min_value: 0.25, max_value: 0.75 } as never)).toBe(true);
    expect(validateField('float', 0.1, { min_value: 0.25, max_value: 0.75 } as never)).toBe(false);
    expect(validateField('float', 0.9, { min_value: 0.25, max_value: 0.75 } as never)).toBe(false);
  });

  it('says which correction is needed, rather than only that the value is wrong', () => {
    // "must be a whole number" and "must be at least 1" are different corrections. A
    // single message for both makes the author guess which one they hit.
    expect(validateFieldWithResult('int', 0, { min_value: 1 } as never).reason).toBe(
      'Value must be 1 or more'
    );
    expect(validateFieldWithResult('int', 200, { max_value: 100 } as never).reason).toBe(
      'Value must be 100 or less'
    );
    expect(validateFieldWithResult('int', 'abc', { min_value: 1 } as never).reason).toBe(
      'Value must be an integer'
    );
  });

  it('is not invented where the schema declares none', () => {
    // The failure mode a defaulted bound would produce: every unbounded numeric field
    // silently acquiring a floor of 0, which is a real value for plenty of them.
    expect(validateField('int', -5)).toBe(true);
    expect(validateField('int', -5, {} as never)).toBe(true);
    expect(validateField('float', -0.5, { min_value: undefined } as never)).toBe(true);
  });

  it('is ignored when it is not a finite number', () => {
    // A schema that says nothing usable must not refuse everything.
    expect(validateField('int', -5, { min_value: NaN } as never)).toBe(true);
    expect(validateField('int', -5, { min_value: null } as never)).toBe(true);
    expect(validateField('int', -5, { max_value: 'ten' } as never)).toBe(true);
  });

  it('does not decide whether the value is a number in the first place', () => {
    // The bound is checked only after the type is, so a bound can never make a
    // non-number valid by happening to fall inside the range.
    expect(validateField('int', 1.5, { min_value: 1, max_value: 10 } as never)).toBe(false);
    expect(validateField('int', '', { min_value: 1, max_value: 10 } as never)).toBe(false);
  });

  it('is read by nothing on a field that is not numeric', () => {
    // The server refuses to declare one on a non-numeric field; this is the other side
    // of that, so a bound that leaks onto a text field cannot start refusing its values.
    expect(validateField('string', 'zz', { min_value: 100 } as never)).toBe(true);
  });
});

// ─── the input ────────────────────────────────────────────────────────────────

describe('the number input', () => {
  it('offers the declared bounds to the spinner', () => {
    render(<NumberFormField value={5} min_value={1} max_value={10} onChange={vi.fn()} />);

    const input = screen.getByTestId('input');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('10');
  });

  it('keeps the schema spelling off the DOM node', () => {
    // The field descriptor is spread onto this component whole, so an unconsumed
    // `min_value` would land on the input as an unknown attribute and React would warn
    // — the reason `inheritedFromParent` and `expandFirstRequired` are destructured out
    // of `rest` in AutoFormField.
    render(<NumberFormField value={5} min_value={1} max_value={10} onChange={vi.fn()} />);

    const input = screen.getByTestId('input');
    expect(input.hasAttribute('min_value')).toBe(false);
    expect(input.hasAttribute('max_value')).toBe(false);
  });

  it('declares neither bound when the schema declares neither', () => {
    // `min={undefined}` and no `min` at all render the same, but a `min={0}` default
    // would stop the spinner at zero on every unbounded field in every form.
    render(<NumberFormField value={5} onChange={vi.fn()} />);

    const input = screen.getByTestId('input');
    expect(input.hasAttribute('min')).toBe(false);
    expect(input.hasAttribute('max')).toBe(false);
  });

  it('declares only the side the schema declares', () => {
    render(<NumberFormField value={5} min_value={1} onChange={vi.fn()} />);

    const input = screen.getByTestId('input');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.hasAttribute('max')).toBe(false);
  });
});
