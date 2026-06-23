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
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-popover-content')).toBeInTheDocument(), {
      timeout: 1000,
    });
  },
};

export const ItemsWithDescription: Story = {
  args: {
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
  args: {
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
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await fireEvent.click(canvas.getByRole('button'));
    await waitFor(() => expect(document.querySelector('.reqore-popover-content')).toBeInTheDocument(), { timeout: 1000 });
  },
};

export const DisabledItemsWithIntentAndDescriptions: Story = {
  args: {
    items: [
      { display_name: 'Item 1', desc: 'This is item 1', value: 'item1' },
      { display_name: 'Item 2', short_desc: 'This is item 2', value: 'item2' },
      { display_name: 'Disabled item', disabled: true, short_desc: 'This is item 3', value: 'item3' },
      { display_name: 'Item with intent', intent: 'success', short_desc: 'This is item 4', value: 'item4' },
      { display_name: 'Disabled Item with Intent', intent: 'danger', disabled: true, short_desc: 'This is item 5', value: 'item5' },
    ],
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
};

export const WithValueAndErrorsSelected: Story = {
  args: {
    value: 'item1',
    items: [
      { display_name: 'Item 1', desc: 'This is item 1', intent: 'danger', value: 'item1' },
      { display_name: 'Item 2', desc: 'This is item 1', value: 'item2' },
    ],
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
};

export const AutoSelect: Story = {
  args: {
    autoSelect: true,
    items: [{ display_name: 'Item 1', value: 'item1' }],
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
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText('Item 1')).toBeInTheDocument(), { timeout: 500 });
  },
};

export const ItemValuesAreObjectsAndCanBeSelected: Story = {
  args: {
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
