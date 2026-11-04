// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A read-first row opened and left alone leaves the form as it was (qorus#646).
 *
 * An unset number or binary row reported '' 100 ms after it opened: the row's Cancel appeared as if
 * something had been typed, and the host was told the field was ''. The Qorus IDE's API schema builder
 * showed it on a node's empty Minimum.
 */

const OPTIONS = {
  minimum: { type: 'float', ui_type: 'float', display_name: 'Minimum', preselected: true },
  payload: { type: 'binary', ui_type: 'binary', display_name: 'Payload', preselected: true },
} as never;

beforeEach(() => {
  // the pauses run on the test's clock; everything else runs as it would
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each(['minimum', 'payload'])('the unset %s row, opened and left alone', (field) => {
  it('reports nothing and offers no Cancel', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <ReqoreUIProvider>
        <FetchContext.Provider value={fetchContext}>
          <FormEngine
            compact
            name='node'
            value={{} as never}
            options={OPTIONS}
            onChange={onChange}
          />
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
    await waitFor(() => expect(container.querySelector(`[data-field="${field}"]`)).toBeTruthy());
    fireEvent.click(container.querySelector(`[data-field="${field}"]`)!);
    await waitFor(() =>
      expect(container.querySelector(`[data-field="${field}"].readfirst-row-editing`)).toBeTruthy()
    );
    onChange.mockClear();

    // past the pause after which a field reports what it holds
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(container.querySelector('.options-readfirst-cancel')).toBeNull();
    expect(
      onChange.mock.calls.some(
        ([, value]) => (value as Record<string, any> | undefined)?.[field]?.value !== undefined
      )
    ).toBe(false);
  });
});
