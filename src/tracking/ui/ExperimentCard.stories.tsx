import { StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, waitFor, within } from 'storybook/test';
import {
  CONCLUDED,
  DRAFT,
  EXPERIMENT_KEY,
  NO_DATA_YET,
  PAUSED,
  RUNNING_FIVE,
  RUNNING_TWO,
  variant,
} from '../../stories/tracking';
import { StoryMeta } from '../../types';
import { ExperimentCard } from './ExperimentCard';

const meta = {
  title: 'Tracking/Experiment Card',
  component: ExperimentCard,
  args: {
    experimentKey: EXPERIMENT_KEY,
    shown: 'a',
    codeVariants: ['a', 'b', 'c', 'd', 'e'],
    detailsUrl: 'https://example.com/analytics?experiment=signup-cta',
    onShow: fn(),
    onAccept: fn(async () => undefined),
    onRemove: fn(async () => undefined),
    onStart: fn(async () => undefined),
    onPause: fn(async () => undefined),
    onStop: fn(async () => undefined),
    onClose: fn(),
  },
  render: (args) => (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <ExperimentCard {...args} />
    </div>
  ),
} as StoryMeta<typeof ExperimentCard>;

export default meta;
export type Story = StoryObj<typeof meta>;

const card = (canvasElement: HTMLElement) => within(canvasElement);
const rowsOf = (canvasElement: HTMLElement) => canvasElement.querySelectorAll('[role="listitem"]');
const footerButton = (canvasElement: HTMLElement, label: string) =>
  Array.from(canvasElement.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);

// ── draft ──────────────────────────────────────────────────────────────────────

const draft: Story = {
  args: { test: DRAFT },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Sign-up button copy')).toBeInTheDocument();
    await expect(c.getByText('Draft')).toBeInTheDocument();
    await expect(c.getByText(/Not started yet/)).toBeInTheDocument();
    await expect(rowsOf(canvasElement)).toHaveLength(2);
    await expect(c.getAllByText('Not started: no visitors yet')).toHaveLength(2);
    await expect(footerButton(canvasElement, 'Start test')).toBeTruthy();
    await expect(footerButton(canvasElement, 'Pause')).toBeFalsy();
  },
};
const DRAFT_TEXT =
  'Renders the card of a draft test with two versions: the "Draft" tag, the "not started" verdict, both rows without numbers, and Start test as the only solid button.';
export const Draft = variant(draft, DRAFT_TEXT, 'Dark');
export const DraftLight = variant(draft, DRAFT_TEXT, 'Light');
export const DraftPhone = variant(draft, DRAFT_TEXT, 'Phone');

// ── running, two versions ────────────────────────────────────────────────────────

const runningTwo: Story = {
  args: { test: RUNNING_TWO },
  play: async ({ canvasElement, args }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Running')).toBeInTheDocument();
    await expect(c.getByText(/91% chance it beats Current button/)).toBeInTheDocument();
    await expect(c.getByText('Shown')).toBeInTheDocument();
    await expect(c.getByText('Original')).toBeInTheDocument();
    await expect(
      c.getByText(/1,228 visitors · 11.3% “Started a sign-up” · 91% chance to beat the original/)
    ).toBeInTheDocument();
    await expect(
      canvasElement.querySelectorAll('.reqore-progress, [role="progressbar"]').length
    ).toBeGreaterThan(0);
    // The whole row of the other version shows it, by click and by keyboard.
    const rowB = canvasElement.querySelector('[data-version="b"] [role="button"]') as HTMLElement;
    await fireEvent.click(rowB);
    await expect(args.onShow).toHaveBeenCalledWith('b');
    await fireEvent.keyDown(rowB, { key: 'Enter' });
    await expect(args.onShow).toHaveBeenCalledTimes(2);
    // The shown version's row is not a button.
    await expect(canvasElement.querySelector('[data-version="a"] [role="button"]')).toBeNull();
    await expect(footerButton(canvasElement, 'Pause')).toBeTruthy();
    await expect(footerButton(canvasElement, 'Stop')).toBeTruthy();
    await expect(footerButton(canvasElement, 'Open in admin portal')).toBeTruthy();
    // ✕ closes.
    await fireEvent.click(c.getByLabelText('Close the test card'));
    await expect(args.onClose).toHaveBeenCalled();
  },
};
const RUNNING_TWO_TEXT =
  'Renders a running test with two versions: the server\'s verdict, visitors, conversion, chance to beat and a bar per version, "Shown" and "Original" tags, minimal Accept and Remove, and minimal Pause and Stop. Clicking the other version\'s row (or Enter on it) shows it; ✕ closes the card.';
export const RunningTwoVersions = variant(runningTwo, RUNNING_TWO_TEXT, 'Dark');
export const RunningTwoVersionsLight = variant(runningTwo, RUNNING_TWO_TEXT, 'Light');
export const RunningTwoVersionsPhone = variant(runningTwo, RUNNING_TWO_TEXT, 'Phone');

// ── running, five versions ───────────────────────────────────────────────────────

const runningFive: Story = {
  args: { test: RUNNING_FIVE },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Pricing page headline')).toBeInTheDocument();
    await expect(c.getByText('5 versions · goal: “Started a sign-up”')).toBeInTheDocument();
    await expect(rowsOf(canvasElement)).toHaveLength(5);
    // Three and a half rows are visible; the rest scroll inside the card.
    const list = canvasElement.querySelector('.reqraft-experiment-versions') as HTMLElement;
    await waitFor(() => expect(list.scrollHeight).toBeGreaterThan(list.clientHeight + 10));
  },
};
const RUNNING_FIVE_TEXT =
  'Renders a running test with five versions: three and a half rows are visible and the list scrolls inside the card for the rest.';
