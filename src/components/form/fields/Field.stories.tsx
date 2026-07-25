import { StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../types';
import { FormField } from './Field';

/**
 * Direct `FormField` dispatcher stories. These exist mainly to pin the
 * soft-type / `binary` handling: a `soft*` type renders exactly like its
 * concrete base, and `binary` renders as a textarea.
 */
const meta = {
  component: FormField,
  title: 'Components/Form/Field',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState<any>(args.value);
    return (
      <FormField
        {...args}
        value={value}
        onChange={(v) => {
          args.onChange?.(v);
          setValue(v);
        }}
      />
    );
  },
} as StoryMeta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A soft Qore type (`softint`) renders identically to its concrete `int`. */
export const SoftInteger: Story = {
  args: {
    type: 'softint',
    value: 5,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a softint value — the dispatcher resolves the soft type to int and mounts the numeric input.',
      },
    },
  },
  async play({ canvasElement }) {
    // NumberFormField renders an input (a `softint` resolves to `int`).
    await expect(canvasElement.querySelector('input')).toBeInTheDocument();
  },
};

/** `binary` renders as a textarea (matching the type map's documented intent). */
export const Binary: Story = {
  args: {
    type: 'binary',
    value: 'deadbeef',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a binary value — the dispatcher mounts a textarea holding the encoded content.',
      },
    },
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector('textarea')).toBeInTheDocument();
  },
};

/** `byte-size` — a numeric amount + a unit selector, combined into `"512MiB"`. */
export const ByteSize: Story = {
  args: {
    type: 'byte-size',
    value: '512MiB',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a byte-size value — the dispatcher mounts the amount input and the MiB unit selector, split from "512MiB".',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByDisplayValue('512')).toBeInTheDocument();
    await expect(await canvas.findByText('MiB')).toBeInTheDocument();
  },
};

/** `url` — protocol picker + `://` + address (IDE `URLField` structure). */
export const Url: Story = {
  args: {
    type: 'url',
    value: 'https://example.com',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a url value — the dispatcher mounts the https protocol selector and the example.com address input, split from "https://example.com".',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(await canvas.findByDisplayValue('example.com')).toBeInTheDocument();
    await expect(await canvas.findByText('https')).toBeInTheDocument();
  },
};

/** `multi-select` — an array value picked from `allowed_values` (multiple). */
export const MultiSelect: Story = {
  args: {
    type: 'multi-select',
    allowed_values: [
      { value: { value: 'red', type: 'string' }, display_name: 'Red' },
      { value: { value: 'green', type: 'string' }, display_name: 'Green' },
      { value: { value: 'blue', type: 'string' }, display_name: 'Blue' },
    ],
    value: ['red', 'blue'],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders FormField for a multi-select value — the two picked values (Red and Blue) render as chips using their display_name labels.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // The two selected values render as chips (by their display_name).
    await expect(await canvas.findByText('Red')).toBeInTheDocument();
    await expect(canvas.getByText('Blue')).toBeInTheDocument();
  },
};
