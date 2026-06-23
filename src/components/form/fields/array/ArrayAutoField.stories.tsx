import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { NumberFormField } from '../number/Number';
import { StringFormField } from '../string/String';
import { ArrayAutoField, IArrayAutoFieldProps } from './ArrayAutoField';

const stringRenderItem: IArrayAutoFieldProps['renderItem'] = ({
  value,
  onChange,
  disabled,
  readOnly,
  size,
  ...rest
}) => (
  <StringFormField
    value={(value as string) ?? ''}
    onChange={(v) => onChange(v)}
    disabled={disabled}
    readOnly={readOnly}
    size={size as any}
    aria-label='Array item input'
    {...(rest as any)}
  />
);

const numberRenderItem: IArrayAutoFieldProps['renderItem'] = ({
  value,
  onChange,
  disabled,
  readOnly,
  size,
  ...rest
}) => (
  <NumberFormField
    value={value as number}
    onChange={(v) => onChange(v)}
    disabled={disabled}
    readOnly={readOnly}
    size={size as any}
    aria-label='Array item input'
    type='int'
    {...(rest as any)}
  />
);

const meta = {
  component: ArrayAutoField,
  title: 'Components/Form/Auto Array',
  args: {
    name: 'testArray',
    onChange: fn(),
    renderItem: stringRenderItem,
    type: 'string',
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <ReqoreControlGroup vertical>
        <ArrayAutoField
          {...args}
          value={value}
          onChange={(_name, val) => {
            args.onChange?.(_name, val);
            setValue(val);
          }}
        />
      </ReqoreControlGroup>
    );
  },
} as StoryMeta<typeof ArrayAutoField>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Compact mode stories (non-hash, non-list) ──────────────────────────────

export const CompactEmpty: Story = {
  args: {
    type: 'string',
    value: [],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    // Should show the input field but no tags
    await expect(canvas.queryByRole('button', { name: /add item/i })).not.toBeInTheDocument();
    await expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(0);

    // Confirm button should be disabled when input is empty
    const confirmBtn = document.querySelector('.array-auto-compact-confirm') as HTMLButtonElement;
    await expect(confirmBtn).toBeInTheDocument();
    await expect(confirmBtn).toBeDisabled();
  },
};

export const CompactWithValues: Story = {
  args: {
    type: 'string',
    value: ['hello', 'world'],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    // Should show 2 tags
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(2),
      { timeout: 5000 }
    );

    // Tags should display the values
    await expect(canvas.getByText('hello')).toBeInTheDocument();
    await expect(canvas.getByText('world')).toBeInTheDocument();
  },
};

export const CompactAddItem: Story = {
  args: {
    type: 'string',
    value: ['existing'],
  },
  async play({ args }) {
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(1),
      { timeout: 5000 }
    );

    // Type a value into the input
    const input = document.querySelector('.array-auto-compact .reqore-input') as HTMLInputElement;
    await fireEvent.change(input, { target: { value: 'new item' } });

    // Click confirm
    const confirmBtn = document.querySelector('.array-auto-compact-confirm') as HTMLButtonElement;
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    await fireEvent.click(confirmBtn);

    // Should now have 2 tags
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(2),
      { timeout: 5000 }
    );

    // onChange should have been called with both values
    await waitFor(() => {
      const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(['existing', 'new item']);
    });
  },
};

export const CompactEditItem: Story = {
  args: {
    type: 'string',
    value: ['alpha', 'beta'],
  },
  async play({ args }) {
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(2),
      { timeout: 5000 }
    );

    // Click edit on the first tag
    const editBtns = document.querySelectorAll('.array-auto-compact-edit');
    await fireEvent.click(editBtns[0]);

    // The input should be populated with the tag's value
    const input = document.querySelector('.array-auto-compact .reqore-input') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('alpha'));

    // Change the value
    await fireEvent.change(input, { target: { value: 'alpha-edited' } });

    // Click confirm (should show check icon in edit mode)
    const confirmBtn = document.querySelector('.array-auto-compact-confirm') as HTMLButtonElement;
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    await fireEvent.click(confirmBtn);

    // Should still have 2 tags, first one updated
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(2),
      { timeout: 5000 }
    );

    // onChange should have been called with updated values
    await waitFor(() => {
      const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(['alpha-edited', 'beta']);
    });
  },
};

export const CompactRemoveItem: Story = {
  args: {
    type: 'string',
    value: ['one', 'two', 'three'],
  },
  async play({ args }) {
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(3),
      { timeout: 5000 }
    );

    // Click remove on the second tag ("two")
    const removeBtns = document.querySelectorAll('.array-auto-compact-remove');
    await fireEvent.click(removeBtns[1]);

    // Should now have 2 tags
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(2),
      { timeout: 5000 }
    );

    // onChange should have been called without "two"
    await waitFor(() => {
      const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(['one', 'three']);
    });
  },
};

export const CompactWithNumbers: Story = {
  args: {
    type: 'int',
    value: [10, 20, 30],
    renderItem: numberRenderItem,
  },
  async play() {
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(3),
      { timeout: 5000 }
    );
  },
};

export const CompactDisabled: Story = {
  args: {
    type: 'string',
    value: ['locked'],
    disabled: true,
  },
  async play() {
    await waitFor(
      () => expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(1),
      { timeout: 5000 }
    );

    // Should not have edit/remove actions
    await expect(document.querySelectorAll('.array-auto-compact-edit').length).toBe(0);
    await expect(document.querySelectorAll('.array-auto-compact-remove').length).toBe(0);

    // Should not have confirm button
    await expect(document.querySelector('.array-auto-compact-confirm')).not.toBeInTheDocument();
  },
};

// ─── Complex mode stories (hash/list) ────────────────────────────────────────

export const ComplexHashItems: Story = {
  args: {
    type: 'hash',
    value: [{ key: 'value' }],
    display_name: 'Hash Items',
  },
  async play() {
    // Should render panel-based UI, not compact tags
    await waitFor(() => expect(document.querySelectorAll('.array-auto-item').length).toBe(1), {
      timeout: 5000,
    });
    await expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(0);
  },
};
