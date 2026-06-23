import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { BooleanFormField } from './Boolean';

const meta = {
  component: BooleanFormField,
  title: 'Components/Form/Boolean',
  args: {
    onChange: fn(),
    'aria-label': 'Boolean',
  },
  render(args) {
    const [checked, setChecked] = useState(args.checked);
    return (
      <BooleanFormField
        {...args}
        checked={checked}
        onChange={(checked) => {
          args.onChange?.(checked);
          setChecked(checked);
        }}
      />
    );
  },
} as StoryMeta<typeof BooleanFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checked: Story = {
  args: {
    checked: true,
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Yes')).toBeInTheDocument();
    await expect(canvas.getByText('No')).toBeInTheDocument();

    await userEvent.click(canvas.getByLabelText('Boolean'));
    await expect(args.onChange).toHaveBeenLastCalledWith(false);
  },
};

export const Unchecked: Story = {
  args: {
    checked: false,
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('No')).toBeInTheDocument();

    await userEvent.click(canvas.getByLabelText('Boolean'));
    await expect(args.onChange).toHaveBeenLastCalledWith(true);
  },
};

export const Disabled: Story = {
  args: {
    checked: true,
    disabled: true,
  },
};
