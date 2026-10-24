import { TReqoreHexColor } from '@qoretechnologies/reqore/dist/components/Effect';
import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import {
  changeDarkness,
  getMainBackgroundColor,
  getReadableColor,
} from '@qoretechnologies/reqore/dist/helpers/colors';
import { mix } from 'polished';
import {
  getReadableFaded,
  getReadableOpacity,
  getReadableShade,
  READABLE_ICON,
} from '../../../helpers/readableColors';

export interface IReadFirstInks {
  /** Every color a read-first row may be drawn on: see `getReadFirstInks`. */
  surfaces: string[];
  /** The intents, as text or an icon in a row: a shade of each that reads on all of them. */
  danger: TReqoreHexColor;
  warning: TReqoreHexColor;
  success: TReqoreHexColor;
  info: TReqoreHexColor;
  /** A reason without an intent: the muted text, softened as far as it still reads. */
  mutedReason: string;
  /** The help mark beside a label (an icon), as faint as it still stands out by 3:1. */
  helpOpacity: number;
  /** The small notes under a label (a code value's size, its lines), as faint as they still read. */
  noteOpacity: number;
  /** A label's short description, a shade softer than the label, as soft as it still reads. */
  descOpacity: number;
  /** An empty value's dash and a hidden value's mask: the muted text, faint, as faint as it still reads. */
  emptyValue: string;
}

/**
 * The read-first rows' own colors (qorus#646). A row is drawn on the page, or in a status box - the attention box
 * tinted with the warning intent, the set box with the success one, both at 12%, the optional box a shade darker
 * than the page - and hovered, a 5% wash of the text over any of them. Its colored words and icons were the intents
 * themselves (a danger reason 2.7:1 on the attention box), its notes and help mark faded to 45-55% (4.1:1, 2.7:1).
 * Each is picked to read on every one of those surfaces: 4.5:1 for text, 3:1 for an icon.
 */
export const getReadFirstInks = (theme: IReqoreTheme): IReadFirstInks => {
  const intents = (theme.intents || {}) as Record<string, string>;
  const text = (theme.text?.color as string) || getReadableColor(theme);
  const page = getMainBackgroundColor(theme);
  const boxes = [
    page,
    mix(0.12, intents.warning || '#ffdf34', page),
    mix(0.12, intents.success || '#36b37e', page),
    changeDarkness(page, 0.06),
  ];
  const surfaces = [...boxes, ...boxes.map((box) => mix(0.05, text, box))];
  const key = getReadableColor(theme);
  const muted = getReadableColor(theme, undefined, undefined, true);

  return {
    surfaces,
    danger: getReadableShade(intents.danger || '#e35a5a', surfaces) as TReqoreHexColor,
    warning: getReadableShade(intents.warning || '#ffdf34', surfaces) as TReqoreHexColor,
    success: getReadableShade(intents.success || '#36b37e', surfaces) as TReqoreHexColor,
    info: getReadableShade(intents.info || '#3b8eea', surfaces) as TReqoreHexColor,
    mutedReason: getReadableFaded(muted, surfaces, 0.8),
    helpOpacity: getReadableOpacity(key, surfaces, 0.55, READABLE_ICON),
    noteOpacity: getReadableOpacity(key, surfaces, 0.45),
    descOpacity: getReadableOpacity(key, surfaces, 0.55),
    emptyValue: getReadableFaded(muted, surfaces, 0.4),
  };
};
