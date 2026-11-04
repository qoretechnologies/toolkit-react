// Copyright 2026 Qore Technologies, s.r.o.
// An expression is written as text (`dpql/serialize`) once, for both views (qorus#646).
//
// The Visual view has the server write what it builds, to check it; the Text view opens on the expression written as
// text. Entering the Text view while the Visual view's check was on its way, or after it, asked the server to write the
// same expression a second time.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const server = {
  writes: [] as unknown[],
  /** Holds the answers to writes until released, as a busy server does. */
  hold: false,
  held: [] as Array<() => void>,
  /** Answers with no text this many times first, as a session not up yet does. */
  empty: 0,
};

const write = (expression: unknown) => {
  server.writes.push(expression);
  return new Promise<string>((resolve) => {
    const answer = () => {
      if (server.empty > 0) {
        server.empty--;
        resolve('');
      } else {
        resolve('bestellnummer > pos');
      }
    };
    if (server.hold) {
      server.held.push(answer);
    } else {
      answer();
    }
  });
};

const parsed = {
  success: true,
  expression: { is_expression: true, value: { exp: '>', args: [] } },
  diagnostics: [],
  inferred_type: 'bool',
};

vi.mock('../src/components/dpqlEditor', () => ({
  // the Visual view's check: a session on the record's fields, up at once
  useDpqlSession: () => ({
    session: { isReady: true, isContextReady: true },
    serialize: write,
    parse: async () => parsed,
  }),
  // the Text view's editor, its session up at once
  DpqlEditor: forwardRef<any, any>(({ value, onReady }, ref) => {
    useEffect(() => {
      onReady?.();
    }, []);
    useImperativeHandle(ref, () => ({ serialize: write, parse: async () => parsed }), []);
    return <div data-testid='fake-dpql'>{value}</div>;
  }),
}));

import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { FetchContext } from '../src/contexts/FetchContext';
import { ReqraftStorageContext } from '../src/contexts/StorageContext';
import { emptyFetchContext } from './support/fetchContext';

const GREATER = {
  is_expression: true,
  value: {
    exp: '>',
    args: [
      { type: 'auto', value: '$record:{bestellnummer}' },
      { type: 'auto', value: '$record:{pos}' },
    ],
  },
};

const storage = {
  storage: {},
  getStorage: (_path: string, defaultValue?: any) => defaultValue,
  updateStorage: () => undefined,
  removeStorageValue: () => undefined,
};

const FIELDS = { bestellnummer: { type: 'int' }, pos: { type: 'int' } };

const show = () => {
  const Harness = () => {
    const [value, setValue] = useState<any>(GREATER);
    return (
      <ReqoreUIProvider>
        <FetchContext.Provider value={emptyFetchContext()}>
          <ReqraftStorageContext.Provider value={storage as any}>
            <ExpressionField
              value={value}
              onChange={setValue}
              defaultMode='visual'
              fields={FIELDS as any}
              expressions={[]}
            />
          </ReqraftStorageContext.Provider>
        </FetchContext.Provider>
      </ReqoreUIProvider>
    );
  };
  return render(<Harness />);
};

/** The Text toggle: its label is drawn more than once (its marquee), so it is read as what it starts with. */
const text = () =>
  screen
    .getAllByRole('button')
    .find((button) => button.textContent?.trim().startsWith('Text')) as HTMLElement;

beforeEach(() => {
  server.writes = [];
  server.hold = false;
  server.held = [];
  server.empty = 0;
});

describe('an expression seen in Visual, then in Text', () => {
  it('is written once, when the Visual view checked it before Text was opened', async () => {
    show();
    await waitFor(() => expect(server.writes).toHaveLength(1));
    await act(async () => {
      fireEvent.click(text());
    });
    await waitFor(() =>
      expect(screen.getByTestId('fake-dpql').textContent).toBe('bestellnummer > pos')
    );
    expect(server.writes).toHaveLength(1);
  });

  it("is written once, when Text is opened while the Visual view's check is still on its way", async () => {
    server.hold = true;
    show();
    await waitFor(() => expect(server.writes).toHaveLength(1));
    await act(async () => {
      fireEvent.click(text());
    });
    // the server answers the one write now
    await act(async () => {
      server.held.splice(0).forEach((answer) => answer());
    });
    await waitFor(() =>
      expect(screen.getByTestId('fake-dpql').textContent).toBe('bestellnummer > pos')
    );
    expect(server.writes).toHaveLength(1);
  });

  it('is written again for Text when the Visual view was given no text', async () => {
    server.empty = 1;
    show();
    await waitFor(() => expect(server.writes).toHaveLength(1));
    await act(async () => {
      fireEvent.click(text());
    });
    await waitFor(() =>
      expect(screen.getByTestId('fake-dpql').textContent).toBe('bestellnummer > pos')
    );
    expect(server.writes).toHaveLength(2);
    expect(server.writes[1]).toEqual(GREATER.value);
  });
});
