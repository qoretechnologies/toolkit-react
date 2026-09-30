import { hashV2 } from './hash';
import { Observable } from './observable';
import { readJson, writeJson, type IStorage } from './storage';
import { KEYS, type IExperimentDefinition, type IExperimentVariant, type TStorageKeys } from './types';

/**
 * Client-side assignment (§5 of the contract). No round trip: the running
 * experiments are fetched once (public fields only) and every visitor is bucketed
 * locally from their `vid`, the same way every time, on any page.
 */

export type TAssignmentReason =
  /** Bucketed into a variant: an exposure is logged when the trigger is seen. */
  | 'assigned'
  /** Outside the experiment's traffic share: control, no exposure. */
  | 'not-enrolled'
  /** Targeting (path, device, language) does not match: control, no exposure. */
  | 'not-targeted'
  /** No consent (no vid) or tracking disabled: control, no exposure. */
  | 'no-consent'
  /** Definitions not loaded (yet, or the endpoint is missing) or experiment not running: control. */
  | 'not-running'
  /** A preview link (`?qa_variant=`) or the in-app version switch: that variant, never logged. */
  | 'preview'
  /** The experiment ended: everybody sees the winner, nothing is logged. */
  | 'concluded';

export interface IAssignment {
  key: string;
  variant: string;
  /** Whether this visitor counts for the experiment (exposure is logged). */
  enrolled: boolean;
  reason: TAssignmentReason;
  /** The section whose being seen logs the exposure; null → on render. */
  trigger: string | null;
}

export interface IAssignContext {
  path: string;
  device?: 'desktop' | 'tablet' | 'mobile';
  lang?: string;
}

export const controlOf = (variants: IExperimentVariant[], fallback = 'a'): string =>
  (variants.find((v) => v.control) ?? variants[0])?.key ?? fallback;

/**
 * GrowthBook's bucket ranges: variant i owns `[c_i, c_i + traffic * w_i)` where
 * `c_i` is the sum of the weights before it. The enrolled share equals `traffic`,
 * and raising `traffic` later never moves an enrolled visitor to another variant.
 * Weights that do not add up to 1 are normalised.
 */
export const bucketRanges = (weights: number[], traffic: number): [number, number][] => {
  const cover = Math.min(1, Math.max(0, Number.isFinite(traffic) ? traffic : 0));
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  const norm = sum > 0 ? clean.map((w) => w / sum) : clean.map(() => 1 / clean.length);
  let cumulative = 0;
  return norm.map((w) => {
    const start = cumulative;
    cumulative += w;
    return [start, start + cover * w];
  });
};

/** `/` matches `/` only; `/blog/*` matches `/blog/` and everything under it. */
export const pathMatches = (patterns: string[] | null | undefined, path: string): boolean => {
  if (!patterns || !patterns.length) return true;
  const clean = path.split(/[?#]/)[0] || '/';
  return patterns.some((p) => (p.endsWith('*') ? clean.startsWith(p.slice(0, -1)) : clean === p || clean === `${p}/`));
};

const targeted = (def: IExperimentDefinition, ctx: IAssignContext): boolean => {
  const t = def.targeting;
  if (!t) return true;
  if (!pathMatches(t.paths, ctx.path)) return false;
  if (t.device && ctx.device && t.device !== ctx.device) return false;
  if (t.lang && ctx.lang && !ctx.lang.toLowerCase().startsWith(t.lang.toLowerCase())) return false;
  return true;
};

/** Pure assignment of one visitor to one experiment. */
export const assign = (def: IExperimentDefinition, vid: string | null, ctx: IAssignContext): IAssignment => {
  const control = controlOf(def.variants);
  const trigger = def.trigger?.section ?? null;
  const base = { key: def.key, variant: control, enrolled: false, trigger };
  if (def.status === 'concluded') return { ...base, variant: def.winner || control, reason: 'concluded' };
  if (!vid) return { ...base, reason: 'no-consent' };
  if (!def.variants.length) return { ...base, reason: 'not-running' };
  if (!targeted(def, ctx)) return { ...base, reason: 'not-targeted' };
  const n = hashV2(def.key, vid);
  const ranges = bucketRanges(
    def.variants.map((v) => v.weight),
    def.traffic,
  );
  const i = ranges.findIndex(([from, to]) => n >= from && n < to);
  if (i < 0) return { ...base, reason: 'not-enrolled' };
  return { ...base, variant: def.variants[i].key, enrolled: true, reason: 'assigned' };
};

/** The default preview query parameter. */
export const DEFAULT_PREVIEW_PARAM = 'qa_variant';

/**
 * `?qa_variant=signup-cta:b,other:a` → `{ 'signup-cta': 'b', other: 'a' }`.
 * `?qa_variant=clear` (or `off`) → `{}` and clears the saved preview.
 * Returns null when the parameter is absent. `param` names the query parameter.
 */
export const parsePreview = (search: string, param: string = DEFAULT_PREVIEW_PARAM): Record<string, string> | null => {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search).get(param);
  } catch {
    return null;
  }
  if (raw == null) return null;
  const out: Record<string, string> = {};
  if (raw === 'clear' || raw === 'off') return out;
  raw.split(',').forEach((pair) => {
    const [k, v] = pair.split(':').map((s) => s?.trim());
    if (k && v && /^[\w.-]{1,80}$/.test(k) && /^[\w.-]{1,40}$/.test(v)) out[k] = v;
  });
  return out;
};

export type TExperimentsStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface ICache {
  at: number;
  property: string;
  experiments: IExperimentDefinition[];
}

/** Cached definitions are used for a flicker-free first render for up to a day, then refreshed. */
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;

