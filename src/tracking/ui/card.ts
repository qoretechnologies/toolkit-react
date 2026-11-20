/**
 * What the A/B test card shows, as plain functions of the qorus-api objects: the version rows,
 * the verdict, the numbers line, the bars, the status tag, which actions a status allows, and
 * the words of the confirm step and of the outcome. No React, no DOM (unit-tested in
 * `__tests__/tracking/card.test.ts`). The words are the host's (`reqraftLabels().abTest`), read
 * each time a function runs.
 */
import { reqraftLabels } from '../../helpers/reqraftLabels';
import { DEFAULT_AB_TEST_LABELS } from './labels';
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

export const versionName = (key: string) => reqraftLabels().abTest.versionName(key.toUpperCase());

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
  (key ? versionName(key) : reqraftLabels().abTest.someVersion);

/** @deprecated The English of `abTest.notSetUp`; what is drawn is in the host's words (`setReqraftLabels`). */
export const NOT_SET_UP_TEXT = DEFAULT_AB_TEST_LABELS.notSetUp;
/** @deprecated The English of `abTest.unreachable`; what is drawn is in the host's words. */
export const UNREACHABLE_TEXT = DEFAULT_AB_TEST_LABELS.unreachable;
/** @deprecated The English of `abTest.statuses`; what is drawn is in the host's words. */
export const STATUS_LABEL: Record<TExperimentStatus, string> = DEFAULT_AB_TEST_LABELS.statuses;

/**
 * The verdict in plain words: the server's sentence when it sends one. Without a server entry:
 * `unreachable` (the list could not be loaded) or not set up yet (`notSetUpText`, else the
 * host's words).
 */
