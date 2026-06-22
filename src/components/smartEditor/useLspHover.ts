// Copyright 2026 Qore Technologies, s.r.o.
// Hover-tooltip support for SmartEditor. Listens for `mousemove` on
// the editor's contenteditable element, debounces to 300ms idle, then
// asks the LSP for hover info at that mouse position. The consumer
// gets back `{ hoverContent, hoverPosition }` and renders a popover.
//
// Position mapping: mouse coords → DOM caret range
// (`caretRangeFromPoint`) → Slate `Point` → plain-text offset (via the
// converter) → LSP `{line, character}`. Pure math is split into
// `slatePointToLspPosition` so it can be unit-tested without a DOM.

import { debounce } from 'lodash';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { BaseEditor, Point } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import { ILspMarkupContent } from '../../utils/lspClient.types';
import { offsetToLspPosition } from './helpers';
import { ISlateConverter, ISlateElement } from './types';
import type { IUseLspSessionResult } from './useLspSession';

/**
 * Pure math: Slate point + Slate document → LSP `{line, character}`
 * position in the plain-text projection. Extracted from the hook so it
 * can be tested without a DOM / Slate editor instance.
 */
export function slatePointToLspPosition(
  point: { path: number[]; offset: number },
  nodes: ISlateElement[],
  converter: ISlateConverter
): { line: number; character: number } {
  const plainText = converter.fromSlateNodes(nodes);
  const offset = converter.selectionToOffset(nodes, point.path, point.offset);
  return offsetToLspPosition(plainText, offset);
}

/**
 * Resolve mouse-event viewport coordinates into a Slate `Point`. Uses
 * the standard `document.caretRangeFromPoint` (WebKit / Chromium) with
 * a Firefox fallback to `caretPositionFromPoint`. Returns `null` when
 * the point lies outside any text node or Slate can't map the DOM
 * position back into its tree (e.g. inside a void inline).
 */
function mousePositionToSlatePoint(
  editor: BaseEditor & ReactEditor & HistoryEditor,
  clientX: number,
  clientY: number
): Point | null {
  let domRange: Range | null = null;

  // Chromium / WebKit
  if (typeof (document as any).caretRangeFromPoint === 'function') {
    domRange = (document as any).caretRangeFromPoint(clientX, clientY);
  } else if (typeof (document as any).caretPositionFromPoint === 'function') {
    // Firefox shape: `{ offsetNode, offset }`
    const pos = (document as any).caretPositionFromPoint(clientX, clientY);
    if (pos) {
      domRange = document.createRange();
      domRange.setStart(pos.offsetNode, pos.offset);
      domRange.collapse(true);
    }
  }
  if (!domRange) return null;

  try {
    return ReactEditor.toSlatePoint(
      editor,
      [domRange.startContainer, domRange.startOffset],
      { exactMatch: false, suppressThrow: true } as any
    );
  } catch {
    return null;
  }
}

export interface IUseLspHoverOptions {
  /** Default `true`. Set to `false` to disable the mousemove listener. */
  enabled?: boolean;
  /** Debounce window before issuing the LSP request. Default 300ms. */
  debounceMs?: number;
}

export interface IUseLspHoverResult {
  /** Markup content returned by the LSP, or `null` when no hover info. */
  hoverContent: ILspMarkupContent | null;
  /** Viewport-coordinate position to anchor the popover. */
  hoverPosition: { left: number; top: number } | null;
  /** Imperatively dismiss the current hover popover. */
  clearHover: () => void;
}

/**
 * Hover-tooltip state for the SmartEditor. Attaches a `mousemove`
 * listener to the editor's contenteditable element via the supplied
 * editor ref and resolves LSP hover content under the cursor when the
 * mouse goes idle for `debounceMs`.
 */
export function useLspHover(
  session: IUseLspSessionResult,
  editorRef: RefObject<
    (BaseEditor & ReactEditor & HistoryEditor) | null
  >,
  converter: ISlateConverter,
  options: IUseLspHoverOptions = {}
): IUseLspHoverResult {
  const { enabled = true, debounceMs = 300 } = options;

  const [hoverContent, setHoverContent] = useState<ILspMarkupContent | null>(
    null
  );
  const [hoverPosition, setHoverPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  // Track the latest request id so a slow in-flight response can't
  // overwrite a newer hover state (e.g. the user moved away before the
  // server replied).
  const requestIdRef = useRef(0);

  const clearHover = useCallback(() => {
    setHoverContent(null);
    setHoverPosition(null);
  }, []);

  // Debounced fetch. Re-created in the effect below whenever any of
  // its inputs change. Started as a no-op so the ref is always a
  // function — avoids null-checks in the mousemove listener. The dep
  // array lists the stable primitives inside `session`, not the object
  // itself — `useLspSession` rebuilds its return object every render,
  // which would cancel and recreate this debounce on every parent
  // re-render (see useLspSemanticTokens for the original incident).
  const fetchHover = useRef<ReturnType<typeof debounce>>(
    debounce(() => undefined)
  );

  useEffect(() => {
    fetchHover.current.cancel();
    fetchHover.current = debounce(async (clientX: number, clientY: number) => {
      const editor = editorRef.current;
      const client = session.client;
      if (
        !enabled ||
        !editor ||
        !client ||
        !session.isReady ||
        !session.isContextReady
      )
        return;

      const point = mousePositionToSlatePoint(editor, clientX, clientY);
      if (!point) {
        clearHover();
        return;
      }

      const nodes = editor.children as ISlateElement[];
      const { line, character } = slatePointToLspPosition(
        { path: point.path as number[], offset: point.offset },
        nodes,
        converter
      );

      const reqId = ++requestIdRef.current;
      try {
        const content = await client.getHover(line, character);
        if (reqId !== requestIdRef.current) return; // stale
        if (!content) {
          clearHover();
          return;
        }
        setHoverContent(content);
        // Anchor the popover at the mouse cursor. The design doc calls
        // for "token center" — that requires building a Range over the
        // word boundaries and reading its rect. Defer to a follow-up
        // refinement; mouse-coord positioning already feels natural.
        setHoverPosition({ left: clientX, top: clientY });
      } catch {
        clearHover();
      }
    }, debounceMs);
    return () => fetchHover.current.cancel();
  }, [
    session.client,
    session.isReady,
    session.isContextReady,
    editorRef,
    converter,
    enabled,
    debounceMs,
    clearHover,
  ]);

  useEffect(() => {
    if (!enabled) return undefined;
    const editor = editorRef.current;
    if (!editor) return undefined;
    let dom: HTMLElement | null = null;
    try {
      dom = ReactEditor.toDOMNode(editor, editor) as HTMLElement;
    } catch {
      return undefined;
    }
    if (!dom) return undefined;

    const onMove = (e: MouseEvent) => {
      // Cancel any pending hover the moment the mouse moves — the
      // previous coords are stale. The debounced trailing call only
      // fires after `debounceMs` of true idle.
      fetchHover.current.cancel();
      fetchHover.current(e.clientX, e.clientY);
    };
    const onLeave = () => {
      fetchHover.current.cancel();
      clearHover();
    };

    dom.addEventListener('mousemove', onMove);
    dom.addEventListener('mouseleave', onLeave);
    return () => {
      dom?.removeEventListener('mousemove', onMove);
      dom?.removeEventListener('mouseleave', onLeave);
      fetchHover.current.cancel();
    };
    // Re-attach on enabled / session.isReady changes; the editor itself
    // is stable across renders so it's not a dep here.
  }, [enabled, session.isReady, clearHover, editorRef]);

  return { hoverContent, hoverPosition, clearHover };
}
