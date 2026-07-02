import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { StoryMeta } from '../../types';
import { ITicketThreadMessage, TicketThread } from './TicketThread';

const NOW = Date.parse('2026-06-30T12:00:00Z');
const ago = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

const THREAD: ITicketThreadMessage[] = [
  {
    message_id: 'm1',
    author_type: 'customer',
    author_id: 'acme',
    body: 'Our nightly **deploy** started failing after the 3.2 upgrade.',
    created: ago(180),
    attachments: [
      {
        attachment_id: 'att-1',
        filename: 'deploy-trace.log',
        content_type: 'text/plain',
        size_bytes: 12_800,
      },
    ],
    // no `resolveInterfaceIcon` is passed in these base stories, so this chip
    // exercises the built-in default per-kind icon.
    referenced_interfaces: [{ interface_kind: 'workflow', interface_name: 'nightly-deploy:1.2' }],
  },
  {
    message_id: 'm2',
    author_type: 'staff',
    author_id: 'nick',
    body: 'Thanks — that trace points at the datasource pool. Can you confirm the pool size?',
    created: ago(120),
  },
  {
    message_id: 'm3',
    author_type: 'staff',
    author_id: 'nick',
    body: 'Reproduced locally; the pool default dropped to 1 in 3.2.',
    internal: true,
    created: ago(90),
  },
  {
    message_id: 'm4',
    author_type: 'system',
    author_id: 'system',
    body: 'Priority raised to **high**.',
    created: ago(60),
  },
];

// A thread whose messages reference interfaces on the customer's instance —
// several at once, including two of the same kind (workflow), plus a job on a
// follow-up message. Referenced interfaces are `{kind, name}` snapshots.
const REFERENCED_THREAD: ITicketThreadMessage[] = [
  {
    message_id: 'r1',
    author_type: 'customer',
    author_id: 'acme',
    body: 'These two workflows and the notification service all fail together.',
    created: ago(45),
    referenced_interfaces: [
      { interface_kind: 'workflow', interface_name: 'order-processing:1.0', reference_id: 'ref-1' },
      { interface_kind: 'workflow', interface_name: 'invoice-sync:2.3', reference_id: 'ref-2' },
      { interface_kind: 'service', interface_name: 'notification-svc', reference_id: 'ref-3' },
    ],
  },
  {
    message_id: 'r2',
    author_type: 'customer',
    author_id: 'acme',
    body: 'And this job kicks off the follow-up.',
    created: ago(20),
    referenced_interfaces: [
      { interface_kind: 'job', interface_name: 'nightly-cleanup', reference_id: 'ref-4' },
    ],
  },
];

const meta = {
  component: TicketThread,
  title: 'Components/TicketThread',
  args: {
    messages: THREAD,
    onDownloadAttachment: fn(),
  },
} as StoryMeta<typeof TicketThread>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The customer viewpoint: the customer's own messages sit on the right under
 * "You", staff appear under a masked "Qorus Support" label, and internal notes
 * are never delivered to this surface (the server filters them). Clicking an
 * attachment chip calls `onDownloadAttachment` with its id + filename.
 */
export const CustomerView: Story = {
  args: {
    viewerRole: 'customer',
    // the server never sends internal notes to the customer
    messages: THREAD.filter((m) => !m.internal),
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('You')).toBeInTheDocument();
    await expect(canvas.getByText('Qorus Support')).toBeInTheDocument();
    // internal notes are filtered out for the customer
    await expect(canvas.queryByText('Internal note')).not.toBeInTheDocument();

    await userEvent.click(canvas.getAllByText('deploy-trace.log')[0]);
    await waitFor(() =>
      expect(args.onDownloadAttachment).toHaveBeenCalledWith('att-1', 'deploy-trace.log')
    );
  },
};

/**
 * Messages can reference interfaces on the customer's instance. Each reference
 * renders as a chip under the message — the interface kind as the chip's key and
 * the interface name as its label — and several references (including two of the
 * same kind) can attach to one message. When the consumer passes
 * `onInterfaceClick` (the customer view, which can open the interface on its own
 * instance) the chips are clickable; `resolveInterfaceIcon` supplies a per-kind
 * icon. The staff view omits `onInterfaceClick`, leaving the chips static.
 */
export const WithInterfaceReferences: Story = {
  args: {
    viewerRole: 'customer',
    messages: REFERENCED_THREAD,
    onInterfaceClick: fn(),
    resolveInterfaceIcon: (kind) =>
      kind === 'workflow' ? 'GitBranchLine' : kind === 'service' ? 'ServerLine' : 'TimerLine',
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);

    // every reference renders, including two workflows on the same message
    await expect(canvas.getByText('order-processing:1.0')).toBeInTheDocument();
    await expect(canvas.getByText('invoice-sync:2.3')).toBeInTheDocument();
    await expect(canvas.getByText('notification-svc')).toBeInTheDocument();
    await expect(canvas.getByText('nightly-cleanup')).toBeInTheDocument();

    // clicking a chip opens that specific interface
    await userEvent.click(canvas.getByText('invoice-sync:2.3'));
    await waitFor(() =>
      expect(args.onInterfaceClick).toHaveBeenCalledWith(
        expect.objectContaining({
          interface_kind: 'workflow',
          interface_name: 'invoice-sync:2.3',
        })
      )
    );
  },
};

/**
 * The staff viewpoint: staff messages sit on the right, the customer on the
 * left, and staff-only internal notes render amber + bordered under an "Internal
 * note" label so they can never be mistaken for a customer-visible reply.
 */
export const StaffView: Story = {
  args: {
    viewerRole: 'staff',
    messages: THREAD,
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Internal note')).toBeInTheDocument();
    await expect(canvas.getByText(/Support · nick/)).toBeInTheDocument();
    await expect(canvas.getByText(/Customer · acme/)).toBeInTheDocument();
    // the reference chip renders with the built-in default icon (no resolver passed)
    await expect(canvas.getByText('nightly-deploy:1.2')).toBeInTheDocument();
  },
};

export const Loading: Story = {
  args: { loading: true },
  async play({ canvasElement }) {
    await expect(within(canvasElement).getByText(/Loading conversation/)).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: { messages: [] },
  async play({ canvasElement }) {
    await expect(within(canvasElement).getByText('No messages yet')).toBeInTheDocument();
  },
};
