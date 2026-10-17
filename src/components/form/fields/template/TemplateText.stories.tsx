// Copyright 2026 Qore Technologies, s.r.o.
import { StoryObj } from '@storybook/react-vite';

import { templateTextSegments } from '../../../../helpers/templateText';
import {
  MARKDOWN_TEMPLATE_VALUE,
  MARKDOWN_TEMPLATES,
  playHoverIsDrawn,
  playHoverIsPlainWithoutAHost,
  playTapIsDrawnOnAPhone,
  withHostMarkdown,
} from '../../../../stories/templateHover';
import { withCoarsePointer } from '../../../../stories/coarsePointer';
import { PHONE_VIEWPORT } from '../../../../stories/tracking';
import { StoryMeta } from '../../../../types';
import { TemplateText } from './TemplateText';

const meta = {
  component: TemplateText,
  title: 'Components/Form/TemplateText',
  args: {
    segments: templateTextSegments(
      `Dear ${MARKDOWN_TEMPLATE_VALUE}, your order has shipped.`,
      MARKDOWN_TEMPLATES
    ),
    templates: MARKDOWN_TEMPLATES,
    full: true,
  },
} as StoryMeta<typeof TemplateText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HoverDrawsTheDescription: Story = {
  decorators: [withHostMarkdown],
  parameters: {
    docs: {
      description: {
        story:
          'Renders text with a template in it ("Dear Customer name, your order has shipped."), as a read row shows a value, in a host that draws markdown. Hovered, the chip\'s card shows the description drawn: "customer’s" in bold and customer.name as code, with no asterisks or backticks, on one line on a wide screen (the card is as wide as what it says, up to 560px).',
      },
    },
  },
  play: playHoverIsDrawn,
};

export const TappedOnAPhone: Story = {
  tags: ['touch'],
  // the pointer is a finger where the touches are dispatched too (Storybook's own UI), as on a phone
  decorators: [withCoarsePointer, withHostMarkdown],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders the same text on a phone (390 px, touch). Tapped by a finger, the chip\'s card opens with the description drawn (bold and code, no markdown marks) and stays inside the screen.',
      },
    },
  },
  play: playTapIsDrawnOnAPhone,
};

export const WithoutAHostRenderer: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the same text where the host draws no markdown. Hovered, the chip\'s card says the description as plain text: "The customer’s full name, as the order gives it in customer.name.", with no asterisks or backticks.',
      },
    },
  },
  play: playHoverIsPlainWithoutAHost,
};
