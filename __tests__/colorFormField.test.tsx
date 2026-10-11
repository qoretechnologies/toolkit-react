// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The `rgbcolor` field's picker. It was react-color's Sketch picker, a function component that set its
 * defaults (its width, its preset colours, whether it shows transparency) with `defaultProps`, which React 19
 * no longer applies to function components: the picker would have rendered without them. React 18.3 already
 * warns about it on every page that shows the field. It is now `@uiw/react-color-sketch`.
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
}: {
  initial?: IColorFormFieldValue;
  onChange: (value: IColorFormFieldValue) => void;
}) => {
  const [value, setValue] = useState(initial);
  return (
    <ColorFormField
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
};

const hexInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('.w-color-editable-input input')!;

/** Where the hue slider's handle is, as a percentage of its width. */
const huePosition = (container: HTMLElement) =>
  parseFloat(
    Array.from(container.querySelectorAll<HTMLElement>('.w-color-hue div')).find(
      (element) => element.style.left
    )!.style.left
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ColorFormField', () => {
  it('renders without a React warning: nothing it uses sets defaultProps on a function component', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderField({ value: { r: 100, g: 149, b: 237, a: 1 } });
    const said = errors.mock.calls.map((call) => call.map(String).join(' '));
    expect(said.filter((message) => message.includes('defaultProps'))).toEqual([]);
  });

  it('shows the stored colour', () => {
    const { container } = renderField({ value: { r: 100, g: 149, b: 237, a: 1 } });
    expect(hexInput(container).value).toBe('6495ED');
  });

  it('stores the colour written as hex as red, green, blue and alpha', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { r: 100, g: 149, b: 237, a: 1 }, onChange });
    fireEvent.change(hexInput(container), { target: { value: 'DC3545' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 1 });
  });

  it('keeps the stored transparency when the transparency slider is left out', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { r: 100, g: 149, b: 237, a: 0.5 }, onChange });
    expect(container.querySelector('.w-color-alpha:not(.w-color-hue)')).toBeNull();
    fireEvent.change(hexInput(container), { target: { value: 'DC3545' } });
    expect(onChange).toHaveBeenLastCalledWith({ r: 220, g: 53, b: 69, a: 0.5 });
  });

  it('offers the transparency slider when asked to', () => {
    const { container } = renderField({ value: { r: 100, g: 149, b: 237, a: 0.5 }, disableAlpha: false });
    expect(container.querySelector('.w-color-alpha:not(.w-color-hue)')).not.toBeNull();
  });

  it('shows a colour stored as hex, bare or as { hex }', () => {
    expect(hexInput(renderField({ value: '#dc3545' as never }).container).value).toBe('DC3545');
    expect(hexInput(renderField({ value: { hex: '#6495ed' } as never }).container).value).toBe('6495ED');
  });

  it('goes back to its starting colour when the value is cleared', () => {
    const { container, rerender } = renderField({});
    const starting = hexInput(container).value;
    rerender(
      <ReqoreUIProvider>
        <ColorFormField value={{ r: 220, g: 53, b: 69, a: 1 }} />
      </ReqoreUIProvider>
    );
    expect(hexInput(container).value).toBe('DC3545');
    rerender(
      <ReqoreUIProvider>
        <ColorFormField value={undefined} />
      </ReqoreUIProvider>
    );
    expect(hexInput(container).value).toBe(starting);
  });

  it('keeps the hue it was chosen from when the colour it sent comes back as a grey', () => {
    const onChange = vi.fn();
    // hue 210, saturation 2%: one step from grey on the saturation's arrow keys
    const { container } = render(
      <ReqoreUIProvider>
        <Controlled initial={{ r: 125, g: 127, b: 130, a: 1 }} onChange={onChange} />
      </ReqoreUIProvider>
    );
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
    // and the hue slider stays where it was instead of jumping back to red
    expect(huePosition(container)).toBeCloseTo(hue, 0);
  });

  it('stores nothing when the hue moves on a grey: the colour is the same', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { r: 128, g: 128, b: 128, a: 1 }, onChange });
    const hue = container.querySelector<HTMLElement>('.w-color-hue .w-color-interactive')!;
    fireEvent.keyDown(hue, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    ['disabled', { disabled: true }],
    ['read-only', { readOnly: true }],
  ])('a %s field is out of reach and stores nothing', (_kind, props) => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { r: 100, g: 149, b: 237, a: 1 }, onChange, ...props });
    const field = container.querySelector<HTMLElement>('.reqraft-color-field')!;
    expect(field.inert).toBe(true);
    expect(field.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(hexInput(container), { target: { value: 'DC3545' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an editable field is in reach', () => {
    const { container } = renderField({ value: { r: 100, g: 149, b: 237, a: 1 } });
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

  it('is undefined for anything that is not a colour', () => {
    expect(colorToRgba(undefined)).toBeUndefined();
    expect(colorToRgba(null)).toBeUndefined();
    expect(colorToRgba({})).toBeUndefined();
    expect(colorToRgba({ r: 1, g: 2 })).toBeUndefined();
    expect(colorToRgba({ r: '1', g: 2, b: 3 })).toBeUndefined();
    expect(colorToRgba('not a colour')).toBeUndefined();
    expect(colorToRgba({ hex: 'zz' })).toBeUndefined();
  });
});
