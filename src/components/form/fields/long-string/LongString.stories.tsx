import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { LongStringFormField } from './LongString';
import { ReqoreControlGroup } from '@qoretechnologies/reqore';

const meta = {
  component: LongStringFormField,
  title: 'Components/Form/LongString',
  args: {
    onChange: fn(),
    onClearClick: fn(),
    'aria-label': 'LongString',
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <ReqoreControlGroup>
        <LongStringFormField
          {...args}
          value={value}
          onChange={(value) => {
            args.onChange?.(value);
            setValue(value);
          }}
        />
      </ReqoreControlGroup>
    );
  },
} as StoryMeta<typeof LongStringFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithValue: Story = {
  args: {
    value: 'Hello world',
  },
  async play({ canvasElement, args, step }) {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('LongString');

    await step('Initial value is displayed', async () => {
      await expect(textarea).toBeInTheDocument();
      await expect(textarea).toHaveValue('Hello world');
    });

    await step('Clear resets the field', async () => {
      await userEvent.click(textarea.nextElementSibling);
      await expect(textarea).toHaveValue('');
      // onChange fires immediately on clear (no debounce)
      await expect(args.onChange).toHaveBeenLastCalledWith('');
    });

    await step('Typing updates the value after debounce', async () => {
      await userEvent.type(textarea, 'Qore');
      await expect(textarea).toHaveValue('Qore');
      await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('Qore'), {
        timeout: 500,
      });
    });
  },
};

export const Empty: Story = {
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('LongString');

    await expect(textarea).toBeInTheDocument();
    await expect(textarea).toHaveValue('');

    await userEvent.type(textarea, 'New content');
    await expect(textarea).toHaveValue('New content');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('New content'), {
      timeout: 500,
    });
  },
};

export const Disabled: Story = {
  args: {
    value: 'Cannot edit this',
    disabled: true,
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const textarea = canvas.getByLabelText('LongString');

    await expect(textarea).toBeDisabled();
    await expect(textarea).toHaveValue('Cannot edit this');
  },
};
