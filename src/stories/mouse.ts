// Copyright 2026 Qore Technologies, s.r.o.
// A mouse in a story: resting on a word, and taken off the page when the story ends. Shared by the stories
// of every editor that shows the server's hover (SmartEditor, DpqlEditor).

import { fireEvent } from 'storybook/test';

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
 * Rests the mouse on `at` in `element`. In the test runner it is the browser's own mouse, moved there by
 * Playwright, whose pointer events say "mouse" as a person's do; in Storybook's UI, where there is none to
 * move, a mouse's pointer event at that point. A story that moves the browser's mouse puts it back off the
 * page when it ends (`mouseOffThePage`).
 */
export const restMouseOn = async (
  element: HTMLElement,
  at: { clientX: number; clientY: number }
) => {
  const browser = await vitestBrowser();
  if (!browser) {
    fireEvent.pointerMove(element, { pointerType: 'mouse', ...at });
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
  await browser?.cdp().send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -1, y: -1 });
};

/** The middle of `element` on the screen: where a mouse rests to hover it (a chip). */
export const middleOfElement = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
};
