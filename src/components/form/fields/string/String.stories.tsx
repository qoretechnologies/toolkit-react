import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { StringFormField } from './String';

const meta = {
  component: StringFormField,
  title: 'Components/Form/String',
  args: {
    onChange: fn(),
    onClearClick: fn(),
    'aria-label': 'Name',
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <StringFormField
        {...args}
        value={value}
        onChange={(value, event) => {
          args.onChange?.(value, event);
          setValue(value);
        }}
        onClearClick={() => {
          args.onClearClick?.();
          setValue('');
        }}
      />
    );
  },
} as StoryMeta<typeof StringFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 'Qore',
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue('Qore');

    await userEvent.click(input.nextElementSibling);
    await expect(args.onClearClick).toHaveBeenCalledOnce();
    await expect(input).toHaveValue('');

    await userEvent.type(input, 'Java');
    await expect(input).toHaveValue('Java');
    await expect(args.onChange).toHaveBeenLastCalledWith('Java', expect.objectContaining({}));
  },
};

export const Sensitive: Story = {
  args: {
    sensitive: true,
    value: 'password',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Name');
    await expect(input).toBeInTheDocument();
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveValue('password');
  },
};
