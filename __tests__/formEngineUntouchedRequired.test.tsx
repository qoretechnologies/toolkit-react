import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
 * A new form must not greet its reader with an error.
 *
 * `expandFirstRequired` opens the first field that needs attention, so on a
 * brand-new interface the reader's first sight of the form was an open editor
 * with "This field is required" under it — an error report about a mistake
 * nobody had made yet. The requirement itself was never in doubt: the label
 * carries an asterisk, the row sits in the Needs-attention box, and the meter
 * reads 0%.
 *
 * Being in the field and leaving it empty is a different thing, and it still
 * shows.
 */
const REQUIRED_MESSAGE = 'This field is required';

const SCHEMA = {
  title: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Title',
    required: true,
  },
} as never;

const renderForm = (value: Record<string, unknown> = {}, props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='iface'
          value={value as never}
          options={SCHEMA}
          expandFirstRequired
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

describe('an untouched required field', () => {
  it('states no error on arrival, while still counting as needing attention', async () => {
    renderForm();
    // The row is open — this is the state the reader actually meets.
    await waitFor(() => expect(document.querySelector('[data-field="title"]')).toBeTruthy());
    await waitFor(() =>
      expect(document.querySelector('[data-field="title"]')!.className).not.toContain(
        'readfirst-row'
      )
    );
    expect(document.body.textContent).not.toContain(REQUIRED_MESSAGE);
    // The requirement is still stated — the field has not quietly become optional.
    expect(document.body.textContent).toContain('Needs attention');
  });

  it('states the error once the reader has been in it and left it empty', async () => {
    const user = userEvent.setup();
    // A filled field needs no attention, so nothing auto-opens it; the reader
    // opens it themselves, which `initialExpandedOptions` stands in for here.
    renderForm(
      { title: { type: 'string', value: 'Order intake' } },
      {
        initialExpandedOptions: ['title'],
      }
    );
    const input = await screen.findByDisplayValue('Order intake');
    await user.clear(input);
    await waitFor(() => expect(document.body.textContent).toContain(REQUIRED_MESSAGE));
  });
});
