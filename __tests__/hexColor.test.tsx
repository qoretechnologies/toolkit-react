// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  colorToCss,
  formatColorValue,
  ReqraftColorValue,
  readHexColor,
} from '../src/components/colorValue';
import { ColorFormField, colorToRgba } from '../src/components/form/fields/color/Color';

/**
 * qorus#646: reqraft has one hex reader, and every hex path reads with it - the color field (what it shows, and
 * what it stores from a hex code), `colorToRgba` (what a host stores when it turns a hex code into a color, as the
 * IDE does), `formatColorValue`, `colorToCss` and `ReqraftColorValue`.
 *
 * The field and `colorToRgba` read a hex code with a picker library's reader, which knew 3, 6 and 8 digits but not 4:
 * `#F808` was read in pairs, `F8` `08`, as { r: 248, g: 8, b: 0, a: 1 }, where it is `#FF880088`, { r: 255, g: 136,
 * b: 0 } and an opacity of 0x88 / 255. The readers painted a hex code as the browser reads it, so the page and the
 * stored color disagreed.
 */
const ORANGE_SEE_THROUGH = { r: 255, g: 136, b: 0, a: 0x88 / 255 };
const ORANGE = { r: 255, g: 136, b: 0, a: 1 };

describe('a hex code, read', () => {
  it.each([
    ['3 digits', '#F80', ORANGE],
    ['3 digits, no #', 'f80', ORANGE],
    ['4 digits', '#F808', ORANGE_SEE_THROUGH],
    ['4 digits, no #, in lower case', 'f808', ORANGE_SEE_THROUGH],
    ['6 digits', '#FF8800', ORANGE],
    ['6 digits, no #, in lower case', 'ff8800', ORANGE],
    ['6 digits in mixed case', '#Ff8800', ORANGE],
    ['8 digits', '#FF880088', ORANGE_SEE_THROUGH],
    ['8 digits, no #, in lower case', 'ff880088', ORANGE_SEE_THROUGH],
    ['8 digits, opaque', '#FF8800FF', ORANGE],
    ['8 digits, clear', '#FF880000', { ...ORANGE, a: 0 }],
    ['with space around it', '  #f80 ', ORANGE],
  ])('%s: %j', (_name, text, color) => {
    expect(readHexColor(text)).toEqual(color);
  });

  it.each([
    ['#F8'],
    ['#F8080'],
    ['#FF88001'],
    ['#FF8800881'],
    ['#ggg'],
    ['zzz'],
    ['#'],
    [''],
    ['red'],
  ])('%j is not a hex code', (text) => {
    expect(readHexColor(text)).toBeUndefined();
  });
});

describe('a hex code as a host stores it (colorToRgba)', () => {
  it.each([
    ['#F80', ORANGE],
    ['f80', ORANGE],
    ['#F808', { ...ORANGE, a: 0.53 }],
    ['f808', { ...ORANGE, a: 0.53 }],
    ['#FF8800', ORANGE],
    ['ff8800', ORANGE],
    ['#FF880088', { ...ORANGE, a: 0.53 }],
    ['ff880088', { ...ORANGE, a: 0.53 }],
  ])('%s is %j, its opacity in hundredths', (text, color) => {
    expect(colorToRgba(text)).toEqual(color);
  });

  it("takes { hex }'s own opacity where it gives one, and the opacity beside it where it does not", () => {
    expect(colorToRgba({ hex: '#F808' })).toEqual({ ...ORANGE, a: 0.53 });
    expect(colorToRgba({ hex: '#F808', a: 0.2 })).toEqual({ ...ORANGE, a: 0.53 });
    expect(colorToRgba({ hex: '#F80', a: 0.5 })).toEqual({ ...ORANGE, a: 0.5 });
    expect(colorToRgba({ hex: '#F80' })).toEqual(ORANGE);
  });
});

describe('a hex code, shown', () => {
  it('is written as it was stored, and painted as it is read', () => {
    expect(formatColorValue('#f808')).toBe('#F808');
    expect(colorToCss('#f808')).toBe('rgba(255, 136, 0, 0.53)');
    expect(colorToCss('#FF880088')).toBe('rgba(255, 136, 0, 0.53)');
    expect(colorToCss('f80')).toBe('rgba(255, 136, 0, 1)');
  });

  it('draws its swatch the color the field would store', () => {
    render(
      <ReqoreUIProvider>
        <ReqraftColorValue value='#F808' />
      </ReqoreUIProvider>
    );
    const swatch = screen.getByRole('img', { name: 'Color #F808' });
    expect(swatch.getAttribute('data-swatch')).toBe('rgba(255, 136, 0, 0.53)');
  });

  it('is shown in the color field as the color it is, its opacity too', () => {
    const { container } = render(
      <ReqoreUIProvider>
        <ColorFormField value={'#F808' as never} disableAlpha={false} />
      </ReqoreUIProvider>
    );
    const input = (name: string) =>
      container.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)!.value;
    expect([input('hex'), input('r'), input('g'), input('b'), input('a')]).toEqual([
      'FF8800',
      '255',
      '136',
      '0',
      '53',
    ]);
  });

  it('is stored from the field, three digits read as the six they are short for', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <ColorFormField value={{ r: 0, g: 0, b: 0, a: 1 }} onChange={onChange} />
      </ReqoreUIProvider>
    );
    const hex = container.querySelector<HTMLInputElement>('input[data-field="hex"]')!;
    fireEvent.change(hex, { target: { value: 'f80' } });
    fireEvent.blur(hex);
    expect(onChange).toHaveBeenLastCalledWith(ORANGE);
  });
});
