import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import {
  changeDarkness,
  changeLightness,
  getMainBackgroundColor,
  getReadableColor,
} from '@qoretechnologies/reqore/dist/helpers/colors';
import { getLuminance, mix, rgba } from 'polished';

/**
 * Colors that stand out from what they are drawn on (WCAG 2.1 AA, qorus#646): 4.5:1 for text, 3:1 for icons and
 * large text. Reqore has these from qoretechnologies/reqore#708 on (`getReadableAccentColorOn`, `getReadableAlpha`);
 * until reqraft builds on that release, the read-first form picks its own colors with these.
 */
export const READABLE_TEXT = 4.5;
export const READABLE_ICON = 3;

/* A browser blends a color a shade differently (alphas in 255ths, its own rounding): a color that just reaches the
   ratio here can fall a hair short on the page, so these aim a little past it. */
export const READABLE_MARGIN = 0.1;

/** The WCAG contrast ratio of two opaque colors, unrounded (polished's getContrast rounds 4.495 up to 4.5). */
export const contrastRatio = (a: string, b: string): number => {
  const [light, dark] = [getLuminance(a), getLuminance(b)].sort((x, y) => y - x);

  return (light + 0.05) / (dark + 0.05);
};

/** `color` at `alpha` drawn over the opaque `background`. */
const drawnAt = (color: string, alpha: number, background: string): string =>
  mix(alpha, color, background);

/* how `color` stands out from the least contrasting of `backgrounds`, drawn on each at `alpha` */
const worst = (color: string, backgrounds: string[], alpha: number = 1): number =>
  Math.min(
    ...backgrounds.map((background) => contrastRatio(drawnAt(color, alpha, background), background))
  );

/**
 * `color` in the shade of it that stands out by `minContrast` from every one of `backgrounds` (opaque): the color
 * itself when it does, else moved toward white or black - whichever stands out more from the worst of them - only
 * as far as it takes. The hue is kept: a warning stays amber, only lighter on a dark surface. `alpha` is how faded
 * it is drawn: a mark that something else draws at 70% (reqore's panel and button icons) needs a stronger shade.
 */
export const getReadableShade = (
  color: string,
  backgrounds: string[],
  minContrast: number = READABLE_TEXT,
  alpha: number = 1
): string => {
  const target = minContrast + READABLE_MARGIN;

  if (worst(color, backgrounds, alpha) >= target) {
    return color;
  }

  const toward =
    worst('#ffffff', backgrounds, alpha) >= worst('#000000', backgrounds, alpha) ?
      '#ffffff'
    : '#000000';
  // the least of `toward` mixed in that reaches the ratio: halve the range until it is a hundredth wide
  let low = 0;
  let high = 1;

  while (high - low > 0.01) {
    const middle = (low + high) / 2;

    if (worst(mix(middle, toward, color), backgrounds, alpha) >= target) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return mix(high, toward, color);
};

/**
 * How faded `color` can be drawn on every one of `backgrounds` (opaque) and still stand out by `minContrast`:
 * `alpha`, or as little more as it takes (1 when even that does not).
 */
export const getReadableOpacity = (
  color: string,
  backgrounds: string[],
  alpha: number,
  minContrast: number = READABLE_TEXT
): number => {
  const target = minContrast + READABLE_MARGIN;
  const reads = (at: number) =>
    backgrounds.every(
      (background) => contrastRatio(drawnAt(color, at, background), background) >= target
    );

  if (alpha >= 1 || reads(alpha)) {
    return alpha;
  }

  if (!reads(1)) {
    return 1;
  }

  let low = alpha;
  let high = 1;

  while (high - low > 0.005) {
    const middle = (low + high) / 2;

    if (reads(middle)) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return Math.min(1, Math.ceil(high * 100) / 100);
};

/** A translucent `color` (rgba) at `alpha` that still stands out from `backgrounds` (see `getReadableOpacity`). */
export const getReadableFaded = (
  color: string,
  backgrounds: string[],
  alpha: number,
  minContrast: number = READABLE_TEXT
): string => rgba(color, getReadableOpacity(color, backgrounds, alpha, minContrast));

/**
 * What reqraft's components are drawn on in `theme`: its background, and a shade darker and lighter, as the page
 * or a panel around them may be.
 */
export const getThemeSurfaces = (theme: IReqoreTheme): string[] => {
  const page = getMainBackgroundColor(theme);

  return [changeDarkness(page, 0.05), page, changeLightness(page, 0.05)];
};

/**
 * How faded the theme's text can be drawn (`opacity`, a softer note) and still read on what it is drawn on in
 * the theme (`getThemeSurfaces`): `opacity`, or as little more as it takes. An icon needs 3:1 (`READABLE_ICON`).
 */
export const getReadableTextOpacity = (
  theme: IReqoreTheme,
  opacity: number,
  minContrast: number = READABLE_TEXT
): number =>
  getReadableOpacity(getReadableColor(theme), getThemeSurfaces(theme), opacity, minContrast);
