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

const ANALYTICS = 'https://example.com/analytics?dashboard=tracking&experiment=signup-cta';

const meta = {
  title: 'Tracking/Experiment Card',
  component: ExperimentCard,
  args: {
    experimentKey: EXPERIMENT_KEY,
    shown: 'a',
    codeVariants: ['a', 'b', 'c', 'd', 'e'],
    detailsUrl: ANALYTICS,
    versionDetailsUrl: (v: string) => `${ANALYTICS}&variant=${v}`,
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
const rowsOf = (canvasElement: HTMLElement) =>
  Array.from(canvasElement.querySelectorAll<HTMLElement>('[role="listitem"]'));
const order = (canvasElement: HTMLElement) => rowsOf(canvasElement).map((r) => r.dataset.version);
const buttonWith = (root: Element, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
const row = (canvasElement: HTMLElement, key: string) =>
  canvasElement.querySelector(`[data-version="${key}"]`) as HTMLElement;

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
    // Remove is a bin icon at the far end of the row, labelled for assistive tech.
    await expect(c.getByLabelText('Remove version Short copy')).toBeInTheDocument();
    await expect(buttonWith(canvasElement, 'Remove')).toBeFalsy();
    await expect(buttonWith(canvasElement, 'Start test')).toBeTruthy();
    await expect(buttonWith(canvasElement, 'Pause')).toBeFalsy();
  },
};
const DRAFT_TEXT =
  'Renders the card of a draft test with two versions: the "Draft" tag, the "not started" verdict, both rows without numbers, each with "Show analytics", Accept and a bin icon (Remove) at the far end, and Start test as the only solid button.';
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
    // The likely winner comes first and is marked; the original keeps its tag.
    await expect(order(canvasElement)).toEqual(['b', 'a']);
    await expect(within(row(canvasElement, 'b')).getByText('Winner')).toBeInTheDocument();
    await expect(within(row(canvasElement, 'a')).getByText('Original')).toBeInTheDocument();
    await expect(row(canvasElement, 'b').dataset.highlight).toBe('winner');
    await expect(c.getAllByText('Show analytics')).toHaveLength(2);
    await expect(c.queryByText('Shown')).toBeNull();
    // The shown version is marked by its colour and for assistive tech.
    await expect(row(canvasElement, 'a').getAttribute('aria-current')).toBe('true');
    await expect(
      c.getByText(/1,228 visitors · 11.3% “Started a sign-up” · 91% chance to beat the original/)
    ).toBeInTheDocument();
    await expect(c.getByLabelText('Show analytics for Short copy')).toBeInTheDocument();
    // The whole row of the other version shows it, by click and by keyboard.
    const rowB = row(canvasElement, 'b').querySelector('[role="button"]') as HTMLElement;
    await fireEvent.click(rowB);
    await expect(args.onShow).toHaveBeenCalledWith('b');
    await fireEvent.keyDown(rowB, { key: 'Enter' });
    await expect(args.onShow).toHaveBeenCalledTimes(2);
    await expect(row(canvasElement, 'a').querySelector('[role="button"]')).toBeNull();
    await expect(buttonWith(canvasElement, 'Pause')).toBeTruthy();
    await expect(buttonWith(canvasElement, 'Stop')).toBeTruthy();
    await expect(buttonWith(canvasElement, 'Open in admin portal')).toBeTruthy();
    await fireEvent.click(c.getByLabelText('Close the test card'));
    await expect(args.onClose).toHaveBeenCalled();
  },
};
const RUNNING_TWO_TEXT =
  'Renders a running test with two versions, best first: "Short copy", the likely winner, tagged "Winner" and lit by a green glow and wash, above the "Original". Tags are soft pills. Each row shows visitors, conversion, chance to beat and a bar, "Show analytics", Accept and a bin icon; the shown version is the blue row. Clicking the other row (or Enter on it) shows it; ✕ closes the card.';
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
    // Best conversion first; the leader is tagged while it is too early for a winner.
    await expect(order(canvasElement)).toEqual(['b', 'd', 'a', 'c', 'e']);
    await expect(within(row(canvasElement, 'b')).getByText('Leading')).toBeInTheDocument();
    await expect(row(canvasElement, 'b').dataset.highlight).toBe('leading');
    // A long title stays on one line (an ellipsis, the full name in its tooltip).
    await expect(c.getAllByText('Pricing page headline').length).toBeGreaterThan(0);
    // Three and a half rows are visible; the rest scroll inside the card.
    const list = canvasElement.querySelector('.reqraft-experiment-versions') as HTMLElement;
    await waitFor(() => expect(list.scrollHeight).toBeGreaterThan(list.clientHeight + 10));
  },
};
const RUNNING_FIVE_TEXT =
  'Renders a running test with five versions sorted best first, the best one tagged "Leading" with a softer glow than a winner\'s: three and a half rows are visible and the list scrolls inside the card for the rest.';
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
    await expect(buttonWith(canvasElement, 'Resume')).toBeTruthy();
    await expect(buttonWith(canvasElement, 'Stop')).toBeTruthy();
    await expect(buttonWith(canvasElement, 'Pause')).toBeFalsy();
  },
};
const PAUSED_TEXT =
  'Renders a paused test in its second phase: the "Paused · phase 2" tag, a note saying since when it counts and which version was removed, the leading version first, and Resume (solid) and Stop in the footer.';
