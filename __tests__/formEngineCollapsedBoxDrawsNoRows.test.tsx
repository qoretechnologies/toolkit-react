import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * The rows of a compact form are drawn once, each into a node of its own, and that node is moved into whichever box
 * shows the row (`rowPlaces`), so a row that changes box is the same row. A collapsed box shows none of its rows,
 * and it does not draw them either: drawn inside their box, they were not mounted until it opened, and an Optional
 * box of fifty unset fields - collapsed on every new form - costs nothing until someone opens it. The portal each
 * row is drawn through is what says a row is drawn.
 */
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return { ...actual, createPortal: vi.fn(actual.createPortal) };
});

const fetchContext = emptyFetchContext();

const SCHEMA = {
  title: { type: 'string', ui_type: 'string', display_name: 'Title', required: true },
  notes: { type: 'string', ui_type: 'string', display_name: 'Notes' },
  owner: { type: 'string', ui_type: 'string', display_name: 'Owner' },
  label: { type: 'string', ui_type: 'string', display_name: 'Label' },
} as never;

const OPTIONAL = ['notes', 'owner', 'label'];

const Form = (props: Record<string, unknown>) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={fetchContext}>
      <FormEngine
        compact
        name='rows'
        value={{} as never}
        options={SCHEMA}
        expandFirstRequired={false}
        onChange={vi.fn()}
        {...props}
      />
    </FetchContext.Provider>
  </ReqoreUIProvider>
);

/** The rows drawn since the last clear: the names their portals carry. */
const drawnRows = () =>
  vi
    .mocked(createPortal)
    .mock.calls.filter(([, container]) =>
      (container as Element | undefined)?.classList?.contains('readfirst-row-host')
    )
    .map(([, , key]) => key);

const optionalBox = () =>
  Array.from(document.querySelectorAll('.options-readfirst-group')).find((panel) =>
    panel.querySelector('.reqore-panel-title')?.textContent?.includes('Optional')
  );

describe('a collapsed box', () => {
  it('draws none of its rows until it is opened, and lets them go when it closes', async () => {
    vi.mocked(createPortal).mockClear();
    const { rerender } = render(<Form />);
    await waitFor(() => expect(optionalBox()).toBeTruthy());
    // collapsed on a new form: its rows are counted, not drawn
    expect(optionalBox()!.querySelector('.reqore-panel-content')).toBeNull();
    expect(drawnRows()).toContain('title');
    OPTIONAL.forEach((name) => expect(drawnRows()).not.toContain(name));

    // opened: its rows are drawn, in the box
    fireEvent.click(optionalBox()!.querySelector('.reqore-panel-title') as HTMLElement);
    await waitFor(() =>
      OPTIONAL.forEach((name) =>
        expect(
          optionalBox()?.querySelector(`.readfirst-row[data-field="${name}"]`)?.isConnected
        ).toBe(true)
      )
    );

    // closed again: they go with it, and a later render does not draw them
    fireEvent.click(optionalBox()!.querySelector('.reqore-panel-title') as HTMLElement);
    await waitFor(() => expect(optionalBox()!.querySelector('.reqore-panel-content')).toBeNull());
    vi.mocked(createPortal).mockClear();
    rerender(<Form />);
    await waitFor(() => expect(drawnRows()).toContain('title'));
    OPTIONAL.forEach((name) => expect(drawnRows()).not.toContain(name));
  });
});

/** A set title and a set optional note, the note open: its value is in the form as it is typed. */
const EditedForm = ({ onValue }: { onValue: (value: Record<string, { value?: unknown }>) => void }) => {
  const [value, setValue] = useState<Record<string, { type: string; value?: unknown }>>({
    title: { type: 'string', value: 'Order sync' },
    notes: { type: 'string', value: 'Weekly' },
  });
  return (
    <Form
      value={value as never}
      initialExpandedOptions={['notes']}
      onChange={(_name: string, next: Record<string, { type: string; value?: unknown }>) => {
        setValue(next ?? {});
        onValue(next ?? {});
      }}
    />
  );
};

describe('a row being edited', () => {
  it('does not move into a collapsed box: an optional value cleared stays under the caret', async () => {
    const onValue = vi.fn();
    render(<EditedForm onValue={onValue} />);
    const input = await waitFor(() => {
      const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '[data-field="notes"] input, [data-field="notes"] textarea'
      );
      expect(element).toBeTruthy();
      return element!;
    });
    const boxOf = () =>
      input.closest('.options-readfirst-group')?.querySelector('.reqore-panel-title')?.textContent ?? '';
    expect(boxOf()).toMatch(/^\s*Set/);
    await userEvent.click(input);
    await userEvent.clear(input);
    // the form holds the empty value (a text field hands it on after a pause): it belongs in Optional, which is
    // collapsed, so it stays in Set - the same box, the caret in it
    await waitFor(
      () =>
        expect(onValue).toHaveBeenLastCalledWith(
          expect.objectContaining({ notes: expect.objectContaining({ value: '' }) })
        ),
      { timeout: 3000 }
    );
    // the form has drawn what it holds
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(input.isConnected).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(boxOf()).toMatch(/^\s*Set/);
    expect(optionalBox()!.querySelector('.reqore-panel-content')).toBeNull();
    await userEvent.type(input, 'Daily');
    await waitFor(() => expect(input.value).toBe('Daily'));
    expect(document.activeElement).toBe(input);
  });
});
