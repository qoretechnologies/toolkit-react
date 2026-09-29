/**
 * What the A/B test card shows, as plain functions of the qorus-api objects: the version rows,
 * the verdict, the numbers line, the bars, the status tag, which actions a status allows, and
 * the words of the confirm step and of the outcome. No React, no DOM (unit-tested in
 * `__tests__/tracking/card.test.ts`).
 */
import type {
  IAdminVariant,
  IExperimentEntry,
  IExperimentResults,
  TExperimentActionResult,
  TExperimentStatus,
  TLifecycleAction,
  TVersionAction,
} from './types';

export const canAccept = (status: TExperimentStatus) =>
  status === 'running' || status === 'paused' || status === 'stopped';
/** Start a draft, or resume a paused test. */
export const canStart = (status: TExperimentStatus) => status === 'draft' || status === 'paused';
export const canPause = (status: TExperimentStatus) => status === 'running';
export const canStop = (status: TExperimentStatus) => status === 'running' || status === 'paused';
export const canRemove = (status: TExperimentStatus, versions: number) =>
  (status === 'draft' || status === 'running' || status === 'paused') && versions > 1;

export interface IVersionRow {
  key: string;
  name: string;
  control: boolean;
  /** Visitors exposed in the current phase (null: no numbers yet). */
  visitors: number | null;
  /** Conversion on the primary metric, 0..1. */
  conversion: number | null;
  /** Chance to beat the original on the primary metric, 0..1 (null for the original). */
  chance: number | null;
  /** The page's code renders it (false: the server has a version the code does not, so it cannot be shown). */
  inCode: boolean;
}

export const primaryMetric = (results: IExperimentResults | null | undefined) =>
  results?.metrics?.find((m) => m.role === 'primary') ?? null;

export const versionName = (key: string) => `Version ${key.toUpperCase()}`;

/**
 * One row per version. Keys come from the server's experiment when there is one, otherwise from
 * the page's code (`codeVariants`, the `data-variants` of `<Experiment>`): a test that exists
 * only in code can still be switched.
 */
export const versionRows = (
  entry: IExperimentEntry | undefined,
  codeVariants: string[] = []
): IVersionRow[] => {
  const metric = primaryMetric(entry?.results);
  const variants: IAdminVariant[] =
    entry?.experiment.variants?.length ?
      entry.experiment.variants
    : codeVariants.map((key, i) => ({ key, weight: 1, control: i === 0 }));
  return variants.map((v) => {
    const r = metric?.variants.find((x) => x.variant === v.key);
    return {
      key: v.key,
      name: v.name || versionName(v.key),
      control: !!v.control,
      visitors: r ? r.exposed : null,
      conversion: r?.rate ?? null,
      chance: v.control ? null : (r?.chance_to_beat ?? null),
      inCode: codeVariants.length === 0 || codeVariants.includes(v.key),
    };
  });
};

const nameOf = (entry: IExperimentEntry, key: string | null | undefined) =>
  entry.experiment.variants.find((v) => v.key === key)?.name ||
  (key ? versionName(key) : 'a version');

/** The verdict in plain words: the server's sentence when it sends one. */
export const verdictLine = (entry: IExperimentEntry | undefined): string => {
  if (!entry)
    return 'This test is not set up on the server yet: you can switch versions here, but there are no numbers.';
  const { experiment: e, results } = entry;
  if (results?.verdict_text) return results.verdict_text;
  if (e.status === 'concluded')
    return `Finished: ${nameOf(entry, e.winner)} won, and every visitor now sees it.`;
  if (e.status === 'draft')
    return 'Not started yet: press Start test to split visitors between the versions.';
  if (!results) return 'No numbers yet.';
  const control = e.variants.find((v) => v.control)?.key;
  switch (results.verdict) {
    case 'likely-winner':
      return `${nameOf(entry, results.winner_variant)} is likely better than ${nameOf(entry, control)}.`;
    case 'likely-loser':
      return `The new versions are likely worse than ${nameOf(entry, control)}.`;
    case 'no-clear-difference':
      return 'No clear difference between the versions yet.';
    default:
      return 'Too early to tell.';
  }
};

export const percent = (n: number | null | undefined, digits = 1) =>
  n == null || !Number.isFinite(n) ? '–' : `${(n * 100).toFixed(digits).replace(/\.0$/, '')}%`;

