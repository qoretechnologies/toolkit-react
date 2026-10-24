// Copyright 2026 Qore Technologies, s.r.o.
// What time it is in a story.
//
// Story data is dated from a fixed instant, and components write dates relative
// to the clock ("3 hours ago"). Against the real clock the same story read
// "1 month ago" in one build and "3 months ago" a few weeks later, so its
// snapshots changed with nobody changing anything. Every story therefore starts
// at `STORY_NOW` (`.storybook/preview.tsx` calls `startStoryClock` before each
// story), and its data is dated from the same instant with `storyMinutesAgo`.
//
// The clock runs on from `STORY_NOW` in real time. Debounces, throttles and
// timeouts measure time passing, and under a clock that stands still they never
// fire: lodash's `debounce` waits for `Date.now()` to move. A story is captured
// within seconds of its start, well inside the minute the shortest "… ago"
// takes to change.
//
// Two kinds of story leave the running clock:
// - `parameters.mockdate` stops the clock at that instant, for a story whose
//   every reading must be identical (log lines stamped to the millisecond).
//   It is the parameter reqore's stories use, and qlip's capture copes with it.
// - `parameters.live` stories keep the real clock: their data comes from a
//   real server and is dated by it.
//
// Time goes back to `STORY_NOW` at every story, so whatever a page keeps from one
// story to the next with a timestamp must not outlive its freshness: the preview
// drops the query cache's stale answers when a story ends, or the next story would
// read them as fetched in the future.
//
// Only stories change the clock. Components read the platform's `Date` as they
// always do, and in an application that is the real one.

/** The instant every story starts at: 30 June 2026, 12:00 UTC. */
export const STORY_NOW: number = Date.UTC(2026, 5, 30, 12, 0, 0);

/** An ISO timestamp `minutes` before `STORY_NOW`, for dating story data. */
export const storyMinutesAgo = (minutes: number): string =>
  new Date(STORY_NOW - minutes * 60_000).toISOString();

export interface IStoryClockParameters {
  /** Stop the clock at this instant instead of running it from `STORY_NOW`. */
  mockdate?: Date | number | string;
  /** The story talks to a real server: keep the real clock. */
  live?: boolean;
}

/* The clock a story installed, so the next one replaces it rather than
 * stacking on top of it. */
let installed: { storyDate: DateConstructor; previous: DateConstructor } | undefined;

const restore = (): void => {
  if (installed && globalThis.Date === installed.storyDate) {
    globalThis.Date = installed.previous;
  }
  installed = undefined;
};

/**
 * Sets the clock for the story about to render and returns the function that
 * puts the previous one back.
 *
 * The story's `Date` is the platform's own behind a proxy: only the current time
 * changes (`Date.now()`, `new Date()` and `Date()`); a `Date` built from a value,
 * `Date.parse`, `Date.UTC`, `instanceof Date` and subclasses behave as ever.
 */
export const startStoryClock = ({ mockdate, live }: IStoryClockParameters = {}): (() => void) => {
  restore();
  if (live) {
    return () => undefined;
  }

  const previous = globalThis.Date;
  const start = mockdate === undefined ? STORY_NOW : new previous(mockdate).getTime();
  if (Number.isNaN(start)) {
    throw new TypeError(`parameters.mockdate is not a date: ${String(mockdate)}`);
  }

  const startedAt = performance.now();
  const now =
    mockdate === undefined ? () => start + Math.floor(performance.now() - startedAt) : () => start;

  const storyDate = new Proxy(previous, {
    construct: (target, args, newTarget) =>
      Reflect.construct(target, args.length ? args : [now()], newTarget),
    // `Date()` called without `new` is a string of the current time.
    apply: () => new previous(now()).toString(),
    get: (target, property, receiver) =>
      property === 'now' ? now : Reflect.get(target, property, receiver),
  });

  installed = { storyDate, previous };
  globalThis.Date = storyDate;
  return () => {
    if (installed?.storyDate === storyDate) {
      restore();
    }
  };
};
