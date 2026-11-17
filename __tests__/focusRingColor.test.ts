// Copyright 2026 Qore Technologies, s.r.o.
import { DEFAULT_THEME } from '@qoretechnologies/reqore/dist/constants/theme';
import { getContrast } from 'polished';
import { describe, expect, it } from 'vitest';
import { getFocusRingColor } from '../src/helpers/readableColors';

/** A translucent ring blended over the surface it is drawn on. */
const over = (ring: string, surface: string) => {
  const [r, g, b, a] = ring.match(/[\d.]+/g)!.map(Number);
  const [sr, sg, sb] = (surface.match(/[0-9a-f]{2}/gi) ?? []).map((hex) => parseInt(hex, 16));
  const mix = (top: number, bottom: number) => Math.round(top * a + bottom * (1 - a));
  return `rgb(${mix(r, sr)}, ${mix(g, sg)}, ${mix(b, sb)})`;
};

/**
 * Reqraft's focus rings are Reqore's one ring (instruction-files decision 030): the text color at
 * 0.7, never an intent. A form row drew the warning amber, so a good row read as a fault.
 */
describe('the focus ring', () => {
  it.each([
    ['the default theme', DEFAULT_THEME.main],
    ['a calm near-black surface', '#141418'],
    ['a light surface', '#f4f4f6'],
  ])('stands at least 3:1 against %s, at 0.7 of the text color', (_, main) => {
    const ring = getFocusRingColor({ ...DEFAULT_THEME, main: main as `#${string}` });

    expect(ring).toMatch(/,\s*0\.7\)$/);
    expect(getContrast(over(ring, main), main)).toBeGreaterThanOrEqual(3);
  });
});
