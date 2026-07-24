import { ReqoreControlGroup } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
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
      <ReqoreControlGroup>
        <NumberFormField
          {...args}
          value={value}
          onChange={(value) => {
            args.onChange?.(value);
            setValue(value);
          }}
        />
      </ReqoreControlGroup>
    );
  },
} as StoryMeta<typeof NumberFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Integer: Story = {
  args: {
    value: 42,
    type: 'int',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Number field in integer mode with 42 pre-populated. Typing a new integer updates the value and fires onChange after the debounce.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue(42);
    await expect(input).toHaveAttribute('type', 'number');

    await userEvent.clear(input);
    await userEvent.type(input, '10');
    await expect(input).toHaveValue(10);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(10), { timeout: 500 });
  },
};

export const Float: Story = {
  args: {
    value: 3.14,
    type: 'float',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Number field in float mode with 3.14 pre-populated — the input uses a 0.1 step and accepts decimals.',
      },
    },
  },
  async play({ args, canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toHaveValue(3.14);
    await expect(input).toHaveAttribute('step', '0.1');

    await userEvent.clear(input);
    await userEvent.type(input, '10.9');
    await expect(input).toHaveValue(10.9);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(10.9), { timeout: 500 });
  },
};

export const Empty: Story = {
  args: {
    type: 'int',
  },
  parameters: {
    docs: {
      description: {
        story: 'Renders the Number field in integer mode with no value — the input mounts empty.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toBeInTheDocument();
    await expect(input).toHaveValue(null);
  },
};

export const Disabled: Story = {
  args: {
    value: 99,
    type: 'int',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Number field with a value but disabled — the input shows the value and rejects further edits.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Number');

    await expect(input).toBeDisabled();
    await expect(input).toHaveValue(99);
  },
};
