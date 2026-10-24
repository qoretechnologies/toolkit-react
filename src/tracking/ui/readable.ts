import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import {
  changeDarkness,
  changeLightness,
  getMainBackgroundColor,
} from '@qoretechnologies/reqore/dist/helpers/colors';
import { getLuminance, mix } from 'polished';

/*
 * Colors the A/B test UI picks itself, in a shade that reads (WCAG 2.1 AA, qorus#646): 4.5:1 for text, 3:1 for an
 * icon. The tracking module ships on its own and imports nothing of the rest of reqraft, so this is its own copy of
 * what reqraft's `helpers/readableColors` does.
 */
export const READABLE_TEXT = 4.5;
export const READABLE_ICON = 3;

/* aimed a hair past the ratio: a browser blends a shade a little differently */
const MARGIN = 0.1;

/** The WCAG contrast ratio of two opaque colors, unrounded. */
export const contrastRatio = (a: string, b: string): number => {
  const [light, dark] = [getLuminance(a), getLuminance(b)].sort((x, y) => y - x);

  return (light + 0.05) / (dark + 0.05);
};

/* how `color`, drawn at `alpha`, stands out from the least contrasting of `backgrounds` */
const worst = (color: string, backgrounds: string[], alpha: number): number =>
  Math.min(...backgrounds.map((b) => contrastRatio(mix(alpha, color, b), b)));

/**
 * `color` in the shade of it that stands out by `minContrast` from every one of `backgrounds` (opaque) when drawn
 * at `alpha`: the color itself when it does, else moved toward white or black - whichever stands out more - only as
 * far as it takes. The hue is kept.
 */
export const readableShade = (
  color: string,
  backgrounds: string[],
  minContrast: number = READABLE_TEXT,
  alpha: number = 1
): string => {
  const target = minContrast + MARGIN;

  if (worst(color, backgrounds, alpha) >= target) {
    return color;
  }

  const toward =
    worst('#ffffff', backgrounds, alpha) >= worst('#000000', backgrounds, alpha) ?
      '#ffffff'
    : '#000000';
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

/** What the card is drawn on in `theme`: its background, and a shade darker and lighter. */
export const themeSurfaces = (theme: IReqoreTheme): string[] => {
  const page = getMainBackgroundColor(theme);

  return [changeDarkness(page, 0.05), page, changeLightness(page, 0.05)];
};
