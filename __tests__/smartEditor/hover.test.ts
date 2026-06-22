// Copyright 2026 Qore Technologies, s.r.o.
// Position-mapping tests for `useLspHover`. The DOM-touching paths
// (`mousePositionToSlatePoint`, the mousemove listener) are not testable
// in jsdom — those are validated by the play tests / live stories. What
// we CAN unit-test is the pure math: Slate point + document → LSP
// `{line, character}`.

import { defaultSlateConverter } from '../../src/components/smartEditor/helpers';
import { ISlateElement } from '../../src/components/smartEditor/types';
import { slatePointToLspPosition } from '../../src/components/smartEditor/useLspHover';

describe('slatePointToLspPosition', () => {
  it('maps offset 0 on the first leaf to line 0, character 0', () => {
    const nodes: ISlateElement[] = [
      { type: 'paragraph', children: [{ text: 'hello world' }] },
    ];
    const pos = slatePointToLspPosition(
      { path: [0, 0], offset: 0 },
      nodes,
      defaultSlateConverter
    );
    expect(pos).toEqual({ line: 0, character: 0 });
  });

  it('maps a mid-line offset to the right line/character', () => {
    const nodes: ISlateElement[] = [
      { type: 'paragraph', children: [{ text: 'hello world' }] },
    ];
    const pos = slatePointToLspPosition(
      { path: [0, 0], offset: 6 },
      nodes,
      defaultSlateConverter
    );
    expect(pos).toEqual({ line: 0, character: 6 });
  });

  it('maps onto a second paragraph (line 1)', () => {
    const nodes: ISlateElement[] = [
      { type: 'paragraph', children: [{ text: 'hello' }] },
      { type: 'paragraph', children: [{ text: 'world' }] },
    ];
    const pos = slatePointToLspPosition(
      { path: [1, 0], offset: 3 },
      nodes,
      defaultSlateConverter
    );
    expect(pos).toEqual({ line: 1, character: 3 });
  });

  it('handles offset at end of the last leaf', () => {
    const nodes: ISlateElement[] = [
      { type: 'paragraph', children: [{ text: 'foo' }] },
    ];
    const pos = slatePointToLspPosition(
      { path: [0, 0], offset: 3 },
      nodes,
      defaultSlateConverter
    );
    expect(pos).toEqual({ line: 0, character: 3 });
  });
});
