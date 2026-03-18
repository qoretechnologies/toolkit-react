import { StoryObj } from '@storybook/react';
import { expect, fn, within } from '@storybook/test';
import { useState } from 'react';

import { StoryMeta } from '../../../../types';
import { RichTextFormField } from './RichText';

const meta = {
  component: RichTextFormField,
  title: 'Components/Form/RichText',
  args: {
    onChange: fn(),
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <RichTextFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof RichTextFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithValue: Story = {
  args: {
    value: 'Hello world',
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Only assert on render — typing assertions would need waitFor due to debounce
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
    await expect(canvas.getByText('Hello world')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
  },
};

export const WithSlateValue: Story = {
  args: {
    value: [{ type: 'paragraph', children: [{ text: 'Rich text with Slate format' }] }],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
    await expect(canvas.getByText('Rich text with Slate format')).toBeInTheDocument();
  },
};
