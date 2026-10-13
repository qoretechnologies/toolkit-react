// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The `rgbcolor` field. It was react-color's Sketch picker, a function component that set its defaults with
 * `defaultProps`, which React 19 no longer applies to function components; it is now drawn from the
 * `@uiw` picker's parts, with the field's own preview, labelled inputs that take only what a color can
 * be, help and swatches.
 */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ColorFormField,
  colorToRgba,
  IColorFormFieldProps,
  IColorFormFieldValue,
} from '../src/components/form/fields/color/Color';

const renderField = (props: IColorFormFieldProps) =>
  render(
    <ReqoreUIProvider>
      <ColorFormField {...props} />
    </ReqoreUIProvider>
  );

/** The field as a form holds it: the value it sends comes back as its value. */
const Controlled = ({
  initial,
  onChange,
  ...props
}: Omit<IColorFormFieldProps, 'value' | 'onChange'> & {
  initial?: IColorFormFieldValue;
  onChange: (value: IColorFormFieldValue) => void;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <ColorFormField
      {...props}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
};

const renderControlled = (props: Parameters<typeof Controlled>[0]) =>
  render(
    <ReqoreUIProvider>
      <Controlled {...props} />
    </ReqoreUIProvider>
  );

type TField = 'hex' | 'r' | 'g' | 'b' | 'a';

const input = (container: HTMLElement, name: TField) =>
  container.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)!;

const problem = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.reqraft-color-field-problem')!.textContent;

/** Type into a field and leave it. */
const typeAndLeave = (container: HTMLElement, name: TField, text: string) => {
  fireEvent.change(input(container, name), { target: { value: text } });
  fireEvent.blur(input(container, name));
};

/** Where the color bar's handle is, as a percentage of its width. */
const huePosition = (container: HTMLElement) =>
  parseFloat(
    Array.from(container.querySelectorAll<HTMLElement>('.reqraft-color-field-hue div')).find(
      (element) => element.style.left
    )!.style.left
  );

