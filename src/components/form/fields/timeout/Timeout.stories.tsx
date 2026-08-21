import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { useState } from 'react';
import { StoryMeta } from '../../../../types';
import { TimeoutFormField } from './Timeout';

const meta = {
  component: TimeoutFormField,
  title: 'Components/Form/Timeout',
  args: {
    onChange: fn(),
    'aria-label': 'Timeout amount',
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <TimeoutFormField
        {...args}
        value={value}
        onChange={(v) => {
          args.onChange?.(v);
          setValue(v);
        }}
      />
    );
  },
} as StoryMeta<typeof TimeoutFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Timeout field with no value — the unit selector sits on ms. Typing a number fires onChange with that many milliseconds.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByLabelText('Timeout amount');
    await expect(input).toBeInTheDocument();
    await expect(canvas.getByText('ms')).toBeInTheDocument();
    await userEvent.type(input, '42');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(42), { timeout: 5000 });
  },
};

export const WithValue: Story = {
  args: {
    value: 45000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Timeout field pre-populated with 45000 milliseconds — shown as 45 with the seconds unit selected, the largest unit that represents the value exactly.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue('45')).toBeInTheDocument();
    await expect(canvas.getByText('seconds')).toBeInTheDocument();
  },
};

export const WithInexactValue: Story = {
  args: {
    value: 90500,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Timeout field with 90500 milliseconds — no larger unit divides it evenly, so it stays 90500 on the ms unit instead of rounding to 90.5 seconds.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue('90500')).toBeInTheDocument();
    await expect(canvas.getByText('ms')).toBeInTheDocument();
  },
};

export const UnitSwitch: Story = {
  args: {
    value: 45000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Timeout field with 45000 milliseconds (45 seconds). Switching the unit to minutes re-interprets the shown amount and fires onChange with 45 minutes in milliseconds.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await fireEvent.click(await canvas.findByText('seconds'));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByText('minutes')).toBeInTheDocument(), { timeout: 5000 });
    await fireEvent.click(body.getByText('minutes'));
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(2700000), { timeout: 5000 });
    await expect(canvas.getByDisplayValue('45')).toBeInTheDocument();
  },
};

export const TypingConverts: Story = {
  args: {
    value: 45000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Timeout field with 45000 milliseconds (45 seconds). Clearing the amount and typing 90 fires onChange with 90 seconds converted to milliseconds.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue('45');
    await userEvent.clear(input);
    await userEvent.type(input, '90');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(90000), { timeout: 5000 });
    await expect(canvas.getByText('seconds')).toBeInTheDocument();
  },
};

export const KeepsUnitWhileTyping: Story = {
  args: {
    value: 45000,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Timeout field with 45 seconds. Typing 120 — a minute-exact amount — keeps the seconds unit instead of auto-promoting to 2 minutes, and emits 120 seconds in milliseconds.',
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue('45');
    await userEvent.clear(input);
    await userEvent.type(input, '120');
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(120000), { timeout: 5000 });
    await expect(canvas.getByDisplayValue('120')).toBeInTheDocument();
    await expect(canvas.getByText('seconds')).toBeInTheDocument();
  },
};

export const ClearResetsToZero: Story = {
  args: {
    value: 45000,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Renders the Timeout field with 45 seconds. Clicking the amount input's clear icon resets the value to 0 milliseconds while the seconds unit stays selected.",
      },
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await canvas.findByDisplayValue('45');
    const clearButton = canvasElement.querySelector('.reqore-clear-input-button');
    await expect(clearButton).toBeInTheDocument();
    await fireEvent.click(clearButton!);
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith(0), { timeout: 5000 });
    await expect(canvas.getByDisplayValue('0')).toBeInTheDocument();
    await expect(canvas.getByText('seconds')).toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  args: {
    value: 45000,
    readOnly: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Timeout field with 45 seconds in read-only mode — the amount input is marked readonly and the unit selector is disabled.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByDisplayValue('45');
    await expect(input).toHaveAttribute('readonly');
    await expect(canvas.getByText('seconds').closest('button')).toBeDisabled();
  },
};
