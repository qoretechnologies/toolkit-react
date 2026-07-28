import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import styled from 'styled-components';

import { thinScrollbar } from '../../helpers/scrollbar';
import { StoryMeta } from '../../types';
import { ITicketThreadMessage, TicketThread } from './TicketThread';

/* The drawer body's scroll area — the thin Qorus scrollbar rather than the platform
 * default, matching what the app's ThreadScroll should carry. */
const DrawerScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  ${thinScrollbar}
`;

/*
 * The thread deliberately sits at the BOTTOM of its scroll area, against the composer,
 * the way every chat surface behaves. That only reads correctly inside the frame it
 * ships in: a fixed-height drawer body with the reply box beneath it. Rendered bare on
 * Storybook's full-height canvas the messages look like they fell into a void, with a
 * large empty gap above and nothing to sit against.
 *
 * This decorator supplies that frame — a drawer-height scroll area with the top edge of
 * a composer below it — so the bottom-alignment is legible as "a short conversation
 * waiting above the reply box" rather than a broken layout. It carries NO text, so the
 * `Loading` (asserts empty text) and `Empty` (asserts its own copy) stories are
 * unaffected.
 */
const DRAWER_HEIGHT = 520;
const inDrawer = (Story: () => JSX.Element) => (
  <div
    style={{
      height: DRAWER_HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      overflow: 'hidden',
    }}
  >
    <DrawerScroll>
      <Story />
    </DrawerScroll>
    {/* the composer's edge — the surface the thread rests against, no text */}
    <div
      style={{
        height: 44,
        flex: 'none',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.02)',
      }}
    />
  </div>
);

const NOW = Date.parse('2026-06-30T12:00:00Z');
const ago = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

/* A stand-in screenshot the mock `fetchAttachmentUrl` serves — an inline SVG data URL,
 * so the story needs no network and no fixture file. */
const screenshot = (label: string, hue: number): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'>` +
      `<rect width='320' height='200' fill='hsl(${hue},38%,16%)'/>` +
      `<rect x='16' y='16' width='288' height='30' rx='6' fill='hsl(${hue},45%,30%)'/>` +
      `<rect x='16' y='62' width='170' height='12' rx='4' fill='hsl(${hue},30%,46%)'/>` +
      `<rect x='16' y='86' width='250' height='12' rx='4' fill='hsl(${hue},24%,38%)'/>` +
      `<rect x='16' y='110' width='210' height='12' rx='4' fill='hsl(${hue},24%,38%)'/>` +
      `<text x='16' y='180' fill='white' font-family='sans-serif' font-size='13' opacity='0.7'>${label}</text>` +
      `</svg>`
  )}`;


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
  decorators: [inDrawer],
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders the thread from the customer's viewpoint: the customer's own messages sit on the right under 'You', staff appear under the masked 'Qorus Support' label, internal notes are filtered out, and clicking an attachment chip calls onDownloadAttachment with its id and filename.",
      },
    },
  },
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
/**
 * TICKET-level references (picked when filing) echo as chips on the OPENING message —
 * without the echo, readers scanned the thread, saw no chips, and concluded the ticket
 * referenced nothing. Deduped: `order-sync:1.2` is both a ticket reference and a
 * message-level ref on the opening message, and must render exactly once; the reply's
 * own refs are untouched.
 */
export const TicketReferencesEchoOnOpeningMessage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the thread with ticketReferences wired — the ticket-level refs (a qog and a workflow) appear as chips on the opening message only, deduped against that message\'s own refs, while the reply keeps just its own.',
      },
    },
  },
  args: {
    viewerRole: 'customer',
    messages: [
      {
        message_id: 'e1',
        author_type: 'customer',
        author_id: 'acme',
        body: 'The qog fails right after start; the workflow it feeds never runs.',
        created: ago(45),
        // overlaps with one ticket-level ref — must not double-render
        referenced_interfaces: [
          { interface_kind: 'workflow', interface_name: 'order-sync:1.2', reference_id: 'ref-m1' },
        ],
      },
      {
        message_id: 'e2',
        author_type: 'staff',
        author_id: 'support-1',
        body: 'Looking into it now.',
        created: ago(20),
      },
    ],
    ticketReferences: [
      { interface_kind: 'qog', interface_name: 'log-writer', reference_id: 'ref-t1' },
      { interface_kind: 'workflow', interface_name: 'order-sync:1.2', reference_id: 'ref-t2' },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // the ticket-level qog reference shows in the CONVERSATION now
    await expect(await canvas.findByText('log-writer')).toBeInTheDocument();
    // the overlapping workflow renders exactly once (ticket ref deduped against message ref)
    await expect(canvas.getAllByText('order-sync:1.2')).toHaveLength(1);
    // the staff reply carries no chips — the echo is scoped to the opening message
    const chips = canvasElement.querySelectorAll('.reqore-tag');
    await expect(chips.length).toBe(2);
  },
};

export const WithInterfaceReferences: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a customer thread whose messages carry interface-reference chips — several per message, including two workflows — where clicking a chip calls onInterfaceClick with that interface.',
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders the thread from the staff viewpoint: staff messages sit on the right, the customer on the left, and staff-only internal notes render amber and bordered under an 'Internal note' label.",
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story:
          "Renders the loading state as a conversation-shaped skeleton — aria-busy and labelled 'Loading conversation', carrying no message content — rather than a spinner.",
      },
    },
  },
  args: { loading: true },
  async play({ canvasElement }) {
    // the loading state is a conversation-shaped skeleton, not a spinner
    const skeleton = canvasElement.querySelector('[aria-busy="true"]');
    await expect(skeleton).not.toBeNull();
    await expect(skeleton).toHaveAttribute('aria-label', 'Loading conversation');
    // no real message content renders while loading
    await expect(canvasElement.textContent).toBe('');
  },
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the empty state with no messages, showing the 'No messages yet' placeholder instead of a thread.",
      },
    },
  },
  args: { messages: [] },
  async play({ canvasElement }) {
    await expect(within(canvasElement).getByText('No messages yet')).toBeInTheDocument();
  },
};

/* ── comprehensive coverage ──────────────────────────────────────────────────
 * The stories above cover the two viewpoints and the happy path. The ones below
 * exercise the full render surface a message can carry — every interface-reference
 * kind, the markdown a body supports, the spread of attachment types, every system
 * event, a grouped burst, and the overflow case — so a change to any of those is
 * visible in review instead of only showing up against real data.
 * ─────────────────────────────────────────────────────────────────────────── */

/* Every interface kind the reference vocabulary defines, on one message, so each
 * chip's built-in per-kind glyph is on screen at once. Names are illustrative. */
const EVERY_KIND: IInterfaceReference[] = [
  { interface_kind: 'workflow', interface_name: 'order-sync:1.2' },
  { interface_kind: 'service', interface_name: 'notification-svc' },
  { interface_kind: 'job', interface_name: 'nightly-recon' },
  { interface_kind: 'fsm', interface_name: 'onboarding-flow' },
  { interface_kind: 'qog', interface_name: 'stripe-billing' },
  { interface_kind: 'connection', interface_name: 'pgsql-omq' },
  { interface_kind: 'mapper', interface_name: 'csv-to-order' },
  { interface_kind: 'class', interface_name: 'OrderUtils' },
  { interface_kind: 'value-map', interface_name: 'country-codes' },
  { interface_kind: 'ai-collection', interface_name: 'kb-support' },
  { interface_kind: 'ai-endpoint', interface_name: 'gpt-router' },
  { interface_kind: 'ai-guardrail', interface_name: 'pii-filter' },
  // an unknown kind falls back to the generic glyph rather than breaking
  { interface_kind: 'mystery', interface_name: 'future-thing' },
];

/** Every referenceable interface kind as a chip on a single message — one of each,
 *  plus an unknown kind that must fall back to the generic glyph. */
export const EveryReferenceKind: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a single message carrying a chip for every referenceable interface kind, one of each, plus an unknown kind that falls back to the generic glyph.',
      },
    },
  },
  args: {
    viewerRole: 'customer',
    messages: [
      {
        message_id: 'refs',
        author_type: 'customer',
        author_id: 'acme',
        body: 'For context, this touches most of our instance:',
        created: ago(20),
        referenced_interfaces: EVERY_KIND,
      },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    for (const reference of EVERY_KIND) {
      await expect(canvas.getByText(reference.interface_name)).toBeInTheDocument();
    }
  },
};

/** The markdown a body supports: emphasis, inline code, a fenced block, both list
 *  kinds, and a link — so a formatting regression shows up here, not in the wild. */
export const RichFormatting: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a message whose markdown body exercises emphasis, inline code, a fenced code block, both list kinds, and a link, so a formatting regression surfaces here.',
      },
    },
  },
  args: {
    viewerRole: 'customer',
    messages: [
      {
        message_id: 'md',
        author_type: 'staff',
        author_id: 'nick',
        created: ago(5),
        body: [
          'Here is what I found — the **datasource pool** collapses to `1` under load.',
          '',
          'Steps to reproduce:',
          '',
          '1. Deploy `order-sync:1.2`',
          '2. Drive 40+ concurrent orders',
          '3. Watch the pool starve',
          '',
          'What to check:',
          '',
          '- the connection `pgsql-omq`',
          '- the `max-pool-size` option',
          '',
          '```qore',
          'int size = pool.getSize();',
          'if (size < 4) log("pool starved: " + size);',
          '```',
          '',
          'Full write-up in the [runbook](https://docs.qoretechnologies.com).',
        ].join('\n'),
      },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // the fenced block and a list item both render
    await expect(canvas.getByText(/pool starved/)).toBeInTheDocument();
    await expect(canvas.getByText(/Drive 40\+ concurrent orders/)).toBeInTheDocument();
    // the link is a real anchor
    const link = canvas.getByText('runbook').closest('a');
    await expect(link).toHaveAttribute('href', 'https://docs.qoretechnologies.com');
  },
};

