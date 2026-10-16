import { useReqoreTheme } from '@qoretechnologies/reqore/dist/hooks/useTheme';
import { useMemo } from 'react';
import { getReadableTextOpacity, READABLE_TEXT } from '../helpers/readableColors';

/**
 * How faded the theme's text (or an icon drawn in it) can be in this theme and still read: `opacity`, or as
 * little more as it takes (4.5:1 for text, `READABLE_ICON` 3:1 for an icon; qorus#646).
 */
export const useReadableOpacity = (
  opacity: number,
  minContrast: number = READABLE_TEXT
): number => {
  const theme = useReqoreTheme();

  return useMemo(
    () => getReadableTextOpacity(theme, opacity, minContrast),
    [theme, opacity, minContrast]
  );
};
