import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, waitFor } from '@testing-library/react';
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
 * Two affordances on a compact form that both stopped one click short of the
 * thing they exist to reveal.
 *
 * Reported together on an auth profile:
 *
 *  - "+ Add new item for Authentication Scheme" added a row whose ONE required
 *    field — the scheme type, without which the profile cannot be saved — sat
 *    collapsed behind a second click.
 *  - Opening the "Optional" box at the bottom of a form mounted its fields below
 *    the fold, so the click looked like it had done nothing.
 *
 * Both are the same shape: an action whose whole point is to reveal something,
 * that leaves the something unrevealed.
 */

/** The auth-profile scheme sub-schema: one required choice, one dependent field. */
const SCHEME_SCHEMA = {
  type: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Scheme Type',
    required: true,
    short_desc: 'Authentication scheme type',
    allowed_values: [
      { value: 'default', display_name: 'Default RBAC' },
      { value: 'cookie', display_name: 'Cookie' },
    ],
  },
  cookie_name: {
    type: 'string',
    ui_type: 'string',
    display_name: 'Session Cookie Name',
  },
} as never;

const renderForm = (options: never, value?: never) =>
  render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine compact name='profile' value={value} options={options} onChange={vi.fn()} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );

const findByText = (container: HTMLElement, selector: string, text: string) =>
  [...container.querySelectorAll(selector)].find((el) => (el.textContent || '').includes(text));

/**
 * Whether a field's row is OPEN.
 *
 * CompactRow gives an expanded row one of two shapes — an inline editing row or
 * an expanded card — and a collapsed one gets neither. The selector has to carry
 * the class, not just the field: a nested sub-form wraps its row in a second
 * element that also carries `data-field`, so querying the field alone can return
 * the wrapper and report every row as collapsed.
 */
const isFieldExpanded = (container: HTMLElement, field: string) =>
  !!container.querySelector(
    `[data-field="${field}"].readfirst-row-editing, [data-field="${field}"].options-readfirst-card`
  );

