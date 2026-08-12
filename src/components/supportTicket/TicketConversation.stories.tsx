import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { ReactNode } from 'react';
import { StoryMeta } from '../../types';
import { ITicketThreadMessage, TicketThread } from '../ticketThread/TicketThread';
import { InterfaceReferenceTags } from './InterfaceReferenceTags';
import { TicketReplyBox } from './TicketReplyBox';

/**
 * The full ticket surface — the shared `<TicketThread>` conversation above the
 * `<TicketReplyBox>` composer, the way a ticket detail (customer) or the staff
 * drawer stacks them. Shown under the Qorus theme so the `custom1` accent renders.
 */
const meta = {
  component: TicketReplyBox,
  title: 'Components/TicketConversation',
  args: { onSend: fn() },
} as StoryMeta<typeof TicketReplyBox>;

export default meta;
type Story = StoryObj<typeof meta>;

const CUSTOMER: ITicketThreadMessage = {
  message_id: 'm1',
  author_type: 'customer',
  author_id: 'ops@acme.io',
  body: 'Since upgrading to 3.2 our nightly SFTP transfer to the partner endpoint times out after about 30 seconds. It ran fine on 3.1 with the same connection config.',
  created: '2026-07-16T09:12:00Z',
  referenced_interfaces: [{ interface_kind: 'connection', interface_name: 'sftp-partner' }],
};
const STAFF: ITicketThreadMessage = {
  message_id: 'm2',
  author_type: 'staff',
  author_id: 'nick',
  body: "Thanks for the detailed report — we've reproduced the timeout and a fix is in review. In the meantime, can you confirm the datasource pool size configured for the sftp-partner connection?",
  created: '2026-07-16T10:03:00Z',
};
const INTERNAL: ITicketThreadMessage = {
  message_id: 'm3',
  author_type: 'staff',
  author_id: 'nick',
  internal: true,
  body: 'Root cause: the connection-pool default silently dropped from 4 to 1 in the 3.2 migration. Patch is in review against develop.',
  created: '2026-07-16T10:05:00Z',
};

const themed = (node: ReactNode) => (
  <ReqoreUIProvider theme={{ main: '#121212', intents: { custom1: '#762f7e' } }}>
    <div style={{ padding: 20, background: '#121212', maxWidth: 780 }}>{node}</div>
  </ReqoreUIProvider>
);

const refs = (
  <InterfaceReferenceTags
    customTheme={{ main: 'custom1' }}
    references={[{ interface_kind: 'connection', interface_name: 'sftp-partner' }]}
  />
);

/**
 * Staff view — the thread with `viewerRole='staff'` (internal notes show, amber)
 * above the staff composer with the split send.
 */
export const StaffConversation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the staff view — the thread with viewerRole='staff' (internal notes visible, amber) stacked above the staff composer with its split send.",
      },
    },
  },
  render: () =>
    themed(
      <>
        <TicketThread viewerRole='staff' messages={[CUSTOMER, STAFF, INTERNAL]} />
        <div style={{ marginTop: 16 }}>
          <TicketReplyBox allowInternalNote onSend={fn()} aboveInput={refs} />
        </div>
      </>
    ),
  async play({ canvasElement }) {
    await expect(canvasElement.textContent).toContain('reproduced the timeout');
    // the internal note is visible to staff
    await expect(canvasElement.textContent).toContain('Root cause');
    // the composer (rich editor) renders below the thread
    await expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull();
  },
};

/**
 * Customer view — the same thread as the customer sees it (`viewerRole='customer'`,
 * staff shown as "Qorus Support", no internal notes) above their reply composer.
 */
export const CustomerConversation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the customer view — the same thread with viewerRole='customer' (staff shown as 'Qorus Support', no internal notes) stacked above the customer's reply composer.",
      },
    },
  },
  render: () =>
    themed(
      <>
        <TicketThread viewerRole='customer' messages={[CUSTOMER, STAFF]} />
        <div style={{ marginTop: 16 }}>
          <TicketReplyBox onSend={fn()} aboveInput={refs} />
        </div>
      </>
    ),
  async play({ canvasElement }) {
    await expect(canvasElement.textContent).toContain('reproduced the timeout');
    // the internal note is not in the customer's messages
    await expect(canvasElement.textContent).not.toContain('Root cause');
    // the composer (rich editor) renders below the thread
    await expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull();
  },
};
