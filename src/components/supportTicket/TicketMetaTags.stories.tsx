import { StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { TTicketCategory, TTicketPriority, TTicketStatus } from './meta';
import { TicketMetaTags } from './TicketMetaTags';

const ticket = (
  status: TTicketStatus,
  priority: TTicketPriority,
  category: TTicketCategory
): { status: TTicketStatus; priority: TTicketPriority; category: TTicketCategory } => ({
  status,
  priority,
  category,
});

const meta = {
  component: TicketMetaTags,
  title: 'Components/TicketMetaTags',
  args: {
    ticket: ticket('open', 'high', 'bug'),
  },
} as StoryMeta<typeof TicketMetaTags>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The status / priority / category badge row — each value's label, intent and
 *  icon come from the shared `supportTicket/meta` vocabularies. */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the status, priority, and category badge row, each tag's label, intent, and icon drawn from the shared supportTicket/meta vocabularies.",
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Open')).toBeInTheDocument();
    await expect(canvas.getByText('High')).toBeInTheDocument();
    await expect(canvas.getByText('Bug')).toBeInTheDocument();
  },
};

/**
 * The `awaiting_customer` status is the one value whose label is audience-specific.
 * With no `viewerRole` (the staff / neutral default) it reads "Awaiting customer".
 */
export const StaffAwaitingLabel: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the awaiting_customer status with no viewerRole (the staff / neutral default), where it reads 'Awaiting customer'.",
      },
    },
  },
  args: { ticket: ticket('awaiting_customer', 'normal', 'question') },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Awaiting customer')).toBeInTheDocument();
    await expect(canvas.queryByText('Awaiting your reply')).not.toBeInTheDocument();
  },
};

/** The customer viewpoint re-labels the same status as "Awaiting your reply". */
export const CustomerAwaitingLabel: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the same awaiting_customer status from the customer viewpoint, where it is re-labelled 'Awaiting your reply'.",
      },
    },
  },
  args: { viewerRole: 'customer', ticket: ticket('awaiting_customer', 'normal', 'question') },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Awaiting your reply')).toBeInTheDocument();
    await expect(canvas.queryByText('Awaiting customer')).not.toBeInTheDocument();
  },
};

/** `hideCategory` drops the category tag — for dense list rows. */
export const HideCategory: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the badge row with hideCategory set, dropping the category tag for dense list rows while status and priority remain.',
      },
    },
  },
  args: { hideCategory: true },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Open')).toBeInTheDocument();
    await expect(canvas.getByText('High')).toBeInTheDocument();
    await expect(canvas.queryByText('Bug')).not.toBeInTheDocument();
  },
};
