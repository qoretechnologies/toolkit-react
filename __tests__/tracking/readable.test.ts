import { DEFAULT_THEME } from '@qoretechnologies/reqore/dist/constants/theme';
import { buildTheme } from '@qoretechnologies/reqore/dist/helpers/colors';
import { mix } from 'polished';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  READABLE_ICON,
  READABLE_TEXT,
  readableShade,
  themeSurfaces,
} from '../../src/tracking/ui/readable';

/* The A/B test card's quiet buttons on a light theme: a minimal reqore button is washed with its intent (20% of it
   over the card) and draws its icon at 70%. "Pause" in warning:darken:2 (#8a521b) was 4.1:1 on its wash, its icon
   2.6:1 (qorus#646). */
const LIGHT = buildTheme({ ...DEFAULT_THEME, main: '#e8e8e8' } as never);
const washesOf = (color: string) => themeSurfaces(LIGHT).map((surface) => mix(0.2, color, surface));
const least = (color: string, backgrounds: string[], alpha = 1) =>
  Math.min(...backgrounds.map((b) => contrastRatio(mix(alpha, color, b), b)));

describe("the A/B test card's own readable shades", () => {
  it('fell short with the shade it used to pick', () => {
    const washes = washesOf(LIGHT.intents.warning as string);

    expect(least('#8a521b', washes)).toBeLessThan(READABLE_TEXT);
    expect(least('#8a521b', washes, 0.7)).toBeLessThan(READABLE_ICON);
  });

  it.each(['success', 'warning', 'danger', 'info'] as const)(
    'reads a %s button and its icon on its own wash',
    (intent) => {
      const color = LIGHT.intents[intent] as string;
      const washes = washesOf(color);
      const text = readableShade(color, washes);
      const icon = readableShade(color, washes, READABLE_ICON, 0.7);

      expect(least(text, washes)).toBeGreaterThanOrEqual(READABLE_TEXT);
      expect(least(icon, washes, 0.7)).toBeGreaterThanOrEqual(READABLE_ICON);
    }
  );

  it('keeps a color that already reads, and its hue when it has to move', () => {
    expect(readableShade('#000000', ['#ffffff'])).toBe('#000000');

    // an amber on a light wash is darkened toward black, not turned grey or another hue
    const shade = readableShade('#d68a2f', ['#f3e3d0']);
    expect(shade).not.toBe('#d68a2f');
    expect(least(shade, ['#f3e3d0'])).toBeGreaterThanOrEqual(READABLE_TEXT);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(shade.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });
});
