import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { TicketHeader } from './TicketHeader';
import { IWorkspaceAccessStatusProps, WorkspaceAccessStatus } from './WorkspaceAccessStatus';

/** The frozen clock every relative time here is spoken against. */
const NOW = Date.parse('2026-10-19T12:00:00Z');
const at = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

const ACTIVE = { state: 'active', created_by_type: 'customer', issued_at: at(-180), expires_at: at(2 * 24 * 60), until_resolved: false };

/*
 * One read-only value with many states: the review grid is one story, every state a
 * labelled rail row, staff beside customer — one capture to look at, and a wrong word
 * in any row still fails the play by name. The clicking case and the phone case are
 * their own stories.
 */
const STATES: { label: string; props: Omit<IWorkspaceAccessStatusProps, 'now'> }[] = [
  { label: 'Active · staff', props: { viewerRole: 'staff', grant: ACTIVE } },
  { label: 'Active · customer', props: { viewerRole: 'customer', grant: ACTIVE } },
  { label: 'Expiring soon', props: { viewerRole: 'staff', grant: { ...ACTIVE, expires_at: at(40) } } },
  { label: 'Ended on the clock', props: { viewerRole: 'staff', grant: { ...ACTIVE, expires_at: at(-5) } } },
  // six days, not seven: at seven the clock says "next week", which reads worse
  { label: 'Automatic, until resolved', props: { viewerRole: 'staff', grant: { ...ACTIVE, created_by_type: 'system', until_resolved: true, expires_at: at(6 * 24 * 60) } } },
  { label: 'Revoked', props: { viewerRole: 'staff', grant: { state: 'revoked', created_by_type: 'customer', issued_at: at(-3 * 24 * 60), expires_at: at(-24 * 60), ended_at: at(-26 * 60), end_cause: 'staff_revoked' } } },
  { label: 'Pending · staff', props: { viewerRole: 'staff', request: { requested_at: at(-45), suggested_duration: '72h' } } },
  { label: 'Pending · customer', props: { viewerRole: 'customer', request: { requested_at: at(-45), suggested_duration: '24h' } } },
  { label: 'Setting is never', props: { viewerRole: 'staff', policy: 'never' } },
  // the row label must not repeat the value's own word, or the play finds two
  { label: 'Nothing yet', props: { viewerRole: 'staff' } },
];

const meta = {
  component: WorkspaceAccessStatus,
  title: 'Components/WorkspaceAccessStatus',
  args: { viewerRole: 'staff', now: NOW, grant: ACTIVE },
  // the value sits in the ticket rail, so each story renders it in one
  render: (args) => <TicketHeader padding={14} properties={[{ label: 'Workspace access', value: <WorkspaceAccessStatus {...args} /> }]} />,
} as StoryMeta<typeof WorkspaceAccessStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders every state of the value as a labeled rail row against one frozen clock: an active grant from the staff and the customer side, one expiring within the hour (amber), one whose expiry passed (muted), an automatic grant until the ticket is resolved, a revoked one, an open request from both sides, a setting of "never", and none.',
      },
    },
  },
  render: () => (
    <TicketHeader
      padding={14}
      properties={STATES.map(({ label, props }) => ({ label, value: <WorkspaceAccessStatus {...props} now={NOW} /> }))}
    />
  ),
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    for (const text of [
      'Granted by the customer · ends in 2 days',
      'Granted by you · ends in 2 days',
      'Granted by the customer · ends in 40 minutes',
      'Access ended 5 minutes ago',
      'Granted automatically · ends in 6 days',
      'Access ended by support · yesterday',
      'Requested for 3 days · awaiting the customer · 45 minutes ago',
      'Qorus Support asks for access for 24 hours · 45 minutes ago',
      "Not allowed: the account's setting is never",
      'None',
    ]) {
      await expect(canvas.getByText(text)).toBeInTheDocument();
    }
  },
};

export const Active: Story = {
  args: { action: { label: 'End access', icon: 'ShieldCrossLine', intent: 'danger', onClick: fn() } },
  parameters: {
    docs: {
      description: {
        story: 'Renders the staff value of an active grant with "End access" beside it — the one state that carries an action. Clicking the action calls it.',
      },
    },
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Granted by the customer · ends in 2 days')).toBeInTheDocument();
    await userEvent.click(canvas.getByText('End access'));
    await waitFor(() => expect(args.action?.onClick).toHaveBeenCalledTimes(1));
  },
};

export const Mobile: Story = {
  args: Active.args,
  parameters: {
    qlip: { viewport: { width: 390, height: 844 } },
    docs: { description: { story: 'Renders the active value with its action at 390px: the sentence truncates with an ellipsis before the action does, and the action keeps its label.' } },
  },
  async play({ canvasElement }) {
    await expect(within(canvasElement).getByText('End access')).toBeInTheDocument();
  },
};
