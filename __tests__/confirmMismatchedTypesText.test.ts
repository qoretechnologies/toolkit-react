// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import { transformedCountText } from '../src/components/form/expressions/builder/confirmMismatchedTypesModal';

// the mismatched-types dialog says how many arguments it transforms in words, never "argument(s)"
describe('transformedCountText', () => {
  it('says one argument in the singular, any other count in the plural', () => {
    expect(transformedCountText(1)).toBe('1 argument will be transformed.');
    expect(transformedCountText(0)).toBe('0 arguments will be transformed.');
    expect(transformedCountText(2)).toBe('2 arguments will be transformed.');
  });
});
