// Copyright 2026 Qore Technologies, s.r.o.
// Signature-help support for SmartEditor — pinned popover that shows
// the active call's signature label, the active parameter highlighted,
// and the active parameter's documentation. Fires on document/selection
// changes (debounced); the server's signatureHelp handler decides what
// (if anything) to return based on the cursor's context within the
// call. Dismisses on no-signature responses and on Escape (handled at
// the SmartEditor level via `clearSignature`).
//
// Position-mapping mirrors useLspSemanticTokens: pure offset math via
// the converter. Hook returns `{signature, position, clearSignature}`.

import { debounce } from 'lodash';
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BaseEditor, Editor } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import { ILspSignatureHelp } from '../../utils/lspClient.types';
import { offsetToLspPosition } from './helpers';
import { ISlateConverter, ISlateElement } from './types';
import type { IUseLspSessionResult } from './useLspSession';

export interface IUseLspSignatureHelpOptions {
  /** Default `true`. Set to `false` to disable. */
  enabled?: boolean;
  /** Debounce window before issuing the LSP request. Default 100ms. */
  debounceMs?: number;
}

export interface IUseLspSignatureHelpResult {
  /** Response from the LSP, or `null` when no signature available. */
  signature: ILspSignatureHelp | null;
  /** Viewport-coordinate anchor for the signature pill (top of cursor line). */
  position: { left: number; top: number } | null;
  /** Imperatively dismiss the current signature pill. */
  clearSignature: () => void;
}

export function useLspSignatureHelp(
  session: IUseLspSessionResult,
  editorRef: RefObject<
    (BaseEditor & ReactEditor & HistoryEditor) | null
  >,
  converter: ISlateConverter,
  nodes: ISlateElement[],
  options: IUseLspSignatureHelpOptions = {}
): IUseLspSignatureHelpResult {
  const { enabled = true, debounceMs = 100 } = options;

  const [signature, setSignature] = useState<ILspSignatureHelp | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  // Track latest in-flight request so a slow response can't overwrite
  // newer state.
  const requestIdRef = useRef(0);

  const clearSignature = useCallback(() => {
    setSignature(null);
    setPosition(null);
  }, []);

  // Pre-compute plain text from the slate document. Same memo
  // pattern as useLspSemanticTokens.
  const plainText = useMemo(
    () => converter.fromSlateNodes(nodes),
    [converter, nodes]
  );

  // Debounced fetch. Re-created via the effect below to capture the
  // latest session/plainText/etc. Started as a no-op so the ref is
  // always a function.
  const fetchSignature = useRef<ReturnType<typeof debounce>>(
    debounce(() => undefined)
  );

  // Depend on stable primitives inside `session` (not `session`
  // itself, which is rebuilt every render — `useLspSession` returns a
  // fresh object).
  useEffect(() => {
    fetchSignature.current.cancel();
    fetchSignature.current = debounce(async () => {
      const editor = editorRef.current;
      const client = session.client;
      if (
        !enabled ||
        !editor ||
        !client ||
        !session.isReady ||
        !session.isContextReady ||
        !session.capabilities?.signatureHelpProvider
      ) {
        clearSignature();
        return;
      }
      // If the editor doesn't have a focused selection (e.g. fresh
      // mount before user interaction), fall back to the end of the
      // document. Without this, the hook would never fire on mount
      // — the demo story can't ask the user to click first.
      let selection = editor.selection;
      if (!selection) {
        try {
          const end = Editor.end(editor, []);
          selection = { anchor: end, focus: end };
        } catch {
          clearSignature();
          return;
        }
      }

      // Map the current selection's anchor to an LSP {line, character}.
      const currentNodes = editor.children as ISlateElement[];
      const text = converter.fromSlateNodes(currentNodes);
      const offset = converter.selectionToOffset(
        currentNodes,
        selection.anchor.path as number[],
        selection.anchor.offset
      );
      const { line, character } = offsetToLspPosition(text, offset);

      const reqId = ++requestIdRef.current;
      try {
        const result = await client.getSignatureHelp(line, character);
        if (reqId !== requestIdRef.current) return; // stale
        // LSP servers signal "no signature" either by responding `null`
        // or by responding `{signatures: []}` — treat both as dismiss.
        if (!result || !result.signatures || result.signatures.length === 0) {
          clearSignature();
          return;
        }
        setSignature(result);
        // Anchor the pill ABOVE the current cursor line so it
        // doesn't overlap the completion popover, which anchors at
        // BELOW the line. The two can coexist on a single line
        // when a function call's args are mid-typed.
        try {
          const domRange = ReactEditor.toDOMRange(editor, selection);
          const rect = domRange.getBoundingClientRect();
          if (rect.width || rect.height || rect.left || rect.top) {
            setPosition({ left: rect.left, top: rect.top - 4 });
          }
        } catch {
          // Editor unmounted mid-request — keep last-known position.
        }
      } catch {
        if (reqId === requestIdRef.current) clearSignature();
      }
    }, debounceMs);
    return () => fetchSignature.current.cancel();
  }, [
    session.client,
    session.isReady,
    session.isContextReady,
    session.capabilities,
    converter,
    enabled,
    debounceMs,
    editorRef,
    clearSignature,
  ]);

  // Fire on document changes (text content) AND when the session
  // becomes ready/capabilities arrive. The signature-help request
  // itself reads the live selection from `editorRef.current` so
  // cursor-only moves are picked up too — SmartEditor's
  // `onSlateChangeImpl` triggers a render on every Slate change,
  // which re-runs this effect's deps closure (plainText changes
  // when content does) and the editor's selection is read inside
  // the debounced fetch.
  useEffect(() => {
    if (
      !enabled ||
      !session.isReady ||
      !session.isContextReady ||
      !session.capabilities?.signatureHelpProvider
    ) {
      return;
    }
    fetchSignature.current();
  }, [
    enabled,
    session.isReady,
    session.isContextReady,
    session.capabilities,
    plainText,
  ]);

  return { signature, position, clearSignature };
}
