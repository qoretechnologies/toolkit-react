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

/** The status / priority / category row in the calm look (the default): words, each
 *  with its icon, colored only when they need the person looking. */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the status, priority, and category as words on one line, each with its icon from the shared supportTicket/meta vocabularies. Only what needs the person looking takes a color (ticketStatusAttention, ticketPriorityAttention): here the high priority is amber, while Open and Bug read in gray, since a category is a topic rather than a verdict.',
      },
    },
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Open')).toBeInTheDocument();
    await expect(canvas.getByText('High')).toBeInTheDocument();
    await expect(canvas.getByText('Bug')).toBeInTheDocument();
    await expect(canvasElement.querySelector('.reqore-tag')).toBeNull();
    await expect(
      canvasElement.querySelector<HTMLElement>('.ticket-meta-priority')?.dataset.attention
    ).toBe('warn');
    await expect(
      canvasElement.querySelector<HTMLElement>('.ticket-meta-category')?.dataset.attention
    ).toBe('quiet');
  },
};

/** The classic look: a tag per value, each in its own intent. */
export const ClassicLook: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the same ticket with appearance='classic': a tag per value, each tinted in its own intent from the shared vocabulary, as the row looked before the calm look.",
      },
    },
  },
  args: { appearance: 'classic' },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Open')).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('.reqore-tag').length).toBe(3);
  },
};

/**
 * The `awaiting_customer` status is the one value whose label is audience-specific.
 * With no `viewerRole` (the staff / neutral default) it reads "Awaiting customer".
 */
export const StaffAwaitingLabel: Story = {
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `CustomerAwaitingLabel`.
    qlip: { skip: true },
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
          "Renders the same awaiting_customer status from the customer viewpoint, where it is re-labeled 'Awaiting your reply' and is the one status drawn in amber: the ticket waits on the person looking.",
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

/** `hideCategory` drops the category — for dense list rows. */
export const HideCategory: Story = {
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Default`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the row with hideCategory set, dropping the category for dense list rows while status and priority remain.',
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
