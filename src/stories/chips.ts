// Copyright 2026 Qore Technologies, s.r.o.
// A reference chip in a story, checked as drawn: big enough to press, and nothing inside it running out of it.

import { expect } from 'storybook/test';

/** Reqore's `small` tag: the smallest a chip a finger presses is drawn (BRAND_DESIGN, "Tap targets are
 *  finger-sized"). */
export const SMALLEST_CHIP_HEIGHT = 20;

/**
 * `chip` (a `.reqore-tag`, or an element inside one) is drawn `small` or bigger, and everything in it - its icon,
 * its label, its remove button - is inside its box. The one reference chip was `tiny`, a 14px box holding a label
 * in the 14px text around it: the label ran out of the box, top and bottom (Foxhoundn on qlip #383, "the text IS
 * literally leaking out of the chip").
 */
export const expectChipFits = (chip: HTMLElement) => {
  const tag = (chip.closest('.reqore-tag') as HTMLElement | null) ?? chip;
  const box = tag.getBoundingClientRect();
  const name = (tag.textContent ?? '').replace(/﻿/g, '').trim();
  expect(box.height, `${name}: as tall as a small chip`).toBeGreaterThanOrEqual(
    SMALLEST_CHIP_HEIGHT
  );
  tag.querySelectorAll<HTMLElement>('*').forEach((part) => {
    const inner = part.getBoundingClientRect();
    if (!inner.width && !inner.height) {
      return;
    }
    const what = `${name}: ${part.className.toString().split(' ').pop() || part.tagName}`;
    expect(inner.top, `${what} starts in the chip`).toBeGreaterThanOrEqual(box.top - 0.5);
    expect(inner.bottom, `${what} ends in the chip`).toBeLessThanOrEqual(box.bottom + 0.5);
    expect(inner.left, `${what} starts in the chip`).toBeGreaterThanOrEqual(box.left - 0.5);
    expect(inner.right, `${what} ends in the chip`).toBeLessThanOrEqual(box.right + 0.5);
  });
};
