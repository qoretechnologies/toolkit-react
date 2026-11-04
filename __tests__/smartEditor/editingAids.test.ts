// Copyright 2026 Qore Technologies, s.r.o.
/**
 * What a code editor does for the text typed in it (qorus#646, David: the DPQL editor that replaces Monaco loses
 * nothing): brackets matched, strings and chips told apart from the brackets around them, a search's matches.
 */
import { describe, expect, it } from 'vitest';
import {
  slateSelectionToOffset,
  slateToPlainText,
} from '../../src/components/dpqlEditor/dpqlHelpers';
import {
  closesBefore,
  DPQL_EDITING_LANGUAGE,
  findMatches,
  inString,
  maskChips,
  matchingBracket,
  pointAt,
  spansInLeaf,
  textSegments,
} from '../../src/components/smartEditor/editingAids';
import { ISlateConverter, ISlateElement } from '../../src/components/smartEditor/types';

const converter = {
  toSlateNodes: () => [],
  fromSlateNodes: slateToPlainText,
  selectionToOffset: slateSelectionToOffset,
} as unknown as ISlateConverter;

/** `size(` + the chip `$data:{a.b}` + `) > 1`, and a second line `(2)`. */
const NODES = [
  {
    type: 'paragraph',
    children: [
      { text: 'size(' },
      { type: 'tag', value: '$data:{a.b}', children: [{ text: '' }] },
      { text: ') > 1' },
    ],
  },
  { type: 'paragraph', children: [{ text: '(2)' }] },
] as unknown as ISlateElement[];

const segments = textSegments(NODES, converter);
const plain = slateToPlainText(NODES);
const masked = maskChips(plain, segments);

describe('the text as the aids read it', () => {
  it('runs leaf by leaf, a chip as one run, a line apart from the next', () => {
    expect(
      segments.map(({ path, start, end, chip }) => [path.join('.'), start, end, chip])
    ).toEqual([
      ['0.0', 0, 5, false],
      ['0.1', 5, 16, true],
      ['0.2', 16, 21, false],
      ['1.0', 22, 25, false],
    ]);
  });

  it("masks a chip's characters: its braces are no brackets", () => {
    expect(masked).toBe('size(\0\0\0\0\0\0\0\0\0\0\0) > 1\n(2)');
  });
});

describe('matchingBracket', () => {
  it('matches the bracket before the caret, past a chip', () => {
    expect(matchingBracket(masked, 5, DPQL_EDITING_LANGUAGE)).toEqual([4, 16]);
  });

  it('matches the bracket after the caret', () => {
    expect(matchingBracket(masked, 16, DPQL_EDITING_LANGUAGE)).toEqual([4, 16]);
  });

  it('matches a bracket on another line, and nested ones', () => {
    expect(matchingBracket('f((1), [2])', 2, DPQL_EDITING_LANGUAGE)).toEqual([1, 10]);
    expect(matchingBracket('f((1), [2])', 3, DPQL_EDITING_LANGUAGE)).toEqual([2, 4]);
  });

  it('leaves brackets in a string alone', () => {
    expect(matchingBracket('f(")") + 1', 2, DPQL_EDITING_LANGUAGE)).toEqual([1, 5]);
    expect(matchingBracket('"(" + 1', 2, DPQL_EDITING_LANGUAGE)).toBeUndefined();
  });

  it('matches nothing where there is no bracket at the caret, or it is not closed', () => {
    expect(matchingBracket('a + b', 2, DPQL_EDITING_LANGUAGE)).toBeUndefined();
    expect(matchingBracket('f(a', 2, DPQL_EDITING_LANGUAGE)).toBeUndefined();
  });
});

describe('inString', () => {
  it('reads a string as far as its closing quote, and an escaped quote as in it', () => {
    expect(inString('"ab', 2)).toBe(true);
    expect(inString('"ab" + ', 6)).toBe(false);
    expect(inString('"a\\"b', 4)).toBe(true);
  });
});

describe('findMatches', () => {
  it('finds every place a text is written, by its case or not', () => {
    expect(findMatches('X x x', 'x')).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
    expect(findMatches('X x x', 'x', { caseSensitive: true })).toEqual([
      [2, 3],
      [4, 5],
    ]);
  });

  it('finds nothing in a chip, and nothing for no text', () => {
    expect(findMatches(masked, 'data')).toEqual([]);
    expect(findMatches(masked, '')).toEqual([]);
  });
});

describe('pointAt and spansInLeaf', () => {
  it('reads a plain-text offset as a point in its text leaf', () => {
    expect(pointAt(segments, 18)).toEqual({ path: [0, 2], offset: 2 });
    expect(pointAt(segments, 23)).toEqual({ path: [1, 0], offset: 1 });
  });

  it('cuts spans to the leaf they are in', () => {
    expect(
      spansInLeaf(
        segments,
        [0, 2],
        [
          [4, 5],
          [16, 17],
        ]
      )
    ).toEqual([[0, 1]]);
    expect(
      spansInLeaf(
        segments,
        [0, 0],
        [
          [4, 5],
          [16, 17],
        ]
      )
    ).toEqual([[4, 5]]);
  });
});

describe('closesBefore', () => {
  it('closes a pair before nothing, a space or what closes, not before a word', () => {
    expect(closesBefore(DPQL_EDITING_LANGUAGE, '')).toBe(true);
    expect(closesBefore(DPQL_EDITING_LANGUAGE, ' ')).toBe(true);
    expect(closesBefore(DPQL_EDITING_LANGUAGE, ')')).toBe(true);
    expect(closesBefore(DPQL_EDITING_LANGUAGE, 'a')).toBe(false);
  });
});
