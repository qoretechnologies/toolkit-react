import { useState } from 'react';
import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';

import { FormBooleanField } from './Boolean';
import { StoryMeta } from '../../../../types';

const meta = {
  component: FormBooleanField,
  title: 'Components/Form/Boolean',
  args: {
    onChange: fn(),
  },
} as StoryMeta<typeof FormBooleanField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: true,
    'aria-label': 'Boolean',
  },
  render(args) {
    const [checked, setChecked] = useState(args.checked);

    return (
      <FormBooleanField
        {...args}
        checked={checked}
        onChange={(checked) => {
          args.onChange?.(checked);
          setChecked(checked);
        }}
      />
    );
  },

  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Yes')).toBeInTheDocument();
    await expect(canvas.getByText('No')).toBeInTheDocument();

    await userEvent.click(canvas.getByLabelText('Boolean'));
    await expect(args.onChange).toHaveBeenLastCalledWith(false);
  },
};
