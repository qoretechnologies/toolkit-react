import { StoryObj } from '@storybook/react';
import { StoryMeta } from '../../../../types';
import { FormNumberField } from './Number';
import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';

const meta = {
  component: FormNumberField,
  title: 'Components/Form/Number',
  args: {
    'aria-label': 'Number',
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <FormNumberField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof FormNumberField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 0,
  },

  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue(0);
    await expect(input).toHaveAttribute('type', 'number');

    await userEvent.type(input, '10');
    await expect(input).toHaveValue(10);
    await expect(args.onChange).toHaveBeenLastCalledWith(10);
    await userEvent.clear(input);

    await userEvent.type(input, '10.5');
    await expect(input).toHaveValue(10);
    await expect(args.onChange).toHaveBeenLastCalledWith(10);

    await userEvent.click(input.nextElementSibling);
    await expect(input).toHaveValue(0);
    await expect(args.onChange).toHaveBeenLastCalledWith(0);
  },
};

export const Float: Story = {
  args: {
    value: 0,
    type: 'float',
  },

  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await userEvent.clear(input);
    await userEvent.type(input, '10.9');
    await expect(input).toHaveValue(10.9);
    await expect(args.onChange).toHaveBeenLastCalledWith(10.9);
  },
};