/** A usable entry, normalised (a concluded entry gets `variants: []`); null for junk. */
export const normaliseDefinition = (x: unknown): IExperimentDefinition | null => {
  const d = x as IExperimentDefinition;
  if (!d || typeof d.key !== 'string') return null;
  if (d.status === 'concluded') return typeof d.winner === 'string' && d.winner ? { ...d, variants: d.variants ?? [] } : null;
  if (d.status && d.status !== 'running') return null;
  const ok = Array.isArray(d.variants) && d.variants.every((v) => v && typeof v.key === 'string' && typeof v.weight === 'number');
  return ok ? d : null;
};

export interface IExperimentsDeps {
  property: string;
  endpoint: string;
  local: IStorage;
  session: IStorage;
  now: () => number;
  fetchJson: (url: string, timeoutMs: number) => Promise<unknown>;
  /** Storage keys (default prefix `qa.`). */
  keys?: TStorageKeys;
  /** The preview query parameter (default `qa_variant`). */
  previewParam?: string;
}

/** Holds the running experiments and the preview overrides. */
export class ExperimentStore {
  readonly status = new Observable<TExperimentsStatus>('idle');
  /**
   * An in-app version switch, per experiment (`{ key: variant }`), in this browser's
   * localStorage (an editor lets its user see each version). A preview: never logged.
   * Rendered variants follow it live.
   */
  readonly editorOverrides: Observable<Record<string, string>>;
  /**
   * Bumped by `refresh()` (an editor, after it accepted a winner or removed a version): mounted
   * experiments decide again, so an accepted test shows its winner at once. Visitors never
   * trigger it, so their variant stays fixed for the page view.
   */
  readonly revision = new Observable<number>(0);
  private definitions = new Map<string, IExperimentDefinition>();
  private preview: Record<string, string>;
  private readonly keys: TStorageKeys;

  constructor(private readonly d: IExperimentsDeps) {
    this.keys = d.keys ?? KEYS;
    this.preview = readJson<Record<string, string>>(d.session, this.keys.preview) ?? {};
    this.editorOverrides = new Observable<Record<string, string>>(readJson<Record<string, string>>(d.local, this.keys.editorVariants) ?? {});
    const cache = readJson<ICache>(d.local, this.keys.experimentsCache);
    if (cache && cache.property === d.property && d.now() - cache.at < CACHE_MAX_AGE_MS && Array.isArray(cache.experiments)) {
      this.setDefinitions(cache.experiments);
      this.status.set('ready');
    }
  }

  /** Reads the preview parameter (`?qa_variant=`) from the URL; the preview sticks for the browser session. */
  applyPreviewFrom(search: string) {
    const parsed = parsePreview(search, this.d.previewParam ?? DEFAULT_PREVIEW_PARAM);
    if (!parsed) return;
    this.preview = Object.keys(parsed).length ? { ...this.preview, ...parsed } : {};
    if (Object.keys(this.preview).length) writeJson(this.d.session, this.keys.preview, this.preview);
    else this.d.session.remove(this.keys.preview);
  }

  /** The in-app switch first, then a preview link. */
  previewOf = (key: string): string | undefined => this.editorOverrides.get()[key] ?? this.preview[key];

  editorOverrideOf = (key: string): string | undefined => this.editorOverrides.get()[key];

  /** The in-app version switch for one experiment; `null` goes back to the visitor's own variant. */
  setEditorOverride(key: string, variant: string | null) {
    const next = { ...this.editorOverrides.get() };
    if (variant) next[key] = variant;
    else delete next[key];
    if (Object.keys(next).length) writeJson(this.d.local, this.keys.editorVariants, next);
    else this.d.local.remove(this.keys.editorVariants);
    this.editorOverrides.set(next);
  }

  /** Re-reads the switches (another window of the same app changed them). */
  reloadEditorOverrides() {
    const stored = readJson<Record<string, string>>(this.d.local, this.keys.editorVariants) ?? {};
    if (JSON.stringify(stored) !== JSON.stringify(this.editorOverrides.get())) this.editorOverrides.set(stored);
  }

  /** Loads the definitions again and makes mounted experiments decide again (for an editor, never for visitors). */
  async refresh(): Promise<void> {
    await this.load(true);
    this.revision.set(this.revision.get() + 1);
  }

  private setDefinitions(list: unknown[]) {
    this.definitions = new Map(
      list.map(normaliseDefinition).filter((d): d is IExperimentDefinition => !!d).map((d) => [d.key, d]),
    );
  }

  get(key: string) {
    return this.definitions.get(key);
  }

  /** Fetches the running experiments; a missing endpoint leaves everyone on the control. */
  async load(force = false): Promise<void> {
    if (this.status.get() === 'loading' && !force) return;
    const hadCache = this.status.get() === 'ready';
    if (!hadCache) this.status.set('loading');
    try {
      const sep = this.d.endpoint.includes('?') ? '&' : '?';
      const body = await this.d.fetchJson(`${this.d.endpoint}${sep}property=${encodeURIComponent(this.d.property)}`, FETCH_TIMEOUT_MS);
      const list = Array.isArray(body) ? body : ((body as { experiments?: unknown[] } | null)?.experiments ?? null);
      if (!Array.isArray(list)) throw new Error('unexpected experiments payload');
      this.setDefinitions(list);
      writeJson(this.d.local, this.keys.experimentsCache, {
        at: this.d.now(),
        property: this.d.property,
        experiments: Array.from(this.definitions.values()),
      } satisfies ICache);
      this.status.set('ready');
    } catch {
      if (!hadCache) this.status.set('failed');
    }
  }
}
