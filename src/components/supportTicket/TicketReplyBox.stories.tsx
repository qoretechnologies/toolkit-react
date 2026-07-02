import { ReqoreButton } from '@qoretechnologies/reqore';
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
 * The customer composer: a textarea, an attach button (no extra menu → a plain
 * button, not a dropdown), and Send. No internal-note toggle. Typing enables Send;
 * clicking it calls `onSend` with the body and `internal: false`.
 */
export const Default: Story = {
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
  args: { allowInternalNote: true },
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
  args: { disabled: true },
  async play({ canvasElement }) {
    await expect(within(canvasElement).getByText(/ticket is closed/i)).toBeInTheDocument();
    await expect(canvasElement.querySelector('textarea')).toBeNull();
  },
};

/**
 * The composer with app-injected affordances — how the qorus-ide customer view
 * dresses it: `attachMenuItems` adds screenshot/capture to the attach dropdown,
 * `footerActions` adds the reference-interfaces toggle, and `belowInput` hosts the
 * reference display/picker (here the shared `InterfaceReferenceTags` stands in).
 * The extra attach items receive `addFiles` so they can stage what they produce.
 */
export const WithSlots: Story = {
  args: {
    attachMenuItems: () => [
      { label: 'Take screenshot', icon: 'CameraAiLine', onClick: fn() },
      { label: 'Capture area', icon: 'CropLine', onClick: fn() },
    ],
    footerActions: (
      <ReqoreButton icon='LinksLine' minimal flat badge={1} tooltip='Reference interfaces' />
    ),
    belowInput: (
      <InterfaceReferenceTags
        label='References'
        references={[{ interface_kind: 'workflow', interface_name: 'order-sync:1.2' }]}
      />
    ),
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // the below-input slot (reference chips) and the footer toggle both render
    await expect(canvas.getByText('References')).toBeInTheDocument();
    await expect(canvas.getByText('order-sync:1.2')).toBeInTheDocument();
  },
};
