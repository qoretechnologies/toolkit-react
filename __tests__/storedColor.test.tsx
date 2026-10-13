// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatColorValue,
  isStoredColor,
  storedColorProblem,
} from '../src/components/colorValue/colorValue';
import { ColorFormField, IColorFormFieldProps } from '../src/components/form/fields/color/Color';
import { validateFieldWithResult } from '../src/helpers/validations';

/**
 * How a color is stored (qorus#646, David): the hash `{ r, g, b, a? }` - `r`, `g` and `b` whole numbers from 0 to
 * 255, `a` its opacity from 0 to 1, and no `a` an opaque color. A hex code, bare or as `{ hex }`, is not a stored
 * color: the readers still draw one, so a value stored that way is seen, the validator says what is wrong with
 * it, and the color field stores the hash when it edits it.
 *
 * The validator took a six-digit `{ hex }` and any `r`, `g` and `b` that were there - `{ r: 'a', g: 0, b: 0 }`, a
 * channel of 300, an alpha of 128 - and said only "RGB color is invalid" of the rest.
 */
const said = (value: unknown, type = 'rgbcolor') => validateFieldWithResult(type, value);

const STORED_AS = 'A color is stored as its red, green and blue values (r, g, b)';

describe('a stored color', () => {
  it.each([
    ['red, green and blue', { r: 100, g: 149, b: 237 }],
    ['an opacity of 0', { r: 100, g: 149, b: 237, a: 0 }],
    ['an opacity of 0.5', { r: 255, g: 0, b: 0, a: 0.5 }],
    ['an opacity of 1', { r: 255, g: 0, b: 0, a: 1 }],
    ['black', { r: 0, g: 0, b: 0 }],
    ['white', { r: 255, g: 255, b: 255 }],
    ['an opacity given as nothing', { r: 1, g: 2, b: 3, a: null }],
    [
      'a hex beside its channels, as react-color wrote it',
      { r: 100, g: 149, b: 237, a: 1, hex: '#6495ED' },
    ],
  ])('is valid: %s', (_name, value) => {
    expect(said(value).isValid).toBe(true);
    expect(isStoredColor(value)).toBe(true);
    expect(storedColorProblem(value)).toBeUndefined();
  });

  it.each([
    ['a bare hex code', '#6495ED', `${STORED_AS}, not as the hex code “#6495ED”.`],
    ['a hex code with no #', '6495ed', `${STORED_AS}, not as the hex code “6495ed”.`],
    ['{ hex }', { hex: '#6495ED' }, `${STORED_AS}, not as the hex code “#6495ED”.`],
    ['a color name', 'red', `${STORED_AS}, not as “red”.`],
    ['a number', 42, `${STORED_AS}, not as 42.`],
    ['a list', [100, 149, 237], `${STORED_AS}, not as [100,149,237].`],
    [
      'a channel that is not a number',
      { r: 'a', g: 0, b: 0 },
      'Red (r) must be a whole number from 0 to 255, not “a”.',
    ],
    [
      'a channel written as text',
      { r: 100, g: '149', b: 237 },
      'Green (g) must be a whole number from 0 to 255, not “149”.',
    ],
    [
      'a channel past 255',
      { r: 300, g: 0, b: 0 },
      'Red (r) must be a whole number from 0 to 255, not 300.',
    ],
    [
      'a channel under 0',
      { r: 0, g: 0, b: -1 },
      'Blue (b) must be a whole number from 0 to 255, not -1.',
    ],
    [
      'a channel with a fraction',
      { r: 12.5, g: 0, b: 0 },
      'Red (r) must be a whole number from 0 to 255, not 12.5.',
    ],
    [
      'an opacity past 1',
      { r: 0, g: 0, b: 0, a: 1.5 },
      'Opacity (a) must be a number from 0 to 1, not 1.5.',
    ],
    [
      'an opacity on the 0 to 255 scale',
      { r: 0, g: 0, b: 0, a: 128 },
      'Opacity (a) must be a number from 0 to 1, not 128.',
    ],
    [
      'an opacity under 0',
      { r: 0, g: 0, b: 0, a: -0.1 },
      'Opacity (a) must be a number from 0 to 1, not -0.1.',
    ],
    [
      'an opacity written as text',
      { r: 0, g: 0, b: 0, a: '0.5' },
      'Opacity (a) must be a number from 0 to 1, not “0.5”.',
    ],
    ['one channel missing', { g: 0, b: 0 }, 'Red (r) is missing.'],
    ['two channels missing', { r: 255 }, 'Green (g) and blue (b) are missing.'],
    ['no channels', { name: 'blue' }, 'Red (r), green (g) and blue (b) are missing.'],
    [
      'more than one thing wrong',
      { r: 'a', g: 300, a: 2 },
      'Blue (b) is missing; red (r) must be a whole number from 0 to 255, not “a”; green (g) must be a whole number from 0 to 255, not 300; opacity (a) must be a number from 0 to 1, not 2.',
    ],
    ['nothing', undefined, 'No color is set.'],
  ])('is not valid: %s, and says so', (_name, value, reason) => {
    expect(said(value)).toMatchObject({ isValid: false, reason });
    expect(isStoredColor(value)).toBe(false);
  });

  it('may be nothing where the field may be empty', () => {
    expect(said(undefined, '*rgbcolor').isValid).toBe(true);
  });

  // a value stored the wrong way is still seen, so it can be fixed
  it('is still read when it is a hex code, though it is not valid', () => {
    expect(formatColorValue('#6495ed')).toBe('#6495ED');
    expect(formatColorValue({ hex: '#6495ed' })).toBe('#6495ED');
  });
});

describe('the color field, editing a value not stored as a color', () => {
  const renderField = (props: IColorFormFieldProps) =>
    render(
      <ReqoreUIProvider>
        <ColorFormField {...props} />
      </ReqoreUIProvider>
    );

  /** Type into a field and leave it; the hex code is typed in lower case, the same color the field shows in upper
      case, as React gives no change event for the text an input already holds. */
  const typeAndLeave = (container: HTMLElement, name: string, text: string) => {
    const input = container.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)!;
    fireEvent.change(input, { target: { value: text } });
    fireEvent.blur(input);
  };

  it.each([
    ['a bare hex code', '#6495ED'],
    ['{ hex }', { hex: '#6495ed' }],
  ])('stores %s as the hash, even when the color is the same', (_name, value) => {
    const onChange = vi.fn();
    const { container } = renderField({ value: value as never, onChange });
    typeAndLeave(container, 'hex', '6495ed');
    expect(onChange).toHaveBeenCalledWith({ r: 100, g: 149, b: 237, a: 1 });
  });

  it('stores a channel past its range as the channel it shows', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { r: 300, g: 0, b: 0 } as never, onChange });
    // shown as 255, its range's top: a step up keeps it there, the same color
    const red = container.querySelector<HTMLInputElement>('input[data-field="r"]')!;
    expect(red.value).toBe('255');
    fireEvent.keyDown(red, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('stores nothing when a stored color is edited to the same color', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { r: 100, g: 149, b: 237, a: 1 }, onChange });
    typeAndLeave(container, 'hex', '6495ed');
    expect(onChange).not.toHaveBeenCalled();
  });
});
