// Copyright 2026 Qore Technologies, s.r.o.
// Slate `decorate` hook that paints syntax highlighting using the
// LSP server's `textDocument/semanticTokens/full` response. Replaces
// the previous client-side regex highlighter (which was inherited
// from qorus-ide and turned out to be SQL keywords miscast as DPQL).
//
// Architecturally: the server is the canonical tokenizer for any
// `languageId` we serve (DPQL, Qonsole, Qore). We just decode the
// LSP-spec int-array, map each token's `{line, character, length}`
// to a Slate `Range` via the converter, and emit marks (`tokenType`,
// `tokenModifiers`) that `SmartEditor`'s renderLeaf colours.
//
// The decode math is pure and unit-tested separately; the hook is a
// thin debounce + state wrapper around it.

import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeEntry, Range, Text } from 'slate';
import {
  ILspSemanticToken,
  ILspSemanticTokensLegend,
} from '../../utils/lspClient.types';
import { lspPositionToOffset } from './helpers';
import { ISlateConverter, ISlateElement } from './types';
import type { IUseLspSessionResult } from './useLspSession';

/** Re-fetches when an empty token set comes back for a non-empty document. */
const EMPTY_RETRY_MAX = 3;
const EMPTY_RETRY_DELAY_MS = 300;

/**
 * Decode the LSP flat int-array semantic-tokens payload into
 * absolute-position `ILspSemanticToken[]`. Pure function — extracted
 * so the math can be unit-tested without a DOM or live session.
 *
 * LSP encoding: groups of 5 ints per token:
 *   [deltaLine, deltaStart, length, tokenType, tokenModifiersBitmask]
 *
 * Positions are delta-encoded relative to the *previous* token. When
 * `deltaLine > 0`, `deltaStart` is the absolute character offset from
 * the start of the new line. When `deltaLine === 0`, `deltaStart` is
 * an offset from the previous token's start character on the same line.
 *
 * Returns an empty array on a malformed payload (length not divisible
 * by 5, missing legend, out-of-range type index, etc.) rather than
 * throwing — bad input shouldn't crash the editor.
 */
export function decodeSemanticTokens(
  data: number[] | undefined | null,
  legend: ILspSemanticTokensLegend | null
): ILspSemanticToken[] {
  if (!data || !legend || data.length === 0) return [];
  if (data.length % 5 !== 0) return [];

  const tokens: ILspSemanticToken[] = [];
  let prevLine = 0;
  let prevChar = 0;

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaStart = data[i + 1];
    const length = data[i + 2];
    const typeIdx = data[i + 3];
    const modBits = data[i + 4];

    const line = prevLine + deltaLine;
    // When the token jumps to a new line, deltaStart is the absolute
    // character on the new line. When it stays on the same line, it's
    // a delta from the previous token's start character.
    const character = deltaLine === 0 ? prevChar + deltaStart : deltaStart;

    const tokenType = legend.tokenTypes[typeIdx];
    if (tokenType === undefined) {
      // Server emitted an index outside the legend — skip this token
      // but keep decoding the rest so a single garbage entry doesn't
      // kill the whole document's highlighting.
      prevLine = line;
      prevChar = character;
      continue;
    }

    const tokenModifiers: string[] = [];
    if (modBits !== 0) {
      for (let bit = 0; bit < legend.tokenModifiers.length; bit++) {
        if ((modBits & (1 << bit)) !== 0) {
          tokenModifiers.push(legend.tokenModifiers[bit]);
        }
      }
    }

    tokens.push({ line, character, length, tokenType, tokenModifiers });
    prevLine = line;
    prevChar = character;
  }

  return tokens;
}

/**
 * Convert an `ILspSemanticToken[]` into a single `(NodeEntry) =>
 * Range[]` decorate function — for each Slate text leaf, find the
 * tokens overlapping its plain-text span and emit ranges with marks.
 *
 * Plain-text offset math mirrors `useLspDiagnosticDecorations`:
 *   leafStart = converter.selectionToOffset(nodes, path, 0)
 *   leafEnd   = leafStart + node.text.length
 * Tokens whose `[startOffset, endOffset)` intersects the leaf produce
 * a range clamped to the leaf bounds.
 */
function tokensToDecorate(
  tokens: ILspSemanticToken[],
  plainText: string,
  nodes: ISlateElement[],
  converter: ISlateConverter
) {
  // Pre-compute each token's absolute plain-text [start, end) so we
  // only do the LSP→offset conversion once per token (not once per
  // leaf, which Slate calls into us repeatedly for).
  const tokenSpans = tokens.map((t) => ({
    startOffset: lspPositionToOffset(plainText, {
      line: t.line,
      character: t.character,
    }),
    endOffset: lspPositionToOffset(plainText, {
      line: t.line,
      character: t.character + t.length,
    }),
    tokenType: t.tokenType,
    tokenModifiers: t.tokenModifiers,
  }));

  return (entry: NodeEntry): Range[] => {
    if (tokenSpans.length === 0) return [];
    const [node, path] = entry;
    if (!Text.isText(node)) return [];

    const leafStart = converter.selectionToOffset(
      nodes,
      path as number[],
      0
    );
    const leafEnd = leafStart + node.text.length;

    const ranges: Range[] = [];
    for (const span of tokenSpans) {
      const overlapStart = Math.max(leafStart, span.startOffset);
      const overlapEnd = Math.min(leafEnd, span.endOffset);
      if (overlapStart >= overlapEnd) continue;
      ranges.push({
        anchor: { path, offset: overlapStart - leafStart },
        focus: { path, offset: overlapEnd - leafStart },
        tokenType: span.tokenType,
        tokenModifiers: span.tokenModifiers,
      } as unknown as Range);
    }
    return ranges;
  };
}

