import { ConsentStore } from './consent';
import { EngagementClock } from './engagement';
import { assign, ExperimentStore, type IAssignContext, type IAssignment } from './experiments';
import { eventId, randomId } from './ids';
import { Observable } from './observable';
import { EventQueue, type ITransport } from './queue';
import { SectionClock } from './sections';
import { readJson, writeJson, type IStorage } from './storage';
import {
  resolveConfig,
  storageKeys,
  type IBatch,
  type ITrackingConfig,
  type IUtm,
  type TEventType,
  type TProps,
  type TStorageKeys,
  type TTrackingOptions,
} from './types';
import { parseUtm, utmParams } from './utm';

/** What the page looks like right now (the browser layer reads it from `window`). */
export interface IPageInfo {
  /** `https://example.com` */
  origin: string;
  path: string;
  search: string;
  title: string;
  referrer: string;
  lang: string;
  viewport: [number, number];
  device?: IAssignContext['device'];
}

/** Everything the tracker needs from its host; tests pass fakes. */
export interface ITrackerEnv {
  local: IStorage;
  session: IStorage;
  transport: ITransport;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  page: () => IPageInfo;
  fetchJson: (url: string, timeoutMs: number) => Promise<unknown>;
  log?: (...args: unknown[]) => void;
}

interface IPageView {
  id: string;
  path: string;
  start: number;
  maxScrollPct: number;
  summarySeq: number;
  exposed: Set<string>;
}

interface IExposureWatch {
  assignment: IAssignment;
}

/**
 * The tracker: identity, consent, the event queue, page views and their summaries,
 * experiment assignment and exposure. It has no DOM code of its own (see
 * `browser/attach.ts`), so it runs unchanged in tests and in any web property.
 * Everything product-specific (property, endpoints, storage prefix) is in `config`.
 *
 * Never throws into the page: every public method is wrapped.
 */
export class Tracker {
  readonly consent: ConsentStore;
  readonly experiments: ExperimentStore;
  readonly sections: SectionClock;
  private readonly engagement: EngagementClock;
  private readonly queue: EventQueue;
  private pv: IPageView | null = null;
  private lastUrl: string | null = null;
  private readonly firstTouchUtm: IUtm | null;
  private watches = new Set<IExposureWatch>();
  private started = false;
  /** The current page view id (null without consent): the browser layer re-measures sections on change. */
  readonly pageViewId = new Observable<string | null>(null);
  /** The storage keys under `config.storagePrefix`. */
  readonly keys: TStorageKeys;
  readonly config: ITrackingConfig;

  constructor(
    options: TTrackingOptions,
    private readonly env: ITrackerEnv,
  ) {
    // A config built by hand (not through `resolveConfig`) still gets the defaults.
    const config = resolveConfig(options);
    this.config = config;
    this.keys = storageKeys(config.storagePrefix);
    this.consent = new ConsentStore(env.local, config.consentVersion, this.keys);
    const first = env.page();
    this.firstTouchUtm = parseUtm(first.search);
    this.experiments = new ExperimentStore({
      property: config.property,
      endpoint: config.experimentsEndpoint,
      local: env.local,
      session: env.session,
      now: env.now,
      fetchJson: env.fetchJson,
      keys: this.keys,
      previewParam: config.previewParam,
    });
    this.experiments.applyPreviewFrom(first.search);
    this.sections = new SectionClock(env.now());
    this.engagement = new EngagementClock(config.engagedWindowMs);
    this.queue = new EventQueue({
      flushIntervalMs: config.flushIntervalMs,
      maxQueued: config.maxQueued,
      transport: env.transport,
      envelope: () => this.envelope(),
      now: env.now,
      setTimer: env.setTimer,
      clearTimer: env.clearTimer,
      debug: config.debug ? (b) => env.log?.('[tracking] batch', b) : undefined,
    });
    this.sections.onSeen((id) => this.safe(() => this.onSectionSeen(id)));
    this.consent.state.subscribe(() => this.safe(() => this.onConsentChange()));
  }

  /** Runs `fn` and swallows any error: analytics never breaks the page. */
  private safe<T>(fn: () => T): T | undefined {
    try {
      return fn();
    } catch (err) {
      if (this.config.debug) this.env.log?.('[tracking] error', err);
      return undefined;
    }
  }

  private active = () => this.config.enabled && this.consent.granted();

  /** The tracker's clock (the browser layer times sections with it). */
  now = (): number => this.env.now();

  // ── identity ────────────────────────────────────────────────────────────────

  /** The visitor id: exists only with consent. */
  vid(): string | null {
    if (!this.active()) return null;
    let vid = this.env.local.get(this.keys.vid);
    if (!vid) {
      vid = randomId(16);
      this.env.local.set(this.keys.vid, vid);
    }
    return vid;
  }

