/**
 * Engaged time: the tab is visible AND the visitor did something (scroll, pointer,
 * key, touch) within the last `windowMs`. Each interaction extends the engaged
 * stretch to `interaction + windowMs`; hiding the tab ends it at once.
 */
export class EngagementClock {
  private engagedMs = 0;
  /** Start and end of the current engaged stretch (end is in the future while active). */
  private from: number | null = null;
  private until = 0;
  private tabVisible = true;

  constructor(private readonly windowMs: number) {}

  reset() {
    this.engagedMs = 0;
    this.from = null;
    this.until = 0;
  }

  activity(now: number) {
    if (!this.tabVisible) return;
    if (this.from != null && now <= this.until) {
      this.until = now + this.windowMs;
      return;
    }
    this.close(now);
    this.from = now;
    this.until = now + this.windowMs;
  }

  setTabVisible(visible: boolean, now: number) {
    if (!visible) this.close(now);
    this.tabVisible = visible;
  }

  private close(now: number) {
    if (this.from == null) return;
    this.engagedMs += Math.max(0, Math.min(now, this.until) - this.from);
    this.from = null;
  }

  total(now: number): number {
    const open = this.from != null ? Math.max(0, Math.min(now, this.until) - this.from) : 0;
    return Math.round(this.engagedMs + open);
  }
}
