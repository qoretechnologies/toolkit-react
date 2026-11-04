// Copyright 2026 Qore Technologies, s.r.o.
// The story clock: every story starts at STORY_NOW, the clock runs on from there,
// `parameters.mockdate` stops it, and a live story keeps the real one.
import { debounce } from 'lodash';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORY_NOW, startStoryClock, storyMinutesAgo } from '../src/stories/storyClock';

const PLATFORM_DATE = Date;

/* Real time passing, as `performance.now()` reports it. */
let elapsed = 0;
let restoreClock: (() => void) | undefined;

beforeEach(() => {
  elapsed = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
});

afterEach(() => {
  restoreClock?.();
  restoreClock = undefined;
  globalThis.Date = PLATFORM_DATE;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('STORY_NOW', () => {
  it('is noon UTC on 30 June 2026, whatever the zone of the machine', () => {
    expect(new PLATFORM_DATE(STORY_NOW).toISOString()).toBe('2026-06-30T12:00:00.000Z');
  });

  it('dates story data in minutes before it', () => {
    expect(storyMinutesAgo(0)).toBe('2026-06-30T12:00:00.000Z');
    expect(storyMinutesAgo(90)).toBe('2026-06-30T10:30:00.000Z');
  });
});

describe('a story', () => {
  it('starts at STORY_NOW', () => {
    restoreClock = startStoryClock();

    expect(Date.now()).toBe(STORY_NOW);
    expect(new Date().getTime()).toBe(STORY_NOW);
    expect(Date()).toBe(new PLATFORM_DATE(STORY_NOW).toString());
  });

  it('runs on from STORY_NOW as real time passes', () => {
    restoreClock = startStoryClock();
    elapsed += 90_000.6;

    expect(Date.now()).toBe(STORY_NOW + 90_000);
    expect(new Date().toISOString()).toBe('2026-06-30T12:01:30.000Z');
  });

  it('fires a debounce, which waits for the clock to move', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    restoreClock = startStoryClock();
    const fire = vi.fn();
    const debounced = debounce(fire, 200);

    debounced();
    elapsed += 250;
    vi.advanceTimersByTime(250);

    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('leaves a date built from a value as it is', () => {
    restoreClock = startStoryClock();

    expect(new Date(0).getTime()).toBe(0);
    expect(new Date('2020-02-02T02:02:02Z').getTime()).toBe(PLATFORM_DATE.UTC(2020, 1, 2, 2, 2, 2));
    expect(new Date(2020, 1, 2).getTime()).toBe(new PLATFORM_DATE(2020, 1, 2).getTime());
    expect(Date.parse('2020-02-02T02:02:02Z')).toBe(PLATFORM_DATE.parse('2020-02-02T02:02:02Z'));
    expect(Date.UTC(2020, 1, 2)).toBe(PLATFORM_DATE.UTC(2020, 1, 2));
  });

  it('makes dates that are dates', () => {
    restoreClock = startStoryClock();
    class Stamp extends Date {}

    expect(new Date()).toBeInstanceOf(PLATFORM_DATE);
    expect(new PLATFORM_DATE(0)).toBeInstanceOf(Date);
    expect(new Stamp().getTime()).toBe(STORY_NOW);
    expect(new Stamp()).toBeInstanceOf(Stamp);
    expect(Object.prototype.toString.call(new Date())).toBe('[object Date]');
  });
});

describe('parameters.mockdate', () => {
  it('stops the clock at that instant', () => {
    restoreClock = startStoryClock({ mockdate: new PLATFORM_DATE('2024-01-01T08:00:00.000Z') });
    elapsed += 90_000;

    expect(Date.now()).toBe(PLATFORM_DATE.UTC(2024, 0, 1, 8));
    expect(new Date().toISOString()).toBe('2024-01-01T08:00:00.000Z');
  });

  it('takes the instant as a timestamp or an ISO string too', () => {
    restoreClock = startStoryClock({ mockdate: PLATFORM_DATE.UTC(2024, 0, 1) });
    expect(Date.now()).toBe(PLATFORM_DATE.UTC(2024, 0, 1));

    restoreClock = startStoryClock({ mockdate: '2025-05-05T05:05:05.000Z' });
    expect(Date.now()).toBe(PLATFORM_DATE.UTC(2025, 4, 5, 5, 5, 5));
  });

  it('refuses a value that is not a date, and leaves the real clock', () => {
    restoreClock = startStoryClock();

    expect(() => startStoryClock({ mockdate: 'next Tuesday' })).toThrow(
      new TypeError('parameters.mockdate is not a date: next Tuesday')
    );
    expect(Date).toBe(PLATFORM_DATE);
  });
});

describe('parameters.live', () => {
  it('keeps the real clock, even after a story that set one', () => {
    restoreClock = startStoryClock();
    const restoreLive = startStoryClock({ live: true });

    expect(Date).toBe(PLATFORM_DATE);
    restoreLive();
    expect(Date).toBe(PLATFORM_DATE);
  });
});

describe('putting the clock back', () => {
  it('restores the Date there was before the story', () => {
    startStoryClock()();

    expect(Date).toBe(PLATFORM_DATE);
  });

  it('replaces the previous story clock instead of stacking on it', () => {
    startStoryClock({ mockdate: PLATFORM_DATE.UTC(2024, 0, 1) });
    restoreClock = startStoryClock();
    expect(Date.now()).toBe(STORY_NOW);

    restoreClock();
    expect(Date).toBe(PLATFORM_DATE);
  });

  it("does not take away a later story's clock", () => {
    const restoreFirst = startStoryClock({ mockdate: PLATFORM_DATE.UTC(2024, 0, 1) });
    restoreClock = startStoryClock();

    restoreFirst();

    expect(Date.now()).toBe(STORY_NOW);
  });
});