  /** The session id: a new one after `sessionTimeoutMs` without an event. */
  private sid(touch: boolean): string {
    const now = this.env.now();
    const s = readJson<{ id: string; last: number }>(this.env.session, this.keys.sid);
    const id = s && now - s.last < this.config.sessionTimeoutMs ? s.id : randomId(12);
    if (touch || !s || s.id !== id) writeJson(this.env.session, this.keys.sid, { id, last: now });
    return id;
  }

  private envelope(): Omit<IBatch, 'events' | 'sent_at'> | null {
    const vid = this.vid();
    if (!vid) return null;
    return { v: 1, property: this.config.property, vid, sid: this.sid(false), consent: 'granted' };
  }

  // ── consent ─────────────────────────────────────────────────────────────────

  grant() {
    this.safe(() => this.consent.answer('granted'));
  }

  /** Declines or withdraws: the visitor id and everything tied to it are deleted, nothing more is sent. */
  deny() {
    this.safe(() => this.consent.answer('denied'));
  }

  private onConsentChange() {
    if (this.consent.granted()) {
      if (!this.config.enabled) return;
      this.vid();
      if (this.firstTouchUtm && !this.env.session.get(this.keys.utm)) writeJson(this.env.session, this.keys.utm, this.firstTouchUtm);
      this.beginPageView();
      void this.experiments.load();
      return;
    }
    this.queue.clear();
    [this.keys.vid, this.keys.exposed].forEach((k) => this.env.local.remove(k));
    [this.keys.sid, this.keys.utm].forEach((k) => this.env.session.remove(k));
    this.pv = null;
    this.pageViewId.set(null);
  }

  // ── lifecycle ───────────────────────────────────────────────────────────────

  /** Call once when the page has loaded: starts the first page view if consent was given earlier. */
  start() {
    this.safe(() => {
      // Idempotent: React StrictMode mounts twice in development.
      if (this.started) return;
      this.started = true;
      void this.experiments.load();
      if (!this.active()) return;
      this.vid();
      this.beginPageView();
    });
  }

  /** A route change in a single-page app: closes the current page view and starts a new one. */
  pageview() {
    this.safe(() => {
      const page = this.env.page();
      if (this.pv && this.lastUrl === page.path + page.search) return;
      this.experiments.applyPreviewFrom(page.search);
      if (!this.active()) return;
      if (this.pv) this.summary(true);
      this.beginPageView();
    });
  }

  private beginPageView() {
    const page = this.env.page();
    const now = this.env.now();
    const previous = this.lastUrl;
    this.pv = { id: eventId(), path: page.path, start: now, maxScrollPct: 0, summarySeq: 0, exposed: new Set() };
    this.lastUrl = page.path + page.search;
    this.sections.reset(now);
    this.engagement.reset();
    this.pageViewId.set(this.pv.id);
    const firstOfSession = !this.env.session.get(this.keys.sid);
    const utm = parseUtm(page.search) ?? (firstOfSession ? this.firstTouchUtm : null);
    this.record('pageview', {
      // The first page view carries the document referrer; later SPA views the previous page.
      referrer: previous ? `${page.origin}${previous}` : page.referrer || null,
      title: page.title,
      ...(utm ? { utm } : {}),
      viewport: page.viewport,
      lang: page.lang,
    });
    // Watches whose trigger is the render itself fire once per page view.
    this.watches.forEach((w) => w.assignment.trigger == null && this.expose(w.assignment, 'render'));
    this.watches.forEach((w) => w.assignment.trigger != null && this.sections.register(w.assignment.trigger, false));
  }

  /**
   * A cumulative summary of the page view. Sent when the tab is hidden (`final:
   * false`, the visitor may come back) and when the page is left (`final: true`);
   * the one with the highest `seq` for a `pv_id` is the complete one.
   */
  summary(final: boolean) {
    this.safe(() => {
      if (!this.pv || !this.active()) return;
      const now = this.env.now();
      this.pv.summarySeq += 1;
      this.record('page_summary', {
        duration_ms: Math.max(0, Math.round(now - this.pv.start)),
        engaged_ms: this.engagement.total(now),
        max_scroll_pct: this.pv.maxScrollPct,
        exit_section: this.sections.current(),
        sections: this.sections.summary(now),
        seq: this.pv.summarySeq,
        final,
      });
    });
  }

  // ── signals from the browser layer ─────────────────────────────────────────

  activity() {
    this.safe(() => this.engagement.activity(this.env.now()));
  }

  scrolled(pct: number) {
    this.safe(() => {
      if (this.pv) this.pv.maxScrollPct = Math.max(this.pv.maxScrollPct, Math.min(100, Math.round(pct)));
    });
  }

  setTabVisible(visible: boolean) {
    this.safe(() => {
      const now = this.env.now();
      this.sections.setTabVisible(visible, now);
      this.engagement.setTabVisible(visible, now);
      if (!visible) {
        this.summary(false);
        void this.flush('beacon');
      }
    });
  }

