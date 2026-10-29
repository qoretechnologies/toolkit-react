import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import { getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import {
  getReadableOpacity,
  getReadableShade,
  getThemeSurfaces,
} from '../../../helpers/readableColors';

export interface ICompactToolbarInks {
  /** "Ready" and the meter's done run's word: the success intent in a shade that reads. */
  success: string;
  /** "Incomplete" and "N need attention": the warning intent in a shade that reads. */
  warning: string;
  /** The "· 4/6 set" count, a softer shade of the text: as soft as it still reads. */
  countOpacity: number;
}

/**
 * The completion summary's colors (qorus#646): the intents as they were, 4.0-4.1:1 on a dark page, did not read as
 * text. Read against the theme's background, and a shade darker and lighter as the page or the panel the form is
 * drawn on may be.
 */
export const getCompactToolbarInks = (theme: IReqoreTheme): ICompactToolbarInks => {
  const surfaces = getThemeSurfaces(theme);
  const intents = (theme.intents || {}) as Record<string, string>;

  return {
    success: getReadableShade(intents.success || '#4a7110', surfaces),
    warning: getReadableShade(intents.warning || '#d17c29', surfaces),
    countOpacity: getReadableOpacity(getReadableColor(theme), surfaces, 0.5),
  };
};
