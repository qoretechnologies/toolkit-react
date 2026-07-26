import { StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { AttachmentChips } from './AttachmentChips';

/**
 * Staged-file chips for a ticket composer. Image files show a thumbnail and open the shared
 * `ImageLightbox` on click; other files show a paperclip. The pencil renames a file inline
 * (a File name is read-only, so the host swaps in a renamed copy); the ✕ removes it.
 */
const meta = {
  component: AttachmentChips,
  title: 'Components/AttachmentChips',
} as StoryMeta<typeof AttachmentChips>;
export default meta;
type Story = StoryObj<typeof meta>;

const imageFile = (label: string, hue: number, name: string): File => {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>` +
    `<rect width='640' height='400' fill='hsl(${hue},40%,16%)'/>` +
    `<text x='24' y='210' fill='white' font-family='sans-serif' font-size='30'>${label}</text></svg>`;
  return new File([svg], name, { type: 'image/svg+xml' });
};
const textFile = (name: string): File => new File(['log contents'], name, { type: 'text/plain' });

const FILES = [
  imageFile('before', 265, 'screenshot-2026-07-26-17-41-44.png'),
  imageFile('after', 205, 'canvas-after.png'),
  textFile('server.log'),
];

// Plays the composer's role: owns the file set, swaps in a renamed copy on rename.
const Harness = () => {
  const [files, setFiles] = useState<File[]>(FILES);
  return (
    <AttachmentChips
      files={files}
      onRemove={(index) => setFiles((current) => current.filter((_, j) => j !== index))}
      onRename={(index, name) =>
        setFiles((current) =>
          current.map((file, i) => (i === index ? new File([file], name, { type: file.type }) : file))
        )
      }
    />
  );
};

/**
 * Two screenshots + a log. Clicking a screenshot chip opens the lightbox (paging across the two
 * images); the log stays a plain chip. Proves the preview opens and paints the image.
 */
export const WithImages: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('screenshot-2026-07-26-17-41-44.png')).toBeInTheDocument();
    await expect(canvas.getByText('server.log')).toBeInTheDocument();

    // clicking an image chip opens the shared lightbox (portals to the body)
    await userEvent.click(canvas.getByText('canvas-after.png'));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    await waitFor(() =>
      expect(document.body.querySelector('img[alt="canvas-after.png"]')).not.toBeNull()
    );
  },
};

/**
 * Renaming an auto-named screenshot: the pencil turns the chip into an inline input; Enter
 * commits and the chip shows the new name. Discriminating — remove the rename wiring and the
 * chip keeps its `screenshot-<timestamp>.png` name.
 */
export const Rename: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByText('screenshot-2026-07-26-17-41-44.png').closest('.reqore-tag');
    if (!chip) {
      throw new Error('chip not found');
    }
    // click the rename pencil (its own action; the ✕ is a separate reqore-tag-remove)
    const renameAction = chip.querySelector<HTMLElement>('.reqore-tag-action:not(.reqore-tag-remove)');
    if (!renameAction) {
      throw new Error('rename action not rendered');
    }
    await userEvent.click(renameAction);

    // the inline input appears, pre-filled with the current name
    const input = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLInputElement>('input');
      if (!el) {
        throw new Error('rename input not shown');
      }
      return el;
    });
    await userEvent.clear(input);
    await userEvent.type(input, 'mapper-error.png');
    await userEvent.keyboard('{Enter}');

    // the chip now carries the new name; the auto-name is gone
    await waitFor(() => expect(canvas.getByText('mapper-error.png')).toBeInTheDocument());
    await expect(canvas.queryByText('screenshot-2026-07-26-17-41-44.png')).not.toBeInTheDocument();
  },
};
