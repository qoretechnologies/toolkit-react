/**
 * Bring a form row into view only when it is not already there, and never
 * under a pinned header.
 *
 * A row that moves between status boxes (filling a field moves it from "Needs
 * attention" to "Set") is followed so the reader does not lose it. That used
 * to be `scrollIntoView({ block: 'center' })`, which scrolls even when the row
 * is already in plain sight, and centres it against the whole scrollport while
 * the box header pinned at the top hides part of it. In the qorus-ide schema
 * editor the moved row landed with the "Needs attention" header (375-423)
 * drawn over it (405).
 *
 * The visible area is the scrollport minus the pinned chrome above the row:
 * the form's sticky toolbar and the sticky header of every status box the row
 * sits in. Both are read from the DOM when the reveal runs, so a host's own
 * offset, a toolbar that wraps, or a header that is not pinned at all are all
 * accounted for without the caller knowing about them.
 */

/** Selectors of the elements whose header may be pinned above a row. */
const PINNED_HEADER_OWNERS = '.options-readfirst-group, .options-readfirst-scroll > .reqore-panel';

const isScrollable = (element: HTMLElement): boolean => {
  const { overflowY } = getComputedStyle(element);
  return (
    (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
    element.scrollHeight > element.clientHeight
  );
};

/** The nearest ancestor that actually scrolls; `undefined` means the viewport. */
export const findScrollContainer = (element: HTMLElement): HTMLElement | undefined => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent === document.body || parent === document.documentElement) {
      return undefined;
    }
    if (isScrollable(parent)) {
      return parent;
    }
  }
  return undefined;
};

/**
 * How far below the top of the scrollport the pinned chrome above `element`
 * reaches: the largest `top + height` of any sticky header of an enclosing
 * status box or form toolbar. Zero when nothing above it is pinned.
 */
export const getPinnedChromeHeight = (element: HTMLElement): number => {
  let clearance = 0;
  for (
    let owner = element.parentElement?.closest<HTMLElement>(PINNED_HEADER_OWNERS);
    owner;
    owner = owner.parentElement?.closest<HTMLElement>(PINNED_HEADER_OWNERS)
  ) {
    const header = owner.querySelector<HTMLElement>(':scope > .reqore-panel-title');
    if (!header || header.contains(element)) {
      continue;
    }
    const style = getComputedStyle(header);
    if (style.position !== 'sticky') {
      continue;
    }
    const top = parseFloat(style.top) || 0;
    clearance = Math.max(clearance, top + header.getBoundingClientRect().height);
  }
  return clearance;
};

/** Whether the whole of `element` is visible below the pinned chrome above it. */
export const isRowInView = (element: HTMLElement, pinnedChrome: number): boolean => {
  const container = findScrollContainer(element);
  const viewTop = container ? container.getBoundingClientRect().top + container.clientTop : 0;
  const viewBottom =
    container ?
      viewTop + container.clientHeight
    : window.innerHeight || document.documentElement.clientHeight;
  const rect = element.getBoundingClientRect();
  return rect.top >= viewTop + pinnedChrome && rect.bottom <= viewBottom;
};

/**
 * Scroll `element` the least distance that shows it clear of the pinned chrome
 * above it — and not at all when it is already fully in view.
 *
 * `scroll-margin-top` is what keeps a row that has to come down from above from
 * stopping under the header: `block: 'nearest'` aligns the row's margin box,
 * so the row itself stops exactly below the pinned chrome.
 *
 * Returns whether a scroll was started.
 */
export const revealRow = (element: HTMLElement, behavior: ScrollBehavior = 'smooth'): boolean => {
  // jsdom implements neither layout nor `scrollIntoView`; a missing reveal must
  // never break a form.
  if (typeof element.scrollIntoView !== 'function') {
    return false;
  }
  const pinnedChrome = getPinnedChromeHeight(element);
  if (isRowInView(element, pinnedChrome)) {
    return false;
  }
  element.style.scrollMarginTop = `${pinnedChrome}px`;
  element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior });
  return true;
};
