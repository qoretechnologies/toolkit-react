/**
 * Wire types of the first-party tracker. The contract (event shapes, batch envelope,
 * experiment definitions) is owned by qorus-api `design/analytics-and-experiments-design.md`
 * (§4 collector, §5 experiments); change it there first, then here.
 */

export type TConsentState = 'unknown' | 'granted' | 'denied';

/** Event types the collector knows. New ones are allowed without a schema change (§4). */
export type TEventType =
  | 'pageview'
  | 'page_summary'
  | 'click'
  | 'heartbeat'
  | 'exposure'
  | 'goal'
  | 'custom'
  | (string & Record<never, never>);

export type TProps = Record<string, unknown>;

export interface ITrackedEvent {
  /** Random id: makes the write idempotent (retries, beacon + fetch fallback). */
  id: string;
  type: TEventType;
  /** ISO timestamp of when it happened in the browser. */
  ts: string;
  pv_id: string;
  path: string;
  props?: TProps;
}

export interface IBatch {
  v: 1;
  property: string;
  vid: string;
  sid: string;
  sent_at: string;
  consent: 'granted';
  events: ITrackedEvent[];
}

export interface IUtm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

/** Public fields of a running experiment (the experiments endpoint, `?property=…`). */
export interface IExperimentVariant {
  key: string;
  weight: number;
  control?: boolean;
}

export interface IExperimentDefinition {
  key: string;
  /**
   * `running` (assign and log), or `concluded`: everybody sees `winner`, nothing is logged. A
   * concluded entry carries only `key`, `status` and `winner`; its `variants` are normalised to [].
   */
  status?: 'running' | 'concluded' | (string & Record<never, never>);
  winner?: string | null;
  /** Counter of the running experiment's phase (a removed version starts a new one). */
  phase?: number;
  variants: IExperimentVariant[];
  /** Share of visitors enrolled, 0..1 (the rest see the control, no exposure). */
  traffic: number;
  targeting?: { paths?: string[] | null; device?: string | null; lang?: string | null } | null;
  /** The element whose being seen counts as exposure; none → exposure on render. */
  trigger?: { section?: string | null } | null;
}

/** Everything the tracker needs from its host. Every product-specific value lives here. */
export interface ITrackingConfig {
  /**
   * Which product the events belong to (`landing`, `ide`, `admin`, …). The server keeps each
   * property's events, goals and experiments apart, and the experiments list is fetched for it.
   */
  property: string;
  /** Collector URL (`POST`, the batch envelope of §4 of the contract). */
  endpoint: string;
  /** Running-experiments URL (`GET`); `?property=` is appended. */
  experimentsEndpoint: string;
  /** Master switch: false → nothing is ever sent, experiments serve the control. */
  enabled: boolean;
  /** Bump when the consent text changes materially: stored answers of older versions are asked again. */
  consentVersion: number;
  /**
   * Prefix of every localStorage / sessionStorage key the tracker writes (default `qa.`, the
   * contract's). Two products on one origin need different prefixes, or they share one consent
   * answer, one visitor id and one experiments cache.
   */
  storagePrefix: string;
  /** Query parameter of a shareable variant preview (`?qa_variant=key:variant`). */
  previewParam: string;
  /** Log every batch to the console instead of silently sending. */
  debug: boolean;
  flushIntervalMs: number;
  /** Flush as soon as this many events are queued. */
  maxQueued: number;
  heartbeatMs: number;
  sessionTimeoutMs: number;
  /** An interaction within this window counts the time as engaged. */
  engagedWindowMs: number;
}

/** The config fields every product must set: nothing product-specific has a default. */
export type TRequiredTrackingConfig = 'property' | 'endpoint' | 'experimentsEndpoint';

export const DEFAULT_STORAGE_PREFIX = 'qa.';

export const DEFAULT_CONFIG: Omit<ITrackingConfig, TRequiredTrackingConfig> = {
  enabled: true,
  consentVersion: 1,
  storagePrefix: DEFAULT_STORAGE_PREFIX,
  previewParam: 'qa_variant',
  debug: false,
  flushIntervalMs: 5000,
  maxQueued: 20,
  heartbeatMs: 15000,
  sessionTimeoutMs: 30 * 60 * 1000,
  engagedWindowMs: 10000,
};

/** What a product passes: the required fields, and any default it wants to change. */
export type TTrackingOptions = Partial<ITrackingConfig> & Pick<ITrackingConfig, TRequiredTrackingConfig>;

/** The full config: `options` over `DEFAULT_CONFIG` (an `undefined` option keeps the default). */
export const resolveConfig = (options: TTrackingOptions): ITrackingConfig => {
  const set = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  return { ...DEFAULT_CONFIG, ...set } as ITrackingConfig;
};

/** The storage keys for one prefix (first-party, removable in one sweep). */
export const storageKeys = (prefix: string = DEFAULT_STORAGE_PREFIX) => ({
  /** localStorage: `granted` | `denied` */
  consent: `${prefix}consent`,
  /** localStorage: the consent version that was answered */
  consentVersion: `${prefix}consent.v`,
  /** localStorage: the visitor id (exists only with consent) */
  vid: `${prefix}vid`,
  /** sessionStorage: `{ id, last }` */
  sid: `${prefix}sid`,
  /** sessionStorage: first-touch utm of this session */
  utm: `${prefix}utm`,
  /** localStorage: `{ experimentKey: variant }` the visitor was exposed to (sign-up attribution) */
  exposed: `${prefix}exp`,
  /** sessionStorage: preview overrides from the preview query parameter */
  preview: `${prefix}preview`,
  /** localStorage: last fetched public experiment definitions */
  experimentsCache: `${prefix}experiments`,
  /** localStorage: an in-app version switch per experiment (`{ key: variant }`), never logged */
  editorVariants: `${prefix}editor.variants`,
});

export type TStorageKeys = ReturnType<typeof storageKeys>;

/** The keys with the default prefix (`qa.consent`, `qa.vid`, …). */
export const KEYS: TStorageKeys = storageKeys(DEFAULT_STORAGE_PREFIX);
