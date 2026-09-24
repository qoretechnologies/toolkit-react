import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A read row whose value is an object must show what the object IS.
 *
 * The reported case: the Qog variables editor, read-only, with a data-provider
 * variable selected — its "Initial value" row read `11 fields`, which looks like
 * a string that happens to say "fields" and tells the reader nothing about the
 * provider. A hash-typed row already carried a structured preview under its
 * summary; a `data-provider` row did not, because the preview was keyed on the
 * declared type rather than on the value's shape.
 */
const SCHEMA = {
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Name',
  },
  value: {
    type: 'data-provider',
    ui_type: 'data-provider',
    display_name: 'Initial value',
  },
} as never;

const provider = {
  type: 'datasource',
  name: 'omquser',
  transaction_management: true,
  path: '/bb_local',
  supports_read: true,
  descriptions: ['Record-based data provider for db table `public.bb_local`'],
};

const renderForm = () =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          readOnly
          name='variable'
          value={
            {
              name: { type: 'string', value: 'var2' },
              value: { type: 'data-provider', value: provider },
            } as never
          }
          options={SCHEMA}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const row = (container: HTMLElement, field: string) =>
  container.querySelector(`[data-field="${field}"]`);

describe('a read row with an object value', () => {
  it('names a data provider and previews its keys', async () => {
    const { container } = renderForm();

    await waitFor(() => expect(row(container, 'value')).toBeTruthy());

    const providerRow = row(container, 'value')!;
    // The summary line says which provider, not how many keys describe it.
    expect(providerRow.textContent).toContain('datasource · omquser · /bb_local');
    expect(providerRow.textContent).not.toContain('fields');
    // And the keys themselves are one disclosure away, as they are for a hash.
    expect(providerRow.querySelector('.options-readfirst-structured')).toBeTruthy();
    expect(providerRow.textContent).toContain('bb_local');
  });

  it('gives a scalar row no preview', async () => {
    const { container } = renderForm();

    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    // The counterweight: the preview is a property of the value's shape, not
    // of the read mode. A string row stays one line.
    expect(row(container, 'name')!.querySelector('.options-readfirst-structured')).toBeNull();
  });
});
