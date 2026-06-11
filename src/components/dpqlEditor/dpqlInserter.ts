// Copyright 2026 Qore Technologies, s.r.o.
// DPQL-specific completion inserter — inserts `@field` and `$template`
// completions as Slate tag elements (so they render as interactive chips
// in the editor) and falls back to plain text for keywords/operators.

import { BaseEditor, Editor, Transforms } from 'slate';
import { HistoryEditor } from 'slate-history';
import { ReactEditor } from 'slate-react';
import { expandSnippet, lspPositionToOffset } from '../smartEditor/helpers';
import { ISlateElement, TCompletionInserter } from '../smartEditor/types';
import { getTagLabel, isTagCompletion } from './dpqlHelpers';

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
 *
 * Partial-token deletion happens first. When the server supplies a
 * `textEdit.range`, that's the authoritative span to replace; we delete
 * from `textEdit.range.start` to the current cursor (matching the LSP
 * spec). Without `textEdit`, fall back to the find-token-start heuristic.
 */
export const dpqlCompletionInserter: TCompletionInserter = (item, editor, ctx) => {
  const ed = editor as BaseEditor & ReactEditor & HistoryEditor;
  const rawValue = item.textEdit?.newText ?? item.insertText ?? item.label;
  // Expand LSP snippets (`insertTextFormat === 2`) so function templates
  // like `slice(${1:List Value}, ${2:Index or Range})$0` insert as
  // `slice(List Value, Index or Range)` instead of leaking the snippet
  // syntax. Tag completions (`@field` / `$template`) are never snippets.
  const insertValue =
    item.insertTextFormat === 2 ? expandSnippet(rawValue) : rawValue;

  // Replace mode — user clicked an existing chip. Atomically swap the
  // node at the chip's path for the chosen completion. No token-delete
  // dance, no selection dependency — just `removeNodes` + `insertNodes`
  // inside `withoutNormalizing` so Slate sees a single batched op.
  if (ctx.replacementPath) {
    const path = ctx.replacementPath;
    Editor.withoutNormalizing(ed, () => {
      Transforms.removeNodes(ed, { at: path });
      if (isTagCompletion(insertValue)) {
        const tagElement: ISlateElement = {
          type: 'tag',
          value: insertValue,
          label: getTagLabel(insertValue),
          children: [{ text: '' }],
        };
        Transforms.insertNodes(ed, tagElement as any, { at: path, select: true });
      } else {
        Transforms.insertNodes(ed, [{ text: insertValue }] as any, {
          at: path,
          select: true,
        });
      }
    });
    try {
      ReactEditor.focus(ed);
    } catch {
      // Editor may not be focusable in this render cycle.
    }
    return;
  }

  // Normal (typing) path — needs a live selection. Compute how many
  // plain-text characters of the partial token to delete before
  // inserting at the cursor.
  if (!ed.selection) return;

  let charsToDelete: number;
  if (item.textEdit) {
    const startOffset = lspPositionToOffset(ctx.plainText, item.textEdit.range.start);
    charsToDelete = Math.max(0, ctx.cursorOffset - startOffset);
  } else {
    // Heuristic fallback — same logic the old DPQL inserter used.
    const tokenStart = findTokenStart(ctx.plainText, ctx.cursorOffset);
    charsToDelete = Math.max(0, ctx.cursorOffset - tokenStart);
  }

  if (charsToDelete > 0) {
    for (let i = 0; i < charsToDelete; i++) {
      Editor.deleteBackward(ed, { unit: 'character' });
    }
  }

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
