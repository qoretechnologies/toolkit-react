// Copyright 2026 Qore Technologies, s.r.o.
// The SmartEditor's hover is of the character under the pointer, and of nothing where the pointer is on none.
//
// The browser finds the caret position nearest a point for any point - beside the text, above it, at the page's
// corner - and a pointer on no character asked the server about the nearest one. A scripted click sends its pointer
// events at the page's corner, so typing after it opened the hover of the first word, anchored in that corner over
// the text being typed (qorus#646, Foxhoundn on DpqlEditor · Accessor Chain Typed Out Is A Chip and Quoted Field
// Typed Out Is A Chip: "artifact text `field` and `@orders` on the top left of the chip").
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dom = vi.hoisted(() => ({
  editor: undefined as HTMLElement | undefined,
  /** Where each leaf's text starts in the line. */
  starts: new Map<Node, number>(),
}));

vi.mock('slate-react', () => ({
  ReactEditor: {
    toDOMNode: () => dom.editor,
    // a DOM position is the line's one text, as many leaves as it is drawn in
    toSlatePoint: (_editor: unknown, [node, offset]: [Node, number]) => ({
      path: [0, 0],
      offset: (dom.starts.get(node) ?? 0) + offset,
    }),
    toDOMRange: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }),
  },
}));

import { defaultSlateConverter } from '../../src/components/smartEditor/helpers';
import { useLspHover } from '../../src/components/smartEditor/useLspHover';

const HOVER = { kind: 'markdown', value: '**field** `@orders`' } as const;

let getHover: ReturnType<typeof vi.fn>;
/** The line's text, drawn in two leaves (as the semantic tokens split it): `@ord` and `ers`. */
let leaves: Text[];
/** Where the browser puts the caret for a point on the boundary between the leaves: the end of the first leaf,
 *  or the start of the second; it may give either. */
let boundaryIn: 'first' | 'second';

/** Each character of the editor's text is 8px wide, from x 10, on the line from y 4 to 20. */
const CHARACTER = { left: 10, width: 8, top: 4, bottom: 20 };

const hookOnAnEditor = () => {
  getHover = vi.fn(async () => HOVER);
  const session = { client: { getHover }, isReady: true, isContextReady: true } as any;
  const editorRef = {
    current: {
      selection: null,
      children: [{ type: 'paragraph', children: [{ text: '@orders' }] }],
    },
  } as any;
  return renderHook(() => useLspHover(session, editorRef, defaultSlateConverter));
};

/** A mouse's pointer moved to `x`, `y` over the editor, as a browser sends it. */
const pointerAt = (clientX: number, clientY: number) =>
  act(() => {
    dom.editor!.dispatchEvent(
      new PointerEvent('pointermove', { pointerType: 'mouse', clientX, clientY, bubbles: true })
    );
  });

/** The pointer rests: the hover is asked for once it has rested, and its answer comes back. */
const rest = () => act(() => vi.advanceTimersByTimeAsync(400));

const originalRangeBox = Range.prototype.getBoundingClientRect;
const originalElementBox = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  vi.useFakeTimers();
  boundaryIn = 'first';
  dom.editor = document.createElement('div');
  dom.editor.setAttribute('data-slate-editor', 'true');
  leaves = ['@ord', 'ers'].map((leafText) => {
    const leaf = document.createElement('span');
    const text = document.createTextNode(leafText);
    leaf.appendChild(text);
    dom.editor!.appendChild(leaf);
    return text;
  });
  dom.starts = new Map<Node, number>([
    [leaves[0], 0],
    [leaves[1], 4],
  ]);
  document.body.appendChild(dom.editor);
  // a page that lays the text out
  HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      left: 0,
      top: 0,
      right: 600,
      bottom: 24,
      width: 600,
      height: 24,
      x: 0,
      y: 0,
    } as DOMRect;
  };
  // a character's box, by where it starts in the line
  Range.prototype.getBoundingClientRect = function (this: Range) {
    const at = dom.starts.get(this.startContainer) ?? 0;
    const left = CHARACTER.left + (at + this.startOffset) * CHARACTER.width;
    const width = (this.endOffset - this.startOffset) * CHARACTER.width;
    return {
      left,
      right: left + width,
      width,
      top: CHARACTER.top,
      bottom: CHARACTER.bottom,
      height: CHARACTER.bottom - CHARACTER.top,
      x: left,
      y: CHARACTER.top,
    } as DOMRect;
  };
  // the caret position nearest a point, as the browser finds it: before the first character, for any point left
  // of the text or above it, else the boundary nearest the point
  (document as any).caretRangeFromPoint = (x: number) => {
    const range = document.createRange();
    const at = Math.max(0, Math.min(7, Math.round((x - CHARACTER.left) / CHARACTER.width)));
    if (at < 4 || (at === 4 && boundaryIn === 'first')) {
      range.setStart(leaves[0], at);
    } else {
      range.setStart(leaves[1], at - 4);
    }
    range.collapse(true);
    return range;
  };
});