export interface IUseLspSemanticTokensOptions {
  /** Default `true`. Set `false` to disable LSP-driven syntax highlighting. */
  enabled?: boolean;
  /** Debounce window before re-requesting tokens. Default 250ms. */
  debounceMs?: number;
}

/**
 * LSP-driven syntax highlighting for `SmartEditor`. Returns a stable
 * `(NodeEntry) => Range[]` decorate function that the editor composes
 * with diagnostics + any caller-provided decorate.
 *
 * Behaviour:
 * - Waits for `session.isReady && session.semanticTokensLegend`. Until
 *   then, the returned decorate emits no ranges (editor body shows as
 *   plain monospace text under the connecting overlay).
 * - Whenever `nodes` changes, debounces a request to
 *   `session.client.getSemanticTokens()`. The most-recent response is
 *   memoised into the decorate; in-flight stale responses are dropped.
 * - On request error / timeout, retains the previously-decoded tokens
 *   so highlighting doesn't flash off mid-edit.
 */
export function useLspSemanticTokens(
  session: IUseLspSessionResult,
  converter: ISlateConverter,
  nodes: ISlateElement[],
  options: IUseLspSemanticTokensOptions = {}
): (entry: NodeEntry) => Range[] {
  const { enabled = true, debounceMs = 250 } = options;

  const [tokens, setTokens] = useState<ILspSemanticToken[]>([]);
  const requestIdRef = useRef(0);

  const plainText = useMemo(
    () => converter.fromSlateNodes(nodes),
    [converter, nodes]
  );

  const plainTextRef = useRef(plainText);
  plainTextRef.current = plainText;
  const emptyRetryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fetch. Re-created in the effect below so each call
  // closes over the latest session + plainText. Started as a no-op so
  // the ref always holds a function (avoids null-checks in the firing
  // effect).
  const fetchTokens = useRef<ReturnType<typeof debounce>>(
    debounce(() => undefined)
  );

  // Depend on the stable primitives inside `session` — not the `session`
  // object literal itself. `useLspSession` rebuilds its return object on
  // every render, so `[session, …]` would cancel and recreate this
  // debounce on every parent re-render and the armed fetch would never
  // get a chance to fire (see `WithServerParse` story: the
  // `dpql/toRichtext` response arrives ~10ms after `isReady` flips and
  // its three setStates would cancel the 250ms debounce before it
  // expired, so `getSemanticTokens` was never called).
  useEffect(() => {
    fetchTokens.current.cancel();
    fetchTokens.current = debounce(async () => {
      const client = session.client;
      const legend = session.semanticTokensLegend;
      if (
        !enabled ||
        !client ||
        !session.isReady ||
        !session.isContextReady ||
        !legend
      )
        return;
      const reqId = ++requestIdRef.current;
      try {
        const data = await client.getSemanticTokens();
        if (reqId !== requestIdRef.current) return; // stale
        const decoded = decodeSemanticTokens(data, legend);
        setTokens(decoded);

        if (
          decoded.length === 0 &&
          plainTextRef.current.trim() !== '' &&
          emptyRetryRef.current < EMPTY_RETRY_MAX
        ) {
          emptyRetryRef.current += 1;
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(
            () => fetchTokens.current(),
            EMPTY_RETRY_DELAY_MS
          );
        }
      } catch {
        // Keep last-known tokens on error so highlighting doesn't
        // flash off mid-edit.
      }
    }, debounceMs);
    return () => {
      fetchTokens.current.cancel();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [
    session.client,
    session.isReady,
    session.isContextReady,
    session.semanticTokensLegend,
    enabled,
    debounceMs,
  ]);

  // Fire on every document change AND when the session becomes ready
  // (first highlighting pass right after connect).
  useEffect(() => {
    if (
      !enabled ||
      !session.isReady ||
      !session.isContextReady ||
      !session.semanticTokensLegend
    )
      return;
    // Fresh document (or fresh ready session) — allow the empty-result
    // retries again.
    emptyRetryRef.current = 0;
    fetchTokens.current();
    // No cleanup — the debounce is cancelled by the outer effect on
    // session/enabled changes.
  }, [
    enabled,
    session.isReady,
    session.isContextReady,
    session.semanticTokensLegend,
    plainText,
  ]);

  return useCallback(
    (entry: NodeEntry) =>
      tokensToDecorate(tokens, plainText, nodes, converter)(entry),
    [tokens, plainText, nodes, converter]
  );
}
