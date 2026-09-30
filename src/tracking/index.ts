/**
 * First-party tracking, consent and A/B testing for any Qore web app.
 *
 * How to use it: design/TRACKING.md in this repo.
 * The contract (events, experiments, storage): qorus-api design/analytics-and-experiments-design.md.
 *
 * Layers (each only imports the ones above it):
 *   core/     plain TypeScript, no DOM: ids, consent, queue, sections, hashing, assignment, Tracker
 *   browser/  wiring to window/document: transport, IntersectionObserver, listeners
 *   react/    <TrackingProvider>, useConsent, useExperiment, <Experiment>
 * Nothing product-specific lives here: the property, endpoints, consent version and storage
 * prefix come from the config each app passes to `createBrowserTracker`.
 */
import { attachToPage, type IAttached } from './browser/attach';
import { browserEnv } from './browser/env';
import { Tracker } from './core/tracker';
import { resolveConfig, type TTrackingOptions } from './core/types';

export { Tracker } from './core/tracker';
export type { IPageInfo, ITrackerEnv } from './core/tracker';
export { ConsentStore } from './core/consent';
export {
  assign,
  bucketRanges,
  controlOf,
  DEFAULT_PREVIEW_PARAM,
  ExperimentStore,
  normaliseDefinition,
  parsePreview,
  pathMatches,
} from './core/experiments';
export type { IAssignContext, IAssignment, TAssignmentReason, TExperimentsStatus } from './core/experiments';
export { fnv1a32, hashV2 } from './core/hash';
export { Observable } from './core/observable';
export { EventQueue } from './core/queue';
export type { ITransport } from './core/queue';
export { effectiveRatio, SectionClock } from './core/sections';
export type { ISectionSummary } from './core/sections';
export { memoryStorage, readJson, safeStorage, writeJson } from './core/storage';
export type { IStorage } from './core/storage';
export { parseUtm, utmParams } from './core/utm';
export { DEFAULT_CONFIG, DEFAULT_STORAGE_PREFIX, KEYS, resolveConfig, storageKeys } from './core/types';
export type {
  IBatch,
  IExperimentDefinition,
  IExperimentVariant,
  ITrackedEvent,
  ITrackingConfig,
  IUtm,
  TConsentState,
  TEventType,
  TProps,
  TRequiredTrackingConfig,
  TStorageKeys,
  TTrackingOptions,
} from './core/types';
export { attachToPage } from './browser/attach';
export type { IAttached } from './browser/attach';
export { browserEnv, browserTransport, deviceOf } from './browser/env';

/** A tracker for a real browser page. Call `attach()` once the page is up (`<TrackingProvider>` does). */
export const createBrowserTracker = (options: TTrackingOptions): { tracker: Tracker; attach: () => IAttached } => {
  const config = resolveConfig(options);
  const tracker = new Tracker(config, browserEnv(config.endpoint));
  return { tracker, attach: () => attachToPage(tracker, config.heartbeatMs) };
};

export { trackClick, trackSection } from './markup';
export type { TTrackAttributes } from './markup';
export * from './react';
export { createMemoryTracker } from './testing';
export type { IMemoryTracker, IMemoryTrackerOptions } from './testing';
