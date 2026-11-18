// Copyright 2026 Qore Technologies, s.r.o.
/**
 * An open field's card pins its header while its long body is read.
 *
 * A card is the shape a complex field opens into: a heading (the field's name, its badges and its actions) over an
 * editor as tall as what it holds. The IDE's test Cases field is one, with a case list a few screens long. Scrolled
 * into it, the heading had left the screen, and with it the name of what the reader was looking at and its actions.
 *
 * The rule is the one every pinned heading in the Qore apps follows (instruction-files decision 028; Reqore's
 * `STICKY_HEADER_TALL_SCREENS`): the heading pins only while its card is more than one and a half times the height of
 * its scroll area. A card that fits, or nearly does, never puts the reader out of sight of its heading, and pinned for
 * the few pixels it overhung it would draw a band with nothing under it to label.
 *
 * It pins UNDER whatever is already pinned above it in the same scroller, never over it: the form's toolbar and the
 * header of the status box the card sits in, which are read from the DOM (`getPinnedChromeHeight`), so a host's own
 * offset, a toolbar that wraps or a box header that does not pin are all counted without the card knowing about them.
 * Outer things stay on top, as everywhere else in the form.
 */
import { RefObject, useEffect, useState } from 'react';
import { getPinnedChromeHeight } from './revealRow';

/**
 * How many screens of its scroll area a card must span before its header pins. The same line as Reqore's
 * `STICKY_HEADER_TALL_SCREENS` (decision 028), stated here because reqraft supports Reqore releases older than it.
 */
export const CARD_HEADER_TALL_SCREENS = 1.5;

/**
 * Where a pinned card header is drawn, in the card's own stacking context (the card isolates itself while it pins):
 * above every pinned caption a host's editor draws in the card's body, so the body scrolls under its heading. The
 * IDE's case diagram pins its lane headings at 31 and its case band at 40. Isolated, the number reaches nothing
 * outside the card, which stays under the form's toolbar and box headers.
 */
export const CARD_HEADER_PIN_Z_INDEX = 50;

/** Whether a card's header pins, and the sticky `top` it pins at. */
export interface ICardHeaderPin {
  pins: boolean;
  top: number;
}

const NOT_PINNED: ICardHeaderPin = { pins: false, top: 0 };

/**
 * The box a `position: sticky` descendant of `node` pins against: the nearest ancestor whose vertical overflow is
 * not `visible` or `clip` (a `hidden` one captures a sticky descendant too), or `null` for the viewport.
 */
export const getStickyScrollport = (node: HTMLElement): HTMLElement | null => {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (el === document.body || el === document.documentElement) {
      return null;
    }
    const { overflowY } = getComputedStyle(el);
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay' ||
      overflowY === 'hidden'
    ) {
      return el;
    }
  }
  return null;
};

/**
 * Measures whether `card`'s header pins and where.
 *
 * @param card the card element (`.options-readfirst-card`)
 * @param hostOffset the host's own pinned chrome above the form (`compactStickyOffset`), the line the header pins at
 * when nothing of the form's is pinned above it
 */
export const measureCardHeaderPin = (card: HTMLElement, hostOffset = 0): ICardHeaderPin => {
  const scrollport = getStickyScrollport(card);
  let visibleHeight = window.innerHeight;
  let inset = 0;
  if (scrollport) {
    const style = getComputedStyle(scrollport);
    inset = parseFloat(style.paddingTop) || 0;
    visibleHeight = scrollport.clientHeight - inset - (parseFloat(style.paddingBottom) || 0);
  }
  if (card.getBoundingClientRect().height <= visibleHeight * CARD_HEADER_TALL_SCREENS) {
    return NOT_PINNED;
  }
  /* A sticky `top` counts from the scrollport's content box, inside its padding; the pinned headers above report
     theirs in the same terms (Reqore takes the padding off), so the two compose. With nothing pinned above it, the
     heading pins at the host's line, which in a padded scrollport is a `top` below zero. */
  return {
    pins: true,
    top: Math.round(getPinnedChromeHeight(card, hostOffset - inset)),
  };
};

/**
 * Keeps a card's pin current: measured when the card opens, when it or its scroll area changes size, and on scroll,
 * once a frame. Pinning changes no size (sticky keeps the header's place in the flow), so the measurement never
 * undoes itself.
 *
 * @param cardRef the card element; nothing is measured while it is not drawn
 * @param enabled whether the form pins card headers and the row is open as a card
 * @param hostOffset see `measureCardHeaderPin`
 */
export const useCardHeaderPin = (
  cardRef: RefObject<HTMLElement>,
  enabled: boolean,
  hostOffset = 0
): ICardHeaderPin => {
  const [pin, setPin] = useState<ICardHeaderPin>(NOT_PINNED);

  useEffect(() => {
    const card = cardRef.current;
    if (!enabled || !card) {
      setPin(NOT_PINNED);
      return undefined;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = measureCardHeaderPin(card, hostOffset);
      setPin((current) =>
        current.pins === next.pins && current.top === next.top ? current : next
      );
    };
    /* Once a frame, and never inside a ResizeObserver callback: a box header above the card pins in Reqore's own
       render after a resize, and a frame later is when it can be read. */
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const scrollport = getStickyScrollport(card);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : undefined;
    observer?.observe(card);
    if (scrollport) observer?.observe(scrollport);
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      observer?.disconnect();
      document.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [cardRef, enabled, hostOffset]);

  return enabled ? pin : NOT_PINNED;
};