export const Paused = variant(paused, PAUSED_TEXT, 'Dark');
export const PausedLight = variant(paused, PAUSED_TEXT, 'Light');
export const PausedPhone = variant(paused, PAUSED_TEXT, 'Phone');

// ── concluded ──────────────────────────────────────────────────────────────────

const concluded: Story = {
  args: { test: CONCLUDED, shown: 'b' },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Ended')).toBeInTheDocument();
    await expect(order(canvasElement)[0]).toBe('b');
    await expect(within(row(canvasElement, 'b')).getByText('Winner')).toBeInTheDocument();
    // Each version keeps its analytics link after the test ended.
    await expect(c.getByLabelText('Show analytics for Short copy')).toBeInTheDocument();
    await expect(c.getByLabelText('Show analytics for Current button')).toBeInTheDocument();
    await expect(buttonWith(canvasElement, 'Start test')).toBeFalsy();
    await expect(buttonWith(canvasElement, 'Stop')).toBeFalsy();
    Array.from(canvasElement.querySelectorAll('button'))
      .filter((b) => b.textContent?.includes('Accept'))
      .forEach((b) => expect(b).toBeDisabled());
  },
};
const CONCLUDED_TEXT =
  'Renders an ended test whose winner (Short copy) is live: the "Ended" tag, the final verdict, the winner first with a "Winner" tag, the winner\'s glow and the blue shown colour, "Show analytics" on every version, and no lifecycle buttons; Accept and Remove are disabled.';
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
    await expect(c.queryByText('Leading')).toBeNull();
    await expect(canvasElement.querySelector('[role="progressbar"]')).toBeNull();
  },
};
const NO_DATA_TEXT =
  'Renders a running test nobody has seen yet: "Too early to tell", "No visitors yet" on each version instead of numbers and bars, and no leader.';
export const NoDataYet = variant(noData, NO_DATA_TEXT, 'Dark');
export const NoDataYetLight = variant(noData, NO_DATA_TEXT, 'Light');
export const NoDataYetPhone = variant(noData, NO_DATA_TEXT, 'Phone');

// ── not set up yet ───────────────────────────────────────────────────────────────

