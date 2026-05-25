// Copyright 2026 Qore Technologies, s.r.o.
// DpqlEditor — Slate-based DPQL smart text field. Thin wrapper over the
// generic `SmartEditor` primitive, configured with DPQL-flavored knobs:
// regex-driven syntax highlighting, tag rendering for $template / @field,
// the templates dropdown above the editor, plain-text↔Slate conversion
// that recognises DPQL tag patterns, and tag-element insertion for
// completions whose `insertText` starts with `@` or `$`.

import {
  ReqoreControlGroup,
  ReqoreDropdown,
} from '@qoretechnologies/reqore';
import { IReqoreDropdownProps } from '@qoretechnologies/reqore/dist/components/Dropdown';
import { size } from 'lodash';
import {
  CSSProperties,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
} from 'react';
import { RenderLeafProps } from 'slate-react/dist/components/editable';
import { SmartEditor } from '../smartEditor/SmartEditor';
import { dpqlSlateConverter } from './dpqlHelpers';
import { dpqlCompletionInserter } from './dpqlInserter';
import { makeDpqlTagRenderer } from './dpqlTags';
import { IDpqlEditorProps, IDpqlEditorRef } from './types';
import { useDpqlSession } from './useDpqlSession';
import { useDpqlSyntaxHighlighting } from './useDpqlSyntaxHighlighting';

export type { IDpqlEditorProps, IDpqlEditorRef };

/**
 * Default props for the `Templates` `ReqoreDropdown` shown above the editor.
 * Inlined here so the component is self-contained.
 */
const TEMPLATES_DROPDOWN_DEFAULTS: Partial<IReqoreDropdownProps> = {
  useTargetWidth: true,
  handler: 'focus',
  minWidth: '300px',
  listCustomTheme: {
    main: '#1e0d29',
  },
};

// Trigger characters that open the autocomplete on typing. Space is
// deliberately NOT in the set — typing a space after a chip (or after a
// keyword like `==`) shouldn't pop the dropdown. Sigils (`@`, `$`) and
// in-token punctuation (`.`, `:`) cover the meaningful cases; the rest
// of completion is handled by typing inside an already-open token.
const DPQL_TRIGGERS = new Set(['@', '$', '.', ':']);

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
    const decorate = useDpqlSyntaxHighlighting();

    const dpql = useDpqlSession({
      provider,
      recordType,
      options,
      actionCode,
      initialText: value,
    });

    const tagRenderer = useMemo(
      () => makeDpqlTagRenderer(dpql.fieldMeta),
      [dpql.fieldMeta]
    );

    useImperativeHandle(
      ref,
      (): IDpqlEditorRef => ({
        format: async () => {
          const formatted = await dpql.session.format();
          if (formatted !== null && formatted !== value) {
            onChange(formatted);
          }
        },
        validate: dpql.validate,
        parse: dpql.parse,
        serialize: dpql.serialize,
      }),
      [dpql, value, onChange]
    );

    // Custom renderLeaf for syntax highlighting + error underlines.
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

    const handleTemplateSelect = useCallback(
      (item: { value?: string }) => {
        if (!item.value) return;
        const { text } = toDpqlValue(item.value);
        const newText = value ? `${value}${text}` : text;
        onChange(newText);
      },
      [toDpqlValue, value, onChange]
    );

    const hasTemplates = size(templates?.items) > 0;

    const topActions =
      hasTemplates && !readOnly ? (
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
      ) : null;

    return (
      <SmartEditor
        session={dpql.session}
        value={value}
        onChange={onChange}
        decorate={decorate}
        customRenderLeaf={customRenderLeaf}
        tagRenderer={tagRenderer}
        triggerCharacters={DPQL_TRIGGERS}
        converter={dpqlSlateConverter}
        completionInserter={dpqlCompletionInserter}
        topActions={topActions}
        height={height}
        readOnly={readOnly}
        onBlur={onBlur}
      />
    );
  }
);

DpqlEditor.displayName = 'DpqlEditor';
