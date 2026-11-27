// Copyright 2026 Qore Technologies, s.r.o.
import type { TExperimentAction, TExperimentStatus, TLifecycleAction } from './types';

/** What the notification after an action says happened: each action, and Start on a paused test (`resume`). */
export type TAbTestActionDone = TExperimentAction | 'resume';

/**
 * The words of the A/B test card and overlay. A host that translates its interface gives its own (`setReqraftLabels`); the rest stay English.
 * A test's or a version's name is given as it is written; the quotes around it are part of the word. A number is given
 * as it is shown (`1,228`, `11.3%`), with the count itself where the word says one or many.
 */
export interface IAbTestLabels {
  /** The status tag, by the test's status. */
  statuses: Record<TExperimentStatus, string>;
  /** The status tag after a version was removed: `status` is the test's status in words, `phase` the count running now (2 or more). */
  statusInPhase: (status: string, phase: number) => string;
  /** The status tag of a test that is in the page's code but not set up in the analytics service. */
  statusNotSetUp: string;
  /** The status tag when the analytics service cannot be reached. */
  statusNoConnection: string;
  /** The "?" action's tooltip and name, and the heading of the help it opens. */
  help: string;
  /** The ✕'s tooltip. */
  closeTooltip: string;
  /** The ✕'s name, for a screen reader. */
  close: string;

  /** The verdict of a test that is in the page's code but not set up in the analytics service (a card's `notSetUpText` comes first). */
  notSetUp: string;
  /** The verdict when the analytics service cannot be reached. */
  unreachable: string;
  /** The verdict of an ended test; `winner` is the winning version's name. */
  verdictConcluded: (winner: string) => string;
  /** The verdict of a test not started yet. */
  verdictDraft: string;
  /** The verdict of a started test the server has no numbers for. */
  verdictNoNumbers: string;
  verdictLikelyWinner: (winner: string, original: string) => string;
  verdictLikelyLoser: (original: string) => string;
  verdictNoClearDifference: string;
  verdictTooEarly: string;
  /**
   * Why the numbers started again: a version was removed. `since` is the day the count started (null when not known),
   * `name` the removed version (null when not known), `who` where it was removed, in a host's `actorLabels` words.
   */
  phaseNote: (note: {
    since: string | null;
    phase: number;
    name: string | null;
    who: string | null;
  }) => string;
  /** The line above the versions: how many there are, and the goal they are compared on (null without one). */
  versionsLine: (count: number, goal: string | null) => string;
  /** The versions list's name, for a screen reader. */
  versions: string;

  /** A version the server gives no name, by its key in capitals (`A`). */
  versionName: (key: string) => string;
  /** Said in place of a version's name when there is none to say. */
  someVersion: string;
  /** A version's numbers line in a test not started yet. */
  numbersNotStarted: string;
  /** A version's numbers line when nobody has seen it yet. */
  numbersNoVisitors: string;
  /** A version's numbers line when there are no numbers. */
  numbersNone: string;
  /** The visitors in a version's numbers line; `shown` is `count` as it is written. */
  visitorCount: (count: number, shown: string) => string;
  /** The conversion in a version's numbers line; `goal` is the goal's name (null without one). */
  conversion: (rate: string, goal: string | null) => string;
  /** The chance to beat the original in a version's numbers line. */
  chanceToBeat: (chance: string) => string;
  /** A version's bar, for a screen reader. */
  barLabel: (name: string) => string;
  /** The tag of the winning version. */
  winner: string;
  /** The tag of the version converting best so far. */
  leading: string;
  /** The tag of the version the page showed before the test. */
  original: string;
  /** The tag of a version the server has but the page's code does not render. */
  notInCode: string;
  /** A version's row, for a screen reader: a click shows that version on this page. */
  showVersion: (name: string) => string;
  showVersionTooltip: (name: string) => string;
  /** The row action that opens one version's analytics. */
  showAnalytics: string;
  /** That action's name, for a screen reader. */
  showAnalyticsFor: (name: string) => string;
  showAnalyticsTooltip: (name: string) => string;
  accept: string;
  acceptTooltip: (name: string) => string;
  /** Accept's tooltip while the test cannot be accepted. */
  acceptUnavailable: string;
  /** The remove action (a bin icon), for a screen reader. */
  removeVersion: (name: string) => string;
  removeTooltip: (name: string) => string;
  /** Remove's tooltip while the version cannot be removed. */
  removeUnavailable: string;

  /** The footer's link to the test's analytics (a card's `detailsLabel` comes first). */
  detailsLink: string;
  detailsTooltip: string;
  startTest: string;
  startTooltip: string;
  /** Start on a paused test. */
  resume: string;
  resumeTooltip: string;
  pause: string;
  pauseTooltip: string;
  stop: string;
  stopTooltip: string;
  /** Under the versions of a test that is not set up: where its controls are. */
  controlsNotSetUp: string;
  /** Under the versions when the analytics service cannot be reached. */
  controlsUnreachable: string;

