import { StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useEffect, useState } from 'react';
import { StoryMeta } from '../../types';
import { IImageLightboxImage, ImageLightbox } from './ImageLightbox';

/**
 * The shared full-image viewer, on `ReqoreModal`. Opened by the ticket thread (an image
 * on a message) and the References tab (the screenshot grid) alike. Pages across a set,
 * click-to-zoom, download; the shell/backdrop/Esc are the modal's.
 */
const meta = {
  component: ImageLightbox,
  title: 'Components/ImageLightbox',
} as StoryMeta<typeof ImageLightbox>;
export default meta;
type Story = StoryObj<typeof meta>;

const shot = (label: string, hue: number): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>` +
      `<rect width='640' height='400' fill='hsl(${hue},38%,16%)'/>` +
      `<text x='24' y='210' fill='white' font-family='sans-serif' font-size='28' opacity='0.7'>${label}</text>` +
      `</svg>`
  )}`;

const IMAGES: IImageLightboxImage[] = [
  { attachment_id: 'i1', filename: 'canvas-error.png' },
  { attachment_id: 'i2', filename: 'console.png' },
  { attachment_id: 'i3', filename: 'network.png' },
];

/** Open on a set of three, so the paging chrome (`1 / 3`, prev/next) shows. */
export const Paging: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Renders the lightbox open on a set of three images, so the paging chrome ('1 / 3', prev/next) shows, and arrow keys page through the set.",
      },
    },
  },
  render: function Render() {
    const [index, setIndex] = useState<number | null>(0);
    if (index === null) {
      return <div>closed</div>;
    }
    return (
      <ImageLightbox
        images={IMAGES}
        index={index}
        onIndex={setIndex}
        onClose={() => setIndex(null)}
        fetchAttachmentUrl={async (id) => shot(id, id === 'i1' ? 265 : id === 'i2' ? 205 : 150)}
        onDownload={fn()}
      />
    );
  },
  async play() {
    // the modal portals to the body, so query document-wide
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
    const dialog = within(document.body);
    await expect(await dialog.findByText('canvas-error.png')).toBeInTheDocument();
    await expect(dialog.getByText('1 / 3')).toBeInTheDocument();
    // page forward via the keyboard (the action buttons are icon-only)
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(dialog.getByText('2 / 3')).toBeInTheDocument());
  },
};

/**
 * Regression guard for the "screenshot preview stuck loading" bug.
 *
 * Consumers pass `fetchAttachmentUrl` as an inline arrow — a new identity every render —
 * and re-render for reasons unrelated to the lightbox. Here the parent ticks on a timer
 * (handing a fresh fetcher each render) while the fetch is deliberately slow, so those
 * re-renders land WHILE the image is still loading. When the fetch effect depended on
 * `fetchAttachmentUrl`, each re-render tore down the in-flight fetch and the `requested`
 * guard blocked a retry — the spinner hung forever. The image resolving proves the effect
 * now depends on `id` alone. Removing that fix makes this story time out.
 */
export const ResolvesDespiteParentReRenders: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the lightbox while the parent re-renders on a timer with a deliberately slow fetch — a regression guard proving the image still resolves instead of the spinner hanging forever.',
      },
    },
  },
  render: function Render() {
    const [index, setIndex] = useState<number | null>(0);
    const [, setTick] = useState(0);
    useEffect(() => {
      const timer = setInterval(() => setTick((n) => n + 1), 30);
      return () => clearInterval(timer);
    }, []);
    if (index === null) {
      return <div>closed</div>;
    }
    return (
      <ImageLightbox
        images={[IMAGES[0]]}
        index={index}
        onIndex={setIndex}
        onClose={() => setIndex(null)}
        // a brand-new arrow every render, and a slow fetch so the re-renders overlap it
        fetchAttachmentUrl={async (id) => {
          await new Promise((resolve) => setTimeout(resolve, 120));
          return shot(id, 265);
        }}
        onDownload={fn()}
      />
    );
  },
  async play() {
    await expect(await within(document.body).findByText('canvas-error.png')).toBeInTheDocument();
    // the image resolves and paints — it never would while the spinner was hung
    await waitFor(
      () => expect(document.body.querySelector('img[alt="canvas-error.png"]')).not.toBeNull(),
      { timeout: 3000 }
    );
  },
};

