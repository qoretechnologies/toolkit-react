import { describe, expect, it } from 'vitest';
import { assign, bucketRanges, parsePreview, pathMatches } from '../../src/tracking/core/experiments';
import type { IExperimentDefinition } from '../../src/tracking/core/types';

const HERO: IExperimentDefinition = {
  key: 'hero-input',
  variants: [
    { key: 'a', weight: 0.5, control: true },
    { key: 'b', weight: 0.5 },
  ],
  traffic: 1,
  targeting: { paths: ['/'] },
  trigger: { section: 'hero' },
};
const home = { path: '/' };

describe('bucketRanges', () => {
  it('lays variants out by weight, each shortened by the traffic share', () => {
    expect(bucketRanges([0.5, 0.5], 1)).toEqual([
      [0, 0.5],
      [0.5, 1],
    ]);
    expect(bucketRanges([0.5, 0.5], 0.5)).toEqual([
      [0, 0.25],
      [0.5, 0.75],
    ]);
  });

  it('normalises weights that do not add up to 1', () => {
    expect(bucketRanges([1, 3], 1)).toEqual([
      [0, 0.25],
      [0.25, 1],
    ]);
    expect(bucketRanges([0, 0], 1)).toEqual([
      [0, 0.5],
      [0.5, 1],
    ]);
  });
});

describe('assign', () => {
  it('uses the vectors: visitor-1 (n=0.6755) → b, visitor-2 (n=0.2992) → a', () => {
    expect(assign(HERO, 'visitor-1', home)).toMatchObject({ variant: 'b', enrolled: true, reason: 'assigned', trigger: 'hero' });
    expect(assign(HERO, 'visitor-2', home)).toMatchObject({ variant: 'a', enrolled: true, reason: 'assigned' });
  });

  it('is deterministic', () => {
    for (let i = 0; i < 50; i++) expect(assign(HERO, `v${i}`, home).variant).toBe(assign(HERO, `v${i}`, home).variant);
  });

  it('splits by weight', () => {
    let b = 0;
    for (let i = 0; i < 10000; i++) if (assign(HERO, `v${i}`, home).variant === 'b') b++;
    expect(Math.abs(b - 5000)).toBeLessThan(250);
    const skewed = { ...HERO, variants: [{ key: 'a', weight: 0.8, control: true }, { key: 'b', weight: 0.2 }] };
    b = 0;
    for (let i = 0; i < 10000; i++) if (assign(skewed, `v${i}`, home).variant === 'b') b++;
    expect(Math.abs(b - 2000)).toBeLessThan(250);
  });

  it('enrols only the traffic share; the rest get the control without exposure', () => {
    const half = { ...HERO, traffic: 0.5 };
    let enrolled = 0;
    for (let i = 0; i < 10000; i++) {
      const a = assign(half, `v${i}`, home);
      if (a.enrolled) enrolled++;
      else expect(a).toMatchObject({ variant: 'a', reason: 'not-enrolled' });
    }
    expect(Math.abs(enrolled - 5000)).toBeLessThan(250);
    expect(assign({ ...HERO, traffic: 0 }, 'visitor-1', home)).toMatchObject({ enrolled: false, reason: 'not-enrolled' });
  });

  it('never moves an enrolled visitor to another variant when traffic grows', () => {
    for (let i = 0; i < 2000; i++) {
      const low = assign({ ...HERO, traffic: 0.3 }, `v${i}`, home);
      if (low.enrolled) expect(assign(HERO, `v${i}`, home).variant).toBe(low.variant);
    }
  });

  it('serves the control without a vid, and outside the targeted paths', () => {
    expect(assign(HERO, null, home)).toMatchObject({ variant: 'a', enrolled: false, reason: 'no-consent' });
    expect(assign(HERO, 'visitor-1', { path: '/pricing' })).toMatchObject({ variant: 'a', enrolled: false, reason: 'not-targeted' });
  });

  it('respects device and language targeting', () => {
    const phones = { ...HERO, targeting: { paths: null, device: 'mobile', lang: 'de' } };
    expect(assign(phones, 'visitor-1', { path: '/', device: 'desktop', lang: 'de-DE' }).reason).toBe('not-targeted');
    expect(assign(phones, 'visitor-1', { path: '/', device: 'mobile', lang: 'en-US' }).reason).toBe('not-targeted');
    expect(assign(phones, 'visitor-1', { path: '/', device: 'mobile', lang: 'de-AT' }).reason).toBe('assigned');
  });

  it('takes the control from the `control` flag, not the order', () => {
    const def = { ...HERO, traffic: 0, variants: [{ key: 'x', weight: 0.5 }, { key: 'y', weight: 0.5, control: true }] };
    expect(assign(def, 'visitor-1', home).variant).toBe('y');
  });
});

describe('pathMatches', () => {
  it('matches exact paths and trailing-* prefixes', () => {
    expect(pathMatches(['/'], '/')).toBe(true);
    expect(pathMatches(['/'], '/pricing')).toBe(false);
    expect(pathMatches(['/pricing'], '/pricing/')).toBe(true);
    expect(pathMatches(['/blog/*'], '/blog/some-post')).toBe(true);
    expect(pathMatches(['/blog/*'], '/pricing')).toBe(false);
    expect(pathMatches(null, '/anything')).toBe(true);
    expect(pathMatches([], '/anything')).toBe(true);
  });
});

describe('parsePreview', () => {
  it('reads ?qa_variant=key:variant pairs', () => {
    expect(parsePreview('?qa_variant=hero-input:b')).toEqual({ 'hero-input': 'b' });
    expect(parsePreview('?x=1&qa_variant=hero-input:b,other:a')).toEqual({ 'hero-input': 'b', other: 'a' });
  });

  it('clears with `clear`, ignores junk, returns null when absent', () => {
    expect(parsePreview('?qa_variant=clear')).toEqual({});
    expect(parsePreview('?qa_variant=nocolon,<script>:x')).toEqual({});
    expect(parsePreview('?utm_source=x')).toBeNull();
  });
});
