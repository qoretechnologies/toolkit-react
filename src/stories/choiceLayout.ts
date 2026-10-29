// Copyright 2026 Qore Technologies, s.r.o.
import { expect } from 'storybook/test';

/** How far reqore draws a radio's focus ring out from it: 2px out, 2px wide. */
const FOCUS_RING_REACH = 4;

/**
 * A choice drawn with a picture is laid out as David asked (qorus#646): as far from its radio as from its name, the
 * radio's focus ring clear of the picture, the name centered on the picture (each within 1px); once one is chosen
 * the others' pictures are gray and the chosen one's in color. `chosen` names the one chosen, if one is.
 */
export const expectPictureChoiceLayout = (root: HTMLElement, chosen?: string) => {
  const choices = Array.from(root.querySelectorAll<HTMLElement>('.reqore-checkbox')).filter(
    (choice) => !!choice.querySelector('.choice-picture img')
  );
  expect(choices.length, 'choices drawn with pictures').toBeGreaterThan(0);
  for (const choice of choices) {
    const name = choice.textContent?.trim();
    const mark = (
      choice.querySelector('.reqore-checkbox-box') as HTMLElement
    ).getBoundingClientRect();
    const picture = (
      choice.querySelector('.choice-picture img') as HTMLElement
    ).getBoundingClientRect();
    const label = choice.querySelector('.reqore-checkbox-label') as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(label);
    const text = range.getBoundingClientRect();
    const before = picture.left - mark.right;
    const after = text.left - picture.right;
    expect(
      Math.abs(before - after),
      `${name}: radio to picture ${before}px, picture to name ${after}px`
    ).toBeLessThanOrEqual(1);
    expect(
      before - FOCUS_RING_REACH,
      `${name}: the radio's focus ring keeps clear of the picture`
    ).toBeGreaterThan(1);
    const pictureMiddle = picture.top + picture.height / 2;
    const textMiddle = text.top + text.height / 2;
    expect(
      Math.abs(pictureMiddle - textMiddle),
      `${name}: the name centered on the picture`
    ).toBeLessThanOrEqual(1);
    const filter = getComputedStyle(
      choice.querySelector('.choice-picture img') as HTMLElement
    ).filter;
    expect(filter.includes('grayscale'), `${name}: its picture gray`).toBe(
      !!chosen && name?.toLowerCase() !== chosen.toLowerCase()
    );
  }
};