/**
 * Renaming from inside the preview. The pencil (only offered when `onRename` is wired)
 * swaps in an input row; Enter commits through the host, which owns the actual rename —
 * here the harness updates its image list, so the modal header shows the new name.
 * Esc cancels the edit WITHOUT closing the modal. Discriminating: remove the
 * `onRename` plumbing and the pencil never renders / the title never changes.
 */
export const Renamable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders the lightbox with onRename wired — the header pencil opens an inline input; Enter commits the new name through the host and Esc cancels without closing the modal.',
      },
    },
  },
  render: function Render() {
    const [index, setIndex] = useState<number | null>(0);
    const [images, setImages] = useState<IImageLightboxImage[]>([IMAGES[0]]);
    if (index === null) {
      return <div>closed</div>;
    }
    return (
      <ImageLightbox
        images={images}
        index={index}
        onIndex={setIndex}
        onClose={() => setIndex(null)}
        fetchAttachmentUrl={async (id) => shot(id, 265)}
        onRename={(id, name) =>
          setImages((current) =>
            current.map((img) => (img.attachment_id === id ? { ...img, filename: name } : img))
          )
        }
      />
    );
  },
  async play() {
    const dialog = within(document.body);
    await expect(await dialog.findByText('canvas-error.png')).toBeInTheDocument();

    const pencil = await waitFor(() => {
      const el = document.body.querySelector<HTMLButtonElement>('.imagelightbox-rename');
      if (!el) {
        throw new Error('rename action not rendered');
      }
      return el;
    });
    await userEvent.click(pencil);

    // Esc cancels the edit but keeps the modal open
    const input = await waitFor(() => {
      const el = document.body.querySelector<HTMLInputElement>('.reqore-modal input');
      if (!el) {
        throw new Error('rename input not shown');
      }
      return el;
    });
    await expect(input).toHaveValue('canvas-error.png'); // pre-filled with the current name
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(document.body.querySelector('.reqore-modal input')).toBeNull()
    );
    await expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // now rename for real: pencil → clear → type → Enter → header carries the new name
    await userEvent.click(document.body.querySelector<HTMLButtonElement>('.imagelightbox-rename')!);
    const input2 = await waitFor(() => {
      const el = document.body.querySelector<HTMLInputElement>('.reqore-modal input');
      if (!el) {
        throw new Error('rename input not shown (second open)');
      }
      return el;
    });
    await userEvent.clear(input2);
    await userEvent.type(input2, 'mapper-crash.png');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(dialog.getByText('mapper-crash.png')).toBeInTheDocument());
    await expect(dialog.queryByText('canvas-error.png')).not.toBeInTheDocument();
  },
};

/** A single image: no paging chrome. */
export const Single: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Renders the lightbox on a single image, so no paging chrome appears.',
      },
    },
  },
  render: function Render() {
    const [index, setIndex] = useState<number | null>(0);
    if (index === null) {
      return <div>closed</div>;
    }
    return (
      <ImageLightbox
        images={[IMAGES[0]]}
        index={index}
        onIndex={setIndex}
        onClose={() => setIndex(null)}
        fetchAttachmentUrl={async (id) => shot(id, 265)}
        onDownload={fn()}
      />
    );
  },
  async play() {
    const dialog = within(document.body);
    await expect(await dialog.findByText('canvas-error.png')).toBeInTheDocument();
    await expect(dialog.queryByText('1 / 1')).not.toBeInTheDocument();
  },
};
