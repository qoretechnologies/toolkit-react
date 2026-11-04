// Copyright 2026 Qore Technologies, s.r.o.
// Hover-tooltip support for SmartEditor. Listens for a hovering pointer
// (`isHoveringPointer`: a mouse, not a finger) moving over the editor's
// contenteditable element, debounces to 300ms idle, then asks the LSP for
// hover info at that position. The consumer
// gets back `{ hoverContent, hoverPosition }` and renders a popover.
//
// Position mapping: mouse coords → DOM caret range
// (`caretRangeFromPoint`) → Slate `Point` → plain-text offset (via the
// converter) → LSP `{line, character}`. Pure math is split into
// `slatePointToLspPosition` so it can be unit-tested without a DOM.

import { debounce } from 'lodash';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { BaseEditor, Node, Path, Point } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import { isHoveringPointer } from '../../helpers/hoveringPointer';
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
  /* The editor's own element: what is under the pointer is judged against it. A page that lays nothing out
     (jsdom) measures every box as empty, and there nothing can be judged. Asked of the editor, not of the text's
     own element: the text Slate keeps beside a chip is a zero-width character in a span of no width. */
  let root: HTMLElement | null = null;
  try {
    root = ReactEditor.toDOMNode(editor, editor) as HTMLElement;
  } catch {
    root = null;
  }
  const laidOut = (root?.getBoundingClientRect().width ?? 0) > 0;

  /* What the pointer is on is the editor's, or there is nothing of the editor's to hover: a pointer event the
     editor heard at the page's corner - a scripted click sends its events there - or a point covered by
     something drawn over the text. */
  if (laidOut && root && typeof document.elementFromPoint === 'function') {
    const under = document.elementFromPoint(clientX, clientY);
    if (!under || !root.contains(under)) {
      return null;
    }
  }

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

  /* The caret position nearest the point is the boundary between two characters: past the middle of a character
     it is after it. A hover is of the character under the pointer, so where the point is on the character before
     the caret, that is the one: resting on the right half of a `+` asked the server about the space after it, and
     showed nothing (qorus#646).

     And only of a character under the pointer: the nearest caret position is found for a point anywhere, beside
     the text or above it too, and a pointer that was on no character asked about the nearest one. A pointer event
     at the page's corner - the one a scripted click sends - opened the hover of the first word, anchored in that
     corner over the text being typed (qorus#646, Foxhoundn: "artifact text `field` and `@orders` on the top left
     of the chip"). Where the layout cannot be measured (no boxes), the caret position stands. */
  let container: globalThis.Node = domRange.startContainer;
  let offset = domRange.startOffset;
  /* A caret position in an element, not in a text, is where no line is: beside the lines or under them. The
     pointer is on no character there. (Taken for the start of the text, it gave the page's corner the hover of
     the chip the typing had just made: DpqlEditor · Quoted Field Typed Out Is A Chip.) */
  if (container.nodeType !== 3 && laidOut) {
    return null;
  }
  if (container.nodeType === 3) {
    /** The text node before or after `node` in the editor: the leaves of one line are text nodes of their own. */
    const neighbour = (node: globalThis.Node, forward: boolean): Text | null => {
      if (!root) {
        return null;
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      walker.currentNode = node;
      const step = () => (forward ? walker.nextNode() : walker.previousNode());
      let next = step();
      while (next && !(next.textContent ?? '').length) {
        next = step();
      }
      return next as Text | null;
    };
    /** Whether the point is on the character at `index` of `node`: true or false where it can be measured, else
     *  null. A character with no width (the zero-width text beside a chip) is under no pointer. */
    const onCharacter = (node: globalThis.Node | null, index: number): boolean | null => {
      if (!node || index < 0 || index >= (node.textContent ?? '').length) {
        return false;
      }
      if (!laidOut) {
        return null;
      }
      try {
        const character = document.createRange();
        character.setStart(node, index);
        character.setEnd(node, index + 1);
        const box = character.getBoundingClientRect();
        return (
          box.width > 0 &&
          clientX >= box.left &&
          clientX < box.right &&
          clientY >= box.top &&
          clientY <= box.bottom
        );
      } catch {
        return null;
      }
    };
    const length = (container.textContent ?? '').length;
    // the characters either side of the caret position, in the next or the previous leaf at a leaf's edge
    const beforeNode = offset > 0 ? container : neighbour(container, false);
    const beforeIndex = offset > 0 ? offset - 1 : (beforeNode?.textContent ?? '').length - 1;
    const afterNode = offset < length ? container : neighbour(container, true);
    const afterIndex = offset < length ? offset : 0;
    const before = onCharacter(beforeNode, beforeIndex);
    if (before) {
      container = beforeNode!;
      offset = beforeIndex;
    } else if (before === false && onCharacter(afterNode, afterIndex) === false) {
      // measured, and on neither character beside the caret: the pointer is on no character
      return null;
    }
  }

  try {
    return ReactEditor.toSlatePoint(
      editor,
      [container, offset],
      { exactMatch: false, suppressThrow: true } as any
    );
  } catch {
    return null;
  }
}

