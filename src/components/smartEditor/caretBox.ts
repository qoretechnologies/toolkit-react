// Copyright 2026 Qore Technologies, s.r.o.
import { BasePoint } from 'slate';
import { ReactEditor } from 'slate-react';
import type { TOpenedAt } from './useLspAutocomplete';

/**
 * Where a list opened at a point of an editor's text is drawn from, in the window: the caret's left and its line's
 * top and bottom. A list of templates goes where its pick goes, so it is drawn from there however it was opened - a
 * click in the text, Tab, the template button, a text emptied (David on reqraft #162: from the template button the
 * picker opened at the far right end of an empty text, where the button is, and a click in the text then opened it at
 * the start).
 *
 * A caret in an empty line has no box of its own (its range measures 0 x 0): it is at the start of the line's leaf,
 * and failing that at the start of the text, inside its padding - never at the text's edge or its far end.
 */
export const caretBoxAt = (editor: ReactEditor, point: BasePoint): TOpenedAt => {
  const root = ReactEditor.toDOMNode(editor, editor);
  try {
    const box = ReactEditor.toDOMRange(editor, { anchor: point, focus: point }).getBoundingClientRect();
    if (box.width || box.height) {
      return { left: box.left, top: box.top, bottom: box.bottom };
    }
  } catch {
    // a point the editor does not draw: its line's start, below
  }
  try {
    // the leaf the point is in, which an empty line draws as a zero-width character at its start
    const [leaf] = ReactEditor.toDOMPoint(editor, point);
    const element = leaf instanceof Element ? leaf : leaf.parentElement;
    const box = element?.closest('[data-slate-leaf]')?.getBoundingClientRect();
    if (box && (box.width || box.height)) {
      return { left: box.left, top: box.top, bottom: box.bottom };
    }
  } catch {
    // not drawn: the text's start, below
  }
  const box = root.getBoundingClientRect();
  const style = getComputedStyle(root);
  const inset = (side: 'Left' | 'Top' | 'Bottom') =>
    (parseFloat(style[`padding${side}`]) || 0) + (parseFloat(style[`border${side}Width`]) || 0);
  return { left: box.left + inset('Left'), top: box.top + inset('Top'), bottom: box.bottom - inset('Bottom') };
};
