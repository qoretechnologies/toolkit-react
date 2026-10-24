// Copyright 2026 Qore Technologies, s.r.o.
// A type the catalogue does not list is the kind of value its base type is, and is never named by its code.
//
// Qorus gives every field, option and argument its base data type (`base_type`). A type the catalogue lists under
// no name - a user type, a type of a newer server - was named by its code ("qoretechnologies/order",
// "order-status") and fitted nothing, so its field was offered no template. Now it is named and converted as its
// base type; with none, a user type is named by its path and anything else is "Unknown type" (qorus#646).
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { areQorusTypesCompatible, argumentMatchesType } from '../src/helpers/expressions';
import {
  builtInTypeName,
  builtInTypeSentenceForm,
  optionTypeSentence,
  optionTypeWords,
} from '../src/helpers/qorusTypeCatalogue';
import {
  TypeSentenceFormProvider,
  useTypeName,
  useTypeSentenceForm,
} from '../src/components/form/typeSentenceForm';
import { filterTemplatesByType } from '../src/helpers/templates';
import {
  defaultQorusTypes,
  qorusTypeDisplayName,
  qorusTypeSentenceForm,
  useQorusTypes,
} from '../src/hooks/useQorusTypes';
import { emptyFetchContext } from './support/fetchContext';

const ORDER = 'qoretechnologies/order';

describe('a type the catalogue does not list', () => {
  it('is named as its base type', () => {
    expect(qorusTypeDisplayName(defaultQorusTypes, ORDER, 'hash')).toBe('Key-value pairs (hash)');
    expect(qorusTypeSentenceForm(defaultQorusTypes, ORDER, 'hash')).toBe(
      'key-value pairs (a hash)'
    );
    // a base type is read as any type is: an optional or soft form of one is that type
    expect(qorusTypeDisplayName(defaultQorusTypes, 'order-number', '*softint')).toBe(
      'Whole number'
    );
  });

  it('with no base type, is named by its path if it is a user type, else as unknown', () => {
    expect(qorusTypeDisplayName(defaultQorusTypes, ORDER)).toBe(ORDER);
    expect(qorusTypeDisplayName(defaultQorusTypes, 'blob')).toBe('Unknown type');
    expect(qorusTypeSentenceForm(defaultQorusTypes, 'blob')).toBe('a value of an unknown type');
  });

  it('leaves the types the catalogue lists, and their other forms, as they are', () => {
    expect(qorusTypeDisplayName(defaultQorusTypes, '*string', 'int')).toBe('Text');
    expect(qorusTypeDisplayName(defaultQorusTypes, 'softint')).toBe('Whole number');
    expect(qorusTypeDisplayName(defaultQorusTypes, 'hash<auto>')).toBe('Key-value pairs (hash)');
  });

  it('takes what its base type takes', () => {
    expect(areQorusTypesCompatible(ORDER, 'hash', defaultQorusTypes, 'hash')).toBe(true);
    expect(areQorusTypesCompatible(ORDER, 'string', defaultQorusTypes, 'hash')).toBe(false);
    expect(areQorusTypesCompatible(ORDER, 'hash', defaultQorusTypes)).toBe(false);
    expect(
      argumentMatchesType(
        [],
        { type: 'hash', value: {} },
        { name: 'order', ui_type: ORDER, base_type: 'hash' },
        defaultQorusTypes
      )
    ).toBe(true);
    expect(
      argumentMatchesType(
        [],
        { type: 'date', value: '2026-01-01' },
        { name: 'order', ui_type: ORDER, base_type: 'hash' },
        defaultQorusTypes
      )
    ).toBe(false);
  });

  it("is offered its base type's templates", () => {
    const templates = {
      items: [
        {
          label: 'Fields of the row',
          items: [
            { label: 'Customer', value: '$record:{customer}', badge: 'string' },
            { label: 'Details', value: '$record:{details}', badge: 'hash' },
          ],
        },
      ],
    };
    const offered = filterTemplatesByType(templates, ORDER, false, defaultQorusTypes, 'hash');
    expect(offered.items?.[0]?.items?.map((item) => item.label)).toEqual(['Details']);
  });

  it("is said in an option's words by its base type", () => {
    const option = { type: ORDER, base_type: 'hash' };
    expect(optionTypeWords(option, builtInTypeName)).toBe('Key-value pairs (hash)');
    expect(optionTypeSentence(option, builtInTypeName, builtInTypeSentenceForm)).toBe(
      'key-value pairs (a hash)'
    );
  });

  it('is named the same by the hook', async () => {
    const { result } = renderHook(() => useQorusTypes(), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={emptyFetchContext()}>{children}</FetchContext.Provider>
      ),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.getTypeDisplayName(ORDER, 'hash')).toBe('Key-value pairs (hash)');
    expect(result.current.getAcceptedTypes(ORDER, 'hash')).toEqual(['hash', 'file']);
    expect(result.current.getTypeDisplayName('blob')).toBe('Unknown type');
  });

  it("is named the same in a form's type words", async () => {
    const { result } = renderHook(
      () => ({ name: useTypeName(), sentenceForm: useTypeSentenceForm() }),
      {
        wrapper: ({ children }) => (
          <FetchContext.Provider value={emptyFetchContext()}>
            <TypeSentenceFormProvider>{children}</TypeSentenceFormProvider>
          </FetchContext.Provider>
        ),
      }
    );
    await waitFor(() => expect(result.current.name('string')).toBe('Text'));
    expect(result.current.name(ORDER, 'hash')).toBe('Key-value pairs (hash)');
    expect(result.current.sentenceForm(ORDER, 'hash')).toBe('key-value pairs (a hash)');
    expect(result.current.name('blob')).toBeUndefined();
  });
});
