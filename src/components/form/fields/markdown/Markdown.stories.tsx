import { StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
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
  // A desktop: the preview is drawn beside the editor only above reqore's tablet width (1200px), and the
  // story run's default viewport is 1200px wide. Reqore answers media queries in a story run since 0.78.
  globals: { viewport: { value: 'desktop1440' } },
  parameters: {
    viewport: {
      options: { desktop1440: { name: 'Desktop', styles: { width: '1440px', height: '900px' } } },
    },
    docs: {
      description: {
        story:
          'Renders the Markdown field pre-populated with the sample markdown fixture — the editor and the live preview render side by side, the preview showing the rendered document (headings, bold) rather than the source.',
      },
    },
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

export const PreviewHidden: Story = {
  args: {
    'aria-label': 'MarkdownEditor',
    hidePreview: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the Markdown field with the live preview suppressed — the editor takes the whole field. This is what a phone-width screen gets automatically, and what a host forces when it knows its container is narrow even on a wide viewport.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByLabelText('MarkdownEditor')).toBeInTheDocument();
    await expect(canvas.queryByLabelText('Preview')).toBeNull();
  },
};
