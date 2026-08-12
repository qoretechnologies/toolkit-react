import { ReqoreButton, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, waitFor, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { InterfaceReferenceTags } from './InterfaceReferenceTags';
import { TicketReplyBox } from './TicketReplyBox';

const meta = {
  component: TicketReplyBox,
  title: 'Components/TicketReplyBox',
  args: {
    onSend: fn(),
  },
} as StoryMeta<typeof TicketReplyBox>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The customer composer, plain-editor variant (used here for a deterministic
 * type→send test): an attach button (no extra menu → a plain button, not a
 * dropdown) and Send. No internal-note toggle. Typing enables Send; clicking it
 * calls `onSend` with the body and `internal: false`.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the customer composer's plain-editor variant — an attach button and Send, no internal-note toggle; typing a reply enables Send, which calls onSend with the body and internal: false.",
      },
    },
  },
  args: { editor: 'plain' },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const textarea = canvasElement.querySelector('textarea');
    await expect(textarea).not.toBeNull();
    await expect(canvas.queryByText('Internal note')).not.toBeInTheDocument();

    await userEvent.type(textarea!, 'Here is my reply');
    await userEvent.click(canvas.getByText('Send reply'));
    await waitFor(() =>
      expect(args.onSend).toHaveBeenCalledWith(
        'Here is my reply',
        expect.objectContaining({ internal: false })
      )
    );
  },
};

/**
 * The staff composer (`allowInternalNote`): no toggle — the send button splits, so
 * the primary action posts a public reply and the caret opens "Add internal note",
 * which sends with `internal: true`.
 */
export const StaffWithInternalNote: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the staff composer with a split send button — the primary action posts a public reply, while the caret opens 'Add internal note', which sends with internal: true.",
      },
    },
  },
  args: { allowInternalNote: true, editor: 'plain' },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    // no toggle any more; the primary action is a plain "Send reply"
    await expect(canvas.queryByText('Internal note')).not.toBeInTheDocument();
    await expect(canvas.getByText('Send reply')).toBeInTheDocument();

    const textarea = canvasElement.querySelector('textarea');
    await userEvent.type(textarea!, 'internal context');

    // "Add internal note" lives behind the split-send caret
    const caret = canvasElement.querySelector('.ticket-send-more');
    await expect(caret).not.toBeNull();
    await userEvent.click(caret as Element);
    await userEvent.click(await screen.findByText('Add internal note'));

    await waitFor(() =>
      expect(args.onSend).toHaveBeenCalledWith(
        'internal context',
        expect.objectContaining({ internal: true })
      )
    );
  },
};

/** A closed ticket replaces the editor with a muted notice. */
export const Closed: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders a closed ticket, where the disabled composer replaces the editor with a muted 'ticket is closed' notice.",
      },
    },
  },
  args: { disabled: true },
  async play({ canvasElement }) {
    await expect(within(canvasElement).getByText(/ticket is closed/i)).toBeInTheDocument();
    await expect(canvasElement.querySelector('textarea')).toBeNull();
  },
};

/**
 * The helpdesk composer as it now ships: the shared `<Composer>` with the rich,
 * Qonsole-style editor (`ReqoreRichTextEditor`) instead of a plain textarea. Staff
 * split-send, an attach dropdown (Upload + injected screenshot/capture), the
 * reference-interfaces toggle, and a reference chip below — all through the same
 * slots. Markdown still flows to `onSend` as a plain string. This is the input the
 * helpdesk uses.
 */
