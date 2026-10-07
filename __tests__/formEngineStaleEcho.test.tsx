// Copyright 2026 Qore Technologies, s.r.o.
//
// A form whose parent takes its value back late must not be reset by the echo of an older emit: the
// sync-down read it as the parent's own change, and the keys typed since were lost (#131).
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/hooks/useStorage/useStorage', () => ({
  useReqraftStorage: (_k: string, d: unknown) => [d, vi.fn()],
}));

import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

const SCHEMA = {
  first: { type: 'int', display_name: 'First' },
  other: { type: 'string', display_name: 'Other' },
} as any;

/** A parent that takes the form's value back some time after it is emitted, as a store or a server does. */
let setFromOutside: (value: any) => void = () => undefined;

const Parent = ({ lag, emitted }: { lag: number; emitted: string[] }) => {
  const [value, setValue] = useState<any>({ first: { type: 'int', value: 1 }, other: { type: 'string', value: 'x' } });
  setFromOutside = setValue;
  return (
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <FormEngine
          name='form'
          options={SCHEMA}
          value={value}
          onChange={((_n: string, v: any) => {
            emitted.push(String(v?.first?.value ?? ''));
            setTimeout(() => setValue(v), lag);
          }) as never}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

describe('a form whose parent echoes its value late', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([0, 50, 150, 400])('keeps what was typed while an older value is still on its way back (%i ms)', async (lag) => {
    const emitted: string[] = [];
    const { container } = render(<Parent lag={lag} emitted={emitted} />);
    await act(() => vi.advanceTimersByTimeAsync(500));
    const input = [...container.querySelectorAll('input, textarea')].find(
      (el) => (el as HTMLInputElement).value === '1'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    for (const key of '23456789') {
      // a key is typed onto what the field shows, as a keyboard does: a field reset under the typing loses
      // what was typed before it
      fireEvent.change(input, { target: { value: input.value + key } });
      // keys a little slower than the field's own debounce, so each is emitted: the echoes overlap the typing
      await act(() => vi.advanceTimersByTimeAsync(130));
    }
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(input.value).toBe('123456789');
    expect(emitted.at(-1)).toBe('123456789');
  });

  it('still takes a change the parent makes itself', async () => {
    const emitted: string[] = [];
    const { container } = render(<Parent lag={150} emitted={emitted} />);
    await act(() => vi.advanceTimersByTimeAsync(500));
    const input = [...container.querySelectorAll('input, textarea')].find(
      (el) => (el as HTMLInputElement).value === '1'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(emitted.at(-1)).toBe('12');
    // the echo is scheduled when the emit's effect runs, at the end of that act: let it land
    await act(() => vi.advanceTimersByTimeAsync(1000));
    // a value this form never emitted is the parent's own: it is shown
    await act(async () => {
      setFromOutside({ first: { type: 'int', value: 77 }, other: { type: 'string', value: 'x' } });
    });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(input.value).toBe('77');
  });
});