/** A spread of attachment types and sizes on one message — each chip shows its
 *  own formatted size and a content-type tooltip. */
export const AttachmentTypes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders one message with a spread of attachment types and sizes, where the image previews inline as a thumbnail while the rest stay download chips showing their formatted sizes.',
      },
    },
  },
  args: {
    viewerRole: 'customer',
    // the image among these previews inline; the rest stay download chips
    fetchAttachmentUrl: async () => screenshot('screenshot', 210),
    messages: [
      {
        message_id: 'att',
        author_type: 'customer',
        author_id: 'acme',
        body: 'Attaching everything I gathered:',
        created: ago(8),
        attachments: [
          { attachment_id: 'a1', filename: 'screenshot.png', content_type: 'image/png', size_bytes: 842_000 },
          { attachment_id: 'a2', filename: 'deploy-trace.log', content_type: 'text/plain', size_bytes: 12_800 },
          { attachment_id: 'a3', filename: 'incident-report.pdf', content_type: 'application/pdf', size_bytes: 3_400_000 },
          { attachment_id: 'a4', filename: 'pool-config.yaml', content_type: 'application/x-yaml', size_bytes: 640 },
          { attachment_id: 'a5', filename: 'heap-dump.hprof', content_type: 'application/octet-stream', size_bytes: 1_750_000_000 },
        ],
      },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // the image renders as a thumbnail (an <img>, not a filename chip) …
    await waitFor(() => {
      const img = canvasElement.querySelector('img[alt="screenshot.png"]');
      if (!img) {
        throw new Error('image thumbnail not rendered yet');
      }
    });
    // … while the non-image files stay chips, each with its per-unit size
    await expect(canvas.getByText('deploy-trace.log')).toBeInTheDocument();
    await expect(canvas.getByText('640 B')).toBeInTheDocument();
    await expect(canvas.getByText('1.6 GB')).toBeInTheDocument();
  },
};

