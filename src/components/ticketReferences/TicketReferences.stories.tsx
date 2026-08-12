import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { StoryMeta } from '../../types';
import { IInterfaceReference } from '../supportTicket/meta';
import { ITicketReferenceAttachment, TicketReferences } from './TicketReferences';

const NOW = Date.parse('2026-06-30T12:00:00Z');
const ago = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

// The stories stand in for the authed blob-download endpoint by handing back an
// inline SVG data-URI per image id, so thumbnails + the lightbox render offline.
const svgUrl = (label: string, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">` +
      `<rect width="640" height="400" fill="${color}"/>` +
      `<text x="320" y="215" font-size="30" fill="#ffffff" text-anchor="middle" ` +
      `font-family="sans-serif">${label}</text></svg>`
  )}`;

const REFERENCES: IInterfaceReference[] = [
  { interface_kind: 'workflow', interface_name: 'order-sync:1.0', reference_id: 'r1' },
  { interface_kind: 'workflow', interface_name: 'invoice-sync:2.3', reference_id: 'r2' },
  { interface_kind: 'service', interface_name: 'datasource-pool:2.3', reference_id: 'r3' },
  { interface_kind: 'job', interface_name: 'nightly-reconcile', reference_id: 'r4' },
  { interface_kind: 'connection', interface_name: 'pg-main-ro', reference_id: 'r5' },
];

// Uploaders come already resolved from the endpoint: customer uploads carry the
// account, a staff reply's attachment reads "Qorus Support" on the customer plane.
const ATTACHMENTS: ITicketReferenceAttachment[] = [
  { attachment_id: 'img-1', filename: 'error-screenshot.png', content_type: 'image/png', size_bytes: 148_221, uploaded_by: 'acme-prod', uploader_type: 'customer', created: ago(180), message_id: 'm1' },
  { attachment_id: 'img-2', filename: 'pool-metrics.png', content_type: 'image/png', size_bytes: 96_540, uploaded_by: 'Qorus Support', uploader_type: 'staff', created: ago(120), message_id: 'm2' },
  { attachment_id: 'img-3', filename: 'stack-trace.png', content_type: 'image/png', size_bytes: 210_004, uploaded_by: 'acme-prod', uploader_type: 'customer', created: ago(60), message_id: 'm3' },
  { attachment_id: 'file-1', filename: 'nightly-trace.log', content_type: 'text/x-log', size_bytes: 219_136, uploaded_by: 'acme-prod', uploader_type: 'customer', created: ago(180), message_id: 'm1' },
  { attachment_id: 'file-2', filename: 'incident-report.pdf', content_type: 'application/pdf', size_bytes: 512_900, uploaded_by: 'Qorus Support', uploader_type: 'staff', created: ago(90), message_id: 'm2' },
  { attachment_id: 'file-3', filename: 'pool-config.yaml', content_type: 'application/yaml', size_bytes: 2_048, uploaded_by: 'acme-prod', uploader_type: 'customer', created: ago(90) },
  { attachment_id: 'file-4', filename: 'diagnostics.zip', content_type: 'application/zip', size_bytes: 3_400_000, uploaded_by: 'acme-prod', uploader_type: 'customer', created: ago(30), message_id: 'm3' },
];

const IMG_URLS: Record<string, string> = {
  'img-1': svgUrl('error-screenshot', '#7b3fe4'),
  'img-2': svgUrl('pool-metrics', '#2872a0'),
  'img-3': svgUrl('stack-trace', '#b23c3c'),
};
const fetchAttachmentUrl = (id: string) => Promise.resolve(IMG_URLS[id] ?? svgUrl(id, '#555555'));

const meta = {
  component: TicketReferences,
  title: 'Components/TicketReferences',
  parameters: { layout: 'padded' },
  args: {
    references: REFERENCES,
    attachments: ATTACHMENTS,
    viewerRole: 'staff',
    onDownloadAttachment: fn(),
    fetchAttachmentUrl,
  },
} satisfies StoryMeta<typeof TicketReferences>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A busy ticket: 5 grouped interface references, 3 screenshots, 4 files, and the
 *  search / type-filter / sort strip a ticket this full earns. */
export const Populated: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a busy ticket with five grouped interface references, three screenshots, and four files — full enough to surface the search box, type-filter, and sort strip.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Linked interfaces')).toBeInTheDocument();
    await expect(canvas.getByText('Screenshots')).toBeInTheDocument();
    await expect(canvas.getByText('Files')).toBeInTheDocument();
    // references render as rows carrying their kind as metadata
    await expect(canvasElement.textContent).toContain('workflow');
    await expect(canvasElement.textContent).toContain('order-sync:1.0');
    // a file row with provenance (staff view shows uploaders as stored)
    await expect(canvas.getByText('incident-report.pdf')).toBeInTheDocument();
    await expect(canvasElement.textContent).toContain('added by acme-prod');
    // the control strip: search box + the type-filter and sort dropdowns
    await expect(
      canvas.getByPlaceholderText('Search files and references…')
    ).toBeInTheDocument();
    await expect(canvas.getByText('All types')).toBeInTheDocument();
    await expect(canvas.getByText('Newest first')).toBeInTheDocument();
    // thumbnails resolve to images
    await waitFor(() =>
      expect(
        canvasElement.querySelector('button[title="error-screenshot.png"] img')
      ).not.toBeNull()
    );
  },
};

/** The control strip in action: search narrows to matches, a no-match query offers
 *  "Clear filters", and the type filter collapses the view to one family. */
export const Filtering: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the control strip in action — searching narrows to matching files and references, a no-match query offers 'Clear filters', and the type filter collapses the view to a single family.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvas.getByPlaceholderText('Search files and references…');

    // search narrows across both files and screenshots by filename
    await userEvent.type(box, 'pool');
    await waitFor(() => {
      // "pool-*" survive, "error-screenshot"/"nightly-trace" fall away
      expect(canvas.getByText('pool-config.yaml')).toBeInTheDocument();
      expect(canvasElement.querySelector('button[title="pool-metrics.png"]')).not.toBeNull();
      expect(canvasElement.querySelector('button[title="error-screenshot.png"]')).toBeNull();
      expect(canvas.queryByText('nightly-trace.log')).toBeNull();
    });

    // a query that matches nothing surfaces the empty state + a clear affordance
    await userEvent.clear(box);
    await userEvent.type(box, 'zzz-no-such-file');
    await waitFor(() =>
      expect(canvasElement.textContent).toContain('No matching references or files')
    );
    await userEvent.click(canvas.getByText('Clear filters'));
    await waitFor(() => expect(canvas.getByText('Files')).toBeInTheDocument());

    // the type filter collapses to a single family (Screenshots only)
    await userEvent.click(canvas.getByText('All types'));
    await userEvent.click(await within(document.body).findByText(/^Screenshots \(3\)$/));
    await waitFor(() => {
      expect(canvas.queryByText('Files')).toBeNull();
      expect(canvas.queryByText('Linked interfaces')).toBeNull();
      expect(canvasElement.querySelector('button[title="stack-trace.png"]')).not.toBeNull();
    });
  },
};

/** Clicking a loaded screenshot opens the paging lightbox (portalled to body). */
export const LightboxOpens: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the references view and, when a loaded screenshot is clicked, opens the paging lightbox portalled to the body.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const thumb = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLButtonElement>(
        'button[title="error-screenshot.png"]'
      );
      if (!el || !el.querySelector('img')) {
        throw new Error('thumbnail not ready');
      }
      return el;
    });
    await userEvent.click(thumb);
    // error-screenshot is the oldest of the three, so under the default
    // newest-first sort it sits last — the counter reads "3 / 3".
    await waitFor(() => expect(document.body.textContent).toContain('3 / 3'));
  },
};

/** The same ticket from the customer's side: their own uploads read "you", and a
 *  staff reply's attachment reads "Qorus Support" — never the raw staff identity. */
export const CustomerView: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the same ticket from the customer's side, where their own uploads read 'added by you' and a staff reply's attachment reads 'Qorus Support' rather than the raw staff identity.",
      },
    },
  },
  args: { viewerRole: 'customer' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.textContent).toContain('added by you'));
    await expect(canvasElement.textContent).toContain('added by Qorus Support');
  },
};

/** Without a fetcher, screenshots degrade to download tiles rather than thumbnails. */
export const NoPreview: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the references view with no fetchAttachmentUrl, so screenshots degrade to download tiles rather than thumbnails.',
      },
    },
  },
  args: { fetchAttachmentUrl: undefined },
  play: async ({ canvasElement }) => {
    // No fetcher ⇒ the tile body falls through to the filename fallback. The caption
    // always shows the filename, so the discriminating checks are: no thumbnail image,
    // and no forever-pending "…" in the tile body (the qlip-caught regression).
    const tile = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('button[title="error-screenshot.png"]');
      if (!el) {
        throw new Error('screenshot tile not rendered');
      }
      return el;
    });
    await expect(tile.querySelector('img')).toBeNull();
    await expect(tile.textContent).not.toContain('…');
  },
};

/** Nothing attached or linked. */
export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the empty state with nothing attached or linked, showing 'No references or files yet'.",
      },
    },
  },
  args: { references: [], attachments: [], messages: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toContain('No references or files yet');
  },
};

/**
 * With `onShowInChat` wired, a row that came from a reply gains a "three dots" menu
 * offering to reveal it in the conversation.
 *
 * A row filed against the ticket itself carries the same menu, but its reveal is
 * disabled and labelled "Filed on the ticket" — there's no message to jump to. That
 * distinction between a reply-borne row and a ticket-level one is the thing to see here.
 */
export const ShowInChat: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders references with onShowInChat wired — a reply-borne row's menu offers an active 'Show in chat' that calls onShowInChat, while a ticket-level row carries the same menu with its reveal disabled ('Filed on the ticket').",
      },
    },
  },
  args: {
    messages: [
      {
        message_id: 'm-42',
        author_type: 'customer',
        author_id: 'acme-prod',
        body: 'Same failure on the reconcile job.',
        created: ago(30),
        referenced_interfaces: [{ interface_kind: 'job', interface_name: 'nightly-reconcile' }],
      },
    ],
    onShowInChat: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('nightly-reconcile')).toBeInTheDocument();

    const rowFor = (label: string) =>
      Array.from(canvasElement.querySelectorAll<HTMLElement>('.reqore-entity-row')).find((row) =>
        row.textContent?.includes(label)
      );

    // the reply-borne reference offers the menu...
    const fromReply = rowFor('nightly-reconcile');
    const menuButton = fromReply?.querySelector<HTMLElement>(
      '.reqore-entity-row-actions .reqore-button:last-child'
    );
    await userEvent.click(menuButton!);
    const item = await waitFor(() => {
      const found = Array.from(document.querySelectorAll<HTMLElement>('.reqore-menu-item')).find(
        (el) => /Show in chat/.test(el.textContent || '')
      );
      if (!found) {
        throw new Error('Show in chat not offered');
      }
      return found;
    });
    await userEvent.click(item);
    await expect(args.onShowInChat).toHaveBeenCalledWith('m-42');

    // ...and a ticket-level reference carries the SAME menu, so the rows don't look
    // half-broken — but the reveal is disabled there, because it was filed on the
    // ticket and has no message to jump to.
    const ticketLevel = rowFor('order-sync:1.0');
    const ticketMenu = ticketLevel?.querySelector<HTMLElement>(
      '.reqore-entity-row-actions .reqore-button:last-child'
    );
    await expect(ticketMenu).toBeTruthy();
    await userEvent.click(ticketMenu!);
    const ticketEntry = await waitFor(() => {
      const entry = Array.from(document.querySelectorAll<HTMLElement>('.reqore-menu-item')).find(
        (el) => /Show in chat/.test(el.textContent || '')
      );
      if (!entry) {
        throw new Error('the menu should still offer the entry, disabled');
      }
      return entry;
    });
    // it is genuinely unclickable, not merely styled as such — and the handler stays
    // on its single call from the reply-borne row above
    await expect(getComputedStyle(ticketEntry).pointerEvents).toBe('none');
    await expect(ticketEntry.textContent).toContain('Filed on the ticket');
    await expect(args.onShowInChat).toHaveBeenCalledTimes(1);
  },
};
