// Copyright 2026 Qore Technologies, s.r.o.
import { StoryObj } from '@storybook/react-vite';

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
import { ReadOnlyTemplateTag } from './ReadOnlyTemplateTag';

const meta = {
  component: ReadOnlyTemplateTag,
  title: 'Components/Form/ReadOnlyTemplateTag',
  args: {
    value: MARKDOWN_TEMPLATE_VALUE,
    templates: MARKDOWN_TEMPLATES,
  },
} as StoryMeta<typeof ReadOnlyTemplateTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HoverDrawsTheDescription: Story = {
  decorators: [withHostMarkdown],
  parameters: {
    docs: {
      description: {
        story:
          'Renders a chosen template as a read-only chip named "Customer name", in a host that draws markdown. Hovered, its card shows the name and the description drawn as the template list draws it: "customer’s" in bold and customer.name as code, with no asterisks or backticks.',
      },
    },
  },
  play: playHoverIsDrawn,
};

export const TappedOnAPhone: Story = {
  // the pointer is a finger where the touches are dispatched too (Storybook's own UI), as on a phone
  decorators: [withCoarsePointer, withHostMarkdown],
  parameters: {
    qlip: { viewport: PHONE_VIEWPORT },
    docs: {
      description: {
        story:
          'Renders the read-only "Customer name" chip on a phone (390 px, touch). Tapped by a finger, its card opens with the description drawn (bold and code, no markdown marks) and stays inside the screen.',
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
          'Renders the read-only "Customer name" chip where the host draws no markdown. Hovered, its card shows the description as it was written, as the template list does there.',
      },
    },
  },
  play: playHoverIsPlainWithoutAHost,
};
