// Copyright 2026 Qore Technologies, s.r.o.
// Tests for the LSP semantic-tokens int-array decoder. The hook
// itself touches DOM / async / debounce which we don't exercise
// here — the math is the part that can break in subtle ways.

import { ILspSemanticTokensLegend } from '../../src/utils/lspClient.types';
import { decodeSemanticTokens } from '../../src/components/smartEditor/useLspSemanticTokens';

// Standard LSP legend (matches the live server's, as captured in the
// Qonsole spike): 16 types + 6 modifiers, positional.
const LEGEND: ILspSemanticTokensLegend = {
  tokenTypes: [
    'namespace',
    'type',
    'class',
    'parameter',
    'variable',
    'property',
    'function',
    'method',
    'keyword',
    'modifier',
    'comment',
    'string',
    'number',
    'regexp',
    'operator',
    'decorator',
  ],
  tokenModifiers: [
    'declaration',
    'definition',
    'readonly',
    'static',
    'defaultLibrary',
    'documentation',
  ],
};

describe('decodeSemanticTokens', () => {
  it('returns empty array on null/empty input', () => {
    expect(decodeSemanticTokens(null, LEGEND)).toEqual([]);
    expect(decodeSemanticTokens(undefined, LEGEND)).toEqual([]);
    expect(decodeSemanticTokens([], LEGEND)).toEqual([]);
  });

  it('returns empty when legend is null', () => {
    expect(decodeSemanticTokens([0, 0, 5, 8, 0], null)).toEqual([]);
  });

  it('returns empty when data length is not a multiple of 5', () => {
    expect(decodeSemanticTokens([0, 0, 5, 8], LEGEND)).toEqual([]);
    expect(decodeSemanticTokens([0, 0, 5, 8, 0, 1], LEGEND)).toEqual([]);
  });

  it('decodes a single token at the start of the document', () => {
    // [deltaLine=0, deltaStart=0, length=5, typeIdx=8 (keyword), mods=0]
    const tokens = decodeSemanticTokens([0, 0, 5, 8, 0], LEGEND);
    expect(tokens).toEqual([
      {
        line: 0,
        character: 0,
        length: 5,
        tokenType: 'keyword',
        tokenModifiers: [],
      },
    ]);
  });

  it('decodes the live-spike sample (two tokens on line 0)', () => {
    // From QONSOLE_LSP_RESPONSES.txt section 9, input `/list services`:
    //   token 1: deltaLine=0, deltaStart=1, length=4, type=8 (keyword)
    //   token 2: deltaLine=0, deltaStart=5, length=8, type=2 (class)
    const tokens = decodeSemanticTokens(
      [0, 1, 4, 8, 0, 0, 5, 8, 2, 0],
      LEGEND
    );
    expect(tokens).toEqual([
      {
        line: 0,
        character: 1,
        length: 4,
        tokenType: 'keyword',
        tokenModifiers: [],
      },
      {
        // 1 + 5 = 6 — same-line delta off the previous token's start.
        line: 0,
        character: 6,
        length: 8,
        tokenType: 'class',
        tokenModifiers: [],
      },
    ]);
  });

  it('re-bases character to the absolute column on a line jump', () => {
    // Token 1 on line 0, then token 2 on line 2 at char 4.
    // When deltaLine > 0, deltaStart is ABSOLUTE on the new line, NOT
    // a delta from the previous token's start.
    const tokens = decodeSemanticTokens(
      [0, 3, 4, 8, 0, 2, 4, 3, 11, 0],
      LEGEND
    );
    expect(tokens).toEqual([
      {
        line: 0,
        character: 3,
        length: 4,
        tokenType: 'keyword',
        tokenModifiers: [],
      },
      {
        line: 2,
        character: 4, // absolute, not 3+4
        length: 3,
        tokenType: 'string',
        tokenModifiers: [],
      },
    ]);
  });

  it('unpacks the modifier bitmask into resolved names', () => {
    // mods = 0b101 = bit 0 (declaration) + bit 2 (readonly)
    const tokens = decodeSemanticTokens([0, 0, 5, 8, 0b101], LEGEND);
    expect(tokens[0].tokenModifiers).toEqual(['declaration', 'readonly']);
  });

  it('returns no modifiers when bitmask is zero', () => {
    const tokens = decodeSemanticTokens([0, 0, 5, 8, 0], LEGEND);
    expect(tokens[0].tokenModifiers).toEqual([]);
  });

  it('skips tokens with an out-of-range typeIdx but continues decoding', () => {
    // Token 1 has typeIdx=99 (invalid). Token 2 is fine.
    // The skip should still advance prevLine/prevChar so token 2's
    // deltas resolve correctly.
    const tokens = decodeSemanticTokens(
      [0, 0, 3, 99, 0, 0, 5, 4, 4, 0],
      LEGEND
    );
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      line: 0,
      character: 5, // 0 + 5, the next token's deltaStart from skipped token's char
      length: 4,
      tokenType: 'variable',
      tokenModifiers: [],
    });
  });

  it('decodes a realistic DPQL expression', () => {
    // `@status == "active" && @age >= 18`
    //  ^^^^^^^                           field
    //          ==                        operator
    //             "active"               string
    //                      &&            operator
    //                         @age       variable
    //                              >=    operator
    //                                 18 number
    //
    // The actual indices the LSP server picks for DPQL_TOK_* tokens
    // aren't part of our test surface; what matters is the int-array
    // decoder rehydrates positions correctly. The legend's `variable`
    // index is 4, `operator` 14, `string` 11, `number` 12.
    const data = [
      // @status (variable, len 7, col 0)
      0, 0, 7, 4, 0,
      // == (operator, len 2, col 8 = 0 + 8 same-line delta)
      0, 8, 2, 14, 0,
      // "active" (string, len 8, col 11 = 8 + 3)
      0, 3, 8, 11, 0,
      // && (operator, len 2, col 20 = 11 + 9)
      0, 9, 2, 14, 0,
      // @age (variable, len 4, col 23 = 20 + 3)
      0, 3, 4, 4, 0,
      // >= (operator, len 2, col 28 = 23 + 5)
      0, 5, 2, 14, 0,
      // 18 (number, len 2, col 31 = 28 + 3)
      0, 3, 2, 12, 0,
    ];
    const tokens = decodeSemanticTokens(data, LEGEND);
    expect(tokens.map((t) => t.tokenType)).toEqual([
      'variable',
      'operator',
      'string',
      'operator',
      'variable',
      'operator',
      'number',
    ]);
    expect(tokens.map((t) => t.character)).toEqual([
      0, 8, 11, 20, 23, 28, 31,
    ]);
  });
});
