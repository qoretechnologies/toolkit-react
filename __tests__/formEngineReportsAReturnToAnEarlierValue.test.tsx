// Copyright 2026 Qore Technologies, s.r.o.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/components/form/engine/FormEngine';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const fetchContext = emptyFetchContext();

/**
 * A value edited back to one the form reported before is reported again (qorus#646).
 *
 * A, then B, then A again: the Qorus IDE's template field, given a reference ("$record:{pos}"), then text
 * after it (" Stk."), then that text deleted. The IDE's host stores a field under its own type (what an
 * `int` field reported comes back as a `string`), so its echo of B was not recognised as the form's own
 * report. The echo arrived in the same commit as the edit back to A, which was then held back as an edit
 * made before the host's change, and the field went back to B: the host kept "$record:{pos} Stk.".
 */

/** A field editor the test types into from outside: what it reports goes straight to the form. */
const editor: { report?: (value: string) => void } = {};
const ProbeText = ({ onChange }: { onChange: (value: string) => void }) => {
  editor.report = onChange;
  return null;
};

const host: { values: unknown[]; reported: unknown[] } = { values: [], reported: [] };

/**
 * A host that stores each report under its own type (`string`), as the IDE does, and hands it back down
 * `echoDelay` ms after it was told.
 */
const Host = ({ field, echoDelay }: { field: Record<string, unknown>; echoDelay: number }) => {
  const [value, setValue] = useState<Record<string, unknown>>({});
  host.values.push(value?.qty);
  const onChange = useCallback(
    (_name: string, next: Record<string, { value?: unknown }>) => {
      host.reported.push(next?.qty?.value);
      const stored =
        next?.qty?.value === undefined ? {} : { qty: { type: 'string', value: next.qty.value } };
      setTimeout(() => setValue(stored), echoDelay);
    },
    [echoDelay]
  );
  return (
    <FormEngine
      compact
      name='form'
      value={value as never}
      options={{ qty: field } as never}
      componentOverrides={{ 'probe-text': ProbeText }}
      // the editor's name, not a type a value is stored as: as the IDE registers its own editors
      rendererOnlyUiTypes={['probe-text']}
      initialExpandedOptions={['qty']}
      onChange={onChange as never}
    />
  );
};

const renderHost = async (field: Record<string, unknown>, echoDelay: number) => {
  host.values = [];
  host.reported = [];
  editor.report = undefined;
  const view = render(
    <ReqoreUIProvider>
      <FetchContext.Provider value={fetchContext}>
        <Host field={field} echoDelay={echoDelay} />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
  await pass(500);
  return view;
};

/** Lets `ms` of fake time pass in 10 ms steps, each in an `act` of its own. */
const pass = async (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 10) {
    await act(() => vi.advanceTimersByTimeAsync(10));
  }
};

const lastHeld = () =>
  (host.values[host.values.length - 1] as { value?: unknown } | undefined)?.value;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a template field edited back to a value it reported before', () => {
  const FIELD = { type: 'int', ui_type: 'probe-text', display_name: 'Qty', preselected: true };

  it('reports it again when the echo of the other comes back with it', async () => {
    await renderHost(FIELD, 50);
    act(() => editor.report!('$record:{pos}'));
    await pass(300);
    act(() => editor.report!('$record:{pos} Stk.'));
    // the echo of " Stk." arrives in the same commit as the edit back to the reference alone
    act(() => {
      vi.advanceTimersByTime(50);
      editor.report!('$record:{pos}');
    });
    await pass(300);

    expect(host.reported[host.reported.length - 1]).toBe('$record:{pos}');
    expect(lastHeld()).toBe('$record:{pos}');
  });

  it('reports it again when the echo came back before the edit', async () => {
    await renderHost(FIELD, 50);
    act(() => editor.report!('$record:{pos}'));
    await pass(300);
    act(() => editor.report!('$record:{pos} Stk.'));
    await pass(300);
    act(() => editor.report!('$record:{pos}'));
    await pass(300);

    expect(host.reported[host.reported.length - 1]).toBe('$record:{pos}');
    expect(lastHeld()).toBe('$record:{pos}');
  });
});

describe('a number field edited back to a value it reported before', () => {
  const FIELD = { type: 'int', ui_type: 'int', display_name: 'Qty', preselected: true };

  it('reports it again when the echo of the other comes back with it', async () => {
    const { container } = await renderHost(FIELD, 150);
    const input = () => container.querySelector<HTMLInputElement>('[data-field="qty"] input')!;

    fireEvent.change(input(), { target: { value: '5' } });
    await pass(500);
    fireEvent.change(input(), { target: { value: '56' } });
    // 56 is reported 100 ms after it was typed, and its echo comes 150 ms after that
    await pass(150);
    // back to 5, reported 100 ms later: as the echo of 56 arrives
    fireEvent.change(input(), { target: { value: '5' } });
    await pass(500);

    expect(host.reported[host.reported.length - 1]).toBe(5);
    expect(lastHeld()).toBe(5);
  });
});
