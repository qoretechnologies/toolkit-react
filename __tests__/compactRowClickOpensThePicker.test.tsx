import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

/**
 * A click on a closed row means "let me change this".
 *
 * Compact rows are read-first: a collapsed row prints the value, and opening it
 * mounts the editor. For a PICKER that was not the whole story — the editor a
 * picker mounts is a closed trigger printing the same value the read row had
 * just printed, so the row opened, nothing on screen changed, and the author
 * had to click a second time to see the choices. Reported on a test case's
 * Kind row: "clicking on a closed option like 'Kind' opens the option, but the
 * same chosen value is displayed".
 *
 * Read-first is kept everywhere it says something: on the collapsed row, on a
 * row the FORM opened (an address, the first-attention row, a diagram showing a
 * step), and on the card a complex field opens.
 */
const fetchContext = emptyFetchContext();

const KIND_VALUES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map((kind) => ({
  display_name: kind,
  short_desc: `the ${kind} kind`,
  value: { type: 'string', value: kind },
}));

const kindSchema = (values = KIND_VALUES) => ({
  kind: {
    type: 'string',
    display_name: 'Kind',
    required: true,
    preselected: true,
    allowed_values: values,
  },
});

const renderForm = (
  options: unknown,
  value: unknown = {},
  props: Record<string, unknown> = {},
  onChange = vi.fn()
) => {
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          compact
          name='picker-row'
          value={value as never}
          options={options as never}
          onChange={onChange}
          {...props}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  return onChange;
};

const closedRow = async (field: string): Promise<HTMLElement> =>
  waitFor(() => {
    const row = document.querySelector(`[data-field="${field}"].readfirst-row`);
    expect(row, `the closed ${field} row`).toBeTruthy();
    return row as HTMLElement;
  });

/**
 * A choice that is NOT the current value, so finding it on screen can only mean
 * the list is open — a closed trigger prints the value and nothing else.
 */
const anUnchosenChoice = () => screen.queryAllByText('gamma');

describe('opening a compact row that holds a choice', () => {
  it('lands the author in the list of choices, in ONE click', async () => {
    renderForm(kindSchema(), { kind: { type: 'string', value: 'beta' } });

    const row = await closedRow('kind');
    // Before the click the row is read-first: the value, and nothing to pick from.
    expect(anUnchosenChoice()).toHaveLength(0);

    fireEvent.click(row);

    await waitFor(() => expect(anUnchosenChoice().length).toBeGreaterThan(0));
  });

  it('opens the list from the keyboard too, since Enter is how the row is a control', async () => {
    renderForm(kindSchema(), { kind: { type: 'string', value: 'beta' } });

    const row = await closedRow('kind');
    fireEvent.keyDown(row, { key: 'Enter' });

    await waitFor(() => expect(anUnchosenChoice().length).toBeGreaterThan(0));
  });

  it('opens the dialog picker too, which is the one a host without an anchored list draws', async () => {
    // `forceDropdown={false}` is what qorus-ide's forms pass: described choices
    // open the full "Select from items" dialog rather than an anchored list.
    // Two renderings of the same question, and the row has to reach both.
    renderForm(
      kindSchema(),
      { kind: { type: 'string', value: 'beta' } },
      { forceDropdown: false }
    );

    fireEvent.click(await closedRow('kind'));

    await waitFor(() => expect(screen.queryAllByText('Select from items').length).toBeGreaterThan(0));
    expect(anUnchosenChoice().length).toBeGreaterThan(0);
  });

  it('does not answer the question for the author', async () => {
    const onChange = renderForm(kindSchema(), { kind: { type: 'string', value: 'beta' } });

    fireEvent.click(await closedRow('kind'));

    await waitFor(() => expect(anUnchosenChoice().length).toBeGreaterThan(0));
    // Opening a picker is not choosing from it: the value is untouched until
    // the author picks one.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes the row again on a second click, without reopening the list', async () => {
    renderForm(kindSchema(), { kind: { type: 'string', value: 'beta' } });

    const row = await closedRow('kind');
    fireEvent.click(row);
    await waitFor(() => expect(anUnchosenChoice().length).toBeGreaterThan(0));

    // The same target the author clicked to open it — the row's label, which is
    // what an open inline row offers as its collapse control.
    const collapse = document.querySelector('[aria-label="Collapse Kind"]') as HTMLElement;
    expect(collapse).toBeTruthy();
    fireEvent.click(collapse);

    await waitFor(() => expect(document.querySelector('.readfirst-row-editing')).toBeNull());
  });
});

describe('where read-first is still the answer', () => {
  it('leaves a text row alone: the caret is in the text box and nothing pops up', async () => {
    renderForm({
      title: { type: 'string', display_name: 'Title', required: true, preselected: true },
    });

    fireEvent.click(await closedRow('title'));

    await waitFor(() =>
      expect(['INPUT', 'TEXTAREA']).toContain((document.activeElement as HTMLElement).tagName)
    );
    // Typing is the editor here; there is no list to open and none was opened.
    expect(document.querySelector('[aria-haspopup]')).toBeNull();
  });

  it('leaves a pick-one row alone: its choices are already on the row', async () => {
    const onChange = renderForm(kindSchema(KIND_VALUES.slice(0, 2)), {
      kind: { type: 'string', value: 'alpha' },
    });

    fireEvent.click(await closedRow('kind'));

    // Both candidates are drawn as checkboxes in the row itself — nothing to
    // reveal, and nothing clicked on the author's behalf.
    await waitFor(() => expect(screen.queryAllByText('beta').length).toBeGreaterThan(0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not throw a list over a row the FORM opened', async () => {
    // `initialExpandedOptions` is an address: the host is showing this row, not
    // asking the question. qorus-ide's diagram opens rows this way.
    renderForm(
      kindSchema(),
      { kind: { type: 'string', value: 'beta' } },
      { initialExpandedOptions: ['kind'] }
    );

    await waitFor(() => expect(document.querySelector('.readfirst-row-editing')).toBeTruthy());
    expect(anUnchosenChoice()).toHaveLength(0);
  });

  it('does not throw a list over the first-attention row either', async () => {
    // `autoFocusFirstRequired` promises the caret, and the caret alone: the
    // reader is landed on the control, with the row still readable around it.
    renderForm(kindSchema(), {}, { autoFocusFirstRequired: true });

    await waitFor(() =>
      expect(
        document.querySelector('[data-field="kind"]')?.contains(document.activeElement)
      ).toBe(true)
    );
    expect(anUnchosenChoice()).toHaveLength(0);
  });
});
