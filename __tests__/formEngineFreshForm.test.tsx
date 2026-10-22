import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A new form is not already wrong. It used to open with "2 need attention" and every
 * required field in amber before anyone had typed a thing, so the first thing a person
 * met was a list of faults. Until they have been to a field (opened it and left it) or
 * the host reports a submit attempt (`revealRequired`), an empty required field is only
 * still to fill in: the first box reads "To fill in", in the quiet colour.
 */
const SCHEMA = {
  title: { type: 'string', ui_type: 'string', display_name: 'Title', required: true },
  owner: { type: 'string', ui_type: 'string', display_name: 'Owner', required: true },
} as never;

const renderForm = (props: Record<string, unknown> = {}) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='iface'
          value={{} as never}
          options={SCHEMA}
          expandFirstRequired={false}
          onChange={vi.fn()}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const header = async () => {
  await waitFor(() => expect(document.querySelector('.options-readfirst-completion')).toBeTruthy());
  return (document.querySelector('.options-readfirst-completion') as HTMLElement).textContent || '';
};

describe('a new form', () => {
  it('opens with its required fields to fill in, not as faults', async () => {
    renderForm();
    const text = await header();
    expect(text).toContain('2 to fill in');
    expect(text).not.toContain('need attention');
    expect(document.body.textContent).toContain('To fill in');
    expect(document.body.textContent).not.toContain('Needs attention');
  });

  it('shows every empty required field as needing attention after a submit attempt', async () => {
    renderForm({ revealRequired: true });
    const text = await header();
    expect(text).toContain('2 need attention');
    expect(document.body.textContent).toContain('Needs attention');
    expect(document.body.textContent).not.toContain('To fill in');
  });

  it('turns a field into a fault once someone has been to it and left it empty', async () => {
    const user = userEvent.setup();
    // The reader has the Title row open; opening Owner closes it (one row at a time),
    // so Title has been visited and left empty.
    renderForm({ initialExpandedOptions: ['title'] });
    await waitFor(() => expect(document.querySelector('[data-field="owner"]')).toBeTruthy());
    expect(await header()).toContain('to fill in');
    await user.click(document.querySelector('[data-field="owner"]') as HTMLElement);
    await waitFor(async () => expect(await header()).toContain('need attention'));
    expect(screen.getByText('Needs attention')).toBeTruthy();
  });
});
