// Copyright 2026 Qore Technologies, s.r.o.

/** What `isHoveringPointer` reads of a pointer event: a DOM `PointerEvent` or React's own. */
export interface IHoveringPointerEvent {
  pointerType: string;
  buttons: number;
}

/**
 * The pointer can hover: a mouse, or a pen held above the screen. A finger cannot.
 *
 * A tap is followed by the mouse events a browser emulates for pages written for a mouse - `mousemove`,
 * `mouseenter`, `mousedown`, `mouseup`, `click` - at the tap, with nothing in them to tell them from a mouse's.
 * Something shown on `mouseenter` or `mousemove` was therefore shown by a tap too: the SmartEditor's hover
 * opened where the finger had put the caret, beside its own Details button (qorus#646), and a compact form's
 * group highlight lit at a tap and stayed lit until the next. The pointer event before them says what the
 * pointer was, so a hover starts on a pointer event, and only for a pointer this says can hover.
 *
 * It is asked of each event, not of the device: a touch laptop's mouse hovers, and so does a mouse plugged
 * into a tablet, whose screen is still a finger's. A pen hovers while it is held above the screen
 * (`buttons` 0); pressed to it, it is drawing, not hovering.
 */
export const isHoveringPointer = ({ pointerType, buttons }: IHoveringPointerEvent): boolean =>
  pointerType === 'mouse' || (pointerType === 'pen' && buttons === 0);
