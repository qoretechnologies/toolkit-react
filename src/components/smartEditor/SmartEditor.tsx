// Copyright 2026 Qore Technologies, s.r.o.
// Generic Slate-based smart editor primitive. Wraps Reqore's
// `ReqoreRichTextEditor` plus a caller-provided `useLspSession` result —
// rendering of completions, diagnostics, and language-specific styling
// flows from the props. The primitive itself has no language semantics:
// language wrappers (e.g. `DpqlEditor`) own the session (via
// `useLspSession`), react to prop changes by dispatching `<lang>/*` custom
// methods on the live client, and pass everything down here.

import {
  ReqoreControlGroup,
  ReqoreMenu,
  ReqoreMenuDivider,
  ReqoreMenuItem,
} from '@qoretechnologies/reqore';
import { ReqorePopover } from '@qoretechnologies/reqore/dist/components/Popover';
import {
  ReqoreRichTextEditor,
  TReqoreRichTextEditorRef,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { defaultSlateConverter, lspPositionToOffset } from './helpers';
import { ISlateElement, ISmartEditorProps, TCompletionInserter } from './types';
import { useLspAutocomplete } from './useLspAutocomplete';

/**
 * Default completion inserter — applies the server-provided `textEdit`
 * when present (LSP-compliant: replace the exact span the server
 * specified with `newText`), or falls back to inserting `insertText` at
 * the cursor. Without the `textEdit` path, the partial token the user
 * typed before requesting completions would be duplicated — e.g. typed
 * `-` + inserted `--desc=` becomes `---desc=`. Wrappers (DPQL) override
 * this entirely to insert Slate tag elements for `@field` / `$template`.
 */
const defaultCompletionInserter: TCompletionInserter = (item, editor, ctx) => {
  const newText = item.textEdit?.newText ?? item.insertText ?? item.label;

  // Replace mode — atomically swap the node at the chip's path for the
  // chosen completion as plain text. (Language wrappers that need tag
  // chips override this entirely.)
  if (ctx.replacementPath) {
    const path = ctx.replacementPath;
    Editor.withoutNormalizing(editor, () => {
      Transforms.removeNodes(editor, { at: path });
      Transforms.insertNodes(editor, [{ text: newText }] as any, {
        at: path,
        select: true,
      });
    });
    try {
      ReactEditor.focus(editor);
    } catch {
      // Editor may not be focusable in this render cycle.
    }
    return;
  }

  if (item.textEdit) {
    const startOffset = lspPositionToOffset(ctx.plainText, item.textEdit.range.start);
    // `cursorOffset - startOffset` is the number of plain-text characters
    // between the start of the LSP-specified replacement range and the
    // current caret. Those characters are the partial token the user
    // typed; delete them before inserting.
    const charsToDelete = Math.max(0, ctx.cursorOffset - startOffset);
    for (let i = 0; i < charsToDelete; i++) {
      Editor.deleteBackward(editor, { unit: 'character' });
    }
  }

  Transforms.insertText(editor, newText);
  try {
    ReactEditor.focus(editor);
  } catch {
    // Editor may not be focused.
  }
};

export const SmartEditor = forwardRef<TReqoreRichTextEditorRef, ISmartEditorProps>(
  (
    {
      session,
      value,
      onChange,
      decorate,
      customRenderLeaf,
      tagRenderer,
      onTagClick,
      triggerCharacters,
      converter = defaultSlateConverter,
      completionInserter = defaultCompletionInserter,
      topActions,
      height = '200px',
      readOnly = false,
      onBlur,
    },
    ref
  ) => {
    const editorRef = useRef<TReqoreRichTextEditorRef>(null);
    const lastPlainTextRef = useRef(value);
    // Cached Slate nodes. Updated only on EXTERNAL value changes (initial
    // mount, programmatic setValue, format result, etc.) — not on the
    // round-trip echo from user typing. Slate's internal state is the
    // source of truth between renders; passing a fresh `slateValue` ref
    // on every keystroke triggers `useUpdateEffect` in ReqoreRichTextEditor
    // which re-runs `plainTextToSlate` and aggressively re-tokenizes
    // partial input (e.g. typed `@s` collapses to a single tag chip,
    // making the rest of the field name impossible to type).
    const slateValueRef = useRef<ISlateElement[] | null>(null);

    // Forward the underlying Slate editor ref so wrappers can do
    // programmatic focus / selection / transforms.
    useImperativeHandle(ref, () => editorRef.current as TReqoreRichTextEditorRef, []);

    const autocomplete = useLspAutocomplete({
      getCompletions: session.getCompletions,
      isReady: session.isReady,
      triggerCharacters,
      converter,
      inserter: completionInserter,
    });

    const slateValue = useMemo(() => {
      // Return the cached Slate nodes when `value` is just the echo of the
      // last plainText we emitted from the editor — Slate's internal state
      // already reflects that text, no need to re-tokenize.
      if (
        slateValueRef.current !== null &&
        value === lastPlainTextRef.current
      ) {
        return slateValueRef.current;
      }
      const next = converter.toSlateNodes(value);
      slateValueRef.current = next;
      return next;
    }, [value, converter]);

    const handleSlateChange = useCallback(
      (newNodes: ISlateElement[]) => {
        const plainText = converter.fromSlateNodes(newNodes);

        if (plainText !== lastPlainTextRef.current) {
          lastPlainTextRef.current = plainText;
          onChange(plainText);
          session.didChange(plainText);
        }

        if (editorRef.current && !readOnly) {
          autocomplete.onSlateChange(editorRef.current as any, newNodes);
        }
      },
      [onChange, session, readOnly, autocomplete, converter]
    );

    /**
     * Default tag-click handler — Replace mode. The clicked chip stays
     * visible, the autocomplete dropdown opens anchored at the chip's
     * viewport rect, and the chosen completion atomically swaps the
     * chip for the new value (no flicker, no partial plain-text state).
     *
     * Picking up the chip's DOM rect (via `ReactEditor.toDOMNode`) avoids
     * relying on the editor selection — clicks on a Slate VOID inline
     * don't always update `editor.selection` reliably. The chip path
     * (from `findPath`) is what the autocomplete forwards to the inserter
     * via `ctx.replacementPath` to do the atomic swap.
     */
    const handleTagClickDefault = useCallback(
      (tag: ISlateElement, editor: TReqoreRichTextEditorRef) => {
        if (readOnly) return;
        try {
          const tagPath = ReactEditor.findPath(editor, tag as any);
          const domNode = ReactEditor.toDOMNode(editor, tag as any);
          const rect = (domNode as HTMLElement).getBoundingClientRect();
          autocomplete.openAtChip(editor, tagPath, {
            left: rect.left,
            bottom: rect.bottom,
          });
        } catch {
          // Tag may have been removed mid-render — ignore.
        }
      },
      [readOnly, autocomplete]
    );

    const resolvedTagClick = onTagClick ?? handleTagClickDefault;

    // Reqore's `ReqoreRichTextEditor` memoizes its `renderElement` over
    // deps that do NOT include `onTagClick`. That means whichever
    // `onTagClick` we passed on the FIRST render gets captured forever —
    // subsequent renders' fresh closures (with up-to-date `isReady`,
    // `autocomplete`, etc.) are silently ignored. The chip click ends up
    // calling a stale handler with a stale `isReady`, which is why we
    // see `isReady: false` in `openAtChip` even after the LSP has long
    // since connected.
    //
    // Workaround: pass a STABLE wrapper to Reqore that internally reads
    // the latest `resolvedTagClick` from a ref. Reqore captures the
    // wrapper once, but every call indirects through the ref so the
    // user-visible behaviour is always current.
    const resolvedTagClickRef = useRef(resolvedTagClick);
    resolvedTagClickRef.current = resolvedTagClick;
    const stableOnTagClick = useCallback((tag: any) => {
      if (editorRef.current) {
        resolvedTagClickRef.current(
          tag as ISlateElement,
          editorRef.current
        );
      }
    }, []);

    const handleCompletionSelect = useCallback(
      (item: { value?: string }) => {
        if (!item.value || !editorRef.current) return;
        const matching = autocomplete.items.find((i) => i.value === item.value);
        if (matching) {
          autocomplete.onItemSelect(matching, editorRef.current as any);
        }
      },
      [autocomplete]
    );

    return (
      <ReqoreControlGroup vertical fluid>
        {topActions}
        <div style={{ position: 'relative' }}>
          <ReqoreRichTextEditor
            ref={editorRef}
            value={slateValue as any}
            onChange={handleSlateChange as any}
            readOnly={readOnly}
            customRenderLeaf={customRenderLeaf}
            decorate={decorate}
            getTagProps={tagRenderer as any}
            onTagClick={stableOnTagClick}
            onBlur={onBlur}
            panelProps={{
              fluid: true,
              flat: true,
              style: {
                minHeight: height,
                fontFamily: 'monospace',
                fontSize: '13px',
              },
            }}
          />
          {autocomplete.isOpen &&
            (autocomplete.items.length > 0 || autocomplete.isReplaceMode) && (
            <ReqorePopover
              key={autocomplete.popoverKey}
              component='span'
              wrapperStyle={{
                // Viewport-positioned anchor placed at the cursor's
                // screen coordinates (computed in `positionTrigger`).
                // `fixed` avoids parent-offset math (panel padding,
                // scroll position, etc.).
                position: 'fixed',
                top: autocomplete.position.top,
                left: autocomplete.position.left,
                width: '1px',
                height: '1px',
                pointerEvents: 'none',
              }}
              content={
                <ReqoreMenu
                  rounded
                  flat
                  maxHeight='300px'
                  width='300px'
                  padded={false}
                >
                  {autocomplete.items.length === 0 &&
                    autocomplete.isReplaceMode && (
                      <ReqoreMenuItem
                        icon='LoaderLine'
                        label={
                          session.isReady
                            ? 'No alternatives available'
                            : 'Connecting to language server…'
                        }
                        disabled
                        compact
                      />
                    )}
                  {(() => {
                    let flatIndex = 0;
                    return autocomplete.groups.map((group) => (
                      <React.Fragment key={group.label || '_default'}>
                        {group.label && <ReqoreMenuDivider label={group.label} />}
                        {group.items.map((item) => {
                          const itemIndex = flatIndex++;
                          return (
                            <ReqoreMenuItem
                              key={item.value}
                              icon={item.icon as any}
                              label={item.label}
                              description={item.description}
                              selected={itemIndex === autocomplete.focusedIndex}
                              scrollIntoView={
                                itemIndex === autocomplete.focusedIndex
                              }
                              onClick={() =>
                                handleCompletionSelect({ value: item.value })
                              }
                              compact
                            />
                          );
                        })}
                      </React.Fragment>
                    ));
                  })()}
                </ReqoreMenu>
              }
              openOnMount
              noArrow
              placement='bottom-start'
              handler='click'
              closeOnOutsideClick
              closeOnInsideClick={false}
              minWidth='300px'
              flat
              onToggleChange={autocomplete.handleExternalClose}
            />
          )}
        </div>
      </ReqoreControlGroup>
    );
  }
);

SmartEditor.displayName = 'SmartEditor';
