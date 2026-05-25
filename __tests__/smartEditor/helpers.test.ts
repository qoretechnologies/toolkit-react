// Generic helper tests for the SmartEditor primitive. Tests for the
// language-agnostic helpers live here; DPQL-specific helpers
// (plainTextToSlate, slateToPlainText, isTagCompletion, getTagLabel,
// slateSelectionToOffset with quoted-tag handling) are in
// __tests__/dpqlEditor/helpers.test.ts.

import {
  defaultFromSlateNodes,
  defaultSelectionToOffset,
  defaultToSlateNodes,
  lspPositionToOffset,
  mapCompletionKindToIcon,
  offsetToLspPosition,
} from '../../src/components/smartEditor/helpers';

describe('smartEditor helpers', () => {
  describe('offsetToLspPosition', () => {
    it('returns 0,0 for offset 0', () => {
      expect(offsetToLspPosition('hello', 0)).toEqual({ line: 0, character: 0 });
    });

    it('returns correct character offset on single line', () => {
      expect(offsetToLspPosition('hello world', 5)).toEqual({
        line: 0,
        character: 5,
      });
    });

    it('tracks line breaks correctly', () => {
      expect(offsetToLspPosition('line1\nline2', 6)).toEqual({
        line: 1,
        character: 0,
      });
    });

    it('tracks character after line break', () => {
      expect(offsetToLspPosition('line1\nline2', 9)).toEqual({
        line: 1,
        character: 3,
      });
    });

    it('handles multiple line breaks', () => {
      expect(offsetToLspPosition('a\nb\nc', 4)).toEqual({ line: 2, character: 0 });
    });

    it('handles offset at end of string', () => {
      expect(offsetToLspPosition('abc', 3)).toEqual({ line: 0, character: 3 });
    });
  });

  describe('lspPositionToOffset', () => {
    it('returns 0 for line 0 character 0', () => {
      expect(lspPositionToOffset('hello', { line: 0, character: 0 })).toBe(0);
    });

    it('returns the character offset on a single-line document', () => {
      expect(lspPositionToOffset('hello world', { line: 0, character: 5 })).toBe(5);
    });

    it('crosses a newline correctly', () => {
      // 'line1\nline2' — line 1 starts at offset 6
      expect(lspPositionToOffset('line1\nline2', { line: 1, character: 0 })).toBe(6);
      expect(lspPositionToOffset('line1\nline2', { line: 1, character: 3 })).toBe(9);
    });

    it('handles multiple newlines', () => {
      expect(lspPositionToOffset('a\nb\nc', { line: 2, character: 0 })).toBe(4);
    });

    it('is the inverse of offsetToLspPosition for representative offsets', () => {
      const text = 'select * from\nusers where\nname = "Alice"';
      const cases = [0, 5, 13, 14, 20, 26, 40];
      for (const offset of cases) {
        const pos = offsetToLspPosition(text, offset);
        expect(lspPositionToOffset(text, pos)).toBe(offset);
      }
    });

    it('clamps to document end when position is past EOF', () => {
      expect(lspPositionToOffset('abc', { line: 5, character: 0 })).toBe(3);
    });
  });

  describe('defaultToSlateNodes', () => {
    it('returns single empty paragraph for empty string', () => {
      expect(defaultToSlateNodes('')).toEqual([
        { type: 'paragraph', children: [{ text: '' }] },
      ]);
    });

    it('wraps a plain string in a single paragraph', () => {
      expect(defaultToSlateNodes('hello')).toEqual([
        { type: 'paragraph', children: [{ text: 'hello' }] },
      ]);
    });

    it('splits on newlines into multiple paragraphs', () => {
      expect(defaultToSlateNodes('line1\nline2')).toEqual([
        { type: 'paragraph', children: [{ text: 'line1' }] },
        { type: 'paragraph', children: [{ text: 'line2' }] },
      ]);
    });
  });

  describe('defaultFromSlateNodes', () => {
    it('extracts text from a single paragraph', () => {
      expect(
        defaultFromSlateNodes([
          { type: 'paragraph', children: [{ text: 'hello' }] },
        ])
      ).toBe('hello');
    });

    it('joins paragraphs with newlines', () => {
      expect(
        defaultFromSlateNodes([
          { type: 'paragraph', children: [{ text: 'line1' }] },
          { type: 'paragraph', children: [{ text: 'line2' }] },
        ])
      ).toBe('line1\nline2');
    });

    it('extracts tag values as raw text', () => {
      expect(
        defaultFromSlateNodes([
          {
            type: 'paragraph',
            children: [
              { text: 'a ' },
              {
                type: 'tag',
                value: '@field',
                label: 'field',
                children: [{ text: '' }],
              },
              { text: ' b' },
            ],
          },
        ])
      ).toBe('a @field b');
    });

    it('roundtrips with defaultToSlateNodes for plain text', () => {
      const cases = ['', 'hello', 'line1\nline2', 'a b c\n\nd'];
      for (const text of cases) {
        expect(defaultFromSlateNodes(defaultToSlateNodes(text))).toBe(text);
      }
    });
  });

  describe('defaultSelectionToOffset', () => {
    it('returns the offset within a single text node', () => {
      const nodes = defaultToSlateNodes('hello world');
      expect(defaultSelectionToOffset(nodes, [0, 0], 5)).toBe(5);
    });

    it('handles the second paragraph', () => {
      const nodes = defaultToSlateNodes('line1\nline2');
      // "line1" + "\n" + 3 chars into "line2" = 9
      expect(defaultSelectionToOffset(nodes, [1, 0], 3)).toBe(9);
    });

    it('counts tag-element value lengths', () => {
      const nodes = [
        {
          type: 'paragraph' as const,
          children: [
            { text: 'a ' },
            {
              type: 'tag' as const,
              value: '@xyz',
              label: 'xyz',
              children: [{ text: '' }],
            },
            { text: ' b' },
          ],
        },
      ];
      // Cursor 1 char into the trailing " b" text node:
      // "a " (2) + "@xyz" (4) + 1 = 7
      expect(defaultSelectionToOffset(nodes, [0, 2], 1)).toBe(7);
    });
  });

  describe('mapCompletionKindToIcon', () => {
    it.each([
      [2, 'CodeLine'],
      [3, 'FunctionLine'],
      [5, 'Database2Line'],
      [6, 'ExchangeDollarLine'],
      [14, 'Key2Line'],
      [15, 'CodeBoxLine'],
    ] as const)('maps kind %s → icon %s', (kind, icon) => {
      expect(mapCompletionKindToIcon(kind)).toBe(icon);
    });

    it('falls back to CodeLine for unknown kind', () => {
      expect(mapCompletionKindToIcon(undefined)).toBe('CodeLine');
      expect(mapCompletionKindToIcon(999)).toBe('CodeLine');
    });
  });
});