export const RichHelpdeskReply: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the shipping helpdesk composer with the rich Qonsole-style editor — staff split-send, an attach dropdown, a reference-interfaces toggle, and an interface reference chip above the input.',
      },
    },
  },
  // Rendered under the Qorus theme (as in qorus-ide / admin-portal) so the
  // `custom1` accent shows as the Qorus purple — a bare reqore theme greys it out.
  decorators: [
    (Story) => (
      <ReqoreUIProvider theme={{ main: '#121212', intents: { custom1: '#762f7e' } }}>
        <div style={{ padding: 20, background: '#121212' }}>
          <Story />
        </div>
      </ReqoreUIProvider>
    ),
  ],
  args: {
    allowInternalNote: true,
    defaultText:
      "Thanks for the detailed report — we've reproduced the timeout and a fix is in review. In the meantime, can you confirm the datasource pool size configured for the sftp-partner connection?",
    attachMenuItems: () => [
      { label: 'Take screenshot', icon: 'CameraAiLine', onClick: fn() },
      { label: 'Capture area', icon: 'CropLine', onClick: fn() },
    ],
    // the reference toggle, styled to the same custom1 accent as the send
    footerActions: (
      <ReqoreButton
        icon='LinksLine'
        minimal
        flat
        badge={1}
        customTheme={{ main: 'custom1' }}
        tooltip='Reference interfaces'
      />
    ),
    // references on top of the editor (inside the bar), tinted to the accent — no
    // "References" label, the chips read as the referenced interfaces on their own
    aboveInput: (
      <InterfaceReferenceTags
        references={[{ interface_kind: 'connection', interface_name: 'sftp-partner' }]}
        customTheme={{ main: 'custom1' }}
      />
    ),
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // rich editor renders a Slate contenteditable (not a <textarea>) …
    await expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull();
    await expect(canvasElement.querySelector('textarea')).toBeNull();
    // … the staff split-send caret is present …
    await expect(canvasElement.querySelector('.ticket-send-more')).not.toBeNull();
    // … and the reference chip renders on top (no "References" label).
    await expect(canvas.getByText('sftp-partner')).toBeInTheDocument();
    await expect(canvas.queryByText('References')).not.toBeInTheDocument();
  },
};

/**
 * Every referenceable interface kind on one message, so the per-kind icons +
 * accent chip styling can be reviewed together: workflow, service, job, fsm,
 * connection, mapper, class, value-map, qog, ai-collection, ai-endpoint,
 * ai-guardrail. (`qog` has no built-in icon → the generic fallback.)
 */
export const AllReferenceTypes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a reply carrying every referenceable interface kind at once, so the per-kind icons and accent chip styling can be reviewed together (qog falls back to the generic glyph).',
      },
    },
  },
  decorators: [
    (Story) => (
      <ReqoreUIProvider theme={{ main: '#121212', intents: { custom1: '#762f7e' } }}>
        <div style={{ padding: 20, background: '#121212' }}>
          <Story />
        </div>
      </ReqoreUIProvider>
    ),
  ],
  args: {
    defaultText: 'This one references every interface kind.',
    aboveInput: (
      <InterfaceReferenceTags
        customTheme={{ main: 'custom1' }}
        references={[
          { interface_kind: 'workflow', interface_name: 'order-sync:1.2' },
          { interface_kind: 'service', interface_name: 'notifier' },
          { interface_kind: 'job', interface_name: 'nightly-recon' },
          { interface_kind: 'fsm', interface_name: 'onboarding' },
          { interface_kind: 'connection', interface_name: 'sftp-partner' },
          { interface_kind: 'mapper', interface_name: 'csv-to-order' },
          { interface_kind: 'class', interface_name: 'OrderUtils' },
          { interface_kind: 'value-map', interface_name: 'country-codes' },
          { interface_kind: 'qog', interface_name: 'daily-report' },
          { interface_kind: 'ai-collection', interface_name: 'kb-support' },
          { interface_kind: 'ai-endpoint', interface_name: 'gpt-router' },
          { interface_kind: 'ai-guardrail', interface_name: 'pii-filter' },
        ]}
      />
    ),
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('workflow')).toBeInTheDocument();
    await expect(canvas.getByText('ai-guardrail')).toBeInTheDocument();
  },
};

