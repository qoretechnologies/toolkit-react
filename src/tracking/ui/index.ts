/**
 * The A/B test UI: `<ExperimentCard>` (one test, driven by props), `<ExperimentsOverlay>` (every
 * `<Experiment>` on the page outlined, with its card anchored to it), and the optional
 * `useExperimentsAdmin` / `createExperimentsAdminClient` for the qorus-api routes. Built on Reqore;
 * the engine (`../index`) does not import this layer. How to embed it: design/TRACKING.md, §8.
 */
export { ExperimentCard } from './ExperimentCard';
export type { IExperimentCardProps } from './ExperimentCard';
export { boxOf, ExperimentsOverlay, OVERLAY_ATTRIBUTE } from './ExperimentsOverlay';
export type { IExperimentsOverlayProps } from './ExperimentsOverlay';
export { useExperimentsAdmin } from './useExperimentsAdmin';
export type { IUseExperimentsAdmin, IUseExperimentsAdminOptions } from './useExperimentsAdmin';
export { createExperimentsAdminClient, ExperimentsAdminError } from './client';
export type {
  IExperimentsAdminClient,
  IExperimentsAdminOptions,
  TExperimentsFetch,
} from './client';
export {
  activatesRow,
  CARD_MAX_WIDTH,
  CARD_MIN_HEIGHT,
  cardReducer,
  CLOSED,
  openCard,
  OUTSIDE_IGNORE,
  placeCard,
} from './anchor';
export type { IBox, ICardState, IPlaceInput, IPlacement, TCardEvent } from './anchor';
export {
  actionOutcome,
  barValues,
  canAccept,
  canPause,
  canRemove,
  canStart,
  canStop,
  confirmCopy,
  count,
  lifecycleCopy,
  numbersLine,
  percent,
  phaseNote,
  primaryMetric,
  STATUS_LABEL,
  statusTag,
  verdictIntent,
  verdictLine,
  versionName,
  versionRows,
  versionsMaxHeight,
  VISIBLE_VERSIONS,
  winnerNote,
} from './card';
export type { IConfirmCopy, IVersionRow, TStatusIntent } from './card';
export type {
  IAdminExperiment,
  IAdminExperimentEvent,
  IAdminExperimentPhase,
  IAdminVariant,
  IExperimentEntry,
  IExperimentResults,
  INewExperiment,
  IResultsMetric,
  IResultsVariant,
  TExperimentAction,
  TExperimentActionResult,
  TExperimentStatus,
  TLifecycleAction,
  TVersionAction,
} from './types';
