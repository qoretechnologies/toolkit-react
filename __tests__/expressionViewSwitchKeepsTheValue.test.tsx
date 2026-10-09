// Copyright 2026 Qore Technologies, s.r.o.
// Leaving the Text view without an edit never changes the value (qorus#646).
//
// Going to Visual read the Text view's text back into the value whether or not anything had been typed. The
// text is the server's writing of the value, and a writer that cannot say all of it - Qore's DPQL serializer
// wrote `a + b` for a `+` of three arguments - made opening an expression on Text and looking at it in Visual
// drop the third argument from the stored expression.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const server = { parses: [] as string[], onReady: undefined as undefined | (() => void) };

/** What the lossy serializer writes for the three-argument `+` below, and what parsing it gives back. */
const LOSSY_TEXT = '"Run at " + format_number(9000000)';
const PARSED_FROM_LOSSY = {
  is_expression: true,
  value: {
    exp: '+',
    args: [
      { type: 'string', value: 'Run at ' },
      {
        type: 'int',
        value: { exp: 'format_number', args: [{ type: 'int', value: 9000000 }] },
        is_expression: true,
      },
    ],
  },
};

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ onChange, value, onReady }, ref) => {
    server.onReady = onReady;
    useImperativeHandle(
      ref,
      () => ({
        parse: async (text: string) => {
          server.parses.push(text);
          return {
            success: true,
            expression:
              text === LOSSY_TEXT ? PARSED_FROM_LOSSY : (
                {
                  is_expression: true,
                  value: { exp: '+', args: [{ type: 'string', value: text }] },
                }
              ),
            diagnostics: [],
          };
        },
        serialize: async () => LOSSY_TEXT,
      }),
      []
    );
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

/** `"Run at " + format_number(9000000) + " and that's it"`: a `+` of three arguments. */
const THREE_ARGUMENT_PLUS = {
  is_expression: true,
  value: {
    exp: '+',
    args: [
      { type: 'string', value: 'Run at ' },
      {
        type: 'int',
        value: { exp: 'format_number', args: [{ type: 'int', value: 9000000 }] },
        is_expression: true,
      },
      { type: 'string', value: " and that's it" },
    ],
  },
};

const storage = {
  storage: {},
  getStorage: (_path: string, defaultValue?: any) => defaultValue,
  updateStorage: () => undefined,
  removeStorageValue: () => undefined,
};

const onChange = vi.fn();
const show = () => {
  const Harness = () => {
    const [value, setValue] = useState<any>(THREE_ARGUMENT_PLUS);
    return (
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <ReqraftStorageContext.Provider value={storage as any}>
            <ExpressionField
              value={value}
              onChange={(v) => {
                onChange(v);
                setValue(v);
              }}
              defaultMode='text'
              expressions={[]}
            />
          </ReqraftStorageContext.Provider>
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
  };
  return render(<Harness />);
};

const pass = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** The Visual toggle: its label is drawn more than once (its marquee), so it is read as what it starts with. */
const visual = () =>
  screen
    .getAllByRole('button')
    .find((button) => button.textContent?.trim().startsWith('Visual')) as HTMLElement;

const opened = async () => {
  show();
  await act(async () => {
    server.onReady?.();
  });
  await pass(1000);
  expect((screen.getByTestId('fake-dpql') as HTMLTextAreaElement).value).toBe(LOSSY_TEXT);
};

beforeEach(() => {
  vi.useFakeTimers();
  server.parses = [];
  onChange.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('an expression opened on its Text view', () => {
  it('keeps every argument when it is looked at in Visual without an edit', async () => {
    await opened();
    await act(async () => {
      fireEvent.click(visual());
    });
    await pass(1000);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still takes what was typed when it goes to Visual', async () => {
    await opened();
    fireEvent.change(screen.getByTestId('fake-dpql'), { target: { value: '"edited"' } });
    await act(async () => {
      fireEvent.click(visual());
    });
    await pass(1000);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: expect.objectContaining({ exp: '+' }) })
    );
    expect(server.parses).toContain('"edited"');
  });
});