export const verdictLine = (
  entry: IExperimentEntry | undefined,
  { unreachable = false, notSetUpText }: { unreachable?: boolean; notSetUpText?: string } = {}
): string => {
  const words = reqraftLabels().abTest;
  if (!entry) return unreachable ? words.unreachable : (notSetUpText ?? words.notSetUp);
  const { experiment: e, results } = entry;
  if (results?.verdict_text) return results.verdict_text;
  if (e.status === 'concluded') return words.verdictConcluded(nameOf(entry, e.winner));
  if (e.status === 'draft') return words.verdictDraft;
  if (!results) return words.verdictNoNumbers;
  const control = e.variants.find((v) => v.control)?.key;
  switch (results.verdict) {
    case 'likely-winner':
      return words.verdictLikelyWinner(
        nameOf(entry, results.winner_variant),
        nameOf(entry, control)
      );
    case 'likely-loser':
      return words.verdictLikelyLoser(nameOf(entry, control));
    case 'no-clear-difference':
      return words.verdictNoClearDifference;
    default:
      return words.verdictTooEarly;
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
  const words = reqraftLabels().abTest;
  if (!row.visitors) {
    if (status === 'draft') return words.numbersNotStarted;
    return row.visitors === 0 ? words.numbersNoVisitors : words.numbersNone;
  }
  const parts = [
    words.visitorCount(row.visitors, count(row.visitors)),
    words.conversion(percent(row.conversion), metricName || null),
  ];
  if (!row.control && row.chance != null) parts.push(words.chanceToBeat(percent(row.chance, 0)));
  return parts.join(' · ');
};

/** Each version's bar: its conversion as a share of the best one (0..100; 0 with no numbers). */
export const barValues = (rows: IVersionRow[]): number[] => {
  const best = Math.max(0, ...rows.map((r) => r.conversion ?? 0));
  return rows.map((r) => (best > 0 && r.conversion ? Math.round((r.conversion / best) * 100) : 0));
};

/** The verdict's color: green for a likely winner, amber for likely losers, neutral otherwise. */
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

export type TStatusIntent = 'success' | 'warning' | 'danger' | 'muted';

/** The status tag: its words (with the phase after a removal), its icon and its color. */
export const statusTag = (
  entry: IExperimentEntry | undefined,
  unreachable = false
): { label: string; icon: string; intent: TStatusIntent } => {
  const words = reqraftLabels().abTest;
  if (!entry) {
    return unreachable ?
        { label: words.statusNoConnection, icon: 'WifiOffLine', intent: 'warning' }
      : { label: words.statusNotSetUp, icon: 'QuestionLine', intent: 'muted' };
  }
  const { status, phase } = entry.experiment;
  const named = words.statuses[status] ?? status;
  const label = phase && phase > 1 ? words.statusInPhase(named, phase) : named;
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
  const words = reqraftLabels().abTest;
  const name = nameOf(entry, variant);
  if (action === 'accept') {
    return {
      title: words.acceptTitle(name),
      description: words.acceptDescription(name),
      confirmLabel: words.acceptConfirm(name),
    };
  }
  const rest = entry.experiment.variants.filter((v) => v.key !== variant);
  // The server concludes the test with the last version, a draft included.
  if (rest.length === 1) {
    const last = nameOf(entry, rest[0].key);
    return {
      title: words.removeLastTitle(name),
      description: words.removeLastDescription(last),
      confirmLabel: words.removeLastConfirm(last),
    };
  }
  return {
    title: words.removeTitle(name),
    description:
      entry.experiment.status === 'draft' ?
        words.removeDraftDescription(name)
      : words.removeDescription(name),
    confirmLabel: words.removeConfirm(name),
  };
};

/** What the confirm step says before Start / Pause / Stop. */
export const lifecycleCopy = (action: TLifecycleAction, entry: IExperimentEntry): IConfirmCopy => {
  const words = reqraftLabels().abTest;
  const e = entry.experiment;
  const name = e.name || e.key;
  const versions = words.versionList(e.variants.map((v) => v.name || v.key));
  switch (action) {
    case 'start':
      return e.status === 'paused' ?
          {
            title: words.resumeTitle(name),
            description: words.resumeDescription(versions),
            confirmLabel: words.resumeConfirm,
          }
        : {
            title: words.startTitle(name),
            description: words.startDescription(versions),
            confirmLabel: words.startConfirm,
          };
    case 'pause':
      return {
        title: words.pauseTitle(name),
        description: words.pauseDescription(nameOf(entry, e.variants.find((v) => v.control)?.key)),
        confirmLabel: words.pauseConfirm,
      };
    case 'stop':
    default:
      return {
        title: words.stopTitle(name),
        description: words.stopDescription,
        confirmLabel: words.stopConfirm,
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
  const words = reqraftLabels().abTest;
  if (action === 'accept' || result?.auto_accepted) return words.outcomeEnded(winner);
  return words.outcomeRemoved;
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
  const who = removed?.actor && actorLabels[removed.actor] ? actorLabels[removed.actor] : null;
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
  return reqraftLabels().abTest.phaseNote({ since, phase: e.phase, name: name || null, who });
};

/** The note on an element whose test has ended. */
export const winnerNote = (entry: IExperimentEntry | undefined, shown: string) =>
  reqraftLabels().abTest.winnerLive(
    entry ? nameOf(entry, entry.experiment.winner ?? shown) : versionName(shown)
  );

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

// ── order and the leader ─────────────────────────────────────────────────────────

/**
 * Best first: conversion on the primary metric, then visitors; versions without numbers keep
 * their order at the end. Stable: equal versions keep the server's order.
 */
export const sortVersionRows = (rows: IVersionRow[]): IVersionRow[] =>
  rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ca = a.row.visitors ? (a.row.conversion ?? -1) : -1;
      const cb = b.row.visitors ? (b.row.conversion ?? -1) : -1;
      if (cb !== ca) return cb - ca;
      const va = a.row.visitors ?? -1;
      const vb = b.row.visitors ?? -1;
      if (vb !== va) return vb - va;
      return a.index - b.index;
    })
    .map(({ row }) => row);

/**
 * The version to highlight: the winner when the test ended with one or the verdict is a likely
 * winner, otherwise the one converting best so far ("Leading"). Null while nothing is counted,
 * or when the best conversion is shared.
 */
export const leadingVersion = (
  entry: IExperimentEntry | undefined,
  rows: IVersionRow[]
): { key: string; kind: 'winner' | 'leading' } | null => {
  const e = entry?.experiment;
  if (e?.status === 'concluded' && e.winner) return { key: e.winner, kind: 'winner' };
  if (entry?.results?.verdict === 'likely-winner' && entry.results.winner_variant) {
    return { key: entry.results.winner_variant, kind: 'winner' };
  }
  const counted = rows.filter((r) => r.visitors && r.conversion != null && r.conversion > 0);
  if (!counted.length) return null;
  const best = Math.max(...counted.map((r) => r.conversion as number));
  const top = counted.filter((r) => r.conversion === best);
  return top.length === 1 ? { key: top[0].key, kind: 'leading' } : null;
};

// ── the help ─────────────────────────────────────────────────────────────────────

export const DEFAULT_MIN_SAMPLE = { per_variant: 200, days: 7 };

export interface IHelpSection {
  title: string;
  paragraphs: string[];
}

/** What the card's "?" explains, in plain words for a marketer. */
export const helpSections = (
  entry: IExperimentEntry | undefined,
  analyticsLabel?: string
): IHelpSection[] => {
  const words = reqraftLabels().abTest;
  const place = analyticsLabel ?? words.analyticsPlace;
  const min = entry?.experiment.min_sample ?? DEFAULT_MIN_SAMPLE;
  const traffic = entry?.experiment.traffic;
  return [
    { title: words.helpWhatTitle, paragraphs: [words.helpWhat, words.helpOriginal] },
    {
      title: words.helpButtonsTitle,
      paragraphs: [
        words.helpShow,
        words.helpAnalytics(place),
        words.helpAccept,
        words.helpRemove,
        words.helpLifecycle,
        words.helpConfirm,
      ],
    },
    {
      title: words.helpSplitTitle,
      paragraphs: [
        words.helpSplit(traffic != null && traffic < 1 ? Math.round(traffic * 100) : null),
        words.helpCounted,
      ],
    },
    {
      title: words.helpNumbersTitle,
      paragraphs: [words.helpNumbers, words.helpChance, words.helpVerdict],
    },
    {
      title: words.helpTrustTitle,
      paragraphs: [
        words.helpTooEarly(min.per_variant, min.days),
        words.helpUntrusted,
        words.helpPhase,
      ],
    },
    { title: words.helpNotSetUpTitle, paragraphs: [words.helpNotSetUp, words.helpUnreachable] },
    { title: words.helpFullTitle, paragraphs: [words.helpFull(place)] },
  ];
};
