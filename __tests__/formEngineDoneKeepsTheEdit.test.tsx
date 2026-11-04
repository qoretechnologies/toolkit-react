// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * What is typed into a read-first row and closed at once is what the row holds (qorus#646).
 *
 * A row's field keeps what is typed and reports it to the form after a short pause. Done closed the row - and
 * the field, and its pause - at once, so a value typed and Done pressed inside the pause never reached the
 * form: the row read as before ("This field is required" under a required field), and the form's host never
 * heard of the edit. Found in the Qorus IDE when its story harness stopped waiting after typing. Done now sends
 * the edit before the row closes, as does closing the row by its label or opening another row; Escape drops it.
 *
 * Every step here follows the one before at once, with nothing waited for between them: that is the case.
 */

const OPTIONS = {
  name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Name',
    required: true,
    preselected: true,
    sort: 1,
  },
  port: {
    type: 'int',
    ui_type: 'int',
    display_name: 'Port',
    preselected: true,
    sort: 2,
  },
  address: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Address',
    preselected: true,
    sort: 3,
  },
} as never;

const renderForm = (value: Record<string, unknown> = {}) => {
  const onChange = vi.fn();
  const view = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='server'
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

const isOpen = (container: HTMLElement, field: string) =>
  !!container.querySelector(
    `[data-field="${field}"].readfirst-row-editing, [data-field="${field}"].options-readfirst-card`
  );

const open = async (container: HTMLElement, field: string) => {
  await waitFor(() => expect(row(container, field)).toBeTruthy());
  fireEvent.click(row(container, field)!);
  await waitFor(() => expect(isOpen(container, field)).toBe(true));
};

const editor = (container: HTMLElement, field: string) =>
  container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-field="${field}"] input, [data-field="${field}"] textarea`
  )!;

/** Types into the open row's control, and nothing more: the field's pause has not run. */
const type = (container: HTMLElement, field: string, text: string) =>
  fireEvent.change(editor(container, field), { target: { value: text } });

/** Every value the host was handed for `field`. */
const reported = (onChange: ReturnType<typeof vi.fn>, field: string) =>
  onChange.mock.calls.map(
    ([, value]) => (value as Record<string, any> | undefined)?.[field]?.value
  );

describe('a read-first row closed straight after typing', () => {
  it('Done keeps what was typed: the row reads it and the host has it', async () => {
    const { container, onChange } = renderForm();
    await open(container, 'name');

    type(container, 'name', 'production');
    fireEvent.click(container.querySelector('.options-readfirst-done')!);

    await waitFor(() => expect(isOpen(container, 'name')).toBe(false));
    expect(row(container, 'name')?.textContent).toContain('production');
    expect(row(container, 'name')?.textContent).not.toContain('This field is required');
    await waitFor(() => expect(reported(onChange, 'name')).toContain('production'));
  });

  it('Done keeps a number typed into a number field, as the number', async () => {
    const { container, onChange } = renderForm();
    await open(container, 'port');

    type(container, 'port', '1883');
    fireEvent.click(container.querySelector('.options-readfirst-done')!);

    await waitFor(() => expect(isOpen(container, 'port')).toBe(false));
    expect(row(container, 'port')?.textContent).toContain('1883');
    await waitFor(() => expect(reported(onChange, 'port')).toContain(1883));
  });

  it('closing the row by its label keeps what was typed', async () => {
    const { container, onChange } = renderForm();
    await open(container, 'address');

    type(container, 'address', 'mqtt://broker:1883');
    fireEvent.click(
      container.querySelector('[data-field="address"] [aria-label="Collapse Address"]')!
    );

    await waitFor(() => expect(isOpen(container, 'address')).toBe(false));
    expect(row(container, 'address')?.textContent).toContain('mqtt://broker:1883');
    await waitFor(() => expect(reported(onChange, 'address')).toContain('mqtt://broker:1883'));
  });

  it('opening another row keeps what was typed in the row it closes', async () => {
    const { container, onChange } = renderForm();
    await open(container, 'name');

    type(container, 'name', 'production');
    // one row open at a time: opening this one closes the row typed into
    fireEvent.click(row(container, 'address')!);

    await waitFor(() => expect(isOpen(container, 'address')).toBe(true));
    expect(isOpen(container, 'name')).toBe(false);
    expect(row(container, 'name')?.textContent).toContain('production');
    await waitFor(() => expect(reported(onChange, 'name')).toContain('production'));
  });

  it('Done on two rows in a row keeps both', async () => {
    // the IDE's "Add Channel": a name, Done, an address, Done - each straight after the typing
    const { container, onChange } = renderForm();
    await open(container, 'name');
    type(container, 'name', 'orders');
    fireEvent.click(container.querySelector('.options-readfirst-done')!);
    await waitFor(() => expect(isOpen(container, 'name')).toBe(false));

    await open(container, 'address');
    type(container, 'address', 'orders/{id}');
    fireEvent.click(container.querySelector('.options-readfirst-done')!);
    await waitFor(() => expect(isOpen(container, 'address')).toBe(false));

    await waitFor(() => {
      const last = onChange.mock.calls[onChange.mock.calls.length - 1]?.[1] as Record<string, any>;
      expect(last?.name?.value).toBe('orders');
      expect(last?.address?.value).toBe('orders/{id}');
    });
  });

  it('Escape drops what was typed: the row keeps its value and the host never hears of the edit', async () => {
    const { container, onChange } = renderForm({ address: { type: 'string', value: 'kept' } });
    await open(container, 'address');

    type(container, 'address', 'thrown away');
    fireEvent.keyDown(editor(container, 'address'), { key: 'Escape' });

    await waitFor(() => expect(isOpen(container, 'address')).toBe(false));
    expect(row(container, 'address')?.textContent).toContain('kept');
    expect(reported(onChange, 'address')).not.toContain('thrown away');
  });
});
