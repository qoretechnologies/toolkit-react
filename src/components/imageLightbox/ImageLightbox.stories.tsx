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
