import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { NumberFormField } from './Number';

const meta = {
  component: NumberFormField,
  title: 'Components/Form/Number',
  args: {
    'aria-label': 'Number',
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);

    return (
      <NumberFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof NumberFormField>;

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

    await userEvent.click(input.nextElementSibling);
    await expect(args.onChange).toHaveBeenLastCalledWith(undefined);

    await userEvent.type(input, '10.5');
    await expect(input).toHaveValue(10);
    await expect(args.onChange).toHaveBeenLastCalledWith(10);
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