/** The system-message range — created, assigned, priority, status, reopened,
 *  resolved — each a centred muted line rather than a card. */
export const SystemEvents: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the full range of system messages — opened, assigned, priority, status, reopened, resolved — each as a centred muted line rather than a card.',
      },
    },
  },
  args: {
    viewerRole: 'customer',
    messages: [
      { message_id: 's1', author_type: 'system', author_id: 'system', body: 'Ticket opened.', created: ago(300) },
      { message_id: 's2', author_type: 'system', author_id: 'system', body: 'Assigned to Qorus Support.', created: ago(280) },
      { message_id: 'c1', author_type: 'customer', author_id: 'acme', body: 'Any update on this?', created: ago(200) },
      { message_id: 's3', author_type: 'system', author_id: 'system', body: 'Priority raised to **High**.', created: ago(190) },
      { message_id: 's4', author_type: 'system', author_id: 'system', body: 'Status changed to **Awaiting your reply**.', created: ago(120) },
      { message_id: 's5', author_type: 'system', author_id: 'system', body: 'Ticket reopened.', created: ago(60) },
      { message_id: 's6', author_type: 'system', author_id: 'system', body: 'Ticket resolved.', created: ago(5) },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Ticket opened/)).toBeInTheDocument();
    await expect(canvas.getByText(/Ticket resolved/)).toBeInTheDocument();
  },
};

/** A burst of consecutive same-author replies collapses under a single timestamp
 *  (one `ReqoreBubbleGroup`) rather than stamping every card. */