/** The chip (a tag element) under `clientX`, `clientY` in the editor, with its path, or null. */
function chipAtPoint(
  editor: BaseEditor & ReactEditor & HistoryEditor,
  clientX: number,
  clientY: number
): { path: Path; tag: ISlateElement } | null {
  try {
    // not every document can say what is at a point (jsdom)
    const element =
      typeof document.elementFromPoint === 'function' ?
        document.elementFromPoint(clientX, clientY)?.closest('[data-slate-void="true"]')
      : null;
    if (!element) return null;
    const node = ReactEditor.toSlateNode(editor, element) as ISlateElement;
    if (node.type !== 'tag') return null;
    return { path: ReactEditor.findPath(editor, node as any), tag: node };
  } catch {
    // not this editor's, or no longer in it
    return null;
  }
}

/**
 * The chip the caret is on, with its path, or null: a chip selected, or the chip the caret touches - right after
 * it, where a tap on a chip puts the caret, or right before it. A chip has no caret position inside it.
 */
function chipAtCaret(
  editor: BaseEditor & ReactEditor & HistoryEditor
): { path: Path; tag: ISlateElement } | null {
  const selection = editor.selection;
  const focus = selection?.focus;
  if (!focus || focus.path.length < 2) return null;
  try {
    const [line, child] = focus.path;
    const paragraph = Node.get(editor, [line]) as ISlateElement;
    const at = (index: number) => {
      const node = paragraph.children?.[index] as ISlateElement | undefined;
      return node?.type === 'tag' ? { path: [line, index], tag: node } : null;
    };
    const own = at(child);
    if (own) return own;
    if (selection && !Point.equals(selection.anchor, selection.focus)) return null;
    const text = paragraph.children?.[child] as { text?: string } | undefined;
    if (focus.offset === 0 && child > 0 && at(child - 1)) return at(child - 1);
    if (focus.offset === (text?.text ?? '').length && at(child + 1)) return at(child + 1);
    return null;
  } catch {
    return null;
  }
}

/**
 * The hover of a chip: what the server says at each part of the text it replaces (`converter.hoverOffsetsOf`), in
 * one hover - each said once, in order, a rule between them. A chip has no caret position of its own, so a mouse
 * resting on it was mapped to none and showed nothing (qorus#646, David: "there are no mouseover / hovers ... on the
 * chips").
 */
async function chipHover(
  client: { getHover(line: number, character: number): Promise<ILspMarkupContent | null> },
  nodes: ISlateElement[],
  path: Path,
  tag: ISlateElement,
  converter: ISlateConverter
): Promise<ILspMarkupContent | null> {
  const plainText = converter.fromSlateNodes(nodes);
  // where the chip's text starts: at the chip, before any quotes the converter writes around it
  const start = converter.selectionToOffset(nodes, [path[0], path[1]], 0);
  const offsets = converter.hoverOffsetsOf?.(String(tag.value ?? '')) ?? [0];
  const answers = await Promise.all(
    offsets.map((offset) => {
      const { line, character } = offsetToLspPosition(plainText, start + offset);
      return client.getHover(line, character);
    })
  );
  const parts: ILspMarkupContent[] = [];
  answers.forEach((answer) => {
    if (answer && !parts.some((part) => part.value === answer.value)) {
      parts.push(answer);
    }
  });
  if (!parts.length) return null;
  const kind = parts.every((part) => part.kind === 'markdown') ? 'markdown' : 'plaintext';
  return {
    kind,
    value: parts.map((part) => part.value).join(kind === 'markdown' ? '\n\n---\n\n' : '\n\n'),
  };
}

