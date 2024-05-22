import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { BooleanFormField } from './Boolean';

const meta = {
  component: BooleanFormField,
  title: 'Components/Form/Boolean',
  args: {
    onChange: fn(),
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

export const Default: Story = {
  args: {
    checked: true,
    'aria-label': 'Boolean',
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await expect(await canvas.findByText('Yes')).toBeInTheDocument();
    await expect(await canvas.findByText('No')).toBeInTheDocument();

    await userEvent.click(await canvas.findByLabelText('Boolean'));
    await expect(args.onChange).toHaveBeenLastCalledWith(false);
  },
};
