/**
 * A field followed across the form's boxes flashes, and the flash sets no state after the change that caused it.
 *
 * The flash's class was taken off by a timer 1.4s later. That update came from no event, so React reported it as one a
 * test had not waited for ("An update to FormEngineImpl inside a test was not wrapped in act(...)"), and once more
 * for every row reading the form's context: a thousand times a story in the Qorus IDE's API schema forms, whose
 * stories fail on any React warning (board t-96). The class now stays on once its animation has played.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchContext } from '../src/contexts/FetchContext';
import { FormEngine, IOptionsSchema } from '../src/components/form/engine/FormEngine';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const schema: IOptionsSchema = {
  url: {
    type: 'string',
    ui_type: 'string',
    display_name: 'URL',
    required: true,
    supports_expressions: false,
    supports_templates: false,
  },
  description: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Description',
    supports_expressions: false,
    supports_templates: false,
  },
};

const form = (value: Record<string, unknown>) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>
      <FormEngine compact name='docs' value={value} options={schema} />
    </FetchContext.Provider>
  </ReqoreUIProvider>
);

const row = (name: string) => document.querySelector<HTMLElement>(`.readfirst-row[data-field="${name}"]`);

describe('the flash that follows a moved field', () => {
  let errors: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errors.mockRestore();
  });

  const lateUpdates = () =>
    errors.mock.calls.filter((call) => String(call[0]).includes('not wrapped in act'));

  it('flashes the row, and sets no state once the change has been made', async () => {
    const { rerender } = render(form({}));
    await waitFor(() => expect(row('url')).toBeTruthy());

    // Filled, the required URL moves from "To fill in" to "Set", and is followed there.
    rerender(form({ url: { type: 'string', value: 'https://docs.example.com/orders' } }));
    await waitFor(() => expect(row('url')?.className).toContain('readfirst-row-flash'));

    // Longer than the flash lasts: nothing comes back to take it off.
    await new Promise((resolve) => setTimeout(resolve, 1700));

    expect(lateUpdates()).toEqual([]);
  });

  it('starts the animation again when the same row flashes again', async () => {
    const { rerender } = render(form({}));
    await waitFor(() => expect(row('url')).toBeTruthy());

    rerender(form({ url: { type: 'string', value: 'https://docs.example.com/orders' } }));
    await waitFor(() => expect(row('url')?.className).toContain('readfirst-row-flash'));
    const first = row('url')!.classList.contains('readfirst-row-flash-again');

    // Emptied, it goes back to "To fill in", and is followed there too: a new animation name.
    rerender(form({ url: { type: 'string', value: '' } }));
    await waitFor(() =>
      expect(row('url')!.classList.contains('readfirst-row-flash-again')).toBe(!first)
    );
    expect(row('url')?.className).toContain('readfirst-row-flash');
  });
});
