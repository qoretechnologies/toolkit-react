// Copyright 2026 Qore Technologies, s.r.o.
import { describe, expect, it } from 'vitest';
import {
  COMPACT_MIN_VALUE_WIDTH,
  COMPACT_ROW_GAP,
  COMPACT_ROW_PAD_X,
  isCompactNarrow,
  LABEL_AFFORDANCE_WIDTH,
  LABEL_COL_MAX,
  LABEL_COL_MIN,
} from '../src/components/form/engine/compactRowStyles';

/**
 * The narrow-row rule (qorus#646, David): a compact form stacks its rows where a value would have under 320px beside
 * the label column it is laid out with, not at one form width whatever its labels. The FormEngine stories (A Row
 * Stacks Where Its Value Would Be Narrow, and those after it) measure the layout; these hold the rule's edges.
 */
const widestColumn = LABEL_COL_MAX + LABEL_AFFORDANCE_WIDTH;
const narrowestColumn = LABEL_COL_MIN + LABEL_AFFORDANCE_WIDTH;
const besideTheLabel = (column: number) => column + COMPACT_ROW_GAP + 2 * COMPACT_ROW_PAD_X;

describe('a compact form stacks its rows', () => {
  it('where its value would have less than the least room beside its label', () => {
    const edge = besideTheLabel(widestColumn) + COMPACT_MIN_VALUE_WIDTH;

    expect(isCompactNarrow(edge - 1, widestColumn)).toBe(true);
    expect(isCompactNarrow(edge, widestColumn)).toBe(false);
  });

  it('by its labels: long ones under about 600px, short ones under about 500px', () => {
    expect(isCompactNarrow(560, widestColumn)).toBe(true);
    expect(isCompactNarrow(700, widestColumn)).toBe(false);
    expect(isCompactNarrow(560, narrowestColumn)).toBe(false);
    expect(isCompactNarrow(440, narrowestColumn)).toBe(true);
    expect(besideTheLabel(widestColumn) + COMPACT_MIN_VALUE_WIDTH).toBeGreaterThan(580);
    expect(besideTheLabel(widestColumn) + COMPACT_MIN_VALUE_WIDTH).toBeLessThan(620);
    expect(besideTheLabel(narrowestColumn) + COMPACT_MIN_VALUE_WIDTH).toBeGreaterThan(480);
    expect(besideTheLabel(narrowestColumn) + COMPACT_MIN_VALUE_WIDTH).toBeLessThan(520);
  });

  it('at any width a phone has', () => {
    for (const width of [320, 360, 390, 430]) {
      expect(isCompactNarrow(width, narrowestColumn)).toBe(true);
    }
  });
});
