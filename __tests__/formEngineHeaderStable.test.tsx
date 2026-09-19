import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const OPTIONS = {
  name: { type: 'string', display_name: 'Name' },
  title: { type: 'string', display_name: 'Title' },
  mode: { type: 'string', display_name: 'Mode' },
} as never;

const renderForm = (value: object) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='case'
          value={value as never}
          options={OPTIONS}
          onChange={vi.fn()}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

/** The toolbar's search row — the thing whose arrival grew the header. */
const searchRows = (container: HTMLElement) =>
  container.querySelectorAll('input[placeholder*="ilter"], input[type="search"]').length;

/**
 * A form's header must not change shape when its VALUE arrives.
 *
 * The search row was rendered only when `size(availableOptions) > 1`, and
 * `availableOptions` is keyed off the value — so a form that mounted before its
 * data landed drew a thin header, then added a 38px row when the values turned
 * up. Everything below it moved. Measured on the Qorus IDE's test editor, on
 * the nested sub-form of a test case: 33 elements jumped down 51px in one
 * frame, on every cold load.
 *
 * How many fields a form has is a property of its SCHEMA, and the schema is
 * known before the value.
 */
describe('a compact form header while its value is still arriving', () => {
  it('offers search for a multi-field schema even with no value yet', async () => {
    const { container } = renderForm({});
    await waitFor(() => expect(container.textContent).toContain('Name'));
    expect(searchRows(container)).toBeGreaterThan(0);
  });

  it('offers the same search once the value has arrived', async () => {
    const { container } = renderForm({ name: { type: 'string', value: 'case_1' } });
    await waitFor(() => expect(container.textContent).toContain('Name'));
    expect(searchRows(container)).toBeGreaterThan(0);
  });

  it('still offers no search for a single-field schema', async () => {
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='one'
            value={{} as never}
            options={{ only: { type: 'string', display_name: 'Only' } } as never}
            onChange={vi.fn()}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(container.textContent).toContain('Only'));
    expect(searchRows(container)).toBe(0);
  });
});
