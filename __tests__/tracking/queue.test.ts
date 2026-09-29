import { describe, expect, it } from 'vitest';
import { EventQueue, MAX_EVENTS_PER_BATCH, type ITransport } from '../../src/tracking/core/queue';
import type { IBatch, ITrackedEvent } from '../../src/tracking/core/types';

const ENVELOPE = { v: 1 as const, property: 'test', vid: 'vid', sid: 'sid', consent: 'granted' as const };

const setup = (opts: { envelope?: () => typeof ENVELOPE | null; fail?: () => boolean } = {}) => {
  const sent: { batch: IBatch; mode: string }[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const transport: ITransport = {
    send: async (body, mode) => {
      if (opts.fail?.()) return false;
      sent.push({ batch: JSON.parse(body) as IBatch, mode });
      return true;
    },
  };
  const q = new EventQueue({
    flushIntervalMs: 5000,
    maxQueued: 20,
    transport,
    envelope: opts.envelope ?? (() => ENVELOPE),
    now: () => Date.UTC(2026, 8, 29),
    setTimer: (fn, ms) => timers.push({ fn, ms }) && timers.length,
    clearTimer: (h) => {
      const t = timers[(h as number) - 1];
      if (t) t.fn = () => undefined;
    },
  });
  return { q, sent, timers };
};

let n = 0;
const ev = (props?: Record<string, unknown>): ITrackedEvent => ({ id: `e${++n}`, type: 'custom', ts: '2026-09-29T00:00:00.000Z', pv_id: 'pv', path: '/', props });

describe('EventQueue', () => {
  it('waits for the timer, then sends one batch with the envelope', async () => {
    const { q, sent, timers } = setup();
    q.push(ev());
    q.push(ev());
    expect(sent).toHaveLength(0);
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(5000);
    timers[0].fn();
    await Promise.resolve();
    expect(sent).toHaveLength(1);
    expect(sent[0].batch).toMatchObject({ ...ENVELOPE, sent_at: '2026-09-29T00:00:00.000Z' });
    expect(sent[0].batch.events).toHaveLength(2);
    expect(q.length).toBe(0);
  });

  it('flushes at once when 20 events are waiting', async () => {
    const { q, sent } = setup();
    for (let i = 0; i < 20; i++) q.push(ev());
    await Promise.resolve();
    expect(sent).toHaveLength(1);
    expect(sent[0].batch.events).toHaveLength(20);
    expect(sent[0].mode).toBe('fetch');
  });

  it('sends a beacon when asked (page going away)', async () => {
    const { q, sent } = setup();
    q.push(ev());
    await q.flush('beacon');
    expect(sent[0].mode).toBe('beacon');
  });

  it('splits into batches within the collector limits (100 events, 60 KB)', () => {
    const many = Array.from({ length: 250 }, () => ev());
    const byCount = EventQueue.chunk(many, ENVELOPE, 'now');
    expect(byCount.map((b) => b.events.length)).toEqual([MAX_EVENTS_PER_BATCH, MAX_EVENTS_PER_BATCH, 50]);
    const big = Array.from({ length: 30 }, () => ev({ blob: 'x'.repeat(5000) }));
    const bySize = EventQueue.chunk(big, ENVELOPE, 'now');
    expect(bySize.length).toBeGreaterThan(2);
    bySize.forEach((b) => expect(JSON.stringify(b).length).toBeLessThanOrEqual(60 * 1024));
    expect(bySize.reduce((a, b) => a + b.events.length, 0)).toBe(30);
  });

  it('keeps events when the network fails and sends them with the next flush, same ids', async () => {
    let offline = true;
    const { q, sent } = setup({ fail: () => offline });
    const first = ev();
    q.push(first);
    await q.flush();
    expect(q.length).toBe(1);
    offline = false;
    q.push(ev());
    await q.flush();
    expect(sent[0].batch.events.map((e) => e.id)).toEqual([first.id, `e${n}`]);
  });

  it('drops everything when there is no envelope (no consent)', async () => {
    const { q, sent } = setup({ envelope: () => null });
    q.push(ev());
    await q.flush();
    expect(sent).toHaveLength(0);
    expect(q.length).toBe(0);
  });
});
