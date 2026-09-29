import { ReqoreP, ReqorePanel } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import { EXPERIMENT_KEY, RUNNING_TWO, variant } from '../../stories/tracking';
import { StoryMeta } from '../../types';
import { KEYS } from '../core/types';
import { Experiment } from '../react/Experiment';
import { TrackingProvider } from '../react/TrackingProvider';
import { createMemoryTracker } from '../testing';
import { ExperimentsOverlay, type IExperimentsOverlayProps } from './ExperimentsOverlay';

const CLOCK = Date.UTC(2026, 8, 29, 10, 0, 0);

/** A page with one tested element; `atBottom` puts it at the foot of the window. */
const Page = ({ atBottom, ...overlay }: IExperimentsOverlayProps & { atBottom?: boolean }) => {
  const [memory] = useState(() =>
    createMemoryTracker({
      consent: 'granted',
      vid: 'visitor-3',
      seed: {
        [KEYS.experimentsCache]: JSON.stringify({
          at: CLOCK,
          property: 'test',
          experiments: [{ ...RUNNING_TWO.experiment, traffic: 1 }],
        }),
      },
    })
  );
  return (
    <TrackingProvider tracker={memory.tracker} location='/'>
      {atBottom && <div style={{ height: 'calc(100vh - 200px)' }} />}
      <div style={{ maxWidth: 720 }}>
        <Experiment
          id={EXPERIMENT_KEY}
          variants={{
            a: (
              <ReqorePanel label='Get started' flat padded>
                <ReqoreP>Version A: the current sign-up button copy.</ReqoreP>
              </ReqorePanel>
            ),
            b: (
              <ReqorePanel label='Try it free' flat padded>
                <ReqoreP>Version B: the short copy.</ReqoreP>
              </ReqorePanel>
            ),
          }}
        />
      </div>
      <ExperimentsOverlay {...overlay} />
    </TrackingProvider>
  );
};

const meta = {
  title: 'Tracking/Experiments Overlay',
  component: Page,
  args: {
    tests: [RUNNING_TWO],
    onAccept: fn(async () => undefined),
    onRemove: fn(async () => undefined),
    onStart: fn(async () => undefined),
    onPause: fn(async () => undefined),
    onStop: fn(async () => undefined),
    onSettled: fn(async () => undefined),
    detailsUrl: (key: string) => `https://example.com/analytics?experiment=${key}`,
  },
} as StoryMeta<typeof Page>;

export default meta;
export type Story = StoryObj<typeof meta>;

const handleOf = async (doc: Document) =>
  within(doc.body).findByText(`A/B test · ${RUNNING_TWO.experiment.name}`);
const cardFloat = (doc: Document) =>
  doc.querySelector('[data-experiment-float][data-side]') as HTMLElement | null;

// ── anchored below ───────────────────────────────────────────────────────────────

const anchored: Story = {
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await expect(doc.querySelector(`[data-experiment-outline="${EXPERIMENT_KEY}"]`)).toBeTruthy();
    // Esc closes the card, a click on the handle opens it again.
    await fireEvent.click((await handleOf(doc)).closest('button')!);
    await waitFor(() => expect(cardFloat(doc)).toBeTruthy());
    await fireEvent.keyDown(doc, { key: 'Escape' });
    await waitFor(() => expect(cardFloat(doc)).toBeNull());
    // A click outside closes it too.
    await fireEvent.click((await handleOf(doc)).closest('button')!);
    await waitFor(() => expect(cardFloat(doc)).toBeTruthy());
    await fireEvent.pointerDown(canvasElement);
    await waitFor(() => expect(cardFloat(doc)).toBeNull());
    await fireEvent.click((await handleOf(doc)).closest('button')!);
    await waitFor(() => expect(cardFloat(doc)?.dataset.side).toBe('below'));
    // The card hangs under the handle, over the tested element.
    const handle = (await handleOf(doc))
      .closest('[data-experiment-float]')!
      .getBoundingClientRect();
    await expect(cardFloat(doc)!.getBoundingClientRect().top).toBeGreaterThan(handle.bottom);
    await expect(within(cardFloat(doc)!).getByText('Short copy')).toBeInTheDocument();
  },
};
const ANCHORED_TEXT =
  'Renders a page with one tested element: a dashed outline and an "A/B test · Sign-up button copy" handle at its corner. Clicking the handle opens the test\'s card anchored below it; Esc and a click outside close it, and the handle reopens it.';
export const Anchored = variant(anchored, ANCHORED_TEXT, 'Dark');
export const AnchoredLight = variant(anchored, ANCHORED_TEXT, 'Light');
export const AnchoredPhone = variant(anchored, ANCHORED_TEXT, 'Phone');

// ── flipped above near the bottom ────────────────────────────────────────────────

const flipped: Story = {
  args: { atBottom: true },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await fireEvent.click((await handleOf(doc)).closest('button')!);
    await waitFor(() => expect(cardFloat(doc)?.dataset.side).toBe('above'));
    const handle = (await handleOf(doc))
      .closest('[data-experiment-float]')!
      .getBoundingClientRect();
    // Once measured, the card ends just above the handle.
    await waitFor(() => expect(cardFloat(doc)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(handle.top));
  },
};
const FLIPPED_TEXT =
  'Renders the tested element at the foot of the window with its card open: there is no room below, so the card flips above the handle.';
export const FlipsAboveNearTheBottom = variant(flipped, FLIPPED_TEXT, 'Dark');
export const FlipsAboveNearTheBottomLight = variant(flipped, FLIPPED_TEXT, 'Light');
export const FlipsAboveNearTheBottomPhone = variant(flipped, FLIPPED_TEXT, 'Phone');

// ── hidden ─────────────────────────────────────────────────────────

const hidden: Story = {
  args: { visible: false },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    await expect(
      await within(canvasElement).findByText('Version B: the short copy.')
    ).toBeInTheDocument();
    await expect(doc.querySelector('[data-experiment-outline]')).toBeNull();
    await expect(within(doc.body).queryByText(/A\/B test ·/)).toBeNull();
  },
};
const HIDDEN_TEXT =
  'Renders the same page with the overlay hidden (`visible={false}`, an editor\'s "hide editor elements"): the tested element shows as visitors see it, with no outline, handle or card.';
export const Hidden = variant(hidden, HIDDEN_TEXT, 'Dark');
export const HiddenLight = variant(hidden, HIDDEN_TEXT, 'Light');
export const HiddenPhone = variant(hidden, HIDDEN_TEXT, 'Phone');
