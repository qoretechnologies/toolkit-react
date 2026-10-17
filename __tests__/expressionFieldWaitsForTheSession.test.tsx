// Copyright 2026 Qore Technologies, s.r.o.
// The Text view waits for its language server, and loses nothing while it does.
//
// Typed text was parsed 300ms after the last key whether or not the session was up. A parse before
// the session is ready answers `success: false`, and nothing asked again, so what was typed never
// reached the value (qorus#646: under load the IDE's test-case story stored nothing for `1 + 2`). The
// text an expression opens with was serialized by a retry loop that gave up after 20 tries of 400ms.
// Both now wait for the session's own signal; a server that cannot be reached is said, and the text
// typed is kept.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const server = {
  ready: false,
  parses: [] as string[],
  serializes: 0,
  onReady: undefined as undefined | (() => void),
  onUnavailable: undefined as undefined | (() => void),
};

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ onChange, readOnly, value, onReady, onUnavailable }, ref) => {
    server.onReady = onReady;
    server.onUnavailable = onUnavailable;
    useImperativeHandle(
      ref,
      () => ({
        // as useDpqlSession answers before its client is up: nothing parsed, nothing written
        parse: async (text: string) => {
          server.parses.push(text);
          return server.ready ?
              {
                success: true,
                expression: { is_expression: true, value: { exp: '+', args: [] } },
                diagnostics: [],
              }
            : { success: false, expression: null, diagnostics: [] };
        },
        serialize: async () => {
          server.serializes++;
          return server.ready ? '1 + 2' : '';
        },
      }),
      []
    );
    if (readOnly) return <span>{value}</span>;
    return (
      <textarea
        data-testid='fake-dpql'
        value={value}
        onChange={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      />
    );
  }),
}));

import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { FetchContext } from '../src/contexts/FetchContext';
import { ReqraftStorageContext } from '../src/contexts/StorageContext';
import { emptyFetchContext } from './support/fetchContext';

const ONE_PLUS_TWO = {
  is_expression: true,
  value: {
    exp: '+',
    args: [
      { type: 'int', value: 1 },
      { type: 'int', value: 2 },
    ],
  },
};

/** The Visual view keeps its own settings: a store that holds them for the test. */
const storage = {
  storage: {},
  getStorage: (_path: string, defaultValue?: any) => defaultValue,
  updateStorage: () => undefined,
  removeStorageValue: () => undefined,
};

let stored: any;
const show = (initial: any, initialText?: string) => {
  stored = initial;
  const Harness = () => {
    const [value, setValue] = useState<any>(initial);
    return (
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <ReqraftStorageContext.Provider value={storage as any}>
            <ExpressionField
              value={value}
              onChange={(v) => {
                stored = v;
                setValue(v);
              }}
              defaultMode='text'
              initialText={initialText}
              expressions={[]}
            />
          </ReqraftStorageContext.Provider>
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
  };
  return render(<Harness />);
};

/** Time passes: timers fire and what they started settles. */
const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  server.ready = false;
  server.parses = [];
  server.serializes = 0;
  server.onReady = undefined;
  server.onUnavailable = undefined;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the Text view before its language server is ready', () => {
  it('keeps what was typed, and reads it once the session is ready', async () => {
    show({ is_expression: true, value: { args: [] } });
    fireEvent.change(screen.getByTestId('fake-dpql'), { target: { value: '1 + 2' } });
    // long past the debounce, and past the 8s the old loop gave the session
    await pass(20000);
    expect(stored?.value?.exp).toBeUndefined();
    await act(async () => {
      server.ready = true;
      server.onReady?.();
    });
    await pass(1000);
    expect(server.parses[server.parses.length - 1]).toBe('1 + 2');
    expect(stored).toMatchObject({ is_expression: true, value: { exp: '+' } });
    expect((screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value).toBe('1 + 2');
  });

  it('asks nothing of a session that is not ready: no parse, no retry loop', async () => {
    show(ONE_PLUS_TWO);
    fireEvent.change(screen.getByTestId('fake-dpql'), { target: { value: '1 + 3' } });
    await pass(20000);
    expect(server.parses).toEqual([]);
    expect(server.serializes).toBe(0);
  });

  it('writes the expression it opens with once the session is ready, however late', async () => {
    show(ONE_PLUS_TWO);
    await pass(20000);
    await act(async () => {
      server.ready = true;
      server.onReady?.();
    });
    await pass(1000);
    expect((screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value).toBe('1 + 2');
  });

  it("keeps the host's own text: the session does not write over it once it is ready", async () => {
    // the value written as text on the Value tab, handed to the Text view as it reads there
    show(ONE_PLUS_TWO, 'concat("SUP-", $record:{pos})');
    await act(async () => {
      server.ready = true;
      server.onReady?.();
    });
    await pass(1000);
    expect((screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value).toBe(
      'concat("SUP-", $record:{pos})'
    );
    expect(server.serializes).toBe(0);
  });

  it('says so when the server cannot be reached, and keeps what was typed', async () => {
    const { container } = show({ is_expression: true, value: { args: [] } });
    fireEvent.change(screen.getByTestId('fake-dpql'), { target: { value: '1 + 2' } });
    await pass(1000);
    await act(async () => {
      server.onUnavailable?.();
    });
    await pass(100);
    expect((screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value).toBe('1 + 2');
    expect(container.querySelector('.expression-text-unavailable')?.textContent).toContain(
      'not available'
    );
  });

  it('shows the Visual view when the server cannot be reached and nothing was typed', async () => {
    const { container } = show(ONE_PLUS_TWO);
    await act(async () => {
      server.onUnavailable?.();
    });
    await pass(100);
    expect(screen.queryByTestId('fake-dpql')).toBeNull();
    expect(container.querySelector('.expression-text-unavailable')).toBeTruthy();
  });
});
