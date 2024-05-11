import { StoryObj } from '@storybook/react';
import { expect, fn, within } from '@storybook/test';
import { useState } from 'react';

import { markdown } from '../../../../../mock/fields';
import { StoryMeta } from '../../../../types';
import { MarkdownFormField } from './Markdown';

const meta = {
  component: MarkdownFormField,
  title: 'Components/Form/Markdown',
  args: {
    onChange: fn(),
    value: markdown,
  },
  render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <MarkdownFormField
        {...args}
        value={value}
        onChange={(value) => {
          args.onChange?.(value);
          setValue(value);
        }}
      />
    );
  },
} as StoryMeta<typeof MarkdownFormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    'aria-label': 'MarkdownEditor',
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const editor = canvas.getByLabelText('MarkdownEditor');
    const preview = canvas.getByLabelText('Preview');

    await expect(editor).toBeInTheDocument();
    await expect(preview).toBeInTheDocument();
    await expect(editor).toHaveValue(args.value);
  },
};
