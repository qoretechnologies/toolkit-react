// Copyright 2026 Qore Technologies, s.r.o.
// The Preview speaks only for the expression the text holds now.
//
// The Preview is the server's rendering of the expression, asked for after a pause in typing. It kept the last
// rendering it had until the next one arrived, so after an edit, for the pause and the server's answer, it drew the
// previous expression's rendering under the new text: "record: pos" under `bezeichnung == bezeichnung`
// (FormEngine · The Text Lists What Can Be Written At The Caret On A Phone, caught in r15's capture). It now draws
// nothing until the rendering of the current expression arrives, and an answer for any other expression - one that
// arrives late, or out of order - is never drawn (qorus#646).
//
// The server here answers when, and in the order, the test says: nothing hangs on timing.
import { ReqoreUIProvider } from '@qoretechnologies/reqore';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The renderings asked for, in order, each with the expression asked about; answered by the test. */
const asked = vi.hoisted(
  () => [] as { ast: unknown; answer: (text: string) => void }[]
);

/* One function for the life of the test, as the hook's is: a new one would ask again on every render. */
const renderRich = vi.hoisted(
  () => (ast: unknown) =>
    new Promise<{ text: string; richtext: null }>((resolve) => {
      asked.push({ ast, answer: (text) => resolve({ text, richtext: null }) });
    })
);

vi.mock('../src/components/form/expressions/useRenderExpression', () => ({
  useRenderExpression: () => ({ renderRich }),
}));

vi.mock('../src/components/dpqlEditor', () => ({
  DpqlEditor: forwardRef<any, any>(({ value, onChange, readOnly, onReady }, ref) => {
    useEffect(() => {
      onReady?.();
    }, []);
    useImperativeHandle(
      ref,
      () => ({
        serialize: async () => 'first',
        // each text is its own expression
        parse: async (text: string) => ({
          success: true,
          expression: { is_expression: true, value: { exp: 'text', args: [text] } },
        }),
      }),
      []
    );
    if (readOnly) {
      return <span data-testid='fake-dpql-rendering'>{value}</span>;
    }
    return (
      <textarea
        data-testid='fake-dpql'
        value={value ?? ''}
        onChange={(e) => onChange?.((e.target as HTMLTextAreaElement).value)}
      />
    );
  }),
}));

import { ExpressionField } from '../src/components/form/expressions/ExpressionField';
import { FetchContext } from '../src/contexts/FetchContext';
import { emptyFetchContext } from './support/fetchContext';

const Harness = () => {
  const [value, setValue] = useState<any>({
    is_expression: true,
    value: { exp: 'text', args: ['first'] },
  });
  return (
    <ReqoreUIProvider>
      <FetchContext.Provider value={emptyFetchContext()}>
        <ExpressionField
          value={value}
          onChange={(v) => setValue(v)}
          type='auto'
          defaultMode='text'
          expressions={[]}
        />
      </FetchContext.Provider>
    </ReqoreUIProvider>
  );
};

const editor = () => screen.getByTestId('fake-dpql') as HTMLTextAreaElement;
const previewText = () => screen.queryByTestId('expression-preview')?.textContent ?? null;
const previewState = () =>
  document.querySelector('.expression-field')?.getAttribute('data-preview');
/** The text of the expression a rendering was asked about. */
const textOf = (request: { ast: unknown }) => (request.ast as { args: string[] }).args[0];

/** Past the parse's and the Preview's pauses, exactly, and what they set off. */
const pastThePauses = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
};

const answer = async (request: { answer: (text: string) => void }, text: string) => {
  await act(async () => {
    request.answer(text);
  });
};

/** Types `text`, and waits until the field has asked for the rendering of the expression it holds then. */
const write = async (text: string) => {
  fireEvent.change(editor(), { target: { value: text } });
  await pastThePauses();
  await waitFor(() => expect(asked.map(textOf)).toContain(text));
  return asked.find((request) => textOf(request) === text)!;
};

beforeEach(() => {
  asked.length = 0;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the Preview', () => {
  it("never draws the previous expression's rendering after an edit", async () => {
    render(<Harness />);
    await waitFor(() => expect(editor().value).toBe('first'));
    await pastThePauses();
    await waitFor(() => expect(asked.map(textOf)).toContain('first'));
    await answer(asked[asked.length - 1], 'the first, rendered');
    await waitFor(() => expect(previewText()).toBe('the first, rendered'));

    const forSecond = await write('second');
    // asked about the new expression, not answered yet: nothing is drawn for it, least of all the old rendering
    expect(previewText()).toBeNull();
    expect(previewState()).toBe('pending');

    await answer(forSecond, 'the second, rendered');
    await waitFor(() => expect(previewText()).toBe('the second, rendered'));
  });

  it('drops an answer for an earlier expression, whenever it arrives', async () => {
    render(<Harness />);
    await waitFor(() => expect(editor().value).toBe('first'));
    await pastThePauses();
    const forSecond = await write('second');
    const forThird = await write('third');

    // out of order: the current one first, the earlier one after it
    await answer(forThird, 'the third, rendered');
    await waitFor(() => expect(previewText()).toBe('the third, rendered'));
    await answer(forSecond, 'the second, rendered');
    await pastThePauses();
    expect(previewText()).toBe('the third, rendered');

    // and an earlier answer arriving before the current one is not drawn either
    const forFourth = await write('fourth');
    for (const request of asked.filter((r) => textOf(r) === 'first')) {
      await answer(request, 'the first, rendered');
    }
    await pastThePauses();
    expect(previewText()).toBeNull();
    await answer(forFourth, 'the fourth, rendered');
    await waitFor(() => expect(previewText()).toBe('the fourth, rendered'));
  });
});
