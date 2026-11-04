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
    expect(getCompletions).toHaveBeenCalledWith('$', 1, '$');
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
    expect(getCompletions).toHaveBeenCalledWith('$da', 3, '$da');
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
    expect(getCompletions).toHaveBeenCalledWith('@', 1, '@');
  });
});

/**
 * The picker lists the field's own templates, and needs no session. Opening it sets the caret its pick goes at, and
 * that selection change closed it while the session came up: the template button did nothing until then, and for
 * good where the language server cannot be reached.
 */
describe('the template picker opened before the session is ready', () => {
  const opened = () => {
    const { hook } = setup(false);
    const editor = editorWith('');
    act(() => hook.result.current.openBrowse(editor as never, { rect: { left: 0, bottom: 0 } } as never));
    return { hook };
  };

  it('stays open through the selection change that opening it makes', () => {
    const { hook } = opened();
    const echo = editorWith('', [{ type: 'set_selection' }]);
    act(() => hook.result.current.onSlateChange(echo, (echo as any).children));
    expect(hook.result.current.browse).toBeTruthy();
    expect(hook.result.current.isOpen).toBe(true);
  });

  it('is put away by typing, which is answered once the session is ready', async () => {
    const { hook } = opened();
    const typed = editorWith('$');
    act(() => hook.result.current.onSlateChange(typed, (typed as any).children));
    expect(hook.result.current.browse).toBeFalsy();
  });

  it('leaves the list at the caret closed by a selection change: it needs the session', () => {
    const { hook } = setup(false);
    const echo = editorWith('', [{ type: 'set_selection' }]);
    act(() => hook.result.current.onSlateChange(echo, (echo as any).children));
    expect(hook.result.current.isOpen).toBe(false);
  });
});

/**
 * The picker is drawn at a fixed point of the window, measured when it opens. When the window's width changed, the
 * button it was opened from moved with the layout and the picker did not (Foxhoundn on qlip #456: "Why is the popover
 * rendered so far to the right"). It follows what it was opened from.
 */
describe('the template picker when the window is resized', () => {
  const boxAt = (left: number, bottom: number) => ({ left, bottom, top: bottom - 10, right: left + 10 });

  const resized = () => {
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
  };

  it('stays at the element it was opened from', () => {
    const { hook } = setup(true);
    const button = document.createElement('button');
    document.body.appendChild(button);
    try {
      const measure = vi.spyOn(button, 'getBoundingClientRect');
      measure.mockReturnValue(boxAt(1000, 60) as DOMRect);
      act(() =>
        hook.result.current.openBrowse(editorWith('') as never, {
          rect: { left: 1000, bottom: 60 },
          anchor: button,
        } as never)
      );
      expect(hook.result.current.position).toEqual({ left: 1000, top: 60 });

      measure.mockReturnValue(boxAt(1500, 60) as DOMRect);
      resized();
      expect(hook.result.current.position).toEqual({ left: 1500, top: 60 });
      expect(hook.result.current.browse).toBeTruthy();
    } finally {
      button.remove();
    }
  });

  it('stays open and where it is when what it was opened from has been redrawn', () => {
    const { hook } = setup(true);
    const button = document.createElement('button');
    act(() =>
      hook.result.current.openBrowse(editorWith('') as never, {
        rect: { left: 1000, bottom: 60 },
        anchor: button,
      } as never)
    );
    // never in the page, as a chip a redraw took away is not; a phone's keyboard coming up is a resize too
    resized();
    expect(hook.result.current.isOpen).toBe(true);
    expect(hook.result.current.position).toEqual({ left: 1000, top: 60 });
  });

  it('does not move the list that typing put in its place, which is at the caret', () => {
    const { hook } = setup(true);
    const button = document.createElement('button');
    document.body.appendChild(button);
    try {
      const measure = vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(boxAt(1000, 60) as DOMRect);
      act(() =>
        hook.result.current.openBrowse(editorWith('') as never, {
          rect: { left: 1000, bottom: 60 },
          anchor: button,
        } as never)
      );
      const typed = editorWith('$');
      act(() => hook.result.current.onSlateChange(typed, (typed as any).children));
      expect(hook.result.current.browse).toBeFalsy();
      measure.mockClear();
      resized();
      expect(measure).not.toHaveBeenCalled();
    } finally {
      button.remove();
    }
  });

  it('stops listening once it is closed', () => {
    const { hook } = setup(true);
    const button = document.createElement('button');
    document.body.appendChild(button);
    try {
      const measure = vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(boxAt(1, 2) as DOMRect);
      act(() =>
        hook.result.current.openBrowse(editorWith('') as never, {
          rect: { left: 1, bottom: 2 },
          anchor: button,
        } as never)
      );
      act(() => hook.result.current.close());
      measure.mockClear();
      resized();
      expect(measure).not.toHaveBeenCalled();
    } finally {
      button.remove();
    }
  });
});
