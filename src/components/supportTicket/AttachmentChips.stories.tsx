import { StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { AttachmentChips } from './AttachmentChips';

/**
 * Staged files for a ticket composer. An image is a small thumbnail card with its name, and opens the
 * shared `ImageLightbox` on click; other files are chips with a paperclip. The pencil renames a file inline
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
const pdfFile = (name: string): File => new File(['%PDF-1.4'], name, { type: 'application/pdf' });

const FILES = [
  imageFile('before', 265, 'screenshot-2026-07-26-17-41-44.png'),
  imageFile('after', 205, 'canvas-after.png'),
  textFile('server.log'),
];

/** The staged file's tag by its whole name: an image card's name is cut in the middle, in two parts. */
const tagNamed = (root: HTMLElement, name: string): HTMLElement | null =>
  Array.from(root.querySelectorAll<HTMLElement>('.reqore-tag')).find(
    (tag) => tag.querySelector('.reqore-tag-content')?.textContent === name
  ) ?? null;
/** Where a click on the staged file's name lands. */
const nameOf = (root: HTMLElement, name: string): HTMLElement => {
  const tag = tagNamed(root, name);
  if (!tag) {
    throw new Error(`no staged file named ${name}`);
  }
  return tag.querySelector<HTMLElement>('.reqore-tag-content')!;
};

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
  parameters: {
    docs: {
      description: {
        story:
          'Renders two staged screenshots as thumbnail cards and a log as a chip, where clicking a screenshot opens the shared lightbox while the log stays a plain chip.',
      },
    },
  },
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    await expect(tagNamed(canvasElement, 'screenshot-2026-07-26-17-41-44.png')).toBeTruthy();
    await expect(tagNamed(canvasElement, 'server.log')).toBeTruthy();

    // clicking an image chip opens the shared lightbox (portals to the body)
    await userEvent.click(nameOf(canvasElement, 'canvas-after.png'));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    await waitFor(() =>
      expect(document.body.querySelector('img[alt="canvas-after.png"]')).not.toBeNull()
    );
  },
};

/**
 * Renaming from INSIDE the preview: open a chip's lightbox, use its pencil, and the new
 * name lands on the chip too — the lightbox funnels into the same host `onRename` as the
 * chip pencil, so both affordances stay one mechanism.
 */
export const RenameFromPreview: Story = {
  parameters: {
    // Interaction-only: the play assertions are the guard, and the end state
    // is already pictured by `Rename`.
    qlip: { skip: true },
    docs: {
      description: {
        story:
          'Renders the staged chips and renames a screenshot from inside its lightbox — the preview’s pencil commits the new name, and the chip outside carries it too.',
      },
    },
  },
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    await userEvent.click(nameOf(canvasElement, 'canvas-after.png'));
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

    const pencil = await waitFor(() => {
      const el = document.body.querySelector<HTMLButtonElement>('.imagelightbox-rename');
      if (!el) {
        throw new Error('lightbox rename action not rendered');
      }
      return el;
    });
    await userEvent.click(pencil);
    const input = await waitFor(() => {
      const el = document.body.querySelector<HTMLInputElement>('.reqore-modal input');
      if (!el) {
        throw new Error('lightbox rename input not shown');
      }
      return el;
    });
    await userEvent.clear(input);
    await userEvent.type(input, 'after-fix.png');
    await userEvent.keyboard('{Enter}');

    // commit ends the edit; a second Esc now closes the modal itself
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());

    // the rename reached the host: the CHIP carries the new name
    await waitFor(() => expect(tagNamed(canvasElement, 'after-fix.png')).toBeTruthy());
    await expect(tagNamed(canvasElement, 'canvas-after.png')).toBeNull();
  },
};

/**
 * Renaming an auto-named screenshot: the pencil turns the chip into an inline input; Enter
 * commits and the chip shows the new name. Discriminating — remove the rename wiring and the
 * chip keeps its `screenshot-<timestamp>.png` name.
 */
export const Rename: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the staged chips and renames an auto-named screenshot inline — the pencil opens an input, Enter commits, and the chip shows the new name.',
      },
    },
  },
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const chip = tagNamed(canvasElement, 'screenshot-2026-07-26-17-41-44.png');
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
    await waitFor(() => expect(tagNamed(canvasElement, 'mapper-error.png')).toBeTruthy());
    await expect(tagNamed(canvasElement, 'screenshot-2026-07-26-17-41-44.png')).toBeNull();
  },
};

export const AnImageIsAThumbnailCard: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A staged screenshot and a PDF: the image is a small card with its picture and its name under it, so it reads as the screenshot it is; the PDF stays a chip with a paperclip.',
      },
    },
  },
  args: {
    files: [
      imageFile('mapper error', 205, 'mapper-error-in-order-sync.png'),
      pdfFile('order-sync-runbook.pdf'),
    ],
    onRemove: () => undefined,
    onRename: () => undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>('.attachment-image-card');
      expect(element, 'the image is a card').toBeTruthy();
      return element!;
    });
    // the picture is a thumbnail, not a tiny icon
    const picture = await waitFor(() => {
      const element = card.querySelector<HTMLImageElement>('img[alt="mapper-error-in-order-sync.png"]');
      expect(element, 'the card shows the picture').toBeTruthy();
      return element!;
    });
    await expect(picture.getBoundingClientRect().height, 'a thumbnail, not an icon').toBeGreaterThan(60);
    // its name is under the picture
    const name = card.querySelector<HTMLElement>('.reqore-tag-label')!;
    await expect(name.textContent).toBe('mapper-error-in-order-sync.png');
    await expect(name.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      picture.getBoundingClientRect().bottom - 1
    );
    // a long name keeps one line, cut in the middle, so its extension stays
    const tag = name.closest<HTMLElement>('.reqore-tag')!;
    await expect(tag.getBoundingClientRect().height, 'the name keeps one line').toBeLessThan(32);
    // the PDF stays a chip, outside any card
    const pdf = canvas.getByText('order-sync-runbook.pdf');
    await expect(pdf.closest('.attachment-image-card'), 'a PDF is not a card').toBeNull();
    await expect(pdf.closest('.reqore-tag')).toBeTruthy();
  },
};