  /** The page is going away (`pagehide`). */
  leave() {
    this.safe(() => {
      this.summary(true);
      void this.flush('beacon');
    });
  }

  flush(mode: 'fetch' | 'beacon' = 'fetch') {
    return this.safe(() => this.queue.flush(mode)) ?? Promise.resolve();
  }

  // ── events ──────────────────────────────────────────────────────────────────

  /** Queues an event of any type (nothing happens without consent). */
  record(type: TEventType, props?: TProps) {
    this.safe(() => {
      if (!this.active() || !this.pv) return;
      this.sid(true);
      this.queue.push({
        id: eventId(),
        type,
        ts: new Date(this.env.now()).toISOString(),
        pv_id: this.pv.id,
        path: this.pv.path,
        ...(props && Object.keys(props).length ? { props } : {}),
      });
    });
  }

  heartbeat() {
    this.record('heartbeat');
  }

  click(props: { target: string; placement?: string | null; label?: string | null; href?: string | null }) {
    this.record('click', props);
  }

  /** A conversion the server's goals can match (`signup-started`, …). */
  goal(name: string, value?: number) {
    this.record('goal', value == null ? { goal: name } : { goal: name, value });
  }

  /** A named event with free-form props (`form-submitted`, `plan-picked`, …). */
  custom(name: string, props: TProps = {}) {
    this.record('custom', { ...props, name });
  }

  // ── experiments ─────────────────────────────────────────────────────────────

  /**
   * The variant for this visitor. Preview override first, then the running
   * definition; the control whenever consent, the definitions or targeting say no.
   */
  decide(key: string, fallbackControl = 'a'): IAssignment {
    return (
      this.safe(() => {
        const def = this.experiments.get(key);
        const trigger = def?.trigger?.section ?? null;
        // An ended test shows its winner to everybody (consent or not, previews or not).
        if (def?.status === 'concluded') return assign(def, null, { path: this.env.page().path });
        const preview = this.experiments.previewOf(key);
        if (preview) return { key, variant: preview, enrolled: false, reason: 'preview', trigger } as IAssignment;
        if (!this.active()) return { key, variant: fallbackControl, enrolled: false, reason: 'no-consent', trigger } as IAssignment;
        if (!def) return { key, variant: fallbackControl, enrolled: false, reason: 'not-running', trigger: null } as IAssignment;
        const page = this.env.page();
        return assign(def, this.vid(), { path: page.path, device: page.device, lang: page.lang });
      }) ?? { key, variant: fallbackControl, enrolled: false, reason: 'not-running', trigger: null }
    );
  }

  /**
   * Logs the exposure once per page view when the trigger section is seen (or at
   * once for `trigger: null`). Returns an unsubscribe for when the variant unmounts.
   */
  watchExposure(assignment: IAssignment): () => void {
    if (!assignment.enrolled) return () => undefined;
    const watch: IExposureWatch = { assignment };
    this.watches.add(watch);
    this.safe(() => {
      if (assignment.trigger == null) this.expose(assignment, 'render');
      else {
        this.sections.register(assignment.trigger, false);
        if (this.sections.isSeen(assignment.trigger)) this.expose(assignment, 'view');
      }
    });
    return () => void this.watches.delete(watch);
  }

  private onSectionSeen(id: string) {
    this.watches.forEach((w) => w.assignment.trigger === id && this.expose(w.assignment, 'view'));
  }

  private expose(a: IAssignment, trigger: 'view' | 'render') {
    if (!this.pv || !this.active() || this.pv.exposed.has(a.key)) return;
    this.pv.exposed.add(a.key);
    const exposed = readJson<Record<string, string>>(this.env.local, this.keys.exposed) ?? {};
    if (exposed[a.key] !== a.variant) writeJson(this.env.local, this.keys.exposed, { ...exposed, [a.key]: a.variant });
    this.record('exposure', { experiment: a.key, variant: a.variant, trigger });
  }

  // ── sign-up attribution ─────────────────────────────────────────────────────

  /**
   * Adds `qa_exp=key:variant,…` (experiments this visitor was exposed to; the server's
   * sign-up flow reads this parameter, §5.4 of the contract) and the
   * session's first-touch `utm_*` to a sign-up URL — nothing else, never the vid.
   * Without consent the URL is returned unchanged.
   */
  decorateSignupUrl(url: string): string {
    return (
      this.safe(() => {
        if (!this.active()) return url;
        const u = new URL(url);
        const exposed = readJson<Record<string, string>>(this.env.local, this.keys.exposed) ?? {};
        const pairs = Object.entries(exposed)
          .filter(([k, v]) => k && v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}:${v}`);
        if (pairs.length) u.searchParams.set('qa_exp', pairs.join(','));
        const utm = readJson<IUtm>(this.env.session, this.keys.utm) ?? this.firstTouchUtm;
        utmParams(utm).forEach(([k, v]) => u.searchParams.set(k, v));
        return u.toString();
      }) ?? url
    );
  }
}
