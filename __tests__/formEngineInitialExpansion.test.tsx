import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';

const fetchContext = {
  get: vi.fn(async () => ({ ok: true, data: [] })),
  post: vi.fn(async () => ({ ok: true, data: [] })),
  put: vi.fn(async () => ({ ok: true, data: [] })),
  del: vi.fn(async () => ({ ok: true, data: [] })),
};

/**
 * `initialExpandedOptions` names the rows that must already be open when the
 * form paints. `expandFirstRequired` opens the first row that needs attention.
 * Both are opt-in, and a read-first form sets the second one for every field
 * it renders — so the two meet on any form that also names a starting row.
 *
 * They must compose. A caller that names a row has made an addressing
 * statement ("this is what the page is FOR"); the first-required scan is a
 * convenience on top of it. Neither is entitled to close what the other opened.
 */
const SCHEMA: Record<string, unknown> = {
  title: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Title',
    required: true,
    sort: 1,
  },
  cases: {
    type: 'list',
    ui_type: 'list',
    display_name: 'Cases',
    required: true,
    sort: 2,
  },
};

const renderForm = (props: Record<string, unknown>) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='test'
          value={{} as never}
          options={SCHEMA as never}
          initialExpandedOptions={['cases']}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** An expanded row renders as an edit card; a collapsed one as a read row. */
const isExpanded = (field: string) => {
  const el = document.querySelector(`[data-field="${field}"]`);
  expect(el, `no row rendered for "${field}"`).toBeTruthy();
  return !el!.className.includes('readfirst-row');
};

describe('FormEngine initial expansion', () => {
  it('opens a caller-named row on a form with nothing else set', async () => {
    renderForm({});
    await waitFor(() => expect(isExpanded('cases')).toBe(true));
  });

  it('keeps the caller-named row open when the first-required scan also runs', async () => {
    // The shape every read-first form has: `expandFirstRequired` is set for the
    // whole form, and the host has additionally named one row. `title` sorts
    // first and is empty, so the scan targets it. That must not close `cases`.
    renderForm({ expandFirstRequired: true });
    await waitFor(() => expect(isExpanded('title')).toBe(true));
    expect(isExpanded('cases')).toBe(true);
  });

  it('opens a caller-named row that only reaches the schema after first paint', async () => {
    // A server-driven schema arrives in pieces. The row the caller named can be
    // in the second piece, and the address does not stop being an address
    // because the field was slow.
    const Late = () => {
      const [options, setOptions] = useState<Record<string, unknown>>({ title: SCHEMA['title'] });
      useEffect(() => {
        const id = setTimeout(() => setOptions(SCHEMA as never), 20);
        return () => clearTimeout(id);
      }, []);
      return (
        <ReqoreUIProvider>
          <FetchContext.Provider value={fetchContext}>
            <FormEngine
              compact
              name='test'
              value={{} as never}
              options={options as never}
              initialExpandedOptions={['cases']}
              expandFirstRequired
              onChange={vi.fn()}
            />
          </FetchContext.Provider>
        </ReqoreUIProvider>
      );
    };
    render(<Late />);
    await waitFor(() => expect(document.querySelector('[data-field="cases"]')).toBeTruthy());
    await waitFor(() => expect(isExpanded('cases')).toBe(true));
  });
});
