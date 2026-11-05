// Copyright 2026 Qore Technologies, s.r.o.
/* A host opens a row of a form that is already drawn, without drawing the form again (`expandOptionsRequest`). */
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const OPTIONS = {
  first: { type: 'string', display_name: 'First' },
  second: { type: 'string', display_name: 'Second' },
};
const VALUE = { first: { type: 'string', value: 'a' }, second: { type: 'string', value: 'b' } };

const draw = (
  props: Record<string, unknown> = {},
  options: unknown = OPTIONS,
  value: unknown = VALUE
) => (
  <ReqoreUIProvider>
    <FetchContext.Provider value={emptyFetchContext()}>
      <FormEngine
        compact
        name='request'
        value={value as never}
        options={options as never}
        onChange={vi.fn()}
        {...props}
      />
    </FetchContext.Provider>
  </ReqoreUIProvider>
);

const open = (name: string) =>
  !!document.querySelector(`[data-field="${name}"]`)?.querySelector('.readfirst-row-editing') ||
  !!document.querySelector(`[data-field="${name}"].readfirst-row-editing`);

describe('a row a host asks to open', () => {
  it('opens in the form as it is drawn, and what the reader opened stays open', async () => {
    const { rerender } = render(draw());
    await waitFor(() => expect(document.querySelector('[data-field="first"]')).toBeTruthy());
    act(() => {
      fireEvent.click(document.querySelector('[data-field="first"]')!);
    });
    await waitFor(() => expect(open('first')).toBe(true));
    rerender(draw({ expandOptionsRequest: { options: ['second'], key: 1 } }));
    await waitFor(() => expect(open('second')).toBe(true));
    // drawn again, the row the reader opened would be closed
    expect(open('first')).toBe(true);
  });

  it('is not opened again for a key it has answered, and is for a new one', async () => {
    const { rerender } = render(draw({ expandOptionsRequest: { options: ['second'], key: 1 } }));
    await waitFor(() => expect(open('second')).toBe(true));
    const done = document
      .querySelector('[data-field="second"]')
      ?.querySelector<HTMLElement>('[aria-label="Done"], [aria-label="Close field"]');
    expect(done, 'the row’s close').toBeTruthy();
    act(() => {
      fireEvent.click(done!);
    });
    await waitFor(() => expect(open('second')).toBe(false));
    rerender(draw({ expandOptionsRequest: { options: ['second'], key: 1 } }));
    expect(open('second')).toBe(false);
    rerender(draw({ expandOptionsRequest: { options: ['second'], key: 2 } }));
    await waitFor(() => expect(open('second')).toBe(true));
  });

  it('waits for a row the form does not have yet', async () => {
    const request = { options: ['second'], key: 'late' };
    const firstOnly = { first: VALUE.first };
    const { rerender } = render(
      draw({ expandOptionsRequest: request }, { first: OPTIONS.first }, firstOnly)
    );
    await waitFor(() => expect(document.querySelector('[data-field="first"]')).toBeTruthy());
    expect(open('second')).toBe(false);
    rerender(draw({ expandOptionsRequest: request }));
    await waitFor(() => expect(open('second')).toBe(true));
  });
});
