import { DEFAULT_THEME } from '@qoretechnologies/reqore/dist/constants/theme';
import { buildTheme, getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import {
  contrastRatio,
  getReadableOpacity,
  getReadableShade,
  getReadableTextOpacity,
  getThemeSurfaces,
  READABLE_ICON,
  READABLE_TEXT,
} from '../src/helpers/readableColors';
import { mix } from 'polished';

/* The read-first form's own colors stand out from what they are drawn on (qorus#646: the warning and success
   intents read 4.0-4.1:1 as text on the dark page, a danger reason 2.7:1 on the attention box). */
describe('readable colors', () => {
  test('a shade of the color that reads: the color itself where it does', () => {
    expect(getReadableShade('#ffdf34', ['#0f0f0f'])).toBe('#ffdf34');

    for (const [color, backgrounds] of [
      ['#9f6919', ['#0f0f0f', '#121212']],
      ['#507f2a', ['#0f0f0f', '#2a251b']],
      ['#b22e24', ['#201a10', '#4c3513']],
      ['#3b8eea', ['#f4f4f4']],
    ] as [string, string[]][]) {
      const shade = getReadableShade(color, backgrounds);

      for (const background of backgrounds) {
        expect(contrastRatio(shade, background)).toBeGreaterThanOrEqual(READABLE_TEXT);
      }
      expect(shade).not.toBe(color);
    }
  });

  test('a faded color as faded as it can be and still read', () => {
    // white at 30% on near-black reads as an icon; at 10% it does not, so it is raised
    expect(getReadableOpacity('#ffffff', ['#0f0f0f'], 0.5, READABLE_ICON)).toBe(0.5);

    const opacity = getReadableOpacity('#f2f2f2', ['#0f0f0f', '#171c12'], 0.45);

    expect(opacity).toBeGreaterThan(0.45);
    for (const background of ['#0f0f0f', '#171c12']) {
      expect(contrastRatio(mix(opacity, '#f2f2f2', background), background)).toBeGreaterThanOrEqual(
        READABLE_TEXT
      );
    }
  });

  test('drawn whole when nothing less reads', () => {
    expect(getReadableOpacity('#222222', ['#0f0f0f'], 0.3)).toBe(1);
  });

  test("the theme's text, faded, as faint as it still reads in the theme", () => {
    for (const main of ['#333333', '#f4f4f4', '#1b2f45']) {
      const theme = buildTheme({ ...DEFAULT_THEME, main } as never);
      const text = getReadableColor(theme);

      for (const [asked, minContrast] of [
        [0.3, READABLE_TEXT],
        [0.3, READABLE_ICON],
      ] as [number, number][]) {
        const opacity = getReadableTextOpacity(theme, asked, minContrast);

        expect(opacity).toBeGreaterThanOrEqual(asked);
        for (const surface of getThemeSurfaces(theme)) {
          expect(contrastRatio(mix(opacity, text, surface), surface)).toBeGreaterThanOrEqual(
            minContrast
          );
        }
      }
    }
  });

  /* a mark something else draws faded (reqore draws a panel's title icon and a button's icon at 70%): an invalid
     option's danger mark at 70% read 2.9:1, a warning button's icon on its wash 2.6:1 */
  test('a shade of the color that reads where it is drawn faded', () => {
    const cases: [string, string[], number, number][] = [
      ['#a82a2a', ['#070707', '#0f0f0f', '#1a1a1a'], READABLE_ICON, 0.7],
      ['#a66321', ['#dccec1', '#e8e8e8'], READABLE_ICON, 0.7],
      ['#0776cb', ['#0f0f0f'], READABLE_TEXT, 0.8],
    ];

    for (const [color, backgrounds, minContrast, alpha] of cases) {
      // the color itself, drawn that faded, falls short on at least one of them
      expect(
        Math.min(...backgrounds.map((b) => contrastRatio(mix(alpha, color, b), b)))
      ).toBeLessThan(minContrast);

      const shade = getReadableShade(color, backgrounds, minContrast, alpha);

      for (const background of backgrounds) {
        expect(contrastRatio(mix(alpha, shade, background), background)).toBeGreaterThanOrEqual(
          minContrast
        );
      }
      // and a stronger shade than it needs when drawn in full
      expect(shade).not.toBe(getReadableShade(color, backgrounds, minContrast));
    }
  });

  test('a shade drawn in full is the same as one drawn at alpha 1', () => {
    expect(getReadableShade('#a82a2a', ['#0f0f0f'], READABLE_ICON, 1)).toBe(
      getReadableShade('#a82a2a', ['#0f0f0f'], READABLE_ICON)
    );
    expect(getReadableShade('#ffdf34', ['#0f0f0f'], READABLE_TEXT, 0.9)).toBe('#ffdf34');
  });
});