export const GroupedBurst: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a burst of consecutive same-author staff replies collapsed under a single timestamp, rather than stamping every card.',
      },
    },
  },
  args: {
    viewerRole: 'staff',
    messages: [
      { message_id: 'g0', author_type: 'customer', author_id: 'acme', body: 'The deploy is still failing.', created: ago(30) },
      { message_id: 'g1', author_type: 'staff', author_id: 'nick', body: 'Looking now.', created: ago(9) },
      { message_id: 'g2', author_type: 'staff', author_id: 'nick', body: 'Reproduced it locally.', created: ago(8) },
      { message_id: 'g3', author_type: 'staff', author_id: 'nick', body: 'The pool default dropped to 1 in 3.2.', created: ago(7) },
      { message_id: 'g4', author_type: 'staff', author_id: 'nick', body: 'Fix is going out in 3.2.1 — I will confirm here.', created: ago(6) },
    ],
  },
};

/** An internal note sits amber under "Internal note" for staff, next to a normal
 *  reply — the two must never be confusable. Customer never receives it. */
export const InternalNote: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders a staff thread where an internal note sits amber under 'Internal note' beside a normal reply, so the two can never be confused.",
      },
    },
  },
  args: {
    viewerRole: 'staff',
    messages: [
      { message_id: 'i0', author_type: 'customer', author_id: 'acme', body: 'Is there a workaround while I wait?', created: ago(40) },
      {
        message_id: 'i1',
        author_type: 'staff',
        author_id: 'nick',
        internal: true,
        body: 'Root cause is the 3.2 pool default. Do **not** promise a date yet — patch is unverified.',
        created: ago(30),
      },
      { message_id: 'i2', author_type: 'staff', author_id: 'nick', body: 'You can raise `max-pool-size` to 8 as a temporary workaround.', created: ago(20) },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Internal note')).toBeInTheDocument();
  },
};

/** A single message — the footer count reads "1 message", not "1 messages". */
export const SingleMessage: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders a thread with a single message, so the footer count reads '1 message' rather than '1 messages'.",
      },
    },
  },
  args: {
    viewerRole: 'customer',
    messages: [
      { message_id: 'one', author_type: 'customer', author_id: 'acme', body: 'Just opened this — nothing else yet.', created: ago(2) },
    ],
  },
  async play({ canvasElement }) {
    await expect(within(canvasElement).getByText('1 message')).toBeInTheDocument();
  },
};

/** A long conversation that overflows the drawer body — confirms it scrolls and
 *  the latest message sits at the bottom against the composer. */
export const LongThread: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a 16-message conversation that overflows the drawer body, confirming it scrolls and auto-scrolls to the newest message resting at the bottom against the composer.',
      },
    },
  },
  args: {
    viewerRole: 'customer',
    messages: Array.from({ length: 16 }, (_, i) => ({
      message_id: `l${i}`,
      author_type: (i % 2 === 0 ? 'customer' : 'staff') as TTicketMessageAuthor,
      author_id: i % 2 === 0 ? 'acme' : 'nick',
      body:
        i % 2 === 0
          ? `Follow-up ${i / 2 + 1}: still seeing the failure after the last change.`
          : 'Thanks — pushing another fix and will report back.',
      created: ago((16 - i) * 15),
    })),
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const footer = await canvas.findByText('16 messages');
    // The 16-message thread overflows the 520px drawer body — walk up to the scroll area.
    let scroller = footer.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
      scroller = scroller.parentElement;
    }
    if (!scroller) {
      throw new Error('no scroll container around the overflowing thread');
    }
    const scrollArea = scroller;
    // On open the thread auto-scrolls to the newest message: the area rests at its END,
    // not at the top (scrollTop 0) on the oldest message. Drop the scroll effect in
    // TicketThread and scrollTop stays 0 — this assertion then fails.
    await waitFor(() => {
      expect(scrollArea.scrollTop).toBeGreaterThan(0);
      expect(scrollArea.scrollTop + scrollArea.clientHeight).toBeGreaterThanOrEqual(
        scrollArea.scrollHeight - 4
      );
    });
  },
};

/**
 * Image attachments preview inline: a screenshot renders as a thumbnail the reader can
 * click to enlarge (`fetchAttachmentUrl` supplies the bytes), while a non-image on the
 * same message stays a download chip. Without `fetchAttachmentUrl` every attachment —
 * images included — falls back to the chip, which is what `CustomerView` shows.
 */
