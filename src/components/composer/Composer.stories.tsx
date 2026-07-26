import { ReqoreButton, ReqoreTag, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { Composer } from './Composer';

const meta = {
  component: Composer,
  title: 'Components/Composer',
  args: {
    onSend: fn(),
  },
} as StoryMeta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default: the rich, Qonsole-style editor (`ReqoreRichTextEditor`). It renders
 * a Slate contenteditable (not a `<textarea>`), an attach button, and Send.
 */
export const Rich: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the default rich editor — a Slate contenteditable (not a textarea) with an attach button and Send, seeded with a multi-line draft.',
      },
    },
  },
  args: {
    placeholder: 'Write a message…',
    defaultText: 'A rich, multi-line draft.\nSecond paragraph survives as a newline.',
  },
  async play({ canvasElement }) {
    await expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull();
    await expect(canvasElement.querySelector('textarea')).toBeNull();
    await expect(within(canvasElement).getByText('Send')).toBeInTheDocument();
  },
};

/**
 * The `plain` variant — a `ReqoreTextarea`, used where a simple text field is
 * enough (and for deterministic tests). Typing enables Send; clicking it calls
 * `onSend` with the plain body and the staged files.
 */
export const Plain: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the plain textarea variant, where typing enables Send and clicking it calls onSend with the plain body and the staged files.',
      },
    },
  },
  args: { editor: 'plain' },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const textarea = canvasElement.querySelector('textarea');
    await expect(textarea).not.toBeNull();

    await userEvent.type(textarea!, 'hello there');
    await userEvent.click(canvas.getByText('Send'));
    await waitFor(() =>
      expect(args.onSend).toHaveBeenCalledWith(
        'hello there',
        expect.objectContaining({ files: [] })
      )
    );
  },
};

/**
 * Multiple `sendActions` split the send button — a primary button plus a caret
 * dropdown. The primary is the first action; its `id` is echoed back to `onSend`.
 */
export const SplitSend: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the composer with multiple sendActions, splitting Send into a primary Publish button plus a caret dropdown — sending echoes the chosen action's id back to onSend.",
      },
    },
  },
  args: {
    editor: 'plain',
    sendActions: [
      { id: 'publish', label: 'Publish', icon: 'SendPlane2Line' },
      { id: 'draft', label: 'Save draft', icon: 'FileLine' },
    ],
  },
  async play({ canvasElement, args }) {
    const canvas = within(canvasElement);
    const textarea = canvasElement.querySelector('textarea');
    await userEvent.type(textarea!, 'ship it');
    await userEvent.click(canvas.getByText('Publish'));
    await waitFor(() =>
      expect(args.onSend).toHaveBeenCalledWith(
        'ship it',
        expect.objectContaining({ action: 'publish' })
      )
    );
  },
};

/**
 * A map of the composer's injection slots. The same Composer becomes the Qonsole
 * input or the helpdesk reply box by filling these — so here every slot renders a
 * tag naming itself, to show exactly where each one lands:
 *
 * - `attachMenuItems` — turns the `+` into a dropdown (open it for the entry)
 * - `toolbarStart` — after `+` on the left
 * - `footerActions` — after `toolbarStart`
 * - `rightActions` — just left of Send
 * - `aboveInput` — on top of the editor, inside the bar (Qonsole's reference chips)
 * - `belowInput` — under the whole bar
 */
const slotTag = (name: string) => <ReqoreTag label={name} size='small' intent='info' />;

export const WithSlots: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders every composer injection slot — attachMenuItems, toolbarStart, footerActions, rightActions, aboveInput, and belowInput — each filled with a self-naming tag, so the story reads as a legible map of where each slot lands.',
      },
    },
  },
  args: {
    editor: 'plain',
    attachMenuItems: () => [
      { label: 'attachMenuItems entry', icon: 'CameraAiLine', onClick: fn() },
    ],
    toolbarStart: slotTag('toolbarStart'),
    footerActions: slotTag('footerActions'),
    rightActions: slotTag('rightActions'),
    aboveInput: slotTag('aboveInput'),
    belowInput: slotTag('belowInput'),
  },
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    // every slot renders its own marker, so the story is a legible slot map
    for (const slot of [
      'toolbarStart',
      'footerActions',
      'rightActions',
      'aboveInput',
      'belowInput',
    ]) {
      await expect(canvas.getByText(slot)).toBeInTheDocument();
    }
  },
};

/**
 * Proof that the composer is configurable enough to *be* the qorus-ide Qonsole
 * input — no fork. Wrapped in qorus-ide's Reqore theme (`main #121212`,
 * `custom1 #762f7e`) and given the same effect + controls the real QonsoleInput
 * uses: the `custom1:darken` gradient bar, an icon-only `custom1` send, and the
 * `+` / `/` / compass controls in the slots. Compare against
 * :6006 story `qonsole-ui-components--business-impact`.
 */
export const QonsoleReplica: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the composer configured to replicate qorus-ide's QonsoleInput — a dark custom1 theme, gradient bar, icon-only send, and the slash-commands and design-session compass controls in its slots.",
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
    placeholder: "Tell Qorus what you're trying to do…",
    // the exact QonsoleInput bar effect (a custom1 gradient border + fill)
    effect: { gradient: { direction: 'to bottom right', colors: 'custom1:darken:1:0.9' } },
    // icon-only, custom1-themed, minimal — the Qonsole send
    sendActions: [{ id: 'send', icon: 'SendPlane2Line', customTheme: { main: 'custom1' }, minimal: true }],
    // `+` becomes a dropdown once it has extra items (screenshot / capture), like Qonsole
    attachMenuItems: () => [
      { label: 'Take screenshot', icon: 'CameraAiLine', onClick: fn() },
      { label: 'Capture area', icon: 'CropLine', onClick: fn() },
    ],
    // the `/` slash-commands control (a stand-in for the Qonsole completions dropdown)
    toolbarStart: (
      <ReqoreButton
        icon='SlashCommands2'
        minimal
        flat
        size='small'
        customTheme={{ main: 'custom1' }}
        tooltip='Slash commands'
      />
    ),
    // the design-session compass, left of send — exactly where QonsoleInput puts it
    rightActions: (
      <ReqoreButton
        icon='Compass3Line'
        minimal
        flat
        size='small'
        customTheme={{ main: 'custom1' }}
        tooltip='Start a design session'
      />
    ),
  },
  async play({ canvasElement }) {
    // rich editor + the icon-only send (no "Send" label) render
    await expect(canvasElement.querySelector('[contenteditable="true"]')).not.toBeNull();
    await expect(within(canvasElement).queryByText('Send')).not.toBeInTheDocument();
  },
};

/** `disabled` replaces the whole composer with a muted notice. */
export const Disabled: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the disabled state, where the whole composer is replaced by a muted notice showing the disabledReason.',
      },
    },
  },
  args: { disabled: true, disabledReason: 'This channel is read-only.' },
  async play({ canvasElement }) {
    await expect(within(canvasElement).getByText('This channel is read-only.')).toBeInTheDocument();
    await expect(canvasElement.querySelector('textarea')).toBeNull();
  },
};
