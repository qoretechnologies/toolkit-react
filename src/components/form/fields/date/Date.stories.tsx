import { StoryObj } from '@storybook/react';
import { expect, fn } from '@storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { DateFormField } from './Date';

const meta = {
  component: DateFormField,
  title: 'Components/Form/Date',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <DateFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof DateFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  async play({ canvasElement }) {
    const input = canvasElement.querySelector('input');
    await expect(input).toBeInTheDocument();
  },
};

export const WithValue: Story = {
  args: {
    value: '2025-01-15',
  },
  async play({ canvasElement, args }) {
    const input = canvasElement.querySelector('input');
    await expect(input).toBeInTheDocument();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

export const Disabled: Story = {
  args: {
    value: '2025-06-01',
    disabled: true,
  },
  async play({ canvasElement }) {
    const input = canvasElement.querySelector('input');
    await expect(input).toBeDisabled();
  },
};
