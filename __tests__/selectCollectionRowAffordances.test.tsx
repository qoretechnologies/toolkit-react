import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSelectItemTooltip,
  getSelectItemTitleActions,
  ISelectFieldCollectionItem,
  SelectFieldCollection,
} from '../src/components/form/fields/select/SelectCollection';

/**
 * Where an offered item's affordances go, and what a row costs because of it.
 *
 * A picker of twenty-nine kinds, each with a `(?)` opening the kind's served
 * explanation, measured 73px a row — 31px of which was the control, because an
 * item's `actions` render in the row BODY, under the description, on a line of
 * their own. A row's title bar already reserves that height for the name.
 *
 * So `title_actions` puts a control inline with the name, and `tooltip` puts
 * content on the row's own hover instead of on a control inside it. Both are
 * opt-ins: `actions` is untouched, because callers have laid out against its
 * body placement since this collection existed.
 */

const Explanation = ({ explanation }: { explanation?: string }) => (
  <em data-testid='explanation'>{explanation}</em>
);

const Control = (props: Record<string, unknown>) => (
  <button type='button' data-testid='control' className={props.className as string}>
    ?
  </button>
);

const renderCollection = (items: ISelectFieldCollectionItem[]) =>
  render(
    <ReqoreUIProvider>
      <SelectFieldCollection items={items} onClose={vi.fn()} onItemSelect={vi.fn()} />
    </ReqoreUIProvider>
  );

/* `:scope >`, not a bare descendant selector. `Element.querySelector` matches
   the selector against the WHOLE document and then keeps what is inside the
   element, so `.reqore-panel-content x` finds a control in the row's TITLE:
   the modal around the collection is itself a panel, and its own content pane
   is an ancestor of every row. */
const inRowTitle = (row: HTMLElement) =>
  row.querySelector(':scope > .reqore-panel-title [data-testid="control"]');

const inRowBody = (row: HTMLElement) =>
  row.querySelector(':scope > .reqore-panel-content [data-testid="control"]');

const rowFor = async (label: string): Promise<HTMLElement> =>
  waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('.reqore-collection-item')].find(
      (item) => item.querySelector('.reqore-panel-title')?.textContent?.includes(label)
    );
    expect(found, `no row labelled ${label}`).toBeTruthy();
    return found as HTMLElement;
  });

describe('an item that opts into the title bar', () => {
  it('renders the control inline with the name rather than under the description', async () => {
    renderCollection([
      {
        value: 'process_coverage',
        display_name: 'Coverage: process',
        short_desc: 'Passes when the process you name ran code.',
        title_actions: [{ as: Control }],
      },
    ]);

    const row = await rowFor('Coverage: process');
    expect(inRowTitle(row)).not.toBeNull();
    expect(inRowBody(row)).toBeNull();
  });

  it('leaves body `actions` in the body, so no existing caller moves', async () => {
    renderCollection([
      {
        value: 'value_equals',
        display_name: 'Value: equals',
        short_desc: 'Passes when the value is exactly equal.',
        actions: [{ as: Control }],
      },
    ]);

    const row = await rowFor('Value: equals');
    expect(inRowBody(row)).not.toBeNull();
    expect(inRowTitle(row)).toBeNull();
  });

  it('keeps both placements available on one item at once', async () => {
    renderCollection([
      {
        value: 'both',
        display_name: 'Both: placements',
        title_actions: [{ as: Control }],
        actions: [{ as: Control }],
      },
    ]);

    const row = await rowFor('Both: placements');
    expect(inRowTitle(row)).not.toBeNull();
    expect(inRowBody(row)).not.toBeNull();
  });
});

describe('an item that puts content on its own row', () => {
  it('opens the tooltip from a hover anywhere on the row, with the component rendered', async () => {
    renderCollection([
      {
        value: 'process_coverage',
        display_name: 'Coverage: process',
        tooltip: {
          handler: 'hover',
          delay: 0,
          content: { as: Explanation, props: { explanation: 'Qorus spreads its work.' } },
        },
      },
    ]);

    const row = await rowFor('Coverage: process');
    fireEvent.mouseEnter(row);

    const rendered = await screen.findByTestId('explanation');
    // A DESCRIPTOR came in and an element came out: the words reached the
    // reader through the component the caller named, not as a printed object.
    expect(rendered.tagName).toBe('EM');
    expect(rendered.textContent).toBe('Qorus spreads its work.');
  });

  it('takes a bare string too', async () => {
    renderCollection([{ value: 'plain', display_name: 'Plain: string', tooltip: 'A short line' }]);

    const row = await rowFor('Plain: string');
    fireEvent.mouseEnter(row);

    await waitFor(() => expect(screen.getByText('A short line')).toBeTruthy());
  });

  it('leaves a row with no tooltip alone', async () => {
    renderCollection([{ value: 'quiet', display_name: 'Quiet: row' }]);

    const row = await rowFor('Quiet: row');
    fireEvent.mouseEnter(row);

    await waitFor(() => expect(document.querySelector('[data-popper-placement]')).toBeNull());
  });
});

describe('both seams survive the memo key items travel under', () => {
  it('stringifies an item carrying a title action and a tooltip descriptor', () => {
    /* `FieldAllowedValues` and `MultiSelectFormField` memoise on
       `JSON.stringify(items)`. A rendered React element is circular through
       its fibre and throws there, taking the form down — which is exactly why
       both seams take `{ as, props }` and turn it into an element only here. */
    const item: ISelectFieldCollectionItem = {
      value: 'process_coverage',
      display_name: 'Coverage: process',
      title_actions: [{ as: Control, props: { explanation: 'text' } }],
      tooltip: { handler: 'hover', content: { as: Explanation, props: { explanation: 'text' } } },
    };

    expect(() => JSON.stringify(item)).not.toThrow();
  });
});

describe('the descriptors, on their own', () => {
  it('defaults a title action to a button, which reqore would not do from `props`', () => {
    /* reqore builds an action with no `as` from the action's own keys and
       drops `props` entirely, so a descriptor naming only props would render
       an empty button. */
    const [action] = getSelectItemTitleActions({ title_actions: [{ props: { label: 'Why' } }] })!;
    expect(action.as).toBeDefined();
    expect(action.props).toMatchObject({ label: 'Why' });
  });

  it('sizes a title action to the row, and lets the caller say otherwise', () => {
    const [tiny] = getSelectItemTitleActions({ title_actions: [{}] })!;
    expect(tiny.props?.size).toBe('tiny');

    const [big] = getSelectItemTitleActions({ title_actions: [{ props: { size: 'big' } }] })!;
    expect(big.props?.size).toBe('big');
  });

  it('gives reqore nothing when an item declares neither', () => {
    expect(getSelectItemTitleActions({})).toBeUndefined();
    expect(getSelectItemTitleActions({ title_actions: [] })).toBeUndefined();
    expect(buildSelectItemTooltip(undefined)).toBeUndefined();
    expect(buildSelectItemTooltip('')).toBeUndefined();
  });

  it('keeps the tooltip options the caller set beside the content it built', () => {
    const tooltip = buildSelectItemTooltip({
      handler: 'hover',
      delay: 300,
      placement: 'bottom-start',
      content: { as: Explanation, props: { explanation: 'text' } },
    });

    expect(tooltip).toMatchObject({ handler: 'hover', delay: 300, placement: 'bottom-start' });
  });
});
