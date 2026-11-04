import { TReqoreHexColor } from '@qoretechnologies/reqore/dist/components/Effect';
import { IReqoreTheme, TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import {
  changeDarkness,
  changeLightness,
  getReadableColor,
  isAchromatic,
} from '@qoretechnologies/reqore/dist/helpers/colors';
import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import { saturate, tint } from 'polished';
import { useCallback } from 'react';
import { getReadableOpacity, getThemeSurfaces } from '../../../../helpers/readableColors';

/** How far the name of a pick-list row whose value cannot be picked is dimmed, at most. */
export const UNAVAILABLE_LABEL_OPACITY = 0.55;

/* the intents a row can carry that reqore draws its text in a tint of */
const TINTED_INTENTS: readonly string[] = ['info', 'success', 'warning', 'danger', 'pending'];

/**
 * The color a pick-list row's text is drawn in. reqore 0.77.2 draws a row's text in a light tint (80% of the way to
 * white, fully saturated) of the row's color - its intent, else the list's own `listMain` - and in the theme's text
 * when that color is a grey.
 */
export const getRowTextColor = (
  theme: IReqoreTheme,
  intent?: TReqoreIntent,
  listMain?: TReqoreHexColor
): string => {
  const color =
    intent && TINTED_INTENTS.includes(intent) ?
      (theme.intents as Record<string, string | undefined> | undefined)?.[intent]
    : listMain;

  return color && !isAchromatic(color as TReqoreHexColor) ?
      saturate(1, tint(0.8, color))
    : getReadableColor(theme);
};

/* what a list's rows are drawn on: its own color when it has one (and a shade darker and lighter), else the theme's */
const rowSurfaces = (theme: IReqoreTheme, listMain?: TReqoreHexColor): string[] =>
  listMain ?
    [changeDarkness(listMain, 0.05), listMain, changeLightness(listMain, 0.05)]
  : getThemeSurfaces(theme);

/**
 * How far the name of a row whose value cannot be picked is dimmed in `theme` (qorus#646):
 * `UNAVAILABLE_LABEL_OPACITY`, or as little less as it takes to still read on the list - the theme's surfaces, or
 * `listMain` for a list drawn in its own color.
 *
 * Only the name is dimmed. The reason the value is refused, printed under it, stays as reqore draws a row's
 * description: dimming the whole row took the reason to 3.1:1, and reqore 0.77.2 fills a row that has an `effect` -
 * a refused row with an intent turned solid, where the reason read worse still.
 */
export const getUnavailableLabelOpacity = (
  theme: IReqoreTheme,
  intent?: TReqoreIntent,
  listMain?: TReqoreHexColor
): number =>
  getReadableOpacity(
    getRowTextColor(theme, intent, listMain),
    rowSurfaces(theme, listMain),
    UNAVAILABLE_LABEL_OPACITY
  );

/** `getUnavailableLabelOpacity` in the current theme, for a row's intent and the list's own color. */
export const useUnavailableLabelOpacity = (): ((
  intent?: TReqoreIntent,
  listMain?: TReqoreHexColor
) => number) => {
  const theme = useReqoreTheme();

  return useCallback(
    (intent?: TReqoreIntent, listMain?: TReqoreHexColor) =>
      getUnavailableLabelOpacity(theme, intent, listMain),
    [theme]
  );
};