export interface IUseLspHoverOptions {
  /** Default `true`. Set to `false` to disable the hovering pointer's listener. */
  enabled?: boolean;
  /** Debounce window before issuing the LSP request. Default 300ms. */
  debounceMs?: number;
  /**
   * Whether a chip draws a hover of its own (its tag props carry a tooltip: a field the record describes). A mouse
   * resting on one is shown that, and not the server's as well; "Details" still shows the server's.
   */
  chipHasOwnHover?: (tag: ISlateElement) => boolean;
}

/** Where a hover is anchored on the screen, in viewport coordinates. */
export interface ILspHoverAnchor {
  left: number;
  top: number;
}

export interface IUseLspHoverResult {
  /** Markup content returned by the LSP, or `null` when no hover info. */
  hoverContent: ILspMarkupContent | null;
  /** Viewport-coordinate position to anchor the popover. */
  hoverPosition: { left: number; top: number } | null;
  /**
   * Which hover is shown: a new number each time one is, so a popover can be keyed by it and dismiss it
   * alone (see `clearHover`). `0` before the first.
   */
  hoverId: number;
  /**
   * Dismiss the hover shown. Given the `hoverId` of the hover being dismissed, only that one: a popover
   * closing as the next hover replaces it - it unmounts, and says it closed - dismissed that next hover
   * too, so the mouse resting on the next word, or "Details" pressed while a hover was up, showed nothing.
   */
  clearHover: (hoverId?: number) => void;
  /**
   * Show what the server says of the word at the caret: the hover where there is no pointer to hover with (a
   * finger's "Details", see `SmartEditor`). Anchored at `at` when given (the Details button, so the hover does
   * not cover the text), else at the caret. Resolves to the `hoverId` of the hover shown; nothing when the caret
   * is nowhere or the server says nothing of it.
   */
  showAtCaret: (at?: ILspHoverAnchor) => Promise<number | undefined>;
}

/**
 * Hover-tooltip state for the SmartEditor. Attaches a `pointermove`
 * listener for a hovering pointer to the editor's contenteditable element
 * via the supplied editor ref and resolves LSP hover content under the
 * cursor when the mouse goes idle for `debounceMs`.
 */