describe('a just-added list row opens the field it cannot be saved without', () => {
  const OPTIONS = {
    schemes: {
      type: 'list',
      ui_type: 'list',
      element_type: 'hash',
      display_name: 'Authentication Schemes',
      required: true,
      arg_schema: SCHEME_SCHEMA,
    },
  } as never;

  /** Open the list field itself, which mounts ArrayAuto and its Add button. */
  const openList = async (container: HTMLElement) => {
    await waitFor(() => expect(container.querySelector('[data-field="schemes"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[data-field="schemes"]')!);
    await waitFor(() =>
      expect(findByText(container, 'button', 'Add new item')).toBeTruthy()
    );
  };

  it('expands the required sub-field of the row it just added', async () => {
    const { container } = renderForm(OPTIONS);
    await openList(container);

    fireEvent.click(findByText(container, 'button', 'Add new item')!);

    // The row's required field is OPEN — an editing row or an expanded card,
    // which are the two shapes CompactRow gives an expanded row. Collapsed, it
    // renders neither: the read-first row carries plain `readfirst-row` only.
    await waitFor(() => expect(isFieldExpanded(container, 'type')).toBe(true));
  });

  it('leaves the OTHER sub-fields of that row alone', async () => {
    // "Open the first thing that needs attention", not "open everything". A row
    // that expanded every field would be the classic stacked form again.
    const { container } = renderForm(OPTIONS);
    await openList(container);
    fireEvent.click(findByText(container, 'button', 'Add new item')!);

    await waitFor(() => expect(isFieldExpanded(container, 'type')).toBe(true));
    // Either not offered yet (it is optional, so it lives in the Optional box)
    // or offered and collapsed — never expanded.
    expect(isFieldExpanded(container, 'cookie_name')).toBe(false);
  });

  it('does not open a required field on rows that were already there', async () => {
    // A value that arrived from the server has an empty required field too. The
    // author did not just create it, and re-opening it on every mount would
    // reopen a decision they may have deliberately left for later.
    const { container } = renderForm(OPTIONS, {
      schemes: { type: 'list', value: [{ type: 'hash', value: {} }] },
    } as never);
    await openList(container);

    await waitFor(() => expect(container.querySelector('[data-field="type"]')).toBeTruthy());
    expect(isFieldExpanded(container, 'type')).toBe(false);
  });
});

describe('opening a status box scrolls its content into view', () => {
  // Every optional field lives in the "Optional" box, which stacks last — so on
  // a form of any length it opens below the fold.
  const OPTIONAL_ONLY = {
    first: { type: 'string', ui_type: 'string', display_name: 'First Option' },
    second: { type: 'string', ui_type: 'string', display_name: 'Second Option' },
    third: { type: 'string', ui_type: 'string', display_name: 'Third Option' },
  } as never;

  /** The status box carrying `label`, and its collapse control (the only button
   *  in its header). */
  const statusBox = (container: HTMLElement, label: string) =>
    [...container.querySelectorAll('.options-readfirst-group')].find((group) =>
      (group.textContent || '').startsWith(label)
    );

  it('reveals the rows the click just mounted', async () => {
    // jsdom implements no scrolling at all — `scrollIntoView` is not on the
    // prototype — so the call itself IS the observable behaviour here. What the
    // browser then does with `block: 'nearest'` is the browser's contract, not
    // this component's.
    const scrollIntoView = vi.fn();
    (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView = scrollIntoView;

    // A form of ONLY optional fields opens its Optional box by itself, which
    // would fire the reveal before the test could act. One required field beside
    // them restores the reported shape: a collapsed Optional box under
    // something else.
    const { container } = renderForm({
      required_one: {
        type: 'string',
        ui_type: 'string',
        display_name: 'Required Option',
        required: true,
      },
      ...(OPTIONAL_ONLY as object),
    } as never);

    await waitFor(() => expect(statusBox(container, 'Optional')).toBeTruthy());
    const box = statusBox(container, 'Optional')!;
    expect(container.querySelector('[data-field="first"]')).toBeNull();

    scrollIntoView.mockClear();
    fireEvent.click(box.querySelector('button')!);

    // The rows exist AND the box was scrolled to — the reveal has to happen
    // after the rows mount, or it scrolls to a box that has not grown yet.
    await waitFor(() => expect(container.querySelector('[data-field="first"]')).toBeTruthy());
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: 'nearest' });

    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('does not scroll when a box is COLLAPSED', async () => {
    // Closing a box moves content off the screen on purpose. Scrolling to it
    // would fight the user's own decision to put it away.
    const scrollIntoView = vi.fn();
    (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView = scrollIntoView;

    const { container } = renderForm(OPTIONAL_ONLY);

    // An all-optional form opens the box itself, so the first click here closes it.
    await waitFor(() => expect(container.querySelector('[data-field="first"]')).toBeTruthy());
    const box = statusBox(container, 'Optional')!;

    scrollIntoView.mockClear();
    fireEvent.click(box.querySelector('button')!);

    await waitFor(() => expect(container.querySelector('[data-field="first"]')).toBeNull());
    expect(scrollIntoView).not.toHaveBeenCalled();

    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });
});

describe('a chosen value survives being opened', () => {
  /**
   * The data-loss half of the same report. A sub-field whose `allowed_values`
   * are written the bare way (`{value: 'default', display_name: 'Default RBAC'}`)
   * had its value cleared as the form loaded, because the engine's clearing
   * guard recognised only two of the three shapes an allowed value is written
   * in. The collapsed row kept showing "Default RBAC" — the labelling path
   * recognised all three — so the value looked present right up until the row
   * was opened, where it read "—", and it was already gone from the form data.
   */
  const OPTIONS = {
    schemes: {
      type: 'list',
      ui_type: 'list',
      element_type: 'hash',
      display_name: 'Authentication Schemes',
      arg_schema: SCHEME_SCHEMA,
    },
  } as never;

  it('keeps a bare-shaped allowed value when the row is opened', async () => {
    const { container } = renderForm(OPTIONS, {
      schemes: { type: 'list', value: [{ type: 'hash', value: { type: 'default' } }] },
    } as never);

    await waitFor(() => expect(container.querySelector('[data-field="schemes"]')).toBeTruthy());
    fireEvent.click(container.querySelector('[data-field="schemes"]')!);

    // Inside the opened row, the field reads its display name — not the empty
    // dash. Asserting on the sub-form is what makes this bite: the COLLAPSED
    // summary showed the right thing throughout the bug.
    const item = await waitFor(() => {
      const element = container.querySelector('.array-auto-item');
      expect(element).toBeTruthy();
      return element!;
    });
    await waitFor(() => expect(item.textContent ?? '').toContain('Default RBAC'));
    expect(item.textContent ?? '').not.toContain('Scheme Type—');
  });
});
