import { ReqoreControlGroup } from '@qoretechnologies/reqore';
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
          'Renders the status, priority, and category as words on one line, each with its icon from the shared supportTicket/meta vocabularies. Only what needs the person looking takes a color (ticketStatusAttention): here Open, High and Bug all read in gray, since a priority orders the queue and a category is a topic, neither is the ticket\'s state.',
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
    ).toBe('quiet');
    await expect(
      canvasElement.querySelector<HTMLElement>('.ticket-meta-category')?.dataset.attention
    ).toBe('quiet');
  },
};

export const APriorityIsAGrayWord: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders four tickets, low, normal, high and urgent priority, to the staff who handle them. Each priority is a plain gray word with its ordering mark, Urgent included: no status color, no dot, no alarm. A priority orders the queue; it is not the ticket\'s state, and an urgent ticket being handled is not failing.',
      },
    },
  },
  render: () => (
    <ReqoreControlGroup vertical>
      {(['low', 'normal', 'high', 'urgent'] as TTicketPriority[]).map((priority) => (
        <div key={priority} className={`priority-${priority}`}>
          <TicketMetaTags ticket={ticket('open', priority, 'bug')} viewerRole='staff' />
        </div>
      ))}
    </ReqoreControlGroup>
  ),
  async play({ canvasElement }) {
    const word = (priority: string) =>
      canvasElement.querySelector<HTMLElement>(`.priority-${priority} .ticket-meta-priority`)!;
    const colors = ['low', 'normal', 'high', 'urgent'].map(
      (priority) => getComputedStyle(word(priority)).color
    );
    for (const priority of ['low', 'normal', 'high', 'urgent']) {
      await expect(word(priority).dataset.attention).toBe('quiet');
    }
    // one gray for every priority
    await expect(new Set(colors).size).toBe(1);
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

/** A resolved ticket waits on the customer: it has an outcome to read. Staff see it done. */
export const AResolvedTicketWaitsOnTheCustomer: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The same resolved ticket from both sides. To the customer it has an outcome to read, and to reopen if it is wrong, so it waits on them: its dot is amber, as a ticket awaiting their reply is. To support staff it is done: green, as before.',
      },
    },
  },
  render: () => (
    <ReqoreControlGroup vertical>
      <div className='customer-view'>
        <TicketMetaTags viewerRole='customer' ticket={ticket('resolved', 'normal', 'bug')} />
      </div>
      <div className='staff-view'>
        <TicketMetaTags viewerRole='staff' ticket={ticket('resolved', 'normal', 'bug')} />
      </div>
    </ReqoreControlGroup>
  ),
  async play({ canvasElement }) {
    const status = (view: string) =>
      canvasElement.querySelector<HTMLElement>(`.${view} .ticket-meta-status`)?.dataset.attention;
    await expect(status('customer-view'), 'a resolved ticket waits on the customer').toBe('warn');
    await expect(status('staff-view'), 'and is done for staff').toBe('good');
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
