import { TReqoreHexColor } from '@qoretechnologies/reqore/dist/components/Effect';
import { TReqoreIntent } from '@qoretechnologies/reqore/dist/constants/theme';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import { useMemo } from 'react';
import { getReadableShade, getThemeSurfaces, READABLE_TEXT } from '../helpers/readableColors';

/**
 * The theme's `intent` in the shade of it that reads on what reqraft is drawn on in the theme (4.5:1 for text,
 * `READABLE_ICON` 3:1 for an icon; qorus#646): for a color reqraft hands reqore itself - an icon's `color`, an
 * effect's - which reqore draws as it is given. `alpha` is how faded reqore draws it (a panel's title icon at 70%).
 */
export const useReadableIntentShade = (
  intent: TReqoreIntent,
  minContrast: number = READABLE_TEXT,
  alpha: number = 1
): TReqoreHexColor => {
  const theme = useReqoreTheme();

  return useMemo(
    () =>
      getReadableShade(
        (theme.intents as Record<string, string | undefined> | undefined)?.[intent] ??
          getReadableColor(theme),
        getThemeSurfaces(theme),
        minContrast,
        alpha
      ) as TReqoreHexColor,
    [theme, intent, minContrast, alpha]
  );
};
