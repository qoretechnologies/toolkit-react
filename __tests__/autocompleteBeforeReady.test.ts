// Copyright 2026 Qore Technologies, s.r.o.
/**
 * A trigger typed before the language server session is ready - `$` or `@` while the connection is still
 * being made, or its context bound - opens the completions once the session is ready, for what the
 * editor holds then. It used to be dropped: the list was closed and nothing asked again (DpqlEditor
 * "With Templates" timed out whenever the session came up after the first key).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSlateConverter } from '../src/components/smartEditor/helpers';
import { useLspAutocomplete } from '../src/components/smartEditor/useLspAutocomplete';

/** The editor as Slate holds it after a key: its text, the caret at the end, and the edit's operations. */
const editorWith = (text: string, operations: { type: string }[] = [{ type: 'insert_text' }]) =>
  ({
    children: defaultSlateConverter.toSlateNodes(text),
    selection: { anchor: { path: [0, 0], offset: text.length }, focus: { path: [0, 0], offset: text.length } },
    operations,
  }) as never;

const setup = (isReady: boolean) => {
  const getCompletions = vi.fn().mockResolvedValue([{ label: 'data:', insertText: '$data:' }]);
  const hook = renderHook((props: { isReady: boolean }) =>
    useLspAutocomplete({
      getCompletions,
      isReady: props.isReady,
      triggerCharacters: new Set(['$', '@']),
      converter: defaultSlateConverter,
      inserter: vi.fn(),
    } as never),
    { initialProps: { isReady } }
  );
  return { getCompletions, hook };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a trigger typed before the session is ready', () => {
  it('opens the completions once the session is ready', async () => {
    const { getCompletions, hook } = setup(false);
    const editor = editorWith('$');
    act(() => hook.result.current.onSlateChange(editor, (editor as any).children));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(getCompletions).not.toHaveBeenCalled();

    hook.rerender({ isReady: true });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(getCompletions).toHaveBeenCalledWith('$', 1);
  });

  it('asks for what the editor holds when the session is ready, not what it held then', async () => {
    const { getCompletions, hook } = setup(false);
    const editor = editorWith('$');
    act(() => hook.result.current.onSlateChange(editor, (editor as any).children));
    // the author goes on typing while the session connects
    Object.assign(editor as any, editorWith('$da'));
    act(() => hook.result.current.onSlateChange(editor, (editor as any).children));

    hook.rerender({ isReady: true });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(getCompletions).toHaveBeenCalledTimes(1);
    expect(getCompletions).toHaveBeenCalledWith('$da', 3);
  });

  it('asks nothing for a caret moved before the session is ready', async () => {
    const { getCompletions, hook } = setup(false);
    const editor = editorWith('$', [{ type: 'set_selection' }]);
    act(() => hook.result.current.onSlateChange(editor, (editor as any).children));

    hook.rerender({ isReady: true });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(getCompletions).not.toHaveBeenCalled();
  });

  it('asks once, as before, for a trigger typed once the session is ready', async () => {
    const { getCompletions, hook } = setup(true);
    const editor = editorWith('@');
    act(() => hook.result.current.onSlateChange(editor, (editor as any).children));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(getCompletions).toHaveBeenCalledTimes(1);
    expect(getCompletions).toHaveBeenCalledWith('@', 1);
  });
});
