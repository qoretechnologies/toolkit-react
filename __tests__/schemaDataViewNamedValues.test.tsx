import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { SchemaDataView } from '../src/components/form/engine/_structuredData/SchemaDataView';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * A set of named values kept as rows reads as a fact sheet.
 *
 * A host keeps a free-form set of named values as a list of `{ name, value }`
 * hashes, so each can be added, typed and removed on its own. Read as a list of
 * records, every name was promoted to a numbered item's heading: a column of
 * large mono names with an accent bar, where the reader wants `autostart` as a
 * quiet label and its value beside it.
 */

const ROW_SCHEMA = {
  name: { type: 'string', display_name: 'Name', required: true },
  value: { type: 'auto', display_name: 'Value' },
} as never;

const DETAILS = [
  { type: 'hash', value: { name: { type: 'string', value: 'interface' }, value: { type: 'string', value: 'order-sync' } } },
  { type: 'hash', value: { name: { type: 'string', value: 'retries' }, value: { type: 'int', value: 3 } } },
  { type: 'hash', value: { name: { type: 'string', value: 'autostart' }, value: { type: 'bool', value: true } } },
];

const colors = { key: '#ffffff', muted: '#888888', border: '#333333', accent: '#3b8eea' };

const renderView = (value: unknown, namedValues?: boolean) =>
  render(
    <ReqoreUIProvider>
      <SchemaDataView value={value} schema={ROW_SCHEMA} colors={colors} namedValues={namedValues} />
    </ReqoreUIProvider>
  );

const namesOf = (container: HTMLElement) =>
  [...container.querySelectorAll('.schema-view-named-value')].map((row) =>
    (row.firstElementChild?.textContent ?? '').trim()
  );

describe('SchemaDataView named values', () => {
  it('draws each name as a label beside its value, with no numbered heading', () => {
    const { container } = renderView(DETAILS, true);

    expect(namesOf(container)).toEqual(['interface', 'retries', 'autostart']);
    expect(container.querySelector('.schema-view-item-title')).toBeNull();
    expect(container.querySelector('.schema-view-item')).toBeNull();
    // each value keeps its own look: the bool is its tag, the literal its text
    const rows = [...container.querySelectorAll('.schema-view-named-value')];
    expect(rows[0].textContent).toContain('order-sync');
    expect(rows[2].querySelector('.reqore-tag')).toBeTruthy();
    // the field's own label ("Value") is not what names a row
    expect(container.textContent).not.toContain('Value');
  });

  it('keeps a name as the data spells it, in the classic look too', () => {
    const { container } = renderView(
      [{ type: 'hash', value: { name: 'retryOnError', value: true } }],
      true
    );

    const label = container.querySelector<HTMLElement>('.schema-view-named-value > *')!;
    expect(label.textContent).toBe('retryOnError');
    expect(getComputedStyle(label).textTransform).toBe('none');
  });

  it('shows a name that has no value yet', () => {
    const { container } = renderView([{ type: 'hash', value: { name: 'owner' } }], true);

    expect(namesOf(container)).toEqual(['owner']);
  });

  it('keeps the numbered look when an item holds more than a name and a value', () => {
    const { container } = renderView(
      [...DETAILS, { type: 'hash', value: { name: 'extra', value: 1, note: 'more' } }],
      true
    );

    expect(container.querySelector('.schema-view-named-value')).toBeNull();
    expect(container.querySelectorAll('.schema-view-item-title')).toHaveLength(4);
  });

  it('is numbered as before unless the host asks for named values', () => {
    const { container } = renderView(DETAILS);

    expect(container.querySelector('.schema-view-named-value')).toBeNull();
    expect(container.querySelectorAll('.schema-view-item-title')).toHaveLength(3);
  });
});

const queryMock = vi.fn();
vi.mock('../src/utils/fetch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/utils/fetch')>()),
  query: (...args: unknown[]) => queryMock(...args),
}));

const renderForm = (metadata?: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <FormEngine
          compact
          name='alert'
          options={
            {
              details: {
                type: 'list',
                element_type: 'hash',
                display_name: 'Details',
                arg_schema: ROW_SCHEMA,
                metadata,
              },
            } as never
          }
          value={{ details: { type: 'list', value: DETAILS } } as never}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('a field marked as named values', () => {
  it('reads as named values when its metadata says so', async () => {
    const { container } = renderForm({ named_values: true });

    await waitFor(() => expect(container.querySelector('.schema-data-view')).toBeTruthy());
    expect(namesOf(container)).toEqual(['interface', 'retries', 'autostart']);
    expect(container.querySelector('.schema-view-item-title')).toBeNull();
  });

  it('reads as numbered records without it', async () => {
    const { container } = renderForm();

    await waitFor(() => expect(container.querySelector('.schema-data-view')).toBeTruthy());
    expect(container.querySelector('.schema-view-named-value')).toBeNull();
    expect(container.querySelectorAll('.schema-view-item-title')).toHaveLength(3);
  });
});
