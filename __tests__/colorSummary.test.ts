// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import {
  colorToCss,
  formatColorValue,
  formatOptionValue,
} from '../src/components/form/engine/readFirst';

/**
 * qorus#646: a compact row summarises a color with the reader `ReqraftColorValue` uses, so the two agree.
 * That reader takes a hex code without its `#`, as the color field does, and a value that only looks like
 * one is not a color: `#zzz` was summarised as "#ZZZ" beside a swatch the browser could not paint, and a
 * channel that is not a finite number as "#NANNANNAN".
 */
describe("the compact row's summary of a color", () => {
  it('is the color, in every shape', () => {
    expect(formatColorValue('abcdef')).toBe('#ABCDEF');
    expect(colorToCss('abcdef')).toBe('#abcdef');
  });

  it('is no color for a value that is not one - not a hex code and a swatch of nothing', () => {
    expect(formatColorValue('#zzz')).toBeUndefined();
    expect(colorToCss('#zzz')).toBeUndefined();
    expect(formatColorValue({ r: Number.NaN, g: 0, b: 0 })).toBeUndefined();
  });

  it('says what a value that is not a color is', () => {
    expect(
      formatOptionValue({ type: 'rgbcolor', value: '#zzz' } as never, { type: 'rgbcolor' } as never)
    ).toBe('Not a color: “#zzz”');
  });
});
