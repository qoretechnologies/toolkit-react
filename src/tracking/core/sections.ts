/**
 * Attention per section, as plain arithmetic over time (no DOM): the browser layer
 * feeds it visibility changes from an IntersectionObserver and tab visibility, and
 * asks it for the page summary.
 *
 * - `visible_ms`: time any part of the section was on screen while the tab was visible.
 * - `seen`: the section was at least 50% visible for at least 1 s in one stretch — the
 *   attention definition the contract uses everywhere (§4). "50% visible" is 50% of
 *   the section *or* 50% of the viewport covered by it: a section taller than two
 *   screens can never show half of itself, and it would otherwise never count.
 * - `first_seen_ms`: when that stretch began, measured from the start of the page view.
 */

export const SEEN_RATIO = 0.5;
export const SEEN_MS = 1000;

export interface ISectionSummary {
  id: string;
  visible_ms: number;
  seen: boolean;
  first_seen_ms: number | null;
}

interface ISectionState {
  id: string;
  /** Effective visibility 0..1 (see above). */
  ratio: number;
  visibleMs: number;
  visibleSince: number | null;
  halfSince: number | null;
  seenAt: number | null;
  firstSeenMs: number | null;
  /** Reported in the page summary (false for synthetic experiment triggers). */
  report: boolean;
}

export class SectionClock {
  private sections = new Map<string, ISectionState>();
  private tabVisible = true;
  private seenListeners = new Set<(id: string) => void>();

  constructor(private start: number) {}

  /** A new page view: everything starts from zero at `now`. */
  reset(now: number) {
    this.start = now;
    const ids = Array.from(this.sections.values()).map((s) => [s.id, s.report] as const);
    this.sections.clear();
    ids.forEach(([id, report]) => this.ensure(id, report));
  }

  onSeen(listener: (id: string) => void) {
    this.seenListeners.add(listener);
    return () => void this.seenListeners.delete(listener);
  }

  isSeen = (id: string) => this.sections.get(id)?.seenAt != null;

  private ensure(id: string, report = true): ISectionState {
    let s = this.sections.get(id);
    if (!s) {
      s = { id, ratio: 0, visibleMs: 0, visibleSince: null, halfSince: null, seenAt: null, firstSeenMs: null, report };
      this.sections.set(id, s);
    }
    return s;
  }

  /** Registers a section so it shows up in the summary even if it is never on screen. */
  register(id: string, report = true) {
    this.ensure(id, report).report ||= report;
  }

  /** The section's effective visibility changed. */
  update(id: string, ratio: number, now: number) {
    const s = this.ensure(id);
    if (this.tabVisible) {
      const wasVisible = s.ratio > 0;
      const isVisible = ratio > 0;
      if (wasVisible && !isVisible && s.visibleSince != null) {
        s.visibleMs += Math.max(0, now - s.visibleSince);
        s.visibleSince = null;
      }
      if (!wasVisible && isVisible) s.visibleSince = now;
      // A stretch at >= 50% continues through ratio changes above the line.
      const wasHalf = s.ratio >= SEEN_RATIO;
      const isHalf = ratio >= SEEN_RATIO;
      if (wasHalf && !isHalf) {
        this.tickOne(s, now);
        s.halfSince = null;
      }
      if (!wasHalf && isHalf) s.halfSince = now;
    }
    s.ratio = ratio;
  }

  /** The tab became visible or hidden: time stops counting while hidden. */
  setTabVisible(visible: boolean, now: number) {
    if (visible === this.tabVisible) return;
    this.sections.forEach((s) => this.settle(s, now));
    this.tabVisible = visible;
    this.sections.forEach((s) => this.arm(s, now));
  }

  /** Promotes stretches that have lasted long enough to `seen`. Call ~every second. */
  tick(now: number) {
    this.sections.forEach((s) => this.tickOne(s, now));
  }

  /** Closes the open stretches up to `now` (visible time, seen). */
  private settle(s: ISectionState, now: number) {
    if (s.visibleSince != null) s.visibleMs += Math.max(0, now - s.visibleSince);
    s.visibleSince = null;
    this.tickOne(s, now);
    s.halfSince = null;
  }

  private tickOne(s: ISectionState, now: number) {
    if (s.seenAt == null && s.halfSince != null && now - s.halfSince >= SEEN_MS) {
      s.seenAt = now;
      s.firstSeenMs = Math.max(0, s.halfSince - this.start);
      this.seenListeners.forEach((l) => l(s.id));
    }
  }

  /** Opens stretches for the current state. */
  private arm(s: ISectionState, now: number) {
    if (!this.tabVisible) return;
    if (s.ratio > 0) s.visibleSince = now;
    if (s.ratio >= SEEN_RATIO) s.halfSince = now;
  }

  /** The section most on screen now (ties: the lower one on the page, i.e. the later registered). */
  current(): string | null {
    let best: ISectionState | null = null;
    for (const s of Array.from(this.sections.values())) {
      if (s.report && s.ratio > 0 && (!best || s.ratio >= best.ratio)) best = s;
    }
    return best?.id ?? null;
  }

  summary(now: number): ISectionSummary[] {
    this.tick(now);
    return Array.from(this.sections.values())
      .filter((s) => s.report)
      .map((s) => ({
        id: s.id,
        visible_ms: Math.round(s.visibleMs + (s.visibleSince != null ? Math.max(0, now - s.visibleSince) : 0)),
        seen: s.seenAt != null,
        first_seen_ms: s.firstSeenMs,
      }));
  }
}

/**
 * Effective visibility from an IntersectionObserver entry: the larger of the share
 * of the section on screen and the share of the viewport the section fills.
 */
export const effectiveRatio = (
  intersectionRatio: number,
  intersectionHeight: number,
  viewportHeight: number,
): number => {
  if (intersectionRatio <= 0) return 0;
  const cover = viewportHeight > 0 ? intersectionHeight / viewportHeight : 0;
  return Math.min(1, Math.max(intersectionRatio, cover));
};
