import { buildTheme, getMainBackgroundColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import { DEFAULT_THEME } from '@qoretechnologies/reqore/dist/constants/theme';
import { parseToHsl } from 'polished';
import { getCompactToolbarInks } from '../src/components/form/engine/compactToolbarColors';
import { contrastRatio, READABLE_TEXT } from '../src/helpers/readableColors';

/* The read-first summary ("Incomplete · 4/6 set · 2 need attention →") drew its words in the warning and success
   intents themselves: 4.0-4.1:1 on the IDE's dark page (qorus#646). In every theme its words read. */
describe('the read-first completion summary', () => {
  for (const main of ['#333333', '#0f0f0f', '#f4f4f4', '#ffffff', '#1b2f45']) {
    test(`reads on a ${main} theme`, () => {
      const theme = buildTheme({ ...DEFAULT_THEME, main } as never);
      const page = getMainBackgroundColor(theme);
      const inks = getCompactToolbarInks(theme);

      expect(contrastRatio(inks.warning, page)).toBeGreaterThanOrEqual(READABLE_TEXT);
      expect(contrastRatio(inks.success, page)).toBeGreaterThanOrEqual(READABLE_TEXT);
      expect(inks.countOpacity).toBeGreaterThanOrEqual(0.5);
    });
  }

  test('the intents keep their hue, only lighter where they did not read', () => {
    const theme = buildTheme({ ...DEFAULT_THEME, main: '#0f0f0f' } as never);
    const inks = getCompactToolbarInks(theme);

    for (const [ink, intent] of [
      [inks.warning, theme.intents.warning],
      [inks.success, theme.intents.success],
    ]) {
      expect(Math.abs(parseToHsl(ink).hue - parseToHsl(intent).hue)).toBeLessThan(15);
      expect(parseToHsl(ink).lightness).toBeGreaterThanOrEqual(parseToHsl(intent).lightness);
    }
  });
});