// Stand-in app logos (a coloured rounded square + initial) as data-URIs, so the
// story needs no network. Real logos come from the app catalogue (`app.logo`).
const appLogo = (hex: string, letter: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${hex}"/><text x="12" y="17" font-size="13" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text></svg>`
  )}`;
const APP_LOGOS: Record<string, string> = {
  Telegram: appLogo('#2AABEE', 'T'),
  Stripe: appLogo('#635BFF', 'S'),
};

/**
 * Faithful qog icons — a qog referenced by its trigger app shows that app's logo,
 * exactly like the qogs list. The customer's IDE resolves it live from the
 * reference's `trigger_app` via `resolveInterfaceImage` (it has the app catalogue);
 * a stored `logo` travels to viewers that don't (staff triage, the Qonsole card).
 * A qog with no trigger app falls back to the qog glyph.
 */
export const QogTriggerAppLogo: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders qogs referenced by their trigger apps, each showing that app's logo — resolved live via resolveInterfaceImage or from a stored logo — while a qog with no trigger app falls back to the qog glyph.",
      },
    },
  },
  decorators: [
    (Story) => (
      <ReqoreUIProvider theme={{ main: '#121212', intents: { custom1: '#762f7e' } }}>
        <div style={{ padding: 20, background: '#121212' }}>
          <Story />
        </div>
      </ReqoreUIProvider>
    ),
  ],
  args: {
    defaultText: 'These qogs are referenced by their trigger apps.',
    aboveInput: (
      <InterfaceReferenceTags
        customTheme={{ main: 'custom1' }}
        references={[
          // resolved live from trigger_app (the customer/IDE path)
          { interface_kind: 'qog', interface_name: 'telegram-intake', trigger_app: 'Telegram' },
          { interface_kind: 'qog', interface_name: 'stripe-billing', trigger_app: 'Stripe' },
          // stored logo travels to viewers without the app catalogue (staff / Qonsole)
          { interface_kind: 'qog', interface_name: 'slack-alerts', logo: appLogo('#4A154B', 'S') },
          // no trigger app → the qog glyph fallback
          { interface_kind: 'qog', interface_name: 'manual-recon' },
        ]}
        resolveInterfaceImage={(ref) => (ref.trigger_app ? APP_LOGOS[ref.trigger_app] : undefined)}
      />
    ),
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('telegram-intake')).toBeInTheDocument();
    // the trigger-app / stored-logo qogs render their app logo image
    await expect(canvasElement.innerHTML).toContain('data:image');
  },
};

// A stand-in "screenshot" as an SVG File so the story needs no real capture — the
// composer's attachment strip renders any image File as a thumbnail (the real IDE
// stages a PNG from captureScreenshot / captureRegion the same way).
const screenshotFile = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="150" viewBox="0 0 260 150">
    <rect width="260" height="150" rx="8" fill="#0f0b16"/>
    <rect width="260" height="26" fill="#1c1428"/>
    <circle cx="16" cy="13" r="4" fill="#ff5f57"/><circle cx="32" cy="13" r="4" fill="#febc2e"/><circle cx="48" cy="13" r="4" fill="#28c840"/>
    <rect x="16" y="44" width="110" height="12" rx="3" fill="#8e39a0"/>
    <rect x="16" y="68" width="228" height="9" rx="3" fill="#2c2440"/>
    <rect x="16" y="86" width="200" height="9" rx="3" fill="#2c2440"/>
    <rect x="16" y="104" width="170" height="9" rx="3" fill="#2c2440"/>
    <rect x="16" y="122" width="92" height="9" rx="3" fill="#2c2440"/>
  </svg>`;
  return new File([svg], 'region-capture.svg', { type: 'image/svg+xml' });
};

/**
 * A composed reply with both a staged screenshot (the attachment strip renders any
 * image File as a thumbnail — the real IDE stages a PNG from Take-screenshot /
 * Capture-area) and interface references on top.
 */
export const WithScreenshotAndReferences: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders a composed reply carrying both a staged screenshot thumbnail in the attachment strip and interface references above the input.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ReqoreUIProvider theme={{ main: '#121212', intents: { custom1: '#762f7e' } }}>
        <div style={{ padding: 20, background: '#121212' }}>
          <Story />
        </div>
      </ReqoreUIProvider>
    ),
  ],
  args: {
    defaultText: "Here's the timeout I'm seeing on the nightly run — screenshot attached.",
    defaultFiles: [screenshotFile()],
    aboveInput: (
      <InterfaceReferenceTags
        customTheme={{ main: 'custom1' }}
        references={[
          { interface_kind: 'connection', interface_name: 'sftp-partner' },
          { interface_kind: 'qog', interface_name: 'telegram-intake', logo: appLogo('#2AABEE', 'T') },
        ]}
      />
    ),
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // the staged screenshot thumbnail (an <img>) and the references both render
    await expect(canvasElement.querySelector('img')).not.toBeNull();
    await expect(canvas.getByText('sftp-partner')).toBeInTheDocument();
  },
};
