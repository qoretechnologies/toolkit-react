import { darken, lighten, readableColor } from 'polished';
import { Colors } from '../constants/colors';
import { IReqoreTheme } from '../constants/theme';

export const getReadableColor: (
  from: string,
  ifLight?: string,
  ifDark?: string,
  dimmed?: boolean
) => string = (from, ifLight, ifDark, dimmed) => {
  const returnIfLight = ifLight || lighten(dimmed ? 0.2 : 0, Colors.DARK);
  const returnIfDark = ifDark || darken(dimmed ? 0.1 : 0, Colors.LIGHT);

  return readableColor(from, returnIfLight, returnIfDark, false);
};

export const shouldDarken = (mainColor: string) => {
  const contrast = getColorByBgColor(mainColor);

  return contrast === '#000000';
};

export const getMainColor: (
  theme: IReqoreTheme,
  component: string
) => string = (theme, component) => theme[component]?.main || theme.main;

export const changeLightness: (color: string, lightness: number) => string = (
  color,
  lightness
) =>
  color
    ? shouldDarken(color)
      ? darken(lightness, color)
      : lighten(lightness, color)
    : undefined;

export const changeDarkness: (color: string, lightness: number) => string = (
  color,
  lightness
) =>
  color
    ? shouldDarken(color)
      ? lighten(lightness, color)
      : darken(lightness, color)
    : undefined;

export const getColorByBgColor = (bgColor) => {
  if (!bgColor) {
    return '';
  }
  return parseInt(bgColor.replace('#', ''), 16) > 0xffffff / 2
    ? '#000000'
    : '#ffffff';
};