export const RunningFiveVersions = variant(runningFive, RUNNING_FIVE_TEXT, 'Dark');
export const RunningFiveVersionsLight = variant(runningFive, RUNNING_FIVE_TEXT, 'Light');
export const RunningFiveVersionsPhone = variant(runningFive, RUNNING_FIVE_TEXT, 'Phone');

// ── paused ─────────────────────────────────────────────────────────────────────

const paused: Story = {
  args: { test: PAUSED, actorLabels: { admin: 'in the admin portal' } },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Paused · phase 2')).toBeInTheDocument();
    await expect(
      c.getByText('Counting since 20 Sept (phase 2): “Emoji” was removed in the admin portal.')
    ).toBeInTheDocument();
    await expect(footerButton(canvasElement, 'Resume')).toBeTruthy();
    await expect(footerButton(canvasElement, 'Stop')).toBeTruthy();
    await expect(footerButton(canvasElement, 'Pause')).toBeFalsy();
  },
};
const PAUSED_TEXT =
  'Renders a paused test in its second phase: the "Paused · phase 2" tag, a note saying since when it counts and which version was removed, and Resume (solid) and Stop in the footer.';
export const Paused = variant(paused, PAUSED_TEXT, 'Dark');
export const PausedLight = variant(paused, PAUSED_TEXT, 'Light');
export const PausedPhone = variant(paused, PAUSED_TEXT, 'Phone');

// ── concluded ──────────────────────────────────────────────────────────────────

const concluded: Story = {
  args: { test: CONCLUDED, shown: 'b' },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Ended')).toBeInTheDocument();
    await expect(c.getByText(/Short copy is likely better/)).toBeInTheDocument();
    // Nothing more to do with an ended test but read it.
    await expect(footerButton(canvasElement, 'Start test')).toBeFalsy();
    await expect(footerButton(canvasElement, 'Stop')).toBeFalsy();
    const accept = Array.from(canvasElement.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Accept')
    );
    accept.forEach((b) => expect(b).toBeDisabled());
  },
};
const CONCLUDED_TEXT =
  'Renders an ended test whose winner (Short copy) is live: the "Ended" tag, the final verdict, the winner marked "Shown", and no lifecycle buttons; Accept and Remove are disabled.';
export const Concluded = variant(concluded, CONCLUDED_TEXT, 'Dark');
export const ConcludedLight = variant(concluded, CONCLUDED_TEXT, 'Light');
export const ConcludedPhone = variant(concluded, CONCLUDED_TEXT, 'Phone');

// ── no data yet ────────────────────────────────────────────────────────────────

const noData: Story = {
  args: { test: NO_DATA_YET },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Too early to tell.')).toBeInTheDocument();
    await expect(c.getAllByText('No visitors yet')).toHaveLength(2);
    await expect(canvasElement.querySelector('[role="progressbar"]')).toBeNull();
  },
};
const NO_DATA_TEXT =
  'Renders a running test nobody has seen yet: "Too early to tell", and "No visitors yet" on each version instead of numbers and bars.';
export const NoDataYet = variant(noData, NO_DATA_TEXT, 'Dark');
export const NoDataYetLight = variant(noData, NO_DATA_TEXT, 'Light');
export const NoDataYetPhone = variant(noData, NO_DATA_TEXT, 'Phone');

// ── not on the server ────────────────────────────────────────────────────────────

const notOnServer: Story = {
  args: { test: undefined, codeVariants: ['a', 'b'], name: 'signup-cta' },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Not on the server')).toBeInTheDocument();
    await expect(c.getByText(/not set up on the server yet/)).toBeInTheDocument();
    await expect(c.getByText('Version A')).toBeInTheDocument();
    await expect(
      c.getByText('Start, Accept and Remove appear once the test is set up on the server.')
    ).toBeInTheDocument();
    await expect(
      Array.from(canvasElement.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Accept')
      )
    ).toBe(false);
  },
};
const NOT_ON_SERVER_TEXT =
  'Renders a test that exists only in the page\'s code: the "Not on the server" tag, its versions from the code (switchable, without numbers), and no Accept, Remove or lifecycle buttons.';
export const NotOnServer = variant(notOnServer, NOT_ON_SERVER_TEXT, 'Dark');
export const NotOnServerLight = variant(notOnServer, NOT_ON_SERVER_TEXT, 'Light');
export const NotOnServerPhone = variant(notOnServer, NOT_ON_SERVER_TEXT, 'Phone');

// ── the confirm step on Remove ───────────────────────────────────────────────────

const removeConfirm: Story = {
  args: { test: RUNNING_FIVE },
  play: async ({ canvasElement, args }) => {
    await card(canvasElement).findByText('Pricing page headline');
    const row = canvasElement.querySelector('[data-version="c"]') as HTMLElement;
    const remove = Array.from(row.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Remove')
    )!;
    await fireEvent.click(remove);
    const body = within(canvasElement.ownerDocument.body);
    await expect(
      await body.findByText('Remove “Customer quote” from the test?')
    ).toBeInTheDocument();
    await expect(body.getByText(/numbers start from zero/)).toBeInTheDocument();
    // Nothing happens until it is confirmed.
    await expect(args.onRemove).not.toHaveBeenCalled();
  },
};
const REMOVE_TEXT =
  'Renders a running five-version test after Remove was clicked on "Customer quote": the confirm step asks first and says the numbers restart; nothing is removed until it is confirmed.';
export const RemoveConfirmStep = variant(removeConfirm, REMOVE_TEXT, 'Dark');
export const RemoveConfirmStepLight = variant(removeConfirm, REMOVE_TEXT, 'Light');
export const RemoveConfirmStepPhone = variant(removeConfirm, REMOVE_TEXT, 'Phone');
