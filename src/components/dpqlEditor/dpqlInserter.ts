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
import { chipExtendedBy } from '../smartEditor/templateCompletions';

/** The word typed before the caret: a sigil (`@`, `$`) and what a name or a template goes on with after it. */
const TYPED_WORD = /[@$]?[\w.:{}-]*$/;

/**
 * What is typed before the caret in the text it is in: what a pick may take the place of. Never anything across a
 * chip: read from the whole text, the word before a caret just after a chip was the chip's own text
 * (`$record:{pos}`), and a pick deleted the chip - an operator picked after `pos` took its place (qorus#646,
 * David's review).
 */
const typedBeforeCaret = (editor: BaseEditor & ReactEditor & HistoryEditor): string => {
  const at = editor.selection?.anchor;
  if (!at) {
    return '';
  }
  try {
    const [node] = Editor.node(editor, at.path);
    return typeof (node as { text?: unknown }).text === 'string' ?
        (node as { text: string }).text.slice(0, at.offset)
      : '';
  } catch {
    // a path the editor no longer has: nothing was typed there
    return '';
  }
};

/** An operator that joins two values (`==`, `&&`, `between`): written with a space on each side. */
const isJoiningOperator = (item: { kind?: number; label?: string }) =>
  (item.kind === 14 || item.kind === 24) && !!item.label && !/^[[{.(!]/.test(item.label);

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

  // what the pick takes the place of: what was typed for it, in the text the caret is in
  const typed = typedBeforeCaret(ed);
  const charsToDelete = Math.min(
    typed.length,
    item.textEdit ?
      Math.max(0, ctx.cursorOffset - lspPositionToOffset(ctx.plainText, item.textEdit.range.start))
    : (TYPED_WORD.exec(typed)?.[0].length ?? 0)
  );
  /* A reference picked after a chip it goes on from (`$data:receive_order` and `.` typed after it) is the one
     reference: it takes the chip's place as well as what was typed (`chipExtendedBy`). */
  const extended = isTagCompletion(insertValue) ? chipExtendedBy(ed, typed, insertValue) : undefined;
  const deleted = extended ? typed.length : charsToDelete;
  if (deleted > 0) {
    const at = ed.selection.anchor;
    Transforms.delete(ed, {
      at: { anchor: { path: at.path, offset: at.offset - deleted }, focus: at },
    });
  }
  if (extended) {
    Transforms.removeNodes(ed, { at: extended });
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
  } else if (isJoiningOperator(item)) {
    // an operator after a value is written apart from it, and from the value that follows it: `pos == `
    const before = typedBeforeCaret(ed);
    const joined = /\s$/.test(before) || (!before && !hasChipBefore(ed)) ? '' : ' ';
    Transforms.insertText(ed, `${joined}${insertValue} `);
  } else {
    Transforms.insertText(ed, insertValue);
  }

  try {
    ReactEditor.focus(ed);
  } catch {
    // Editor may not be focused.
  }
};

/** Whether a chip is just before the caret, in the text the caret starts: a value an operator is written apart from. */
const hasChipBefore = (editor: BaseEditor & ReactEditor & HistoryEditor): boolean => {
  const at = editor.selection?.anchor;
  if (!at || at.offset !== 0) {
    return false;
  }
  try {
    const previous = Editor.previous(editor, { at: at.path });
    return (previous?.[0] as { type?: string } | undefined)?.type === 'tag';
  } catch {
    // nothing before it
    return false;
  }
};
