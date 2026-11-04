// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const MESSAGE = 'Not available while Until Step is set. Clear Until Step to use this instead.';

/**
 * A field the form has not been given a value for sits in the Optional box, and opening its row opens its
 * editor with no value. The field's messages say why it cannot be used, so they belong in that editor.
 *
 * The Qorus IDE's event check (qorus#646): "Wait (ms)" cannot be set while "Until Step" is, so the IDE hands
 * it over disabled, with a message naming the field to clear. Opening the row showed the description and a
 * disabled input, and not the message. The message used to appear only because the number field reported ''
 * as it opened, which put the field in the form; since an untouched field reports nothing (b04b6707), the row
 * stayed a not-yet-set one, and such a row drew none of its messages, open or not.
 */
const mount = (type: string, onChange = vi.fn()) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='step'
          value={{ until_step: { type: 'string', value: 'login' } } as never}
          options={
            {
              until_step: { type: 'string', display_name: 'Until Step', preselected: true },
              timeout_ms: {
                type,
                display_name: 'Wait (ms)',
                short_desc: 'How long to wait for events still to come',
                disabled: true,
                messages: [{ intent: 'info', content: MESSAGE }],
              },
            } as never
          }
          onChange={onChange}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

beforeEach(() => {
  // the fields' pauses run on the test's clock; everything else runs as it would
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const row = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-field="timeout_ms"]');

/** Shows the Optional box's fields, which the compact form keeps folded. */
const showOptional = async (container: HTMLElement) => {
  const toggle = await waitFor(() => {
    const found = Array.from(
      container.querySelectorAll<HTMLElement>('.reqore-panel-title-label-row')
    ).find((el) => /^Optional\d+$/.test(el.textContent ?? ''));
    expect(found, 'no Optional box').toBeTruthy();
    return found as HTMLElement;
  });
  fireEvent.click(toggle);
  await waitFor(() => expect(row(container)).toBeTruthy());
};

const openRow = async (container: HTMLElement) => {
  fireEvent.click(row(container) as HTMLElement);
  await waitFor(() =>
    expect(container.querySelector('[data-field="timeout_ms"] .readfirst-row-editing')).toBeTruthy()
  );
};

describe('a disabled field with a message, not yet set, in the Optional box', () => {
  it.each([['*int'], ['int'], ['string']])(
    'a %s field shows its message when its row is opened',
    async (type) => {
      const onChange = vi.fn();
      const { container } = mount(type, onChange);
      await showOptional(container);
      await openRow(container);

      await waitFor(() => expect(row(container)?.textContent).toContain(MESSAGE));
      // the editor under it takes nothing, and opening it put nothing in the form
      expect(row(container)?.querySelector('input[disabled], textarea[disabled]')).toBeTruthy();
      expect(
        row(container)?.querySelector('input:not([disabled]), textarea:not([disabled])')
      ).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it('keeps its message to itself while its row is closed', async () => {
    const { container } = mount('*int');
    await showOptional(container);
    expect(row(container)?.textContent).toContain('Wait (ms)');
    expect(row(container)?.textContent).not.toContain(MESSAGE);
  });
});
