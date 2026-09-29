/**
 * The plain logic behind the A/B test overlay: where the handle and the card go (anchored to the
 * tested element, flipped above or below to stay in view), and which card is open (hover,
 * keyboard focus, a click; closed by ✕, Esc or a click outside). No React, no DOM
 * (unit-tested in `__tests__/tracking/anchor.test.ts`).
 */

// ── anchoring ────────────────────────────────────────────────────────────────────

export interface IBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface IPlaceInput {
  /** The tested element's box, in viewport coordinates. */
  box: IBox;
  viewport: { width: number; height: number };
  /** The page's scroll offset: the result is in document coordinates. */
  scroll: { x: number; y: number };
  /** The handle's measured size. */
  handle: { width: number; height: number };
  /** The card's measured size, when it is open (its natural height, before any cap). */
  card?: { height: number } | null;
  /** The part of the viewport the app's sticky header covers (the handle and the card stay below it). */
  topInset: number;
  /** The smallest distance to a viewport edge. */
  edge?: number;
  /** Between the handle and the card. */
  gap?: number;
  /** The card's widest. */
  maxWidth?: number;
  /** The side the card is on now: it stays there while it still fits, so it does not jump while scrolling. */
  side?: 'below' | 'above';
}

export interface IPlacement {
  /** False when no part of the element is on screen: nothing is drawn. */
  visible: boolean;
  /** Document coordinates. */
  outline: IBox;
  handle: { top: number; left: number };
  card: {
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    side: 'below' | 'above';
  } | null;
}

export const CARD_MAX_WIDTH = 440;
/** The card never gets shorter than this; a smaller window scrolls inside it. */
export const CARD_MIN_HEIGHT = 180;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/**
 * Where the outline, the handle and the card go. The handle sits at the element's top-left
 * corner and, while the element is partly scrolled away, slides down to stay on its visible
 * part. The card hangs under the handle, or above it when there is more room there than
 * below and it does not fit below; its height is capped to that room (it scrolls inside).
 */
export const placeCard = ({
  box,
  viewport,
  scroll,
  handle,
  card,
  topInset,
  edge = 12,
  gap = 8,
  maxWidth = CARD_MAX_WIDTH,
  side: current,
}: IPlaceInput): IPlacement => {
  const bottom = box.top + box.height;
  const right = box.left + box.width;
  const outline = {
    top: box.top + scroll.y,
    left: box.left + scroll.x,
    width: box.width,
    height: box.height,
  };
  const visible =
    bottom > topInset && box.top < viewport.height && right > 0 && box.left < viewport.width;

  // The handle: inside the element, below the header, above the element's bottom edge.
  const hTop = Math.min(Math.max(box.top + edge, topInset + edge), bottom - handle.height - edge);
  const hLeft = clamp(box.left + edge, edge, viewport.width - handle.width - edge);
  const handlePos = { top: Math.max(hTop, box.top) + scroll.y, left: hLeft + scroll.x };

  if (!card) return { visible, outline, handle: handlePos, card: null };

  const width = Math.min(maxWidth, viewport.width - 2 * edge);
  const left = clamp(hLeft, edge, viewport.width - width - edge);
  const handleTop = handlePos.top - scroll.y;
  const handleBottom = handleTop + handle.height;
  const below = viewport.height - edge - (handleBottom + gap);
  const above = handleTop - gap - (topInset + edge);
  const fits = { below: card.height <= below, above: card.height <= above };
  const side: 'below' | 'above' =
    current && fits[current] ? current
    : fits.below || below >= above ? 'below'
    : 'above';
  const room = Math.max(side === 'below' ? below : above, CARD_MIN_HEIGHT);
  const height = Math.min(card.height, room);
  const top = side === 'below' ? handleBottom + gap : handleTop - gap - height;
  return {
    visible,
    outline,
    handle: handlePos,
    card: { top: top + scroll.y, left: left + scroll.x, width, maxHeight: room, side },
  };
};

// ── which card is open ────────────────────────────────────────────────────────────

export interface ICardState {
  /** The test whose element (or card) the pointer is over. */
  hovered: string | null;
  /** The test whose handle or card holds the keyboard focus. */
  focused: string | null;
  /** The test opened with a click or a tap: stays open until closed. */
  pinned: string | null;
  /** Closed while the pointer was still over it: hovering it opens it again only after leaving it. */
  dismissed: string | null;
}

export type TCardEvent =
  | { type: 'hover'; key: string | null }
  | { type: 'focus'; key: string }
  | { type: 'blur'; key: string }
  | { type: 'toggle'; key: string }
  /** ✕, Esc, a click outside, an action that re-renders the element. */
  | { type: 'close' };

export const CLOSED: ICardState = { hovered: null, focused: null, pinned: null, dismissed: null };

/** The one open card: a click wins, then the keyboard, then the pointer. */
export const openCard = (s: ICardState): string | null =>
  s.pinned ?? s.focused ?? (s.hovered !== s.dismissed ? s.hovered : null);

export const cardReducer = (s: ICardState, e: TCardEvent): ICardState => {
  switch (e.type) {
    case 'hover':
      if (e.key === s.hovered) return s;
      // Leaving the element a card was closed on lets hovering open it again.
      return {
        ...s,
        hovered: e.key,
        dismissed: s.dismissed && s.dismissed !== e.key ? null : s.dismissed,
      };
    case 'focus':
      return s.focused === e.key && s.dismissed !== e.key ?
          s
        : { ...s, focused: e.key, dismissed: s.dismissed === e.key ? null : s.dismissed };
    case 'blur':
      return s.focused === e.key ? { ...s, focused: null } : s;
    case 'toggle':
      // A click on the handle of an open card pins it (hover or focus opened it); a second click closes it.
      return s.pinned === e.key ?
          cardReducer(s, { type: 'close' })
        : { ...s, pinned: e.key, dismissed: null };
    case 'close': {
      const open = openCard(s);
      if (!open) return s;
      return { hovered: s.hovered, focused: null, pinned: null, dismissed: s.hovered ?? open };
    }
  }
};

/** Enter or Space on a version's row itself (not on its Accept / Remove buttons) shows that version. */
export const activatesRow = (key: string, onRowItself: boolean) =>
  onRowItself && (key === 'Enter' || key === ' ');

/** Whether a click lands outside the overlay's cards (and outside Reqore's dialogs and menus they open). */
export const OUTSIDE_IGNORE =
  '[data-experiment-float], .reqore-modal, .reqore-popover-content, .reqore-drawer, .reqore-notification, [role="dialog"]';
