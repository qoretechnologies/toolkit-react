// Copyright 2026 Qore Technologies, s.r.o.
// DPQL-specific completion inserter — inserts `@field` and `$template`
// completions as Slate tag elements (so they render as interactive chips
// in the editor) and falls back to plain text for keywords/operators.

import { BaseEditor, Editor, Transforms } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import { TCompletionInserter } from '../smartEditor/types';
import { getTagLabel, isTagCompletion, slateSelectionToOffset, slateToPlainText } from './dpqlHelpers';
import { ISlateElement } from '../smartEditor/types';

/**
 * Walk back from the cursor to find the start of the partial token the
 * user typed. Matches the same heuristic the generic
 * `useLspAutocomplete.findTokenStart` uses internally — duplicated here
 * because the inserter runs at completion-accept time and needs to slice
 * the partial token before inserting the chosen completion.
 */
function findTokenStart(plainText: string, cursorOffset: number): number {
  let i = cursorOffset - 1;
  while (i >= 0 && /[\w.:{}-]/.test(plainText[i])) {
    i--;
  }
  if (i >= 0 && /[@$]/.test(plainText[i])) {
    i--;
  }
  return i + 1;
}

/**
 * DPQL completion inserter. For tag completions (`@field` / `$template:…`),
 * inserts a Slate tag element so the value renders as an interactive chip.
 * For everything else (keywords, operators, functions), inserts plain text.
 * In both cases, deletes the partial token under the cursor first.
 */
export const dpqlCompletionInserter: TCompletionInserter = (item, editor) => {
  const ed = editor as BaseEditor & ReactEditor & HistoryEditor;
  const { selection } = ed;
  if (!selection) return;

  // Delete the partial token the user typed.
  const elements = ed.children as ISlateElement[];
  const plainText = slateToPlainText(elements);
  const cursorOffset = slateSelectionToOffset(
    elements,
    selection.anchor.path as number[],
    selection.anchor.offset
  );
  const tokenStart = findTokenStart(plainText, cursorOffset);
  const charsToDelete = cursorOffset - tokenStart;

  if (charsToDelete > 0) {
    for (let i = 0; i < charsToDelete; i++) {
      Editor.deleteBackward(ed, { unit: 'character' });
    }
  }

  const insertValue = item.insertText || item.label;

  if (isTagCompletion(insertValue)) {
    const tagElement: ISlateElement = {
      type: 'tag',
      value: insertValue,
      label: getTagLabel(insertValue),
      children: [{ text: '' }],
    };
    Transforms.insertNodes(ed, tagElement as any);
    Transforms.move(ed);
  } else {
    Transforms.insertText(ed, insertValue);
  }

  try {
    ReactEditor.focus(ed);
  } catch {
    // Editor may not be focused.
  }
};
