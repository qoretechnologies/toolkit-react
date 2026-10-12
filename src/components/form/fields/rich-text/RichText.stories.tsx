import { StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { useState } from 'react';

import {
  MARKDOWN_TEMPLATE_VALUE,
  MARKDOWN_TEMPLATES,
  playHoverIsDrawn,
  playTapIsDrawnOnAPhone,
  withHostMarkdown,
} from '../../../../stories/templateHover';
import { withCoarsePointer } from '../../../../stories/coarsePointer';
import { PHONE_VIEWPORT } from '../../../../stories/tracking';
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
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RichText field pre-populated with the plain-string value "Hello world" — the editor mounts with the text rendered as a paragraph.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // Only assert on render — typing assertions would need waitFor due to debounce
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
    await expect(canvas.getByText('Hello world')).toBeInTheDocument();
  },
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Renders the RichText field with no value — the editor mounts empty.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
  },
};

export const WithSlateValue: Story = {
  args: {
    value: [{ type: 'paragraph', children: [{ text: 'Rich text with Slate format' }] }],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the RichText field pre-populated with a Slate document rather than a plain string — the editor mounts with the paragraph node rendered as text.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
    await expect(canvas.getByText('Rich text with Slate format')).toBeInTheDocument();
  },
};

export const TemplateHoverDrawsTheDescription: Story = {
  args: {
    value: `Dear ${MARKDOWN_TEMPLATE_VALUE}, your order has shipped.`,
    valueFormat: 'text',
    templates: MARKDOWN_TEMPLATES,
  },
  decorators: [withHostMarkdown],
  parameters: {
    docs: {
      description: {
        story:
          'Renders a text field holding a template ("Dear Customer name, your order has shipped."), in a host that draws markdown. Hovered, the chip\'s card shows the description drawn as the template list draws it: "customer’s" in bold and customer.name as code, with no asterisks or backticks, on one line on a wide screen (the card is as wide as what it says, up to 560px).',
      },
    },
  },
  play: playHoverIsDrawn,
};

export const TemplateTappedOnAPhone: Story = {
  tags: ['touch'],
  args: TemplateHoverDrawsTheDescription.args,
  // the pointer is a finger where the touches are dispatched too (Storybook's own UI), as on a phone
  decorators: [withCoarsePointer, withHostMarkdown],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders the same text field on a phone (390 px, touch). Tapped by a finger, the chip\'s card opens with the description drawn (bold and code, no markdown marks) and stays inside the screen.',
      },
    },
  },
  play: playTapIsDrawnOnAPhone,
};
