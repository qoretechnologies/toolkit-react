// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A compact row opens or closes by what the user did to the row as it was drawn (qorus#646).
 *
 * A click on a row was a toggle that read its direction from the latest state. The first-required scan opens its
 * row with an update of its own; a click on that row, still drawn closed, landed on top of it and closed the row
 * the user had just opened, in the same task (the Qorus IDE's Schema "Draft Is Saved", whose read-first form
 * turns the first-required step on). Now a click on a row drawn closed opens it whatever update is pending, and
 * Done, Cancel and the label close it.
 */

const OPTIONS = {
  name: { type: 'string', ui_type: 'string', display_name: 'Name', required: true, sort: 1 },
  keyName: { type: 'string', ui_type: 'string', display_name: 'Key name', required: true, sort: 2 },
  description: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Description',
    preselected: true,
    sort: 3,
  },
} as never;

/** A form opened from a button: the button still holds the focus as the form mounts, so the scan waits. */
const renderDrawer = (value: Record<string, unknown> = {}) => {
  const onChange = vi.fn();
  const view = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <button id='opener' autoFocus>
          Add a security scheme
        </button>
        <FormEngine
          compact
          autoFocusFirstRequired
          name='scheme'
          value={value as never}
          options={OPTIONS}
          onChange={onChange}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  return { onChange, ...view };
};

const row = (container: HTMLElement, field: string) =>
  container.querySelector<HTMLElement>(`[data-field="${field}"]`);

const openRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.readfirst-row-editing')).map(
    (element) => element.dataset.field
  );

const control = (container: HTMLElement, field: string) =>
  container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-field="${field}"] input, [data-field="${field}"] textarea`
  );

const required = <T,>(found: T | null | undefined, what: string): T => {
  if (!found) {
    throw new Error(`${what} is missing`);
  }
  return found;
};

describe('a click on a compact row', () => {
  it('opens a row drawn closed, even when the first-required scan opens it in the same moment', async () => {
    const { container } = renderDrawer();
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());
    expect(openRows(container)).toEqual([]);

    act(() => {
      // Tab from the button into the form: the scan opens "name", the first row that needs an answer, with an
      // update of its own...
      required(row(container, 'description'), 'the "description" row').focus();
      // ...and before that is drawn, the user clicks "name", which is still drawn closed
      fireEvent.click(required(row(container, 'name'), 'the "name" row'));
    });

    // the row the user clicked is open, and stays open: the click did not close what the scan opened
    await waitFor(() => expect(openRows(container)).toEqual(['name']));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(openRows(container)).toEqual(['name']);
  });

  it('opens a row drawn closed, and Done closes it', async () => {
    const user = userEvent.setup();
    const { container } = renderDrawer();
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    await user.click(required(row(container, 'name'), 'the "name" row'));
    await waitFor(() => expect(openRows(container)).toEqual(['name']));
    fireEvent.change(required(control(container, 'name'), 'the "name" input'), {
      target: { value: 'api_key' },
    });
    await user.click(
      required(container.querySelector<HTMLElement>('.options-readfirst-done'), 'Done')
    );

    await waitFor(() => expect(openRows(container)).toEqual([]));
    expect(row(container, 'name')?.textContent).toContain('api_key');

    // and a click opens it again
    await user.click(required(row(container, 'name'), 'the "name" row'));
    await waitFor(() => expect(openRows(container)).toEqual(['name']));
  });

  it('Cancel edit closes the open row and puts its value back', async () => {
    const user = userEvent.setup();
    const { container } = renderDrawer({ name: { type: 'string', value: 'api_key' } });
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    await user.click(required(row(container, 'name'), 'the "name" row'));
    await waitFor(() => expect(openRows(container)).toEqual(['name']));
    fireEvent.change(required(control(container, 'name'), 'the "name" input'), {
      target: { value: 'something else' },
    });
    await user.click(
      await waitFor(() =>
        required(container.querySelector<HTMLElement>('.options-readfirst-cancel'), 'Cancel edit')
      )
    );

    await waitFor(() => expect(openRows(container)).toEqual([]));
    expect(row(container, 'name')?.textContent).toContain('api_key');
  });

  it("a second click, on the open row's label, closes it", async () => {
    const user = userEvent.setup();
    const { container } = renderDrawer();
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    await user.click(required(row(container, 'name'), 'the "name" row'));
    await waitFor(() => expect(openRows(container)).toEqual(['name']));
    await user.click(
      required(
        container.querySelector<HTMLElement>('[aria-label="Collapse Name"]'),
        "the row's label"
      )
    );

    await waitFor(() => expect(openRows(container)).toEqual([]));
  });

  it('the label closes the open row after the scan opened it, and the next click opens it again', async () => {
    const user = userEvent.setup();
    const { container } = renderDrawer();
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    // the scan opens "name" for a user who comes in from the keyboard
    act(() => required(row(container, 'description'), 'the "description" row').focus());
    await waitFor(() => expect(openRows(container)).toEqual(['name']));

    await user.click(
      required(
        container.querySelector<HTMLElement>('[aria-label="Collapse Name"]'),
        "the row's label"
      )
    );
    await waitFor(() => expect(openRows(container)).toEqual([]));
    await user.click(required(row(container, 'name'), 'the "name" row'));
    await waitFor(() => expect(openRows(container)).toEqual(['name']));
  });
});
