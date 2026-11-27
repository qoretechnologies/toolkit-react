// Copyright 2026 Qore Technologies, s.r.o.
/**
 * An optional type (`*bool`, `*int`, `*string`, `*date`) is its plain type that may also hold nothing, as validation
 * reads it (`validateField` strips the "*"). A read row kept the "*", so an optional yes/no read `true` / `false`
 * instead of Yes / No, and every type-keyed summary missed an optional field.
 */
import type { IQorusFormField, TQorusFormFieldSchema } from '@qoretechnologies/ts-toolkit';
import { describe, expect, it } from 'vitest';
import { formatOptionValue, getValueType } from '../src/components/form/engine/readFirst';

const field = (type: string, value: unknown) => ({ type, value }) as IQorusFormField;
const schemaOf = (type: string) => ({ type }) as TQorusFormFieldSchema;

describe('an optional type in a read row', () => {
  it.each([
    ['*bool', 'bool'],
    ['*int', 'int'],
    ['*string', 'string'],
    ['*date', 'date'],
  ])('%s reads as %s', (optional, plain) => {
    expect(getValueType(field(optional, undefined))).toBe(plain);
    // the schema's type, when the value names none
    expect(getValueType(undefined, schemaOf(optional))).toBe(plain);
  });

  it('a yes/no says Yes or No', () => {
    expect(formatOptionValue(field('*bool', true), schemaOf('*bool'))).toBe('Yes');
    expect(formatOptionValue(field('*bool', false), schemaOf('*bool'))).toBe('No');
  });

  it('a number, a text and a date read as their plain type does', () => {
    expect(formatOptionValue(field('*int', 42), schemaOf('*int'))).toBe(
      formatOptionValue(field('int', 42), schemaOf('int'))
    );
    expect(formatOptionValue(field('*string', 'Prague'), schemaOf('*string'))).toBe('Prague');
    const day = '2026-11-25T00:00:00Z';
    expect(formatOptionValue(field('*date', day), schemaOf('*date'))).toBe(
      formatOptionValue(field('date', day), schemaOf('date'))
    );
  });

  it('a plain type and no type stay as they are', () => {
    expect(getValueType(field('int', 1))).toBe('int');
    expect(getValueType(undefined, undefined)).toBeUndefined();
  });
});
