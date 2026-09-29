import { ReqoreControlGroup, ReqoreP, ReqorePanel, ReqoreTag, ReqoreTagGroup } from '@qoretechnologies/reqore';
import { StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, within } from 'storybook/test';
import { StoryMeta } from '../../types';
import { KEYS, type IExperimentDefinition } from '../core/types';
import { createMemoryTracker, type IMemoryTrackerOptions } from '../testing';
import { Experiment } from './Experiment';
import { useExperiment } from './hooks';
import { TrackingProvider } from './TrackingProvider';

const KEY = 'signup-cta';

const RUNNING: IExperimentDefinition = {
  key: KEY,
  status: 'running',
  variants: [
    { key: 'a', weight: 0.5, control: true },
    { key: 'b', weight: 0.5 },
  ],
  traffic: 1,
  trigger: null,
};

/** `createMemoryTracker`'s clock starts here; the cached definitions are fresh for it. */
const CLOCK = Date.UTC(2026, 8, 29, 10, 0, 0);

/**
 * The definitions as the tracker caches them after a fetch, so the first render already
 * has them (a real app gets the same from its cache on every visit after the first).
 */
const cached = (experiments: IExperimentDefinition[]) => ({
  [KEYS.experimentsCache]: JSON.stringify({ at: CLOCK, property: 'test', experiments }),
});

/** A visitor id whose GrowthBook hash for `signup-cta` lands in version B at 50/50. */
const VISITOR_IN_B = 'visitor-3';

const Version = ({ letter, label }: { letter: string; label: string }) => (
  <ReqorePanel label={`Version ${letter}`} flat>
    <ReqoreP>{label}</ReqoreP>
  </ReqorePanel>
);

const VARIANTS = {
  a: <Version letter='A' label='The control: what every visitor sees without the experiment.' />,
  b: <Version letter='B' label='The challenger: shown only to visitors assigned to it.' />,
};

/** Shows why this visitor sees what they see (the same assignment `<Experiment>` uses). */
const Reason = () => {
  const { variant, assignment } = useExperiment(KEY, { variants: ['a', 'b'] });
  return (
    <ReqoreTagGroup>
      <ReqoreTag labelKey='Shown' label={variant.toUpperCase()} />
      <ReqoreTag labelKey='Reason' label={assignment.reason} />
      <ReqoreTag labelKey='Counts for the test' label={assignment.enrolled ? 'yes' : 'no'} />
    </ReqoreTagGroup>
  );
};

const Demo = ({ tracking }: { tracking?: IMemoryTrackerOptions }) => {
  const [memory] = useState(() => (tracking ? createMemoryTracker(tracking) : null));
  return (
    <TrackingProvider tracker={memory?.tracker ?? null} location='/'>
      <ReqoreControlGroup vertical fluid>
        <Reason />
        <Experiment id={KEY} variants={VARIANTS} />
      </ReqoreControlGroup>
    </TrackingProvider>
  );
};

const meta = {
  title: 'Tracking/Experiment',
  component: Demo,
} as StoryMeta<typeof Demo>;

export default meta;
export type Story = StoryObj<typeof meta>;

const expectShown = async (canvasElement: HTMLElement, variant: string, reason: string) => {
  const canvas = within(canvasElement);
  await expect(await canvas.findByText(`Version ${variant.toUpperCase()}`)).toBeInTheDocument();
  const wrapper = canvasElement.querySelector(`[data-experiment="${KEY}"]`) as HTMLElement;
  await expect(wrapper.dataset.variant).toBe(variant);
  await expect(wrapper.dataset.experimentReason).toBe(reason);
  await expect(canvas.getByText(reason)).toBeInTheDocument();
};

export const ControlWithoutTracker: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders an experiment with no tracker behind it (as before the visitor answered the consent prompt). Shows version A, the control, with the reason `no-consent`.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expectShown(canvasElement, 'a', 'no-consent');
  },
};

export const AssignedVariant: Story = {
  args: {
    tracking: { consent: 'granted', vid: VISITOR_IN_B, seed: cached([RUNNING]) },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a running 50/50 experiment for a visitor who allowed tracking and whose id hashes into version B. Shows version B, reason `assigned`, counted for the test.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expectShown(canvasElement, 'b', 'assigned');
    await expect(within(canvasElement).getByText('yes')).toBeInTheDocument();
  },
};

export const NotEnrolled: Story = {
  args: {
    tracking: { consent: 'granted', vid: VISITOR_IN_B, seed: cached([{ ...RUNNING, traffic: 0 }]) },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders a running experiment with a traffic share of 0 for a visitor who allowed tracking. Shows version A, reason `not-enrolled`, not counted for the test.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expectShown(canvasElement, 'a', 'not-enrolled');
  },
};

export const PreviewLink: Story = {
  args: {
    tracking: { page: { search: `?qa_variant=${KEY}:b` }, seed: cached([RUNNING]) },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders the experiment opened through a `?qa_variant=signup-cta:b` preview link, without consent. Shows version B with the reason `preview`, never counted.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expectShown(canvasElement, 'b', 'preview');
  },
};

export const ConcludedWinner: Story = {
  args: {
    tracking: {
      seed: cached([{ key: KEY, status: 'concluded', winner: 'b' } as IExperimentDefinition]),
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          'Renders an experiment that ended with version B as the winner, for a visitor who never answered the consent prompt. Shows version B to everybody, reason `concluded`.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await expectShown(canvasElement, 'b', 'concluded');
  },
};
