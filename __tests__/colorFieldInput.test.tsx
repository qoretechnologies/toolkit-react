// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  ColorFormField,
  IColorFormFieldProps,
  TColorFormFieldInput,
} from '../src/components/form/fields/color/Color';
import type { TColorFormFieldInput as TPackageColorInput } from '../src/index';

/**
 * qorus#646: the color field reads a value stored as a hex code, bare or as `{ hex }`, and a color with a field beside
 * its own, so it can show it and store it right - but its `value` was typed as the stored hash only. A host had to
 * convert the value before passing it (the IDE did), and then the field could not see the value was stored the
 * wrong way: an edit that left the color as it was stored nothing, and the hex code stayed. The `value` is typed as
 * what the field reads (`TColorFormFieldInput`), and a host passes the value as it is stored.
 *
 * The type is checked by `tsc` (the precheck), which fails on the parent's types: the field's `value` took none of
 * these but the hash.
 */
describe("the color field's value, as a type", () => {
  it('is what the field reads: the stored hash, a hex code, { hex }, or a hash with a field beside its own', () => {
    expectTypeOf<IColorFormFieldProps['value']>().toEqualTypeOf<TColorFormFieldInput>();
    // a host takes it from the package
    expectTypeOf<TPackageColorInput>().toEqualTypeOf<TColorFormFieldInput>();
    expectTypeOf<'#6495ED'>().toMatchTypeOf<TColorFormFieldInput>();
    expectTypeOf<{ hex: string }>().toMatchTypeOf<TColorFormFieldInput>();
    expectTypeOf<{ hex: string; a: number }>().toMatchTypeOf<TColorFormFieldInput>();
    expectTypeOf<{
      r: number;
      g: number;
      b: number;
      a: number;
    }>().toMatchTypeOf<TColorFormFieldInput>();
    expectTypeOf<{
      r: number;
      g: number;
      b: number;
      hex: string;
    }>().toMatchTypeOf<TColorFormFieldInput>();
    // what the field stores is still only the hash
    expectTypeOf<Parameters<NonNullable<IColorFormFieldProps['onChange']>>[0]>().toEqualTypeOf<{
      r: number;
      g: number;
      b: number;
      a: number;
    }>();
    // @ts-expect-error a number is not a color the field reads
    const notAColor: TColorFormFieldInput = 42;
    expect(notAColor).toBe(42);
  });
});

describe('the color field, given a value as it is stored', () => {
  const renderField = (props: IColorFormFieldProps) =>
    render(
      <ReqoreUIProvider>
        <ColorFormField {...props} />
      </ReqoreUIProvider>
    );

  const input = (container: HTMLElement, name: string) =>
    container.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)!;

  /** The same color written another way: React gives no change event for the text an input already holds. */
  const retypeHex = (container: HTMLElement, text: string) => {
    fireEvent.change(input(container, 'hex'), { target: { value: text } });
    fireEvent.blur(input(container, 'hex'));
  };

  it('stores a hex code passed straight in as the hash, when it is saved unchanged', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: '#6495ED', onChange });
    expect(input(container, 'hex').value).toBe('6495ED');
    retypeHex(container, '6495ed');
    expect(onChange).toHaveBeenCalledWith({ r: 100, g: 149, b: 237, a: 1 });
  });

  it('stores { hex } passed straight in as the hash, its opacity kept', () => {
    const onChange = vi.fn();
    const { container } = renderField({
      value: { hex: '#6495ed', a: 0.5 },
      onChange,
      disableAlpha: false,
    });
    expect(input(container, 'a').value).toBe('50');
    retypeHex(container, '6495ed');
    expect(onChange).toHaveBeenCalledWith({ r: 100, g: 149, b: 237, a: 0.5 });
  });

  it('stores a hex code with its opacity as the hash', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: '#F808', onChange, disableAlpha: false });
    expect([input(container, 'hex').value, input(container, 'a').value]).toEqual(['FF8800', '53']);
    retypeHex(container, 'ff8800');
    expect(onChange).toHaveBeenCalledWith({ r: 255, g: 136, b: 0, a: 0.53 });
  });

  it('stores a hash with a field beside its own as the hash alone', () => {
    const onChange = vi.fn();
    const { container } = renderField({
      value: { r: 100, g: 149, b: 237, a: 1, hex: '#6495ED' },
      onChange,
    });
    retypeHex(container, '6495ed');
    expect(onChange).toHaveBeenCalledWith({ r: 100, g: 149, b: 237, a: 1 });
  });

  it('stores nothing when a stored hash is saved unchanged', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: { r: 100, g: 149, b: 237, a: 1 }, onChange });
    retypeHex(container, '6495ed');
    expect(onChange).not.toHaveBeenCalled();
  });
});
