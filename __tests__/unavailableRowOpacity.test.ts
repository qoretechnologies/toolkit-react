import { DEFAULT_THEME, IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import { buildTheme } from '@qoretechnologies/reqore/dist/helpers/colors';
import { mix } from 'polished';
import { describe, expect, it } from 'vitest';
import {
  getRowTextColor,
  getUnavailableLabelOpacity,
  UNAVAILABLE_LABEL_OPACITY,
} from '../src/components/form/fields/select/unavailableRow';
import {
  contrastRatio,
  getThemeSurfaces,
  READABLE_MARGIN,
  READABLE_TEXT,
} from '../src/helpers/readableColors';

/* The name of a refused value's row in a pick list is dimmed, as far as it still reads on the list (qorus#646). */
const THEMES: Record<string, IReqoreTheme> = {
  dark: buildTheme(DEFAULT_THEME as never),
  light: buildTheme({ ...DEFAULT_THEME, main: '#ffffff' } as never),
  'mid grey': buildTheme({ ...DEFAULT_THEME, main: '#5a5a5a' } as never),
};
const INTENTS = [undefined, 'info', 'success', 'warning', 'danger', 'pending'] as const;

/* the least contrast of a row's name, drawn at `opacity`, on any surface of the theme */
const nameContrast = (theme: IReqoreTheme, intent: (typeof INTENTS)[number], opacity: number) =>
  Math.min(
    ...getThemeSurfaces(theme).map((surface) =>
      contrastRatio(mix(opacity, getRowTextColor(theme, intent), surface), surface)
    )
  );

describe("how far a refused row's name is dimmed", () => {
  for (const [name, theme] of Object.entries(THEMES)) {
    it.each(INTENTS)(
      `leaves it readable in the ${name} theme, on a row with intent %s`,
      (intent) => {
        const opacity = getUnavailableLabelOpacity(theme, intent);

        expect(opacity).toBeGreaterThanOrEqual(UNAVAILABLE_LABEL_OPACITY);
        expect(opacity).toBeLessThanOrEqual(1);
        if (opacity < 1) {
          expect(nameContrast(theme, intent, opacity)).toBeGreaterThanOrEqual(READABLE_TEXT);
        }
      }
    );
  }

  it('dims as far as it can: two hundredths more and the name no longer reads', () => {
    const theme = THEMES.dark;

    for (const intent of INTENTS) {
      const opacity = getUnavailableLabelOpacity(theme, intent);

      // 0.55 left a plain name at 4.1:1 in the default theme, a danger one lower still
      expect(nameContrast(theme, intent, UNAVAILABLE_LABEL_OPACITY)).toBeLessThan(READABLE_TEXT);
      /* aimed a hair past 4.5:1 (a browser blends a shade differently), and found to within half a hundredth,
         rounded up to the next one */
      expect(nameContrast(theme, intent, opacity - 0.02)).toBeLessThan(
        READABLE_TEXT + READABLE_MARGIN
      );
    }
  });

  it("reads a row with an intent in reqore's tint of it, and a plain row in the theme's text", () => {
    const theme = THEMES.dark;

    expect(getRowTextColor(theme)).toBe(getRowTextColor(theme, 'muted'));
    expect(new Set(INTENTS.map((intent) => getRowTextColor(theme, intent))).size).toBe(
      INTENTS.length
    );
    // the danger tint is darker than the plain text, so its name may be dimmed less
    expect(getUnavailableLabelOpacity(theme, 'danger')).toBeGreaterThan(
      getUnavailableLabelOpacity(theme)
    );
  });

  it('never asks for more than a fully drawn name', () => {
    // a mid-grey page, where a tinted name falls short even when drawn in full
    const theme = buildTheme({ ...DEFAULT_THEME, main: '#8a8a8a' } as never);

    for (const intent of INTENTS) {
      expect(getUnavailableLabelOpacity(theme, intent)).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...INTENTS.map((intent) => getUnavailableLabelOpacity(theme, intent)))).toBe(1);
  });

  it('reads a row on a list drawn in its own color in the tint of that color, on that color', () => {
    const theme = THEMES.dark;
    // the anchored list of choices is drawn in a near-black blue; its rows' text is a light blue
    const listMain = '#010811';
    const text = getRowTextColor(theme, undefined, listMain);

    expect(text).not.toBe(getRowTextColor(theme));
    const opacity = getUnavailableLabelOpacity(theme, undefined, listMain);
    // the theme's own text would have allowed a fainter name than the list's tint does
    expect(opacity).toBeGreaterThan(getUnavailableLabelOpacity(theme));
    for (const surface of [listMain, '#01060d']) {
      expect(contrastRatio(mix(opacity, text, surface), surface)).toBeGreaterThanOrEqual(
        READABLE_TEXT
      );
    }
    // a row with its own intent is drawn in that intent's tint, whatever the list's color
    expect(getRowTextColor(theme, 'danger', listMain)).toBe(getRowTextColor(theme, 'danger'));
    // a grey list draws its rows in the theme's text
    expect(getRowTextColor(theme, undefined, '#1a1a1a')).toBe(getRowTextColor(theme));
  });
});
