import { DEFAULT_THEME } from '@qoretechnologies/reqore/dist/constants/theme';
import { buildTheme, getReadableColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { mix, parseToRgb, rgba } from 'polished';
import { getReadFirstInks } from '../src/components/form/engine/readFirstColors';
import { contrastRatio, READABLE_ICON, READABLE_TEXT } from '../src/helpers/readableColors';

/** A color (an rgba string too) as drawn on the opaque `background`. */
const drawn = (color: string, background: string): string => {
  const parts = parseToRgb(color) as { red: number; green: number; blue: number; alpha?: number };

  return mix(parts.alpha ?? 1, rgba(parts.red, parts.green, parts.blue, 1), background);
};

/* A read-first row's own words and marks read on every surface a row is drawn on: the page, the attention and set
   boxes' tints, the optional box, each hovered (qorus#646: a danger reason was 2.7:1 on the attention box, a size
   note 4.1:1, the help mark 2.7:1). */
describe('the read-first rows', () => {
  for (const main of ['#333333', '#0f0f0f', '#f4f4f4', '#1b2f45']) {
    test(`read on a ${main} theme`, () => {
      const theme = buildTheme({ ...DEFAULT_THEME, main } as never);
      const inks = getReadFirstInks(theme);
      const key = getReadableColor(theme);

      for (const surface of inks.surfaces) {
        for (const color of [inks.danger, inks.warning, inks.success, inks.info]) {
          expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(READABLE_TEXT);
        }
        expect(contrastRatio(drawn(inks.mutedReason, surface), surface)).toBeGreaterThanOrEqual(
          READABLE_TEXT
        );
        expect(contrastRatio(mix(inks.noteOpacity, key, surface), surface)).toBeGreaterThanOrEqual(
          READABLE_TEXT
        );
        expect(contrastRatio(mix(inks.descOpacity, key, surface), surface)).toBeGreaterThanOrEqual(
          READABLE_TEXT
        );
        expect(contrastRatio(mix(inks.helpOpacity, key, surface), surface)).toBeGreaterThanOrEqual(
          READABLE_ICON
        );
        expect(contrastRatio(drawn(inks.emptyValue, surface), surface)).toBeGreaterThanOrEqual(
          READABLE_TEXT
        );
      }
      // softened no less than they were where that already reads
      expect(inks.noteOpacity).toBeGreaterThanOrEqual(0.45);
      expect(inks.helpOpacity).toBeGreaterThanOrEqual(0.55);
    });
  }
});
