// Copyright 2026 Qore Technologies, s.r.o.
//
// A record no data provider has - a sheet contract's columns and added fields - gives its fields to the
// DPQL server itself, so the expression Text view offers every field the Visual view does (David's review
// of qorus#646). The server takes them as `fields` on `dpql/setContext` (the provider optional) and as
// `metadata.fields` at didOpen.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requests: { method: string; params: any }[] = [];
let openedWith: any;

// one client for the session's life, as the real session keeps it
const client = {
  customRequest: async (method: string, params: any) => {
    requests.push({ method, params });
    return { context: 'fields', fields: { qty: { type: { name: 'int' } } } };
  },
};

vi.mock('../src/components/smartEditor/useLspSession', () => ({
  useLspSession: (opts: any) => {
    openedWith = opts.initialMetadata;
    return { client, isReady: true, uri: 'inmemory://dpql/1', diagnostics: [] };
  },
}));

import { useDpqlSession } from '../src/components/dpqlEditor/useDpqlSession';

const FIELDS: Record<string, { type: string | string[]; desc?: string }> = { qty: { type: 'int' }, pos: { type: ['int', 'string'] }, day: { type: 'date', desc: 'Liefertermin' } };

describe('a DPQL document given its fields', () => {
  beforeEach(() => {
    requests.length = 0;
    openedWith = undefined;
  });

  it('opens with them and binds them, with no provider', async () => {
    const { result } = renderHook(() => useDpqlSession({ fields: FIELDS }));
    expect(openedWith?.fields).toEqual(FIELDS);
    await waitFor(() => expect(requests.find((r) => r.method === 'dpql/setContext')).toBeTruthy());
    const bound = requests.find((r) => r.method === 'dpql/setContext')!.params;
    expect(bound.fields).toEqual(FIELDS);
    expect(bound.provider).toBeUndefined();
    // what the server says of them is the editor's field metadata, as for a provider's fields
    await waitFor(() => expect(result.current.fieldMeta.qty?.type?.name).toBe('int'));
  });

  it('binds them again when they change, and not when they are the same', async () => {
    const { rerender } = renderHook(({ fields }) => useDpqlSession({ fields }), { initialProps: { fields: FIELDS } });
    await waitFor(() => expect(requests.length).toBe(1));
    rerender({ fields: { ...FIELDS } });
    await waitFor(() => expect(requests.length).toBe(1));
    rerender({ fields: { ...FIELDS, total: { type: 'number' } } });
    await waitFor(() => expect(requests.length).toBe(2));
    expect(requests[1].params.fields.total).toEqual({ type: 'number' });
  });

  it('sends no field list where there is none', async () => {
    renderHook(() => useDpqlSession({ provider: '@app/action', recordType: 'record' }));
    await waitFor(() => expect(requests.length).toBe(1));
    expect('fields' in requests[0].params).toBe(false);
    expect(openedWith?.fields).toBeUndefined();
    // and nothing is bound for a document with neither
    requests.length = 0;
    renderHook(() => useDpqlSession({ fields: {} }));
    expect(requests.length).toBe(0);
  });
});