  /** The confirm step before Accept. */
  acceptTitle: (name: string) => string;
  acceptDescription: (name: string) => string;
  acceptConfirm: (name: string) => string;
  /** The confirm step before removing one of the last two versions: `last` is the one that would be left, and win. */
  removeLastTitle: (name: string) => string;
  removeLastDescription: (last: string) => string;
  removeLastConfirm: (last: string) => string;
  /** The confirm step before removing a version when two or more stay. */
  removeTitle: (name: string) => string;
  removeDescription: (name: string) => string;
  /** The same, for a test not started yet. */
  removeDraftDescription: (name: string) => string;
  removeConfirm: (name: string) => string;
  /** The test's versions, named in a sentence (`“Short copy” and “Long copy”`). */
  versionList: (names: string[]) => string;
  /** The confirm step before Start; `versions` is `versionList`'s words. */
  startTitle: (name: string) => string;
  startDescription: (versions: string) => string;
  startConfirm: string;
  /** The confirm step before Start on a paused test. */
  resumeTitle: (name: string) => string;
  resumeDescription: (versions: string) => string;
  resumeConfirm: string;
  /** The confirm step before Pause; `original` is the original version's name. */
  pauseTitle: (name: string) => string;
  pauseDescription: (original: string) => string;
  pauseConfirm: string;
  /** The confirm step before Stop. */
  stopTitle: (name: string) => string;
  stopDescription: string;
  stopConfirm: string;

  /** The notification's heading after an action. */
  done: Record<TAbTestActionDone, string>;
  /** The notification's heading when an action failed (the server's words follow). */
  failed: Record<TExperimentAction, string>;
  /** After an accept, or a removal that left one version: `winner` is its name. */
  outcomeEnded: (winner: string) => string;
  /** After a removal, while the test goes on. */
  outcomeRemoved: string;
  /** After Start, Pause or Stop, by the action; `name` is the test's. */
  outcomeLifecycle: Record<TLifecycleAction, (name: string) => string>;

  /** The overlay's handle on a tested element (an overlay's `handleLabel` comes first). */
  handle: (name: string) => string;
  handleTooltip: string;
  /** The overlay's note on an element whose test has ended; `name` is the winning version's. */
  winnerLive: (name: string) => string;
  winnerLiveTooltip: string;

  /** Where the full analytics are, in the help's sentences (a card's `analyticsLabel` comes first). */
  analyticsPlace: string;
  helpWhatTitle: string;
  helpWhat: string;
  helpOriginal: string;
  helpButtonsTitle: string;
  helpShow: string;
  /** `place` is where the full analytics are (`analyticsPlace`). */
  helpAnalytics: (place: string) => string;
  helpAccept: string;
  helpRemove: string;
  helpLifecycle: string;
  helpConfirm: string;
  helpSplitTitle: string;
  /** How visitors are split; `percent` is the share in the test (null when it is every visitor). */
  helpSplit: (percent: number | null) => string;
  helpCounted: string;
  helpNumbersTitle: string;
  helpNumbers: string;
  helpChance: string;
  helpVerdict: string;
  helpTrustTitle: string;
  /** The too-early rule: the visitors every version needs, and the days that must pass. */
  helpTooEarly: (visitors: number, days: number) => string;
  helpUntrusted: string;
  helpPhase: string;
  helpNotSetUpTitle: string;
  helpNotSetUp: string;
  helpUnreachable: string;
  helpFullTitle: string;
  /** `place` is where the full analytics are (`analyticsPlace`). */
  helpFull: (place: string) => string;

  /** An action's error when the server refuses who asks (the key is missing or wrong). */
  notAllowed: string;
  /** An action's error when the server says nothing more than its answer's status. */
  requestFailed: (status: number) => string;
}

const many = (count: number, one: string, other: string) => (count === 1 ? one : other);