const CORNFLOWER = { r: 100, g: 149, b: 237, a: 1 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ColorFormField', () => {
  it('renders without a React warning: nothing it uses sets defaultProps on a function component', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderField({ value: CORNFLOWER });
    const said = errors.mock.calls.map((call) => call.map(String).join(' '));
    expect(said.filter((message) => message.includes('defaultProps'))).toEqual([]);
  });

  it('shows the stored color in labelled inputs and in its preview', () => {
    const { container, getByLabelText, getByRole } = renderField({ value: CORNFLOWER });
    expect(getByLabelText('Hex code')).toHaveProperty('value', '6495ED');
    expect(getByLabelText('Red')).toHaveProperty('value', '100');
    expect(getByLabelText('Green')).toHaveProperty('value', '149');
    expect(getByLabelText('Blue')).toHaveProperty('value', '237');
    expect(input(container, 'a')).toBeNull();
    expect(getByRole('img', { name: 'Chosen color: #6495ED' })).toBeTruthy();
  });

  it('says it holds no color yet when it holds none', () => {
    const { getByRole } = renderField({});
    expect(getByRole('img', { name: 'No color chosen yet' })).toBeTruthy();
  });

  it('takes its words from the host', () => {
    const { getByLabelText, getByRole } = renderField({
      value: CORNFLOWER,
      labels: { red: 'Rot', preview: (hex) => `Farbe ${hex}` },
    });
    expect(getByLabelText('Rot')).toHaveProperty('value', '100');
    expect(getByRole('img', { name: 'Farbe #6495ED' })).toBeTruthy();
  });

  it('stores the color written as hex as red, green, blue and alpha', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    fireEvent.change(input(container, 'hex'), { target: { value: 'DC3545' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 1 });
  });

  it('takes a hex code pasted with its # and in lower case', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    fireEvent.change(input(container, 'hex'), { target: { value: ' #dc3545 ' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 1 });
    expect(input(container, 'hex').value).toBe('DC3545');
    expect(problem(container)).toBe('');
  });

  it('leaves out what cannot be in a hex code, and says so', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    fireEvent.change(input(container, 'hex'), { target: { value: 'DCZ35-45' } });
    expect(input(container, 'hex').value).toBe('DC3545');
    expect(onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 1 });
    expect(problem(container)).toBe(
      'Z, - cannot be in a hex code: use the digits 0–9 and the letters A–F.'
    );
  });

  it('keeps a hex code to six characters, and says so', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    fireEvent.change(input(container, 'hex'), { target: { value: 'DC3545AA' } });
    expect(input(container, 'hex').value).toBe('DC3545');
    expect(problem(container)).toBe('A hex code has six characters.');
  });

  it('stores three characters as the six they are short for, when the field is left', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    fireEvent.change(input(container, 'hex'), { target: { value: 'F80' } });
    // three may be the start of six
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input(container, 'hex'));
    expect(onChange).toHaveBeenLastCalledWith({ r: 255, g: 136, b: 0, a: 1 });
  });

  it('stores nothing for a hex code of another length, says why and shows the color again', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    typeAndLeave(container, 'hex', '6495');
    expect(onChange).not.toHaveBeenCalled();
    expect(input(container, 'hex').value).toBe('6495ED');
    expect(problem(container)).toBe(
      '6495 is not a color: a hex code has six characters (or three, short for six).'
    );
    typeAndLeave(container, 'hex', '');
    expect(problem(container)).toBe('Type a hex code: six characters, each 0–9 or A–F.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stores a red, green or blue in its range', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    fireEvent.change(input(container, 'g'), { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 100, g: 0, b: 237, a: 1 });
    fireEvent.change(input(container, 'b'), { target: { value: '255' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 100, g: 149, b: 255, a: 1 });
  });

  it('stores nothing past a range, marks the field and says the range', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    fireEvent.change(input(container, 'r'), { target: { value: '256' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input(container, 'r').value).toBe('256');
    expect(input(container, 'r').getAttribute('aria-invalid')).toBe('true');
    expect(problem(container)).toBe('Red goes from 0 to 255.');
    fireEvent.blur(input(container, 'r'));
    expect(input(container, 'r').value).toBe('100');
    expect(input(container, 'r').hasAttribute('aria-invalid')).toBe(false);
    expect(problem(container)).toBe('Red goes from 0 to 255.');
  });

  it('leaves out what is not a digit, and says so with the range when both are wrong', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    fireEvent.change(input(container, 'g'), { target: { value: '-1.5' } });
    expect(input(container, 'g').value).toBe('15');
    expect(onChange).toHaveBeenLastCalledWith({ r: 100, g: 15, b: 237, a: 1 });
    expect(problem(container)).toBe('-, . cannot be in Green: type a whole number.');
    // what was typed, and the range, are data: drawn as code
    expect(
      Array.from(container.querySelectorAll('.reqraft-color-field-problem code')).map((c) => c.textContent)
    ).toEqual(['-', '.']);
    fireEvent.change(input(container, 'b'), { target: { value: '9e99' } });
    expect(problem(container)).toBe(
      'e cannot be in Blue: type a whole number. Blue goes from 0 to 255.'
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('shows a number again when its field is left empty, and says what it needs', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange });
    typeAndLeave(container, 'b', '');
    expect(input(container, 'b').value).toBe('237');
    expect(problem(container)).toBe('Blue needs a whole number from 0 to 255.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('steps a number with the arrow keys, by ten with Shift, within its range', () => {
    const onChange = vi.fn();
    const { container } = renderControlled({ initial: { r: 250, g: 5, b: 0, a: 1 }, onChange });
    fireEvent.keyDown(input(container, 'r'), { key: 'ArrowUp', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith({ r: 255, g: 5, b: 0, a: 1 });
    fireEvent.keyDown(input(container, 'g'), { key: 'ArrowDown', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith({ r: 255, g: 0, b: 0, a: 1 });
    fireEvent.keyDown(input(container, 'b'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith({ r: 255, g: 0, b: 1, a: 1 });
  });

  it('shows and stores the opacity as a percentage of 0 to 100', () => {
    const onChange = vi.fn();
    const { container } = renderField({
      value: { ...CORNFLOWER, a: 0.5 },
      disableAlpha: false,
      onChange,
    });
    expect(input(container, 'a').value).toBe('50');
    fireEvent.change(input(container, 'a'), { target: { value: '25' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...CORNFLOWER, a: 0.25 });
    fireEvent.change(input(container, 'a'), { target: { value: '101' } });
    expect(problem(container)).toBe('Opacity goes from 0 to 100.');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the opacity when a hex code or a swatch picks the color', () => {
    const onChange = vi.fn();
    const { container } = renderField({
      value: { ...CORNFLOWER, a: 0.5 },
      disableAlpha: false,
      onChange,
    });
    fireEvent.change(input(container, 'hex'), { target: { value: 'DC3545' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 0.5 });
    fireEvent.click(container.querySelector('.reqraft-color-field-swatch[data-color="#417505"]')!);
    expect(onChange).toHaveBeenLastCalledWith({ r: 65, g: 117, b: 5, a: 0.5 });
  });

  it('stores the opacity bar in hundredths, as the opacity field shows it', () => {
    const onChange = vi.fn();
    const { container } = renderField({
      value: { ...CORNFLOWER, a: 0.5 },
      disableAlpha: false,
      onChange,
    });
    const alpha = container.querySelector<HTMLElement>(
      '.reqraft-color-field-alpha .w-color-interactive'
    )!;
    fireEvent.keyDown(alpha, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith({ ...CORNFLOWER, a: 0.49 });
  });

  it('keeps the stored transparency when the transparency slider is left out', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { ...CORNFLOWER, a: 0.5 }, onChange });
    expect(container.querySelector('.reqraft-color-field-alpha')).toBeNull();
    fireEvent.change(input(container, 'hex'), { target: { value: 'DC3545' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 0.5 });
  });

  it('offers the transparency slider when asked to', () => {
    const { container } = renderField({ value: { ...CORNFLOWER, a: 0.5 }, disableAlpha: false });
    expect(container.querySelector('.reqraft-color-field-alpha')).not.toBeNull();
  });

  it('shows a color stored as hex, bare or as { hex }', () => {
    expect(input(renderField({ value: '#dc3545' as never }).container, 'hex').value).toBe('DC3545');
    expect(input(renderField({ value: { hex: '#6495ed' } as never }).container, 'hex').value).toBe(
      '6495ED'
    );
  });

  it('offers the host’s swatches, or none', () => {
    const { container } = renderField({
      value: CORNFLOWER,
      presetColors: [{ color: '#112233', title: 'Navy' }],
    });
    const swatches = container.querySelectorAll('.reqraft-color-field-swatch');
    expect(swatches).toHaveLength(1);
    expect(swatches[0].getAttribute('aria-label')).toBe('Use Navy');
    expect(
      renderField({ presetColors: false }).container.querySelector('.reqraft-color-field-swatches')
    ).toBeNull();
  });

  it('goes back to its starting color when the value is cleared', () => {
    const { container, rerender } = renderField({});
    const starting = input(container, 'hex').value;
    rerender(
      <ReqoreUIProvider>
        <ColorFormField value={{ r: 220, g: 53, b: 69, a: 1 }} />
      </ReqoreUIProvider>
    );
    expect(input(container, 'hex').value).toBe('DC3545');
    rerender(
      <ReqoreUIProvider>
        <ColorFormField value={undefined} />
      </ReqoreUIProvider>
    );
    expect(input(container, 'hex').value).toBe(starting);
  });

  it('keeps the hue it was chosen from when the color it sent comes back as a grey', () => {
    const onChange = vi.fn();
    // hue 210, saturation 2%: one step from grey on the saturation's arrow keys
    const { container } = renderControlled({ initial: { r: 125, g: 127, b: 130, a: 1 }, onChange });
    const hue = huePosition(container);
    expect(hue).toBeGreaterThan(50);

    const saturation = container.querySelector<HTMLElement>('.w-color-saturation')!;
    for (let step = 0; step < 5; step++) {
      act(() => {
        fireEvent.keyDown(saturation, { key: 'ArrowLeft' });
      });
    }

    // the field now stores a grey, which has no hue of its own
    const stored = onChange.mock.lastCall![0];
    expect(stored.r === stored.g && stored.g === stored.b).toBe(true);
    // and the color bar stays where it was instead of jumping back to red
    expect(huePosition(container)).toBeCloseTo(hue, 0);
  });

  it('keeps the hue when a grey is typed in', () => {
    const onChange = vi.fn();
    const { container } = renderControlled({ initial: CORNFLOWER, onChange });
    const hue = huePosition(container);
    fireEvent.change(input(container, 'hex'), { target: { value: '808080' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 128, g: 128, b: 128, a: 1 });
    expect(huePosition(container)).toBeCloseTo(hue, 0);
  });

  it('stores nothing when the hue moves on a grey: the color is the same', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { r: 128, g: 128, b: 128, a: 1 }, onChange });
    const hue = container.querySelector<HTMLElement>('.reqraft-color-field-hue .w-color-interactive')!;
    fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows and hides what its controls mean', () => {
    const { container, getByRole } = renderField({ value: CORNFLOWER });
    const toggle = getByRole('button', { name: /What do these mean/ });
    expect(container.querySelector('.reqraft-color-field-help')).toBeNull();
    fireEvent.click(toggle);
    const help = container.querySelector('.reqraft-color-field-help')!;
    expect(help.textContent).toContain('Hex code: the whole color as six characters');
    expect(help.textContent).toContain('Red, Green, Blue');
    // no opacity offered, none explained
    expect(help.textContent).not.toContain('Opacity');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(container.querySelector('.reqraft-color-field-help')).toBeNull();
  });

  it.each([
    ['disabled', { disabled: true }],
    ['read-only', { readOnly: true }],
  ])('a %s field is out of reach and stores nothing', (_kind, props) => {
    const onChange = vi.fn();
    const { container } = renderField({ value: CORNFLOWER, onChange, ...props });
    const field = container.querySelector<HTMLElement>('.reqraft-color-field')!;
    expect(field.inert).toBe(true);
    expect(field.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(input(container, 'hex'), { target: { value: 'DC3545' } });
    fireEvent.click(container.querySelector('.reqraft-color-field-swatch')!);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an editable field is in reach', () => {
    const { container } = renderField({ value: CORNFLOWER });
    const field = container.querySelector<HTMLElement>('.reqraft-color-field')!;
    expect(field.inert).toBe(false);
    expect(field.hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('colorToRgba', () => {
  it('reads every shape an rgbcolor value is stored in', () => {
    expect(colorToRgba({ r: 1, g: 2, b: 3 })).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(colorToRgba({ r: 1, g: 2, b: 3, a: 0.5 })).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
    expect(colorToRgba('#0a0b0c')).toEqual({ r: 10, g: 11, b: 12, a: 1 });
    expect(colorToRgba('0a0b0c')).toEqual({ r: 10, g: 11, b: 12, a: 1 });
    expect(colorToRgba({ hex: '#fff' })).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('brings a channel past its range into it, so it is a color', () => {
    expect(colorToRgba({ r: 300, g: -4, b: 12.6, a: 2 })).toEqual({ r: 255, g: 0, b: 13, a: 1 });
    expect(colorToRgba({ r: 1, g: 2, b: 3, a: 0.456 })).toEqual({ r: 1, g: 2, b: 3, a: 0.46 });
  });

  it('is undefined for anything that is not a color', () => {
    expect(colorToRgba(undefined)).toBeUndefined();
    expect(colorToRgba(null)).toBeUndefined();
    expect(colorToRgba({})).toBeUndefined();
    expect(colorToRgba({ r: 1, g: 2 })).toBeUndefined();
    expect(colorToRgba({ r: '1', g: 2, b: 3 })).toBeUndefined();
    expect(colorToRgba('not a color')).toBeUndefined();
    expect(colorToRgba({ hex: 'zz' })).toBeUndefined();
  });
});
