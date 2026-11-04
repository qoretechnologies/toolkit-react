// Copyright 2026 Qore Technologies, s.r.o.
// The server's type catalogue decides which values and templates fit a field, once it has answered.
//
// `getQorusTypes()` gave reqraft's built-in copy always, and the checks built on it never saw the server's answer
// (GET /system/qorus-type-info): a type or a conversion only the server knows - the string format types, a type a
// newer server adds - made the expression builder refuse what fits and TemplateField drop the templates a field
// takes (qorus#646). The checks now decide with the catalogue they are given, a component gives them the hook's,
// and `getQorusTypes()` gives the server's answer once a `useQorusTypes` has it.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { areQorusTypesCompatible, argumentMatchesType } from '../src/helpers/expressions';
import { filterTemplatesByType } from '../src/helpers/templates';
import {
  defaultQorusTypes,
  getQorusTypes,
  IQorusTypeObject,
  useQorusTypes,
} from '../src/hooks/useQorusTypes';
import { emptyFetchContext, okResponse } from './support/fetchContext';

/** A server's catalogue with a type reqraft's copy does not have: an order reference, which takes text. */
const ORDER_REFERENCE: IQorusTypeObject = {
  name: 'order-ref',
  display_name: 'Order reference',
  sentence_form: 'an order reference',
  short_desc: 'An order reference',
  desc: 'An order reference',
  types_accepted: ['order-ref', 'string', 'richtext'],
  exact_match: ['order-ref', 'string', 'richtext'],
};
const SERVER_TYPES: IQorusTypeObject[] = [...defaultQorusTypes, ORDER_REFERENCE];

const TEMPLATES = {
  items: [
    {
      label: 'Fields of the row',
      items: [
        { label: 'Customer', value: '$record:{customer}', badge: 'string' },
        { label: 'Total', value: '$record:{total}', badge: 'number' },
      ],
    },
  ],
};

describe("the server's catalogue decides what fits", () => {
  it('in the compatibility check, which decides with the catalogue it is given', () => {
    expect(areQorusTypesCompatible('order-ref', 'string', SERVER_TYPES)).toBe(true);
    expect(areQorusTypesCompatible('order-ref', 'date', SERVER_TYPES)).toBe(false);
  });

  it("in the templates a field is offered: the ones its type takes, by the server's catalogue", () => {
    const offered = filterTemplatesByType(TEMPLATES, 'order-ref', false, SERVER_TYPES);
    expect(offered.items?.[0]?.items?.map((item) => item.label)).toEqual(['Customer']);
  });

  it("in whether an argument fits its place, by the server's catalogue", () => {
    expect(
      argumentMatchesType(
        [],
        { type: 'string', value: 'A-1' },
        { name: 'ref', ui_type: 'order-ref' } as never,
        SERVER_TYPES
      )
    ).toBe(true);
    expect(
      argumentMatchesType(
        [],
        { type: 'date', value: '2026-01-01' },
        { name: 'ref', ui_type: 'order-ref' } as never,
        SERVER_TYPES
      )
    ).toBe(false);
  });

  it('outside a component, once a useQorusTypes has the answer', async () => {
    expect(getQorusTypes()).toBe(defaultQorusTypes);

    const fetchContext = emptyFetchContext();
    fetchContext.get = vi.fn(async () => okResponse(SERVER_TYPES as never));
    const { result } = renderHook(() => useQorusTypes(), {
      wrapper: ({ children }) => (
        <FetchContext.Provider value={fetchContext}>{children}</FetchContext.Provider>
      ),
    });
    await waitFor(() => expect(result.current.value).toEqual(SERVER_TYPES));

    await waitFor(() => expect(getQorusTypes()).toEqual(SERVER_TYPES));
    expect(areQorusTypesCompatible('order-ref', 'string')).toBe(true);
  });
});
