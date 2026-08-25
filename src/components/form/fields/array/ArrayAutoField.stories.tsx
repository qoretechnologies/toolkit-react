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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ArrayAutoField in compact string mode with no items — only the entry input and a disabled confirm button are visible.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ArrayAutoField in compact string mode with two existing items — the values are shown as tags above the entry input.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ArrayAutoField in compact string mode with one existing item. Typing into the input and clicking confirm appends the new item and fires onChange with the full list.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ArrayAutoField in compact string mode with two items. Clicking a tag\'s edit action loads its value into the input; editing and confirming replaces the tag in place.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ArrayAutoField in compact string mode with three items. Clicking the middle tag\'s remove action drops it from the list and fires onChange with the remaining two.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ArrayAutoField in compact int mode with three numeric items — the tags show 10, 20 and 30 and the entry input uses the Number field.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ArrayAutoField in compact string mode with one item but disabled — the tag is visible without edit/remove actions and no entry input is shown.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders ArrayAutoField in hash mode with one hash item — the field switches to the panel-based layout rather than compact tags.',
      },
    },
  },
  async play() {
    // Should render panel-based UI, not compact tags
    await waitFor(() => expect(document.querySelectorAll('.array-auto-item').length).toBe(1), {
      timeout: 5000,
    });
    await expect(document.querySelectorAll('.array-auto-compact-tag').length).toBe(0);
  },
};

/**
 * The editable list, headed by what identifies each record.
 *
 * The rows used to read `#1 #2 #3`, so finding one method meant opening each in
 * turn — and the collapsed preview beside it already headed the same records
 * `init` / `onOrderStatus`, which made one item answer to two names. Both now
 * resolve the heading through `recordIdentity`: the first field the SCHEMA
 * declares that holds a scalar, skipping any it leaves unset. The position keeps
 * a badge, so "the third one" is still answerable.
 */
export const HashItemsHeadedByIdentity: Story = {
  args: {
    type: 'hash',
    display_name: 'Service Methods',
    arg_schema: {
      name: { type: 'string', ui_type: 'string', display_name: 'Method Name', required: true },
      description: { type: 'string', ui_type: 'string', display_name: 'Description' },
    },
    value: [
      { name: 'init', description: 'The init method' },
      { name: 'onOrderStatus', description: 'Handles order status callbacks' },
      { description: 'Added but not yet named' },
      {},
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders four hash items headed by their identifying value: two named methods read as "init" and "onOrderStatus", one with no name falls through to its description, and an entirely empty one keeps its position number.',
      },
    },
  },
  async play() {
    await waitFor(() => expect(document.querySelectorAll('.array-auto-item').length).toBe(4), {
      timeout: 5000,
    });

    const headings = [...document.querySelectorAll('.array-auto-item')].map(
      (item) => item.textContent ?? ''
    );

    await expect(headings[0]).toContain('init');
    await expect(headings[1]).toContain('onOrderStatus');
    // An unset field is skipped rather than promoted blank, so this one is
    // headed by the next field that IS set.
    await expect(headings[2]).toContain('Added but not yet named');
    // And a record with nothing set at all keeps its position — there is
    // genuinely nothing to call it.
    await expect(headings[3]).toContain('#4');
  },
};
