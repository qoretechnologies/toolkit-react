// Lifted from qorus-ide __tests__/helpers/dpqlSyntaxHighlighting.test.ts on
// the feature/dpql-editor branch. Differences: vitest → jest globals,
// import path updated to Reqraft's dpqlEditor folder.

import { renderHook } from '@testing-library/react';
import { useDpqlSyntaxHighlighting } from '../../src/components/dpqlEditor/useDpqlSyntaxHighlighting';

/** Build a Slate text-node entry tuple. */
function textEntry(text: string, path: number[] = [0, 0]) {
  return [{ text }, path] as const;
}

describe('useDpqlSyntaxHighlighting', () => {
  function getDecorate() {
    const { result } = renderHook(() => useDpqlSyntaxHighlighting());
    return result.current;
  }

  it('returns empty array for non-text nodes', () => {
    const decorate = getDecorate();
    const node = { type: 'paragraph', children: [{ text: '' }] } as any;
    expect(decorate([node, [0]])).toEqual([]);
  });

  it('returns empty array for empty text', () => {
    const decorate = getDecorate();
    expect(decorate(textEntry(''))).toEqual([]);
  });

  it('highlights SQL keywords', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('SELECT FROM WHERE'));

    const keywords = ranges.filter((r) => r.keyword);
    expect(keywords).toHaveLength(3);

    expect(keywords[0].anchor.offset).toBe(0);
    expect(keywords[0].focus.offset).toBe(6);

    expect(keywords[1].anchor.offset).toBe(7);
    expect(keywords[1].focus.offset).toBe(11);

    expect(keywords[2].anchor.offset).toBe(12);
    expect(keywords[2].focus.offset).toBe(17);
  });

  it('highlights keywords case-insensitively', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('select FROM Where'));

    const keywords = ranges.filter((r) => r.keyword);
    expect(keywords).toHaveLength(3);
  });

  it('highlights string literals', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry("name == 'Alice'"));

    const strings = ranges.filter((r) => r.string);
    expect(strings).toHaveLength(1);
    expect(strings[0].anchor.offset).toBe(8);
    expect(strings[0].focus.offset).toBe(15);
  });

  it('highlights double-quoted strings', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('name == "Alice"'));

    const strings = ranges.filter((r) => r.string);
    expect(strings).toHaveLength(1);
    expect(strings[0].anchor.offset).toBe(8);
    expect(strings[0].focus.offset).toBe(15);
  });

  it('highlights numbers', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('age > 18'));

    const numbers = ranges.filter((r) => r.number);
    expect(numbers).toHaveLength(1);
    expect(numbers[0].anchor.offset).toBe(6);
    expect(numbers[0].focus.offset).toBe(8);
  });

  it('highlights decimal numbers', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('price > 9.99'));

    const numbers = ranges.filter((r) => r.number);
    expect(numbers).toHaveLength(1);
    expect(numbers[0].anchor.offset).toBe(8);
    expect(numbers[0].focus.offset).toBe(12);
  });

  it('highlights operators', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('a != b'));

    const operators = ranges.filter((r) => r.operator);
    expect(operators).toHaveLength(1);
    expect(operators[0].anchor.offset).toBe(2);
    expect(operators[0].focus.offset).toBe(4);
  });

  it('highlights functions', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('COUNT(*)'));

    const functions = ranges.filter((r) => r.function);
    expect(functions).toHaveLength(1);
    expect(functions[0].anchor.offset).toBe(0);
    expect(functions[0].focus.offset).toBe(5);
  });

  it('highlights booleans', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('x = true'));

    const booleans = ranges.filter((r) => r.boolean);
    expect(booleans).toHaveLength(1);
    expect(booleans[0].anchor.offset).toBe(4);
    expect(booleans[0].focus.offset).toBe(8);
  });

  it('highlights line comments', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('SELECT -- this is a comment'));

    const comments = ranges.filter((r) => r.comment);
    expect(comments).toHaveLength(1);
    expect(comments[0].anchor.offset).toBe(7);
    expect(comments[0].focus.offset).toBe(27);
  });

  it('highlights a complex DPQL expression', () => {
    const decorate = getDecorate();
    const ranges = decorate(
      textEntry('SELECT count(*) FROM orders WHERE total > 100')
    );

    const keywords = ranges.filter((r) => r.keyword);
    const functions = ranges.filter((r) => r.function);
    const numbers = ranges.filter((r) => r.number);
    const operators = ranges.filter((r) => r.operator);

    expect(keywords.length).toBeGreaterThanOrEqual(3); // SELECT, FROM, WHERE
    expect(functions).toHaveLength(1); // count
    expect(numbers).toHaveLength(1); // 100
    expect(operators).toHaveLength(2); // * and >
  });

  it('does not decorate plain identifiers', () => {
    const decorate = getDecorate();
    const ranges = decorate(textEntry('my_column'));

    expect(ranges).toHaveLength(0);
  });
});
