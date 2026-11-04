// Copyright 2026 Qore Technologies, s.r.o.
// The stories' stand-in servers answer a hover as the live Qorus `/lsp` does (qorus#646, David: "there are no
// mouseover / hovers on the functions or on the chips"). Checked against the live server's answers at every
// character of four DPQL texts, captured from professor's `/lsp` (liveDpqlHovers.json says how).
import { mockHoverDpql } from '../../src/components/dpqlEditor/__fixtures__/dpqlMockHover';
import LIVE from './liveDpqlHovers.json';

describe("the stand-in's hover", () => {
  for (const { text, fields, hovers } of LIVE.captures) {
    test(`is the live server's at every character of ${JSON.stringify(text.slice(0, 40))}… (${
      fields ? 'with' : 'without'
    } the record's fields)`, () => {
      const answered = hovers.map(
        (_live, character) =>
          mockHoverDpql(text, { line: 0, character }, fields ?? undefined)?.contents.value ?? null
      );
      // character by character, so a difference names where it is
      expect(answered.map((value, character) => [character, text[character], value])).toEqual(
        hovers.map((value, character) => [character, text[character], value])
      );
    });
  }

  test('has none on a line the text does not have', () => {
    expect(mockHoverDpql('@a', { line: 3, character: 0 })).toBeNull();
  });
});