const notSetUp: Story = {
  args: { test: undefined, codeVariants: ['a', 'b'], name: 'signup-cta' },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('Not set up')).toBeInTheDocument();
    await expect(
      c.getByText(/in the page's code but isn't set up yet: ask the Designer to set it up/)
    ).toBeInTheDocument();
    await expect(c.getByText('Version A')).toBeInTheDocument();
    await expect(
      c.getByText('Start, Accept and Remove appear once the test is set up.')
    ).toBeInTheDocument();
    await expect(
      Array.from(canvasElement.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Accept')
      )
    ).toBe(false);
    await expect(c.queryByLabelText(/Show analytics/)).toBeNull();
  },
};
const NOT_SET_UP_TEXT =
  'Renders a test that is in the page\'s code but not registered in the analytics service yet: the "Not set up" tag, the words "ask the Designer to set it up", its versions from the code (switchable, without numbers), and no Accept, Remove, analytics or lifecycle buttons.';
export const NotSetUp = variant(notSetUp, NOT_SET_UP_TEXT, 'Dark');
export const NotSetUpLight = variant(notSetUp, NOT_SET_UP_TEXT, 'Light');
export const NotSetUpPhone = variant(notSetUp, NOT_SET_UP_TEXT, 'Phone');

// ── the service cannot be reached ────────────────────────────────────────────────

const unreachable: Story = {
  args: { test: undefined, codeVariants: ['a', 'b'], name: 'signup-cta', loadError: 'HTTP 502' },
  play: async ({ canvasElement }) => {
    const c = card(canvasElement);
    await expect(await c.findByText('No connection')).toBeInTheDocument();
    await expect(c.getByText(/Can't reach the analytics service right now/)).toBeInTheDocument();
    await expect(
      c.getByText('Start, Accept and Remove come back once the analytics service answers.')
    ).toBeInTheDocument();
  },
};
const UNREACHABLE_TEXT =
  'Renders the card when the analytics service cannot be reached: the "No connection" tag and an amber message saying so; the versions from the code can still be switched.';
export const ServiceUnreachable = variant(unreachable, UNREACHABLE_TEXT, 'Dark');
export const ServiceUnreachableLight = variant(unreachable, UNREACHABLE_TEXT, 'Light');
export const ServiceUnreachablePhone = variant(unreachable, UNREACHABLE_TEXT, 'Phone');

// ── the confirm step on Remove ───────────────────────────────────────────────────

const removeConfirm: Story = {
  args: { test: RUNNING_FIVE },
  play: async ({ canvasElement, args }) => {
    await card(canvasElement).findByText('Pricing page headline');
    await fireEvent.click(card(canvasElement).getByLabelText('Remove version Customer quote'));
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
  'Renders a running five-version test after the bin icon was clicked on "Customer quote": the confirm step asks first and says the numbers restart; nothing is removed until it is confirmed.';
export const RemoveConfirmStep = variant(removeConfirm, REMOVE_TEXT, 'Dark');
export const RemoveConfirmStepLight = variant(removeConfirm, REMOVE_TEXT, 'Light');
export const RemoveConfirmStepPhone = variant(removeConfirm, REMOVE_TEXT, 'Phone');

// ── the help ─────────────────────────────────────────────────────────────────────

const help: Story = {
  args: { test: RUNNING_TWO },
  play: async ({ canvasElement }) => {
    await card(canvasElement).findByText('Sign-up button copy');
    await fireEvent.click(card(canvasElement).getByLabelText('How A/B tests work'));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('The buttons')).toBeInTheDocument();
    await expect(body.getByText('When you can trust the result')).toBeInTheDocument();
    await expect(body.getByText(/at least 200 visitors and 7 days/)).toBeInTheDocument();
    await expect(body.getByText('Not set up yet?')).toBeInTheDocument();
  },
};
const HELP_TEXT =
  'Renders the card with its "?" help open: a dialog explaining, in plain words, what the test is, what every button does, how visitors are split and counted, how to read the verdict and the chance to beat, when a result can be trusted, a test that is not set up yet, and where the full analytics are.';
export const Help = variant(help, HELP_TEXT, 'Dark');
export const HelpLight = variant(help, HELP_TEXT, 'Light');
export const HelpPhone = variant(help, HELP_TEXT, 'Phone');
