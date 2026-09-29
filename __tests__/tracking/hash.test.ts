import { describe, expect, it } from 'vitest';
import { fnv1a32, hashV2 } from '../../src/tracking/core/hash';

/**
 * Fixed vectors. `fnv1a32` values are the FNV-1a 32-bit reference results; the
 * `hashV2` values were computed independently (Python, FNV-1a with the 16777619
 * multiply in 32-bit arithmetic, `(fnv(str(fnv(seed + value))) % 10000) / 10000`).
 * The same Python implementation's v1 form (`fnv(value + seed) % 1000 / 1000`)
 * reproduces GrowthBook's published v1 cases ('' / 'a' → 0.22, '' / 'b' → 0.077,
 * 'b' / 'a' → 0.946), which anchors the FNV-1a step to GrowthBook's.
 * If any of these change, every visitor's assignment changes: do not "fix" the vectors.
 */
describe('fnv1a32', () => {
  it('matches the FNV-1a reference vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('b')).toBe(3876335077);
    expect(fnv1a32('ba')).toBe(1009493708);
  });
});

describe('hashV2 (GrowthBook hash v2)', () => {
  it.each([
    ['', 'a', 0.0216],
    ['', 'b', 0.9054],
    ['b', 'a', 0.665],
    ['ef', 'd', 0.8601],
    ['asdf', '8952klfjas09ujk', 0.8546],
    ['hero-input', 'kX9aP2vQ7mT1sR4uW8yZ0b', 0.1012],
    ['hero-input', 'visitor-1', 0.6755],
    ['hero-input', 'visitor-2', 0.2992],
    ['other-exp', 'visitor-1', 0.4514],
  ])('hashV2(%j, %j) = %d', (seed, value, expected) => {
    expect(hashV2(seed, value)).toBe(expected);
  });

  it('hashes the decimal string of the first hash (not its bytes)', () => {
    const inner = fnv1a32('hero-input' + 'visitor-1');
    expect(inner).toBe(351688924);
    expect(hashV2('hero-input', 'visitor-1')).toBe((fnv1a32(String(inner)) % 10000) / 10000);
  });

  it('spreads visitors evenly', () => {
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 20000; i++) buckets[Math.floor(hashV2('hero-input', `v${i}`) * 4)]++;
    buckets.forEach((b) => expect(Math.abs(b - 5000)).toBeLessThan(300));
  });
});