afterEach(() => {
  dom.editor?.remove();
  delete (document as any).caretRangeFromPoint;
  Range.prototype.getBoundingClientRect = originalRangeBox;
  HTMLElement.prototype.getBoundingClientRect = originalElementBox;
  vi.useRealTimers();
});

describe('a mouse resting on the editor', () => {
  it('on a character asks for the hover of that character, and shows it', async () => {
    const { result } = hookOnAnEditor();

    pointerAt(CHARACTER.left + 2, 12);
    await rest();

    expect(getHover).toHaveBeenCalledTimes(1);
    expect(result.current.hoverContent).toEqual(HOVER);
  });

  it('at the page corner, on no character, asks for nothing and shows nothing', async () => {
    const { result } = hookOnAnEditor();

    pointerAt(0, 0);
    await rest();

    expect(getHover).not.toHaveBeenCalled();
    expect(result.current.hoverContent).toBeNull();
  });

  it('past the end of the text, on no character, asks for nothing', async () => {
    hookOnAnEditor();

    pointerAt(CHARACTER.left + 7 * CHARACTER.width + 40, 12);
    await rest();

    expect(getHover).not.toHaveBeenCalled();
  });

  it('under the line, on no character, asks for nothing', async () => {
    hookOnAnEditor();

    pointerAt(CHARACTER.left + 10, CHARACTER.bottom + 30);
    await rest();

    expect(getHover).not.toHaveBeenCalled();
  });
});

describe('a mouse resting where one leaf of the text meets the next', () => {
  /** The middle of the character at `index` of the line, or a point `dx` into it. */
  const onCharacterAt = (index: number, dx: number) =>
    CHARACTER.left + index * CHARACTER.width + dx;

  it("on the first half of the next leaf's first character asks for that character", async () => {
    // the caret is put at the end of the first leaf: the character under the pointer is in the next one
    boundaryIn = 'first';
    hookOnAnEditor();

    pointerAt(onCharacterAt(4, 2), 12);
    await rest();

    expect(getHover).toHaveBeenCalledTimes(1);
    expect(getHover).toHaveBeenCalledWith(0, 4);
  });

  it("on the second half of the first leaf's last character asks for that character", async () => {
    // the caret is put at the start of the second leaf: the character under the pointer is in the one before
    boundaryIn = 'second';
    hookOnAnEditor();

    pointerAt(onCharacterAt(3, 6), 12);
    await rest();

    expect(getHover).toHaveBeenCalledTimes(1);
    expect(getHover).toHaveBeenCalledWith(0, 3);
  });

  it('on the first character of a leaf, inside it, asks for that character', async () => {
    hookOnAnEditor();

    pointerAt(onCharacterAt(5, 2), 12);
    await rest();

    expect(getHover).toHaveBeenCalledWith(0, 5);
  });
});

describe('a mouse at the page corner, after the text has become a chip', () => {
  it('asks for nothing, though the caret position nearest it is in a zero-width leaf', async () => {
    // Slate's text before a chip: a zero-width character in a span of no width, where the browser puts the
    // caret position nearest the page's corner
    const zeroWidth = document.createElement('span');
    zeroWidth.setAttribute('data-slate-zero-width', 'z');
    const empty = document.createTextNode('\uFEFF');
    zeroWidth.appendChild(empty);
    dom.editor!.insertBefore(zeroWidth, dom.editor!.firstChild);
    const originalBox = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const box = originalBox.call(this);
      return this.hasAttribute('data-slate-zero-width') ?
          ({ ...box, width: 0, right: box.left } as DOMRect)
        : box;
    };
    (document as any).caretRangeFromPoint = () => {
      const range = document.createRange();
      range.setStart(empty, 0);
      range.collapse(true);
      return range;
    };
    hookOnAnEditor();

    pointerAt(0, 0);
    await rest();

    expect(getHover).not.toHaveBeenCalled();
  });
});

describe('a mouse outside the text', () => {
  it('asks for nothing where the caret position nearest it is in an element, not in a text', async () => {
    // outside every line the browser can give a caret position in the editor's element itself
    (document as any).caretRangeFromPoint = () => {
      const range = document.createRange();
      range.setStart(dom.editor!, 0);
      range.collapse(true);
      return range;
    };
    hookOnAnEditor();

    pointerAt(0, 0);
    await rest();

    expect(getHover).not.toHaveBeenCalled();
  });

  it('asks for nothing where what is under it is not the editor (a card drawn over its text)', async () => {
    // on the first character's place, but what the pointer is on there is something else, drawn over it
    const card = document.createElement('div');
    document.body.appendChild(card);
    (document as any).elementFromPoint = () => card;
    try {
      hookOnAnEditor();

      pointerAt(CHARACTER.left + 2, 12);
      await rest();

      expect(getHover).not.toHaveBeenCalled();
    } finally {
      delete (document as any).elementFromPoint;
      card.remove();
    }
  });
});
