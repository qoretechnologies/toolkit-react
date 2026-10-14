// Copyright 2026 Qore Technologies, s.r.o.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import {
  defaultQorusTypes,
  IQorusTypeObject,
  qorusTypeDisplayName,
  qorusTypeSentenceForm,
  useQorusTypes,
} from '../src/hooks/useQorusTypes';
import { emptyFetchContext, okResponse } from './support/fetchContext';

/**
 * qorus#646: a type has two names in the server's catalogue (GET /system/qorus-type-info, qorus c6b3fb97c): its
 * display name labels it ("Whole number"), and its sentence form names it inside a sentence ("a whole number").
 * Every reqraft message that names a type in a sentence says its sentence form: "The expression gives a whole
 * number, and this field takes key-value pairs (a hash)". A server that gives no sentence form (an older one) is answered
 * with a wording that needs no article - "a value of type Whole number" - never an English article built from the
 * display name.
 */

/** The server's answer, as an older server gave it: display names and no sentence forms. */
const OLDER_SERVER: IQorusTypeObject[] = defaultQorusTypes.map(
  ({ sentence_form: _sentence, ...type }) => type
);

describe("a type's sentence form", () => {
  it.each([
    ['int', 'a whole number'],
    ['float', 'a number'],
    ['number', 'an exact number'],
    ['bool', 'true or false'],
    ['string', 'text'],
    ['date', 'a date and time'],
    ['time', 'a time of day'],
    ['hash', 'key-value pairs (a hash)'],
    ['list', 'a list'],
  ])('%s is %s', (type, sentence) => {
    expect(qorusTypeSentenceForm(defaultQorusTypes, type)).toBe(sentence);
  });

  it.each([
    ['integer', 'a whole number'],
    ['boolean', 'true or false'],
    ['softint', 'a whole number'],
    ['*string', 'text'],
    ['*softbool', 'true or false'],
    ['hash<auto>', 'key-value pairs (a hash)'],
    ['list<string>', 'a list'],
  ])(
    '%s, another name for a type or an optional, soft or complex one, is named by its base type: %s',
    (type, sentence) => {
      expect(qorusTypeSentenceForm(defaultQorusTypes, type)).toBe(sentence);
    }
  );

  it('is worded with no article from the display name when the server gives none', () => {
    expect(qorusTypeSentenceForm(OLDER_SERVER, 'int')).toBe('a value of type Whole number');
    expect(qorusTypeSentenceForm(OLDER_SERVER, 'boolean')).toBe('a value of type True or false');
  });

  it('is worded with no article from the name of a type no catalogue lists', () => {
    expect(qorusTypeSentenceForm(defaultQorusTypes, 'order-status')).toBe(
      'a value of type order-status'
    );
  });
});

describe("a type's display name", () => {
  it('names an optional or complex type by its base type too', () => {
    expect(qorusTypeDisplayName(defaultQorusTypes, '*string')).toBe('Text');
    expect(qorusTypeDisplayName(defaultQorusTypes, 'hash<auto>')).toBe('Key-value pairs (hash)');
  });
});

describe('the hook the messages use', () => {
  const renderTypes = (serverTypes: IQorusTypeObject[]) => {
    const fetchContext = emptyFetchContext();
    fetchContext.get = vi.fn(async () => okResponse(serverTypes as never));
    return renderHook(() => useQorusTypes(), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={fetchContext}>{children}</FetchContext.Provider>
      ),
    });
  };

  it("says the server's sentence form", async () => {
    const server = defaultQorusTypes.map((type) =>
      type.name === 'int' ? { ...type, sentence_form: 'ein ganze Zahl' } : type
    );
    const { result } = renderTypes(server);
    await waitFor(() => expect(result.current.getTypeSentenceForm('int')).toBe('ein ganze Zahl'));
    expect(result.current.getTypeDisplayName('int')).toBe('Whole number');
  });

  it('says a value of type and the display name for an older server', async () => {
    const { result } = renderTypes(
      OLDER_SERVER.map((type) => (type.name === 'hash' ? { ...type, display_name: 'Hash' } : type))
    );
    await waitFor(() => expect(result.current.getTypeDisplayName('hash')).toBe('Hash'));
    expect(result.current.getTypeSentenceForm('hash')).toBe('a value of type Hash');
  });
});
