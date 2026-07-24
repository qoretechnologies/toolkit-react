import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ByteSize field with no value. Typing a number into the amount input fires onChange with the composed byte-size expression.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ByteSize field pre-populated with "512MiB" — the amount and unit are split across the number input and the MiB unit selector.',
      },
    },
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the ByteSize field with "512MiB" in read-only mode — the amount input is marked readonly and rejects further edits.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue('512');
    await expect(input).toHaveAttribute('readonly');
  },
};