export function useLspHover(
  session: IUseLspSessionResult,
  editorRef: RefObject<
    (BaseEditor & ReactEditor & HistoryEditor) | null
  >,
  converter: ISlateConverter,
  options: IUseLspHoverOptions = {}
): IUseLspHoverResult {
  const { enabled = true, debounceMs = 300, chipHasOwnHover } = options;
  // read when the mouse rests, so a new function from the host each render does not re-create the listener
  const chipHasOwnHoverRef = useRef(chipHasOwnHover);
  chipHasOwnHoverRef.current = chipHasOwnHover;

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

  const [hoverId, setHoverId] = useState(0);
  // the hover shown now, read by `clearHover` when it is called from a popover that may be an older one's
  const hoverIdRef = useRef(0);

  const clearHover = useCallback((ofHover?: number) => {
    if (ofHover !== undefined && ofHover !== hoverIdRef.current) {
      return;
    }
    setHoverContent(null);
    setHoverPosition(null);
  }, []);

  /** Shows `content` at `position` as a hover of its own. */
  const showHover = useCallback(
    (content: ILspMarkupContent, position: { left: number; top: number }) => {
      hoverIdRef.current += 1;
      setHoverId(hoverIdRef.current);
      setHoverContent(content);
      setHoverPosition(position);
    },
    []
  );

  // Debounced fetch. Re-created in the effect below whenever any of
  // its inputs change. Started as a no-op so the ref is always a
  // function — avoids null-checks in the pointermove listener. The dep
  // array lists the stable primitives inside `session`, not the object
  // itself — `useLspSession` rebuilds its return object every render,
  // which would cancel and recreate this debounce on every parent
  // re-render (see useLspSemanticTokens for the original incident).
  const fetchHover = useRef<ReturnType<typeof debounce>>(
    debounce(() => undefined)
  );
  /* Where a hovering pointer rests over the editor, until it leaves: what a hover is asked for once the session can
     answer. A mouse that came to rest on a word while the editor was still connecting (a read-only summary drawn as
     a row closes) showed nothing until it moved again. */
  const restingAt = useRef<{ clientX: number; clientY: number } | null>(null);
  const couldAnswer = useRef(false);

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

      const nodes = editor.children as ISlateElement[];
      // a chip replaces its text: it is hovered as that text is (`chipHover`)
      const chip = chipAtPoint(editor, clientX, clientY);
      if (chip && chipHasOwnHoverRef.current?.(chip.tag)) {
        // the chip's own hover is shown: one hover over a chip, not two
        ++requestIdRef.current;
        clearHover();
        return;
      }
      if (chip) {
        const reqId = ++requestIdRef.current;
        try {
          const content = await chipHover(client, nodes, chip.path, chip.tag, converter);
          if (reqId !== requestIdRef.current) return; // stale
          if (content) {
            showHover(content, { left: clientX, top: clientY });
          } else {
            clearHover();
          }
        } catch {
          clearHover();
        }
        return;
      }

      const point = mousePositionToSlatePoint(editor, clientX, clientY);
      if (!point) {
        clearHover();
        return;
      }

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
        // Anchor the popover at the mouse cursor. The design doc calls
        // for "token center" — that requires building a Range over the
        // word boundaries and reading its rect. Defer to a follow-up
        // refinement; mouse-coord positioning already feels natural.
        showHover(content, { left: clientX, top: clientY });
      } catch {
        clearHover();
      }
    }, debounceMs);
    // the session has just come to answer: a pointer already resting on the text is answered now
    const canAnswer = !!(enabled && session.client && session.isReady && session.isContextReady);
    if (canAnswer && !couldAnswer.current && restingAt.current) {
      fetchHover.current(restingAt.current.clientX, restingAt.current.clientY);
    }
    couldAnswer.current = canAnswer;
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
    showHover,
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

    /* A pointer event, not a mouse event: the mouse events a browser emulates after a tap say nothing of the
       finger they came from, and opened the hover where a tap had put the caret, on a touch screen whose way
       to the hover is "Details" (see `isHoveringPointer`). A finger's pointer events start nothing here. */
    const onMove = (e: PointerEvent) => {
      if (!isHoveringPointer(e)) {
        return;
      }
      restingAt.current = { clientX: e.clientX, clientY: e.clientY };
      // Cancel any pending hover the moment the mouse moves — the
      // previous coords are stale. The debounced trailing call only
      // fires after `debounceMs` of true idle.
      fetchHover.current.cancel();
      fetchHover.current(e.clientX, e.clientY);
    };
    // the mouse leaving takes its hover with it; a finger lifted leaves a hover "Details" showed
    const onLeave = (e: PointerEvent) => {
      if (!isHoveringPointer(e)) {
        return;
      }
      restingAt.current = null;
      fetchHover.current.cancel();
      clearHover();
    };

    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerleave', onLeave);
    return () => {
      dom?.removeEventListener('pointermove', onMove);
      dom?.removeEventListener('pointerleave', onLeave);
      fetchHover.current.cancel();
    };
    // Re-attach on enabled / session.isReady changes; the editor itself
    // is stable across renders so it's not a dep here.
  }, [enabled, session.isReady, clearHover, editorRef]);

  const showAtCaret = useCallback(
    async (at?: ILspHoverAnchor) => {
      const editor = editorRef.current;
      const client = session.client;
      if (
        !enabled ||
        !editor ||
        !client ||
        !session.isReady ||
        !session.isContextReady ||
        !editor.selection
      ) {
        return undefined;
      }
      const point = editor.selection.focus;
      const nodes = editor.children as ISlateElement[];
      const { line, character } = slatePointToLspPosition(
        { path: point.path as number[], offset: point.offset },
        nodes,
        converter
      );
      // the caret on a chip: its hover is the chip's, as a mouse resting on it would show (`chipHover`)
      const chip = chipAtCaret(editor);
      let anchor: { left: number; top: number };
      try {
        const rect = ReactEditor.toDOMRange(editor, editor.selection).getBoundingClientRect();
        anchor = at ?? { left: rect.left, top: rect.top };
      } catch {
        return undefined;
      }
      fetchHover.current.cancel();
      const reqId = ++requestIdRef.current;
      try {
        const content =
          chip ?
            await chipHover(client, nodes, chip.path, chip.tag, converter)
          : await client.getHover(line, character);
        if (reqId !== requestIdRef.current) return undefined; // stale
        if (!content) {
          clearHover();
          return undefined;
        }
        showHover(content, anchor);
        return hoverIdRef.current;
      } catch {
        clearHover();
        return undefined;
      }
    },
    [
      enabled,
      editorRef,
      session.client,
      session.isReady,
      session.isContextReady,
      converter,
      clearHover,
      showHover,
    ]
  );

  return { hoverContent, hoverPosition, hoverId, clearHover, showAtCaret };
}
