// Copyright 2026 Qore Technologies, s.r.o.
// Slate-based DPQL editor backed by Reqore's ReqoreRichTextEditor with
// LSP-driven completions, syntax highlighting, and diagnostics. Talks to
// the Qorus `/lsp` endpoint via the generic Reqraft LspClient.
//
// Lifted from qorus-ide src/components/DpqlRichtext/index.tsx on the
// feature/dpql-editor branch with three changes:
//   1. Renamed `DpqlRichtext` → `DpqlEditor` to match Reqraft naming.
//   2. Inlined `TemplatesListProps` (was imported from qorus-ide's
//      src/components/Field/richText.tsx).
//   3. Replaced the `{...({ decorate } as any)}` rest-spread cast with
//      a clean `decorate={decorate}` — Reqore ≥ 0.68.3 declares the
//      prop properly on `IReqoreRichTextEditorProps`.

import {
  ReqoreControlGroup,
  ReqoreDropdown,
  ReqoreMenu,
  ReqoreMenuDivider,
  ReqoreMenuItem,
} from '@qoretechnologies/reqore';
import { IReqoreDropdownProps } from '@qoretechnologies/reqore/dist/components/Dropdown';
import { ReqorePopover } from '@qoretechnologies/reqore/dist/components/Popover';
import {
  ReqoreRichTextEditor,
  TReqoreRichTextEditorRef,
} from '@qoretechnologies/reqore/dist/components/RichTextEditor';
import { IReqoreTagProps } from '@qoretechnologies/reqore/dist/components/Tag';
import { size } from 'lodash';
import React, {
  CSSProperties,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { RenderLeafProps } from 'slate-react/dist/components/editable';
import {
  DEFAULT_TEMPLATE_COLOR,
  FIELD_REF_COLOR,
  plainTextToSlate,
  slateToPlainText,
  TEMPLATE_COLORS,
} from './helpers';
import { IDpqlEditorProps, IDpqlEditorRef, ISlateElement } from './types';
import { useDpqlAutocomplete } from './useDpqlAutocomplete';
import { useDpqlLsp } from './useDpqlLsp';
import { useDpqlSyntaxHighlighting } from './useDpqlSyntaxHighlighting';

export type { IDpqlEditorProps, IDpqlEditorRef };

/**
 * Default props for the `Templates` `ReqoreDropdown` shown above the editor.
 * Inlined from qorus-ide's `src/components/Field/richText.tsx` so the
 * component is self-contained. Consumers don't typically need to override
 * these — they just pass `templates` and get the dropdown rendered with the
 * Reqore conventions used elsewhere in the IDE.
 */
const TEMPLATES_DROPDOWN_DEFAULTS: Partial<IReqoreDropdownProps> = {
  useTargetWidth: true,
  handler: 'focus',
  minWidth: '300px',
  listCustomTheme: {
    main: '#1e0d29',
  },
};

export const DpqlEditor = forwardRef<IDpqlEditorRef, IDpqlEditorProps>(
  (
    {
      value,
      onChange,
      provider,
      recordType,
      options,
      actionCode,
      height = '200px',
      readOnly = false,
      onBlur,
      templates,
      stateId,
    },
    ref
  ) => {
    const editorRef = useRef<TReqoreRichTextEditorRef>(null);
    const lastPlainTextRef = useRef(value);
    const decorate = useDpqlSyntaxHighlighting();

    const lsp = useDpqlLsp({ provider, recordType, options, actionCode });

    const autocomplete = useDpqlAutocomplete({
      getCompletions: lsp.getCompletions,
      isReady: lsp.isReady,
    });

    // Convert incoming plain text to Slate value.
    const slateValue = useMemo(() => plainTextToSlate(value), [value]);

    // Expose imperative methods via LSP.
    useImperativeHandle(
      ref,
      () => ({
        format: async () => {
          const formatted = await lsp.format();
          if (formatted !== null) {
            lastPlainTextRef.current = formatted;
            onChange(formatted);
          }
        },
        validate: lsp.validate,
        parse: lsp.parse,
        serialize: lsp.serialize,
      }),
      [lsp.format, lsp.validate, lsp.parse, lsp.serialize, onChange]
    );

    // Slate onChange -> serialize to plain text -> call parent onChange + notify LSP.
    const handleSlateChange = useCallback(
      (newValue: ISlateElement[]) => {
        const plainText = slateToPlainText(newValue);

        // Only fire onChange if the text actually changed.
        if (plainText !== lastPlainTextRef.current) {
          lastPlainTextRef.current = plainText;
          onChange(plainText);
          lsp.didChange(newValue);
        }

        // Trigger autocomplete check on every change (including
        // selection-only changes).
        if (editorRef.current && !readOnly) {
          autocomplete.onSlateChange(editorRef.current, newValue);
        }
      },
      [onChange, lsp, readOnly, autocomplete]
    );

    /**
     * Transform a template value for DPQL context.
     * - Current state fields: `$data:{stateId.field}` → `@field`.
     * - Wildcard templates: `$static:*` → `$static:` (user types field name).
     */
    const toDpqlValue = useCallback(
      (templateValue: string): { text: string; needsFieldName: boolean } => {
        if (stateId) {
          const prefix = `$data:{${stateId}.`;
          if (templateValue.startsWith(prefix) && templateValue.endsWith('}')) {
            const field = templateValue.slice(prefix.length, -1);
            return { text: `@${field}`, needsFieldName: false };
          }
        }
        if (templateValue.endsWith(':*')) {
          return { text: templateValue.slice(0, -1), needsFieldName: true };
        }
        return { text: templateValue, needsFieldName: false };
      },
      [stateId]
    );

    // Handle template selection from the dropdown.
    const handleTemplateSelect = useCallback(
      (item: { value?: string }) => {
        if (!item.value) return;

        const { text } = toDpqlValue(item.value);

        const currentText = lastPlainTextRef.current;
        const newText = currentText ? `${currentText}${text}` : text;

        lastPlainTextRef.current = newText;
        onChange(newText);
      },
      [toDpqlValue, onChange]
    );

    // Tag rendering: color-code based on prefix, enrich with field metadata.
    const handleGetTagProps = useCallback(
      (tag: ISlateElement): IReqoreTagProps => {
        const tagValue = tag.value?.toString();
        if (!tagValue) return {};

        // Field reference: @field_name
        if (tagValue.startsWith('@')) {
          const fieldName = tagValue.slice(1);
          const meta = lsp.fieldMeta[fieldName];
          const tooltip = meta
            ? `${meta.display_name || fieldName}${
                meta.type?.name ? ` (${meta.type.name})` : ''
              }${meta.short_desc ? `\n${meta.short_desc}` : ''}`
            : undefined;

          return {
            icon: 'Database2Line',
            color: FIELD_REF_COLOR.fg as `#${string}`,
            tooltip,
            label: meta?.display_name || fieldName,
          };
        }

        // Template variable: $prefix:{value}
        if (tagValue.startsWith('$')) {
          const colonIdx = tagValue.indexOf(':');
          const prefix =
            colonIdx > 1 ? tagValue.slice(1, colonIdx).toLowerCase() : '';
          const colors = TEMPLATE_COLORS[prefix] || DEFAULT_TEMPLATE_COLOR;

          return {
            icon: 'ExchangeDollarLine',
            color: colors.fg as `#${string}`,
          };
        }

        return {};
      },
      [lsp.fieldMeta]
    );

    // Custom renderLeaf for syntax highlighting.
    const customRenderLeaf = useCallback((props: RenderLeafProps) => {
      const style: CSSProperties = {};
      const leaf = props.leaf as any;

      if (leaf.keyword) style.color = '#c678dd';
      if (leaf.string) style.color = '#98c379';
      if (leaf.number) style.color = '#d19a66';
      if (leaf.operator) style.color = '#56b6c2';
      if (leaf.comment) style.color = '#5c6370';
      if (leaf.function) style.color = '#e5c07b';
      if (leaf.boolean) style.color = '#d19a66';
      if (leaf.error) style.borderBottom = '2px solid red';

      return (
        <span {...props.attributes} style={style}>
          {props.children}
        </span>
      );
    }, []);

    const hasTemplates = size(templates?.items) > 0;

    // Handle autocomplete item selection (click path).
    const handleCompletionSelect = useCallback(
      (item: { value?: string }) => {
        if (!item.value || !editorRef.current) return;
        const matchingItem = autocomplete.items.find(
          (i) => i.value === item.value
        );
        if (matchingItem) {
          autocomplete.onItemSelect(matchingItem, editorRef.current);
        }
      },
      [autocomplete]
    );

    return (
      <ReqoreControlGroup vertical fluid>
        {hasTemplates && !readOnly && (
          <ReqoreControlGroup>
            <ReqoreDropdown
              icon='MoneyDollarBoxLine'
              label='Templates'
              items={templates!.items}
              onItemSelect={handleTemplateSelect}
              filterable
              compact
              minimal
              caretPosition='right'
              {...TEMPLATES_DROPDOWN_DEFAULTS}
            />
          </ReqoreControlGroup>
        )}
        <div style={{ position: 'relative' }}>
          <ReqoreRichTextEditor
            ref={editorRef}
            value={slateValue as any}
            onChange={handleSlateChange as any}
            readOnly={readOnly}
            customRenderLeaf={customRenderLeaf}
            decorate={decorate}
            getTagProps={handleGetTagProps as any}
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

DpqlEditor.displayName = 'DpqlEditor';
