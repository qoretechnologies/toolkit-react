// Copyright 2026 Qore Technologies, s.r.o.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { defaultQorusTypes, qorusTypeDisplayName, useQorusTypes } from '../src/hooks/useQorusTypes';
import { emptyFetchContext } from './support/fetchContext';

/**
 * qorus#646: a type is called what the server catalogue calls it, but the catalogue lists each type once, by
 * its own name. Qore has other names for some of them - `boolean` and `integer` are `bool` and `int`, and a
 * soft type (`softint`, `softbool`, ...) is a declaration that converts a value to its base type - and a type
 * named that way (an expression's argument, a field declared `boolean`) was shown as the raw name: "this field
 * takes boolean" where every other message says "True or false".
 */
describe('a type named the way Qore also names it', () => {
  it.each([
    ['boolean', 'True or false'],
    ['integer', 'Whole number'],
    ['softbool', 'True or false'],
    ['softint', 'Whole number'],
    ['softfloat', 'Number'],
    ['softnumber', 'Exact number'],
    ['softstring', 'Text'],
    ['softdate', 'Date'],
    ['softlist', 'List'],
  ])('%s is called %s', (typeName, displayName) => {
    expect(qorusTypeDisplayName(defaultQorusTypes, typeName)).toBe(displayName);
  });

  it("is called by the catalogue's own entry when the catalogue lists that name", () => {
    const catalogue = [
      ...defaultQorusTypes,
      { name: 'boolean', display_name: 'Flag', types_accepted: ['bool'] },
    ];
    expect(qorusTypeDisplayName(catalogue, 'boolean')).toBe('Flag');
  });

  it('keeps the name of a type no catalogue lists under any name', () => {
    expect(qorusTypeDisplayName(defaultQorusTypes, 'order-status')).toBe('order-status');
    expect(qorusTypeDisplayName(defaultQorusTypes, 'softorder')).toBe('softorder');
  });

  it('is called the same by the hook the messages use', async () => {
    const { result } = renderHook(() => useQorusTypes(), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={emptyFetchContext()}>{children}</FetchContext.Provider>
      ),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.getTypeDisplayName('boolean')).toBe('True or false');
    expect(result.current.getTypeDisplayName('bool')).toBe('True or false');
    expect(result.current.getTypeDisplayName('integer')).toBe('Whole number');
  });
});
