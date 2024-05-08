import { StoryObj } from '@storybook/react';
import { StoryMeta } from '../../../../types';
import { FormBooleanField } from './Boolean';
import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';

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
    id: 'Boolean',
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
