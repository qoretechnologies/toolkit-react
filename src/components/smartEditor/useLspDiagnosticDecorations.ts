// Copyright 2026 Qore Technologies, s.r.o.
// Slate `decorate` hook that converts LSP `publishDiagnostics` payloads
// into per-leaf decoration ranges. Each range carries `error: true`
// plus the diagnostic's `message` and `severity`, which the editor's
// `customRenderLeaf` can pick up to draw the inline wavy underline /
// hover-title state. Composes with a caller-supplied syntax-highlight
// `decorate` in the wrapper (e.g. `DpqlEditor.tsx` merges the two).

import { useCallback, useMemo } from 'react';
import { NodeEntry, Range, Text } from 'slate';
import { ILspDiagnostic } from '../../utils/lspClient.types';
import { lspPositionToOffset } from './helpers';
import { ISlateConverter, ISlateElement } from './types';

/** Marks added to decoration ranges so `customRenderLeaf` can style them. */
export interface IDiagnosticMarks {
  /** Truthy when this leaf falls inside a diagnostic's reported range. */
  error: true;
  /** The diagnostic's user-facing message (rendered in a hover-title). */
  errorMessage: string;
  /** LSP `DiagnosticSeverity` — 1 Error, 2 Warning, 3 Info, 4 Hint. */
  severity: number;
}

/**
 * Build a Slate `decorate` function that paints diagnostic spans over
 * the document.
 *
 * The function is recomputed whenever `diagnostics` or `nodes` change,
 * and per-call iteration over diagnostics is `O(diagnostics × text-leaves)` —
 * fine for the editor scale we target (typical document under a few
 * hundred characters, a handful of diagnostics).
 *
 * @param diagnostics  Most-recent `session.diagnostics`.
 * @param converter    The same converter passed to `SmartEditor`. We use
 *                     it to compute the plain-text projection and the
 *                     plain-text offset of any node — both required to
 *                     intersect a diagnostic's `{line, character}` LSP
 *                     range with each Slate text leaf.
 * @param nodes        Current Slate document. The hook captures this in
 *                     a closure; pass the same `slateValue` you hand
 *                     `ReqoreRichTextEditor`.
 */
export function useLspDiagnosticDecorations(
  diagnostics: ILspDiagnostic[],
  converter: ISlateConverter,
  nodes: ISlateElement[]
): (entry: NodeEntry) => Range[] {
  // Pre-compute the plain-text projection AND each diagnostic's
  // `[startOffset, endOffset]` once per render — the alternative is
  // recomputing both inside the decorate callback for every text leaf
  // Slate walks, which is wasteful.
  const plainText = useMemo(
    () => converter.fromSlateNodes(nodes),
    [converter, nodes]
  );
  const diagOffsets = useMemo(
    () =>
      diagnostics.map((d) => ({
        startOffset: lspPositionToOffset(plainText, d.range.start),
        endOffset: lspPositionToOffset(plainText, d.range.end),
        message: d.message,
        severity: d.severity ?? 1,
      })),
    [diagnostics, plainText]
  );

  return useCallback(
    (entry: NodeEntry) => {
      if (diagOffsets.length === 0) return [];
      const [node, path] = entry;
      if (!Text.isText(node)) return [];

      // Where this leaf starts/ends in the plain-text projection. The
      // converter's `selectionToOffset` with `anchorOffset: 0` gives the
      // leaf's start; add `node.text.length` for the end.
      const leafStart = converter.selectionToOffset(
        nodes,
        path as number[],
        0
      );
      const leafEnd = leafStart + node.text.length;

      const ranges: Range[] = [];
      for (const diag of diagOffsets) {
        const overlapStart = Math.max(leafStart, diag.startOffset);
        const overlapEnd = Math.min(leafEnd, diag.endOffset);
        if (overlapStart >= overlapEnd) continue;
        // Emit a Slate `Range` (anchor + focus) over the offset window
        // INSIDE this leaf. Slate then applies the extra marks
        // (`error`, `errorMessage`, `severity`) to the styled span.
        ranges.push({
          anchor: { path, offset: overlapStart - leafStart },
          focus: { path, offset: overlapEnd - leafStart },
          error: true,
          errorMessage: diag.message,
          severity: diag.severity,
        } as unknown as Range);
      }
      return ranges;
    },
    [diagOffsets, converter, nodes]
  );
}

/**
 * Map LSP `DiagnosticSeverity` → Reqore intent. Useful for the
 * `ReqoreMessage` panel below the editor:
 *   1 Error   → `'danger'`
 *   2 Warning → `'warning'`
 *   3 Info    → `'info'`
 *   4 Hint    → `'info'`
 */
export function severityToIntent(
  severity?: number
): 'danger' | 'warning' | 'info' {
  switch (severity) {
    case 1:
      return 'danger';
    case 2:
      return 'warning';
    default:
      return 'info';
  }
}
