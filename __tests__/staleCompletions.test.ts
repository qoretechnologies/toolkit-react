// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The completion list shows the answer to the request it is waiting for, and only that one (qorus#646). An
 * answer still on its way when the list was put away, or when a newer request replaced it, used to open the
 * list anyway: typed `forEach`, Escape before the list came, and the list came under the next tap, which
 * took one of its rows - `forEachforEach`.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSlateConverter } from '../src/components/smartEditor/helpers';
import { useLspAutocomplete } from '../src/components/smartEditor/useLspAutocomplete';

/** The editor as Slate holds it after a key: its text, the caret at the end, and the edit's operations. */
const editorWith = (text: string) =>
  ({
    children: defaultSlateConverter.toSlateNodes(text),
    selection: { anchor: { path: [0, 0], offset: text.length }, focus: { path: [0, 0], offset: text.length } },
    operations: [{ type: 'insert_text' }],
  }) as never;

/** A server whose answers the test hands back itself, in any order. */
const setup = () => {
  const answers: ((items: { label: string }[]) => void)[] = [];
  const getCompletions = vi.fn(
    () => new Promise<{ label: string }[]>((resolve) => answers.push(resolve))
  );
  const hook = renderHook(() =>
    useLspAutocomplete({
      getCompletions,
      isReady: true,
      triggerCharacters: new Set(['.']),
      converter: defaultSlateConverter,
      inserter: vi.fn(),
    } as never)
  );
  /** Typed `text`, and the debounce has run out: a request on its way. */
  const type = async (text: string) => {
    const editor = editorWith(text);
    act(() => hook.result.current.onSlateChange(editor, (editor as any).children));
    await act(() => vi.advanceTimersByTimeAsync(1000));
  };
  return { answers, getCompletions, hook, type };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('an answer the list is no longer waiting for', () => {
  it('does not open the list once it has been put away', async () => {
    const { answers, getCompletions, hook, type } = setup();
    await type('arr.');
    expect(getCompletions).toHaveBeenCalledTimes(1);

    act(() => hook.result.current.close());
    await act(async () => answers[0]([{ label: 'forEach' }]));

    expect(hook.result.current.isOpen).toBe(false);
    expect(hook.result.current.items).toEqual([]);
  });

  it('gives way to the answer of a newer request', async () => {
    const { answers, getCompletions, hook, type } = setup();
    await type('arr.');
    await type('arr.ma');
    expect(getCompletions).toHaveBeenCalledTimes(2);

    // the newer answer first, then the older one, late
    await act(async () => answers[1]([{ label: 'map' }]));
    await act(async () => answers[0]([{ label: 'forEach' }, { label: 'filter' }]));

    expect(hook.result.current.isOpen).toBe(true);
    expect(hook.result.current.items.map(({ label }) => label)).toEqual(['map']);
  });
});
