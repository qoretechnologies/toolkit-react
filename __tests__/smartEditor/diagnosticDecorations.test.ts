// Copyright 2026 Qore Technologies, s.r.o.
// Position-mapping tests for `useLspDiagnosticDecorations`. We don't
// render Slate here — the hook returns a pure decorate function, so we
// can call it with synthetic node entries and assert on the produced
// Range[] structure.

import { renderHook } from '@testing-library/react';
import { ILspDiagnostic } from '../../src/utils/lspClient.types';
import { defaultSlateConverter } from '../../src/components/smartEditor/helpers';
import { ISlateElement } from '../../src/components/smartEditor/types';
import {
  severityToIntent,
  useLspDiagnosticDecorations,
} from '../../src/components/smartEditor/useLspDiagnosticDecorations';

function makeDoc(text: string): ISlateElement[] {
  return [{ type: 'paragraph', children: [{ text }] }];
}

describe('useLspDiagnosticDecorations', () => {
  it('returns an empty range list when no diagnostics are active', () => {
    const nodes = makeDoc('hello world');
    const { result } = renderHook(() =>
      useLspDiagnosticDecorations([], defaultSlateConverter, nodes)
    );
    const ranges = result.current([nodes[0].children[0] as any, [0, 0]]);
    expect(ranges).toEqual([]);
  });

  it('returns an empty range list for non-text nodes', () => {
    const nodes = makeDoc('hello');
    const diag: ILspDiagnostic = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      message: 'bad',
      severity: 1,
    };
    const { result } = renderHook(() =>
      useLspDiagnosticDecorations([diag], defaultSlateConverter, nodes)
    );
    // Passing an element (paragraph) as the entry — decorate is only for leaves.
    const ranges = result.current([nodes[0] as any, [0]]);
    expect(ranges).toEqual([]);
  });

  it('emits a range that exactly covers a diagnostic on a single leaf', () => {
    const nodes = makeDoc('hello world');
    const diag: ILspDiagnostic = {
      range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
      message: 'unknown word: world',
      severity: 1,
    };
    const { result } = renderHook(() =>
      useLspDiagnosticDecorations([diag], defaultSlateConverter, nodes)
    );
    const ranges = result.current([
      nodes[0].children[0] as any,
      [0, 0],
    ]);
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({
      anchor: { path: [0, 0], offset: 6 },
      focus: { path: [0, 0], offset: 11 },
      error: true,
      errorMessage: 'unknown word: world',
      severity: 1,
    });
  });

  it('clamps overlap to the leaf bounds when the diagnostic spans further', () => {
    const nodes = makeDoc('foo');
    const diag: ILspDiagnostic = {
      range: { start: { line: 0, character: 1 }, end: { line: 0, character: 100 } },
      message: 'oops',
      severity: 2,
    };
    const { result } = renderHook(() =>
      useLspDiagnosticDecorations([diag], defaultSlateConverter, nodes)
    );
    const ranges = result.current([
      nodes[0].children[0] as any,
      [0, 0],
    ]);
    expect(ranges).toHaveLength(1);
    // Diagnostic extends past EOL; range should clamp to leaf length (3).
    expect(ranges[0]).toMatchObject({
      anchor: { path: [0, 0], offset: 1 },
      focus: { path: [0, 0], offset: 3 },
      severity: 2,
    });
  });

  it('emits multiple ranges when multiple diagnostics overlap a single leaf', () => {
    const nodes = makeDoc('abcdefghij');
    const diags: ILspDiagnostic[] = [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
        message: 'first',
        severity: 1,
      },
      {
        range: { start: { line: 0, character: 5 }, end: { line: 0, character: 8 } },
        message: 'second',
        severity: 2,
      },
    ];
    const { result } = renderHook(() =>
      useLspDiagnosticDecorations(diags, defaultSlateConverter, nodes)
    );
    const ranges = result.current([
      nodes[0].children[0] as any,
      [0, 0],
    ]);
    expect(ranges).toHaveLength(2);
    expect((ranges[0] as any).errorMessage).toBe('first');
    expect((ranges[1] as any).errorMessage).toBe('second');
  });

  it('skips diagnostics that do not overlap the leaf', () => {
    // Two-paragraph doc — line 0 is "hello", line 1 is "world".
    const nodes: ISlateElement[] = [
      { type: 'paragraph', children: [{ text: 'hello' }] },
      { type: 'paragraph', children: [{ text: 'world' }] },
    ];
    const diag: ILspDiagnostic = {
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
      message: 'on the second line',
      severity: 1,
    };
    const { result } = renderHook(() =>
      useLspDiagnosticDecorations([diag], defaultSlateConverter, nodes)
    );
    // Decorate for the FIRST-paragraph leaf — shouldn't emit anything.
    const firstLeafRanges = result.current([
      nodes[0].children[0] as any,
      [0, 0],
    ]);
    expect(firstLeafRanges).toEqual([]);
    // Decorate for the SECOND-paragraph leaf — should emit the range.
    const secondLeafRanges = result.current([
      nodes[1].children[0] as any,
      [1, 0],
    ]);
    expect(secondLeafRanges).toHaveLength(1);
  });

  it('defaults severity to 1 (Error) when omitted', () => {
    const nodes = makeDoc('hi');
    const diag: ILspDiagnostic = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } },
      message: 'no severity',
    };
    const { result } = renderHook(() =>
      useLspDiagnosticDecorations([diag], defaultSlateConverter, nodes)
    );
    const ranges = result.current([
      nodes[0].children[0] as any,
      [0, 0],
    ]);
    expect((ranges[0] as any).severity).toBe(1);
  });
});

describe('severityToIntent', () => {
  it('maps 1 Error → "danger"', () => {
    expect(severityToIntent(1)).toBe('danger');
  });

  it('maps 2 Warning → "warning"', () => {
    expect(severityToIntent(2)).toBe('warning');
  });

  it('maps 3+ to "info"', () => {
    expect(severityToIntent(3)).toBe('info');
    expect(severityToIntent(4)).toBe('info');
  });

  it('falls back to "info" when severity is missing', () => {
    expect(severityToIntent(undefined)).toBe('info');
  });
});
