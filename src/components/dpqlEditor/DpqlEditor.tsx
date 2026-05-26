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
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SmartEditor } from '../smartEditor/SmartEditor';
import { ISlateConverter, ISlateElement } from '../smartEditor/types';
import { dpqlSlateConverter, richtextResponseToSlate } from './dpqlHelpers';
import { dpqlCompletionInserter } from './dpqlInserter';
import { makeDpqlTagRenderer } from './dpqlTags';
import { IDpqlEditorProps, IDpqlEditorRef } from './types';
import { useDpqlSession } from './useDpqlSession';

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
      useServerParse = false,
      alertPayloadContext = false,
      fsmContext,
    },
    ref
  ) => {
    const dpql = useDpqlSession({
      provider,
      recordType,
      options,
      actionCode,
      initialText: value,
      alertPayloadContext,
      fsmContext,
    });

    // Server-parse state: when `useServerParse` is true, we ask the
    // LSP server's `dpql/toRichtext` to convert the plain-text value
    // into a structured Slate tree. The result is cached against the
    // `value` it parsed — so subsequent renders with the same text
    // reuse it without another roundtrip. `null` until the first
    // response arrives (or when the request errored — caller falls
    // back to the client-side regex parser via `dpqlSlateConverter`).
    const [serverParsedNodes, setServerParsedNodes] = useState<
      ISlateElement[] | null
    >(null);
    const [serverParsedFor, setServerParsedFor] = useState<string | null>(
      null
    );
    const [isParsing, setIsParsing] = useState(false);
    // Tracks the most recent in-flight request so a slow response
    // can't overwrite a newer one (the user typed faster than the
    // server replied).
    const parseRequestIdRef = useRef(0);

    useEffect(() => {
      if (!useServerParse) {
        // Clear any cached server-parsed nodes when the prop is
        // toggled off — next render uses the client-side converter.
        setServerParsedNodes(null);
        setServerParsedFor(null);
        setIsParsing(false);
        return;
      }
      const client = dpql.session.client;
      if (!client || !dpql.session.isReady) return;
      // Empty value — short-circuit to the empty document so the user
      // doesn't see a spinner for a no-op parse.
      if (!value) {
        setServerParsedNodes([{ type: 'paragraph', children: [{ text: '' }] }]);
        setServerParsedFor('');
        setIsParsing(false);
        return;
      }
      // Already parsed this exact text — no need to re-request.
      if (serverParsedFor === value && serverParsedNodes) {
        return;
      }
      const reqId = ++parseRequestIdRef.current;
      setIsParsing(true);
      client
        .customRequest<unknown>('dpql/toRichtext', { text: value })
        .then((response) => {
          if (reqId !== parseRequestIdRef.current) return;
          const nodes = richtextResponseToSlate(response);
          if (nodes) {
            setServerParsedNodes(nodes);
            setServerParsedFor(value);
          } else {
            // Bad shape — fall back to client-side parsing by leaving
            // the cache empty for this value. The custom converter
            // below detects the miss and uses `plainTextToSlate`.
            setServerParsedNodes(null);
            setServerParsedFor(null);
          }
        })
        .catch(() => {
          // Network / server error — same fallback as bad-shape.
          if (reqId !== parseRequestIdRef.current) return;
          setServerParsedNodes(null);
          setServerParsedFor(null);
        })
        .finally(() => {
          if (reqId === parseRequestIdRef.current) {
            setIsParsing(false);
          }
        });
    }, [
      useServerParse,
      value,
      dpql.session.client,
      dpql.session.isReady,
      serverParsedFor,
      serverParsedNodes,
    ]);

    // When server-parse is active, override `toSlateNodes` so SmartEditor
    // gets the server's tree for the matching value, falling through to
    // the client regex parser for anything else (initial empty string,
    // mid-edit echoes, error fallbacks). Other converter methods are
    // delegated to the base — slate→plain text and offset math are pure
    // and don't need server input.
    const converter = useMemo<ISlateConverter>(() => {
      if (!useServerParse) return dpqlSlateConverter;
      return {
        ...dpqlSlateConverter,
        toSlateNodes: (text: string) => {
          if (
            text === serverParsedFor &&
            serverParsedNodes
          ) {
            return serverParsedNodes;
          }
          return dpqlSlateConverter.toSlateNodes(text);
        },
      };
    }, [useServerParse, serverParsedFor, serverParsedNodes]);

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
        tagRenderer={tagRenderer}
        triggerCharacters={DPQL_TRIGGERS}
        converter={converter}
        completionInserter={dpqlCompletionInserter}
        topActions={topActions}
        height={height}
        readOnly={readOnly}
        onBlur={onBlur}
        isLoading={isParsing}
      />
    );
  }
);

DpqlEditor.displayName = 'DpqlEditor';