export const count = (n: number | null | undefined) =>
  n == null ? '–' : n.toLocaleString('en-US');

/**
 * One line of numbers under a version: visitors, conversion, chance to beat the original. In
 * words when there is nothing to count yet, never a row of dashes.
 */
export const numbersLine = (row: IVersionRow, metricName?: string, status?: TExperimentStatus) => {
  if (!row.visitors) {
    if (status === 'draft') return 'Not started: no visitors yet';
    return row.visitors === 0 ? 'No visitors yet' : 'No numbers yet';
  }
  const parts = [
    `${count(row.visitors)} visitors`,
    `${percent(row.conversion)} ${metricName ? `“${metricName}”` : 'conversion'}`,
  ];
  if (!row.control && row.chance != null)
    parts.push(`${percent(row.chance, 0)} chance to beat the original`);
  return parts.join(' · ');
};

/** Each version's bar: its conversion as a share of the best one (0..100; 0 with no numbers). */
export const barValues = (rows: IVersionRow[]): number[] => {
  const best = Math.max(0, ...rows.map((r) => r.conversion ?? 0));
  return rows.map((r) => (best > 0 && r.conversion ? Math.round((r.conversion / best) * 100) : 0));
};

/** The verdict's colour: green for a likely winner, amber for likely losers, neutral otherwise. */
export const verdictIntent = (
  entry: IExperimentEntry | undefined
): 'success' | 'warning' | 'info' | 'muted' => {
  if (!entry) return 'muted';
  if (entry.experiment.status === 'concluded') return 'success';
  const v = entry.results?.verdict;
  return (
    v === 'likely-winner' ? 'success'
    : v === 'likely-loser' ? 'warning'
    : 'info'
  );
};

export const STATUS_LABEL: Record<TExperimentStatus, string> = {
  draft: 'Draft',
  running: 'Running',
  paused: 'Paused',
  stopped: 'Stopped',
  concluded: 'Ended',
  archived: 'Archived',
};

export type TStatusIntent = 'success' | 'warning' | 'danger' | 'muted';

/** The status tag: its words (with the phase after a removal), its icon and its colour. */
export const statusTag = (
  entry: IExperimentEntry | undefined
): { label: string; icon: string; intent: TStatusIntent } => {
  if (!entry) return { label: 'Not on the server', icon: 'QuestionLine', intent: 'muted' };
  const { status, phase } = entry.experiment;
  const label = `${STATUS_LABEL[status] ?? status}${phase && phase > 1 ? ` · phase ${phase}` : ''}`;
  switch (status) {
    case 'running':
      return { label, icon: 'PlayCircleLine', intent: 'success' };
    case 'paused':
      return { label, icon: 'PauseCircleLine', intent: 'warning' };
    case 'draft':
      return { label, icon: 'PencilRulerLine', intent: 'muted' };
    case 'stopped':
      return { label, icon: 'StopCircleLine', intent: 'danger' };
    default:
      return { label, icon: 'TrophyLine', intent: 'success' };
  }
};

export interface IConfirmCopy {
  title: string;
  description: string;
  confirmLabel: string;
}

/** What the confirm step says before Accept / Remove. */
export const confirmCopy = (
  action: TVersionAction,
  entry: IExperimentEntry,
  variant: string
): IConfirmCopy => {
  const name = nameOf(entry, variant);
  if (action === 'accept') {
    return {
      title: `Make “${name}” the winner?`,
      description: `This ends the test. From then on every visitor sees “${name}”. A developer removes the other versions' code later.`,
      confirmLabel: `Accept ${name}`,
    };
  }
  const rest = entry.experiment.variants.filter((v) => v.key !== variant);
  // The server concludes the test with the last version, a draft included.
  if (rest.length === 1) {
    const last = nameOf(entry, rest[0].key);
    return {
      title: `Remove “${name}”?`,
      description: `Only “${last}” would be left, so it becomes the winner and the test ends. Every visitor then sees “${last}”.`,
      confirmLabel: `Remove and accept ${last}`,
    };
  }
  return {
    title: `Remove “${name}” from the test?`,
    description:
      entry.experiment.status === 'draft' ?
        `The test will start without “${name}”.`
      : `Nobody sees “${name}” any more. The test starts counting again with the remaining versions, so the numbers start from zero.`,
    confirmLabel: `Remove ${name}`,
  };
};

