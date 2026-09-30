import type { IBatch, ITrackedEvent } from './types';

/**
 * How a batch leaves the page. `beacon` is used when the page is going away
 * (`pagehide`, tab hidden): the browser delivers it after the page is gone.
 * Resolves to `true` when the batch was handed over, `false` to keep it for later
 * (network error), and never rejects.
 */
export interface ITransport {
  send(body: string, mode: 'fetch' | 'beacon'): Promise<boolean>;
}

/** Collector limits (§4): at most 100 events and 64 KB per batch. We stay under both. */
export const MAX_EVENTS_PER_BATCH = 100;
export const MAX_BATCH_BYTES = 60 * 1024;
/** Events kept while the collector is unreachable; the oldest are dropped past this. */
export const MAX_BACKLOG = 500;

export interface IQueueOptions {
  flushIntervalMs: number;
  maxQueued: number;
  transport: ITransport;
  /** The envelope for a batch; null → nothing may be sent (no consent) and the queue is dropped. */
  envelope: () => Omit<IBatch, 'events' | 'sent_at'> | null;
  now: () => number;
  /** Timers are injected so tests can drive them. */
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  debug?: (batch: IBatch) => void;
}

const size = (s: string) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length * 2);

/**
 * Batches events: sends every `flushIntervalMs`, as soon as `maxQueued` are waiting,
 * and immediately (as a beacon) when the page is going away.
 */
export class EventQueue {
  private events: ITrackedEvent[] = [];
  private timer: unknown = null;
  private sending = false;

  constructor(private readonly o: IQueueOptions) {}

  get length() {
    return this.events.length;
  }

  push(event: ITrackedEvent) {
    this.events.push(event);
    if (this.events.length > MAX_BACKLOG) this.events.splice(0, this.events.length - MAX_BACKLOG);
    if (this.events.length >= this.o.maxQueued) void this.flush('fetch');
    else this.schedule();
  }

  /** Forget everything unsent (consent withdrawn). */
  clear() {
    this.events = [];
    if (this.timer != null) this.o.clearTimer(this.timer);
    this.timer = null;
  }

  private schedule() {
    if (this.timer != null) return;
    this.timer = this.o.setTimer(() => {
      this.timer = null;
      void this.flush('fetch');
    }, this.o.flushIntervalMs);
  }

  /** Splits `events` into batches that fit the collector's limits. */
  static chunk(events: ITrackedEvent[], envelope: Omit<IBatch, 'events' | 'sent_at'>, sentAt: string): IBatch[] {
    const batches: IBatch[] = [];
    let current: ITrackedEvent[] = [];
    const bodyOf = (evts: ITrackedEvent[]) => JSON.stringify({ ...envelope, sent_at: sentAt, events: evts });
    for (const e of events) {
      const next = [...current, e];
      if (current.length && (next.length > MAX_EVENTS_PER_BATCH || size(bodyOf(next)) > MAX_BATCH_BYTES)) {
        batches.push({ ...envelope, sent_at: sentAt, events: current });
        current = [e];
      } else {
        current = next;
      }
    }
    if (current.length) batches.push({ ...envelope, sent_at: sentAt, events: current });
    // A single event larger than the limit is dropped rather than rejected forever.
    return batches.filter((b) => b.events.length > 1 || size(JSON.stringify(b)) <= MAX_BATCH_BYTES);
  }

  async flush(mode: 'fetch' | 'beacon' = 'fetch'): Promise<void> {
    if (this.timer != null) {
      this.o.clearTimer(this.timer);
      this.timer = null;
    }
    if (!this.events.length) return;
    // A fetch in flight owns the queue; a beacon (page going away) sends what is left now.
    if (this.sending && mode === 'fetch') {
      this.schedule();
      return;
    }
    const envelope = this.o.envelope();
    if (!envelope) {
      this.events = [];
      return;
    }
    const pending = this.events;
    this.events = [];
    const batches = EventQueue.chunk(pending, envelope, new Date(this.o.now()).toISOString());
    this.sending = true;
    const failed: ITrackedEvent[] = [];
    try {
      for (const batch of batches) {
        this.o.debug?.(batch);
        let ok = false;
        try {
          ok = await this.o.transport.send(JSON.stringify(batch), mode);
        } catch {
          ok = false;
        }
        if (!ok) failed.push(...batch.events);
      }
    } finally {
      this.sending = false;
    }
    if (failed.length) {
      // Kept for the next flush, which the next event schedules (no retry loop against a
      // collector that is down); event ids make a double delivery harmless.
      this.events = [...failed, ...this.events].slice(-MAX_BACKLOG);
    }
  }
}
