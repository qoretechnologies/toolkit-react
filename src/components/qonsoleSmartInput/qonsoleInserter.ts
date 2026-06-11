// Copyright 2026 Qore Technologies, s.r.o.
// Qonsole-specific completion inserter. Branches on the LSP item's
// `command` field — when the server attaches
// `{ command: "qonsole.startWizard", arguments: [{...}] }` (only on
// `kind: 'wizard'` items), accept the item by firing the wrapper's
// `onWizardStart` callback INSTEAD of inserting text. Everything
// else falls through to the generic text inserter.
//
// The server explicitly rejects `workspace/executeCommand` for the
// `qonsole.*` namespace (see qorus/Classes/QorusLspWebSocketHandler.qc:2197)
// — wizard launch is REST-driven, not LSP-driven. So the client
// owns the launch flow: pull `arguments[0].start_path` and POST to it
// via the consumer's apiHost. That's a qorus-ide-side concern.

import { Editor, Transforms } from 'slate';
import { lspPositionToOffset } from '../smartEditor/helpers';
import { TCompletionInserter } from '../smartEditor/types';

/**
 * Factory — pass the wrapper's `onWizardStart` callback (or
 * `undefined` to fall back to text insertion for wizard items).
 */
export function makeQonsoleCompletionInserter(
  onWizardStart?: (args: Record<string, unknown>) => void
): TCompletionInserter {
  return (item, editor, ctx) => {
    // Branch on the command field. When the server has attached a
    // wizard-launch command AND the consumer has wired the callback,
    // fire it and skip the text insertion entirely.
    const cmd = item.command;
    if (
      cmd?.command === 'qonsole.startWizard' &&
      onWizardStart &&
      Array.isArray(cmd.arguments) &&
      cmd.arguments.length > 0
    ) {
      const args = cmd.arguments[0];
      if (args && typeof args === 'object') {
        onWizardStart(args as Record<string, unknown>);
        return;
      }
    }

    // Default path — same shape as `defaultCompletionInserter` in
    // SmartEditor.tsx. Apply textEdit when present (LSP-compliant
    // partial-token replacement); otherwise insert at cursor.
    const newText = item.textEdit?.newText ?? item.insertText ?? item.label;

    // Replace mode (chip click) — atomic node swap. Same as
    // defaultCompletionInserter.
    if (ctx.replacementPath) {
      const path = ctx.replacementPath;
      Editor.withoutNormalizing(editor, () => {
        Transforms.removeNodes(editor, { at: path });
        Transforms.insertNodes(editor, [{ text: newText }] as any, {
          at: path,
          select: true,
        });
      });
      return;
    }

    // Typing path — delete partial token using textEdit.range, then
    // insert the server's replacement.
    if (item.textEdit) {
      const startOffset = lspPositionToOffset(
        ctx.plainText,
        item.textEdit.range.start
      );
      const charsToDelete = Math.max(0, ctx.cursorOffset - startOffset);
      for (let i = 0; i < charsToDelete; i++) {
        Editor.deleteBackward(editor, { unit: 'character' });
      }
    }
    Transforms.insertText(editor, newText);
  };
}
