// Copyright 2026 Qore Technologies, s.r.o.
// A mouse that came to rest on the editor's text before its session could answer is answered once it can.
//
// A read-only summary drawn as a row closes connects its session after it is drawn; a mouse already resting on a
// word there showed nothing until it moved again (FormEngine · Compact Expression Template Chips, in Storybook's
// UI, where the play's mouse rests once and does not move).
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dom = vi.hoisted(() => ({ editor: undefined as HTMLElement | undefined }));

vi.mock('slate-react', () => ({
  ReactEditor: {
    toDOMNode: () => dom.editor,
    // wherever the pointer is, it is on the editor's text, two characters in
    toSlatePoint: () => ({ path: [0, 0], offset: 2 }),
    toDOMRange: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }),
  },
}));

import { defaultSlateConverter } from '../../src/components/smartEditor/helpers';
import { useLspHover } from '../../src/components/smartEditor/useLspHover';

const HOVER = { kind: 'markdown', value: '**trim**' } as const;

const editorRef = {
  current: {
    selection: null,
    children: [{ type: 'paragraph', children: [{ text: 'trim(x)' }] }],
  },
} as any;

/** The hook on an editor whose session answers from when `ready` says so. */
const hookOnAnEditor = (getHover: ReturnType<typeof vi.fn>) =>
  renderHook(
    ({ ready }: { ready: boolean }) =>
      useLspHover(
        { client: { getHover }, isReady: ready, isContextReady: ready } as any,
        editorRef,
        defaultSlateConverter
      ),
    { initialProps: { ready: false } }
  );

const pointer = (type: string) =>
  act(() => {
    dom.editor!.dispatchEvent(
      new PointerEvent(type, { pointerType: 'mouse', clientX: 20, clientY: 10, bubbles: true })
    );
  });

const rest = () => act(() => vi.advanceTimersByTimeAsync(400));

beforeEach(() => {
  vi.useFakeTimers();
  dom.editor = document.createElement('div');
  document.body.appendChild(dom.editor);
  (document as any).caretRangeFromPoint = () => document.createRange();
});

afterEach(() => {
  dom.editor?.remove();
  delete (document as any).caretRangeFromPoint;
  vi.useRealTimers();
});

describe('a mouse resting on the text before the session can answer', () => {
  it('is answered once it can, without moving', async () => {
    const getHover = vi.fn(async () => HOVER);
    const { result, rerender } = hookOnAnEditor(getHover);
    pointer('pointermove');
    await rest();
    expect(getHover).not.toHaveBeenCalled();

    rerender({ ready: true });
    await rest();

    expect(getHover).toHaveBeenCalledTimes(1);
    expect(result.current.hoverContent).toEqual(HOVER);
  });

  it('is not, once it has left the text', async () => {
    const getHover = vi.fn(async () => HOVER);
    const { result, rerender } = hookOnAnEditor(getHover);
    pointer('pointermove');
    pointer('pointerleave');

    rerender({ ready: true });
    await rest();

    expect(getHover).not.toHaveBeenCalled();
    expect(result.current.hoverContent).toBeNull();
  });

  it('is asked once, not again while the session stays ready', async () => {
    const getHover = vi.fn(async () => HOVER);
    const { rerender } = hookOnAnEditor(getHover);
    pointer('pointermove');
    rerender({ ready: true });
    await rest();
    rerender({ ready: true });
    await rest();

    expect(getHover).toHaveBeenCalledTimes(1);
  });
});
