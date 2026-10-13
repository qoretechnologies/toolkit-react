// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreControlGroup, ReqoreUIProvider } from '@qoretechnologies/reqore';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReqraftColorValue } from '../src/components/colorValue';

/**
 * qorus#646 (found by the IDE's React-warning guard): a control group hands its layout props (fluid,
 * spaceBetween, size, ...) to each component in it, and ReqraftColorValue spread what it did not take onto its
 * span - React warned "Received `true` for a non-boolean attribute `fluid`" and "React does not recognize the
 * `spaceBetween` prop". It passes a DOM element only what a DOM element takes. A group's own size (small, big)
 * is not one of the value's sizes, and is read as the normal one rather than drawing nothing.
 */

/** What React wrote to console.error while `ui` rendered. */
const renderCollectingErrors = (ui: React.ReactElement) => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const result = render(ui);
    return { ...result, errors: consoleError.mock.calls.map((call) => call.map(String).join(' ')) };
  } finally {
    consoleError.mockRestore();
  }
};

/** What React says when a prop lands on a DOM element that does not take it. */
const DOM_PROPERTY_WARNING =
  /React does not recognize|non-boolean attribute|Invalid value for prop|Unknown event handler property|Invalid DOM property/;

const GROUP_PROPS = [
  'fluid',
  'spacebetween',
  'flat',
  'fixed',
  'fill',
  'stack',
  'intent',
  'customtheme',
  'minimal',
];

describe('ReqraftColorValue in a control group', () => {
  it('passes its span none of the props the group hands it', () => {
    const { container, errors } = renderCollectingErrors(
      <ReqoreUIProvider>
        <ReqoreControlGroup fluid spaceBetween fill flat intent='info' size='small'>
          <ReqraftColorValue value={{ r: 100, g: 149, b: 237 }} />
          <ReqraftColorValue value='#zzz' />
        </ReqoreControlGroup>
      </ReqoreUIProvider>
    );
    expect(errors.filter((error) => DOM_PROPERTY_WARNING.test(error))).toEqual([]);
    const values = Array.from(container.querySelectorAll('.reqraft-color-value'));
    expect(values).toHaveLength(2);
    for (const value of values) {
      for (const name of GROUP_PROPS) {
        expect(value.hasAttribute(name)).toBe(false);
      }
    }
  });

  it("reads a group's size it does not have as its normal size", () => {
    const { container } = render(
      <ReqoreUIProvider>
        <ReqoreControlGroup size='small'>
          <ReqraftColorValue value={{ r: 100, g: 149, b: 237 }} />
        </ReqoreControlGroup>
      </ReqoreUIProvider>
    );
    const value = container.querySelector('.reqraft-color-value')!;
    expect(value.getAttribute('data-size')).toBe('normal');
    expect(value.textContent).toBe('#6495ED');
  });

  it('still passes on the DOM attributes it is given', () => {
    const onClick = vi.fn();
    const { container } = render(
      <ReqraftColorValue
        value='#6495ed'
        id='brand'
        title='Brand colour'
        aria-describedby='brand-help'
        data-field='brand'
        onClick={onClick}
      />
    );
    const value = container.querySelector('.reqraft-color-value') as HTMLElement;
    expect(value.id).toBe('brand');
    expect(value.title).toBe('Brand colour');
    expect(value.getAttribute('aria-describedby')).toBe('brand-help');
    expect(value.getAttribute('data-field')).toBe('brand');
    value.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
