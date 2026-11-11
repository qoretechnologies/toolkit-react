// Copyright 2026 Qore Technologies, s.r.o.
import { createPortal } from 'react-dom';
import { ReactNode, useLayoutEffect, useMemo, useReducer, useRef } from 'react';

/*
 * A row is drawn once, and shown wherever its box puts it.
 *
 * The status boxes (Needs attention, Set, Optional) follow what a row holds as it changes: the first character typed
 * into an empty required field makes it set, and it belongs in Set at once. Drawn inside its box, a row that changed
 * box was a new row - React mounts what is drawn under a new parent anew - so the field being typed in lost its
 * editor, its caret and anything it held only in itself (a list item just added and opened). The boxes kept a row
 * being edited in the box it was opened in instead, and the counts said otherwise: a list given an empty item sat in
 * Set under "0/1 set · 1 need attention" (Qlip build 489).
 *
 * Each row is rendered into a node of its own (`hostFor`), through a portal from one place in the form that never
 * changes, so it is the same row for as long as it is in the form. Its box draws only a place for it (`RowPlace`),
 * and the node is moved into whichever place shows it now. React owns what is in the node, and never the place's
 * own children, so moving the node is the DOM's business alone. A node holding the focus loses it when it is
 * moved; the place keeps where the focus was - the element and its selection - and gives it back.
 *
 * A collapsed box shows none of its rows, and they are not drawn either (`useOpenBoxes`): an Optional box of fifty
 * fields costs nothing until it is opened, as it did when its rows were drawn inside it.
 */

/** The nodes the rows are drawn into, by row: one each, for the form's life. */
export interface IRowHosts {
  hostFor: (name: string) => HTMLElement;
}

export const useRowHosts = (): IRowHosts => {
  const hosts = useRef(new Map<string, HTMLElement>());
  return useMemo(
    () => ({
      hostFor: (name: string) => {
        let host = hosts.current.get(name);
        if (!host) {
          host = document.createElement('div');
          host.className = 'readfirst-row-host';
          host.dataset.row = name;
          hosts.current.set(name, host);
        }
        return host;
      },
    }),
    []
  );
};

/** Where the focus was in a row being moved: the element, and what was selected in it. */
interface ISavedFocus {
  element: HTMLElement;
  /** In a text box: its selection. */
  input?: { start: number | null; end: number | null; direction: 'forward' | 'backward' | 'none' | null };
  /** In editable text (a rich editor): the page's selection, while it was inside the row. */
  range?: { anchorNode: Node; anchorOffset: number; focusNode: Node; focusOffset: number };
}

const savedFocus = new Map<HTMLElement, ISavedFocus>();

const saveFocus = (host: HTMLElement) => {
  const element = document.activeElement as HTMLElement | null;
  if (!element || !host.contains(element)) return;
  const saved: ISavedFocus = { element };
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    try {
      saved.input = {
        start: element.selectionStart,
        end: element.selectionEnd,
        direction: element.selectionDirection,
      };
    } catch {
      // a box with no selection (a checkbox, a number): its focus is enough
    }
  }
  // editable text (a rich editor) keeps its caret in the page's selection; a text box keeps its own, and setting the
  // page's selection around it put the box's caret back at its start
  const selection = element.isContentEditable ? document.getSelection() : null;
  if (
    selection?.rangeCount &&
    selection.anchorNode &&
    selection.focusNode &&
    host.contains(selection.anchorNode) &&
    host.contains(selection.focusNode)
  ) {
    saved.range = {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset,
    };
  }
  savedFocus.set(host, saved);
};

const restoreFocus = (host: HTMLElement) => {
  const saved = savedFocus.get(host);
  savedFocus.delete(host);
  if (!saved || !host.isConnected || !host.contains(saved.element)) return;
  saved.element.focus({ preventScroll: true });
  if (saved.input && saved.input.start !== null && saved.input.end !== null) {
    try {
      (saved.element as HTMLInputElement).setSelectionRange(
        saved.input.start,
        saved.input.end,
        saved.input.direction ?? undefined
      );
    } catch {
      // the box takes no selection after all
    }
  }
  if (saved.range && host.contains(saved.range.anchorNode) && host.contains(saved.range.focusNode)) {
    try {
      document
        .getSelection()
        ?.setBaseAndExtent(
          saved.range.anchorNode,
          saved.range.anchorOffset,
          saved.range.focusNode,
          saved.range.focusOffset
        );
    } catch {
      // the text changed under the selection: the focus is back, where the editor puts the caret
    }
  }
  // where the row is now: on screen, as little scrolled as it takes
  saved.element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
};

/**
 * The place a box keeps for a row: the row's node is moved into it, and out of it before it goes. A focus the row
 * held is given back where it lands (in the same commit: the place it leaves goes first).
 */
export const RowPlace = ({ host }: { host: HTMLElement }) => {
  const place = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = place.current;
    if (!element) return undefined;
    if (host.parentNode !== element) {
      element.appendChild(host);
      restoreFocus(host);
    }
    return () => {
      if (host.parentNode === element) {
        saveFocus(host);
        element.removeChild(host);
      }
    };
  }, [host]);
  return <div ref={place} className='readfirst-row-place' />;
};

/**
 * The rows, each drawn into its own node from here: one place in the form that does not change, so a row is never
 * drawn anew for moving. A focus kept for a row that went and did not come back in the same commit is dropped.
 */
export const RowStage = ({ rows }: { rows: ReactNode[] }) => {
  useLayoutEffect(() => {
    savedFocus.clear();
  });
  return <>{rows}</>;
};

/**
 * Which boxes have their rows drawn: the ones that are open. The form knows which boxes it opens (`expected`),
 * and a box's `OpenBoxMark` says which are - it is mounted with the box's content, which a collapsed box does
 * not mount. A row is drawn while either says its box is open, so it is there the moment its box opens and goes
 * once the box has closed; when only the mark changes that, the form draws again.
 */
export interface IOpenBoxes {
  /** Whether the rows of a box are drawn, given whether the form opens it. */
  drawsRows: (box: string, expected: boolean) => boolean;
  /** What a box's mark reports: its content is on show, or no longer. */
  onShown: (box: string, shown: boolean) => void;
  /** Whether a box's content is on show now. */
  isShown: (box: string) => boolean;
}

export const useOpenBoxes = (): IOpenBoxes => {
  const shown = useRef(new Set<string>());
  const expected = useRef<Record<string, boolean>>({});
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  return useMemo(() => {
    const draws = (box: string) => Boolean(expected.current[box]) || shown.current.has(box);
    return {
      drawsRows: (box, isExpected) => {
        expected.current[box] = isExpected;
        return draws(box);
      },
      onShown: (box, isShown) => {
        const before = draws(box);
        if (isShown) shown.current.add(box);
        else shown.current.delete(box);
        if (draws(box) !== before) redraw();
      },
      isShown: (box) => shown.current.has(box),
    };
  }, []);
};

/** Mounted with a box's content: tells the form the box is open (`useOpenBoxes`). Draws nothing. */
export const OpenBoxMark = ({
  box,
  onShown,
}: {
  box: string;
  onShown: IOpenBoxes['onShown'];
}) => {
  useLayoutEffect(() => {
    onShown(box, true);
    return () => onShown(box, false);
  }, [box, onShown]);
  return null;
};

/** A row drawn into its node: what a form's rows are, at the stage. */
export const stagedRow = (row: ReactNode, host: HTMLElement, name: string) =>
  createPortal(row, host, name);
