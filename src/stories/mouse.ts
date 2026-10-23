// Copyright 2026 Qore Technologies, s.r.o.
// A mouse in a story: resting on a word, and taken off the page when the story ends - or, where the story's
// capture shows the hover, as the next story starts. Shared by the stories of every editor that shows the
// server's hover (SmartEditor, DpqlEditor).

import { CAPTURE_VIEWPORT } from './captureViewport';

/** The middle of `word` in the editor's text, on the screen. */
export const middleOf = (editable: HTMLElement, word: string) => {
  const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.textContent?.indexOf(word) ?? -1;
    if (at >= 0) {
      const range = document.createRange();
      range.setStart(node, at + Math.floor(word.length / 2));
      range.setEnd(node, at + Math.floor(word.length / 2) + 1);
      const box = range.getBoundingClientRect();
      return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
    }
  }
  throw new Error(`"${word}" is not in the editor`);
};

interface IVitestMouse {
  userEvent: { hover(element: Element, options?: unknown): Promise<void> };
  cdp(): { send(method: string, params?: Record<string, unknown>): Promise<unknown> };
  page: { viewport(width: number, height: number): Promise<void> };
}

/** The test runner's browser, or none where the play runs in Storybook's UI (see `withTouchScreen`). */
const vitestBrowser = async (): Promise<IVitestMouse | undefined> => {
  try {
    return (await import('vitest/browser')) as unknown as IVitestMouse;
  } catch {
    return undefined;
  }
};

/**
 * The story's frame at the size qlip captures it: called before the mouse is rested in a story whose capture
 * shows a hover.
 *
 * qlip resizes the frame once the play has ended (`CAPTURE_VIEWPORT`, or the story's `parameters.qlip.viewport`),
 * and the test runner scales the resized frame to fit its window, so a mouse that did not move is at another
 * point of the story when it is captured. Rested near the bottom of a chip, it was off the chip, whose card
 * closed as the mouse left it, and the capture showed no hover (qorus#646, Foxhoundn on DpqlEditor · A Chip
 * With Its Own Description Shows One Hover: "What is the snapshot for if the description is not seen?"). At the
 * capture's size from the start, the frame is not resized, and the hover the play checked is the one captured.
 *
 * Not put back: Storybook sizes each story's frame as the story starts. In Storybook's UI, where there is no
 * test runner, nothing is resized.
 */
export const atTheCaptureSize = async (parameters?: {
  qlip?: { viewport?: { width: number; height: number } };
}) => {
  const browser = await vitestBrowser();
  const { width, height } = parameters?.qlip?.viewport ?? CAPTURE_VIEWPORT;
  await browser?.page.viewport(width, height);
};

/**
 * What a browser sends as a mouse moves onto `at`, dispatched where there is no mouse to move (Storybook's UI): over
 * and enter events, then a move, to the element under the point (`element` if nothing is there). A move alone
 * reached what listens for pointer moves (an editor's own hover) and not what opens on `mouseenter` (a tag's
 * card), so a story about a chip's card failed in Storybook's UI and passed in the test run (DpqlEditor · A Chip
 * With Its Own Description Shows One Hover). Enter events go to the element and each of its ancestors, outermost
 * first, as they do when the mouse comes from outside the page.
 */
/** Where a dispatched mouse rests (Storybook's UI), and the point it is at: what it leaves when taken off the page. */
let dispatchedAt: { target: Element; at: { clientX: number; clientY: number } } | undefined;

const moveDispatchedMouseTo = (element: HTMLElement, at: { clientX: number; clientY: number }) => {
  const target =
    (document.elementFromPoint(at.clientX, at.clientY) as HTMLElement | null) ?? element;
  dispatchedAt = { target, at };
  const init = {
    ...at,
    pointerType: 'mouse',
    pointerId: 1,
    isPrimary: true,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  const entered: Element[] = [];
  for (let node: Element | null = target; node; node = node.parentElement) {
    entered.unshift(node);
  }
  target.dispatchEvent(new PointerEvent('pointerover', init));
  entered.forEach((node) =>
    node.dispatchEvent(new PointerEvent('pointerenter', { ...init, bubbles: false }))
  );
  target.dispatchEvent(new MouseEvent('mouseover', init));
  entered.forEach((node) =>
    node.dispatchEvent(new MouseEvent('mouseenter', { ...init, bubbles: false }))
  );
  target.dispatchEvent(new PointerEvent('pointermove', init));
  target.dispatchEvent(new MouseEvent('mousemove', init));
};

/**
 * Rests the mouse on `at` in `element`. In the test runner it is the browser's own mouse, moved there by
 * Playwright, whose pointer events say "mouse" as a person's do; in Storybook's UI, where there is none to
 * move, a mouse's pointer event at that point. A story that moves the browser's mouse puts it back off the
 * page when it ends (`mouseOffThePage`); one whose capture shows the hover leaves it resting, and its stories
 * take it off the page as each starts (DpqlEditor).
 */
export const restMouseOn = async (
  element: HTMLElement,
  at: { clientX: number; clientY: number }
) => {
  const browser = await vitestBrowser();
  if (!browser) {
    moveDispatchedMouseTo(element, at);
    return;
  }
  const box = element.getBoundingClientRect();
  await browser.userEvent.hover(element, {
    position: { x: at.clientX - box.left, y: at.clientY - box.top },
  });
};

/**
 * The browser's mouse off the page, where it is before anything moves it: nothing is under it. Left where a
 * story rested it, it stayed over the stories that came after it in the same browser, and whatever they drew
 * there was hovered - a card's title opened its hover, which said the title a second time
 * (Tracking/Experiment Card, in CI).
 */
export const mouseOffThePage = async () => {
  const browser = await vitestBrowser();
  if (browser) {
    await browser.cdp().send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -1, y: -1 });
    return;
  }
  /* Storybook's UI, where the mouse was a dispatched one (`restMouseOn`): what a browser sends as the mouse leaves
     the page, out and leave events from where it rested, innermost first. Taken off the page by nothing, it stayed
     where it was, and a hover the play waited to close never did (FormEngine · Compact Expression Template Chips
     failed in Storybook's UI and passed in the test run). */
  if (!dispatchedAt) {
    return;
  }
  const { at } = dispatchedAt;
  // what is under the point now: what the mouse rested on may have been redrawn since (an editor's text is)
  const target = dispatchedAt.target.isConnected
    ? dispatchedAt.target
    : (document.elementFromPoint(at.clientX, at.clientY) ?? document.body);
  dispatchedAt = undefined;
  const init = {
    ...at,
    pointerType: 'mouse',
    pointerId: 1,
    isPrimary: true,
    bubbles: true,
    cancelable: true,
    composed: true,
    relatedTarget: null,
  };
  // the elements left, taken before any is told: a leave can redraw what it reaches, and a redrawn element has no
  // parent to go on to
  const left: Element[] = [];
  for (let node: Element | null = target; node; node = node.parentElement) {
    left.push(node);
  }
  target.dispatchEvent(new PointerEvent('pointerout', init));
  left.forEach((node) =>
    node.dispatchEvent(new PointerEvent('pointerleave', { ...init, bubbles: false }))
  );
  target.dispatchEvent(new MouseEvent('mouseout', init));
  left.forEach((node) =>
    node.dispatchEvent(new MouseEvent('mouseleave', { ...init, bubbles: false }))
  );
};

/** The middle of `element` on the screen: where a mouse rests to hover it (a chip). */
export const middleOfElement = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
};
