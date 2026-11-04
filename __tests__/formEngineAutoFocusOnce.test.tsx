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
 * `autoFocusFirstRequired` puts the caret in the first row that needs an answer, once (qorus#646).
 *
 * A form opened from a button - a drawer - mounts while that button still holds the focus, so the scan waits
 * for the focus to be free. It waited past the user: they opened a row and typed, and the first moment the
 * focus rested on nothing was the Done that closed their row. With the edit landing at that moment, the scan
 * ran then and opened the next row that needed an answer by itself, in the middle of the user's work (the
 * Qorus IDE's security scheme editor opened "keyName" after Done on "name").
 *
 * Once the user has opened a row themselves, they have chosen where to work, and the scan is spent. A user
 * who comes into the form from the keyboard, without choosing a row, is still put in the first row that
 * needs an answer, once.
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

/** The drawer: the button that opened it still holds the focus as the form mounts. */
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

describe('autoFocusFirstRequired in a form opened from a button', () => {
  it('waits while the button that opened it holds the focus', async () => {
    const { container } = renderDrawer();
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    expect(document.activeElement?.id).toBe('opener');
    expect(openRows(container)).toEqual([]);
  });

  it('opens nothing by itself once the user has opened a row: Done on it leaves the form as it is', async () => {
    const user = userEvent.setup();
    const { container } = renderDrawer();
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    await user.click(row(container, 'name')!);
    await waitFor(() => expect(openRows(container)).toEqual(['name']));
    fireEvent.change(control(container, 'name')!, { target: { value: 'api_key' } });
    await user.click(container.querySelector<HTMLElement>('.options-readfirst-done')!);

    await waitFor(() => expect(row(container, 'name')?.textContent).toContain('api_key'));
    // the focus is free now, and "keyName" still needs an answer: it is not opened for the user
    expect(openRows(container)).toEqual([]);
    expect(document.activeElement).toBe(document.body);
  });

  it('opens nothing by itself after the user has typed into a row and moved to another', async () => {
    const user = userEvent.setup();
    const { container } = renderDrawer();
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    await user.click(row(container, 'description')!);
    await waitFor(() => expect(openRows(container)).toEqual(['description']));
    fireEvent.change(control(container, 'description')!, { target: { value: 'the key' } });
    await user.click(container.querySelector<HTMLElement>('.options-readfirst-done')!);
    await waitFor(() => expect(openRows(container)).toEqual([]));

    await user.click(row(container, 'name')!);
    await waitFor(() => expect(openRows(container)).toEqual(['name']));
    fireEvent.change(control(container, 'name')!, { target: { value: 'api_key' } });
    await user.click(container.querySelector<HTMLElement>('.options-readfirst-done')!);

    await waitFor(() => expect(row(container, 'name')?.textContent).toContain('api_key'));
    expect(openRows(container)).toEqual([]);
  });

  it('puts a user who comes in from the keyboard in the first row that needs an answer, once', async () => {
    const user = userEvent.setup();
    const { container } = renderDrawer();
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());
    expect(openRows(container)).toEqual([]);

    // Tab from the button that opened the form lands on a row, which the user has not chosen
    act(() => row(container, 'description')!.focus());

    await waitFor(() => expect(openRows(container)).toEqual(['name']));
    await waitFor(() => expect(document.activeElement).toBe(control(container, 'name')));

    // and only once: answering it and closing it opens nothing else
    fireEvent.change(control(container, 'name')!, { target: { value: 'api_key' } });
    await user.click(container.querySelector<HTMLElement>('.options-readfirst-done')!);
    await waitFor(() => expect(row(container, 'name')?.textContent).toContain('api_key'));
    expect(openRows(container)).toEqual([]);
    act(() => row(container, 'description')!.focus());
    expect(openRows(container)).toEqual([]);
  });

  it('leaves the focus where it is when nothing needs an answer', async () => {
    const { container } = renderDrawer({
      name: { type: 'string', value: 'api_key' },
      keyName: { type: 'string', value: 'X-Key' },
    });
    await waitFor(() => expect(row(container, 'name')).toBeTruthy());

    act(() => row(container, 'description')!.focus());

    expect(openRows(container)).toEqual([]);
    expect(document.activeElement).toBe(row(container, 'description'));
  });
});

describe('autoFocusFirstRequired in a form mounted with the focus free', () => {
  it('opens the first row that needs an answer at once, as before', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            autoFocusFirstRequired
            name='scheme'
            value={{} as never}
            options={OPTIONS}
            onChange={onChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );

    await waitFor(() => expect(openRows(container)).toEqual(['name']));
    await waitFor(() => expect(document.activeElement).toBe(control(container, 'name')));
  });
});