/** What the confirm step says before Start / Pause / Stop. */
export const lifecycleCopy = (action: TLifecycleAction, entry: IExperimentEntry): IConfirmCopy => {
  const e = entry.experiment;
  const name = e.name || e.key;
  const versions = e.variants.map((v) => `“${v.name || v.key}”`).join(' and ');
  switch (action) {
    case 'start':
      return e.status === 'paused' ?
          {
            title: `Resume “${name}”?`,
            description: `Visitors are split between ${versions} again and counted.`,
            confirmLabel: 'Resume the test',
          }
        : {
            title: `Start “${name}”?`,
            description: `From now on, visitors who allow analytics are split between ${versions}, and each version's numbers are counted. You can pause or stop it at any time.`,
            confirmLabel: 'Start the test',
          };
    case 'pause':
      return {
        title: `Pause “${name}”?`,
        description: `Everybody sees the original, “${nameOf(entry, e.variants.find((v) => v.control)?.key)}”, and nothing is counted until you resume it.`,
        confirmLabel: 'Pause the test',
      };
    case 'stop':
    default:
      return {
        title: `Stop “${name}”?`,
        description:
          'The test ends without a winner and cannot be started again; everybody sees the original. To end it with a winner, use Accept instead.',
        confirmLabel: 'Stop the test',
      };
  }
};

/** The notification after Accept / Remove. */
export const actionOutcome = (
  action: TVersionAction,
  result: TExperimentActionResult | null | undefined,
  variant: string
): string => {
  const winner =
    result?.variants?.find((v) => v.key === result.winner)?.name || result?.winner || variant;
  if (action === 'accept' || result?.auto_accepted)
    return `The test has ended: every visitor now sees “${winner}”.`;
  return 'The version is removed; the test goes on with the others.';
};

/**
 * Why the numbers restarted: the current phase began when a version was removed. Null in the
 * first phase. `actorLabels` names who removed it (`{ 'landing-editor': 'in the editor' }`).
 */
export const phaseNote = (
  entry: IExperimentEntry | undefined,
  actorLabels: Record<string, string> = {}
): string | null => {
  const e = entry?.experiment;
  if (!e || !e.phase || e.phase < 2) return null;
  const current = e.phases?.find((p) => p.phase === e.phase);
  const removed = [...(e.history ?? [])].reverse().find((h) => h.action === 'remove-variant');
  const who = removed?.actor && actorLabels[removed.actor] ? ` ${actorLabels[removed.actor]}` : '';
  const since =
    current?.started_at ?
      new Date(current.started_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
    : null;
  const name =
    removed?.variant ?
      e.phases?.flatMap((p) => p.variants).find((v) => v.key === removed.variant)?.name
    : undefined;
  return `Counting since ${since ?? 'the last change'} (phase ${e.phase}): ${name ? `“${name}”` : 'a version'} was removed${who}.`;
};

/** The note on an element whose test has ended. */
export const winnerNote = (entry: IExperimentEntry | undefined, shown: string) =>
  `Winner live: ${entry ? nameOf(entry, entry.experiment.winner ?? shown) : versionName(shown)} · code clean-up pending`;

// ── how many versions fit ───────────────────────────────────────────────────────

/** Versions visible before the list scrolls: three and a half, so the half row says "there is more". */
export const VISIBLE_VERSIONS = 3.5;

/**
 * The versions list's height cap (px): 3.5 rows, or less when the card has less room
 * (`available`, what is left after the header, verdict and footer), never under one row.
 * Null when every row fits (no cap, no scrolling).
 */
export const versionsMaxHeight = ({
  rows,
  rowHeight,
  gap,
  available = Infinity,
}: {
  rows: number;
  rowHeight: number;
  gap: number;
  available?: number;
}): number | null => {
  if (rows <= 0 || rowHeight <= 0) return null;
  const all = rows * rowHeight + (rows - 1) * gap;
  const threeAndHalf = VISIBLE_VERSIONS * rowHeight + Math.floor(VISIBLE_VERSIONS) * gap;
  const cap = Math.max(rowHeight, Math.min(threeAndHalf, available));
  return all <= cap ? null : Math.round(cap);
};
