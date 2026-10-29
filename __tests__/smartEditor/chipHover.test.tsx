// Copyright 2026 Qore Technologies, s.r.o.
// A chip is hovered as the text it replaces (qorus#646, David: "there are no mouseover / hovers ... on the chips").
//
// A chip has no caret position of its own, so a mouse resting on one was mapped to no text and showed nothing, and
// "Details" with a tap on a chip asked for the character after it. The hover of a chip is what the server says at
// each part of its text (`converter.hoverOffsetsOf`), in one hover.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dom = vi.hoisted(() => ({
  editor: undefined as HTMLElement | undefined,
  chip: undefined as HTMLElement | undefined,
  chipNode: undefined as unknown,
}));

vi.mock('slate-react', () => ({
  ReactEditor: {
    toDOMNode: () => dom.editor,
    toSlateNode: () => dom.chipNode,
    findPath: () => [0, 1],
    // off any chip, the pointer is on the text, two characters in
    toSlatePoint: () => ({ path: [0, 0], offset: 2 }),
    toDOMRange: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }),
  },
}));

import { dpqlSlateConverter } from '../../src/components/dpqlEditor/dpqlHelpers';
import { useLspHover } from '../../src/components/smartEditor/useLspHover';
import { ISlateConverter } from '../../src/components/smartEditor/types';

const md = (value: string) => ({ kind: 'markdown', value }) as const;
/** What the server says at each character of `size(@create.items[*].id) > 1`. */
const SAYS: Record<number, ReturnType<typeof md>> = {
  5: md('**field** `@create.items`'),
  19: md('**operator** `[*]`'),
  22: md('**field** `id`'),
  2: md('**function** `size`'),
};

const CHIP = {
  type: 'tag',
  value: '@create.items[*].id',
  label: 'create.items[*].id',
  children: [{ text: '' }],
};
const DOCUMENT = [{ type: 'paragraph', children: [{ text: 'size(' }, CHIP, { text: ') > 1' }] }];

let getHover: ReturnType<typeof vi.fn>;

const hookOnAnEditor = (
  options: Parameters<typeof useLspHover>[3] = {},
  selection: unknown = null,
  converter: ISlateConverter = dpqlSlateConverter
) => {
  getHover = vi.fn(async (_line: number, character: number) => SAYS[character] ?? null);
  const session = { client: { getHover }, isReady: true, isContextReady: true } as any;
  const editorRef = { current: { selection, children: DOCUMENT } } as any;
  return renderHook(() => useLspHover(session, editorRef, converter, options));
};

/** The mouse resting at a point of the editor: on the chip (`onChip`) or on its text. */
const restMouse = async (onChip: boolean) => {
  (document as any).elementFromPoint = () => (onChip ? dom.chip!.firstElementChild : dom.editor);
  act(() => {
    dom.editor!.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerType: 'mouse',
        clientX: 20,
        clientY: 10,
        bubbles: true,
      })
    );
  });
  await act(() => vi.advanceTimersByTimeAsync(400));
};

beforeEach(() => {
  vi.useFakeTimers();
  dom.editor = document.createElement('div');
  dom.chip = document.createElement('span');
  dom.chip.setAttribute('data-slate-void', 'true');
  dom.chip.appendChild(document.createElement('span'));
  dom.editor.appendChild(dom.chip);
  dom.chipNode = CHIP;
  document.body.appendChild(dom.editor);
  (document as any).caretRangeFromPoint = () => document.createRange();
});

afterEach(() => {
  dom.editor?.remove();
  delete (document as any).caretRangeFromPoint;
  delete (document as any).elementFromPoint;
  vi.useRealTimers();
});

describe('a mouse resting on a chip', () => {
  it('is shown what the server says of each part of its text, in one hover', async () => {
    const { result } = hookOnAnEditor();
    await restMouse(true);

    expect(getHover.mock.calls).toEqual([
      [0, 5],
      [0, 19],
      [0, 22],
    ]);
    expect(result.current.hoverContent).toEqual(
      md('**field** `@create.items`\n\n---\n\n**operator** `[*]`\n\n---\n\n**field** `id`')
    );
  });

  it('is shown a part once where the server says the same of two', async () => {
    SAYS[22] = SAYS[5];
    try {
      const { result } = hookOnAnEditor();
      await restMouse(true);
      expect(result.current.hoverContent?.value).toBe(
        '**field** `@create.items`\n\n---\n\n**operator** `[*]`'
      );
    } finally {
      SAYS[22] = md('**field** `id`');
    }
  });

  it('is shown what the server says at its start, where the converter names no parts', async () => {
    const { hoverOffsetsOf: _none, ...converter } = dpqlSlateConverter;
    const { result } = hookOnAnEditor({}, null, converter);
    await restMouse(true);

    expect(getHover.mock.calls).toEqual([[0, 5]]);
    expect(result.current.hoverContent).toEqual(SAYS[5]);
  });

  it("is shown the chip's own hover alone, where it has one: nothing is asked of the server", async () => {
    const { result } = hookOnAnEditor({ chipHasOwnHover: () => true });
    await restMouse(true);

    expect(getHover).not.toHaveBeenCalled();
    expect(result.current.hoverContent).toBeNull();
  });

  it('off the chip, on its text, is shown what the server says there, as before', async () => {
    const { result } = hookOnAnEditor();
    await restMouse(false);

    expect(getHover.mock.calls).toEqual([[0, 2]]);
    expect(result.current.hoverContent).toEqual(SAYS[2]);
  });
});

describe('Details with the caret on a chip', () => {
  const caretAt = (path: number[], offset: number) => ({
    anchor: { path, offset },
    focus: { path, offset },
  });

  it('right after it, where a tap on the chip puts the caret: the chip', async () => {
    const { result } = hookOnAnEditor({}, caretAt([0, 2], 0));
    await act(async () => {
      await result.current.showAtCaret({ left: 1, top: 1 });
    });

    expect(getHover.mock.calls).toEqual([
      [0, 5],
      [0, 19],
      [0, 22],
    ]);
    expect(result.current.hoverContent?.value).toContain('**operator** `[*]`');
  });

  it('right before it, or with it selected: the chip', async () => {
    for (const selection of [caretAt([0, 0], 'size('.length), caretAt([0, 1, 0], 0)]) {
      const { result, unmount } = hookOnAnEditor({}, selection);
      await act(async () => {
        await result.current.showAtCaret({ left: 1, top: 1 });
      });
      expect(result.current.hoverContent?.value).toContain('**field** `id`');
      unmount();
    }
  });

  it('in the text away from a chip: what the server says at the caret, as before', async () => {
    const { result } = hookOnAnEditor({}, caretAt([0, 0], 2));
    await act(async () => {
      await result.current.showAtCaret({ left: 1, top: 1 });
    });

    expect(getHover.mock.calls).toEqual([[0, 2]]);
    expect(result.current.hoverContent).toEqual(SAYS[2]);
  });
});
