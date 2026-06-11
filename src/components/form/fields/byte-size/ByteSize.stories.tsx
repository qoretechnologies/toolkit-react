import { StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from '@storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { ByteSizeFormField } from './ByteSize';

const meta = {
  component: ByteSizeFormField,
  title: 'Components/Form/ByteSize',
  args: {
    onChange: fn(),
    'aria-label': 'Byte size amount',
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <ByteSizeFormField
        {...args}
        value={value}
        onChange={(v) => {
          args.onChange?.(v);
          setValue(v);
        }}
      />
    );
  },
} as StoryMeta<typeof ByteSizeFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Byte size amount');
    await expect(input).toBeInTheDocument();
    await userEvent.type(input, '42');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('42'), { timeout: 5000 });
  },
};

export const WithValue: Story = {
  args: {
    value: '512MiB',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue('512')).toBeInTheDocument();
    await expect(canvas.getByText('MiB')).toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  args: {
    value: '512MiB',
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue('512');
    await expect(input).toHaveAttribute('readonly');
  },
};