export const ImagePreview: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a message whose image attachments preview inline as thumbnails — clicking one opens the enlarge view — while a non-image on the same message stays a download chip.',
      },
    },
  },
  args: {
    viewerRole: 'customer',
    fetchAttachmentUrl: async (id: string) =>
      screenshot(id === 'img-1' ? 'before' : 'after', id === 'img-1' ? 265 : 205),
    messages: [
      {
        message_id: 'img',
        author_type: 'customer',
        author_id: 'acme',
        body: 'Here is the canvas before and after the upgrade, plus the server log:',
        created: ago(6),
        attachments: [
          { attachment_id: 'img-1', filename: 'before.png', content_type: 'image/png', size_bytes: 512_000 },
          { attachment_id: 'img-2', filename: 'after.png', content_type: 'image/png', size_bytes: 486_000 },
          { attachment_id: 'log-1', filename: 'server.log', content_type: 'text/plain', size_bytes: 24_800 },
        ],
      },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // the two images render as thumbnails …
    const thumb = await waitFor(() => {
      const img = canvasElement.querySelector<HTMLImageElement>('img[alt="before.png"]');
      if (!img) {
        throw new Error('thumbnail not rendered yet');
      }
      return img;
    });
    // … while the non-image stays a download chip
    await expect(canvas.getByText('server.log')).toBeInTheDocument();
    // clicking a thumbnail opens the enlarge view
    await userEvent.click(thumb);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
  },
};

/**
 * One message carrying the whole stack at once — a formatted body, image thumbnails,
 * file chips, and interface references — so the vertical order and spacing of all four
 * blocks together is reviewable in one place, not only in isolation. Body first, then
 * the two attachment rows (images, then files), then the reference chips.
 */
export const Everything: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders one message carrying the whole stack at once — a formatted body, image thumbnails, file chips, and interface references — so the order and spacing of all four blocks is reviewable together.',
      },
    },
  },
  args: {
    viewerRole: 'customer',
    fetchAttachmentUrl: async (id: string) =>
      screenshot(id === 'e-img-1' ? 'canvas' : 'console', id === 'e-img-1' ? 265 : 200),
    resolveInterfaceIcon: (kind) =>
      kind === 'workflow'
        ? 'GitBranchLine'
        : kind === 'service'
        ? 'ServerLine'
        : kind === 'job'
        ? 'CalendarLine'
        : 'Plug2Line',
    onInterfaceClick: fn(),
    messages: [
      {
        message_id: 'everything',
        author_type: 'customer',
        author_id: 'acme',
        created: ago(4),
        body: [
          'The nightly **deploy** fails at the mapper step. Two screenshots, the trace, the',
          'config, and the interfaces involved:',
          '',
          '- reproduces every run since `3.2`',
          '- only when the pool drops below `4`',
        ].join('\n'),
        attachments: [
          { attachment_id: 'e-img-1', filename: 'canvas-error.png', content_type: 'image/png', size_bytes: 512_000 },
          { attachment_id: 'e-img-2', filename: 'console.png', content_type: 'image/png', size_bytes: 388_000 },
          { attachment_id: 'e-file-1', filename: 'deploy-trace.log', content_type: 'text/plain', size_bytes: 12_800 },
          { attachment_id: 'e-file-2', filename: 'pool-config.yaml', content_type: 'application/x-yaml', size_bytes: 640 },
        ],
        referenced_interfaces: [
          { interface_kind: 'workflow', interface_name: 'order-sync:1.2', reference_id: 'e-ref-1' },
          { interface_kind: 'service', interface_name: 'notification-svc', reference_id: 'e-ref-2' },
          { interface_kind: 'job', interface_name: 'nightly-recon', reference_id: 'e-ref-3' },
          { interface_kind: 'connection', interface_name: 'pgsql-omq', reference_id: 'e-ref-4' },
        ],
      },
      {
        message_id: 'everything-reply',
        author_type: 'staff',
        author_id: 'nick',
        created: ago(1),
        body: 'Got it — the screenshots confirm the mapper NPE. Looking at the pool default now.',
      },
    ],
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // an image thumbnail …
    await waitFor(() => {
      if (!canvasElement.querySelector('img[alt="canvas-error.png"]')) {
        throw new Error('thumbnail not rendered yet');
      }
    });
    // … a file chip …
    await expect(canvas.getByText('deploy-trace.log')).toBeInTheDocument();
    // … and an interface reference, all on the one message
    await expect(canvas.getByText('order-sync:1.2')).toBeInTheDocument();
    await expect(canvas.getByText('pgsql-omq')).toBeInTheDocument();
  },
};
