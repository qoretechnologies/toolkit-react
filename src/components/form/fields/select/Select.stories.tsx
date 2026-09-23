import { ReqoreButton, ReqoreP } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { SelectFormField } from './Select';
import {
  SELECT_DIALOG_MIN_HEIGHT,
  SELECT_DIALOG_MIN_WIDTH,
  UNAVAILABLE_ITEM_CLASS,
} from './SelectCollection';

const meta = {
  component: SelectFormField,
  title: 'Components/Form/Select',
  args: {
    onChange: undefined,
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <SelectFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof SelectFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Items: Story = {
  args: {
    items: [
      { display_name: 'Item 1', value: 'item1' },
      { display_name: 'Item 2', value: 'item2' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with two simple items and no value. Clicking the trigger opens the popover with the item list.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-popover-content')).toBeInTheDocument(), {
      timeout: 1000,
    });
  },
};

export const WithValueLabel: Story = {
  args: {
    value: 'seconds',
    valueLabel: 's',
    items: [{ value: 'ms' }, { value: 'seconds' }, { value: 'minutes' }],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with a `valueLabel` override — the closed trigger shows the short "s" for the selected value, while opening the popover still lists the full item names.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('s')).toBeInTheDocument();
    await fireEvent.click(canvas.getByText('s'));
    await waitFor(
      () => expect(within(document.body).getByText('seconds')).toBeInTheDocument(),
      { timeout: 5000 }
    );
    await expect(within(document.body).getByText('minutes')).toBeInTheDocument();
  },
};

export const ItemsWithDescription: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with twenty items, each carrying a description, icon or image. Opening the picker mounts a modal collection with all twenty entries.',
      },
    },
  },
  args: {
    forceDropdown: false,
    items: [
      { display_name: 'Item 1', desc: 'This is item 1', value: 'item1', icon: 'MoneyEuroCircleFill', groups: ['Miscellaneous'] },
      { display_name: 'Item 2', desc: 'This is item 2', value: 'item2', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
      { display_name: 'Item 3', short_desc: 'This is item 3', value: 'item3', icon: 'AppleFill' },
      { display_name: 'Item 4', short_desc: 'This is item 4', value: 'item4', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
      { display_name: 'Item 5', desc: 'This is item 5', value: 'item5', icon: 'MoneyEuroCircleFill' },
      { display_name: 'Item 6', desc: 'This is item 6', value: 'item6', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
      { display_name: 'Item 7', short_desc: 'This is item 7', value: 'item7', icon: 'AppleFill' },
      { display_name: 'Item 8', short_desc: 'This is item 8', value: 'item8', groups: ['Comparators'], image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
      { display_name: 'Item 9', desc: 'This is item 9', value: 'item9', icon: 'MoneyEuroCircleFill' },
      { display_name: 'Item 10', desc: 'This is item 10', value: 'item10', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
      { display_name: 'Item 11', short_desc: 'This is item 11', value: 'item11', icon: 'AppleFill', groups: ['Comparators'] },
      { display_name: 'Item 12', short_desc: 'This is item 12', value: 'item12', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
      { display_name: 'Item 13', desc: 'This is item 13', value: 'item13', icon: 'MoneyEuroCircleFill' },
      { display_name: 'Item 14', desc: 'This is item 14', value: 'item14', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
      { display_name: 'Item 15', short_desc: 'This is item 15', value: 'item15', icon: 'AppleFill' },
      { display_name: 'Item 16', short_desc: 'This is item 16', value: 'item16', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
      { display_name: 'Item 17', desc: 'This is item 17', value: 'item17', icon: 'MoneyEuroCircleFill' },
      { display_name: 'Item 18', desc: 'This is item 18', value: 'item18', image: 'https://avatars.githubusercontent.com/u/8861481?v=4', groups: ['Comparators'] },
      { display_name: 'Item 19', short_desc: 'This is item 19', value: 'item19', icon: 'AppleFill' },
      { display_name: 'Item 20', short_desc: 'This is item 20', value: 'item20', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-modal')).toBeInTheDocument(), { timeout: 1000 });
    await waitFor(
      () => expect(document.querySelectorAll('.reqore-collection-item').length).toBe(20),
      { timeout: 1000 }
    );
  },
};

export const ItemsWithDescriptionAndMessages: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with two items that carry inline messages of different intents. The picker modal shows the messages beneath each item.',
      },
    },
  },
  args: {
    forceDropdown: false,
    items: [
      {
        display_name: 'Item 1',
        value: 'item1',
        desc: 'This is item 1',
        messages: [{ title: 'Test', intent: 'danger', content: 'This is a test' }],
      },
      {
        display_name: 'Item 2',
        value: 'item2',
        desc: 'This is item 2',
        messages: [
          { title: 'Test', intent: 'success', content: 'This is a test' },
          { intent: 'warning', content: 'This is a test' },
        ],
      },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-modal')).toBeInTheDocument(), { timeout: 1000 });
    await waitFor(
      () => expect(document.querySelectorAll('.reqore-collection-item').length).toBe(2),
      { timeout: 1000 }
    );
  },
};

export const DisabledItemsWithIntent: Story = {
  args: {
    items: [
      { display_name: 'Item 1', value: 'item1' },
      { display_name: 'Item 2', value: 'item2' },
      { display_name: 'Disabled item', disabled: true, value: 'item3' },
      { display_name: 'Item with intent', intent: 'success', value: 'item4' },
      { display_name: 'Disabled Item with Intent', intent: 'danger', disabled: true, value: 'item5' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with a mix of enabled, disabled and intent-tagged items — the disabled entries are non-interactive while success/danger items carry their intent styling.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-popover-content')).toBeInTheDocument(), { timeout: 1000 });
  },
};

export const DisabledItemsWithIntentAndDescriptions: Story = {
  args: {
    forceDropdown: false,
    items: [
      { display_name: 'Item 1', desc: 'This is item 1', value: 'item1' },
      { display_name: 'Item 2', short_desc: 'This is item 2', value: 'item2' },
      { display_name: 'Disabled item', disabled: true, short_desc: 'This is item 3', value: 'item3' },
      { display_name: 'Item with intent', intent: 'success', short_desc: 'This is item 4', value: 'item4' },
      { display_name: 'Disabled Item with Intent', intent: 'danger', disabled: true, short_desc: 'This is item 5', value: 'item5' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with five items mixing intents, descriptions and disabled states — the picker modal shows all five so their combined presentation can be reviewed.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-modal')).toBeInTheDocument(), { timeout: 1000 });
    await waitFor(
      () => expect(document.querySelectorAll('.reqore-collection-item').length).toBe(5),
      { timeout: 1000 }
    );
  },
};

export const WithValue: Story = {
  args: {
    value: 'item2',
    items: [
      { display_name: 'Item 1', value: 'item1' },
      { display_name: 'Item 2', value: 'item2' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with two items and item2 pre-selected — the trigger shows the selected label and clicking it opens the popover.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button')).toBeInTheDocument();
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-popover-content')).toBeInTheDocument(), { timeout: 1000 });
  },
};

export const WithValueAndErrors: Story = {
  args: {
    value: 'item2',
    items: [
      { display_name: 'Item 1', desc: 'This is item 1', intent: 'danger', value: 'item1' },
      { display_name: 'Item 2', desc: 'This is item 1', value: 'item2', image: 'https://avatars.githubusercontent.com/u/8861481?v=4' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with a danger-intent item in the list, but the selected value points at the healthy item — the trigger stays clean while the picker highlights the danger item.',
      },
    },
  },
};

export const WithValueAndErrorsSelected: Story = {
  args: {
    value: 'item1',
    items: [
      { display_name: 'Item 1', desc: 'This is item 1', intent: 'danger', value: 'item1' },
      { display_name: 'Item 2', desc: 'This is item 1', value: 'item2' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with the danger-intent item pre-selected — the trigger carries the danger styling so the operator can see the selected item has an error.',
      },
    },
  },
};

export const WithValueAndWarningsSelected: Story = {
  args: {
    value: 'item1',
    items: [
      { display_name: 'Item 1', desc: 'This is item 1', metadata: { needs_auth: true }, value: 'item1' },
      { display_name: 'Item 2', desc: 'This is item 1', value: 'item2' },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with a pre-selected item whose metadata declares needs_auth — the trigger surfaces the warning so the operator knows the item needs configuration.',
      },
    },
  },
};

export const AutoSelect: Story = {
  args: {
    autoSelect: true,
    items: [{ display_name: 'Item 1', value: 'item1' }],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with autoSelect and a single item — the field auto-selects the only option and the trigger shows its label on mount.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Item 1')).toBeInTheDocument(), { timeout: 500 });
  },
};

export const AutoSelectWithShortDescriptions: Story = {
  args: {
    autoSelect: true,
    items: [{ display_name: 'Item 1', short_desc: 'Short item 1 description', value: 'item1' }],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with autoSelect and a single item that carries a short description — the field auto-selects and the trigger shows both the label and the short description.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Item 1')).toBeInTheDocument(), { timeout: 500 });
  },
};

export const AutoSelectWithDescriptions: Story = {
  args: {
    autoSelect: true,
    items: [{ display_name: 'Item 1', desc: 'This is item 1', value: 'item1' }],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with autoSelect and a single item that carries a full description — the field auto-selects and the trigger shows the label with the description.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Item 1')).toBeInTheDocument(), { timeout: 500 });
  },
};

export const ItemValuesAreObjectsAndCanBeSelected: Story = {
  args: {
    forceDropdown: false,
    value: { id: { type: 'string', value: 'item1' } },
    items: [
      { value: { id: { type: 'string', value: 'item1' } } },
      {
        display_name: 'Item 2',
        desc: 'This is item 2',
        value: { id: { type: 'string', value: 'item2' } },
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field with items whose values are hashes rather than primitives. The unlabelled first item shows its JSON as the trigger label; picking the second item swaps the selection to its display_name.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByText('{"id":{"type":"string","value":"item1"}}')).toBeInTheDocument(),
      { timeout: 500 }
    );
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-modal')).toBeInTheDocument(), { timeout: 1000 });
    const item2 = Array.from(document.querySelectorAll('.reqore-collection-item')).find(
      (el) => el.textContent?.includes('Item 2')
    );
    await fireEvent.click(item2!);
    await waitFor(() => expect(canvas.getByText('Item 2')).toBeInTheDocument(), { timeout: 1000 });
  },
};

const PATH_ITEMS = [
  {
    display_name: 'status from create',
    short_desc: '$.create.status (int)',
    value: '$.create.status',
  },
  {
    display_name: 'body from create',
    short_desc: '$.create.body (auto)',
    value: '$.create.body',
  },
  {
    display_name: 'headers from create',
    short_desc: '$.create.headers (hash)',
    value: '$.create.headers',
  },
];

export const Creatable: Story = {
  args: {
    canCreateItems: true,
    items: PATH_ITEMS,
    value: '$.create.status',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Select field as a chip plus a searchable list. The chosen value reads as the label its producer gave it, and a value the list does not offer can be typed and created — the case a reference path lands in once it goes deeper than the candidates reach.',
      },
    },
  },
};

export const CreatableWithValueOutsideTheList: Story = {
  args: {
    canCreateItems: true,
    items: PATH_ITEMS,
    value: '$.create.body.items[0].sku',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a creatable Select holding a value no item offers. The chip is drawn from the value itself, so a hand-entered path still reads as a chosen value rather than as an empty field.',
      },
    },
  },
};

export const CreatableEmpty: Story = {
  args: {
    canCreateItems: true,
    items: PATH_ITEMS,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a creatable Select with nothing chosen yet — the empty state says so rather than showing a blank text box.',
      },
    },
  },
};

export const CreatableOffersToCreate: Story = {
  args: {
    canCreateItems: true,
    items: PATH_ITEMS,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Typing a value no candidate matches offers to create it, above the candidates that do match. This is the affordance a single-value field had no way to express before: the list stays a list, and the value outside it is still reachable.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox');
    await fireEvent.change(input, { target: { value: '$.create.body.items[0].sku' } });
    await waitFor(
      () => expect(document.querySelector('.reqore-popover-content')).toBeInTheDocument(),
      { timeout: 2000 }
    );
  },
};

// ── per-item row affordances ──────────────────────────────────────────────

/**
 * A caller's row control, as a component the item NAMES rather than one it
 * renders. Items travel through `JSON.stringify(items)` memo keys, and a React
 * element is circular through its fibre — `{ as, props }` is what survives.
 */
const ExplainThisItem = ({ explanation }: { explanation?: string }) => (
  <ReqoreButton
    size='tiny'
    minimal
    flat
    compact
    fixed
    icon='QuestionLine'
    className='select-item-explanation'
    aria-label='What this is'
    tooltip={{ handler: 'click', content: explanation, maxWidth: '360px' }}
    // Reading is not choosing: the whole row is one click target.
    onClick={(event) => event.stopPropagation()}
  />
);

/** Whatever a caller wants inside the row's own hover. */
const ItemProse = ({ text }: { text?: string }) => <ReqoreP>{text}</ReqoreP>;

const EXPLAINED_ITEMS = [
  'Coverage: process',
  'Coverage: runtime',
  'Event: posted',
  'Value: equals',
  'Value: partial match',
  'String: matches regex',
].map((display_name) => ({
  display_name,
  value: display_name,
  short_desc: `What ${display_name} checks, in one line.`,
  desc: `What ${display_name} checks, in one line.`,
  title_actions: [{ as: ExplainThisItem, props: { explanation: `All of what ${display_name} is for.` } }],
  tooltip: {
    handler: 'hover' as const,
    delay: 0,
    placement: 'bottom-start' as const,
    maxWidth: '360px',
    content: { as: ItemProse, props: { text: `All of what ${display_name} is for.` } },
  },
}));

const openTheCollection = async (canvasElement: HTMLElement) => {
  await fireEvent.click(within(canvasElement).getByRole('button'));
  await waitFor(
    () => expect(document.querySelector('.reqraft-select-dialog .reqore-collection-item')).toBeTruthy(),
    { timeout: 5000 }
  );
};

const firstRow = () =>
  document.querySelector('.reqraft-select-dialog .reqore-collection-item') as HTMLElement;

export const ItemActionsInTheTitleBar: Story = {
  args: {
    forceDropdown: false,
    items: EXPLAINED_ITEMS,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Each offered item carries a control through `title_actions`, which renders it in the row's title bar, inline with the name. An item's `actions` render in the row BODY under the description and cost every entry a line of its own — measured at 31px of a 73px row on a list of twenty-nine. Both seams exist; this is the one for a single icon on a long list.",
      },
    },
  },
  async play({ canvasElement }) {
    await openTheCollection(canvasElement);
    const row = firstRow();
    /* `:scope >`: `Element.querySelector` matches against the whole document
       and then keeps what is inside the element, so a bare
       `.reqore-panel-content x` finds a control in the row's own TITLE — the
       modal around the collection is a panel too. */
    await expect(
      row.querySelector(':scope > .reqore-panel-title .select-item-explanation')
    ).toBeTruthy();
    await expect(
      row.querySelector(':scope > .reqore-panel-content .select-item-explanation')
    ).toBeNull();
  },
};

export const ItemTooltipOnTheRow: Story = {
  args: {
    forceDropdown: false,
    items: EXPLAINED_ITEMS,
  },
  parameters: {
    docs: {
      description: {
        story:
          "The per-item `tooltip` puts content on the ROW's own hover: the whole entry is the target, and the list pays nothing in height for something that is not on screen until a pointer rests. The content is a `{ as, props }` descriptor rather than a node, so an item still survives the `JSON.stringify(items)` memo key it travels under.",
      },
    },
  },
  async play({ canvasElement }) {
    await openTheCollection(canvasElement);
    await fireEvent.mouseEnter(firstRow());
    await waitFor(
      () =>
        expect(
          document.querySelector('[data-popper-placement]')?.textContent
        ).toContain('All of what Coverage: process is for.'),
      { timeout: 5000 }
    );
  },
};

const REFUSED_ITEMS = [
  {
    display_name: 'Coverage: process',
    value: 'process_coverage',
    short_desc: 'Passes when the process you name ran code.',
    desc: 'Passes when the process you name ran code.',
  },
  {
    display_name: 'Step: result',
    value: 'step_result',
    short_desc: 'Passes when the named step reported this result.',
    desc: 'Passes when the named step reported this result.',
    disabled: true,
    unavailable: {
      intent: 'warning' as const,
      content:
        'Unavailable because some dependencies are not fulfilled: "Interface Kind" must be "workflow"',
    },
  },
  {
    display_name: 'File: written',
    value: 'file_written',
    short_desc: 'Passes when the target wrote the file.',
    desc: 'Passes when the target wrote the file.',
    disabled: true,
    messages: [
      { intent: 'danger' as const, content: 'This sandbox denies the FILESYSTEM domain.' },
    ],
  },
  {
    display_name: 'Value: equals',
    value: 'value_equals',
    short_desc: 'Passes when the value is exactly equal.',
    desc: 'Passes when the value is exactly equal.',
  },
];

export const UnavailableItemsSayWhy: Story = {
  args: {
    forceDropdown: false,
    items: REFUSED_ITEMS,
  },
  parameters: {
    docs: {
      description: {
        story:
          "A value that cannot be picked is disabled and says why, never hidden — a choice that vanishes takes its own explanation with it. Two things refuse one and they render identically: the value's own `depends_on`, judged against the form it stands in (row 2), and a refusal the server had already decided as `disabled` with a message (row 3), for what only the server can know. The reason reads FIRST, above the description a `messages` entry would have landed under; the name is dimmed and the cursor says `not-allowed`; and the row keeps every pointer event, because reqore's `disabled` is `pointer-events: none` and would take the row's tooltip with it. What makes the row inert is having no click handler at all.",
      },
    },
  },
  async play({ canvasElement }) {
    await openTheCollection(canvasElement);
    const rows = () =>
      [...document.querySelectorAll<HTMLElement>('.reqraft-select-dialog .reqore-collection-item')];
    await waitFor(() => expect(rows().length).toBe(4), { timeout: 5000 });
    /* By name, not by index: the collection sorts its rows, so a positional
       lookup asserts about whichever row the sort happened to put there. */
    const rowNamed = (label: string) =>
      rows().find((row) =>
        row.querySelector(':scope > .reqore-panel-title')?.textContent?.includes(label)
      ) as HTMLElement;

    await expect(rows().filter((row) => row.className.includes(UNAVAILABLE_ITEM_CLASS)).length).toBe(
      2
    );

    // The one thing this must never do: `DisabledElement` would make it `none`
    // and take the row's tooltip with it.
    const gated = rowNamed('Step: result');
    await expect(getComputedStyle(gated).pointerEvents).toBe('auto');
    await expect(getComputedStyle(gated).cursor).toBe('not-allowed');
    await expect(getComputedStyle(rowNamed('Value: equals')).cursor).toBe('pointer');

    // A served refusal is promoted out of `messages` and printed once, above
    // the description rather than under it.
    const text =
      (rowNamed('File: written').querySelector(':scope > .reqore-panel-content') as HTMLElement)
        .textContent || '';
    await expect(text.indexOf('FILESYSTEM')).toBeGreaterThan(-1);
    await expect(text.indexOf('FILESYSTEM')).toBeLessThan(text.indexOf('wrote the file'));
  },
};

/** The dialog box itself — the element `re-resizable` sizes and drags. */
const selectDialog = () => document.querySelector('.reqraft-select-dialog') as HTMLElement;

const dialogSize = () => {
  const rect = selectDialog().getBoundingClientRect();
  return { width: Math.round(rect.width), height: Math.round(rect.height) };
};

/** Whether a part of the picker is whole inside the dialog, not cut off by it. */
const isWholeInsideTheDialog = (selector: string) => {
  const box = selectDialog().getBoundingClientRect();
  const part = selectDialog().querySelector(selector)?.getBoundingClientRect();

  if (!part) {
    return false;
  }

  return (
    part.width > 0 &&
    part.height > 0 &&
    part.left >= box.left - 0.5 &&
    part.right <= box.right + 0.5 &&
    part.top >= box.top - 0.5 &&
    part.bottom <= box.bottom + 0.5
  );
};

/**
 * Drag one of the dialog's resize handles, found by the cursor it sets.
 *
 * The first `col-resize` is the right edge and the first `row-resize` the top
 * one, so a negative dx and a positive dy both shrink. The pointer is kept
 * inside the box because the reqore we pin still clips the drawer, which
 * amputates the outer half of every handle.
 */
const dragTheDialogBy = async (cursor: string, dx: number, dy: number) => {
  const box = selectDialog();
  const handle = [...box.querySelectorAll<HTMLElement>('div')].find((el) =>
    (el.getAttribute('style') || '').includes(`cursor: ${cursor}`)
  );
  await expect(handle).toBeTruthy();

  const rect = handle!.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  const x = Math.min(Math.max(rect.left + rect.width / 2, boxRect.left + 2), boxRect.right - 2);
  const y = Math.min(Math.max(rect.top + rect.height / 2, boxRect.top + 2), boxRect.bottom - 2);

  fireEvent.mouseDown(handle!, { clientX: x, clientY: y, button: 0 });
  fireEvent.mouseMove(document, { clientX: x + dx, clientY: y + dy });
  fireEvent.mouseUp(document, { clientX: x + dx, clientY: y + dy });
};

export const CannotBeDraggedBelowItsContent: Story = {
  args: {
    forceDropdown: false,
    items: EXPLAINED_ITEMS,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Drags the picker far past its minimum on both axes and shows that it stops at the size its own content needs — a row that fits, the search field, and the close control — rather than at the smaller floor the dialog chrome asks for.',
      },
    },
  },
  async play({ canvasElement }) {
    await openTheCollection(canvasElement);
    await waitFor(() => expect(dialogSize().width).toBe(700));

    // Far past any floor, on both axes, the way it was reported: the picker
    // was dragged to roughly 45px wide and still held a search box, a list and
    // a close button stacked in a column nobody could read.
    await dragTheDialogBy('col-resize', -3000, 0);
    await dragTheDialogBy('row-resize', 0, 3000);

    // The width at which a 300px collection row stops overhanging the dialog,
    // and the height at which the header, the search field and one whole row
    // all fit - the row taken at its tallest, the described row this same
    // picker is also used with.
    await waitFor(() =>
      expect(dialogSize()).toEqual({
        width: SELECT_DIALOG_MIN_WIDTH,
        height: SELECT_DIALOG_MIN_HEIGHT,
      })
    );

    // And what the floor was measured FOR is what has to be whole at it.
    await expect(isWholeInsideTheDialog('.reqore-collection-item')).toBe(true);
    await expect(isWholeInsideTheDialog('input')).toBe(true);
    await expect(isWholeInsideTheDialog('.reqore-drawer-close-button')).toBe(true);
  },
};

/**
 * Narrow the story's own viewport for the duration of `body`, then put it back.
 *
 * `page.viewport` is the same call qlip makes to capture a story at phone size,
 * and it is reached through a DYNAMIC import: `vitest/browser` throws on import
 * outside Browser Mode, so a static one would take the Storybook dev server
 * down with it. Where the call is unavailable — the dev server, a docs render —
 * the body simply runs at whatever width it already had, and the assertion
 * below is written against the live viewport so it stays true there.
 */
const withViewport = async (
  width: number,
  height: number,
  /** `narrowed` is false where the call was unavailable — see above. */
  body: (narrowed: boolean) => Promise<void>
) => {
  let resize: ((w: number, h: number) => Promise<void>) | undefined;
  try {
    ({
      page: { viewport: resize },
    } = (await import('vitest/browser')) as never);
  } catch {
    resize = undefined;
  }

  const was = { width: window.innerWidth, height: window.innerHeight };
  await resize?.(width, height);
  try {
    await body(!!resize && window.innerWidth === width);
  } finally {
    // Unconditional: a viewport left narrowed is a 320px browser for every
    // story that runs after this one in the same file.
    await resize?.(was.width, was.height);
  }
};

/**
 * On a phone the floor is the SCREEN, not the content.
 *
 * `min(320px, 90vw)` / `min(180px, 90vh)` — the cap is the other half of the
 * floor, and it only engages below about a 356px viewport, which is why the
 * story above cannot see it: at the width the test browser runs at, `320px` is
 * simply the smaller of the two. A floor wider than the screen would be a
 * dialog whose edges cannot both be reached, which is worse than a cramped one;
 * 90vw is reqore's own maximum for a centred modal, so the floor stops exactly
 * where the ceiling is.
 */
export const ItsFloorIsCappedAtTheScreen: Story = {
  args: {
    forceDropdown: false,
    items: EXPLAINED_ITEMS,
  },
  parameters: {
    // Captured at the width the assertion below runs at, so the picture is the
    // capped dialog rather than a phone-sized story of a desktop-sized one.
    qlip: { viewport: { width: 320, height: 800 } },
    docs: {
      description: {
        story:
          'Drags the picker past its floor on a 320px-wide screen — the floor gives way to the viewport (90vw / 90vh) instead of holding a 320x180 box the screen cannot show, which is the cap the desktop story never reaches.',
      },
    },
  },
  async play({ canvasElement }) {
    await withViewport(320, 800, async (narrowed) => {
      await openTheCollection(canvasElement);
      await dragTheDialogBy('col-resize', -3000, 0);
      await dragTheDialogBy('row-resize', 0, 3000);

      /* The floor AS DECLARED, resolved against the viewport this is actually
         running in — 288x180 at 320x800, and the plain 320x180 anywhere wide
         enough that the cap does not bite. One assertion, true in both, and it
         is the formula itself rather than a number copied out of it. */
      const capped = {
        width: Math.min(SELECT_DIALOG_MIN_WIDTH, Math.round(window.innerWidth * 0.9)),
        height: Math.min(SELECT_DIALOG_MIN_HEIGHT, Math.round(window.innerHeight * 0.9)),
      };
      await waitFor(() => expect(dialogSize()).toEqual(capped), { timeout: 5000 });

      // And the claim the cap exists to make: the dialog is never wider or
      // taller than the screen it has to be read on.
      await expect(dialogSize().width).toBeLessThanOrEqual(window.innerWidth);
      await expect(dialogSize().height).toBeLessThanOrEqual(window.innerHeight);

      if (!narrowed) {
        return;
      }
      /* Where the viewport really was narrowed — the test browser, which is
         the run that gates — the cap is the branch that answered, and saying
         so is what stops this story passing as a second copy of the desktop
         one. */
      await expect(dialogSize().width).toBeLessThan(SELECT_DIALOG_MIN_WIDTH);
    });
  },
};
