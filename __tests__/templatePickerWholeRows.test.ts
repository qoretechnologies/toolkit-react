// Copyright 2026 Qore Technologies, s.r.o.
/**
 * The template picker's list is drawn at a height that ends at a row's end, never through a row (qorus-ide #301:
 * the last row of a Qog's templates was drawn cut through its description, 15 px past the list's 300 px).
 */
import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_PICKER_LIST_CAP,
  wholeRowsHeight,
} from '../src/components/form/fields/template/TemplatePicker';

/** A list of rows of the heights given, one under the other from its top, padded at the bottom by `padding`. */
const listOf = (heights: number[], padding = 0) => {
  const list = document.createElement('div');
  list.style.paddingBottom = `${padding}px`;
  let top = 0;
  for (const height of heights) {
    const row = document.createElement('div');
    row.setAttribute('role', 'option');
    const at = top;
    row.getBoundingClientRect = () =>
      ({ top: at, bottom: at + height, height, left: 0, right: 100, width: 100 }) as DOMRect;
    list.appendChild(row);
    top += height;
  }
  list.getBoundingClientRect = () =>
    ({ top: 0, bottom: TEMPLATE_PICKER_LIST_CAP, height: TEMPLATE_PICKER_LIST_CAP }) as DOMRect;
  Object.defineProperty(list, 'scrollHeight', { value: top + padding });
  Object.defineProperty(list, 'scrollTop', { value: 0 });
  document.body.appendChild(list);
  return list;
};

describe('wholeRowsHeight', () => {
  it('leaves a list that fits under the cap at the cap', () => {
    expect(wholeRowsHeight(listOf([60, 60, 60]))).toBe(TEMPLATE_PICKER_LIST_CAP);
  });

  it('shows every row of a list less than a row past the cap: the Qog picker of four rows, 315 px', () => {
    expect(wholeRowsHeight(listOf([79, 79, 79, 78]))).toBe(315);
  });

  it('ends a long list at the last row the cap holds whole', () => {
    // rows end at 70, 140, 210, 280 and 350: the cap holds four whole
    expect(wholeRowsHeight(listOf([70, 70, 70, 70, 70, 70, 70]))).toBe(280);
  });

  it('keeps a row that ends at the cap to the half pixel', () => {
    expect(wholeRowsHeight(listOf([100, 100, 100.4, 100, 100]))).toBe(300);
  });

  it("ends a long list where its next row starts, whatever the list's own padding under its last row", () => {
    // rows end at 70 ... 280: the fifth starts at 280, so the list does not go on into it for its padding
    expect(wholeRowsHeight(listOf([70, 70, 70, 70, 70, 70, 70], 8))).toBe(280);
  });

  it('never ends through a row: every height it gives is the end of a row, or all of the list', () => {
    for (const heights of [
      [79, 79, 79, 79, 79, 79],
      [45, 120, 45, 120, 45],
      [310, 40],
      [33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33],
    ]) {
      const list = listOf(heights);
      const height = wholeRowsHeight(list);
      const ends = heights.reduce<number[]>((all, h) => [...all, (all[all.length - 1] ?? 0) + h], []);
      expect(ends.includes(height) || height === TEMPLATE_PICKER_LIST_CAP, `${heights}: ${height}`).toBe(true);
      // no row is cut through: each ends at or above the height, or starts at or below it
      for (const [index, end] of ends.entries()) {
        const start = end - heights[index];
        expect(end <= height || start >= height, `${heights}: row ${index} at ${start}-${end}, list ${height}`).toBe(
          true
        );
      }
      expect(height).toBeLessThanOrEqual(list.scrollHeight);
    }
  });

  it('keeps the cap when no row fits whole under it (a single row taller than the list scrolls)', () => {
    expect(wholeRowsHeight(listOf([400, 400]))).toBe(TEMPLATE_PICKER_LIST_CAP);
  });

  it('keeps the cap for a list with no rows to measure', () => {
    const list = document.createElement('div');
    Object.defineProperty(list, 'scrollHeight', { value: 500 });
    expect(wholeRowsHeight(list)).toBe(TEMPLATE_PICKER_LIST_CAP);
  });
});
