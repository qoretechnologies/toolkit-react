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
import { Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { defaultSlateConverter } from './helpers';
import { ISlateElement, ISmartEditorProps, TCompletionInserter } from './types';
import { useLspAutocomplete } from './useLspAutocomplete';

/**
 * Default completion inserter — replaces the partial token under the cursor
 * with the item's `insertText ?? label` as plain text. Wrappers override
 * this for richer behavior (e.g. DPQL's tag-element insertion for `@field`
 * / `$template` completions).
 */
const defaultCompletionInserter: TCompletionInserter = (item, editor) => {
  const insertText = item.insertText || item.label;
  Transforms.insertText(editor, insertText);
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

    const slateValue = useMemo(
      () => converter.toSlateNodes(value),
      [value, converter]
    );

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
          {autocomplete.isOpen && autocomplete.items.length > 0 && (
            <ReqorePopover
              component='span'
              wrapperStyle={{
                position: 'absolute',
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
              onToggleChange={(open) => {
                if (!open) autocomplete.close();
              }}
            />
          )}
        </div>
      </ReqoreControlGroup>
    );
  }
);

SmartEditor.displayName = 'SmartEditor';
