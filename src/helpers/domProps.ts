// Copyright 2026 Qore Technologies, s.r.o.

/**
 * The attributes any HTML element takes, beside `aria-*`, `data-*` and event handlers (qorus#646).
 *
 * A component that renders a plain element and takes the rest of its props for it passes that element only these.
 * What else it is handed is not an attribute: a Reqore control group hands each component in it its layout props
 * (`fluid`, `spaceBetween`, `size`, `intent`, `customTheme`, ...), and spread onto an element React warns of each
 * ("Received `true` for a non-boolean attribute `fluid`") and writes the rest into the DOM.
 */
const GLOBAL_ATTRIBUTES = new Set([
  'id',
  'className',
  'style',
  'title',
  'role',
  'tabIndex',
  'lang',
  'dir',
  'hidden',
  'translate',
  'draggable',
  'slot',
  'accessKey',
  'autoFocus',
  'inert',
  'contentEditable',
  'spellCheck',
  'suppressContentEditableWarning',
  'suppressHydrationWarning',
]);

/** Whether a prop is one any HTML element takes: a global attribute, `aria-*`, `data-*` or an event handler. */
export const isHtmlElementProp = (name: string): boolean =>
  GLOBAL_ATTRIBUTES.has(name) || /^(aria|data)-/.test(name) || /^on[A-Z]/.test(name);

/** The props any HTML element takes, and nothing else; see `isHtmlElementProp`. */
export const htmlElementProps = <T extends object>(props: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(props).filter(([name]) => isHtmlElementProp(name))
  ) as Partial<T>;
