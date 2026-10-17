// Copyright 2026 Qore Technologies, s.r.o.
// A hover's popover dismisses its own hover and nothing newer.
//
// A popover replaced by the next hover unmounts, and says it closed as it goes. Dismissing whatever hover was
// shown then dismissed the next one: the mouse resting on the next word showed nothing, and "Details" pressed
// while a hover was up showed nothing whenever the server answered before the old popover had gone - which a
// loaded CI runner did (SmartEditor › Hover Details On A Touch Screen timed out waiting for the hover).
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* The caret's place on the screen, where the hover is anchored: jsdom lays nothing out. */
const caret = vi.hoisted(() => ({ left: 10, top: 20 }));

vi.mock('slate-react', () => ({
  ReactEditor: {
    toDOMRange: () => ({ getBoundingClientRect: () => ({ left: caret.left, top: caret.top }) }),
    // no editor element: the mouse is not listened to here, only the caret
    toDOMNode: () => null,
  },
}));

import { defaultSlateConverter } from '../../src/components/smartEditor/helpers';
import { useLspHover } from '../../src/components/smartEditor/useLspHover';

const FOR_EACH = { kind: 'markdown', value: '**forEach**' } as const;
const MAP = { kind: 'markdown', value: '**map**' } as const;

let answer: unknown;

const hookOnACaret = () => {
  const session = {
    client: { getHover: vi.fn(async () => answer) },
    isReady: true,
    isContextReady: true,
  } as any;
  const editorRef = {
    current: {
      selection: { anchor: { path: [0, 0], offset: 2 }, focus: { path: [0, 0], offset: 2 } },
      children: [{ type: 'paragraph', children: [{ text: 'forEach map' }] }],
    },
  } as any;
  return renderHook(() => useLspHover(session, editorRef, defaultSlateConverter));
};

const showAtCaret = async (
  result: { current: ReturnType<typeof useLspHover> },
  content: unknown
) => {
  answer = content;
  await act(() => result.current.showAtCaret());
};

beforeEach(() => {
  answer = undefined;
  caret.left = 10;
  caret.top = 20;
});

describe('a hover dismissed by its popover', () => {
  it('is that hover alone: dismissed by an older one, the hover shown stays', async () => {
    const { result } = hookOnACaret();
    await showAtCaret(result, FOR_EACH);
    const older = result.current.hoverId;

    caret.left = 80;
    await showAtCaret(result, MAP);
    expect(result.current.hoverId).not.toBe(older);

    // the older hover's popover goes, and says it closed
    act(() => result.current.clearHover(older));
    expect(result.current.hoverContent).toEqual(MAP);
    expect(result.current.hoverPosition).toEqual({ left: 80, top: 20 });

    // the hover shown, dismissed by its own popover, goes
    act(() => result.current.clearHover(result.current.hoverId));
    expect(result.current.hoverContent).toBeNull();
    expect(result.current.hoverPosition).toBeNull();
  });

  it('is a new one each time one is shown, even at the same place', async () => {
    const { result } = hookOnACaret();
    expect(result.current.hoverId).toBe(0);
    await showAtCaret(result, FOR_EACH);
    const first = result.current.hoverId;
    await showAtCaret(result, FOR_EACH);

    expect(result.current.hoverId).toBeGreaterThan(first);
  });
});

describe('a hover dismissed with no hover named', () => {
  it('dismisses the hover shown, as the mouse leaving the editor does', async () => {
    const { result } = hookOnACaret();
    await showAtCaret(result, MAP);

    act(() => result.current.clearHover());

    expect(result.current.hoverContent).toBeNull();
  });
});

describe('a hover asked for by Details', () => {
  it('is anchored where it is asked to be, not at the caret, and says which hover it is', async () => {
    const { result } = hookOnACaret();
    answer = FOR_EACH;
    let shown: number | undefined;
    // under the Details button: the card opens beside the text, not over it
    await act(async () => {
      shown = await result.current.showAtCaret({ left: 300, top: 60 });
    });

    expect(result.current.hoverPosition).toEqual({ left: 300, top: 60 });
    expect(result.current.hoverContent).toEqual(FOR_EACH);
    expect(shown).toBe(result.current.hoverId);
  });

  it('says it showed nothing where the server says nothing', async () => {
    const { result } = hookOnACaret();
    answer = null;
    let shown: number | undefined = -1;
    await act(async () => {
      shown = await result.current.showAtCaret({ left: 300, top: 60 });
    });

    expect(shown).toBeUndefined();
    expect(result.current.hoverContent).toBeNull();
  });
});

describe('the caret on a word the server says nothing of', () => {
  it('shows no hover', async () => {
    const { result } = hookOnACaret();
    await showAtCaret(result, MAP);
    await showAtCaret(result, null);

    expect(result.current.hoverContent).toBeNull();
  });
});
