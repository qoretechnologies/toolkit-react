import { describe, expect, it } from 'vitest';
import { EngagementClock } from '../../src/tracking/core/engagement';
import { effectiveRatio, SectionClock } from '../../src/tracking/core/sections';

const T0 = 1_000_000;

describe('SectionClock', () => {
  it('marks a section seen after 1 s at >= 50%, with first_seen_ms from the page view start', () => {
    const c = new SectionClock(T0);
    c.update('hero', 0.8, T0 + 200);
    c.tick(T0 + 1100);
    expect(c.isSeen('hero')).toBe(false);
    c.tick(T0 + 1200);
    expect(c.isSeen('hero')).toBe(true);
    expect(c.summary(T0 + 3200)).toEqual([{ id: 'hero', visible_ms: 3000, seen: true, first_seen_ms: 200 }]);
  });

  it('does not count 0.9 s, or a stretch below 50%', () => {
    const c = new SectionClock(T0);
    c.update('a', 0.6, T0);
    c.update('a', 0.4, T0 + 900);
    c.update('b', 0.49, T0);
    const s = c.summary(T0 + 5000);
    expect(s.find((x) => x.id === 'a')).toMatchObject({ seen: false, first_seen_ms: null, visible_ms: 5000 });
    expect(s.find((x) => x.id === 'b')).toMatchObject({ seen: false, visible_ms: 5000 });
  });

  it('keeps one stretch while the ratio moves around above 50%', () => {
    const c = new SectionClock(T0);
    c.update('a', 0.55, T0);
    c.update('a', 0.9, T0 + 400);
    c.update('a', 0.6, T0 + 800);
    c.tick(T0 + 1000);
    expect(c.isSeen('a')).toBe(true);
  });

  it('stops the clock while the tab is hidden', () => {
    const c = new SectionClock(T0);
    c.update('a', 1, T0);
    c.setTabVisible(false, T0 + 500);
    c.tick(T0 + 5000);
    expect(c.isSeen('a')).toBe(false);
    c.setTabVisible(true, T0 + 10_000);
    c.tick(T0 + 11_000);
    expect(c.isSeen('a')).toBe(true);
    expect(c.summary(T0 + 11_000)[0]).toMatchObject({ visible_ms: 1500, first_seen_ms: 10_000 });
  });

  it('tells listeners once, and reports the section most on screen as current', () => {
    const c = new SectionClock(T0);
    const seen: string[] = [];
    c.onSeen((id) => seen.push(id));
    c.update('hero', 0.3, T0);
    c.update('features', 0.7, T0);
    c.tick(T0 + 1000);
    c.tick(T0 + 2000);
    expect(seen).toEqual(['features']);
    expect(c.current()).toBe('features');
  });

  it('keeps registered sections that were never on screen, and hides synthetic ones', () => {
    const c = new SectionClock(T0);
    c.register('pricing');
    c.register('experiment:x', false);
    expect(c.summary(T0 + 10).map((s) => s.id)).toEqual(['pricing']);
  });

  it('starts from zero at a new page view', () => {
    const c = new SectionClock(T0);
    c.update('hero', 1, T0);
    c.tick(T0 + 2000);
    c.reset(T0 + 3000);
    expect(c.isSeen('hero')).toBe(false);
    expect(c.summary(T0 + 3000)).toEqual([{ id: 'hero', visible_ms: 0, seen: false, first_seen_ms: null }]);
  });
});

describe('effectiveRatio', () => {
  it('counts a section taller than the screen that fills most of it', () => {
    // 2400px section, 900px viewport fully covered: only 37.5% of the section, 100% of the screen.
    expect(effectiveRatio(0.375, 900, 900)).toBe(1);
    expect(effectiveRatio(0.2, 200, 900)).toBeCloseTo(0.222, 2);
    expect(effectiveRatio(0, 0, 900)).toBe(0);
  });
});

describe('EngagementClock', () => {
  it('counts time within the window after each interaction, only while visible', () => {
    const e = new EngagementClock(10_000);
    e.activity(T0);
    e.activity(T0 + 4000); // extends to T0 + 14000
    expect(e.total(T0 + 30_000)).toBe(14_000);
    e.activity(T0 + 40_000);
    e.setTabVisible(false, T0 + 43_000);
    e.activity(T0 + 44_000); // hidden: ignored
    expect(e.total(T0 + 60_000)).toBe(17_000);
    e.reset();
    expect(e.total(T0 + 60_000)).toBe(0);
  });
});
