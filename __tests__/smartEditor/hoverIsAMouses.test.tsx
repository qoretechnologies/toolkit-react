// Copyright 2026 Qore Technologies, s.r.o.
// The SmartEditor's hover is a mouse's: a finger's tap asks for none.
//
// A tap is followed by the mouse events a browser emulates - `mousemove` among them, at the tap - and the
// editor listened for `mousemove`, so a tap that put the caret in the editor opened the server's hover there,
// beside the Details button that is a finger's way to it. The editor listens for pointer events now, and a
// hover starts only for a pointer that hovers.
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

const HOVER = { kind: 'markdown', value: '**forEach**' } as const;

let getHover: ReturnType<typeof vi.fn>;

const hookOnAnEditor = () => {
  getHover = vi.fn(async () => HOVER);
  const session = { client: { getHover }, isReady: true, isContextReady: true } as any;
  const editorRef = {
    current: {
      selection: null,
      children: [{ type: 'paragraph', children: [{ text: 'forEach map' }] }],
    },
  } as any;
  return renderHook(() => useLspHover(session, editorRef, defaultSlateConverter));
};

/** A pointer event over the editor, as a browser sends it. */
const pointer = (type: string, pointerType: string, buttons = 0) =>
  act(() => {
    dom.editor!.dispatchEvent(
      new PointerEvent(type, { pointerType, buttons, clientX: 20, clientY: 10, bubbles: true })
    );
  });

/** The pointer rests: the hover is asked for once it has rested 300 ms, and its answer comes back. */
const rest = () => act(() => vi.advanceTimersByTimeAsync(400));

beforeEach(() => {
  vi.useFakeTimers();
  dom.editor = document.createElement('div');
  document.body.appendChild(dom.editor);
  // where the pointer is in the text: the editor's own caret range, as the browser finds it
  (document as any).caretRangeFromPoint = () => document.createRange();
});

afterEach(() => {
  dom.editor?.remove();
  delete (document as any).caretRangeFromPoint;
  vi.useRealTimers();
});

describe('a mouse resting on the editor', () => {
  it('asks for the hover, and shows it', async () => {
    const { result } = hookOnAnEditor();

    pointer('pointermove', 'mouse');
    await rest();

    expect(getHover).toHaveBeenCalledTimes(1);
    expect(result.current.hoverContent).toEqual(HOVER);
  });

  it('takes its hover away as it leaves', async () => {
    const { result } = hookOnAnEditor();
    pointer('pointermove', 'mouse');
    await rest();

    pointer('pointerleave', 'mouse');

    expect(result.current.hoverContent).toBeNull();
  });
});

describe('a pen', () => {
  it('held above the screen hovers, as a mouse does', async () => {
    hookOnAnEditor();
    pointer('pointermove', 'pen', 0);
    await rest();

    expect(getHover).toHaveBeenCalledTimes(1);
  });

  it('pressed to the screen is drawing, and asks for nothing', async () => {
    hookOnAnEditor();
    pointer('pointermove', 'pen', 1);
    await rest();

    expect(getHover).not.toHaveBeenCalled();
  });
});

describe('a finger', () => {
  it('asks for no hover, nor do the mouse events a browser emulates after its tap', async () => {
    const { result } = hookOnAnEditor();

    // a tap, as Chromium sends it: the finger's pointer events, then the emulated mouse's
    pointer('pointerdown', 'touch', 1);
    pointer('pointerup', 'touch');
    act(() => {
      dom.editor!.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 20, clientY: 10, bubbles: true })
      );
    });
    pointer('pointermove', 'touch');
    await rest();

    expect(getHover).not.toHaveBeenCalled();
    expect(result.current.hoverContent).toBeNull();
  });

  it('lifted off the editor, leaves a hover that is up (one Details showed)', async () => {
    const { result } = hookOnAnEditor();
    pointer('pointermove', 'mouse');
    await rest();

    pointer('pointerleave', 'touch');

    expect(result.current.hoverContent).toEqual(HOVER);
  });
});
