// Copyright 2026 Qore Technologies, s.r.o.
// An option's name in a compact row, checked as drawn: its help at the label column's right edge, its asterisk on
// the name's line.

import { expect } from 'storybook/test';

/** The last line box of the last text in `element` that comes before `before`. */
const lastLineBefore = (element: HTMLElement, before: Node): DOMRect | undefined => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let last: Text | undefined;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (
      node.textContent?.replace(/[\u2060\u200b\ufeff]/g, '').trim() &&
      before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING
    ) {
      last = node as Text;
    }
  }
  if (!last) {
    return undefined;
  }
  const range = document.createRange();
  range.selectNodeContents(last);
  const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 0);
  return lines[lines.length - 1];
};

/**
 * Every compact row under `root` draws its name's chrome in place:
 * - its help (?) at the label column's right edge, the same x in every row of the column, not a step after each
 *   name (Foxhoundn, qlip #392: "please right align the question mark to get rid of the stair-case look");
 * - its required asterisk on the name's line, right after its last word, never on a line of its own under it
 *   (Foxhoundn, qlip #392: "keep it on the same line as the field name").
 */
export const expectLabelChromeInPlace = (root: ParentNode = document) => {
  const rows = Array.from(root.querySelectorAll<HTMLElement>('.readfirst-row'));
  expect(rows.length, 'compact rows to check').toBeGreaterThan(0);
  rows.forEach((row) => {
    const field = row.getAttribute('data-field');
    const block = row.querySelector<HTMLElement>('.options-readfirst-label-block');
    if (!block) {
      return;
    }
    const help = block.querySelector<HTMLElement>('.options-readfirst-help');
    if (help) {
      expect(
        Math.abs(help.getBoundingClientRect().right - block.getBoundingClientRect().right),
        `${field}: its (?) at the label column's right edge`
      ).toBeLessThanOrEqual(1);
    }
    const text = block.querySelector<HTMLElement>('.options-readfirst-label-text');
    const star = text?.querySelector<HTMLElement>('.reqore-icon');
    if (text && star) {
      const line = lastLineBefore(text, star);
      const mark = star.getBoundingClientRect();
      expect(line, `${field}: its name's text`).toBeTruthy();
      const middle = (mark.top + mark.bottom) / 2;
      expect(middle, `${field}: its asterisk on its name's line`).toBeGreaterThanOrEqual(line!.top);
      expect(middle, `${field}: its asterisk on its name's line`).toBeLessThanOrEqual(line!.bottom);
      expect(mark.left, `${field}: its asterisk after its name`).toBeGreaterThanOrEqual(line!.right - 1);
    }
  });
};
