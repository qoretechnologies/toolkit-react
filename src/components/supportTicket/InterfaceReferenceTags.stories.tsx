import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { InterfaceReferenceTags } from './InterfaceReferenceTags';
import { IInterfaceReference } from './meta';

// Several references, including two of the same kind (workflow), as `{kind, name}`
// snapshots — no `resolveInterfaceIcon` is passed, so the built-in per-kind default
// icons are exercised.
const REFERENCES: IInterfaceReference[] = [
  { interface_kind: 'workflow', interface_name: 'order-sync:1.2', reference_id: 'r1' },
  { interface_kind: 'workflow', interface_name: 'invoice-sync:2.3', reference_id: 'r2' },
  { interface_kind: 'service', interface_name: 'notification-svc', reference_id: 'r3' },
  { interface_kind: 'job', interface_name: 'nightly-cleanup', reference_id: 'r4' },
];

const meta = {
  component: InterfaceReferenceTags,
  title: 'Components/InterfaceReferenceTags',
  args: {
    references: REFERENCES,
    label: 'References',
  },
} as StoryMeta<typeof InterfaceReferenceTags>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ticket-header use: a "References" label followed by one chip per reference. */
export const Default: Story = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('References')).toBeInTheDocument();
    await expect(canvas.getByText('order-sync:1.2')).toBeInTheDocument();
    await expect(canvas.getByText('invoice-sync:2.3')).toBeInTheDocument();
    await expect(canvas.getByText('notification-svc')).toBeInTheDocument();
    await expect(canvas.getByText('nightly-cleanup')).toBeInTheDocument();
  },
};

/**
 * When `onInterfaceClick` is passed the chips become interactive; clicking one
 * calls it with that reference (the customer view, which can open the interface on
 * its own instance, wires this).
 */
export const Clickable: Story = {
  args: { onInterfaceClick: fn() },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
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

/** The in-thread use: no label — the chips sit under a message. */
export const NoLabel: Story = {
  args: { label: undefined },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('References')).not.toBeInTheDocument();
    await expect(canvas.getByText('order-sync:1.2')).toBeInTheDocument();
  },
};

/**
 * With no references the component renders nothing — no empty header, no chips —
 * so a ticket without references shows a clean gap rather than a stray "References:"
 * label. The dashed frame below is a story-only caption; the empty space inside it
 * is the component.
 */
export const Empty: Story = {
  args: { references: [] },
  decorators: [
    (Story) => (
      <div
        style={{
          border: '1px dashed rgba(150, 150, 150, 0.4)',
          borderRadius: 6,
          padding: 12,
          fontSize: 12,
          opacity: 0.6,
        }}
      >
        No references → the row renders nothing (no empty header, no chips):
        <Story />
      </div>
    ),
  ],
  async play({ canvasElement }) {
    // The dashed frame + caption are the decorator; the component itself renders
    // nothing — no header text, no chips.
    await expect(within(canvasElement).queryByText('References')).not.toBeInTheDocument();
    await expect(within(canvasElement).queryByText('order-sync:1.2')).not.toBeInTheDocument();
  },
};
