// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { describeColorValue, ReqraftColorValue } from '../src/components/colorValue';
import * as reqraft from '../src/index';

/**
 * qorus#646: a color shown read-only - a swatch beside its value - is one component, `ReqraftColorValue`,
 * drawn the way a compact form row has drawn it (the row now uses it). It takes every shape a color is
 * stored in, says what an invalid value is instead of drawing a swatch for it, and is readable without
 * seeing the swatch.
 */

const renderValue = (ui: React.ReactElement) => render(<ReqoreUIProvider>{ui}</ReqoreUIProvider>);

describe('a color, described', () => {
  it.each([
    ['{ r, g, b }', { r: 100, g: 149, b: 237 }, '#6495ED', 'rgba(100, 149, 237, 1)'],
    ['{ r, g, b, a } opaque', { r: 0, g: 0, b: 255, a: 1 }, '#0000FF', 'rgba(0, 0, 255, 1)'],
    [
      '{ r, g, b, a } see-through',
      { r: 255, g: 0, b: 0, a: 0.5 },
      'rgba(255, 0, 0, 0.5)',
      'rgba(255, 0, 0, 0.5)',
    ],
    ['a hex code', '#abcdef', '#ABCDEF', '#abcdef'],
    ['a hex code without its #', 'abcdef', '#ABCDEF', '#abcdef'],
    ['a three-digit hex code', '#f80', '#F80', '#f80'],
    ['a hex code with its alpha', '#ff000080', '#FF000080', '#ff000080'],
    ['{ hex }', { hex: '#6495ed' }, '#6495ED', '#6495ed'],
  ])('%s is a color', (_shape, value, text, css) => {
    expect(describeColorValue(value)).toEqual({ kind: 'color', text, css });
  });

  it('brings a channel past its range into it, as the color field does', () => {
    expect(describeColorValue({ r: 300, g: -5, b: 0 })).toMatchObject({
      kind: 'color',
      text: '#FF0000',
    });
    expect(describeColorValue({ r: 0, g: 0, b: 0, a: 2 })).toMatchObject({ text: '#000000' });
    expect(describeColorValue({ r: 0, g: 0, b: 0, a: -1 })).toMatchObject({
      text: 'rgba(0, 0, 0, 0)',
    });
  });

  it.each([
    ['a hex code of letters past F', '#zzz', '“#zzz”'],
    ['a hex code of seven digits', '#abcdefa', '“#abcdefa”'],
    ['a color name', 'red', '“red”'],
    ['a channel that is not a number', { r: 'a', g: 0, b: 0 }, '{"r":"a","g":0,"b":0}'],
    ['a channel that is not finite', { r: Number.NaN, g: 0, b: 0 }, '{"r":null,"g":0,"b":0}'],
    ['a hash with no color in it', { name: 'blue' }, '{"name":"blue"}'],
    ['a number', 42, '42'],
  ])('%s is not a color, and is shown as it is', (_shape, value, shown) => {
    expect(describeColorValue(value)).toEqual({ kind: 'invalid', shown });
  });

  it('shortens a long value that is not a color', () => {
    const description = describeColorValue({ note: 'x'.repeat(200) });
    expect(description.kind).toBe('invalid');
    expect((description as { shown: string }).shown.length).toBeLessThanOrEqual(61);
    expect((description as { shown: string }).shown.endsWith('…')).toBe(true);
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['an empty string', ''],
    ['an empty hash', {}],
  ])('%s is no color', (_shape, value) => {
    expect(describeColorValue(value)).toEqual({ kind: 'empty' });
  });
});

describe('ReqraftColorValue', () => {
  it('is exported from the package', () => {
    expect(reqraft.ReqraftColorValue).toBe(ReqraftColorValue);
    expect(reqraft.describeColorValue).toBe(describeColorValue);
  });

  it('shows the color as text and gives its swatch a text alternative', () => {
    const { container } = renderValue(<ReqraftColorValue value={{ r: 100, g: 149, b: 237 }} />);
    const swatch = screen.getByRole('img', { name: 'Color #6495ED' });
    expect(swatch?.getAttribute('title')).toBe('Color #6495ED');
    expect(container.querySelector('.reqraft-color-value-text')?.textContent).toContain('#6495ED');
    expect(container.querySelector('.reqraft-color-value')?.getAttribute('data-color')).toBe(
      '#6495ED'
    );
  });

  it('paints the swatch the color it names, transparency kept', () => {
    renderValue(<ReqraftColorValue value={{ r: 255, g: 0, b: 0, a: 0.5 }} />);
    const swatch = screen.getByRole('img', { name: 'Color rgba(255, 0, 0, 0.5)' });
    expect(swatch?.getAttribute('data-swatch')).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('is one line at its compact size, and wraps at its normal size', () => {
    const { container } = renderValue(
      <>
        <ReqraftColorValue className='compact' size='compact' value='#6495ed' />
        <ReqraftColorValue className='normal' value='#6495ed' />
      </>
    );
    const text = (which: string) =>
      container.querySelector(`.${which} .reqraft-color-value-text`) as HTMLElement;
    expect(container.querySelector('.compact')?.getAttribute('data-size')).toBe('compact');
    expect(container.querySelector('.normal')?.getAttribute('data-size')).toBe('normal');
    expect(text('compact').style.whiteSpace).toBe('nowrap');
    expect(text('compact').style.textOverflow).toBe('ellipsis');
    expect(text('normal').style.whiteSpace).toBe('pre-wrap');
  });

  it('says what a value that is not a color is, and draws no swatch for it', () => {
    const { container } = renderValue(<ReqraftColorValue value='#zzz' />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('.reqraft-color-value')?.getAttribute('data-invalid')).toBe(
      'true'
    );
    expect(container.querySelector('.reqraft-color-value')?.textContent).toBe(
      'Not a color: “#zzz”'
    );
  });

  it('says there is no color, and draws no swatch, when there is none', () => {
    const { container } = renderValue(<ReqraftColorValue value={undefined} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('.reqraft-color-value')?.textContent).toContain('No color');
  });

  it("speaks the host's language", () => {
    const { container } = renderValue(
      <>
        <ReqraftColorValue
          className='valid'
          value='#f80'
          labels={{ swatch: (color) => `Farbe ${color}` }}
        />
        <ReqraftColorValue
          className='invalid'
          value='rot'
          labels={{ invalid: (shown) => `Keine Farbe: ${shown}` }}
        />
        <ReqraftColorValue className='empty' value={null} labels={{ empty: 'Keine Farbe' }} />
      </>
    );
    expect(screen.getByRole('img', { name: 'Farbe #F80' })).not.toBeNull();
    expect(container.querySelector('.invalid')?.textContent).toContain('Keine Farbe: “rot”');
    expect(container.querySelector('.empty')?.textContent).toContain('Keine Farbe');
  });
});