/** The English words, the ones a host gets when it gives none. */
export const DEFAULT_AB_TEST_LABELS: IAbTestLabels = {
  statuses: {
    draft: 'Draft',
    running: 'Running',
    paused: 'Paused',
    stopped: 'Stopped',
    concluded: 'Ended',
    archived: 'Archived',
  },
  statusInPhase: (status, phase) => `${status} · phase ${phase}`,
  statusNotSetUp: 'Not set up',
  statusNoConnection: 'No connection',
  help: 'How A/B tests work',
  closeTooltip: 'Close (Esc)',
  close: 'Close the test card',

  notSetUp:
    "This test is in the page's code but isn't set up yet: ask the Designer to set it up. Until then you can switch versions here, but nothing is counted.",
  unreachable:
    "Can't reach the analytics service right now, so there are no numbers and no test controls. You can still switch versions here; try again in a minute.",
  verdictConcluded: (winner) => `Finished: ${winner} won, and every visitor now sees it.`,
  verdictDraft: 'Not started yet: press Start test to split visitors between the versions.',
  verdictNoNumbers: 'No numbers yet.',
  verdictLikelyWinner: (winner, original) => `${winner} is likely better than ${original}.`,
  verdictLikelyLoser: (original) => `The new versions are likely worse than ${original}.`,
  verdictNoClearDifference: 'No clear difference between the versions yet.',
  verdictTooEarly: 'Too early to tell.',
  phaseNote: ({ since, phase, name, who }) =>
    `Counting since ${since ?? 'the last change'} (phase ${phase}): ${name ? `“${name}”` : 'a version'} was removed${who ? ` ${who}` : ''}.`,
  versionsLine: (count, goal) =>
    `${count} ${many(count, 'version', 'versions')}${goal ? ` · goal: “${goal}”` : ''}`,
  versions: 'Versions',

  versionName: (key) => `Version ${key}`,
  someVersion: 'a version',
  numbersNotStarted: 'Not started: no visitors yet',
  numbersNoVisitors: 'No visitors yet',
  numbersNone: 'No numbers yet',
  visitorCount: (count, shown) => `${shown} ${many(count, 'visitor', 'visitors')}`,
  conversion: (rate, goal) => `${rate} ${goal ? `“${goal}”` : 'conversion'}`,
  chanceToBeat: (chance) => `${chance} chance to beat the original`,
  barLabel: (name) => `${name}: conversion compared with the best version`,
  winner: 'Winner',
  leading: 'Leading',
  original: 'Original',
  notInCode: 'Not in the code',
  showVersion: (name) => `Show “${name}” on this page`,
  showVersionTooltip: (name) => `Show “${name}” on this page (only here, never counted)`,
  showAnalytics: 'Show analytics',
  showAnalyticsFor: (name) => `Show analytics for ${name}`,
  showAnalyticsTooltip: (name) => `Show analytics for “${name}” (a new tab)`,
  accept: 'Accept',
  acceptTooltip: (name) => `End the test: every visitor sees “${name}”`,
  acceptUnavailable: 'Only a started test can be accepted',
  removeVersion: (name) => `Remove version ${name}`,
  removeTooltip: (name) => `Remove version: drop “${name}” from the test`,
  removeUnavailable: 'This version cannot be removed now',

  detailsLink: 'Open in admin portal',
  detailsTooltip: 'This test’s details (a new tab)',
  startTest: 'Start test',
  startTooltip: 'Start splitting visitors between the versions and counting',
  resume: 'Resume',
  resumeTooltip: 'Split visitors between the versions again',
  pause: 'Pause',
  pauseTooltip: 'Everybody sees the original until you resume',
  stop: 'Stop',
  stopTooltip: 'End the test without a winner',
  controlsNotSetUp: 'Start, Accept and Remove appear once the test is set up.',
  controlsUnreachable: 'Start, Accept and Remove come back once the analytics service answers.',

  acceptTitle: (name) => `Make “${name}” the winner?`,
  acceptDescription: (name) =>
    `This ends the test. From then on every visitor sees “${name}”. A developer removes the other versions' code later.`,
  acceptConfirm: (name) => `Accept ${name}`,
  removeLastTitle: (name) => `Remove “${name}”?`,
  removeLastDescription: (last) =>
    `Only “${last}” would be left, so it becomes the winner and the test ends. Every visitor then sees “${last}”.`,
  removeLastConfirm: (last) => `Remove and accept ${last}`,
  removeTitle: (name) => `Remove “${name}” from the test?`,
  removeDescription: (name) =>
    `Nobody sees “${name}” any more. The test starts counting again with the remaining versions, so the numbers start from zero.`,
  removeDraftDescription: (name) => `The test will start without “${name}”.`,
  removeConfirm: (name) => `Remove ${name}`,
  versionList: (names) => names.map((name) => `“${name}”`).join(' and '),
  startTitle: (name) => `Start “${name}”?`,
  startDescription: (versions) =>
    `From now on, visitors who allow analytics are split between ${versions}, and each version's numbers are counted. You can pause or stop it at any time.`,
  startConfirm: 'Start the test',
  resumeTitle: (name) => `Resume “${name}”?`,
  resumeDescription: (versions) => `Visitors are split between ${versions} again and counted.`,
  resumeConfirm: 'Resume the test',
  pauseTitle: (name) => `Pause “${name}”?`,
  pauseDescription: (original) =>
    `Everybody sees the original, “${original}”, and nothing is counted until you resume it.`,
  pauseConfirm: 'Pause the test',
  stopTitle: (name) => `Stop “${name}”?`,
  stopDescription:
    'The test ends without a winner and cannot be started again; everybody sees the original. To end it with a winner, use Accept instead.',
  stopConfirm: 'Stop the test',

  done: {
    accept: 'Winner accepted',
    remove: 'Version removed',
    start: 'Test started',
    resume: 'Test resumed',
    pause: 'Test paused',
    stop: 'Test stopped',
  },
  failed: {
    accept: 'Could not accept',
    remove: 'Could not remove',
    start: 'Could not start',
    pause: 'Could not pause',
    stop: 'Could not stop',
  },
  outcomeEnded: (winner) => `The test has ended: every visitor now sees “${winner}”.`,
  outcomeRemoved: 'The version is removed; the test goes on with the others.',
  outcomeLifecycle: {
    start: (name) => `“${name}” is running.`,
    pause: (name) => `“${name}” is paused.`,
    stop: (name) => `“${name}” is stopped.`,
  },

  handle: (name) => `A/B test · ${name}`,
  handleTooltip: 'A/B test: see its versions and numbers',
  winnerLive: (name) => `Winner live: ${name} · code clean-up pending`,
  winnerLiveTooltip:
    'Every visitor sees this version. A developer removes the other versions’ code later.',

  analyticsPlace: 'the admin portal',
  helpWhatTitle: 'What this is',
  helpWhat:
    'An A/B test shows different versions of this part of the page to different visitors and counts which version gets more of them to do what you want (the goal, for example starting a sign-up).',
  helpOriginal:
    'The "Original" is what the page showed before the test. The others are the new versions being tried.',
  helpButtonsTitle: 'The buttons',
  helpShow:
    'Click a version (or press Enter on it) to see it on this page. Only you see it, only in this browser, and it is never counted.',
  helpAnalytics: (place) =>
    `Show analytics (the chart icon) opens that version's numbers in ${place}; the link in the footer opens the whole test.`,
  helpAccept:
    "Accept ends the test with that version as the winner: from then on every visitor sees it, and a developer removes the other versions' code later.",
  helpRemove:
    'Remove (the bin icon) drops a version from the test. The counting starts again with the remaining versions, so their numbers restart from zero. When only one version would be left, it becomes the winner.',
  helpLifecycle:
    'Start test begins splitting visitors and counting. Pause shows everyone the original and stops counting until you Resume. Stop ends the test without a winner, for good.',
  helpConfirm: 'Every one of these asks you to confirm first.',
  helpSplitTitle: 'How visitors are split and counted',
  helpSplit: (percent) =>
    `While the test runs, ${percent == null ? 'every visitor who allows analytics' : `${percent}% of the visitors who allow analytics`} is put into one version at random and keeps seeing that same version on every visit. Visitors who decline analytics always see the original and are not counted.`,
  helpCounted:
    'A visitor is counted for a version once they have actually seen this part of the page. A conversion is counted when that visitor later reaches the goal.',
  helpNumbersTitle: 'Reading the numbers',
  helpNumbers:
    'Each version shows its visitors, its conversion (the share of its visitors who reached the goal) and a bar comparing it with the best version. The versions are sorted best first; "Leading" marks the one converting best so far.',
  helpChance:
    '"Chance to beat the original" is how likely that version really converts better than the original, given the numbers so far. 50% means we cannot tell them apart; 95% or more is a likely winner, marked "Winner"; 5% or less means it is likely worse.',
  helpVerdict:
    'The line at the top is the verdict in plain words: too early, a likely winner, likely worse, or no clear difference.',
  helpTrustTitle: 'When you can trust the result',
  helpTooEarly: (visitors, days) =>
    `Early numbers jump around. The verdict stays "too early" until every version has at least ${visitors} ${many(visitors, 'visitor', 'visitors')} and ${days} ${many(days, 'day has', 'days have')} passed since the test started; only then is a winner named.`,
  helpUntrusted:
    'If visitors are not split between the versions as set up, the verdict says the numbers cannot be trusted: that points to a tracking problem, not to a better version.',
  helpPhase:
    'Removing a version starts a new count (a new phase), so only the numbers since then are shown.',
  helpNotSetUpTitle: 'Not set up yet?',
  helpNotSetUp:
    "A test can exist in the page's code before anyone registers it in the analytics service. Until it is set up (ask the Designer), you can switch its versions here, but nothing is counted and there are no numbers or controls.",
  helpUnreachable:
    'When the analytics service cannot be reached, the card says so; the page itself works as usual and every visitor sees the original.',
  helpFullTitle: 'The full analytics',
  helpFull: (place) =>
    `Every test and every version has its own page in ${place}: the numbers over time, the other goals, and how the test changed.`,

  notAllowed: 'Not allowed to manage A/B tests on this server (the API key is missing or wrong).',
  requestFailed: (status) => `HTTP ${status}`,
};
