import { IReqoreTheme } from '@qoretechnologies/reqore/dist/constants/theme';
import { describe, expect, it } from 'vitest';
import { getMainBackgroundColor } from '@qoretechnologies/reqore/dist/helpers/colors';
import {
  calmNoteIntent,
  getCalmIntentText,
  getCalmPanelSurface,
  getReadableOn,
} from '../src/components/form/engine/formAppearance';

/** WCAG contrast of two `#rrggbb` colours. */
const contrast = (a: string, b: string): number => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((start) => {
      const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/**
 * A calm word coloured by what it means has to be readable. A theme's intents are
 * FILLS: Reqore's danger (#a82a2a) as a small line on a near-black form reads at
 * about 2.3:1, which is what turned "Expression definition … not found" into a
 * line nobody could read.
 */
describe('calm intent text', () => {
  it("lifts Reqore's danger fill until it reads on a dark surface", () => {
    expect(contrast('#a82a2a', '#121212')).toBeLessThan(4.5);
    const text = getReadableOn('#a82a2a', '#121212');
    expect(contrast(text, '#121212')).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves a colour that already reads as it is', () => {
    expect(getReadableOn('#ffffff', '#121212')).toBe('#ffffff');
  });

  it('darkens on a light surface instead', () => {
    const text = getReadableOn('#f0a0a0', '#ffffff');
    expect(contrast(text, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('reads on every surface it is given', () => {
    const text = getReadableOn('#a82a2a', ['#121212', '#2a2a2a']);
    expect(contrast(text, '#121212')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, '#2a2a2a')).toBeGreaterThanOrEqual(4.5);
  });

  it('reads on the section surface AND the page of a dark theme, for every intent', () => {
    const theme = {
      main: '#222222',
      intents: { danger: '#a82a2a', warning: '#d17c29', info: '#2a6fa8', success: '#4a7110' },
    } as unknown as IReqoreTheme;
    for (const surface of [getCalmPanelSurface(theme), getMainBackgroundColor(theme)]) {
      for (const intent of ['danger', 'warning', 'info', 'success']) {
        expect(contrast(getCalmIntentText(theme, intent), surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('calm notes', () => {
  it('take no colour when they only inform, and keep it when a person has to act', () => {
    expect(calmNoteIntent('info', true)).toBeUndefined();
    expect(calmNoteIntent('success', true)).toBeUndefined();
    expect(calmNoteIntent(undefined, true)).toBeUndefined();
    expect(calmNoteIntent('warning', true)).toBe('warning');
    expect(calmNoteIntent('danger', true)).toBe('danger');
  });

  it('are untouched in the classic look', () => {
    expect(calmNoteIntent('info', false)).toBe('info');
  });
});
