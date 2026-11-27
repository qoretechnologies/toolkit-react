import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../src/components/supportTicket/accessMeta';

const now = Date.UTC(2026, 9, 27, 16, 0, 0);
const at = (offsetSeconds: number) => new Date(now + offsetSeconds * 1000).toISOString();

describe('formatRelativeTime', () => {
  it('speaks of the past', () => {
    expect(formatRelativeTime(at(-15), now)).toBe('15 seconds ago');
    expect(formatRelativeTime(at(-3 * 60 * 60), now)).toBe('3 hours ago');
  });

  it('speaks of the future', () => {
    expect(formatRelativeTime(at(90), now)).toBe('in 2 minutes');
    expect(formatRelativeTime(at(24 * 60 * 60), now)).toBe('tomorrow');
    expect(formatRelativeTime(at(3 * 24 * 60 * 60), now)).toBe('in 3 days');
  });

  it('rounds a half the same way in the past as in the future', () => {
    expect(formatRelativeTime(at(90 * 60), now)).toBe('in 2 hours');
    expect(formatRelativeTime(at(-90 * 60), now)).toBe('2 hours ago');
    expect(formatRelativeTime(at(-150), now)).toBe('3 minutes ago');
  });

  it('holds still as a running clock moves past a half', () => {
    // a story's clock runs on from its start, so a render half a second late reads the same
    expect(formatRelativeTime(at(-90 * 60), now + 499)).toBe('2 hours ago');
    expect(formatRelativeTime(at(-90 * 60), now + 501)).toBe('2 hours ago');
  });

  it('counts days up to a month, so a week-long grant says when it ends', () => {
    expect(formatRelativeTime(at(7 * 24 * 60 * 60), now)).toBe('in 7 days');
    expect(formatRelativeTime(at(-14 * 24 * 60 * 60), now)).toBe('14 days ago');
    expect(formatRelativeTime(at(45 * 24 * 60 * 60), now)).toBe('in 2 months');
  });

  it('reads an instant inside the clock tick as the present, not the future', () => {
    // the callers' clock ticks once a minute; the plane stamps the event when it happens
    expect(formatRelativeTime(at(0), now)).toBe('just now');
    expect(formatRelativeTime(at(8), now)).toBe('just now');
    expect(formatRelativeTime(at(59), now)).toBe('just now');
    expect(formatRelativeTime(at(60), now)).toBe('in 1 minute');
  });

  it('is empty without an instant', () => {
    expect(formatRelativeTime(undefined, now)).toBe('');
    expect(formatRelativeTime('not a date', now)).toBe('');
  });
});
