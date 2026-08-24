import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { SelectFormField } from './Select';

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
